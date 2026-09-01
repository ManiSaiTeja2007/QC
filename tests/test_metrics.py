import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
"""Unit tests for Quantum Cost and Hardware Metrics."""

import pytest
from backend.app.modules.falfg import build_falfg_clifford_t, build_falfg_ncv
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t, build_one_bit_alu_ncv
from backend.app.simulation.cost_metrics import analyze_circuit_cost, verify_theoretical_formulas


def test_falfg_metrics():
    """Verify metrics for FALFG: T-count=7, T-depth=3."""
    qc = build_falfg_clifford_t()
    metrics = analyze_circuit_cost(qc, "FALFG_Clifford_T")

    assert metrics["t_count"] == 7
    assert metrics["t_depth"] == 3
    assert metrics["num_qubits"] == 5
    assert metrics["is_clifford_t"]


def test_1bit_alu_metrics():
    """Verify metrics for 1-bit ALU: 7 qubits, Clifford+T synthesis."""
    qc = build_one_bit_alu_clifford_t()
    metrics = analyze_circuit_cost(qc, "1Bit_ALU_Clifford_T")

    assert metrics["num_qubits"] == 7
    assert metrics["is_clifford_t"]
    assert metrics["t_count"] >= 22


def test_n_bit_scaling_formulas():
    """Verify theoretical scaling formulas across 1, 2, 4, 8 bits."""
    for n in [1, 2, 4, 8]:
        res = verify_theoretical_formulas(n_bits=n)
        assert res["computed"]["quantum_cost"] == 34 * n - 8
        assert res["computed"]["quantum_delay"] == 17 * n + 3
        assert res["computed"]["garbage_outputs"] == 4 * n - 1
        assert res["computed"]["t_count"] == 29 * n - 7
        assert res["computed"]["t_depth"] == 9 * n
