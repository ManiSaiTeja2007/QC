"""Transmon Physical Noise Models & Open-System Density Matrix Simulator.

Implements realistic superconducting transmon noise channels based on the
Lindblad master equation and Kraus operators matching the IEEE TETC 2026 paper:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU".

Supported Noise Channels:
  1. Depolarizing Channel: Gate infidelities (p1q, p2q).
  2. Amplitude Damping Channel: T1 energy relaxation (|1⟩ -> |0⟩).
  3. Phase Damping Channel: T2 pure dephasing.
  4. Thermal Relaxation Channel: Combined T1 and T2 relaxation with Boltzmann excitation.
  5. Composite Transmon Model: Hardware-calibrated noise profile for Falcon/Eagle transmons.
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple, Any, Optional
import numpy as np

from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit_aer.noise import (
    NoiseModel,
    depolarizing_error,
    amplitude_damping_error,
    phase_damping_error,
    thermal_relaxation_error,
)
from qiskit.quantum_info import state_fidelity, Statevector, DensityMatrix

# Standard single-qubit and two-qubit gate sets used across Clifford+T ALU
SINGLE_QUBIT_GATES = ["h", "t", "tdg", "s", "sdg", "x", "y", "z", "id"]
TWO_QUBIT_GATES = ["cx", "cz", "swap"]


@dataclass
class TransmonNoiseConfig:
    """Hardware calibration parameters for superconducting transmon qubits.

    Default values correspond to median operating parameters of IBM Falcon / early Eagle devices
    reported in the IEEE TETC 2026 paper:
      T1 = 110 µs, T2 = 85 µs, t_1q = 35 ns, t_2q = 280 ns,
      p1 = 0.0015, p2 = 0.012.
    """
    t1_ns: float = 110_000.0          # 110 µs
    t2_ns: float = 85_000.0           # 85 µs
    gate_time_1q_ns: float = 35.0     # 35 ns
    gate_time_2q_ns: float = 280.0    # 280 ns
    p1q_error: float = 0.0015         # 0.15% gate error
    p2q_error: float = 0.0120         # 1.20% two-qubit gate error


def build_depolarizing_noise_model(
    p1: float = 0.0015,
    p2: float = 0.0120,
    single_gates: Optional[List[str]] = None,
    two_gates: Optional[List[str]] = None,
) -> NoiseModel:
    """Constructs a depolarizing noise model modeling stochastic Pauli gate infidelities."""
    sg = single_gates or SINGLE_QUBIT_GATES
    tg = two_gates or TWO_QUBIT_GATES

    nm = NoiseModel()
    err_1q = depolarizing_error(p1, 1)
    err_2q = depolarizing_error(p2, 2)

    nm.add_all_qubit_quantum_error(err_1q, sg)
    nm.add_all_qubit_quantum_error(err_2q, tg)
    return nm


def build_amplitude_damping_noise_model(
    t1_ns: float = 110_000.0,
    gate_time_1q_ns: float = 35.0,
    gate_time_2q_ns: float = 280.0,
    single_gates: Optional[List[str]] = None,
    two_gates: Optional[List[str]] = None,
) -> NoiseModel:
    """Constructs an amplitude damping noise model modeling T1 energy relaxation."""
    sg = single_gates or SINGLE_QUBIT_GATES
    tg = two_gates or TWO_QUBIT_GATES

    # Decay probability gamma = 1 - exp(-t / T1)
    gamma_1q = float(1.0 - np.exp(-gate_time_1q_ns / max(t1_ns, 1e-6)))
    gamma_2q = float(1.0 - np.exp(-gate_time_2q_ns / max(t1_ns, 1e-6)))

    err_1q = amplitude_damping_error(gamma_1q)
    err_2q_single = amplitude_damping_error(gamma_2q)
    err_2q = err_2q_single.tensor(err_2q_single)

    nm = NoiseModel()
    nm.add_all_qubit_quantum_error(err_1q, sg)
    nm.add_all_qubit_quantum_error(err_2q, tg)
    return nm


def build_phase_damping_noise_model(
    t2_ns: float = 85_000.0,
    gate_time_1q_ns: float = 35.0,
    gate_time_2q_ns: float = 280.0,
    single_gates: Optional[List[str]] = None,
    two_gates: Optional[List[str]] = None,
) -> NoiseModel:
    """Constructs a phase damping noise model modeling pure T2 environmental dephasing."""
    sg = single_gates or SINGLE_QUBIT_GATES
    tg = two_gates or TWO_QUBIT_GATES

    # Dephasing parameter lambda = 1 - exp(-t / T2)
    lam_1q = float(1.0 - np.exp(-gate_time_1q_ns / max(t2_ns, 1e-6)))
    lam_2q = float(1.0 - np.exp(-gate_time_2q_ns / max(t2_ns, 1e-6)))

    err_1q = phase_damping_error(lam_1q)
    err_2q_single = phase_damping_error(lam_2q)
    err_2q = err_2q_single.tensor(err_2q_single)

    nm = NoiseModel()
    nm.add_all_qubit_quantum_error(err_1q, sg)
    nm.add_all_qubit_quantum_error(err_2q, tg)
    return nm


def build_thermal_relaxation_noise_model(
    t1_ns: float = 110_000.0,
    t2_ns: float = 85_000.0,
    gate_time_1q_ns: float = 35.0,
    gate_time_2q_ns: float = 280.0,
    single_gates: Optional[List[str]] = None,
    two_gates: Optional[List[str]] = None,
) -> NoiseModel:
    """Constructs a thermal relaxation noise model combining T1 decay and T2 dephasing."""
    sg = single_gates or SINGLE_QUBIT_GATES
    tg = two_gates or TWO_QUBIT_GATES

    # Thermal relaxation constraint: T2 <= 2*T1
    t2_clamped = min(t2_ns, 2.0 * t1_ns)

    err_1q = thermal_relaxation_error(t1_ns, t2_clamped, gate_time_1q_ns)
    err_2q_single = thermal_relaxation_error(t1_ns, t2_clamped, gate_time_2q_ns)
    err_2q = err_2q_single.tensor(err_2q_single)

    nm = NoiseModel()
    nm.add_all_qubit_quantum_error(err_1q, sg)
    nm.add_all_qubit_quantum_error(err_2q, tg)
    return nm


def build_transmon_composite_noise_model(config: Optional[TransmonNoiseConfig] = None) -> NoiseModel:
    """Builds a composite noise model containing depolarizing error and thermal relaxation."""
    cfg = config or TransmonNoiseConfig()
    nm = NoiseModel()

    t2_clamped = min(cfg.t2_ns, 2.0 * cfg.t1_ns)

    # 1Q: thermal relaxation + depolarizing
    therm_1q = thermal_relaxation_error(cfg.t1_ns, t2_clamped, cfg.gate_time_1q_ns)
    depol_1q = depolarizing_error(cfg.p1q_error, 1)
    err_1q = therm_1q.compose(depol_1q)

    # 2Q: thermal relaxation + depolarizing
    therm_2q_single = thermal_relaxation_error(cfg.t1_ns, t2_clamped, cfg.gate_time_2q_ns)
    therm_2q = therm_2q_single.tensor(therm_2q_single)
    depol_2q = depolarizing_error(cfg.p2q_error, 2)
    err_2q = therm_2q.compose(depol_2q)

    nm.add_all_qubit_quantum_error(err_1q, SINGLE_QUBIT_GATES)
    nm.add_all_qubit_quantum_error(err_2q, TWO_QUBIT_GATES)
    return nm


def simulate_noisy_density_matrix(
    qc: QuantumCircuit,
    input_bits: List[int],
    noise_model: NoiseModel,
) -> Tuple[DensityMatrix, float]:
    """Simulates a quantum circuit under open-system noise via density matrix formalism.

    Args:
        qc: QuantumCircuit under test.
        input_bits: Computational basis initialization bits for each qubit.
        noise_model: Qiskit Aer NoiseModel to apply.

    Returns:
        Tuple of (noisy_density_matrix, state_fidelity_against_ideal).
    """
    n = qc.num_qubits
    assert len(input_bits) == n, f"Input bits count ({len(input_bits)}) != qubit count ({n})"

    # 1. Build ideal state
    ideal_qc = QuantumCircuit(n)
    for q in range(n):
        if input_bits[q]:
            ideal_qc.x(q)
    ideal_qc.compose(qc, inplace=True)
    sv_ideal = Statevector.from_instruction(ideal_qc)

    # 2. Build noisy circuit with save_density_matrix instruction
    noisy_qc = ideal_qc.copy()
    noisy_qc.save_density_matrix()

    sim = AerSimulator(noise_model=noise_model, method="density_matrix")
    result = sim.run(noisy_qc).result()
    raw_rho = result.data()["density_matrix"]
    rho_noisy = DensityMatrix(raw_rho)

    # 3. State fidelity: F(rho, |psi⟩) = ⟨psi| rho |psi⟩
    fid = float(state_fidelity(sv_ideal, rho_noisy))
    return rho_noisy, fid


def simulate_noisy_shots(
    qc: QuantumCircuit,
    input_bits: List[int],
    noise_model: NoiseModel,
    shots: int = 256,
) -> Dict[str, int]:
    """Runs Monte Carlo shot sampling under physical noise, returning measurement counts."""
    n = qc.num_qubits
    test_qc = QuantumCircuit(n, n)
    for q in range(n):
        if input_bits[q]:
            test_qc.x(q)
    test_qc.compose(qc, inplace=True)
    test_qc.measure(range(n), range(n))

    sim = AerSimulator(noise_model=noise_model)
    result = sim.run(test_qc, shots=shots).result()
    counts = dict(result.get_counts())
    return counts


def evaluate_noise_fidelities(
    qc: QuantumCircuit,
    input_bits: List[int],
    config: Optional[TransmonNoiseConfig] = None,
) -> Dict[str, float]:
    """Evaluates circuit state fidelity across all 4 paper noise channels for a given input state."""
    cfg = config or TransmonNoiseConfig()

    models = {
        "depolarizing": build_depolarizing_noise_model(cfg.p1q_error, cfg.p2q_error),
        "amplitude_damping": build_amplitude_damping_noise_model(cfg.t1_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
        "phase_damping": build_phase_damping_noise_model(cfg.t2_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
        "thermal_relaxation": build_thermal_relaxation_noise_model(cfg.t1_ns, cfg.t2_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
    }

    fidelities = {}
    for name, nm in models.items():
        _, fid = simulate_noisy_density_matrix(qc, input_bits, nm)
        fidelities[name] = round(fid, 4)

    return fidelities



def build_parity_projector(num_qubits: int, expected_parity: int) -> np.ndarray:
    """Constructs the 2^n x 2^n diagonal parity subspace projector matrix.

    Projector:
      Pi_valid = 1/2 * (I + (-1)^p0 * Z^(⊗n))
    Diagonal entries are 1.0 for computational basis states |x⟩ where
    Hamming weight mod 2 == expected_parity, and 0.0 otherwise.
    """
    dim = 1 << num_qubits
    diag = np.zeros(dim, dtype=complex)
    exp_p = expected_parity % 2

    for i in range(dim):
        hw = bin(i).count("1")
        if hw % 2 == exp_p:
            diag[i] = 1.0 + 0.0j

    return np.diag(diag)


def apply_parity_postselection(
    rho: np.ndarray,
    expected_parity: int,
) -> Tuple[np.ndarray, float]:
    """Applies parity subspace projection and renormalization to density matrix rho.

    rho_mitigated = (Pi @ rho @ Pi) / Tr(Pi @ rho @ Pi)
    P_accept = Tr(Pi @ rho @ Pi)
    """
    dim = rho.shape[0]
    num_qubits = int(round(np.log2(dim)))
    pi_valid = build_parity_projector(num_qubits, expected_parity)

    rho_proj = pi_valid @ rho @ pi_valid
    p_accept = float(np.real(np.trace(rho_proj)))

    if p_accept > 1e-12:
        rho_mitigated = rho_proj / p_accept
    else:
        rho_mitigated = rho_proj

    return rho_mitigated, p_accept


def scale_transmon_noise_config(
    config: TransmonNoiseConfig,
    scale: float = 2.0,
) -> TransmonNoiseConfig:
    """Scales hardware noise parameters by factor scale for Zero-Noise Extrapolation (ZNE)."""
    return TransmonNoiseConfig(
        t1_ns=config.t1_ns,
        t2_ns=config.t2_ns,
        gate_time_1q_ns=config.gate_time_1q_ns * scale,
        gate_time_2q_ns=config.gate_time_2q_ns * scale,
        p1q_error=min(config.p1q_error * scale, 0.5),
        p2q_error=min(config.p2q_error * scale, 0.5),
    )


def compute_zne_richardson_fidelity(
    f_lambda1: float,
    f_lambda2: float,
    scale_factor: float = 2.0,
) -> float:
    """Computes Richardson two-point Zero-Noise Extrapolation:

    F_ZNE = (c * F(λ) - F(cλ)) / (c - 1)
    Clamped to [0.0, 1.0].
    """
    c = float(scale_factor)
    assert c > 1.0, f"Scale factor must be > 1.0, got {c}"
    f_zne = (c * f_lambda1 - f_lambda2) / (c - 1.0)
    return float(np.clip(f_zne, 0.0, 1.0))


def simulate_parity_mitigated_density_matrix(
    qc: QuantumCircuit,
    input_bits: List[int],
    noise_model: NoiseModel,
    scale_zne: bool = False,
    config: Optional[TransmonNoiseConfig] = None,
) -> Dict[str, float]:
    """Simulates noisy state evolution and applies parity-syndrome mitigation and optional ZNE.

    Returns:
      Dict with 'raw_fidelity', 'mitigated_fidelity', 'acceptance_rate', 'fidelity_gain',
      and optionally 'zne_fidelity'.
    """
    n = qc.num_qubits
    expected_parity = sum(input_bits) % 2

    # 1. Ideal reference statevector
    ideal_qc = QuantumCircuit(n)
    for q in range(n):
        if input_bits[q]:
            ideal_qc.x(q)
    ideal_qc.compose(qc, inplace=True)
    sv_ideal = Statevector.from_instruction(ideal_qc)

    # 2. Noisy density matrix
    noisy_qc = ideal_qc.copy()
    noisy_qc.save_density_matrix()

    sim = AerSimulator(noise_model=noise_model, method="density_matrix")
    raw_rho_data = sim.run(noisy_qc).result().data()["density_matrix"]
    raw_rho = np.array(raw_rho_data, dtype=complex)

    raw_fid = float(state_fidelity(sv_ideal, DensityMatrix(raw_rho)))

    # 3. Apply parity post-selection
    mit_rho, p_accept = apply_parity_postselection(raw_rho, expected_parity)
    mit_fid = float(state_fidelity(sv_ideal, DensityMatrix(mit_rho)))

    res: Dict[str, float] = {
        "raw_fidelity": round(raw_fid, 4),
        "mitigated_fidelity": round(mit_fid, 4),
        "acceptance_rate": round(p_accept, 4),
        "fidelity_gain": round(mit_fid - raw_fid, 4),
    }

    # 4. Optional ZNE extrapolation
    if scale_zne and config is not None:
        cfg_2x = scale_transmon_noise_config(config, scale=2.0)
        nm_2x = build_depolarizing_noise_model(cfg_2x.p1q_error, cfg_2x.p2q_error)
        sim_2x = AerSimulator(noise_model=nm_2x, method="density_matrix")
        raw_2x_data = sim_2x.run(noisy_qc).result().data()["density_matrix"]
        raw_2x = np.array(raw_2x_data, dtype=complex)
        mit_2x, _ = apply_parity_postselection(raw_2x, expected_parity)
        mit_2x_fid = float(state_fidelity(sv_ideal, DensityMatrix(mit_2x)))

        zne_fid = compute_zne_richardson_fidelity(mit_fid, mit_2x_fid, scale_factor=2.0)
        res["zne_fidelity"] = round(zne_fid, 4)

    return res
