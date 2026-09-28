"""Unit tests for Verilog Golden Reference Engine and Hardware Generators."""

import pytest
from backend.app.schemas.verification_contract import (
    ExecutionEngineStatus,
    PortMapping,
    PortDirection,
)
from backend.app.simulation.verilog_engine import (
    simulate_verilog,
    extract_top_module_name,
    get_iverilog_path,
    get_vvp_path,
)
from backend.app.core.verilog_generator import (
    get_verilog_template,
    list_verilog_templates,
    export_circuit_to_verilog,
)


def test_iverilog_and_vvp_installed():
    """Ensure host environment has Icarus Verilog installed."""
    assert get_iverilog_path() is not None, "iverilog binary must be accessible"
    assert get_vvp_path() is not None, "vvp binary must be accessible"


def test_extract_top_module():
    code = "module my_custom_adder (input a, output y);\nassign y = a;\nendmodule"
    assert extract_top_module_name(code) == "my_custom_adder"


def test_simulate_and_gate():
    template = get_verilog_template("and_gate")
    assert template is not None

    status, table, msg, stderr, elapsed_ms = simulate_verilog(
        verilog_code=template["verilog_code"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        top_module_name=template["top_module"],
    )

    assert status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert len(table) == 4
    assert elapsed_ms > 0

    # Truth table for AND: 00->0, 01->0, 10->0, 11->1
    expected_outputs = {"00": "0", "01": "0", "10": "0", "11": "1"}
    for row in table:
        in_bits = row["input_bitstring"]
        out_bits = row["output_bitstring"]
        assert expected_outputs[in_bits] == out_bits


def test_simulate_half_adder():
    template = get_verilog_template("half_adder")
    assert template is not None

    status, table, msg, stderr, elapsed_ms = simulate_verilog(
        verilog_code=template["verilog_code"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        top_module_name=template["top_module"],
    )

    assert status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert len(table) == 4

    # Half Adder: sum = a ^ b, cout = a & b
    # output concatenation: {tb_sum, tb_cout}
    # 00 -> 00, 01 -> 10, 10 -> 10, 11 -> 01
    expected = {"00": "00", "01": "10", "10": "10", "11": "01"}
    for row in table:
        assert expected[row["input_bitstring"]] == row["output_bitstring"]


def test_simulate_full_adder():
    template = get_verilog_template("full_adder")
    assert template is not None

    status, table, msg, stderr, elapsed_ms = simulate_verilog(
        verilog_code=template["verilog_code"],
        input_ports=template["input_ports"],
        output_ports=template["output_ports"],
        top_module_name=template["top_module"],
    )

    assert status == ExecutionEngineStatus.IVERILOG_SUCCESS
    assert len(table) == 8  # 2^3 = 8 states

    for row in table:
        a = row["input_values"]["a"]
        b = row["input_values"]["b"]
        cin = row["input_values"]["cin"]
        sum_val = row["output_values"]["sum"]
        cout_val = row["output_values"]["cout"]

        expected_sum = (a ^ b ^ cin) & 1
        expected_cout = ((a & b) | (cin & (a ^ b))) & 1
        assert sum_val == expected_sum
        assert cout_val == expected_cout


def test_compilation_error_reporting():
    """Verify that invalid Verilog produces COMPILATION_ERROR with explicit stderr, not silent fallback."""
    bad_verilog = """
    module broken (input wire a, output wire y);
        assign y = a & ; // Syntax error!
    endmodule
    """
    in_ports = [PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0])]
    out_ports = [PortMapping(name="y", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[1])]

    status, table, msg, stderr, elapsed = simulate_verilog(
        verilog_code=bad_verilog,
        input_ports=in_ports,
        output_ports=out_ports,
    )

    assert status == ExecutionEngineStatus.COMPILATION_ERROR
    assert len(table) == 0
    assert stderr is not None
    assert "syntax error" in stderr.lower() or "error" in stderr.lower()


def test_empty_verilog_rejection():
    status, table, msg, stderr, elapsed = simulate_verilog(
        verilog_code="   ",
        input_ports=[PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0])],
        output_ports=[PortMapping(name="y", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[1])],
    )
    assert status == ExecutionEngineStatus.SYNTAX_ERROR
    assert len(table) == 0


def test_list_templates():
    templates = list_verilog_templates()
    assert len(templates) >= 4
    ids = [t["id"] for t in templates]
    assert "and_gate" in ids
    assert "full_adder" in ids
    assert "falfg_gate" in ids


def test_export_circuit_to_verilog():
    code = export_circuit_to_verilog(
        circuit_name="demo_adder",
        num_qubits=3,
        truth_table=[
            {"input_bitstring": "000", "quantum_output_bitstring": "000"},
            {"input_bitstring": "111", "quantum_output_bitstring": "101"},
        ],
    )
    assert "module demo_adder" in code
    assert "3'b111: q_out = 3'b101;" in code
    assert "AUTO-DERIVED VERILOG EXPORT" in code
