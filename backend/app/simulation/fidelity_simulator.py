"""Fidelity and Histogram Simulation Engine (Replicating Paper Figures 11 & 12).

Simulates the proposed ALU on the Qiskit Aer simulator with sampling (shots=256)
and calculates state fidelities under both ideal unitary evolution and physical
transmon noise models (Depolarizing, Amplitude Damping, Phase Damping, Thermal Relaxation).
"""

from typing import Dict, List, Any, Tuple, Optional
import numpy as np
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel
from qiskit.quantum_info import state_fidelity, Statevector, DensityMatrix

from backend.app.modules.falfg import build_falfg_clifford_t, build_falfg_ncv
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t, build_one_bit_alu_ncv
from backend.app.simulation.noise_models import (
    TransmonNoiseConfig,
    build_depolarizing_noise_model,
    build_amplitude_damping_noise_model,
    build_phase_damping_noise_model,
    build_thermal_relaxation_noise_model,
    simulate_noisy_density_matrix,
    simulate_parity_mitigated_density_matrix,
)


def simulate_circuit_shots(
    qc: QuantumCircuit,
    input_bits: List[int],
    shots: int = 256,
    noise_model: Optional[NoiseModel] = None,
) -> Dict[str, int]:
    """Runs a shot-based simulation on the Qiskit Aer simulator and returns count histogram.

    Supports optional physical noise injection via Qiskit Aer NoiseModel.
    """
    n = qc.num_qubits
    test_qc = QuantumCircuit(n, n)
    for q in range(n):
        if input_bits[q]:
            test_qc.x(q)
    test_qc.compose(qc, inplace=True)
    test_qc.measure(range(n), range(n))

    sim = AerSimulator(noise_model=noise_model) if noise_model else AerSimulator()
    result = sim.run(test_qc, shots=shots).result()
    counts = dict(result.get_counts())
    return counts


def calculate_state_fidelity(
    ideal_qc: QuantumCircuit,
    test_qc: QuantumCircuit,
    input_bits: List[int],
    noise_model: Optional[NoiseModel] = None,
) -> float:
    """Calculates quantum state fidelity between ideal state and simulated state.

    If noise_model is provided, performs open-system density matrix simulation.
    Otherwise, evaluates pure statevector overlap.
    """
    n = ideal_qc.num_qubits
    circ1 = QuantumCircuit(n)
    for q in range(n):
        if input_bits[q]:
            circ1.x(q)
    circ1.compose(ideal_qc, inplace=True)
    sv_ideal = Statevector.from_instruction(circ1)

    if noise_model is not None:
        circ2 = QuantumCircuit(n)
        for q in range(n):
            if input_bits[q]:
                circ2.x(q)
        circ2.compose(test_qc, inplace=True)
        circ2.save_density_matrix()

        sim = AerSimulator(noise_model=noise_model, method="density_matrix")
        res = sim.run(circ2).result()
        rho_noisy = DensityMatrix(res.data()["density_matrix"])
        return float(state_fidelity(sv_ideal, rho_noisy))

    circ2 = QuantumCircuit(n)
    for q in range(n):
        if input_bits[q]:
            circ2.x(q)
    circ2.compose(test_qc, inplace=True)
    sv_test = Statevector.from_instruction(circ2)
    return float(state_fidelity(sv_ideal, sv_test))


