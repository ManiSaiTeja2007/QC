"""Core Circuit Storage Manager and Security Shield.

Provides atomic, thread-safe, and path-sanitized filesystem operations for JSON
quantum circuits and their master index catalog.
"""

import json
import os
import re
from pathlib import Path
from typing import Optional, List, Dict, Any, Set
from qiskit import QuantumCircuit

from backend.app.schemas.circuit_file import (
    CircuitFileSchema,
    CircuitGateSchema,
    CircuitLogicalOpSchema,
    CircuitMetadataSchema,
    CircuitIndexSchema,
    CircuitIndexEntrySchema,
)

# Project root and circuits directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
CIRCUITS_DIR = PROJECT_ROOT / "circuits"
INDEX_FILE = CIRCUITS_DIR / "index.json"

# Safe identifier pattern
SAFE_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]+$")

# Whitelist of supported quantum gates
SUPPORTED_GATES: Set[str] = {
    "H", "X", "Y", "Z", "S", "SDG", "T", "TDG",
    "CX", "CY", "CZ", "CH", "SWAP", "ISWAP",
    "CCX", "CSWAP", "RX", "RY", "RZ", "P", "U",
    "MEASURE", "RESET"
}


def ensure_storage_dir() -> Path:
    """Ensures the circuits/ storage directory exists."""
    CIRCUITS_DIR.mkdir(parents=True, exist_ok=True)
    return CIRCUITS_DIR


def sanitize_circuit_id(circuit_id: str) -> str:
    """Validates and sanitizes a circuit identifier against directory traversal."""
    if not circuit_id or not SAFE_ID_REGEX.match(circuit_id):
        raise ValueError(
            f"Invalid circuit ID '{circuit_id}'. ID must only contain alphanumeric characters, hyphens, and underscores."
        )
    return circuit_id


def get_circuit_file_path(circuit_id: str) -> Path:
    """Resolves and validates that the target file path resides strictly inside circuits/."""
    safe_id = sanitize_circuit_id(circuit_id)
    target_path = (CIRCUITS_DIR / f"{safe_id}.json").resolve()
    base_dir = ensure_storage_dir().resolve()

    if target_path.parent != base_dir:
        raise ValueError(f"Path traversal detected for circuit ID '{circuit_id}'")

    return target_path


def validate_circuit_semantics(circuit: CircuitFileSchema) -> None:
    """Validates quantum circuit semantics, qubit bounds, and gate naming."""
    n_qubits = circuit.num_qubits
    if n_qubits < 1 or n_qubits > 12:
        raise ValueError(f"num_qubits ({n_qubits}) must be between 1 and 12")

    if len(circuit.gates) > 1000:
        raise ValueError(f"Circuit gate count ({len(circuit.gates)}) exceeds maximum limit of 1000")

    for idx, g in enumerate(circuit.gates):
        gate_name = g.name.upper()
        if gate_name not in SUPPORTED_GATES:
            raise ValueError(f"Gate {idx + 1}: Unsupported gate name '{g.name}'")

        if not g.qubits:
            raise ValueError(f"Gate {idx + 1} ({gate_name}): Must specify at least one qubit")

        # Check qubit bounds
        for q in g.qubits:
            if q < 0 or q >= n_qubits:
                raise ValueError(
                    f"Gate {idx + 1} ({gate_name}): Qubit index {q} is out of bounds [0, {n_qubits - 1}]"
                )

        # Ensure no duplicate qubits in the same gate (e.g. CX control == target)
        if len(g.qubits) != len(set(g.qubits)):
            raise ValueError(
                f"Gate {idx + 1} ({gate_name}): Duplicate qubit indices {g.qubits} specified in multi-qubit gate"
            )


def load_circuit_index() -> CircuitIndexSchema:
    """Loads master circuit index or initializes it if absent."""
    ensure_storage_dir()
    if not INDEX_FILE.exists():
        empty_index = CircuitIndexSchema(version="1.0", circuits=[])
        save_circuit_index(empty_index)
        return empty_index

    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return CircuitIndexSchema.model_validate(data)
    except Exception:
        # Re-build index if corrupted
        return rebuild_circuit_index()


