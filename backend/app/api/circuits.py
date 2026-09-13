"""Circuits API Router.

Provides secure REST endpoints for circuit catalog listing, schema validation,
file/JSON uploading, stored-circuit canonical simulation, and deletion.
"""

import json
import re
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Response, Body, status
from pydantic import ValidationError

from backend.app.schemas.circuit_file import (
    CircuitFileSchema,
    CircuitIndexSchema,
    CircuitIndexEntrySchema,
    StoredCircuitSimulationRequest,
    CircuitValidationResponse,
)
from backend.app.schemas.simulation import SimulationResponse
from backend.app.core.circuit_storage import (
    load_circuit_index,
    load_circuit_by_id,
    save_circuit_file,
    delete_circuit_file,
    circuit_to_qiskit,
    sanitize_circuit_id,
    validate_circuit_semantics,
    SAFE_ID_REGEX,
    SUPPORTED_GATES,
)
from backend.app.core.canonical_ir import build_canonical_circuit_ir
from backend.app.core.cost_metrics import analyze_circuit_cost
from backend.app.core.circuit_cache import circuit_cache, compute_circuit_content_hash

router = APIRouter()

MAX_FILE_SIZE_BYTES = 1024 * 1024  # 1 MB


def slugify_name(name: str) -> str:
    """Generates a safe alphanumeric identifier from a circuit name."""
    clean = re.sub(r"[^a-zA-Z0-9_-]+", "_", name.strip().lower())
    clean = clean.strip("_")
    return clean[:40] or "custom_circuit"


@router.get("", response_model=CircuitIndexSchema)
def list_circuits(
    category: Optional[str] = Query(None, description="Filter by circuit category"),
    max_qubits: Optional[int] = Query(None, ge=1, le=12, description="Filter by max qubits"),
    synthesis: Optional[str] = Query(None, description="Filter by synthesis library"),
    search: Optional[str] = Query(None, description="Search by name, tag, or description"),
):
    """Lists indexed circuits from the storage repository with optional query filtering."""
    index = circuit_cache.get_catalog()
    if index is None:
        index = load_circuit_index()
        circuit_cache.set_catalog(index)

    filtered: List[CircuitIndexEntrySchema] = index.circuits

    if category:
        cat_lower = category.lower()
        filtered = [c for c in filtered if cat_lower in c.category.lower()]

    if max_qubits is not None:
        filtered = [c for c in filtered if c.num_qubits <= max_qubits]

    if synthesis:
        syn_lower = synthesis.lower()
        filtered = [c for c in filtered if syn_lower in c.synthesis.lower()]

    if search:
        s_lower = search.lower()
        filtered = [
            c for c in filtered
            if s_lower in c.name.lower()
            or s_lower in c.description.lower()
            or any(s_lower in tag.lower() for tag in c.tags)
        ]

    return CircuitIndexSchema(version=index.version, circuits=filtered)


@router.get("/{circuit_id}", response_model=CircuitFileSchema)
def get_circuit_details(circuit_id: str):
    """Retrieves full specification of a circuit JSON file."""
    try:
        sanitize_circuit_id(circuit_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    cached_circ = circuit_cache.get_circuit(circuit_id)
    if cached_circ is not None:
        return cached_circ[0]

    circuit = load_circuit_by_id(circuit_id)
    if not circuit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit with ID '{circuit_id}' was not found in storage.",
        )

    try:
        qc = circuit_to_qiskit(circuit)
        circuit_cache.put_circuit(circuit, qc)
    except Exception:
        pass

    return circuit


