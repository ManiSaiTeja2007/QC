"""Comprehensive tests for Phase 4: Custom-Circuit Lifecycle.

Verifies:
1. Create custom circuit via POST /api/circuits/upload.
2. Update custom circuit via PUT /api/circuits/{circuit_id}.
3. Delete custom circuit via DELETE /api/circuits/{circuit_id}.
4. Attempt update of readonly built-in rejected with 403 Forbidden.
5. Attempt delete of readonly built-in rejected with 403 Forbidden.
6. Open built-in -> modify -> Save as New leaves original completely untouched.
7. Open custom -> modify -> Update Existing updates in-place preserving circuit ID.
8. Save as New creates separate custom circuit with unique ID.
9. Gate sequence integrity (order, gate types, targets, controls) preserved end-to-end.
10. Gate parameters (angles, phases) preserved end-to-end.
11. Qubit count integrity preserved end-to-end.
12. Input bits configuration preserved end-to-end.
13. PUT validation rejects malformed schema, out-of-bounds qubits, and path traversal.
14. Stored custom circuit execution matches simulated state.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.core.circuit_storage import (
    delete_circuit_file,
    CIRCUITS_DIR,
)

client = TestClient(app)

# Test circuit IDs used across tests for cleanup
LIFECYCLE_TEST_IDS = [
    "lifecycle_custom_test_1",
    "lifecycle_custom_test_2",
    "lifecycle_save_as_new",
    "lifecycle_param_test",
]


@pytest.fixture(autouse=True)
def cleanup_lifecycle_circuits():
    """Ensure custom test circuits are wiped after each test run."""
    yield
    for cid in LIFECYCLE_TEST_IDS:
        target = CIRCUITS_DIR / f"{cid}.json"
        if target.exists():
            try:
                delete_circuit_file(cid)
            except Exception:
                pass


def sample_custom_circuit(circuit_id: str = "lifecycle_custom_test_1", num_qubits: int = 3):
    if num_qubits == 1:
        gates = [{"name": "H", "qubits": [0]}]
    elif num_qubits == 2:
        gates = [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
        ]
    else:
        gates = [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
            {"name": "T", "qubits": [2]},
        ]

    return {
        "schema_version": "1.0",
        "id": circuit_id,
        "name": "Lifecycle Test Circuit",
        "description": "A circuit designed to test the full lifecycle",
        "category": "Custom",
        "readonly": False,
        "num_qubits": num_qubits,
        "qubit_names": [f"q{i}" for i in range(num_qubits)],
        "default_input_bits": [0, 1, 0][:num_qubits],
        "metadata": {
            "author": "Lifecycle Tester",
            "tags": ["test", "lifecycle"],
        },
        "gates": gates,
    }


# ── 1. Create Custom Circuit (POST /api/circuits/upload) ───────────────────────

def test_1_create_custom_circuit():
    """Verify custom circuit creation via POST /api/circuits/upload."""
    payload = sample_custom_circuit("lifecycle_custom_test_1", 3)
    res = client.post("/api/circuits/upload", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["circuit_id"] == "lifecycle_custom_test_1"

    # Check that it exists in GET /api/circuits/{id}
    detail_res = client.get("/api/circuits/lifecycle_custom_test_1")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["id"] == "lifecycle_custom_test_1"
    assert detail["num_qubits"] == 3
    assert len(detail["gates"]) == 3
    assert detail["readonly"] is False


# ── 2. Update Custom Circuit (PUT /api/circuits/{id}) ──────────────────────────

def test_2_update_custom_circuit():
    """Verify custom circuit update via PUT /api/circuits/{circuit_id}."""
    # Create initial circuit
    initial = sample_custom_circuit("lifecycle_custom_test_1", 3)
    c_res = client.post("/api/circuits/upload", json=initial)
    assert c_res.status_code == 201

    # Modify gates, description, and default_input_bits
    updated_payload = sample_custom_circuit("lifecycle_custom_test_1", 3)
    updated_payload["description"] = "Updated description for lifecycle"
    updated_payload["gates"].append({"name": "X", "qubits": [0]})
    updated_payload["default_input_bits"] = [1, 1, 0]

    put_res = client.put("/api/circuits/lifecycle_custom_test_1", json=updated_payload)
    assert put_res.status_code == 200
    put_data = put_res.json()
    assert put_data["circuit_id"] == "lifecycle_custom_test_1"

    # Verify updated content
    detail = client.get("/api/circuits/lifecycle_custom_test_1").json()
    assert detail["description"] == "Updated description for lifecycle"
    assert len(detail["gates"]) == 4
    assert detail["gates"][-1]["name"] == "X"
    assert detail["gates"][-1]["qubits"] == [0]
    assert detail["default_input_bits"] == [1, 1, 0]


# ── 3. Delete Custom Circuit (DELETE /api/circuits/{id}) ───────────────────────

def test_3_delete_custom_circuit():
    """Verify custom circuit deletion via DELETE /api/circuits/{circuit_id}."""
    payload = sample_custom_circuit("lifecycle_custom_test_1", 3)
    client.post("/api/circuits/upload", json=payload)

    # Delete circuit
    del_res = client.delete("/api/circuits/lifecycle_custom_test_1")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Confirm it no longer exists
    get_res = client.get("/api/circuits/lifecycle_custom_test_1")
    assert get_res.status_code == 404

    # Confirm index updated
    catalog = client.get("/api/circuits").json()
    cat_ids = [c["id"] for c in catalog["circuits"]]
    assert "lifecycle_custom_test_1" not in cat_ids


# ── 4. Immutability: Attempt Update Readonly Built-in Rejected (403) ────────────

def test_4_attempt_update_readonly_builtin_rejected():
    """Verify PUT to a built-in system circuit returns 403 Forbidden."""
    builtin_id = "1_bit_alu_clifford_t"
    payload = {
        "schema_version": "1.0",
        "id": builtin_id,
        "name": "Tampered ALU",
        "description": "Attempt to overwrite",
        "category": "Arithmetic",
        "readonly": True,
        "num_qubits": 6,
        "gates": [{"name": "X", "qubits": [0]}],
    }
    res = client.put(f"/api/circuits/{builtin_id}", json=payload)
    assert res.status_code == 403
    assert "built-in" in str(res.json()["detail"]).lower() or "immutable" in str(res.json()["detail"]).lower()

    # Verify built-in remains unmodified
    cur = client.get(f"/api/circuits/{builtin_id}").json()
    assert cur["name"] != "Tampered ALU"
    assert cur["readonly"] is True


# ── 5. Immutability: Attempt Delete Readonly Built-in Rejected (403) ────────────

def test_5_attempt_delete_readonly_builtin_rejected():
    """Verify DELETE on a built-in system circuit returns 403 Forbidden."""
    builtin_id = "fredkin_cswap"
    res = client.delete(f"/api/circuits/{builtin_id}")
    assert res.status_code == 403
    assert "built-in" in str(res.json()["detail"]).lower() or "immutable" in str(res.json()["detail"]).lower()

    # Confirm still present in catalog
    detail = client.get(f"/api/circuits/{builtin_id}")
    assert detail.status_code == 200


# ── 6. Open Built-in -> Modify -> Save as New (Original Untouched) ─────────────

def test_6_open_builtin_modify_save_as_new():
    """Verify opening a built-in, modifying it, and saving as new leaves original untouched."""
    # Fetch built-in
    orig = client.get("/api/circuits/bennett_adder").json()
    orig_gate_count = len(orig["gates"])

    # Create new circuit derived from it
    derived = dict(orig)
    derived["id"] = "lifecycle_save_as_new"
    derived["name"] = "Custom Bennett Variant"
    derived["readonly"] = False
    derived["gates"] = list(orig["gates"]) + [{"name": "H", "qubits": [0]}]

    post_res = client.post("/api/circuits/upload", json=derived)
    assert post_res.status_code == 201

    # Verify original is still intact
    refetched_orig = client.get("/api/circuits/bennett_adder").json()
    assert len(refetched_orig["gates"]) == orig_gate_count
    assert refetched_orig["readonly"] is True

    # Verify new circuit exists with modifications
    new_circuit = client.get("/api/circuits/lifecycle_save_as_new").json()
    assert len(new_circuit["gates"]) == orig_gate_count + 1
    assert new_circuit["name"] == "Custom Bennett Variant"
    assert new_circuit["readonly"] is False


# ── 7. Open Custom -> Modify -> Update Existing ────────────────────────────────

def test_7_open_custom_modify_update_existing():
    """Verify updating a custom circuit preserves its ID and updates content in-place."""
    initial = sample_custom_circuit("lifecycle_custom_test_1", 2)
    c_res = client.post("/api/circuits/upload", json=initial)
    assert c_res.status_code == 201

    # Edit and PUT with same ID
    modified = sample_custom_circuit("lifecycle_custom_test_1", 2)
    modified["name"] = "Renamed Custom Circuit"
    modified["gates"] = [
        {"name": "X", "qubits": [0]},
        {"name": "Y", "qubits": [1]},
    ]

    put_res = client.put("/api/circuits/lifecycle_custom_test_1", json=modified)
    assert put_res.status_code == 200

    fetched = client.get("/api/circuits/lifecycle_custom_test_1").json()
    assert fetched["id"] == "lifecycle_custom_test_1"
    assert fetched["name"] == "Renamed Custom Circuit"
    assert len(fetched["gates"]) == 2
    assert fetched["gates"][0]["name"] == "X"
    assert fetched["gates"][1]["name"] == "Y"


# ── 8. Save as New Creates Separate Circuit With Unique ID ─────────────────────

def test_8_save_as_new_creates_separate_circuit():
    """Verify Save as New generates a distinct circuit without touching predecessor."""
    circ1 = sample_custom_circuit("lifecycle_custom_test_1", 3)
    client.post("/api/circuits/upload", json=circ1)

    circ2 = sample_custom_circuit("lifecycle_custom_test_2", 4)
    circ2["name"] = "Second Independent Circuit"
    client.post("/api/circuits/upload", json=circ2)

    # Verify both exist independently
    c1 = client.get("/api/circuits/lifecycle_custom_test_1").json()
    c2 = client.get("/api/circuits/lifecycle_custom_test_2").json()
    assert c1["id"] == "lifecycle_custom_test_1"
    assert c1["num_qubits"] == 3
    assert c2["id"] == "lifecycle_custom_test_2"
    assert c2["num_qubits"] == 4


# ── 9. Gate Sequence Integrity (Order, Types, Controls, Targets) ───────────────

def test_9_gate_sequence_integrity():
    """Verify complex gate sequence with control/target pairs survives save & retrieve."""
    gates = [
        {"name": "H", "qubits": [0]},
        {"name": "X", "qubits": [1]},
        {"name": "CX", "qubits": [0, 1]},
        {"name": "CCX", "qubits": [0, 1, 2]},
        {"name": "CSWAP", "qubits": [0, 1, 2]},
        {"name": "T", "qubits": [0]},
        {"name": "TDG", "qubits": [1]},
        {"name": "S", "qubits": [2]},
        {"name": "SDG", "qubits": [0]},
        {"name": "Z", "qubits": [1]},
    ]
    payload = {
        "schema_version": "1.0",
        "id": "lifecycle_custom_test_1",
        "name": "Sequence Integrity Test",
        "description": "Multi-gate sequence",
        "category": "Custom",
        "readonly": False,
        "num_qubits": 3,
        "gates": gates,
    }
    client.post("/api/circuits/upload", json=payload)

    fetched = client.get("/api/circuits/lifecycle_custom_test_1").json()
    assert len(fetched["gates"]) == len(gates)
    for i, expected_gate in enumerate(gates):
        assert fetched["gates"][i]["name"] == expected_gate["name"]
        assert fetched["gates"][i]["qubits"] == expected_gate["qubits"]


# ── 10. Gate Parameters Preserved (Angles, Phases) ────────────────────────────

def test_10_gate_parameters_preserved():
    """Verify parameterized gates (rz, rx, ry, p) preserve parameters through storage."""
    gates = [
        {"name": "RX", "qubits": [0], "params": [1.5707963267948966]},
        {"name": "RY", "qubits": [1], "params": [0.7853981633974483]},
        {"name": "RZ", "qubits": [2], "params": [3.141592653589793]},
        {"name": "P", "qubits": [0], "params": [0.5]},
    ]
    payload = {
        "schema_version": "1.0",
        "id": "lifecycle_param_test",
        "name": "Parameter Preservation Test",
        "description": "Checking angle floats",
        "category": "Custom",
        "readonly": False,
        "num_qubits": 3,
        "gates": gates,
    }
    client.post("/api/circuits/upload", json=payload)

    fetched = client.get("/api/circuits/lifecycle_param_test").json()
    for i, g in enumerate(gates):
        stored_params = fetched["gates"][i]["params"]
        assert len(stored_params) == len(g["params"])
        assert pytest.approx(stored_params[0], rel=1e-6) == g["params"][0]


# ── 11. Qubit Count Preserved End-to-End ──────────────────────────────────────

def test_11_qubit_count_preserved():
    """Verify qubit count across different widths (1 to 8) is preserved."""
    for q_count in [1, 2, 5, 8]:
        cid = "lifecycle_custom_test_1"
        payload = {
            "schema_version": "1.0",
            "id": cid,
            "name": f"Qubit Width {q_count}",
            "description": "Width test",
            "category": "Custom",
            "readonly": False,
            "num_qubits": q_count,
            "gates": [{"name": "H", "qubits": [0]}],
        }
        # Delete prior if any
        client.delete(f"/api/circuits/{cid}")
        res = client.post("/api/circuits/upload", json=payload)
        assert res.status_code == 201

        fetched = client.get(f"/api/circuits/{cid}").json()
        assert fetched["num_qubits"] == q_count


# ── 12. Input Bits Preserved End-to-End ───────────────────────────────────────

def test_12_input_bits_preserved():
    """Verify default_input_bits array is preserved through creation, update, and fetch."""
    input_bits = [1, 0, 1, 1, 0]
    payload = {
        "schema_version": "1.0",
        "id": "lifecycle_custom_test_1",
        "name": "Input Bits Test",
        "description": "Initial state vector bits",
        "category": "Custom",
        "readonly": False,
        "num_qubits": 5,
        "default_input_bits": input_bits,
        "gates": [{"name": "X", "qubits": [0]}],
    }
    client.post("/api/circuits/upload", json=payload)

    fetched = client.get("/api/circuits/lifecycle_custom_test_1").json()
    assert fetched["default_input_bits"] == input_bits

    # Update input bits via PUT
    payload["default_input_bits"] = [0, 1, 0, 0, 1]
    client.put("/api/circuits/lifecycle_custom_test_1", json=payload)

    refetched = client.get("/api/circuits/lifecycle_custom_test_1").json()
    assert refetched["default_input_bits"] == [0, 1, 0, 0, 1]


# ── 13. Backend Validation Rejects Invalid Circuits on PUT ────────────────────

def test_13_put_validation_rejects_invalid():
    """Verify PUT rejects malformed circuits, out-of-bounds qubits, and path traversal."""
    # First create a valid circuit
    client.post("/api/circuits/upload", json=sample_custom_circuit("lifecycle_custom_test_1", 3))

    # Path traversal attempt
    trav_res = client.put("/api/circuits/..%2F..%2Fetc%2Fpasswd", json=sample_custom_circuit("x", 2))
    assert trav_res.status_code in (400, 404)

    # Out of bounds qubit
    oob_payload = sample_custom_circuit("lifecycle_custom_test_1", 2)
    oob_payload["gates"].append({"name": "H", "qubits": [5]})  # qubit 5 >= num_qubits 2
    oob_res = client.put("/api/circuits/lifecycle_custom_test_1", json=oob_payload)
    assert oob_res.status_code == 422
    assert "out of bounds" in str(oob_res.json()["detail"]).lower()

    # Unknown gate type
    bad_gate_payload = sample_custom_circuit("lifecycle_custom_test_1", 3)
    bad_gate_payload["gates"].append({"name": "nonexistent_quantum_magic", "qubits": [0]})
    bad_res = client.put("/api/circuits/lifecycle_custom_test_1", json=bad_gate_payload)
    assert bad_res.status_code == 422
    assert "unsupported" in str(bad_res.json()["detail"]).lower()


# ── 14. Stored Custom Circuit Execution Matches Simulation ────────────────────

def test_14_stored_custom_circuit_simulation():
    """Verify a custom circuit saved to storage can be simulated via /api/circuits/{id}/simulate."""
    # Bell state on 2 qubits
    bell_circuit = {
        "schema_version": "1.0",
        "id": "lifecycle_custom_test_1",
        "name": "Bell State Pair",
        "description": "Entangled |Phi+> state",
        "category": "Custom",
        "readonly": False,
        "num_qubits": 2,
        "default_input_bits": [0, 0],
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
        ],
    }
    client.post("/api/circuits/upload", json=bell_circuit)

    sim_res = client.post("/api/circuits/lifecycle_custom_test_1/simulate", json={"input_bits": [0, 0]})
    assert sim_res.status_code == 200
    sim_data = sim_res.json()

    assert sim_data["circuit_name"] == "Bell State Pair"
    assert len(sim_data["steps"]) == 3  # step 0 initial, step 1 H, step 2 CX

    # Check final state: |00> with ~0.5 prob and |11> with ~0.5 prob
    final_step = sim_data["steps"][-1]
    probs = final_step["probabilities"]
    assert pytest.approx(probs.get("00", 0.0), abs=0.01) == 0.5   # |00>
    assert pytest.approx(probs.get("11", 0.0), abs=0.01) == 0.5   # |11>
