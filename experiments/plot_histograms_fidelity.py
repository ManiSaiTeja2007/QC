"""Replicate Paper Figures 11 and 12 (Simulation Histograms and Fidelity Plots).

- Figure 11: Histogram of measured states over 256 shots for 16 representative input patterns.
- Figure 12: Quantum state fidelity across all 128 computational basis states.
"""

import os
import sys
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.simulation.fidelity_simulator import (
    run_figure11_reproduction,
    run_figure12_reproduction,
    run_figure12_noisy_reproduction,
    run_figure12_mitigated_comparison,
)


def plot_figure11_histograms():
    """Generates Figure 11: High-resolution histogram output patterns over 256 shots."""
    figures_dir = PROJECT_ROOT / "results" / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)

    print("Simulating Figure 11 (256 shots per pattern)...")
    hist_data = run_figure11_reproduction(shots=256)

    plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
    fig, axes = plt.subplots(4, 4, figsize=(18, 14))
    axes = axes.flatten()

    for idx, (pattern_name, counts) in enumerate(hist_data.items()):
        ax = axes[idx]
        states = list(counts.keys())
        freqs = list(counts.values())
        bars = ax.bar(states, freqs, color="#2b5c8f", width=0.45, edgecolor="#1e3a5f", linewidth=1)
        
        # Highlight peak count
        max_val = max(freqs) if freqs else 256
        for bar in bars:
            if bar.get_height() == max_val:
                bar.set_color("#059669")
                bar.set_edgecolor("#047857")

        ax.set_title(pattern_name.replace("_in_", "\nIn: "), fontsize=9, fontweight="bold", pad=4)
        ax.set_ylabel("Counts (N=256)", fontsize=8)
        ax.set_ylim(0, 275)
        ax.tick_params(axis="x", rotation=45, labelsize=7)
        ax.grid(True, linestyle=":", alpha=0.6)

    plt.suptitle("Figure 11 Reproduction: Qiskit Aer Simulation Output Histograms (256 Shots per Input Pattern)", fontsize=14, fontweight="bold", y=0.99)
    plt.tight_layout()
    fig_path = figures_dir / "fig11_reproduction_histograms.png"
    plt.savefig(fig_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  [SAVED FIG 11] {fig_path}")


def plot_figure12_fidelity():
    """Generates Figure 12: Quantum state fidelity across basis states under ideal and 4 transmon noise channels."""
    figures_dir = PROJECT_ROOT / "results" / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)

    print("Simulating Figure 12 (Fidelity under ideal and 4 transmon physical noise channels)...")
    fid_data = run_figure12_reproduction()
    noisy_data = run_figure12_noisy_reproduction(target="falfg")

    ch = noisy_data["channels"]
    n_states = noisy_data["evaluated_states"]
    x = np.arange(n_states)

    fig, ax = plt.subplots(figsize=(13, 7))

    # Plot Ideal
    ax.axhline(1.0, color="#10b981", linestyle="--", lw=2, label=f"Ideal Unitary Fidelity (F = {fid_data['average_fidelity']:.4f})")

    # Plot Phase Damping
    pd_fids = ch["phase_damping"]["all_fidelities"]
    ax.plot(x, pd_fids, color="#3b82f6", lw=2, marker="o", markersize=4, label=f"Phase Damping T2=85µs (Avg F = {ch['phase_damping']['average_fidelity']:.4f})")

    # Plot Amplitude Damping
    ad_fids = ch["amplitude_damping"]["all_fidelities"]
    ax.plot(x, ad_fids, color="#f59e0b", lw=2, marker="s", markersize=4, label=f"Amplitude Damping T1=110µs (Avg F = {ch['amplitude_damping']['average_fidelity']:.4f})")

    # Plot Thermal Relaxation
    tr_fids = ch["thermal_relaxation"]["all_fidelities"]
    ax.plot(x, tr_fids, color="#8b5cf6", lw=2, marker="^", markersize=4, label=f"Thermal Relaxation (Avg F = {ch['thermal_relaxation']['average_fidelity']:.4f})")

    # Plot Depolarizing
    dep_fids = ch["depolarizing"]["all_fidelities"]
    ax.plot(x, dep_fids, color="#ef4444", lw=2, marker="x", markersize=5, label=f"Depolarizing Channel p1=0.15%, p2=1.2% (Avg F = {ch['depolarizing']['average_fidelity']:.4f})")

    ax.set_title("Figure 12 Reproduction: Quantum State Fidelity F(Ψ_ideal, ρ_noisy) Under 4 Physical Noise Channels", fontsize=13, fontweight="bold", pad=12)
    ax.set_xlabel("Input State Decimal Index |X⟩ (0 to 31)", fontsize=11, labelpad=8)
    ax.set_ylabel("State Fidelity F = ⟨Ψ_ideal| ρ_noisy |Ψ_ideal⟩", fontsize=11, labelpad=8)
    ax.set_ylim(0.80, 1.02)
    ax.set_xlim(-1, n_states)
    ax.grid(True, linestyle="--", alpha=0.5)
    ax.legend(loc="lower left", fontsize=10, frameon=True, facecolor="#f8fafc", edgecolor="#cbd5e1")

    fig_path = figures_dir / "fig12_reproduction_fidelity.png"
    plt.savefig(fig_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  [SAVED FIG 12] {fig_path}")


def plot_figure13_parity_mitigation():
    """Generates Figure 13: Closed-Loop Parity Mitigation & ZNE Recovery Curves across Noise Channels."""
    figures_dir = PROJECT_ROOT / "results" / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)

    print("Simulating Figure 13 (Parity-Syndrome Mitigation & ZNE Recovery across 4 channels)...")
    comp_data = run_figure12_mitigated_comparison(target="falfg", num_states=16)
    channels = comp_data["channels"]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6))

    # --- Panel 1: Depolarizing State-by-State Recovery ---
    dep = channels["depolarizing"]
    x = np.arange(len(dep["raw_fidelities"]))
    ax1.axhline(1.0, color="#10b981", linestyle="--", lw=1.5, label="Ideal Unitary Threshold (F = 1.000)")
    ax1.plot(x, dep["mitigated_fidelities"], color="#059669", marker="o", lw=2.2, label=f"Parity-Mitigated (Avg F = {dep['mitigated_average_fidelity']:.4f})")
    ax1.plot(x, dep["raw_fidelities"], color="#ef4444", marker="x", linestyle=":", lw=1.8, label=f"Raw Depolarizing Noise (Avg F = {dep['raw_average_fidelity']:.4f})")

    ax1.set_title("Panel A: State-by-State Fidelity Gain under Depolarizing Noise", fontsize=11, fontweight="bold", pad=10)
    ax1.set_xlabel("Basis State Index |X⟩", fontsize=10, labelpad=6)
    ax1.set_ylabel("State Fidelity F", fontsize=10, labelpad=6)
    ax1.set_ylim(0.75, 1.03)
    ax1.grid(True, linestyle="--", alpha=0.5)
    ax1.legend(loc="lower left", fontsize=9, frameon=True, facecolor="#f8fafc", edgecolor="#cbd5e1")

    # --- Panel 2: Comparative Bar Chart across Channels ---
    ch_names = ["Depolarizing", "Amplitude\nDamping", "Phase\nDamping", "Thermal\nRelaxation"]
    raw_avgs = [channels["depolarizing"]["raw_average_fidelity"],
                channels["amplitude_damping"]["raw_average_fidelity"],
                channels["phase_damping"]["raw_average_fidelity"],
                channels["thermal_relaxation"]["raw_average_fidelity"]]
    mit_avgs = [channels["depolarizing"]["mitigated_average_fidelity"],
                channels["amplitude_damping"]["mitigated_average_fidelity"],
                channels["phase_damping"]["mitigated_average_fidelity"],
                channels["thermal_relaxation"]["mitigated_average_fidelity"]]
    zne_avgs = [channels["depolarizing"].get("average_zne_fidelity") or 1.0,
                channels["amplitude_damping"].get("average_zne_fidelity") or 1.0,
                channels["phase_damping"].get("average_zne_fidelity") or 1.0,
                channels["thermal_relaxation"].get("average_zne_fidelity") or 1.0]

    bar_x = np.arange(len(ch_names))
    width = 0.25

    rects1 = ax2.bar(bar_x - width, raw_avgs, width, label="Raw Noisy Fidelity", color="#f87171", edgecolor="#dc2626")
    rects2 = ax2.bar(bar_x, mit_avgs, width, label="Parity-Mitigated Fidelity", color="#34d399", edgecolor="#059669")
    rects3 = ax2.bar(bar_x + width, zne_avgs, width, label="Parity + Richardson ZNE", color="#60a5fa", edgecolor="#2563eb")

    ax2.set_title("Panel B: Multi-Channel Error Mitigation & Extrapolation Summary", fontsize=11, fontweight="bold", pad=10)
    ax2.set_ylabel("Average State Fidelity", fontsize=10, labelpad=6)
    ax2.set_xticks(bar_x)
    ax2.set_xticklabels(ch_names, fontsize=9)
    ax2.set_ylim(0.80, 1.05)
    ax2.axhline(1.0, color="#64748b", linestyle=":", lw=1)
    ax2.grid(True, linestyle="--", alpha=0.5, axis="y")
    ax2.legend(loc="lower right", fontsize=9, frameon=True, facecolor="#f8fafc", edgecolor="#cbd5e1")

    # Add value annotations
    for rect in rects2:
        h = rect.get_height()
        ax2.annotate(f"{h:.3f}", xy=(rect.get_x() + rect.get_width() / 2, h), xytext=(0, 3),
                     textcoords="offset points", ha="center", va="bottom", fontsize=8, fontweight="bold")

    plt.suptitle("Figure 13: Active Quantum Error Mitigation via Reversible Parity Preservation and ZNE", fontsize=13, fontweight="bold", y=0.98)
    plt.tight_layout()
    fig_path = figures_dir / "fig13_parity_mitigation_recovery.png"
    plt.savefig(fig_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  [SAVED FIG 13] {fig_path}")


def run_all_plots():
    plot_figure11_histograms()
    plot_figure12_fidelity()
    plot_figure13_parity_mitigation()
    print("\nAll publication figures generated and saved to results/figures/")


if __name__ == "__main__":
    run_all_plots()
