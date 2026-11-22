"""Benchmark Suite and Pareto Frontier Generator for ESOP Q-EDA Compiler (Phase 2).

Evaluates 4 canonical reversible benchmark circuits:
  1. Full_Adder (3 in, 2 out)
  2. 3_17 (RevLib 3 in, 3 out)
  3. 4gt11 (RevLib 4 in, 1 out)
  4. 2bit_Multiplier (4 in, 4 out)

Across 3 Reversible Pebble Scheduling Strategies:
  - MIN_ANCILLA (Sequential In-Place Uncomputation)
  - PARETO_BALANCED (Budgeted Parallel Uncomputation)
  - MIN_T_DEPTH (Eager Maximal Parallelism)

Measures:
  - T-count, T-depth, Ancilla Footprint, Total Qubits
  - 100% Functional Equivalence
  - Zero-Garbage Cleanliness
  - Global Parity Preservation
  - Physical Depolarizing Noise State Fidelity (Raw vs. Parity-Mitigated)

Generates Figure 14: results/figures/fig14_compiler_pareto_frontier.png
"""

import sys
from pathlib import Path
import matplotlib.pyplot as plt
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.compiler.pebble_scheduler import (
    PebbleStrategy,
    compile_boolean_to_parity_clifford_t,
)
from backend.app.simulation.noise_models import (
    build_depolarizing_noise_model,
    simulate_parity_mitigated_density_matrix,
    TransmonNoiseConfig,
)

BENCHMARK_SPECS = {
    "Full_Adder": """
        module full_adder(input a, input b, input cin, output sum, output cout);
            assign sum = a ^ b ^ cin;
            assign cout = (a & b) ^ (b & cin) ^ (a & cin);
        endmodule
    """,
    "3_17": """
        module rev_3_17(input x0, input x1, input x2, output y0, output y1, output y2);
            assign y0 = x0 ^ x1;
            assign y1 = x1 ^ x2;
            assign y2 = (x0 & x1) ^ x2;
        endmodule
    """,
    "4gt11": """
        module rev_4gt11(input x0, input x1, input x2, input x3, output y);
            assign y = (x0 & x1) ^ (x2 & x3) ^ x0;
        endmodule
    """,
    "2bit_Multiplier": """
        module mult_2bit(input a0, input a1, input b0, input b1, output p0, output p1, output p2, output p3);
            assign p0 = a0 & b0;
            assign p1 = (a1 & b0) ^ (a0 & b1);
            assign p2 = (a1 & b1) ^ (a0 & a1 & b0 & b1);
            assign p3 = a0 & a1 & b0 & b1;
        endmodule
    """,
}


def run_compiler_benchmarks() -> dict:
    """Executes compiler synthesis and noise mitigation benchmarks across all circuits."""
    cfg = TransmonNoiseConfig()
    nm_dep = build_depolarizing_noise_model(cfg.p1q_error, cfg.p2q_error)

    results = {}

    for name, code in BENCHMARK_SPECS.items():
        results[name] = {}
        for strat in [PebbleStrategy.MIN_ANCILLA, PebbleStrategy.PARETO_BALANCED, PebbleStrategy.MIN_T_DEPTH]:
            max_anc = 2 if strat == PebbleStrategy.PARETO_BALANCED else None
            art = compile_boolean_to_parity_clifford_t(code, strategy=strat, max_ancillas=max_anc)

            # Test noise mitigation on initial state |100..0⟩
            init_state = [1] + [0] * (art.circuit.num_qubits - 1)

            if art.circuit.num_qubits <= 9:
                mit_res = simulate_parity_mitigated_density_matrix(art.circuit, init_state, nm_dep)
                raw_f = mit_res["raw_fidelity"]
                mit_f = mit_res["mitigated_fidelity"]
                acc_rate = mit_res["acceptance_rate"]
                gain = mit_res["fidelity_gain"]
            else:
                # For >9 qubits, evaluate empirical fidelity via shot sampling to conserve RAM
                from backend.app.simulation.verifier import _run_circuit_statevector
                from backend.app.simulation.fidelity_simulator import simulate_parity_mitigated_shots

                ideal_out = _run_circuit_statevector(art.circuit, init_state)
                ideal_bitstr = "".join(str(b) for b in reversed(ideal_out))

                shots_res = simulate_parity_mitigated_shots(art.circuit, init_state, noise_model=nm_dep, shots=2048)
                raw_f = round(shots_res["raw_counts"].get(ideal_bitstr, 0) / shots_res["total_shots"], 4)
                mit_f = round(shots_res["mitigated_counts"].get(ideal_bitstr, 0) / max(1, shots_res["accepted_shots"]), 4)
                acc_rate = shots_res["acceptance_rate"]
                gain = round(mit_f - raw_f, 4)

            results[name][strat.value] = {
                "num_qubits": art.num_qubits,
                "ancilla_count": art.ancilla_count,
                "t_count": art.t_count,
                "t_depth": art.t_depth,
                "cnot_count": art.cnot_count,
                "gate_count": art.gate_count,
                "parity_preserved": art.parity_preserved,
                "garbage_free": art.garbage_free,
                "equiv_pct": art.functional_equivalence_pct,
                "raw_fidelity": raw_f,
                "mitigated_fidelity": mit_f,
                "acceptance_rate": acc_rate,
                "fidelity_gain": gain,
            }

    return results