@router.post("/validate", response_model=CircuitValidationResponse)
def validate_circuit_json(circuit_data: Dict[str, Any]):
    """Pre-flight validation check for circuit JSON data without saving to disk."""
    errors: List[str] = []
    warnings: List[str] = []

    try:
        circuit = CircuitFileSchema.model_validate(circuit_data)
    except ValidationError as ve:
        for err in ve.errors():
            loc = " -> ".join(str(l) for l in err.get("loc", []))
            errors.append(f"Validation error at [{loc}]: {err.get('msg')}")
        return CircuitValidationResponse(valid=False, errors=errors, warnings=warnings)

    try:
        sanitize_circuit_id(circuit.id)
    except ValueError as e:
        errors.append(f"Identifier error: {str(e)}")

    try:
        validate_circuit_semantics(circuit)
    except ValueError as e:
        errors.append(str(e))

    if circuit.num_qubits > 9:
        warnings.append(
            f"Circuit uses {circuit.num_qubits} qubits. Simulation complexity scales exponentially (2^{circuit.num_qubits} state space)."
        )

    if errors:
        return CircuitValidationResponse(valid=False, errors=errors, warnings=warnings)

    summary = {
        "id": circuit.id,
        "name": circuit.name,
        "category": circuit.category,
        "num_qubits": circuit.num_qubits,
        "num_gates": len(circuit.gates),
        "synthesis": circuit.synthesis,
    }

    return CircuitValidationResponse(
        valid=True,
        errors=[],
        warnings=warnings,
        circuit_summary=summary,
    )


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_circuit(circuit: CircuitFileSchema):
    """Uploads and saves a validated circuit JSON file into circuits/ storage."""
    try:
        sanitize_circuit_id(circuit.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        validate_circuit_semantics(circuit)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    try:
        save_circuit_file(circuit)
        try:
            qc = circuit_to_qiskit(circuit)
            circuit_cache.put_circuit(circuit, qc)
            circuit_cache.set_catalog(load_circuit_index())
        except Exception:
            pass
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to persist circuit: {str(ex)}",
        )

    return {
        "status": "success",
        "message": f"Circuit '{circuit.name}' successfully uploaded and indexed.",
        "circuit_id": circuit.id,
    }


@router.post("/upload-file", status_code=status.HTTP_201_CREATED)
async def upload_circuit_file(file: UploadFile = File(...)):
    """Uploads a circuit JSON file via multipart form, with size and path security checks."""
    if not file.filename.endswith(".json"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a .json extension.",
        )

    content = await file.read(MAX_FILE_SIZE_BYTES + 1)
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Uploaded file exceeds maximum allowable size of {MAX_FILE_SIZE_BYTES // 1024} KB.",
        )

    try:
        raw_data = json.loads(content.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File content could not be parsed as valid JSON.",
        )

    # If ID is missing or invalid, generate from name
    if "id" not in raw_data or not raw_data["id"] or not SAFE_ID_REGEX.match(str(raw_data.get("id"))):
        name = raw_data.get("name", "circuit")
        raw_data["id"] = f"{slugify_name(name)}_{abs(hash(content)) % 10000}"

    try:
        circuit = CircuitFileSchema.model_validate(raw_data)
        validate_circuit_semantics(circuit)
    except (ValidationError, ValueError) as ex:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Circuit validation failed: {str(ex)}",
        )

    try:
        save_circuit_file(circuit)
        try:
            qc = circuit_to_qiskit(circuit)
            circuit_cache.put_circuit(circuit, qc)
            circuit_cache.set_catalog(load_circuit_index())
        except Exception:
            pass
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))

    return {
        "status": "success",
        "message": f"Circuit '{circuit.name}' uploaded successfully.",
        "circuit_id": circuit.id,
    }


