"""Mandatory Unit Tests for Bloch Sphere Mathematics (Phase 1).

Tests:
  1. |0⟩   → (0, 0, +1)
  2. |1⟩   → (0, 0, -1)
  3. |+⟩   → (+1, 0, 0)
  4. |-⟩   → (-1, 0, 0)
  5. |+i⟩  → (0, +1, 0)
  6. |-i⟩  → (0, -1, 0)
  7. H|0⟩  → |+⟩
  8. X|0⟩  → |1⟩
  9. T|+⟩  → rotation around Z by π/4 (x = cos(π/4), y = sin(π/4), z = 0)
 10. Bell State (|00⟩+|11⟩)/√2 → reduced state for Q0 is Maximally Mixed (|r| = 0.000)
"""

import sys
from pathlib import Path
import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from backend.app.simulation.bloch_adapter import state_to_bloch_vector, compute_reduced_bloch_vector


def test_basis_state_ket_0():
    # |0⟩
    x, y, z, r = state_to_bloch_vector(1.0, 0.0)
    assert abs(x - 0.0) < 1e-6
    assert abs(y - 0.0) < 1e-6
    assert abs(z - 1.0) < 1e-6
    assert abs(r - 1.0) < 1e-6


def test_basis_state_ket_1():
    # |1⟩
    x, y, z, r = state_to_bloch_vector(0.0, 1.0)
    assert abs(x - 0.0) < 1e-6
    assert abs(y - 0.0) < 1e-6
    assert abs(z - (-1.0)) < 1e-6
    assert abs(r - 1.0) < 1e-6


def test_basis_state_ket_plus():
    # |+⟩ = (|0⟩ + |1⟩)/√2
    inv_sqrt2 = 1.0 / np.sqrt(2)
    x, y, z, r = state_to_bloch_vector(inv_sqrt2, inv_sqrt2)
    assert abs(x - 1.0) < 1e-6
    assert abs(y - 0.0) < 1e-6
    assert abs(z - 0.0) < 1e-6
    assert abs(r - 1.0) < 1e-6


def test_basis_state_ket_minus():
    # |-⟩ = (|0⟩ - |1⟩)/√2
    inv_sqrt2 = 1.0 / np.sqrt(2)
    x, y, z, r = state_to_bloch_vector(inv_sqrt2, -inv_sqrt2)
    assert abs(x - (-1.0)) < 1e-6
    assert abs(y - 0.0) < 1e-6
    assert abs(z - 0.0) < 1e-6
    assert abs(r - 1.0) < 1e-6


def test_basis_state_ket_plus_i():
    # |+i⟩ = (|0⟩ + i|1⟩)/√2
    inv_sqrt2 = 1.0 / np.sqrt(2)
    x, y, z, r = state_to_bloch_vector(inv_sqrt2, 1j * inv_sqrt2)
    assert abs(x - 0.0) < 1e-6
    assert abs(y - 1.0) < 1e-6
    assert abs(z - 0.0) < 1e-6
    assert abs(r - 1.0) < 1e-6


def test_basis_state_ket_minus_i():
    # |-i⟩ = (|0⟩ - i|1⟩)/√2
    inv_sqrt2 = 1.0 / np.sqrt(2)
    x, y, z, r = state_to_bloch_vector(inv_sqrt2, -1j * inv_sqrt2)
    assert abs(x - 0.0) < 1e-6
    assert abs(y - (-1.0)) < 1e-6
    assert abs(z - 0.0) < 1e-6
    assert abs(r - 1.0) < 1e-6


def test_hadamard_gate_action():
    # H|0⟩ -> |+⟩
    qc = QuantumCircuit(1)
    qc.h(0)
    sv = Statevector.from_instruction(qc)
    vec = compute_reduced_bloch_vector(sv, 0, 1)
    assert abs(vec["x"] - 1.0) < 1e-6
    assert abs(vec["y"] - 0.0) < 1e-6
    assert abs(vec["z"] - 0.0) < 1e-6


def test_pauli_x_gate_action():
    # X|0⟩ -> |1⟩
    qc = QuantumCircuit(1)
    qc.x(0)
    sv = Statevector.from_instruction(qc)
    vec = compute_reduced_bloch_vector(sv, 0, 1)
    assert abs(vec["x"] - 0.0) < 1e-6
    assert abs(vec["y"] - 0.0) < 1e-6
    assert abs(vec["z"] - (-1.0)) < 1e-6


def test_t_gate_action_on_plus_state():
    # T|+⟩ -> e^{iπ/4} rotation around Z axis
    qc = QuantumCircuit(1)
    qc.h(0)
    qc.t(0)
    sv = Statevector.from_instruction(qc)
    vec = compute_reduced_bloch_vector(sv, 0, 1)
    expected_x = np.cos(np.pi / 4)
    expected_y = np.sin(np.pi / 4)
    assert abs(vec["x"] - expected_x) < 1e-6
    assert abs(vec["y"] - expected_y) < 1e-6
    assert abs(vec["z"] - 0.0) < 1e-6


def test_bell_state_reduced_density_matrix():
    # (|00⟩ + |11⟩)/√2 -> Q0 and Q1 reduced states should be Maximally Mixed (|r| = 0.000)
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    sv = Statevector.from_instruction(qc)

    v0 = compute_reduced_bloch_vector(sv, 0, 2)
    v1 = compute_reduced_bloch_vector(sv, 1, 2)

    assert abs(v0["r"] - 0.0) < 1e-6, f"Expected Q0 reduced magnitude 0.0 for Bell state, got {v0['r']}"
    assert abs(v1["r"] - 0.0) < 1e-6, f"Expected Q1 reduced magnitude 0.0 for Bell state, got {v1['r']}"
    assert v0["state_label"] == "Maximally Mixed (Entangled)"
    assert v1["state_label"] == "Maximally Mixed (Entangled)"


if __name__ == "__main__":
    tests = [
        test_basis_state_ket_0,
        test_basis_state_ket_1,
        test_basis_state_ket_plus,
        test_basis_state_ket_minus,
        test_basis_state_ket_plus_i,
        test_basis_state_ket_minus_i,
        test_hadamard_gate_action,
        test_pauli_x_gate_action,
        test_t_gate_action_on_plus_state,
        test_bell_state_reduced_density_matrix,
    ]
    print("Running Phase 1 Mandatory Bloch Unit Tests...")
    for t in tests:
        t()
        print(f"  ✅ {t.__name__} PASSED")
    print("🎉 ALL PHASE 1 MANDATORY UNIT TESTS PASSED WITH 100% FIDELITY!")
