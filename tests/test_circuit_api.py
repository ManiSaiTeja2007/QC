"""Tests for Circuit Storage & Library REST API Endpoints (/api/circuits).

Verifies catalog indexing, pre-flight validation, JSON & multipart uploading,
security constraints (path traversal, size limits, immutability of system circuits),
stored-circuit simulation execution, and equivalence with legacy simulation.
"""

import io
import json
import pytest
import numpy as np
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.circuit_storage import (
    load_circuit_index,
    load_circuit_by_id,
    delete_circuit_file,
    CIRCUITS_DIR,
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def cleanup_custom_test_circuits():
    """Ensure any custom circuits created during testing are cleaned up afterwards."""
    yield
    # Cleanup any custom circuits created in tests
    test_ids = [
        "test_custom_bell",
        "test_multipart_ghz",
        "custom_temp_circuit",
    ]
    for cid in test_ids:
        target = CIRCUITS_DIR / f"{cid}.json"
        if target.exists():
            try:
                delete_circuit_file(cid)
            except Exception:
                pass


# ── 1. Catalog Listing & Filtering ────────────────────────────────────────────

def test_list_circuits_catalog():
    """Verify GET /api/circuits lists all built-in benchmarks."""
    res = client.get("/api/circuits")
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == "1.0"
    circuits = data["circuits"]
    assert len(circuits) >= 4

    circuit_ids = {c["id"] for c in circuits}
    expected_ids = {"1_bit_alu_clifford_t", "falfg_5x5", "fredkin_cswap", "bennett_adder"}
    assert expected_ids.issubset(circuit_ids)

    for c in circuits:
        if c["id"] in expected_ids:
            assert c["readonly"] is True
            assert c["num_qubits"] >= 1
            assert c["num_gates"] >= 1


def test_list_circuits_filtering():
    """Verify filtering by category, max_qubits, synthesis, and search query."""
    # Filter by category
    res = client.get("/api/circuits?category=Core")
    assert res.status_code == 200
    cats = [c["category"] for c in res.json()["circuits"]]
    assert all("Core" in cat for cat in cats)

    # Filter by max_qubits
    res = client.get("/api/circuits?max_qubits=5")
    assert res.status_code == 200
    qubits = [c["num_qubits"] for c in res.json()["circuits"]]
    assert all(q <= 5 for q in qubits)
    assert 9 not in qubits

    # Search query
    res = client.get("/api/circuits?search=bennett")
    assert res.status_code == 200
    results = res.json()["circuits"]
    assert len(results) == 1
    assert results[0]["id"] == "bennett_adder"


# ── 2. Circuit Detail Retrieval & Security ────────────────────────────────────

def test_get_circuit_details():
    """Verify GET /api/circuits/{id} returns full circuit specification."""
    res = client.get("/api/circuits/1_bit_alu_clifford_t")
    assert res.status_code == 200
    circuit = res.json()
    assert circuit["id"] == "1_bit_alu_clifford_t"
    assert circuit["num_qubits"] == 7
    assert len(circuit["gates"]) == 75
    assert len(circuit["logical_operations"]) == 3
    assert circuit["readonly"] is True


def test_get_circuit_details_not_found():
    """Verify non-existent circuit returns 404."""
    res = client.get("/api/circuits/non_existent_circuit_id")
    assert res.status_code == 404


def test_get_circuit_path_traversal_rejection():
    """Verify path traversal attempts are rejected with 400."""
    # Path traversal with ../
    res = client.get("/api/circuits/..%2F..%2Fetc%2Fpasswd")
    # FastAPI path routing or sanitize_circuit_id rejects
    assert res.status_code in [400, 404]

    # Special characters in ID
    res = client.get("/api/circuits/circuit;drop table")
    assert res.status_code == 400


# ── 3. Pre-Flight Validation ──────────────────────────────────────────────────

def test_validate_circuit_preflight_valid():
    """Verify valid circuit passes pre-flight validation."""
    payload = {
        "id": "test_preflight_valid",
        "name": "Test Valid Circuit",
        "description": "Validation test circuit",
        "category": "Custom",
        "num_qubits": 2,
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
        ],
    }
    res = client.post("/api/circuits/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is True
    assert len(data["errors"]) == 0
    assert data["circuit_summary"]["num_gates"] == 2


def test_validate_circuit_preflight_invalid_gate():
    """Verify unsupported gate names fail validation."""
    payload = {
        "id": "test_invalid_gate",
        "name": "Invalid Gate Circuit",
        "num_qubits": 2,
        "gates": [
            {"name": "MAGIC_QUANTUM_GATE", "qubits": [0]},
        ],
    }
    res = client.post("/api/circuits/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert any("unsupported gate" in e.lower() for e in data["errors"])


def test_validate_circuit_preflight_out_of_range_qubit():
    """Verify qubit indices outside [0, num_qubits - 1] fail validation."""
    payload = {
        "id": "test_oor_qubit",
        "name": "Out of Range Qubit",
        "num_qubits": 2,
        "gates": [
            {"name": "H", "qubits": [3]},  # index 3 >= num_qubits (2)
        ],
    }
    res = client.post("/api/circuits/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert any("out of bounds" in e for e in data["errors"])


def test_validate_circuit_preflight_duplicate_qubits():
    """Verify multi-qubit gate with duplicate control/target fails validation."""
    payload = {
        "id": "test_dup_qubits",
        "name": "Duplicate Qubits",
        "num_qubits": 2,
        "gates": [
            {"name": "CX", "qubits": [0, 0]},
        ],
    }
    res = client.post("/api/circuits/validate", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False
    assert any("duplicate qubit" in e.lower() for e in data["errors"])


# ── 4. Circuit Upload & Immutability Protection ────────────────────────────────

def test_upload_custom_circuit_json():
    """Verify uploading a custom circuit creates JSON file and updates index."""
    payload = {
        "id": "test_custom_bell",
        "name": "Bell State Generator",
        "description": "Custom EPR Bell pair circuit",
        "category": "Custom",
        "num_qubits": 2,
        "qubit_names": ["Q0 Control", "Q1 Target"],
        "default_input_bits": [0, 0],
        "synthesis": "clifford_t",
        "tags": ["Bell", "EPR", "Entanglement"],
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
        ],
    }
    res = client.post("/api/circuits/upload", json=payload)
    assert res.status_code == 201
    assert res.json()["circuit_id"] == "test_custom_bell"

    # Verify retrieval
    res_get = client.get("/api/circuits/test_custom_bell")
    assert res_get.status_code == 200
    assert res_get.json()["name"] == "Bell State Generator"
    assert res_get.json()["readonly"] is False


def test_upload_overwrite_readonly_forbidden():
    """Verify that attempting to overwrite a built-in readonly circuit returns 403."""
    payload = {
        "id": "1_bit_alu_clifford_t",
        "name": "Malicious Overwrite Attempt",
        "num_qubits": 2,
        "gates": [{"name": "H", "qubits": [0]}],
    }
    res = client.post("/api/circuits/upload", json=payload)
    assert res.status_code == 403
    detail = res.json()["detail"].lower()
    assert "immutable" in detail or "read-only" in detail or "built-in" in detail


def test_upload_oversized_gate_count():
    """Verify that circuits exceeding gate limit (1000) are rejected."""
    payload = {
        "id": "test_oversized_gates",
        "name": "Oversized Gate Count",
        "num_qubits": 2,
        "gates": [{"name": "H", "qubits": [0]}] * 1001,
    }
    res = client.post("/api/circuits/upload", json=payload)
    assert res.status_code == 422


# ── 5. Multipart File Upload ──────────────────────────────────────────────────

def test_upload_circuit_file_multipart():
    """Verify uploading a .json file via multipart form."""
    file_content = json.dumps({
        "id": "test_multipart_ghz",
        "name": "GHZ State 3-Qubit",
        "category": "Custom",
        "num_qubits": 3,
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
            {"name": "CX", "qubits": [0, 2]},
        ],
    }).encode("utf-8")

    files = {"file": ("test_multipart_ghz.json", io.BytesIO(file_content), "application/json")}
    res = client.post("/api/circuits/upload-file", files=files)
    assert res.status_code == 201
    assert res.json()["circuit_id"] == "test_multipart_ghz"

    # Verify detail retrieval
    res_get = client.get("/api/circuits/test_multipart_ghz")
    assert res_get.status_code == 200
    assert len(res_get.json()["gates"]) == 3


def test_upload_file_non_json_rejection():
    """Verify non-.json files are rejected with 400."""
    files = {"file": ("script.py", io.BytesIO(b"print('hello')"), "text/plain")}
    res = client.post("/api/circuits/upload-file", files=files)
    assert res.status_code == 400
    assert ".json" in res.json()["detail"]


def test_upload_file_corrupted_json_rejection():
    """Verify corrupted JSON files are rejected with 400."""
    files = {"file": ("corrupt.json", io.BytesIO(b"{not valid json"), "application/json")}
    res = client.post("/api/circuits/upload-file", files=files)
    assert res.status_code == 400
    assert "could not be parsed" in res.json()["detail"]


# ── 6. Circuit Deletion Protection ────────────────────────────────────────────

def test_delete_readonly_circuit_forbidden():
    """Verify attempting to delete built-in system circuits is forbidden (403)."""
    for cid in ["1_bit_alu_clifford_t", "falfg_5x5", "fredkin_cswap", "bennett_adder"]:
        res = client.delete(f"/api/circuits/{cid}")
        assert res.status_code == 403
        detail = res.json()["detail"].lower()
        assert "built-in" in detail or "read-only" in detail or "immutable" in detail


def test_delete_custom_circuit():
    """Verify custom circuit deletion removes file and index entry."""
    # First upload a temporary circuit
    payload = {
        "id": "custom_temp_circuit",
        "name": "Temporary Circuit",
        "num_qubits": 1,
        "gates": [{"name": "X", "qubits": [0]}],
    }
    res_up = client.post("/api/circuits/upload", json=payload)
    assert res_up.status_code == 201

    # Delete it
    res_del = client.delete("/api/circuits/custom_temp_circuit")
    assert res_del.status_code == 200
    assert res_del.json()["status"] == "success"

    # Verify it is no longer retrievable
    res_get = client.get("/api/circuits/custom_temp_circuit")
    assert res_get.status_code == 404


# ── 7. Stored Circuit Simulation & Equivalence ─────────────────────────────────

def test_simulate_stored_circuit_structure():
    """Verify POST /api/circuits/{id}/simulate executes Canonical IR and cost analysis."""
    res = client.post(
        "/api/circuits/1_bit_alu_clifford_t/simulate",
        json={"input_bits": [0, 0, 0, 0, 0, 0, 0]},
    )
    assert res.status_code == 200
    sim = res.json()

    assert "steps" in sim
    assert "qubit_names" in sim
    assert "circuit_name" in sim
    assert "metrics" in sim

    # 1 initial state step + 75 gate steps = 76 total steps
    assert len(sim["steps"]) == 76
    assert sim["num_qubits"] == 7
    assert sim["metrics"]["t_count"] == 28
    assert sim["metrics"]["cnot_count"] == 39
    assert sim["metrics"]["num_qubits"] == 7


def test_stored_circuit_simulation_equivalence_with_legacy():
    """Verify simulation of stored JSON circuit matches legacy /api/simulate.

    Strict verification:
    - gate count & ordering
    - cost metrics (T-count, CNOT-count, logical depth)
    - output bits and parity preservation
    - Bloch vectors per qubit across all steps
    - quantum state probability distributions across all steps
    """
    input_bits = [1, 0, 1, 0, 1, 0, 0]

    # 1. Query legacy simulation endpoint
    legacy_res = client.post(
        "/api/simulate",
        json={
            "architecture": "1-bit-alu",
            "synthesis": "clifford+t",
            "input_bits": input_bits,
        },
    )
    assert legacy_res.status_code == 200
    legacy_data = legacy_res.json()

    # 2. Query new stored-circuit simulation endpoint
    stored_res = client.post(
        "/api/circuits/1_bit_alu_clifford_t/simulate",
        json={"input_bits": input_bits},
    )
    assert stored_res.status_code == 200
    stored_data = stored_res.json()

    # Verify structural equivalence
    assert len(stored_data["steps"]) == len(legacy_data["steps"])
    assert stored_data["num_qubits"] == legacy_data["num_qubits"]
    assert stored_data["output_bits"] == legacy_data["output_bits"]
    assert stored_data["parity_preserved"] == legacy_data["parity_preserved"]

    # Verify gate sequence and state evolution equivalence
    for step_idx, (s_step, l_step) in enumerate(zip(stored_data["steps"], legacy_data["steps"])):
        assert s_step["gate"] == l_step["gate"], f"Gate mismatch at step {step_idx}"
        assert s_step["psi_ket"] == l_step["psi_ket"], f"Ket mismatch at step {step_idx}"
        assert s_step["probabilities"] == l_step["probabilities"], f"Probabilities mismatch at step {step_idx}"

        # Verify Bloch vectors numerical equivalence
        for q_idx, (s_b, l_b) in enumerate(zip(s_step["bloch_vectors"], l_step["bloch_vectors"])):
            assert np.isclose(s_b["x"], l_b["x"], atol=1e-5), f"Bloch x mismatch step {step_idx} q{q_idx}"
            assert np.isclose(s_b["y"], l_b["y"], atol=1e-5), f"Bloch y mismatch step {step_idx} q{q_idx}"
            assert np.isclose(s_b["z"], l_b["z"], atol=1e-5), f"Bloch z mismatch step {step_idx} q{q_idx}"
            assert np.isclose(s_b["purity"], l_b["purity"], atol=1e-5), f"Bloch purity mismatch step {step_idx} q{q_idx}"

    # Verify cost metrics exact equivalence
    s_metrics = stored_data["metrics"]
    l_metrics = legacy_data["metrics"]
    assert s_metrics["t_count"] == l_metrics["t_count"]
    assert s_metrics["cnot_count"] == l_metrics["cnot_count"]
    assert s_metrics["circuit_depth"] == l_metrics["circuit_depth"]
    assert s_metrics["quantum_cost"] == l_metrics["quantum_cost"]
    assert s_metrics["total_gates"] == l_metrics["total_gates"]
    assert s_metrics["t_depth"] == l_metrics["t_depth"]


# ── 8. Circuit JSON Export ────────────────────────────────────────────────────

def test_export_circuit_download():
    """Verify GET /api/circuits/{id}/export returns downloadable JSON."""
    res = client.get("/api/circuits/fredkin_cswap/export")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/json"
    assert 'attachment; filename="fredkin_cswap.json"' in res.headers["content-disposition"]

    exported = json.loads(res.content.decode("utf-8"))
    assert exported["id"] == "fredkin_cswap"
    assert exported["num_qubits"] == 3
    assert len(exported["gates"]) == 17