@router.post("/{circuit_id}/simulate")
def simulate_stored_circuit(
    circuit_id: str,
    req: StoredCircuitSimulationRequest = Body(default_factory=StoredCircuitSimulationRequest),
):
    """Executes Canonical Quantum IR simulation for any stored circuit from the JSON repository."""
    try:
        sanitize_circuit_id(circuit_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # 1. Retrieve or parse circuit & Qiskit object with caching
    cached_circ = circuit_cache.get_circuit(circuit_id)
    if cached_circ:
        circuit, qc, content_hash = cached_circ
    else:
        circuit = load_circuit_by_id(circuit_id)
        if not circuit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Circuit '{circuit_id}' was not found in storage.",
            )
        try:
            qc = circuit_to_qiskit(circuit)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error compiling circuit to Qiskit: {str(e)}",
            )
        content_hash = compute_circuit_content_hash(circuit)
        circuit_cache.put_circuit(circuit, qc, content_hash)

    # 2. Resolve input bits (custom override or circuit default)
    n_qubits = circuit.num_qubits
    if req.input_bits is not None and len(req.input_bits) > 0:
        if len(req.input_bits) < n_qubits:
            input_bits = req.input_bits + [0] * (n_qubits - len(req.input_bits))
        else:
            input_bits = req.input_bits[:n_qubits]
    elif circuit.default_input_bits and len(circuit.default_input_bits) > 0:
        if len(circuit.default_input_bits) < n_qubits:
            input_bits = circuit.default_input_bits + [0] * (n_qubits - len(circuit.default_input_bits))
        else:
            input_bits = circuit.default_input_bits[:n_qubits]
    else:
        input_bits = [0] * n_qubits

    synthesis = (req.synthesis or circuit.synthesis or "clifford_t").lower()

    # 3. Check Simulation Result Cache (Content-Addressed)
    input_bits_tuple = tuple(input_bits)
    cached_sim = circuit_cache.get_simulation_result(
        circuit_id, content_hash, input_bits_tuple, synthesis
    )
    if cached_sim is not None:
        return cached_sim

    # 4. Cache MISS: Execute existing untouched Canonical IR Simulation Engine
    try:
        ir_payload = build_canonical_circuit_ir(qc, input_bits)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simulation error in Canonical IR engine: {str(e)}",
        )

    # 5. Execute existing untouched Cost Metrics Analyzer
    metrics = analyze_circuit_cost(qc, circuit.name)

    # 6. Populate metadata for visualizer compatibility
    ir_payload["circuit_name"] = circuit.name
    ir_payload["qubit_names"] = circuit.qubit_names or [f"Q{i}" for i in range(n_qubits)]
    ir_payload["metrics"] = metrics

    # Preserve explicit logical operations if provided in circuit schema
    if circuit.logical_operations:
        ir_payload["logical_operations"] = [op.model_dump() for op in circuit.logical_operations]
        ir_payload["total_logical_ops"] = len(circuit.logical_operations)

    # 7. Store into content-addressed Simulation Result Cache
    circuit_cache.put_simulation_result(
        circuit_id, content_hash, input_bits_tuple, synthesis, ir_payload
    )

    return ir_payload


@router.put("/{circuit_id}")
def update_circuit(circuit_id: str, circuit: CircuitFileSchema):
    """Updates an existing custom circuit in storage.

    Security constraints:
    - Path traversal validation on circuit_id.
    - 404 if circuit does not exist.
    - 403 Forbidden if existing circuit is marked readonly (immutable built-in).
    - Prevents a custom circuit from setting readonly=True.
    - Preserves circuit_id.
    - Validates semantics, qubit limits, and gate whitelist.
    """
    try:
        sanitize_circuit_id(circuit_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    existing = load_circuit_by_id(circuit_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cannot update non-existent circuit '{circuit_id}'.",
        )

    if existing.readonly:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Cannot update immutable built-in system circuit '{circuit_id}'.",
        )

    # Force circuit ID to match URL and disallow escalating to readonly
    circuit.id = circuit_id
    circuit.readonly = False

    try:
        validate_circuit_semantics(circuit)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    try:
        save_circuit_file(circuit)
        try:
            qc = circuit_to_qiskit(circuit)
            circuit_cache.put_circuit(circuit, qc)
            circuit_cache.set_catalog(load_circuit_index())
        except Exception:
            pass
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update circuit: {str(ex)}",
        )

    return {
        "status": "success",
        "message": f"Circuit '{circuit.name}' ({circuit_id}) successfully updated.",
        "circuit_id": circuit_id,
    }


@router.delete("/{circuit_id}")
def delete_circuit(circuit_id: str):
    """Deletes a custom user circuit from storage. Protected system benchmarks cannot be deleted."""
    try:
        sanitize_circuit_id(circuit_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    try:
        deleted = delete_circuit_file(circuit_id)
        circuit_cache.invalidate_circuit(circuit_id)
        circuit_cache.set_catalog(load_circuit_index())
    except PermissionError as pe:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(pe))

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circuit '{circuit_id}' does not exist.",
        )

    return {
        "status": "success",
        "message": f"Circuit '{circuit_id}' successfully removed from library.",
    }


@router.get("/{circuit_id}/export")
def export_circuit(circuit_id: str):
    """Exports raw JSON circuit file as a downloadable attachment."""
    try:
        sanitize_circuit_id(circuit_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    circuit = load_circuit_by_id(circuit_id)
    if not circuit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Circuit '{circuit_id}' not found.")

    json_content = json.dumps(circuit.model_dump(), indent=2)
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{circuit_id}.json"'},
    )
