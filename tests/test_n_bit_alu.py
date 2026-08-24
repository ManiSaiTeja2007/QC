"""Unit tests for Scalable N-Bit (4-Bit) Quantum ALU."""

import pytest
from src.modules.n_bit_alu import (
    build_4bit_alu,
    calculate_n_bit_theoretical_metrics,
)
from src.simulation.cost_metrics import verify_theoretical_formulas


def test_4bit_alu_theoretical_formulas():
    """Verify paper equations (3)-(7) for 4-bit ALU: QC=128, Delay=71, GO=15, T-count=109, T-depth=36."""
    res = verify_theoretical_formulas(n_bits=4)
    assert res["match"], "Theoretical scaling equations must match published 4-bit values"

    comp = res["computed"]
    assert comp["quantum_cost"] == 128
    assert comp["quantum_delay"] == 71
    assert comp["garbage_outputs"] == 15
    assert comp["t_count"] == 109
    assert comp["t_depth"] == 36


def test_4bit_alu_circuit_structure():
    """Verify that 4-bit ALU circuit builds properly."""
    qc = build_4bit_alu()
    assert qc.num_qubits >= 14, "4-bit ALU should have proper register allocations"
