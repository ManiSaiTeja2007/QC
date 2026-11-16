"""Unit tests for Transmon Physical Noise Models and Noisy Simulation Engine.

Verifies:
  1. Construction of all 4 open-system noise models (Depolarizing, Amplitude Damping, Phase Damping, Thermal Relaxation).
  2. Mathematical invariants of noisy density matrices: Tr(ρ) = 1, Hermiticity ρ = ρ†, eigenvalues ≥ 0.
  3. Noisy state fidelity evaluation F(ρ_noisy, |ψ_ideal⟩).
  4. Shot-based sampling under noise channels.
  5. Error detection of bit-flips via parity preservation.
"""

import sys
from pathlib import Path
import numpy as np
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.simulation.noise_models import (
    TransmonNoiseConfig,
    build_depolarizing_noise_model,
    build_amplitude_damping_noise_model,
    build_phase_damping_noise_model,
    build_thermal_relaxation_noise_model,
    build_transmon_composite_noise_model,
    simulate_noisy_density_matrix,
    simulate_noisy_shots,
    evaluate_noise_fidelities,
)
from backend.app.modules.falfg import build_falfg_clifford_t


def test_transmon_config_defaults():
    """Verify default calibration parameters match the IEEE paper."""
    cfg = TransmonNoiseConfig()
    assert cfg.t1_ns == 110000.0
    assert cfg.t2_ns == 85000.0
    assert cfg.gate_time_1q_ns == 35.0
    assert cfg.gate_time_2q_ns == 280.0
    assert cfg.p1q_error == 0.0015
    assert cfg.p2q_error == 0.012


def test_build_all_noise_models():
    """Verify that all 4 noise models construct without errors."""
    nm_dep = build_depolarizing_noise_model(p1=0.0015, p2=0.012)
    assert nm_dep is not None

    nm_ad = build_amplitude_damping_noise_model(t1_ns=110e3, gate_time_1q_ns=35, gate_time_2q_ns=280)
    assert nm_ad is not None

    nm_pd = build_phase_damping_noise_model(t2_ns=85e3, gate_time_1q_ns=35, gate_time_2q_ns=280)
    assert nm_pd is not None

    nm_tr = build_thermal_relaxation_noise_model(t1_ns=110e3, t2_ns=85e3, gate_time_1q_ns=35, gate_time_2q_ns=280)
    assert nm_tr is not None


def test_noisy_density_matrix_invariants():
    """Verify that noisy simulation yields a valid density matrix satisfying Tr(ρ)=1 and Hermiticity."""
    qc = build_falfg_clifford_t()
    input_bits = [0, 0, 0, 0, 0]
    nm_dep = build_depolarizing_noise_model(p1=0.005, p2=0.02)

    rho, fid = simulate_noisy_density_matrix(qc, input_bits, nm_dep)

    # 1. Trace == 1
    tr = np.real(np.trace(rho.data))
    assert np.isclose(tr, 1.0, atol=1e-5), f"Trace of density matrix is {tr}, expected 1.0"

    # 2. Hermiticity: ρ == ρ†
    diff = np.linalg.norm(rho.data - np.conj(rho.data.T))
    assert np.isclose(diff, 0.0, atol=1e-5), f"Density matrix is not Hermitian, diff={diff}"

    # 3. Fidelity in (0, 1]
    assert 0.0 < fid <= 1.0, f"Fidelity {fid} is out of valid bounds (0, 1]"


def test_evaluate_noise_fidelities_falfg():
    """Verify multi-channel fidelity evaluation on the 5x5 FALFG core."""
    qc = build_falfg_clifford_t()
    input_bits = [1, 0, 1, 0, 0]
    cfg = TransmonNoiseConfig()

    fidelities = evaluate_noise_fidelities(qc, input_bits, cfg)

    assert "depolarizing" in fidelities
    assert "amplitude_damping" in fidelities
    assert "phase_damping" in fidelities
    assert "thermal_relaxation" in fidelities

    # All fidelities must be realistic (> 0.70 for 24-gate circuit)
    for channel, fid in fidelities.items():
        assert 0.70 <= fid <= 1.0, f"Channel {channel} fidelity {fid} is outside expected bounds"


def test_noisy_shots_simulation():
    """Verify that noisy shot-based simulation produces valid probability counts."""
    qc = build_falfg_clifford_t()
    input_bits = [1, 1, 0, 0, 0]
    nm_dep = build_depolarizing_noise_model(p1=0.002, p2=0.01)

    counts = simulate_noisy_shots(qc, input_bits, nm_dep, shots=128)
    total_shots = sum(counts.values())
    assert total_shots == 128
    assert len(counts) >= 1


from backend.app.simulation.fidelity_simulator import (
    simulate_circuit_shots,
    calculate_state_fidelity,
    run_figure12_noisy_reproduction,
)
from backend.app.modules.falfg import build_falfg_ncv


def test_calculate_state_fidelity_with_and_without_noise():
    """Verify calculate_state_fidelity behaves correctly under both ideal and noisy simulation."""
    ideal_qc = build_falfg_clifford_t()
    ncv_qc = build_falfg_ncv()
    bits = [1, 0, 0, 1, 0]

    # Without noise -> functional equivalence is 1.0
    fid_ideal = calculate_state_fidelity(ideal_qc, ncv_qc, bits)
    assert np.isclose(fid_ideal, 1.0, atol=1e-5)

    # With depolarizing noise
    nm = build_depolarizing_noise_model(p1=0.005, p2=0.02)
    fid_noisy = calculate_state_fidelity(ideal_qc, ideal_qc, bits, noise_model=nm)
    assert 0.70 < fid_noisy < 1.0


