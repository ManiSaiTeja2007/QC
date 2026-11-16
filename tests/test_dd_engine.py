"""Unit Tests for Quantum Decision Diagram (QMDD) & Multi-Bit ALU Engine.

Verifies:
  1. Exact Cyclotomic ring arithmetic D[ω] across Clifford+T operations.
  2. QMDD Statevector representation, hash-consing, and node uniqueness.
  3. QMDD unitary gate application (H, T, Tdg, S, Sdg, X, Z, CNOT, Toffoli, Fredkin).
  4. Bit-exact cross-validation against Qiskit Aer for n <= 9 qubits.
  5. Multi-bit Quantum ALU scaling (1, 4, 8, 16, 32, 64 bits) and parity preservation.
"""

import unittest
import numpy as np

from backend.app.dd_engine.cyclotomic import CyclotomicComplex
from backend.app.dd_engine.qmdd import QMDDState, QMDDContext, QMDDNode, QMDDEdge


class TestCyclotomicArithmetic(unittest.TestCase):
    """Test suite for exact algebraic ring D[ω] = Z[ω, 1/√2]."""

    def test_01_constants_and_reduction(self):
        self.assertTrue(CyclotomicComplex.ZERO.is_zero())
        self.assertTrue(CyclotomicComplex.ONE.is_one())
        self.assertEqual(CyclotomicComplex.ZERO.to_complex(), 0.0 + 0.0j)
        self.assertEqual(CyclotomicComplex.ONE.to_complex(), 1.0 + 0.0j)
        self.assertEqual(CyclotomicComplex.I.to_complex(), 1.0j)
        self.assertEqual(CyclotomicComplex.NEG_I.to_complex(), -1.0j)

    def test_02_addition_and_subtraction(self):
        # 1/√2 + 1/√2 = √2
        res = CyclotomicComplex.INV_SQRT2 + CyclotomicComplex.INV_SQRT2
        self.assertEqual(res, CyclotomicComplex.SQRT2)
        self.assertAlmostEqual(res.to_complex().real, np.sqrt(2.0), places=12)

        # 1/2 + 1/2 = 1
        half = CyclotomicComplex(1, 0, 0, 0, 2)
        one = half + half
        self.assertEqual(one, CyclotomicComplex.ONE)

        # x - x = 0
        diff = CyclotomicComplex.OMEGA - CyclotomicComplex.OMEGA
        self.assertTrue(diff.is_zero())

    def test_03_multiplication_group_laws(self):
        # T * T = S
        self.assertEqual(CyclotomicComplex.OMEGA * CyclotomicComplex.OMEGA, CyclotomicComplex.I)

        # S * S = -1 (Z gate on |1⟩)
        self.assertEqual(CyclotomicComplex.I * CyclotomicComplex.I, CyclotomicComplex.NEG_ONE)

        # T * T† = 1
        self.assertEqual(CyclotomicComplex.OMEGA * CyclotomicComplex.OMEGA_DAG, CyclotomicComplex.ONE)

        # (1/√2) * (1/√2) = 1/2
        half = CyclotomicComplex.INV_SQRT2 * CyclotomicComplex.INV_SQRT2
        self.assertEqual(half, CyclotomicComplex(1, 0, 0, 0, 2))

    def test_04_hadamard_properties(self):
        # H = (1/√2) * [[1, 1], [1, -1]]
        # H[0,0]*H[0,0] + H[0,1]*H[1,0] = (1/√2)^2 + (1/√2)^2 = 1/2 + 1/2 = 1
        h00 = CyclotomicComplex.INV_SQRT2
        h01 = CyclotomicComplex.INV_SQRT2
        h10 = CyclotomicComplex.INV_SQRT2
        h11 = -CyclotomicComplex.INV_SQRT2

        elem00 = h00 * h00 + h01 * h10
        elem01 = h00 * h01 + h01 * h11
        elem11 = h10 * h01 + h11 * h11

        self.assertEqual(elem00, CyclotomicComplex.ONE)
        self.assertTrue(elem01.is_zero())
        self.assertEqual(elem11, CyclotomicComplex.ONE)

    def test_05_hash_and_uniqueness(self):
        # Two independently computed instances of 1 must hash identically
        val1 = CyclotomicComplex.OMEGA * CyclotomicComplex.OMEGA_DAG
        val2 = CyclotomicComplex(1, 0, 0, 0, 0)
        self.assertEqual(val1, val2)
        self.assertEqual(hash(val1), hash(val2))
        s = {val1}
        self.assertIn(val2, s)


