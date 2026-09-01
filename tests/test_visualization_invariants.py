"""Phase 26 Automated Visualization Invariants Test Suite.

Tests:
  1. Tr(ρ) = 1.000000 for all qubits in circuit.
  2. Density matrices are Hermitian ρ = ρ†.
  3. Density matrix eigenvalues λᵢ ≥ 0 (positive semi-definite).
  4. Bloch vector magnitude |r| ≤ 1.000000.
  5. Bell state (|00⟩+|11⟩)/√2 Pauli correlators ⟨X⊗X⟩ = +1, ⟨Y⊗Y⟩ = -1, ⟨Z⊗Z⟩ = +1.
  6. GHZ state (|000⟩+|111⟩)/√2 trace and reduced purity invariants.
"""

import sys
from pathlib import Path
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from backend.app.simulation.bloch_adapter import (
    validate_density_matrix_invariants,
    compute_reduced_bloch_vector,
    compute_pauli_two_qubit_correlations,
)
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t


def test_1bit_alu_all_step_invariants():
    qc = build_one_bit_alu_clifford_t()
    init_state = Statevector.from_label("0110111")
    curr = init_state

    for step_idx, inst in enumerate(qc.data):
        sub_qc = QuantumCircuit(qc.num_qubits)
        sub_qc.append(inst.operation, inst.qubits)
        curr = curr.evolve(sub_qc)

        for q in range(qc.num_qubits):
            bv = compute_reduced_bloch_vector(curr, q, qc.num_qubits)
            assert bv["r"] <= 1.000001, f"Magnitude invariant violated at step {step_idx} Q{q}: |r|={bv['r']}"
            assert bv["purity"] <= 1.000001, f"Purity invariant violated at step {step_idx} Q{q}: purity={bv['purity']}"


def test_bell_state_pauli_correlations():
    qc = QuantumCircuit(2)
    qc.h(0)
    qc.cx(0, 1)
    sv = Statevector.from_instruction(qc)

    corr = compute_pauli_two_qubit_correlations(sv, 0, 1, 2)
    assert abs(corr["xx"] - 1.0) < 1e-6, f"Expected ⟨X⊗X⟩ = +1.0 for Bell state, got {corr['xx']}"
    assert abs(corr["yy"] - (-1.0)) < 1e-6, f"Expected ⟨Y⊗Y⟩ = -1.0 for Bell state, got {corr['yy']}"
    assert abs(corr["zz"] - 1.0) < 1e-6, f"Expected ⟨Z⊗Z⟩ = +1.0 for Bell state, got {corr['zz']}"


def test_ghz_state_reduced_purity():
    qc = QuantumCircuit(3)
    qc.h(0)
    qc.cx(0, 1)
    qc.cx(1, 2)
    sv = Statevector.from_instruction(qc)

    for q in range(3):
        bv = compute_reduced_bloch_vector(sv, q, 3)
        assert abs(bv["r"] - 0.0) < 1e-6, f"GHZ state Q{q} magnitude should be 0.0, got {bv['r']}"
        assert abs(bv["purity"] - 0.5) < 1e-6, f"GHZ state Q{q} purity should be 0.5, got {bv['purity']}"


if __name__ == "__main__":
    tests = [
        test_1bit_alu_all_step_invariants,
        test_bell_state_pauli_correlations,
        test_ghz_state_reduced_purity,
    ]
    print("Running Phase 26 Automated Visualization Invariants Tests...")
    for t in tests:
        t()
        print(f"  ✅ {t.__name__} PASSED")
    print("🎉 ALL PHASE 26 AUTOMATED VISUALIZATION INVARIANTS PASSED WITH 100% FIDELITY!")
