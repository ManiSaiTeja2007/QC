import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
"""Unit tests for Fundamental Reversible and Clifford+T Gates."""

import pytest
import numpy as np
from qiskit import QuantumCircuit
from qiskit.quantum_info import Operator
from backend.app.gates.basic_gates import (
    add_cv,
    add_cv_dag,
    add_fredkin_ncv,
    add_fredkin_clifford_t,
    add_f2g,
    build_fredkin_circuit,
)
from backend.app.gates.clifford_t_library import count_t_gates, calculate_t_depth, is_clifford_t


def test_cv_and_cv_dag_inverse():
    """Verify that CV * CV† = Identity."""
    qc = QuantumCircuit(2)
    add_cv(qc, 0, 1)
    add_cv_dag(qc, 0, 1)

    op = Operator(qc)
    eye = Operator(QuantumCircuit(2))
    assert op.equiv(eye), "CV followed by CV† must equal Identity"


def test_fredkin_clifford_t_correctness():
    """Verify that the Clifford+T Fredkin matches the ideal CSWAP unitary."""
    qc_test = QuantumCircuit(3)
    add_fredkin_clifford_t(qc_test, 0, 1, 2)

    qc_ideal = QuantumCircuit(3)
    qc_ideal.cswap(0, 1, 2)

    op_test = Operator(qc_test)
    op_ideal = Operator(qc_ideal)
    assert op_test.equiv(op_ideal), "Clifford+T Fredkin must be equivalent to CSWAP"


def test_fredkin_metrics():
    """Verify Fredkin T-count = 7 and Clifford+T compliance."""
    qc = build_fredkin_circuit("clifford_t")
    t_count = count_t_gates(qc)
    t_depth = calculate_t_depth(qc)

    assert t_count == 7, f"Expected T-count 7, got {t_count}"
    assert t_depth <= 4, f"Expected T-depth <= 4, got {t_depth}"
    assert is_clifford_t(qc), "Circuit must be in Clifford+T library"


def test_double_feynman_parity():
    """Verify that the Double Feynman (F2G) gate strictly preserves parity."""
    qc = QuantumCircuit(3)
    add_f2g(qc, 0, 1, 2)

    for in_state in range(8):
        bits = [(in_state >> i) & 1 for i in range(3)]
        in_parity = sum(bits) % 2

        # (A, B, C) -> (A, A ^ B, A ^ C)
        out_bits = [bits[0], bits[0] ^ bits[1], bits[0] ^ bits[2]]
        out_parity = sum(out_bits) % 2

        assert in_parity == out_parity, f"F2G parity violation for state {bits}"
