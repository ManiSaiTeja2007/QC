import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
"""Unit tests for the 5x5 FALFG Gate (Full Adder/Subtractor & Function Generator)."""

import pytest
from backend.app.modules.falfg import build_falfg_clifford_t, build_falfg_ncv
from backend.app.simulation.verifier import (
    verify_falfg_table4,
    verify_falfg_table5,
    verify_parity_preservation,
    verify_reversibility,
)
from backend.app.gates.clifford_t_library import count_t_gates, calculate_t_depth


def test_falfg_table4_truth_table_all_32_states():
    """Verify 100% exact match against Table IV truth table across all 32 basis states."""
    res_ct = verify_falfg_table4("clifford_t")
    assert res_ct["all_matched"], f"FALFG Clifford+T Table IV failed: {res_ct['passed_states']}/32 passed"

    res_ncv = verify_falfg_table4("ncv")
    assert res_ncv["all_matched"], f"FALFG NCV Table IV failed: {res_ncv['passed_states']}/32 passed"


def test_falfg_table5_all_24_functions():
    """Verify all 24 arithmetic and logic functions from Table V."""
    res = verify_falfg_table5("clifford_t")
    assert res["status"] == "ALL_PASSED", "FALFG Table V functions verification failed"


def test_falfg_parity_preservation():
    """Verify strict parity preservation (Pin == Pout) for all 32 input states."""
    qc = build_falfg_clifford_t()
    assert verify_parity_preservation(qc), "FALFG gate must be parity preserving"


def test_falfg_reversibility():
    """Verify that FALFG is a reversible, 1-to-1 bijective mapping."""
    qc = build_falfg_clifford_t()
    assert verify_reversibility(qc), "FALFG gate must be fully reversible"


def test_falfg_clifford_t_metrics():
    """Verify paper claims: T-count = 7, T-depth = 3 for 5x5 FALFG."""
    qc = build_falfg_clifford_t()
    t_count = count_t_gates(qc)
    t_depth = calculate_t_depth(qc)

    assert t_count == 7, f"Expected T-count 7, got {t_count}"
    assert t_depth == 3, f"Expected T-depth 3, got {t_depth}"
