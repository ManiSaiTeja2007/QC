"""Fidelity and Histogram Simulation Engine (Replicating Paper Figures 11 & 12).

Simulates the proposed ALU on the Qiskit Aer simulator with sampling (shots=256)
and calculates state fidelities to verify operational accuracy.
"""

from typing import Dict, List, Any, Tuple
import numpy as np
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
from qiskit.quantum_info import state_fidelity, Statevector

from backend.app.modules.falfg import build_falfg_clifford_t, build_falfg_ncv
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t, build_one_bit_alu_ncv


def simulate_circuit_shots(
    qc: QuantumCircuit,
    input_bits: List[int],
    shots: int = 256
) -> Dict[str, int]:
    """Runs a shot-based simulation on the Qiskit Aer simulator and returns count histogram."""
    n = qc.num_qubits
    test_qc = QuantumCircuit(n, n)
    for q in range(n):
        if input_bits[q]:
            test_qc.x(q)
    test_qc.compose(qc, inplace=True)
    test_qc.measure(range(n), range(n))

    sim = AerSimulator()
    result = sim.run(test_qc, shots=shots).result()
    counts = result.get_counts()
    return counts


def calculate_state_fidelity(
    ideal_qc: QuantumCircuit,
    test_qc: QuantumCircuit,
    input_bits: List[int]
) -> float:
    """Calculates quantum state fidelity between ideal state and simulated state."""
    n = ideal_qc.num_qubits
    circ1 = QuantumCircuit(n)
    circ2 = QuantumCircuit(n)

    for q in range(n):
        if input_bits[q]:
            circ1.x(q)
            circ2.x(q)

    circ1.compose(ideal_qc, inplace=True)
    circ2.compose(test_qc, inplace=True)

    sv1 = Statevector.from_instruction(circ1)
    sv2 = Statevector.from_instruction(circ2)

    return float(state_fidelity(sv1, sv2))


def run_figure11_reproduction(shots: int = 256) -> Dict[str, Any]:
    """Replicates Figure 11: Histogram of output patterns per 256 shots for 16 test input values."""
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
        counts = simulate_circuit_shots(alu_qc, pattern, shots=shots)
        histograms[f"Test_{idx+1}_in_{pattern}"] = counts

    return histograms


def run_figure12_reproduction() -> Dict[str, float]:
    """Replicates Figure 12: Average state fidelity evaluation over all 128 input states."""
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