class TestQMDDStateAndGates(unittest.TestCase):
    """Test suite for QMDD statevector representation and Clifford+T gate executions."""

    def test_01_basis_state_creation_and_measure(self):
        st = QMDDState.from_basis_state(4, "1010")
        self.assertEqual(st.measure_basis_state(), "1010")
        # Hamming weight 2 -> parity +1.0
        self.assertEqual(st.expectation_z_all(), 1.0)
        # 4 qubits -> exactly 4 active nodes
        self.assertEqual(st.node_count(), 4)

    def test_02_single_qubit_clifford_t_gates(self):
        from qiskit import QuantumCircuit
        from qiskit.quantum_info import Statevector

        # Test sequence: H(0) -> T(0) -> S(0) -> Tdg(0) -> Sdg(0) -> H(0) == I
        qc = QuantumCircuit(1)
        qc.h(0)
        qc.t(0)
        qc.s(0)
        qc.tdg(0)
        qc.sdg(0)
        qc.h(0)

        st = QMDDState.from_basis_state(1, "0")
        st.apply_circuit(qc)

        sv_qiskit = Statevector(qc).data
        sv_qmdd = st.to_statevector()
        self.assertTrue(np.allclose(sv_qmdd, sv_qiskit, atol=1e-12))
        self.assertEqual(st.measure_basis_state(), "0")

    def test_03_controlled_gates_and_bell_state(self):
        from qiskit import QuantumCircuit
        from qiskit.quantum_info import Statevector

        # Bell State |Φ+⟩ = (|00⟩ + |11⟩)/√2
        qc = QuantumCircuit(2)
        qc.h(0)
        qc.cx(0, 1)

        st = QMDDState.from_basis_state(2, "00")
        st.apply_circuit(qc)

        sv_qiskit = Statevector(qc).data
        sv_qmdd = st.to_statevector()
        self.assertTrue(np.allclose(sv_qmdd, sv_qiskit, atol=1e-12))
        # Parity of Bell state |Φ+⟩: (|00⟩ and |11⟩ both have even HW -> parity strictly +1.0)
        self.assertEqual(st.expectation_z_all(), 1.0)

    def test_04_toffoli_and_fredkin_gates(self):
        # Toffoli: CCX(0, 1, 2) on |110⟩ -> |111⟩
        st_toff = QMDDState.from_basis_state(3, "011") # q2=0, q1=1, q0=1
        st_toff.apply_ccx(0, 1, 2)
        self.assertEqual(st_toff.measure_basis_state(), "111")

        # Fredkin: CSWAP(0, 1, 2) on ctrl=q0=1, t1=q1=1, t2=q2=0 -> |101⟩ -> |011⟩
        st_fred = QMDDState.from_basis_state(3, "011") # q2=0, q1=1, q0=1
        st_fred.apply_cswap(0, 1, 2)
        self.assertEqual(st_fred.measure_basis_state(), "101")

    def test_05_falfg_and_1bit_alu_exact_cross_validation(self):
        from backend.app.modules.falfg import build_falfg_clifford_t
        from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t
        from qiskit import QuantumCircuit
        from qiskit.quantum_info import Statevector

        # 1. 5x5 FALFG Gate
        qc_falfg = build_falfg_clifford_t()
        st_falfg = QMDDState.from_basis_state(5, [1, 1, 0, 0, 0])
        st_falfg.apply_circuit(qc_falfg)

        qc_ref = QuantumCircuit(5)
        qc_ref.x(0)
        qc_ref.x(1)
        qc_ref.compose(qc_falfg, inplace=True)
        sv_ref = Statevector(qc_ref).data

        self.assertTrue(np.allclose(st_falfg.to_statevector(), sv_ref, atol=1e-12))
        self.assertEqual(st_falfg.measure_basis_state(), "10001")

        # 2. 1-Bit ALU (7 qubits, 75 gates)
        qc_alu = build_one_bit_alu_clifford_t()
        # Full Adder A=1, B=1, Cin=0 -> Sum=0, Cout=1
        # Register order: [A, B, S0, S1, M, S2, S3] = [1, 1, 0, 0, 1, 0, 0]
        inp = [1, 1, 0, 0, 1, 0, 0]
        st_alu = QMDDState.from_basis_state(7, inp)
        st_alu.apply_circuit(qc_alu)

        qc_alu_ref = QuantumCircuit(7)
        for q, b in enumerate(inp):
            if b:
                qc_alu_ref.x(q)
        qc_alu_ref.compose(qc_alu, inplace=True)
        sv_alu_ref = Statevector(qc_alu_ref).data

        self.assertTrue(np.allclose(st_alu.to_statevector(), sv_alu_ref, atol=1e-12))
        # Parity invariant check
        exp_parity = (-1.0) ** (sum(inp) % 2)
        self.assertEqual(st_alu.expectation_z_all(), exp_parity)