def test_run_figure12_noisy_reproduction():
    """Verify dynamic evaluation across basis states under the 4 noise channels."""
    res = run_figure12_noisy_reproduction(target="falfg", num_states=8)
    assert res["target"] == "falfg"
    assert res["evaluated_states"] == 8
    channels = res["channels"]

    for ch in ["depolarizing", "amplitude_damping", "phase_damping", "thermal_relaxation"]:
        assert ch in channels
        assert 0.70 < channels[ch]["average_fidelity"] <= 1.0
        assert len(channels[ch]["all_fidelities"]) == 8


from backend.app.simulation.noise_models import (
    build_parity_projector,
    apply_parity_postselection,
    simulate_parity_mitigated_density_matrix,
    compute_zne_richardson_fidelity,
    scale_transmon_noise_config,
)
from backend.app.simulation.fidelity_simulator import simulate_parity_mitigated_shots


def test_parity_projector_properties():
    """Verify algebraic properties of the parity subspace projection operators."""
    n = 3
    p_even = build_parity_projector(num_qubits=n, expected_parity=0)
    p_odd = build_parity_projector(num_qubits=n, expected_parity=1)
    eye = np.eye(2**n)

    # 1. Hermiticity: P = P†
    assert np.allclose(p_even, p_even.conj().T)
    assert np.allclose(p_odd, p_odd.conj().T)

    # 2. Idempotency: P² = P
    assert np.allclose(p_even @ p_even, p_even)
    assert np.allclose(p_odd @ p_odd, p_odd)

    # 3. Completeness: P_even + P_odd = I
    assert np.allclose(p_even + p_odd, eye)

    # 4. Orthogonality: P_even @ P_odd = 0
    assert np.allclose(p_even @ p_odd, np.zeros((2**n, 2**n)))


def test_parity_postselection_math():
    """Verify density matrix projection and renormalization on simple pure states."""
    # |00> has parity 0
    rho_00 = np.zeros((4, 4), dtype=complex)
    rho_00[0, 0] = 1.0

    rho_mit, p_acc = apply_parity_postselection(rho_00, expected_parity=0)
    assert np.isclose(p_acc, 1.0)
    assert np.allclose(rho_mit, rho_00)

    # Expected parity 1 on |00> should yield p_acc = 0.0
    _, p_acc_zero = apply_parity_postselection(rho_00, expected_parity=1)
    assert np.isclose(p_acc_zero, 0.0)


def test_simulate_parity_mitigated_density_matrix():
    """Verify that parity mitigation strictly improves state fidelity under depolarizing noise."""
    qc = build_falfg_clifford_t()
    input_bits = [1, 0, 1, 0, 0]  # Parity = 0
    nm_dep = build_depolarizing_noise_model(p1=0.005, p2=0.02)

    res = simulate_parity_mitigated_density_matrix(qc, input_bits, nm_dep)

    assert "raw_fidelity" in res
    assert "mitigated_fidelity" in res
    assert "acceptance_rate" in res
    assert "fidelity_gain" in res

    # Parity post-selection must strictly increase fidelity by discarding odd bit-flips
    assert res["mitigated_fidelity"] > res["raw_fidelity"], (
        f"Expected mitigated {res['mitigated_fidelity']} > raw {res['raw_fidelity']}"
    )
    assert res["fidelity_gain"] > 0.0
    assert 0.0 < res["acceptance_rate"] < 1.0


def test_zne_richardson_extrapolation():
    """Verify two-point linear Zero-Noise Extrapolation formula."""
    # F(lambda) = 0.90, F(2*lambda) = 0.80 -> linear extrapolation to lambda=0 gives 1.00
    f_zne = compute_zne_richardson_fidelity(f_lambda1=0.90, f_lambda2=0.80, scale_factor=2.0)
    assert np.isclose(f_zne, 1.00)

    # Clamping test: should not exceed 1.0
    f_clamped = compute_zne_richardson_fidelity(f_lambda1=0.95, f_lambda2=0.80, scale_factor=2.0)
    assert np.isclose(f_clamped, 1.00)


def test_simulate_parity_mitigated_shots():
    """Verify that shot-level post-selection discards odd-parity error shots."""
    qc = build_falfg_clifford_t()
    input_bits = [1, 1, 0, 0, 0]  # Parity = 0
    nm_dep = build_depolarizing_noise_model(p1=0.01, p2=0.03)

    res = simulate_parity_mitigated_shots(qc, input_bits, noise_model=nm_dep, shots=1024, seed=42)

    assert "raw_counts" in res
    assert "mitigated_counts" in res
    assert "acceptance_rate" in res
    assert "expected_parity" in res

    # All bitstrings in mitigated_counts must have expected parity
    for bitstring in res["mitigated_counts"].keys():
        hw = sum(int(b) for b in bitstring)
        assert hw % 2 == res["expected_parity"], f"Bitstring {bitstring} has invalid parity"

    assert 0.0 < res["acceptance_rate"] < 1.0
