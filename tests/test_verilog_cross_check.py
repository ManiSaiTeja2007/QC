"""Comprehensive Differential Cross-Checking Test Suite with Fault Injection."""

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.verification_contract import (
    VerificationContract,
    VerificationMode,
    PortMapping,
    PortDirection,
    AncillaContract,
    ExecutionEngineStatus,
)
from backend.app.schemas.simulation import CustomCircuitRequest, CustomGateModel
from backend.app.simulation.quantum_verifier import build_circuit_from_gates
from backend.app.simulation.equivalence_metrics import run_full_verification
from backend.app.core.verilog_generator import get_verilog_template


client = TestClient(app)


def test_ideal_toffoli_and_gate_equivalence():
    """Verify 100% equivalence between Quantum Toffoli and Classical Verilog AND gate."""
    template = get_verilog_template("and_gate")
    assert template is not None

    contract = VerificationContract(
        verilog_code=template["verilog_code"],
        top_module_name=template["top_module"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        mode=VerificationMode.STATEVECTOR_IDEAL,
    )

    # Build 3-qubit quantum Toffoli circuit: CCX(0, 1, 2)
    qc = build_circuit_from_gates(
        num_qubits=3,
        gates_data=[{"name": "CCX", "qubits": [0, 1, 2]}],
        circuit_name="Quantum Toffoli AND Gate",
    )

    res = run_full_verification(contract, qc)

    assert res.status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert res.total_states_tested == 4
    assert res.total_errors == 0
    assert res.error_rate == 0.0
    assert res.state_fidelity_avg == 1.0
    assert res.box_plot.min == 1.0
    assert res.box_plot.median == 1.0
    assert res.box_plot.max == 1.0
    assert res.ancilla_clean_all is True

    # Check truth table
    # 00 -> 0, 01 -> 0, 10 -> 0, 11 -> 1
    for row in res.truth_table:
        assert row.match is True
        assert row.state_fidelity == 1.0


def test_ideal_full_adder_equivalence():
    """Verify 100% equivalence between Quantum Full Adder and Verilog Full Adder."""
    template = get_verilog_template("full_adder")
    assert template is not None

    contract = VerificationContract(
        verilog_code=template["verilog_code"],
        top_module_name=template["top_module"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        mode=VerificationMode.STATEVECTOR_IDEAL,
    )

    # Build 5-qubit quantum Full Adder circuit:
    # Q0: A, Q1: B, Q2: Cin, Q3: Sum, Q4: Cout
    # Sum = A ^ B ^ Cin -> CX(0, 3), CX(1, 3), CX(2, 3)
    # Cout = (A & B) | (Cin & (A ^ B))
    # Using Toffoli gates:
    # CCX(0, 1, 4) (generates A & B on Q4)
    # CX(0, 1) (Q1 becomes A ^ B)
    # CCX(1, 2, 4) (adds Cin & (A ^ B) into Q4 via XOR since disjoint)
    # CX(0, 1) (uncomputes Q1 back to B)
    gates = [
        # Compute Sum on Q3
        {"name": "CX", "qubits": [0, 3]},
        {"name": "CX", "qubits": [1, 3]},
        {"name": "CX", "qubits": [2, 3]},
        # Compute Cout on Q4
        {"name": "CCX", "qubits": [0, 1, 4]},
        {"name": "CX", "qubits": [0, 1]},
        {"name": "CCX", "qubits": [1, 2, 4]},
        {"name": "CX", "qubits": [0, 1]},
    ]
    qc = build_circuit_from_gates(5, gates, "Quantum Full Adder")

    res = run_full_verification(contract, qc)

    assert res.status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert res.total_states_tested == 8
    assert res.total_errors == 0
    assert res.error_rate == 0.0
    assert res.state_fidelity_avg == 1.0


def test_fault_injection_inverted_output():
    """Fault 1: Inject an unintended NOT gate on output qubit Q2.
    
    Verifies that comparator flags nonzero error rate, degraded fidelity,
    and highlights the exact error in heatmap and truth table.
    """
    template = get_verilog_template("and_gate")
    assert template is not None

    contract = VerificationContract(
        verilog_code=template["verilog_code"],
        top_module_name=template["top_module"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        mode=VerificationMode.STATEVECTOR_IDEAL,
    )

    # Faulty circuit: Toffoli followed by inversion on target Q2 (acting like NAND)
    qc_faulty = build_circuit_from_gates(
        num_qubits=3,
        gates_data=[
            {"name": "CCX", "qubits": [0, 1, 2]},
            {"name": "X", "qubits": [2]},  # Injected bug!
        ],
        circuit_name="Faulty Inverted AND Gate",
    )

    res = run_full_verification(contract, qc_faulty)

    assert res.status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert res.total_states_tested == 4
    # All 4 states will mismatch because output is inverted:
    # 00 -> expected 0, got 1
    # 01 -> expected 0, got 1
    # 10 -> expected 0, got 1
    # 11 -> expected 1, got 0
    assert res.total_errors == 4
    assert res.error_rate == 1.0
    assert res.state_fidelity_avg == 0.0

    # Verify heatmap matrix reflects mismatches (1s)
    assert len(res.heatmap.matrix) == 4
    for row in res.heatmap.matrix:
        assert row == [1]


def test_fault_injection_missing_gate():
    """Fault 2: Use CX instead of CCX (missing control dependency)."""
    template = get_verilog_template("and_gate")
    assert template is not None

    contract = VerificationContract(
        verilog_code=template["verilog_code"],
        top_module_name=template["top_module"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        mode=VerificationMode.STATEVECTOR_IDEAL,
    )

    # Missing gate: CX(0, 2) instead of CCX(0, 1, 2)
    qc_faulty = build_circuit_from_gates(
        num_qubits=3,
        gates_data=[{"name": "CX", "qubits": [0, 2]}],
        circuit_name="Missing Control AND Gate",
    )

    res = run_full_verification(contract, qc_faulty)

    assert res.status == ExecutionEngineStatus.IVERILOG_SUCCESS
    # State 10 (a=1, b=0): CX produces output 1, but Verilog AND requires 0!
    assert res.total_errors > 0
    assert res.error_rate > 0.0


def test_fault_injection_unrestored_ancilla():
    """Fault 3: Ancilla qubit is dirtied and not uncomputed back to |0>."""
    template = get_verilog_template("and_gate")
    assert template is not None

    # Declare Q3 as an ancilla expected to be clean (0)
    contract = VerificationContract(
        verilog_code=template["verilog_code"],
        top_module_name=template["top_module"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        ancillas=[AncillaContract(qubit_index=3, expected_clean_state=0, name="dirty_anc")],
        mode=VerificationMode.STATEVECTOR_IDEAL,
    )

    # 4-qubit circuit with dirty ancilla Q3
    qc_dirty_anc = build_circuit_from_gates(
        num_qubits=4,
        gates_data=[
            {"name": "CCX", "qubits": [0, 1, 2]},
            {"name": "X", "qubits": [3]},  # Dirties ancilla Q3 without uncomputing!
        ],
        circuit_name="Dirty Ancilla Circuit",
    )

    res = run_full_verification(contract, qc_dirty_anc)

    assert res.status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert res.ancilla_clean_all is False
    # Even though target output Q2 matched functionally, fidelity is 0 due to dirty ancilla
    assert res.state_fidelity_avg == 0.0


def test_shot_measurement_mode():
    """Verify probabilistic shot measurement mode returns counts and valid metrics."""
    template = get_verilog_template("and_gate")
    assert template is not None

    contract = VerificationContract(
        verilog_code=template["verilog_code"],
        top_module_name=template["top_module"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        mode=VerificationMode.SHOT_MEASUREMENT,
        num_shots=200,
    )

    qc = build_circuit_from_gates(
        num_qubits=3,
        gates_data=[{"name": "CCX", "qubits": [0, 1, 2]}],
        circuit_name="Toffoli Shots",
    )

    res = run_full_verification(contract, qc)

    assert res.status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert res.total_states_tested == 4
    assert res.total_errors == 0
    assert res.error_rate == 0.0
    assert res.state_fidelity_avg >= 0.99


# API Endpoints Integration Tests via TestClient
def test_api_verilog_templates():
    resp = client.get("/api/verilog/templates")
    assert resp.status_code == 200
    templates = resp.json()
    assert len(templates) >= 4
    ids = [t["id"] for t in templates]
    assert "and_gate" in ids
    assert "full_adder" in ids


def test_api_verilog_simulate_standalone():
    template = get_verilog_template("and_gate")
    assert template is not None

    payload = {
        "verilog_code": template["verilog_code"],
        "top_module_name": template["top_module"],
        "input_ports": [p.model_dump() for p in template["input_ports"]],
        "output_ports": [p.model_dump() for p in template["output_ports"]],
    }

    resp = client.post("/api/verilog/simulate-verilog", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "iverilog_success"
    assert data["total_states"] == 4
    assert len(data["table"]) == 4


def test_api_verify_custom_circuit():
    template = get_verilog_template("and_gate")
    assert template is not None

    verify_payload = {
        "contract": {
            "verilog_code": template["verilog_code"],
            "top_module_name": template["top_module"],
            "input_ports": [p.model_dump() for p in template["input_ports"]],
            "output_ports": [p.model_dump() for p in template["output_ports"]],
            "ancillas": [],
            "mode": "statevector_ideal",
            "num_shots": 1024,
        },
        "custom_circuit": {
            "num_qubits": 3,
            "input_bits": [0, 0, 0],
            "gates": [
                {"name": "CCX", "qubits": [0, 1, 2]}
            ],
            "circuit_name": "API Verified Toffoli",
        },
    }

    resp = client.post("/api/verilog/verify", json=verify_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "iverilog_success"
    assert data["error_rate"] == 0.0
    assert data["total_states_tested"] == 4
    assert data["state_fidelity_avg"] == 1.0
    assert len(data["truth_table"]) == 4
    assert "box_plot" in data
    assert "heatmap" in data


def test_api_export_dual():
    template = get_verilog_template("and_gate")
    assert template is not None

    export_payload = {
        "custom_circuit": {
            "num_qubits": 3,
            "input_bits": [0, 0, 0],
            "gates": [
                {"name": "CCX", "qubits": [0, 1, 2]}
            ],
            "circuit_name": "Dual Export Toffoli",
        },
        "verilog_code": template["verilog_code"],
        "top_module_name": template["top_module"],
    }

    resp = client.post("/api/verilog/export-dual", json=export_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "qasm" in data
    assert "OPENQASM" in data["qasm"]
    assert "verilog_code" in data
    assert "module and_gate" in data["verilog_code"]