class TestMultiBitALUQMDD(unittest.TestCase):
    """Test suite for scalable Multi-Bit Quantum ALUs (1 to 64 bits) simulated via QMDD."""

    def test_01_1bit_alu_operations(self):
        from backend.app.dd_engine.multibit_alu import simulate_multibit_alu_qmdd

        # Full Adder: 1 + 1 + 0 = Sum 0, Cout 1
        res_add = simulate_multibit_alu_qmdd(1, "Full Adder", 1, 1, 0)
        self.assertTrue(res_add["golden_match"])
        self.assertEqual(res_add["measured_result"], 0)
        self.assertEqual(res_add["measured_cout"], 1)
        self.assertTrue(res_add["parity_preserved"])

        # XOR: 1 ^ 0 = 1
        res_xor = simulate_multibit_alu_qmdd(1, "XOR", 1, 0, 0)
        self.assertTrue(res_xor["golden_match"])
        self.assertEqual(res_xor["measured_result"], 1)

    def test_02_4bit_alu_arithmetic_and_logic(self):
        from backend.app.dd_engine.multibit_alu import simulate_multibit_alu_qmdd

        # 4-bit addition: 9 + 7 = 16 -> Sum 0, Cout 1
        res_add = simulate_multibit_alu_qmdd(4, "Full Adder", 9, 7, 0)
        self.assertTrue(res_add["golden_match"])
        self.assertEqual(res_add["measured_result"], 0)
        self.assertEqual(res_add["measured_cout"], 1)
        self.assertTrue(res_add["parity_preserved"])

        # 4-bit subtraction: 12 - 5 = 7 -> Diff 7, Borrow 0
        res_sub = simulate_multibit_alu_qmdd(4, "Full Subtractor", 12, 5, 0)
        self.assertTrue(res_sub["golden_match"])
        self.assertEqual(res_sub["measured_result"], 7)
        self.assertEqual(res_sub["measured_cout"], 0)

        # 4-bit XOR: 10 ^ 5 = 15
        res_xor = simulate_multibit_alu_qmdd(4, "XOR", 10, 5, 0)
        self.assertTrue(res_xor["golden_match"])
        self.assertEqual(res_xor["measured_result"], 15)

    def test_03_8bit_alu_carry_propagation(self):
        from backend.app.dd_engine.multibit_alu import simulate_multibit_alu_qmdd

        # 8-bit ripple-carry: 200 + 55 + 1 = 256 -> Sum 0, Cout 1
        res = simulate_multibit_alu_qmdd(8, "Full Adder", 200, 55, 1)
        self.assertTrue(res["golden_match"])
        self.assertEqual(res["measured_result"], 0)
        self.assertEqual(res["measured_cout"], 1)
        self.assertTrue(res["parity_preserved"])
        # 56 qubits: dense vector is 2^56 states (7.2e16); QMDD has < 200 nodes!
        self.assertLess(res["peak_qmdd_nodes"], 200)

    def test_04_16bit_alu_scaling(self):
        from backend.app.dd_engine.multibit_alu import simulate_multibit_alu_qmdd

        # 16-bit word addition: 35000 + 20000 = 55000
        res = simulate_multibit_alu_qmdd(16, "Full Adder", 35000, 20000, 0)
        self.assertTrue(res["golden_match"])
        self.assertEqual(res["measured_result"], 55000)
        self.assertEqual(res["measured_cout"], 0)
        self.assertTrue(res["parity_preserved"])
        # 112 qubits: QMDD nodes < 500
        self.assertLess(res["peak_qmdd_nodes"], 500)
        self.assertGreater(res["compression_ratio"], 1e20)

    def test_05_32bit_alu_scaling(self):
        from backend.app.dd_engine.multibit_alu import simulate_multibit_alu_qmdd

        # 32-bit addition: 2,000,000,000 + 1,500,000,000 = 3,500,000,000
        res = simulate_multibit_alu_qmdd(32, "Full Adder", 2_000_000_000, 1_500_000_000, 0)
        self.assertTrue(res["golden_match"])
        self.assertEqual(res["measured_result"], 3_500_000_000)
        self.assertEqual(res["measured_cout"], 0)
        self.assertTrue(res["parity_preserved"])
        # 224 qubits: QMDD runtime < 4.0 seconds, nodes < 1000
        self.assertLess(res["runtime_ms"], 4000.0)
        self.assertLess(res["peak_qmdd_nodes"], 1000)

    def test_06_64bit_alu_bitwise(self):
        from backend.app.dd_engine.multibit_alu import simulate_multibit_alu_qmdd

        # 64-bit XOR: 0xAAAAAAAAAAAAAAAA ^ 0x5555555555555555 = 0xFFFFFFFFFFFFFFFF
        a = 0xAAAAAAAAAAAAAAAA
        b = 0x5555555555555555
        res = simulate_multibit_alu_qmdd(64, "XOR", a, b, 0)
        self.assertTrue(res["golden_match"])
        self.assertEqual(res["measured_result"], 0xFFFFFFFFFFFFFFFF)
        self.assertTrue(res["parity_preserved"])
        # 448 qubits: QMDD nodes < 1500
        self.assertEqual(res["total_qubits"], 448)
        self.assertLess(res["peak_qmdd_nodes"], 1500)

    def test_07_phase2_compiler_cross_check(self):
        from backend.app.compiler.esop_synthesizer import truth_table_to_esop
        from backend.app.compiler.pebble_scheduler import compile_boolean_to_parity_clifford_t, PebbleStrategy
        from backend.app.dd_engine.qmdd import QMDDState

        # 1-bit full adder truth tables: sum and cout as 2^3 lists
        # k = 0 (000) -> sum=0, cout=0
        # k = 1 (001) -> sum=1, cout=0
        # k = 2 (010) -> sum=1, cout=0
        # k = 3 (011) -> sum=0, cout=1
        # k = 4 (100) -> sum=1, cout=0
        # k = 5 (101) -> sum=0, cout=1
        # k = 6 (110) -> sum=0, cout=1
        # k = 7 (111) -> sum=1, cout=1
        sum_tt = [0, 1, 1, 0, 1, 0, 0, 1]
        cout_tt = [0, 0, 0, 1, 0, 1, 1, 1]

        esop = truth_table_to_esop([sum_tt, cout_tt], num_inputs=3)
        artifact = compile_boolean_to_parity_clifford_t(esop, strategy=PebbleStrategy.MIN_ANCILLA)

        # Simulate synthesized circuit on QMDD
        # Test input (1, 1, 0) -> Sum 0, Cout 1
        st = QMDDState.from_basis_state(artifact.circuit.num_qubits, [1, 1, 0] + [0] * (artifact.circuit.num_qubits - 3))
        st.apply_circuit(artifact.circuit)
        bs = st.measure_basis_state()
        bits = [int(b) for b in reversed(bs)]
        # primary outputs on qubits 3 and 4
        measured_sum = bits[3]
        measured_cout = bits[4]
        self.assertEqual(measured_sum, 0)
        self.assertEqual(measured_cout, 1)
        self.assertTrue(st.expectation_z_all() in (1.0, -1.0))


if __name__ == "__main__":
    unittest.main()
