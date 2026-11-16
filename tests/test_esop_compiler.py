"""Comprehensive Test Suite for Parity-Preserving ESOP-to-Clifford+T Compiler.

Tests:
  1. ESOP cube and network evaluation.
  2. Positive-Davio / Reed-Muller expansion and cube optimization.
  3. Verilog combinational assign parser.
  4. Parity-preserving gadget Clifford+T decomposition and metric calculation.
  5. Pebble-game Bennett uncomputation scheduling modes (MIN_ANCILLA, MIN_T_DEPTH, PARETO_BALANCED).
  6. 100% functional correctness against classical golden truth tables across all 2^n inputs.
  7. Strict Zero-Garbage Output invariant (all ancilla qubits return to |0⟩).
  8. Strict Gate-by-Gate & Global Parity Preservation (P_in == P_out).
  9. Active parity-mitigated fidelity recovery under physical transmon noise.
"""

import sys
from pathlib import Path
import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.compiler.esop_synthesizer import (
    ESOPCube,
    ESOPNetwork,
    truth_table_to_esop,
    optimize_esop_cubes,
    parse_verilog_assign_to_esop,
)
from backend.app.compiler.parity_mapper import (
    build_parity_preserving_circuit,
    is_circuit_clifford_t,
)
from backend.app.compiler.pebble_scheduler import (
    PebbleStrategy,
    schedule_pebble_uncomputation,
    compile_boolean_to_parity_clifford_t,
    CompiledCircuitArtifact,
)
from backend.app.simulation.noise_models import (
    build_depolarizing_noise_model,
    simulate_parity_mitigated_density_matrix,
)


def test_esop_cube_and_network():
    """Verify ESOPCube and ESOPNetwork evaluation logic."""
    # Cube: x0 & ~x1, targets output 0
    cube = ESOPCube(literals=frozenset([(0, True), (1, False)]), output_idx=0)
    assert cube.evaluate([1, 0]) == 1
    assert cube.evaluate([1, 1]) == 0
    assert cube.evaluate([0, 0]) == 0

    net = ESOPNetwork(
        num_inputs=2,
        num_outputs=1,
        cubes=[cube],
        input_names=["a", "b"],
        output_names=["y"],
    )
    assert net.evaluate([1, 0]) == [1]
    assert net.evaluate([0, 0]) == [0]


def test_truth_table_to_esop_full_adder():
    """Verify Reed-Muller / Davio expansion on a 1-bit Full Adder."""
    # 3 inputs: A, B, Cin. 2 outputs: Sum, Cout
    # Sum = A ^ B ^ Cin
    # Cout = (A & B) | (B & Cin) | (A & Cin) = (A & B) ^ (B & Cin) ^ (A & Cin)
    tt_sum = []
    tt_cout = []
    for a in [0, 1]:
        for b in [0, 1]:
            for cin in [0, 1]:
                s = a ^ b ^ cin
                c = (a & b) ^ (b & cin) ^ (a & cin)
                tt_sum.append(s)
                tt_cout.append(c)

    net = truth_table_to_esop(
        truth_tables=[tt_sum, tt_cout],
        num_inputs=3,
        input_names=["A", "B", "Cin"],
        output_names=["Sum", "Cout"],
    )
    assert net.num_inputs == 3
    assert net.num_outputs == 2

    # Verify 100% equivalence on all 8 input combinations
    for idx in range(8):
        bits = [(idx >> (2 - i)) & 1 for i in range(3)]
        exp = [tt_sum[idx], tt_cout[idx]]
        act = net.evaluate(bits)
        assert act == exp, f"Mismatch at input {bits}: expected {exp}, got {act}"


def test_optimize_esop_cubes():
    """Verify cube reduction rules: c ^ c = 0 and A.b ^ A.~b = A."""
    # Duplicate cubes: x0 ^ x0 -> cancels to 0
    c1 = ESOPCube(literals=frozenset([(0, True)]), output_idx=0)
    c2 = ESOPCube(literals=frozenset([(0, True)]), output_idx=0)
    opt = optimize_esop_cubes([c1, c2])
    assert len(opt) == 0

    # Merging: x0.x1 ^ x0.~x1 -> x0
    c_pos = ESOPCube(literals=frozenset([(0, True), (1, True)]), output_idx=0)
    c_neg = ESOPCube(literals=frozenset([(0, True), (1, False)]), output_idx=0)
    opt_merged = optimize_esop_cubes([c_pos, c_neg])
    assert len(opt_merged) == 1
    assert opt_merged[0].literals == frozenset([(0, True)])


