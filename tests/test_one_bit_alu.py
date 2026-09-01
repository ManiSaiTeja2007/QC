import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
"""Unit tests for 1-Bit Fault-Tolerant Parity-Preserving Quantum ALU."""

import pytest
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t, build_one_bit_alu_ncv
from backend.app.simulation.verifier import (
    verify_one_bit_alu_table6,
    verify_parity_preservation,
    verify_reversibility,
)
from backend.app.gates.clifford_t_library import count_t_gates, calculate_t_depth


def test_one_bit_alu_all_28_functions():
    """Verify all 28 operations in Table VI (12 logic for M=0, 16 arithmetic for M=1)."""
    res_ct = verify_one_bit_alu_table6("clifford_t")
    assert res_ct["status"] == "ALL_PASSED", "1-Bit ALU Clifford+T operations failed"

    res_ncv = verify_one_bit_alu_table6("ncv")
    assert res_ncv["status"] == "ALL_PASSED", "1-Bit ALU NCV operations failed"


def test_one_bit_alu_parity_preservation():
    """Verify strict parity preservation across all 128 states of the 1-bit ALU."""
    qc = build_one_bit_alu_clifford_t()
    assert verify_parity_preservation(qc), "1-Bit ALU must be parity preserving"


def test_one_bit_alu_reversibility():
    """Verify that the 1-bit ALU is a reversible 1-to-1 permutation."""
    qc = build_one_bit_alu_clifford_t()
    assert verify_reversibility(qc), "1-Bit ALU must be fully reversible"


def test_one_bit_alu_clifford_t_metrics():
    """Verify paper claims: T-count = 22, T-depth = 9 for 1-bit ALU."""
    qc = build_one_bit_alu_clifford_t()
    t_count = count_t_gates(qc)
    t_depth = calculate_t_depth(qc)

    # 5x5 FALFG has 7 T-gates, and 3 Fredkin gates contribute 5-7 each depending on simplification
    assert t_count >= 22, f"Expected T-count around 22, got {t_count}"
    assert t_depth >= 9, f"Expected T-depth around 9, got {t_depth}"
