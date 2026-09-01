"""Bloch State Adapter, Density Matrix Validation & Physics Engine (Phases 15 - 29).

IEEE TETC 2026 Paper Replication & Interactive Quantum Circuit Workbench:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"

Provides:
  1. Exact single-qubit & reduced density matrix Bloch vector extraction.
  2. Mathematical invariants validation: Tr(ρ)=1, Hermiticity ρ=ρ†, eigenvalues λᵢ ≥ 0, |r| ≤ 1.
  3. Two-qubit Pauli correlators: ⟨X⊗X⟩, ⟨Y⊗Y⟩, ⟨Z⊗Z⟩ for pair entanglement analysis.
  4. Deterministic physics explanation generator for gate transformations.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np
from qiskit.quantum_info import Statevector, partial_trace

# Pauli matrices
_SIGMA_I = np.eye(2, dtype=complex)
_SIGMA_X = np.array([[0, 1], [1, 0]], dtype=complex)
_SIGMA_Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
_SIGMA_Z = np.array([[1, 0], [0, -1]], dtype=complex)


def state_to_bloch_vector(alpha: complex, beta: complex, tol: float = 1e-12) -> Tuple[float, float, float, float]:
    """Computes Bloch vector (x, y, z, r) for a normalized single-qubit state |ψ⟩ = α|0⟩ + β|1⟩."""
    norm_sq = abs(alpha)**2 + abs(beta)**2
    assert abs(norm_sq - 1.0) < 1e-5, f"Statevector is not normalized: |α|²+|β|² = {norm_sq}"

    alpha_conj = np.conj(alpha)
    prod = alpha_conj * beta

    x = float(2.0 * np.real(prod))
    y = float(2.0 * np.imag(prod))
    z = float(abs(alpha)**2 - abs(beta)**2)

    if abs(x) < tol: x = 0.0
    if abs(y) < tol: y = 0.0
    if abs(z) < tol: z = 0.0

    r = float(np.sqrt(x**2 + y**2 + z**2))
    return (x, y, z, r)


def validate_density_matrix_invariants(rho: np.ndarray, tol: float = 1e-6) -> Dict[str, Any]:
    """Validates mathematical invariants for density matrix ρ:
      1. Tr(ρ) = 1
      2. Hermiticity: ρ = ρ†
      3. Positive semi-definite eigenvalues λᵢ ≥ 0
      4. Purity = Tr(ρ²) ≤ 1
    """
    tr = float(np.real(np.trace(rho)))
    is_trace_one = abs(tr - 1.0) < tol

    herm_diff = float(np.linalg.norm(rho - np.conj(rho.T)))
    is_hermitian = herm_diff < tol

    eigvals = np.linalg.eigvalsh(rho)
    min_eigval = float(np.min(eigvals))
    is_positive_semidefinite = min_eigval >= -tol

    purity = float(np.real(np.trace(rho @ rho)))
    is_valid_purity = purity <= 1.0 + tol

    return {
        "trace": tr,
        "is_trace_one": is_trace_one,
        "hermitian_diff": herm_diff,
        "is_hermitian": is_hermitian,
        "min_eigenvalue": min_eigval,
        "is_positive_semidefinite": is_positive_semidefinite,
        "purity": purity,
        "is_valid_purity": is_valid_purity,
        "is_all_valid": is_trace_one and is_hermitian and is_positive_semidefinite and is_valid_purity,
    }


def compute_reduced_bloch_vector(
    current_state: Statevector,
    qubit_idx: int,
    num_qubits: int,
    tol: float = 1e-12
) -> Dict[str, Any]:
    """Computes reduced density matrix ρ_q = Tr_{bar{q}}(|ψ⟩⟨ψ|) for qubit_idx and extracts its Bloch vector."""
    traced_out = [i for i in range(num_qubits) if i != qubit_idx]
    rho_q = partial_trace(current_state, traced_out).data

    # Mathematical Invariants Check
    inv_check = validate_density_matrix_invariants(rho_q)
    assert inv_check["is_all_valid"], f"Density matrix invariants violated for Q{qubit_idx}: {inv_check}"

    # Extract Bloch components via Tr(ρ σ)
    x = float(np.real(np.trace(rho_q @ _SIGMA_X)))
    y = float(np.real(np.trace(rho_q @ _SIGMA_Y)))
    z = float(np.real(np.trace(rho_q @ _SIGMA_Z)))
    purity = inv_check["purity"]

    if abs(x) < tol: x = 0.0
    if abs(y) < tol: y = 0.0
    if abs(z) < tol: z = 0.0

    r = float(np.sqrt(x**2 + y**2 + z**2))

    # Spherical angles
    theta_rad = float(np.arccos(np.clip(z / r if r > 1e-7 else 1.0, -1.0, 1.0)))
    phi_rad = float(np.arctan2(y, x))

    theta_deg = float(np.degrees(theta_rad))
    phi_deg = float(np.degrees(phi_rad))

    # State classification
    if r < 0.1:
        state_label = "Maximally Mixed (Entangled)"
    elif r < 0.95:
        state_label = "Partially Mixed (Entangled)"
    elif abs(z - 1.0) < 1e-4:
        state_label = "|0⟩"
    elif abs(z + 1.0) < 1e-4:
        state_label = "|1⟩"
    elif abs(x - 1.0) < 1e-4:
        state_label = "|+⟩"
    elif abs(x + 1.0) < 1e-4:
        state_label = "|-⟩"
    elif abs(y - 1.0) < 1e-4:
        state_label = "|+i⟩"
    elif abs(y + 1.0) < 1e-4:
        state_label = "|-i⟩"
    else:
        state_label = "Pure State"

    return {
        "qubit_idx": qubit_idx,
        "x": x,
        "y": y,
        "z": z,
        "r": r,
        "purity": purity,
        "theta_deg": theta_deg,
        "phi_deg": phi_deg,
        "state_label": state_label,
        "rho_00": complex(rho_q[0, 0]),
        "rho_11": complex(rho_q[1, 1]),
        "rho_01": complex(rho_q[0, 1]),
    }


def compute_pauli_two_qubit_correlations(
    current_state: Statevector,
    q1: int,
    q2: int,
    num_qubits: int
) -> Dict[str, float]:
    """Computes Pauli expectation values ⟨X⊗X⟩, ⟨Y⊗Y⟩, ⟨Z⊗Z⟩ for qubit pair (q1, q2)."""
    assert q1 != q2, "q1 and q2 must be distinct qubits"
    traced_out = [i for i in range(num_qubits) if i not in (q1, q2)]
    rho_12 = partial_trace(current_state, traced_out).data

    # Qiskit qubit ordering: q1 is LSB, q2 is MSB in 4x4 matrix
    xx = float(np.real(np.trace(rho_12 @ np.kron(_SIGMA_X, _SIGMA_X))))
    yy = float(np.real(np.trace(rho_12 @ np.kron(_SIGMA_Y, _SIGMA_Y))))
    zz = float(np.real(np.trace(rho_12 @ np.kron(_SIGMA_Z, _SIGMA_Z))))

    return {"xx": xx, "yy": yy, "zz": zz}
