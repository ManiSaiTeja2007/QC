import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
"""Unit tests for Garbage-Free Bennett's Uncomputed Adder/Subtractor."""

import pytest
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import numpy as np
from backend.app.modules.uncomputation import build_uncomputed_adder_subtractor


def test_uncomputed_adder_subtractor_restoration():
    """Verify that primary inputs (qubits 0-4) are perfectly restored after uncomputation."""
    qc = build_uncomputed_adder_subtractor()
    sim = AerSimulator(method="statevector")

    # Test full adder with A=1, B=1, Cin=1
    test_qc = QuantumCircuit(9)
    test_qc.x(0)  # A=1
    test_qc.x(1)  # B=1
    test_qc.x(2)  # Cin=1
    test_qc.compose(qc, inplace=True)
    test_qc.save_statevector()

    sv = sim.run(test_qc).result().get_statevector()
    idx = int(np.argmax(np.abs(sv)))
    bits = [(idx >> q) & 1 for q in range(9)]

    # Primary inputs restored
    assert bits[0] == 1, "Input A restored"
    assert bits[1] == 1, "Input B restored"
    assert bits[2] == 1, "Input Cin restored"
    assert bits[3] == 0, "Input Sel restored"
    assert bits[4] == 0, "Input Don't Care restored"

    # Preserved outputs on ancillae: Carry=1, Sum=1
    assert bits[5] == 1, "Ancilla 5 has Carry Out"
    assert bits[6] == 1, "Ancilla 6 has Sum"