def run_figure11_reproduction(
    shots: int = 256,
    noise_model: Optional[NoiseModel] = None,
) -> Dict[str, Any]:
    """Replicates Figure 11: Histogram of output patterns per 256 shots for 16 test input values.

    Args:
        shots: Number of Monte Carlo shots per pattern.
        noise_model: Optional physical NoiseModel (e.g. depolarizing channel).
    """
    alu_qc = build_one_bit_alu_clifford_t()
    histograms = {}

    # Sample 16 diverse input patterns across logic and arithmetic modes
    test_patterns = [
        # (A, B, S0, S1, M, S2, S3)
        [0, 0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0, 0],  # AND
        [1, 0, 1, 0, 0, 0, 0],  # OR
        [1, 1, 0, 0, 0, 1, 0],  # XOR
        [0, 1, 0, 1, 0, 0, 1],  # NOR
        [1, 1, 1, 1, 0, 0, 1],  # NAND
        [1, 0, 0, 0, 0, 1, 1],  # Transfer B
        [1, 0, 0, 1, 0, 1, 1],  # Complement B
        [0, 1, 0, 0, 1, 1, 0],  # Half Adder (Sum=1, Cout=0)
        [1, 1, 0, 0, 1, 1, 0],  # Half Adder (Sum=0, Cout=1)
        [1, 1, 1, 0, 1, 1, 0],  # Full Adder (Sum=1, Cout=1)
        [0, 1, 1, 1, 1, 1, 0],  # Full Subtractor (Diff=0, Bout=1)
        [1, 0, 1, 0, 1, 1, 0],  # Increment A
        [0, 0, 1, 1, 1, 1, 0],  # Decrement A
        [1, 0, 0, 0, 1, 1, 1],  # Set
        [1, 0, 0, 1, 1, 1, 1],  # Reset
    ]

    for idx, pattern in enumerate(test_patterns):
        counts = simulate_circuit_shots(alu_qc, pattern, shots=shots, noise_model=noise_model)
        histograms[f"Test_{idx+1}_in_{pattern}"] = counts

    return histograms


def run_figure12_reproduction() -> Dict[str, float]:
    """Replicates Figure 12: Average state fidelity evaluation over all 128 input states under ideal unitary evolution."""
    ideal_alu = build_one_bit_alu_clifford_t()
    ncv_alu = build_one_bit_alu_ncv()

    fidelities = []
    for in_dec in range(128):
        bits = [(in_dec >> i) & 1 for i in range(7)]
        fid = calculate_state_fidelity(ideal_alu, ncv_alu, bits)
        fidelities.append(fid)

    avg_fidelity = float(np.mean(fidelities))
    min_fidelity = float(np.min(fidelities))

    return {
        "num_states": 128,
        "average_fidelity": avg_fidelity,
        "min_fidelity": min_fidelity,
        "all_perfect": bool(avg_fidelity >= 0.9999),
    }