def save_circuit_index(index: CircuitIndexSchema) -> None:
    """Persists master circuit index atomically."""
    ensure_storage_dir()
    temp_file = CIRCUITS_DIR / "index.json.tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(index.model_dump(), f, indent=2)
    os.replace(temp_file, INDEX_FILE)


def load_circuit_by_id(circuit_id: str) -> Optional[CircuitFileSchema]:
    """Loads a validated circuit file by its ID."""
    file_path = get_circuit_file_path(circuit_id)
    if not file_path.exists():
        return None

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    circuit = CircuitFileSchema.model_validate(data)
    return circuit


def save_circuit_file(circuit: CircuitFileSchema) -> Path:
    """Saves circuit to JSON file, validates semantics, and updates master index."""
    validate_circuit_semantics(circuit)
    file_path = get_circuit_file_path(circuit.id)

    # Check if existing file is marked readonly
    if file_path.exists():
        existing = load_circuit_by_id(circuit.id)
        if existing and existing.readonly:
            raise PermissionError(f"Cannot overwrite immutable built-in circuit '{circuit.id}'")

    temp_file = file_path.with_suffix(".json.tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(circuit.model_dump(), f, indent=2)
    os.replace(temp_file, file_path)

    # Update index
    index = load_circuit_index()
    existing_entry = next((e for e in index.circuits if e.id == circuit.id), None)
    entry_data = CircuitIndexEntrySchema(
        id=circuit.id,
        name=circuit.name,
        description=circuit.description,
        category=circuit.category,
        num_qubits=circuit.num_qubits,
        num_gates=len(circuit.gates),
        synthesis=circuit.synthesis,
        readonly=circuit.readonly,
        tags=circuit.metadata.tags if circuit.metadata else [],
        file_name=file_path.name,
    )

    if existing_entry:
        index.circuits = [entry_data if e.id == circuit.id else e for e in index.circuits]
    else:
        index.circuits.append(entry_data)

    save_circuit_index(index)

    # Invalidate in-process caches
    try:
        from backend.app.core.circuit_cache import circuit_cache
        circuit_cache.invalidate_circuit(circuit.id)
    except Exception:
        pass

    return file_path


def delete_circuit_file(circuit_id: str) -> bool:
    """Deletes a custom circuit file and removes it from the master index."""
    circuit = load_circuit_by_id(circuit_id)
    if not circuit:
        return False

    if circuit.readonly:
        raise PermissionError(f"Cannot delete built-in system circuit '{circuit_id}'")

    file_path = get_circuit_file_path(circuit_id)
    if file_path.exists():
        file_path.unlink()

    index = load_circuit_index()
    index.circuits = [e for e in index.circuits if e.id != circuit_id]
    save_circuit_index(index)

    # Invalidate in-process caches
    try:
        from backend.app.core.circuit_cache import circuit_cache
        circuit_cache.invalidate_circuit(circuit_id)
    except Exception:
        pass

    return True


def rebuild_circuit_index() -> CircuitIndexSchema:
    """Scans all *.json files in circuits/ (excluding index.json) and rebuilds index."""
    ensure_storage_dir()
    entries: List[CircuitIndexEntrySchema] = []

    for file in sorted(CIRCUITS_DIR.glob("*.json")):
        if file.name == "index.json" or file.name.endswith(".tmp"):
            continue
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
            c = CircuitFileSchema.model_validate(data)
            entries.append(
                CircuitIndexEntrySchema(
                    id=c.id,
                    name=c.name,
                    description=c.description,
                    category=c.category,
                    num_qubits=c.num_qubits,
                    num_gates=len(c.gates),
                    synthesis=c.synthesis,
                    readonly=c.readonly,
                    tags=c.metadata.tags if c.metadata else [],
                    file_name=file.name,
                )
            )
        except Exception:
            continue

    index = CircuitIndexSchema(version="1.0", circuits=entries)
    save_circuit_index(index)
    return index


def qiskit_to_circuit_schema(
    qc: QuantumCircuit,
    circuit_id: str,
    name: str,
    description: str = "",
    category: str = "Benchmark",
    qubit_names: Optional[List[str]] = None,
    default_input_bits: Optional[List[int]] = None,
    synthesis: str = "clifford_t",
    readonly: bool = True,
    metadata: Optional[CircuitMetadataSchema] = None,
    logical_operations: Optional[List[CircuitLogicalOpSchema]] = None,
) -> CircuitFileSchema:
    """Accurately converts an existing Qiskit QuantumCircuit into CircuitFileSchema without gate loss."""
    n_qubits = qc.num_qubits
    gates: List[CircuitGateSchema] = []

    for step_idx, inst in enumerate(qc.data, start=1):
        gate_name = inst.operation.name.upper()
        # Find exact qubit indices
        qubit_indices = [qc.find_bit(q).index for q in inst.qubits]
        params = [float(p) for p in inst.operation.params] if inst.operation.params else None

        gates.append(
            CircuitGateSchema(
                name=gate_name,
                qubits=qubit_indices,
                params=params,
                step=step_idx,
            )
        )

    resolved_qubit_names = qubit_names or [f"Q{i}" for i in range(n_qubits)]
    resolved_inputs = default_input_bits or [0] * n_qubits

    return CircuitFileSchema(
        schema_version="1.0",
        id=circuit_id,
        name=name,
        description=description,
        category=category,
        num_qubits=n_qubits,
        qubit_names=resolved_qubit_names,
        default_input_bits=resolved_inputs,
        synthesis=synthesis,
        readonly=readonly,
        gates=gates,
        logical_operations=logical_operations,
        metadata=metadata or CircuitMetadataSchema(),
    )


def circuit_to_qiskit(circuit: CircuitFileSchema) -> QuantumCircuit:
    """Reconstructs an executable Qiskit QuantumCircuit from CircuitFileSchema."""
    # Match exact Qiskit naming convention for built-ins so logical partitions match
    cid = circuit.id.lower()
    if "1_bit_alu" in cid or "1bit_alu" in cid:
        circ_name = "1Bit_QALU_Clifford_T"
    elif "falfg" in cid:
        circ_name = "FALFG_Clifford_T"
    elif "fredkin" in cid or "cswap" in cid:
        circ_name = "Fredkin_CSWAP"
    elif "bennett" in cid or "uncompute" in cid:
        circ_name = "Uncomputed_FALFG_Adder_Subtractor"
    else:
        circ_name = circuit.name

    qc = QuantumCircuit(circuit.num_qubits, name=circ_name)

    for g in circuit.gates:
        name = g.name.upper()
        q = g.qubits
        params = g.params or []

        if name == "H":
            qc.h(q[0])
        elif name == "X":
            qc.x(q[0])
        elif name == "Y":
            qc.y(q[0])
        elif name == "Z":
            qc.z(q[0])
        elif name == "S":
            qc.s(q[0])
        elif name == "SDG":
            qc.sdg(q[0])
        elif name == "T":
            qc.t(q[0])
        elif name == "TDG":
            qc.tdg(q[0])
        elif name == "CX" and len(q) >= 2:
            qc.cx(q[0], q[1])
        elif name == "CY" and len(q) >= 2:
            qc.cy(q[0], q[1])
        elif name == "CZ" and len(q) >= 2:
            qc.cz(q[0], q[1])
        elif name == "CH" and len(q) >= 2:
            qc.ch(q[0], q[1])
        elif name == "SWAP" and len(q) >= 2:
            qc.swap(q[0], q[1])
        elif name == "ISWAP" and len(q) >= 2:
            qc.iswap(q[0], q[1])
        elif name == "CCX" and len(q) >= 3:
            qc.ccx(q[0], q[1], q[2])
        elif name == "CSWAP" and len(q) >= 3:
            qc.cswap(q[0], q[1], q[2])
        elif name == "RX" and params:
            qc.rx(params[0], q[0])
        elif name == "RY" and params:
            qc.ry(params[0], q[0])
        elif name == "RZ" and params:
            qc.rz(params[0], q[0])
        elif name == "P" and params:
            qc.p(params[0], q[0])
        elif name == "U" and len(params) >= 3:
            qc.u(params[0], params[1], params[2], q[0])
        else:
            raise ValueError(f"Unsupported gate reconstruction: '{name}' on qubits {q}")

    return qc
