"""Step-by-Step Quantum Circuit Evolution and Bloch Sphere Visualizer.

Traverses any quantum circuit gate-by-gate or layer-by-layer to track and visualize:
  - Reduced density matrices and Bloch vectors (x, y, z) for every qubit at each step.
  - 3D Bloch sphere state trajectories showing quantum state evolution.
  - Computational basis probability distribution evolution.
  - Export of static trajectory charts, multi-step grid figures, and animated GIFs.
"""

from typing import Dict, List, Tuple, Any, Optional
import os
import numpy as np
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector, partial_trace

# Pauli matrices for Bloch vector computation
_SIGMA_X = np.array([[0, 1], [1, 0]], dtype=complex)
_SIGMA_Y = np.array([[0, -1j], [1j, 0]], dtype=complex)
_SIGMA_Z = np.array([[1, 0], [0, -1]], dtype=complex)


def get_qubit_bloch_vector(rho: np.ndarray) -> Tuple[float, float, float, float]:
    """Computes (x, y, z, purity) for a 2x2 reduced density matrix rho."""
    x = float(np.real(np.trace(rho @ _SIGMA_X)))
    y = float(np.real(np.trace(rho @ _SIGMA_Y)))
    z = float(np.real(np.trace(rho @ _SIGMA_Z)))
    purity = float(np.real(np.trace(rho @ rho)))
    return (x, y, z, purity)


def track_circuit_evolution(
    qc: QuantumCircuit,
    input_bits: List[int]
) -> Dict[str, Any]:
    """Traverses a quantum circuit gate-by-gate, recording statevector and Bloch vectors at each step.

    Args:
        qc: QuantumCircuit instance to simulate.
        input_bits: Initial computational basis state bits for each qubit.

    Returns:
        Dict containing step metadata, gate instructions, statevectors, and qubit Bloch vectors.
    """
    n_qubits = qc.num_qubits
    assert len(input_bits) == n_qubits, f"Expected {n_qubits} input bits, got {len(input_bits)}"

    # Build initial computational basis statevector
    init_label = "".join(str(b) for b in reversed(input_bits))
    current_state = Statevector.from_label(init_label)

    steps_data = []

    def record_step(step_idx: int, gate_info: Optional[Dict[str, Any]]):
        bloch_vecs = []
        purities = []
        for q in range(n_qubits):
            traced_out = [i for i in range(n_qubits) if i != q]
            rho_q = partial_trace(current_state, traced_out).data
            x, y, z, purity = get_qubit_bloch_vector(rho_q)
            bloch_vecs.append((x, y, z))
            purities.append(purity)

        probs = current_state.probabilities_dict()

        steps_data.append({
            "step": step_idx,
            "gate": gate_info,
            "statevector": current_state.copy(),
            "bloch_vectors": bloch_vecs,
            "purities": purities,
            "probabilities": probs,
        })

    # Record initial state (Step 0)
    record_step(0, gate_info=None)

    # Evolve gate-by-gate
    for step_idx, inst in enumerate(qc.data, start=1):
        sub_qc = QuantumCircuit(n_qubits)
        sub_qc.append(inst.operation, inst.qubits)
        current_state = current_state.evolve(sub_qc)

        qubit_indices = [qc.find_bit(q).index for q in inst.qubits]
        gate_info = {
            "name": inst.operation.name.upper(),
            "qubits": qubit_indices,
            "params": inst.operation.params,
        }
        record_step(step_idx, gate_info)

    return {
        "num_qubits": n_qubits,
        "total_steps": len(qc.data),
        "circuit_name": qc.name,
        "input_bits": input_bits,
        "steps": steps_data,
    }


def _draw_bloch_wireframe(ax: Axes3D):
    """Draws a 3D wireframe Bloch sphere on matplotlib 3D axis."""
    u = np.linspace(0, 2 * np.pi, 30)
    v = np.linspace(0, np.pi, 20)
    x = np.outer(np.cos(u), np.sin(v))
    y = np.outer(np.sin(u), np.sin(v))
    z = np.outer(np.ones(np.size(u)), np.cos(v))

    ax.plot_wireframe(x, y, z, color="gray", alpha=0.15, linewidth=0.5)
    # Equatorial and polar axes
    ax.plot([-1, 1], [0, 0], [0, 0], color="black", linestyle="--", alpha=0.3, lw=0.8)
    ax.plot([0, 0], [-1, 1], [0, 0], color="black", linestyle="--", alpha=0.3, lw=0.8)
    ax.plot([0, 0], [0, 0], [-1, 1], color="black", linestyle="--", alpha=0.3, lw=0.8)

    ax.text(0, 0, 1.15, "|0⟩ (+Z)", ha="center", fontsize=8)
    ax.text(0, 0, -1.25, "|1⟩ (-Z)", ha="center", fontsize=8)
    ax.text(1.15, 0, 0, "|+⟩ (+X)", ha="center", fontsize=7)
    ax.text(0, 1.15, 0, "|+i⟩ (+Y)", ha="center", fontsize=7)

    ax.set_xlim([-1.1, 1.1])
    ax.set_ylim([-1.1, 1.1])
    ax.set_zlim([-1.1, 1.1])
    ax.set_box_aspect([1, 1, 1])
    ax.axis("off")


