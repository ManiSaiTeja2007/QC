"""Phase 3 Comprehensive Integration Test.

Verifies end-to-end frontend and backend flows:
- Dynamic circuit loading from backend
- Pre-flight authoritative validation
- Multipart file upload & real-time catalog update
- Custom circuit simulation via stored simulation endpoint
- Built-in circuit immutability (rejection of delete/overwrite)
- Custom circuit deletion & cleanup
- Legacy simulation endpoints backward compatibility
"""

import io
import json
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_phase3_full_flow():
    # 1. Verify Catalog Loading
    res = client.get("/api/circuits")
    assert res.status_code == 200
    catalog = res.json()
    assert catalog["version"] == "1.0"
    initial_count = len(catalog["circuits"])
    assert initial_count >= 4

    builtins = [c for c in catalog["circuits"] if c["readonly"]]
    assert len(builtins) >= 4
    for b in builtins:
        assert b["id"] in ["1_bit_alu_clifford_t", "falfg_5x5", "fredkin_cswap", "bennett_adder"]

    # 2. Authoritative Pre-Flight Validation with Valid JSON
    valid_payload = {
        "id": "phase3_demo_circuit",
        "name": "Phase 3 Demo Circuit",
        "description": "Integration test custom circuit",
        "category": "Custom",
        "num_qubits": 3,
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
            {"name": "CX", "qubits": [1, 2]},
        ],
    }
    val_res = client.post("/api/circuits/validate", json=valid_payload)
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["valid"] is True
    assert len(val_data["errors"]) == 0
    assert val_data["circuit_summary"]["num_gates"] == 3

    # 3. Authoritative Pre-Flight Validation with Invalid JSON (Semantic Error)
    invalid_payload = {
        "id": "phase3_invalid_circuit",
        "name": "Invalid Circuit",
        "num_qubits": 2,
        "gates": [
            {"name": "INVALID_GATE_XYZ", "qubits": [0]},
            {"name": "CX", "qubits": [0, 5]},  # qubit 5 out of bounds for 2-qubit circuit
        ],
    }
    val_invalid_res = client.post("/api/circuits/validate", json=invalid_payload)
    assert val_invalid_res.status_code == 200
    val_invalid_data = val_invalid_res.json()
    assert val_invalid_data["valid"] is False
    assert len(val_invalid_data["errors"]) >= 1
    assert any("Unsupported gate name" in e for e in val_invalid_data["errors"])

    # 4. Upload Valid Circuit via Multipart File Upload
    file_bytes = json.dumps(valid_payload).encode("utf-8")
    files = {"file": ("phase3_demo_circuit.json", io.BytesIO(file_bytes), "application/json")}
    upload_res = client.post("/api/circuits/upload-file", files=files)
    assert upload_res.status_code == 201
    assert upload_res.json()["circuit_id"] == "phase3_demo_circuit"

    # 5. Verify Catalog Immediately Contains the Uploaded Circuit Without Page Reload
    res_after = client.get("/api/circuits")
    assert res_after.status_code == 200
    catalog_after = res_after.json()
    assert len(catalog_after["circuits"]) == initial_count + 1
    custom_entry = next((c for c in catalog_after["circuits"] if c["id"] == "phase3_demo_circuit"), None)
    assert custom_entry is not None
    assert custom_entry["readonly"] is False

    # 6. Retrieve Circuit Details
    detail_res = client.get("/api/circuits/phase3_demo_circuit")
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["name"] == "Phase 3 Demo Circuit"
    assert len(detail["gates"]) == 3

    # 7. Simulate Stored Custom Circuit
    sim_res = client.post("/api/circuits/phase3_demo_circuit/simulate", json={"input_bits": [0, 0, 0]})
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert len(sim_data["steps"]) == 4  # 1 initial state + 3 gate steps
    assert sim_data["num_qubits"] == 3

    # 8. Download / Export Circuit JSON
    export_res = client.get("/api/circuits/phase3_demo_circuit/export")
    assert export_res.status_code == 200
    assert 'attachment; filename="phase3_demo_circuit.json"' in export_res.headers["content-disposition"]
    exported_obj = json.loads(export_res.content.decode("utf-8"))
    assert exported_obj["id"] == "phase3_demo_circuit"

    # 9. Verify Readonly Protection: Attempting to Delete Built-in Circuit returns 403
    del_builtin_res = client.delete("/api/circuits/1_bit_alu_clifford_t")
    assert del_builtin_res.status_code == 403

    # 10. Delete Custom Circuit
    del_res = client.delete("/api/circuits/phase3_demo_circuit")
    assert del_res.status_code == 200

    # 11. Verify Catalog Updated: Custom Circuit is Removed
    res_final = client.get("/api/circuits")
    assert res_final.status_code == 200
    catalog_final = res_final.json()
    assert len(catalog_final["circuits"]) == initial_count
    assert not any(c["id"] == "phase3_demo_circuit" for c in catalog_final["circuits"])

    # 12. Backward Compatibility: Legacy /api/simulate works seamlessly
    leg_res = client.post(
        "/api/simulate",
        json={"architecture": "1-bit-alu", "synthesis": "clifford+t", "input_bits": [0] * 7},
    )
    assert leg_res.status_code == 200
    assert len(leg_res.json()["steps"]) == 76

    # 13. Backward Compatibility: Legacy /api/simulate-custom works seamlessly
    custom_leg_res = client.post(
        "/api/simulate-custom",
        json={
            "num_qubits": 2,
            "input_bits": [0, 0],
            "gates": [{"name": "H", "qubits": [0]}],
        },
    )
    assert custom_leg_res.status_code == 200
    assert len(custom_leg_res.json()["steps"]) == 2
