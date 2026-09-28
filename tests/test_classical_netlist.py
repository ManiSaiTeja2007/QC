"""Tests for Canonical Classical Netlist, Loop Detection, and Golden Reference Verification."""

import pytest
from qiskit import QuantumCircuit

from backend.app.schemas.classical_netlist import (
    ClassicalNetlist,
    ClassicalGateInstance,
    ClassicalGateType,
    PortPin,
)
from backend.app.schemas.verification_contract import (
    VerificationContract,
    PortMapping,
    PortDirection,
    ExecutionEngineStatus,
    ReferenceSourceType,
)
from backend.app.simulation.equivalence_metrics import run_full_verification


def test_n_input_gate_and_truth_table():
    """Test 3-input NAND gate (A and B and C -> Y) in ClassicalNetlist."""
    netlist = ClassicalNetlist(
        name="nand3_test",
        inputs=[
            PortPin(id="p_a", name="a", bit_width=1, net_ids=["n_a"]),
            PortPin(id="p_b", name="b", bit_width=1, net_ids=["n_b"]),
            PortPin(id="p_c", name="c", bit_width=1, net_ids=["n_c"]),
        ],
        outputs=[
            PortPin(id="p_y", name="y", bit_width=1, net_ids=["n_y"]),
        ],
        gates=[
            ClassicalGateInstance(
                id="G_NAND1",
                type=ClassicalGateType.NAND,
                fan_in=3,
                inputs=["n_a", "n_b", "n_c"],
                output="n_y",
            )
        ],
    )

    is_valid, errs = netlist.validate_netlist()
    assert is_valid, f"Expected valid netlist, got errors: {errs}"

    # Verify truth table across all 8 states
    for a in (0, 1):
        for b in (0, 1):
            for c in (0, 1):
                out = netlist.evaluate_state({"a": a, "b": b, "c": c})
                expected_y = 0 if (a == 1 and b == 1 and c == 1) else 1
                assert out["y"] == expected_y, f"Failed for a={a}, b={b}, c={c}"

    # Verify generated Verilog code
    verilog = netlist.generate_verilog()
    assert "module nand3_test" in verilog
    assert "assign n_y = ~(n_a & n_b & n_c);" in verilog


def test_combinational_loop_detection():
    """Test combinational loop detection with an intentional cycle (G1 -> G2 -> G1)."""
    netlist = ClassicalNetlist(
        name="loop_test",
        inputs=[PortPin(id="p_in", name="in", bit_width=1, net_ids=["n_in"])],
        outputs=[PortPin(id="p_out", name="out", bit_width=1, net_ids=["n_out"])],
        gates=[
            ClassicalGateInstance(
                id="G1",
                type=ClassicalGateType.AND,
                fan_in=2,
                inputs=["n_in", "n_feed"],
                output="n_out",
            ),
            ClassicalGateInstance(
                id="G2",
                type=ClassicalGateType.BUFFER,
                fan_in=1,
                inputs=["n_out"],
                output="n_feed",
            ),
        ],
    )

    is_valid, errs = netlist.validate_netlist()
    assert not is_valid, "Expected netlist validation to fail due to combinational loop"
    assert any("Combinational loop detected" in err for err in errs), f"Expected loop error, got: {errs}"
    assert any("G1" in err and "G2" in err for err in errs)