def plot_bloch_trajectories(
    evolution_data: Dict[str, Any],
    output_path: str,
    title_prefix: str = ""
):
    """Plots 3D Bloch sphere trajectories showing qubit path evolution from step 0 to step N."""
    n_qubits = evolution_data["num_qubits"]
    steps = evolution_data["steps"]
    total_steps = evolution_data["total_steps"]
    c_name = evolution_data["circuit_name"]
    in_bits = evolution_data["input_bits"]

    # Colors for different qubits
    palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22"]

    n_cols = min(n_qubits, 4)
    n_rows = (n_qubits + n_cols - 1) // n_cols

    fig = plt.figure(figsize=(4 * n_cols, 4 * n_rows))

    for q in range(n_qubits):
        ax = fig.add_subplot(n_rows, n_cols, q + 1, projection="3d")
        _draw_bloch_wireframe(ax)

        # Extract trajectory for qubit q
        xs = [s["bloch_vectors"][q][0] for s in steps]
        ys = [s["bloch_vectors"][q][1] for s in steps]
        zs = [s["bloch_vectors"][q][2] for s in steps]

        color = palette[q % len(palette)]

        # Plot path line
        ax.plot(xs, ys, zs, color=color, linestyle="-", lw=1.5, alpha=0.7, label=f"Qubit {q} Trajectory")

        # Plot step points
        ax.scatter(xs, ys, zs, color=color, s=20, alpha=0.6)

        # Initial point (Step 0)
        ax.scatter([xs[0]], [ys[0]], [zs[0]], color="green", s=80, marker="o", edgecolors="black", label="Start (Step 0)")

        # Final point (Step N)
        ax.scatter([xs[-1]], [ys[-1]], [zs[-1]], color="red", s=90, marker="*", edgecolors="black", label=f"End (Step {total_steps})")

        ax.set_title(f"Qubit {q} (Init: {in_bits[q]})", fontsize=10, fontweight="bold")

    fig.suptitle(
        f"{title_prefix}{c_name} — Qubit Trajectories across {total_steps} Gate Steps\nInputs: A, B, Cin... = {in_bits}",
        fontsize=12,
        fontweight="bold"
    )
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)


def plot_step_probability_heatmap(
    evolution_data: Dict[str, Any],
    output_path: str
):
    """Plots probability matrix heatmap showing how state probabilities evolve across all steps."""
    steps = evolution_data["steps"]
    n_qubits = evolution_data["num_qubits"]
    total_steps = evolution_data["total_steps"]

    n_states = 1 << n_qubits
    prob_matrix = np.zeros((n_states, len(steps)))

    labels = [format(i, f"0{n_qubits}b") for i in range(n_states)]

    for s_idx, s in enumerate(steps):
        for state_str, p in s["probabilities"].items():
            dec = int(state_str, 2)
            prob_matrix[dec, s_idx] = p

    fig, ax = plt.subplots(figsize=(max(8, len(steps) * 0.4), min(12, n_states * 0.3)))
    cax = ax.imshow(prob_matrix, aspect="auto", cmap="viridis", interpolation="none")
    fig.colorbar(cax, label="Probability")

    ax.set_yticks(range(n_states))
    ax.set_yticklabels(labels, fontsize=8)
    ax.set_xticks(range(len(steps)))

    step_labels = ["Init"] + [f"S{i}:{s['gate']['name']}" if s["gate"] else f"S{i}" for i, s in enumerate(steps[1:], 1)]
    ax.set_xticklabels(step_labels, rotation=90, fontsize=7)

    ax.set_ylabel("Computational Basis State |q_n...q_0⟩", fontsize=10)
    ax.set_xlabel("Gate Step Sequence", fontsize=10)
    ax.set_title(f"Quantum State Probability Evolution: {evolution_data['circuit_name']}", fontsize=12, fontweight="bold")

    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
