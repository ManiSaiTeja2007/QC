"""Automated extraction and serialization of existing built-in circuits to JSON.

Guarantees 100% fidelity with original circuit definitions by extracting instructions
directly from the instantiated Qiskit QuantumCircuit objects.
"""

from pathlib import Path
from typing import List

from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t
from backend.app.modules.falfg import build_falfg_clifford_t
from backend.app.gates.basic_gates import build_fredkin_circuit
from backend.app.modules.uncomputation import build_uncomputed_adder_subtractor
from backend.app.schemas.circuit_file import CircuitMetadataSchema, CircuitLogicalOpSchema
from backend.app.core.circuit_storage import (
    qiskit_to_circuit_schema,
    save_circuit_file,
    ensure_storage_dir,
    rebuild_circuit_index,
)


def export_all_builtin_circuits() -> List[str]:
    """Extracts and saves all four built-in benchmark circuits into circuits/ JSON files."""
    ensure_storage_dir()
    saved_ids = []

    # ==============================================================================
    # 1. 1-Bit Fault-Tolerant ALU (Clifford+T)
    # ==============================================================================
    qc_alu = build_one_bit_alu_clifford_t()
    logical_ops_alu = [
        CircuitLogicalOpSchema(op_id=1, name="FALFG Full Adder/Subtractor Core", primitive_start=1, primitive_end=44, num_primitive_gates=44),
        CircuitLogicalOpSchema(op_id=2, name="FRG1 Multiplexer (Parity Select 1)", primitive_start=45, primitive_end=59, num_primitive_gates=15),
        CircuitLogicalOpSchema(op_id=3, name="FRG2 Multiplexer (Parity Select 2)", primitive_start=60, primitive_end=75, num_primitive_gates=16),
    ]
    meta_alu = CircuitMetadataSchema(
        author="IEEE TETC 2026",
        paper_reference="A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU",
        parity_preserved=True,
        quantum_cost=26,
        t_count=22,
        t_depth=9,
        tags=["ALU", "Arithmetic", "Clifford+T", "Fault-Tolerant", "Reversible", "7-Qubit"],
    )
    schema_alu = qiskit_to_circuit_schema(
        qc=qc_alu,
        circuit_id="1_bit_alu_clifford_t",
        name="1-Bit Quantum ALU",
        description="28-operation fault-tolerant reversible Arithmetic Logic Unit based on 5x5 FALFG and Clifford+T Fredkin muxes.",
        category="ALU Architectures",
        qubit_names=["Q0 A (Result)", "Q1 B (Cout)", "Q2 S0 (Cin)", "Q3 S1", "Q4 M (Mode)", "Q5 S2", "Q6 S3"],
        default_input_bits=[1, 1, 1, 0, 1, 1, 0],
        synthesis="clifford_t",
        readonly=True,
        metadata=meta_alu,
        logical_operations=logical_ops_alu,
    )
    save_circuit_file(schema_alu)
    saved_ids.append(schema_alu.id)

    # ==============================================================================
    # 2. 5x5 FALFG Gate (Clifford+T)
    # ==============================================================================
    qc_falfg = build_falfg_clifford_t()
    logical_ops_falfg = [
        CircuitLogicalOpSchema(op_id=1, name="FALFG Full Adder Core (Clifford+T)", primitive_start=1, primitive_end=14, num_primitive_gates=14),
        CircuitLogicalOpSchema(op_id=2, name="FALFG Parity Output Stage", primitive_start=15, primitive_end=24, num_primitive_gates=10),
    ]
    meta_falfg = CircuitMetadataSchema(
        author="IEEE TETC 2026",
        paper_reference="Section IV.A-B FALFG Gate",
        parity_preserved=True,
        quantum_cost=11,
        t_count=7,
        t_depth=3,
        tags=["FALFG", "Arithmetic", "Clifford+T", "Reversible", "5-Qubit"],
    )
    schema_falfg = qiskit_to_circuit_schema(
        qc=qc_falfg,
        circuit_id="falfg_5x5",
        name="5x5 FALFG Gate",
        description="Fault-Tolerant Arithmetic Logic Function Generator performing Full Adder/Subtractor and 24 operations.",
        category="Core Gates",
        qubit_names=["Q0 A (Carry/P)", "Q1 B (Sum/Q)", "Q2 C (R)", "Q3 D (S)", "Q4 E (T)"],
        default_input_bits=[1, 1, 0, 0, 0],
        synthesis="clifford_t",
        readonly=True,
        metadata=meta_falfg,
        logical_operations=logical_ops_falfg,
    )
    save_circuit_file(schema_falfg)
    saved_ids.append(schema_falfg.id)

    # ==============================================================================
    # 3. 3x3 Fredkin CSWAP Gate (Clifford+T)
    # ==============================================================================
    qc_fredkin = build_fredkin_circuit("clifford_t")
    logical_ops_fredkin = [
        CircuitLogicalOpSchema(op_id=1, name="Fredkin CSWAP Core", primitive_start=1, primitive_end=17, num_primitive_gates=17),
    ]
    meta_fredkin = CircuitMetadataSchema(
        author="IEEE TETC 2026",
        paper_reference="Figure 2(b) Fredkin Gate",
        parity_preserved=True,
        quantum_cost=5,
        t_count=7,
        t_depth=3,
        tags=["Fredkin", "CSWAP", "Clifford+T", "Reversible", "3-Qubit"],
    )
    schema_fredkin = qiskit_to_circuit_schema(
        qc=qc_fredkin,
        circuit_id="fredkin_cswap",
        name="Fredkin CSWAP Gate",
        description="3-qubit conservative reversible gate decomposed into fault-tolerant Clifford+T basis.",
        category="Core Gates",
        qubit_names=["Q0 Control A", "Q1 Target B", "Q2 Target C"],
        default_input_bits=[1, 0, 1],
        synthesis="clifford_t",
        readonly=True,
        metadata=meta_fredkin,
        logical_operations=logical_ops_fredkin,
    )
    save_circuit_file(schema_fredkin)
    saved_ids.append(schema_fredkin.id)

    # ==============================================================================
    # 4. Bennett Uncomputed Adder/Subtractor (Clifford+T)
    # ==============================================================================
    qc_bennett = build_uncomputed_adder_subtractor()
    logical_ops_bennett = [
        CircuitLogicalOpSchema(op_id=1, name="Forward Compute Stage", primitive_start=1, primitive_end=24, num_primitive_gates=24),
        CircuitLogicalOpSchema(op_id=2, name="Double Feynman (F2G) Copy Stage", primitive_start=25, primitive_end=28, num_primitive_gates=4),
        CircuitLogicalOpSchema(op_id=3, name="Reverse Uncomputation Stage", primitive_start=29, primitive_end=52, num_primitive_gates=24),
    ]
    meta_bennett = CircuitMetadataSchema(
        author="IEEE TETC 2026",
        paper_reference="Figure 9 Bennett Uncomputation",
        parity_preserved=True,
        quantum_cost=27,
        t_count=14,
        t_depth=6,
        tags=["Bennett", "Uncomputation", "Garbage-Free", "Adder", "9-Qubit"],
    )
    schema_bennett = qiskit_to_circuit_schema(
        qc=qc_bennett,
        circuit_id="bennett_adder",
        name="Bennett Uncomputed Adder",
        description="Garbage-free uncomputed Full Adder/Subtractor with dual Feynman parity copy registers.",
        category="Arithmetic",
        qubit_names=["Q0 A", "Q1 B", "Q2 Cin", "Q3 Sel", "Q4 Mode", "Q5 Cout", "Q6 Sum", "Q7 Cout'", "Q8 Sum'"],
        default_input_bits=[1, 1, 0, 0, 0, 0, 0, 0, 0],
        synthesis="clifford_t",
        readonly=True,
        metadata=meta_bennett,
        logical_operations=logical_ops_bennett,
    )
    save_circuit_file(schema_bennett)
    saved_ids.append(schema_bennett.id)

    rebuild_circuit_index()
    return saved_ids


if __name__ == "__main__":
    ids = export_all_builtin_circuits()
    print(f"Successfully exported {len(ids)} built-in circuits: {ids}")