def test_parse_verilog_assign_to_esop():
    """Verify parsing combinational Verilog assign statements to ESOP."""
    verilog_code = """
    module full_adder(input a, input b, input cin, output sum, output cout);
        assign sum = a ^ b ^ cin;
        assign cout = (a & b) | (b & cin) | (a & cin);
    endmodule
    """
    net = parse_verilog_assign_to_esop(verilog_code)
    assert net.num_inputs == 3
    assert net.num_outputs == 2

    # Check 100% match
    for idx in range(8):
        a = (idx >> 2) & 1
        b = (idx >> 1) & 1
        cin = idx & 1
        exp_sum = a ^ b ^ cin
        exp_cout = (a & b) | (b & cin) | (a & cin)
        assert net.evaluate([a, b, cin]) == [exp_sum, exp_cout]


def test_pebble_game_modes_and_invariants():
    """Verify MIN_ANCILLA vs MIN_T_DEPTH tradeoffs and invariants."""
    verilog_code = """
    module adder(input a, input b, input cin, output sum, output cout);
        assign sum = a ^ b ^ cin;
        assign cout = (a & b) | (b & cin) | (a & cin);
    endmodule
    """
    net = parse_verilog_assign_to_esop(verilog_code)

    artifact_min_ancilla = compile_boolean_to_parity_clifford_t(
        net, strategy=PebbleStrategy.MIN_ANCILLA
    )
    artifact_min_depth = compile_boolean_to_parity_clifford_t(
        net, strategy=PebbleStrategy.MIN_T_DEPTH
    )

    # 1. Both must be strictly Clifford+T
    assert is_circuit_clifford_t(artifact_min_ancilla.circuit)
    assert is_circuit_clifford_t(artifact_min_depth.circuit)

    # 2. Invariant: MIN_ANCILLA ancillae <= MIN_T_DEPTH ancillae
    assert artifact_min_ancilla.ancilla_count <= artifact_min_depth.ancilla_count

    # 3. Invariant: MIN_T_DEPTH t_depth <= MIN_ANCILLA t_depth
    assert artifact_min_depth.t_depth <= artifact_min_ancilla.t_depth


def test_compiled_circuit_garbage_free_and_parity_preserved():
    """Verify 100% functional match, zero garbage outputs, and strict parity preservation."""
    verilog_code = """
    module full_adder(input a, input b, input cin, output sum, output cout);
        assign sum = a ^ b ^ cin;
        assign cout = (a & b) ^ (b & cin) ^ (a & cin);
    endmodule
    """
    net = parse_verilog_assign_to_esop(verilog_code)
    artifact = compile_boolean_to_parity_clifford_t(net, strategy=PebbleStrategy.PARETO_BALANCED, max_ancillas=3)

    assert artifact.parity_preserved is True
    assert artifact.garbage_free is True
    assert artifact.functional_equivalence_pct == 100.0


def test_compiled_circuit_parity_mitigation():
    """Verify that compiled circuits achieve active error mitigation under transmon noise."""
    verilog_code = """
    module half_adder(input a, input b, output sum, output cout);
        assign sum = a ^ b;
        assign cout = a & b;
    endmodule
    """
    net = parse_verilog_assign_to_esop(verilog_code)
    artifact = compile_boolean_to_parity_clifford_t(net, strategy=PebbleStrategy.MIN_ANCILLA)

    # Simulate under depolarizing noise
    nm = build_depolarizing_noise_model(p1=0.005, p2=0.02)
    # Primary inputs: A, B; initial state [1, 1] + 0 on all output/ancilla lines
    init_bits = [1, 1] + [0] * (artifact.circuit.num_qubits - 2)

    mit_res = simulate_parity_mitigated_density_matrix(artifact.circuit, init_bits, nm)

    assert mit_res["mitigated_fidelity"] > mit_res["raw_fidelity"]
    assert mit_res["acceptance_rate"] > 0.0
