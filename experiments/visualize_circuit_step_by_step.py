"""Generate Step-by-Step Visual Evolution & Bloch Sphere Trajectories.

Runs gate-by-gate tracking and exports trajectory diagrams and probability evolution
heatmaps for all core circuits in the paper:
  - Fredkin Gate (3 Qubits, 17 Gate Steps)
  - 5x5 FALFG Gate (5 Qubits, 20 Gate Steps)
  - 1-Bit ALU Full Adder Mode (7 Qubits, 28 Gate Steps)
  - 1-Bit ALU Full Subtractor Mode (7 Qubits, 28 Gate Steps)
  - Bennett's Uncomputed Adder/Subtractor (9 Qubits, 40 Gate Steps)
"""

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.gates.basic_gates import build_fredkin_circuit
from backend.app.modules.falfg import build_falfg_clifford_t
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t
from backend.app.modules.uncomputation import build_uncomputed_adder_subtractor
from backend.app.simulation.step_visualizer import (
    track_circuit_evolution,
    plot_bloch_trajectories,
    plot_step_probability_heatmap,
)


def run_all_step_visualizations():
    viz_dir = PROJECT_ROOT / "results" / "figures" / "visualizations"
    viz_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("GENERATING STEP-BY-STEP QUANTUM STATE VISUALIZATIONS & BLOCH TRAJECTORIES")
    print("=" * 80)

    circuits_to_visualize = [
        {
            "name": "Fredkin_CSWAP_Clifford_T",
            "qc": build_fredkin_circuit("clifford_t"),
            "input_bits": [1, 0, 1],  # A=1 (Control), B=0, C=1 -> Target swap
        },
        {
            "name": "5x5_FALFG_Full_Adder",
            "qc": build_falfg_clifford_t(),
            "input_bits": [1, 1, 1, 0, 0],  # A=1, B=1, Cin=1, Sel=0 (Adder), Mode=0
        },
        {
            "name": "1Bit_ALU_Full_Adder",
            "qc": build_one_bit_alu_clifford_t(),
            "input_bits": [1, 1, 1, 0, 1, 1, 0],  # A=1, B=1, Cin=1, S1=0, M=1, S2=1, S3=0
        },
        {
            "name": "1Bit_ALU_Full_Subtractor",
            "qc": build_one_bit_alu_clifford_t(),
            "input_bits": [1, 1, 1, 1, 1, 1, 0],  # A=1, B=1, Bin=1, S1=1, M=1, S2=1, S3=0
        },
        {
            "name": "Bennett_Uncomputed_Adder",
            "qc": build_uncomputed_adder_subtractor(),
            "input_bits": [1, 1, 1, 0, 0, 0, 0, 0, 0],  # 5 Inputs + 4 Ancillae
        },
    ]

    for item in circuits_to_visualize:
        c_name = item["name"]
        qc = item["qc"]
        in_bits = item["input_bits"]

        print(f"\n[TRACKING] Circuit: {c_name} ({qc.num_qubits} Qubits, {len(qc.data)} Gate Steps)")

        # Track gate-by-gate evolution
        ev_data = track_circuit_evolution(qc, in_bits)

        # Export 3D Bloch trajectory
        bloch_path = viz_dir / f"{c_name}_bloch_trajectories.png"
        plot_bloch_trajectories(ev_data, str(bloch_path))
        print(f"  [SAVED BLOCH TRAJECTORY] {bloch_path.name}")

        # Export step probability heatmap
        heatmap_path = viz_dir / f"{c_name}_probability_heatmap.png"
        plot_step_probability_heatmap(ev_data, str(heatmap_path))
        print(f"  [SAVED PROB HEATMAP]    {heatmap_path.name}")

    print("\n" + "=" * 80)
    print("ALL STEP-BY-STEP VISUALIZATIONS GENERATED SUCCESSFULLY!")
    print(f"Saved outputs to: {viz_dir}")
    print("=" * 80)


if __name__ == "__main__":
    run_all_step_visualizations()