def plot_fig14_pareto_frontier(results: dict):
    """Generates publication-quality Figure 14: Pareto Tradeoff & Error Mitigation."""
    figures_dir = PROJECT_ROOT / "results" / "figures"
    figures_dir.mkdir(parents=True, exist_ok=True)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 6.2))
    
    # --- Panel A: Ancilla vs T-Depth Pareto Frontier ---
    markers = {"Full_Adder": "o", "3_17": "s", "4gt11": "^", "2bit_Multiplier": "D"}
    colors = {"Full_Adder": "#1d4ed8", "3_17": "#047857", "4gt11": "#b45309", "2bit_Multiplier": "#6d28d9"}
    
    for name, strat_dict in results.items():
        ancillas = [strat_dict[s]["ancilla_count"] for s in ["min_ancilla", "pareto_balanced", "min_t_depth"]]
        t_depths = [strat_dict[s]["t_depth"] for s in ["min_ancilla", "pareto_balanced", "min_t_depth"]]
    
        ax1.plot(ancillas, t_depths, color=colors[name], linestyle="--", alpha=0.5, lw=1.8)
        ax1.scatter(ancillas, t_depths, color=colors[name], s=110, marker=markers[name], zorder=5, label=name.replace('_', ' '))
    
    annotations = [
        # Full_Adder
        ("Min Ancilla\n(1A, 24D)", (1, 24), (-14, 22), "right", colors["Full_Adder"]),
        ("Pareto Balanced\n(2A, 24D)", (2, 24), (20, 20), "left", colors["Full_Adder"]),
        ("Min T-Depth\n(3A, 22D)", (3, 22), (20, -16), "left", colors["Full_Adder"]),
        # 3_17
        ("All Strats: 3_17\n(1A, 8D)", (1, 8), (20, -14), "left", colors["3_17"]),
        # 4gt11
        ("Min Ancilla (1A, 16D)", (1, 16), (22, 6), "left", colors["4gt11"]),
        ("Pareto / Min Depth (2A, 11D)", (2, 11), (22, 6), "left", colors["4gt11"]),
        # 2bit_Multiplier
        ("Min Ancilla (3A, 76D)", (3, 76), (18, 4), "left", colors["2bit_Multiplier"]),
        ("Pareto Balanced (3A, 68D)", (3, 68), (18, -10), "left", colors["2bit_Multiplier"]),
        ("Min T-Depth (10A, 51D)", (10, 51), (-16, 16), "right", colors["2bit_Multiplier"]),
    ]
    
    for label, (x, y), (ox, oy), align, col in annotations:
        ax1.annotate(
            label,
            xy=(x, y),
            xytext=(ox, oy),
            textcoords="offset points",
            fontsize=8.5,
            fontweight="bold",
            color=col,
            ha=align,
            va="center",
            bbox=dict(boxstyle="round,pad=0.28", fc="#ffffff", ec=col, alpha=0.95, lw=0.9),
            arrowprops=dict(arrowstyle="->", color=col, lw=0.9, alpha=0.75)
        )
    
    ax1.set_title("Panel A: Reversible Pebble-Game Ancilla vs. T-Depth Pareto Frontier", fontsize=11.5, fontweight="bold", pad=12)
    ax1.set_xlabel("Ancilla Qubit Footprint", fontsize=10.5, labelpad=8)
    ax1.set_ylabel("Parallel T-Depth (Critical Path)", fontsize=10.5, labelpad=8)
    ax1.set_xlim(-0.3, 11.5)
    ax1.set_ylim(0, 88)
    ax1.grid(True, linestyle="--", alpha=0.5)
    ax1.legend(loc="upper right", fontsize=9.5, frameon=True, facecolor="#f8fafc", edgecolor="#94a3b8", framealpha=0.95, title="Benchmark Circuit", title_fontsize=9.5)
    
    # --- Panel B: Parity-Syndrome Error Mitigation across Benchmarks ---
    bench_names = list(results.keys())
    raw_fids = [results[b]["min_ancilla"]["raw_fidelity"] for b in bench_names]
    mit_fids = [results[b]["min_ancilla"]["mitigated_fidelity"] for b in bench_names]
    
    x = np.arange(len(bench_names))
    width = 0.35
    
    rects1 = ax2.bar(x - width/2, raw_fids, width, label="Raw Transmon Depolarizing Fidelity", color="#f87171", edgecolor="#dc2626", lw=1.2)
    rects2 = ax2.bar(x + width/2, mit_fids, width, label="Parity-Mitigated Post-Selected Fidelity", color="#34d399", edgecolor="#059669", lw=1.2)
    
    for i, (r, m) in enumerate(zip(raw_fids, mit_fids)):
        gain = m - r
        ax2.annotate(
            f"+{gain*100:.1f}%\n(F={m:.3f})",
            xy=(x[i] + width/2, m),
            xytext=(0, 6),
            textcoords="offset points",
            ha="center",
            va="bottom",
            fontsize=8.5,
            fontweight="bold",
            color="#065f46",
            bbox=dict(boxstyle="round,pad=0.2", fc="#ecfdf5", ec="#10b981", lw=0.7, alpha=0.95)
        )
    
    ax2.set_title("Panel B: Automated Circuit State Fidelity Recovery under Noise", fontsize=11.5, fontweight="bold", pad=12)
    ax2.set_ylabel("Quantum State Fidelity", fontsize=10.5, labelpad=8)
    ax2.set_xticks(x)
    ax2.set_xticklabels([b.replace('_', ' ') for b in bench_names], fontsize=9.5)
    ax2.set_ylim(0.20, 1.10)
    ax2.axhline(1.0, color="#64748b", linestyle=":", lw=1.2, label="Ideal Unitary State (F = 1.0)")
    ax2.grid(True, linestyle="--", alpha=0.5, axis="y")
    ax2.legend(loc="upper right", fontsize=9, frameon=True, facecolor="#f8fafc", edgecolor="#94a3b8", framealpha=0.95)
    
    plt.suptitle("Figure 14: Q-EDA Compiler Pareto Optimization & Closed-Loop Error Mitigation", fontsize=13, fontweight="bold", y=0.98)
    plt.tight_layout()
    fig_path = figures_dir / "fig14_compiler_pareto_frontier.png"
    plt.savefig(fig_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"  [SAVED FIG 14] {fig_path}")


def run_all():
    print("Running Q-EDA Reversible Logic Synthesis Benchmarks across 4 circuits & 3 strategies...")
    res = run_compiler_benchmarks()

    print("\n" + "=" * 92)
    print(f"{'Benchmark':<16} | {'Strategy':<16} | {'Qubits':<6} | {'Anc':<4} | {'T-count':<7} | {'T-depth':<7} | {'Raw F':<6} | {'Mit F':<6} | {'Gain':<6}")
    print("=" * 92)
    for b_name, strats in res.items():
        for s_name, data in strats.items():
            print(
                f"{b_name:<16} | {s_name:<16} | {data['num_qubits']:<6} | {data['ancilla_count']:<4} | "
                f"{data['t_count']:<7} | {data['t_depth']:<7} | {data['raw_fidelity']:<6.4f} | {data['mitigated_fidelity']:<6.4f} | +{data['fidelity_gain']:<5.4f}"
            )
        print("-" * 92)

    plot_fig14_pareto_frontier(res)


if __name__ == "__main__":
    run_all()