def test_full_adder_netlist_verilog_and_quantum_verification():
    """Vertical Slice Test:
    ClassicalNetlist (Full Adder) -> generate Verilog -> simulate with Icarus
    -> quantum full adder (Qiskit) -> run full differential verification.
    """
    fa_netlist = ClassicalNetlist(
        name="full_adder_classical",
        inputs=[
            PortPin(id="p_a", name="a", bit_width=1, net_ids=["n_a"]),
            PortPin(id="p_b", name="b", bit_width=1, net_ids=["n_b"]),
            PortPin(id="p_cin", name="cin", bit_width=1, net_ids=["n_cin"]),
        ],
        outputs=[
            PortPin(id="p_sum", name="sum", bit_width=1, net_ids=["n_sum"]),
            PortPin(id="p_cout", name="cout", bit_width=1, net_ids=["n_cout"]),
        ],
        gates=[
            ClassicalGateInstance(
                id="G_XOR1",
                type=ClassicalGateType.XOR,
                fan_in=2,
                inputs=["n_a", "n_b"],
                output="n_xor1",
            ),
            ClassicalGateInstance(
                id="G_XOR2",
                type=ClassicalGateType.XOR,
                fan_in=2,
                inputs=["n_xor1", "n_cin"],
                output="n_sum",
            ),
            ClassicalGateInstance(
                id="G_AND1",
                type=ClassicalGateType.AND,
                fan_in=2,
                inputs=["n_a", "n_b"],
                output="n_and1",
            ),
            ClassicalGateInstance(
                id="G_AND2",
                type=ClassicalGateType.AND,
                fan_in=2,
                inputs=["n_xor1", "n_cin"],
                output="n_and2",
            ),
            ClassicalGateInstance(
                id="G_OR1",
                type=ClassicalGateType.OR,
                fan_in=2,
                inputs=["n_and1", "n_and2"],
                output="n_cout",
            ),
        ],
    )

    is_valid, errs = fa_netlist.validate_netlist()
    assert is_valid, f"FA Netlist validation failed: {errs}"

    # 2. Generate Synthesizable Verilog
    verilog_code = fa_netlist.generate_verilog()
    assert "module full_adder_classical" in verilog_code

    # 3. Construct VerificationContract with 5-qubit mapping:
    # Q0: A, Q1: B, Q2: Cin, Q3: Sum, Q4: Cout
    contract = VerificationContract(
        verilog_code=verilog_code,
        top_module_name="full_adder_classical",
        input_ports=[
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="cin", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
        ],
        output_ports=[
            PortMapping(name="sum", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="cout", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[4]),
        ],
        reference_name="Full Adder Classical Schematic",
        reference_source_type=ReferenceSourceType.INDEPENDENT_SCHEMATIC,
    )

    # 4. Construct Quantum Full Adder (5 qubits)
    qc = QuantumCircuit(5, name="Quantum_Full_Adder")
    # Compute Sum on Q3
    qc.cx(0, 3)
    qc.cx(1, 3)
    qc.cx(2, 3)
    # Compute Cout on Q4
    qc.ccx(0, 1, 4)
    qc.cx(0, 1)
    qc.ccx(1, 2, 4)
    qc.cx(0, 1)

    # 5. Run full verification with schematic_netlist passed for self-consistency check
    result = run_full_verification(contract=contract, quantum_circuit=qc, schematic_netlist=fa_netlist)

    assert result.status == ExecutionEngineStatus.IVERILOG_SUCCESS, f"Verification failed: {result.message} stderr: {result.stderr}"
    assert result.total_states_tested == 8
    assert result.total_errors == 0
    assert result.error_rate == 0.0
    assert result.classical_self_consistency is True
    assert result.is_golden_eligible is True
    assert result.state_fidelity_avg == 1.0


def test_fault_injection_detected_by_netlist_and_cross_check():
    """Test fault injection in netlist:
    Corrupting G_XOR2 to XNOR causes quantum mismatch.
    """
    faulty_netlist = ClassicalNetlist(
        name="full_adder_faulty",
        inputs=[
            PortPin(id="p_a", name="a", bit_width=1, net_ids=["n_a"]),
            PortPin(id="p_b", name="b", bit_width=1, net_ids=["n_b"]),
            PortPin(id="p_cin", name="cin", bit_width=1, net_ids=["n_cin"]),
        ],
        outputs=[
            PortPin(id="p_sum", name="sum", bit_width=1, net_ids=["n_sum"]),
            PortPin(id="p_cout", name="cout", bit_width=1, net_ids=["n_cout"]),
        ],
        gates=[
            ClassicalGateInstance(
                id="G_XOR1",
                type=ClassicalGateType.XOR,
                fan_in=2,
                inputs=["n_a", "n_b"],
                output="n_xor1",
            ),
            # FAULT: XNOR instead of XOR for sum!
            ClassicalGateInstance(
                id="G_XOR2",
                type=ClassicalGateType.XNOR,
                fan_in=2,
                inputs=["n_xor1", "n_cin"],
                output="n_sum",
            ),
            ClassicalGateInstance(
                id="G_AND1",
                type=ClassicalGateType.AND,
                fan_in=2,
                inputs=["n_a", "n_b"],
                output="n_and1",
            ),
            ClassicalGateInstance(
                id="G_AND2",
                type=ClassicalGateType.AND,
                fan_in=2,
                inputs=["n_xor1", "n_cin"],
                output="n_and2",
            ),
            ClassicalGateInstance(
                id="G_OR1",
                type=ClassicalGateType.OR,
                fan_in=2,
                inputs=["n_and1", "n_and2"],
                output="n_cout",
            ),
        ],
    )

    verilog_code = faulty_netlist.generate_verilog()
    contract = VerificationContract(
        verilog_code=verilog_code,
        top_module_name="full_adder_faulty",
        input_ports=[
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="cin", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
        ],
        output_ports=[
            PortMapping(name="sum", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="cout", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[4]),
        ],
        reference_name="Faulty Full Adder",
        reference_source_type=ReferenceSourceType.INDEPENDENT_SCHEMATIC,
    )

    qc = QuantumCircuit(5, name="Correct_Quantum_Full_Adder")
    qc.cx(0, 3)
    qc.cx(1, 3)
    qc.cx(2, 3)
    qc.ccx(0, 1, 4)
    qc.cx(0, 1)
    qc.ccx(1, 2, 4)
    qc.cx(0, 1)

    result = run_full_verification(contract=contract, quantum_circuit=qc, schematic_netlist=faulty_netlist)

    assert result.status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert result.total_errors > 0
    assert result.error_rate > 0.0