def run_figure12_noisy_reproduction(
    target: str = "falfg",
    num_states: Optional[int] = None,
    config: Optional[TransmonNoiseConfig] = None,
) -> Dict[str, Any]:
    """Dynamically evaluates state fidelity across computational basis states under all 4 transmon noise channels.

    Args:
        target: 'falfg' (5 qubits, 32 states) or '1_bit_alu' (7 qubits, 128 states).
        num_states: Number of states to evaluate (defaults to all basis states: 32 for FALFG, 16 sample or 128 for ALU).
        config: Hardware calibration config for transmons.

    Returns:
        Dict with average and min fidelities for depolarizing, amplitude damping, phase damping, and thermal relaxation.
    """
    cfg = config or TransmonNoiseConfig()
    if target == "falfg":
        qc = build_falfg_clifford_t()
        n = 5
        max_states = 32
    else:
        qc = build_one_bit_alu_clifford_t()
        n = 7
        max_states = 128

    eval_states = min(num_states or max_states, max_states)

    noise_models = {
        "depolarizing": build_depolarizing_noise_model(cfg.p1q_error, cfg.p2q_error),
        "amplitude_damping": build_amplitude_damping_noise_model(cfg.t1_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
        "phase_damping": build_phase_damping_noise_model(cfg.t2_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
        "thermal_relaxation": build_thermal_relaxation_noise_model(cfg.t1_ns, cfg.t2_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
    }

    results: Dict[str, Any] = {
        "target": target,
        "num_qubits": n,
        "evaluated_states": eval_states,
        "channels": {},
    }

    for ch_name, nm in noise_models.items():
        fids = []
        for state_idx in range(eval_states):
            bits = [(state_idx >> b) & 1 for b in range(n)]
            _, fid = simulate_noisy_density_matrix(qc, bits, nm)
            fids.append(fid)

        results["channels"][ch_name] = {
            "average_fidelity": float(np.mean(fids)),
            "min_fidelity": float(np.min(fids)),
            "max_fidelity": float(np.max(fids)),
            "all_fidelities": [round(f, 4) for f in fids],
        }

    return results



def simulate_parity_mitigated_shots(
    qc: QuantumCircuit,
    input_bits: List[int],
    noise_model: Optional[NoiseModel] = None,
    shots: int = 4096,
    seed: Optional[int] = 42,
) -> Dict[str, Any]:
    """Runs noisy Monte Carlo sampling and applies shot-level parity post-selection filtering.

    Discards shots where measurement bitstring Hamming weight mod 2 != expected parity.
    """
    n = qc.num_qubits
    expected_parity = sum(input_bits) % 2

    # Measure circuit
    test_qc = QuantumCircuit(n, n)
    for q in range(n):
        if input_bits[q]:
            test_qc.x(q)
    test_qc.compose(qc, inplace=True)
    test_qc.measure(range(n), range(n))

    sim = AerSimulator(noise_model=noise_model, seed_simulator=seed) if noise_model else AerSimulator(seed_simulator=seed)
    result = sim.run(test_qc, shots=shots).result()
    raw_counts = dict(result.get_counts())

    mitigated_counts: Dict[str, int] = {}
    accepted_shots = 0

    for bitstr, count in raw_counts.items():
        hw = sum(int(b) for b in bitstr)
        if hw % 2 == expected_parity:
            mitigated_counts[bitstr] = count
            accepted_shots += count

    acceptance_rate = float(accepted_shots / max(shots, 1))

    return {
        "expected_parity": expected_parity,
        "total_shots": shots,
        "accepted_shots": accepted_shots,
        "acceptance_rate": round(acceptance_rate, 4),
        "raw_counts": raw_counts,
        "mitigated_counts": mitigated_counts,
    }


def run_figure12_mitigated_comparison(
    target: str = "falfg",
    num_states: Optional[int] = None,
    config: Optional[TransmonNoiseConfig] = None,
) -> Dict[str, Any]:
    """Evaluates Raw vs Parity-Mitigated vs Parity+ZNE fidelity across basis states under the 4 transmon noise channels."""
    cfg = config or TransmonNoiseConfig()
    if target == "falfg":
        qc = build_falfg_clifford_t()
        n = 5
        max_states = 32
    else:
        qc = build_one_bit_alu_clifford_t()
        n = 7
        max_states = 128

    eval_states = min(num_states or max_states, max_states)

    noise_models = {
        "depolarizing": build_depolarizing_noise_model(cfg.p1q_error, cfg.p2q_error),
        "amplitude_damping": build_amplitude_damping_noise_model(cfg.t1_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
        "phase_damping": build_phase_damping_noise_model(cfg.t2_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
        "thermal_relaxation": build_thermal_relaxation_noise_model(cfg.t1_ns, cfg.t2_ns, cfg.gate_time_1q_ns, cfg.gate_time_2q_ns),
    }

    results: Dict[str, Any] = {
        "target": target,
        "num_qubits": n,
        "evaluated_states": eval_states,
        "channels": {},
    }

    for ch_name, nm in noise_models.items():
        raw_fids = []
        mit_fids = []
        acc_rates = []
        zne_fids = []

        for state_idx in range(eval_states):
            bits = [(state_idx >> b) & 1 for b in range(n)]
            mit_res = simulate_parity_mitigated_density_matrix(qc, bits, nm, scale_zne=True, config=cfg)
            raw_fids.append(mit_res["raw_fidelity"])
            mit_fids.append(mit_res["mitigated_fidelity"])
            acc_rates.append(mit_res["acceptance_rate"])
            if "zne_fidelity" in mit_res:
                zne_fids.append(mit_res["zne_fidelity"])

        results["channels"][ch_name] = {
            "raw_average_fidelity": float(np.mean(raw_fids)),
            "mitigated_average_fidelity": float(np.mean(mit_fids)),
            "average_acceptance_rate": float(np.mean(acc_rates)),
            "average_zne_fidelity": float(np.mean(zne_fids)) if zne_fids else None,
            "raw_fidelities": raw_fids,
            "mitigated_fidelities": mit_fids,
        }

    return results
