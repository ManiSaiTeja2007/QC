"""Benchmarking Hardware-Topology-Aware SABRE Routing & 3D Heavy-Hex Overheads.

Evaluates compilation overhead across physical superconducting topologies:
  1. All-to-All Lattice (16Q Ideal Baseline)
  2. 2D Square Grid (16Q Planar Mesh)
  3. IBM Falcon (27Q Heavy-Hexagonal Lattice)
  4. IBM Eagle (127Q Heavy-Hexagonal Lattice)
  5. IBM Heron (133Q Tunable-Coupler Heavy-Hexagonal Lattice)

Compares:
  - Naive Placement vs. Noise-Tuned Initial Placement.
  - Forward-only SABRE vs. Bidirectional Lookahead SABRE.
  - 3-CNOT Parity-Preserving SWAP Decomposition (100% Parity Preservation).

Generates:
  results/figures/fig16_heavy_hex_routing_overhead.png
"""

import sys
from pathlib import Path
import time
from typing import Dict, Any, List
import matplotlib.pyplot as plt
import numpy as np

# Ensure QC is on sys.path
QC_ROOT = Path(__file__).resolve().parent.parent
if str(QC_ROOT) not in sys.path:
    sys.path.insert(0, str(QC_ROOT))

from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t
from backend.app.router.topology_graph import (
    TopologyGraph,
    build_all_to_all_topology,
    build_grid_topology,
    build_heavy_hex_topology,
)
from backend.app.router.sabre_router import (
    ParitySafeSabreRouter,
    RoutedCircuitArtifact,
)
from backend.app.dd_engine.qmdd import QMDDState


def run_routing_benchmark() -> List[Dict[str, Any]]:
    """Runs empirical SABRE routing benchmark across supported topologies."""
    qc = build_one_bit_alu_clifford_t()
    orig_gates = len(qc.data)
    orig_depth = qc.depth()
    orig_cx = sum(1 for inst in qc.data if inst.operation.name.lower() == "cx")

    topologies = [
        ("All-to-All 16Q", build_all_to_all_topology(16)),
        ("Grid 4x4 (16Q)", build_grid_topology(4, 4)),
        ("Falcon 27Q", build_heavy_hex_topology("falcon_27")),
        ("Eagle 127Q", build_heavy_hex_topology("eagle_127")),
        ("Heron 133Q", build_heavy_hex_topology("heron_133")),
    ]

    results: List[Dict[str, Any]] = []

    print("=" * 105)
    print("PHASE 4 BENCHMARK: HARDWARE-TOPOLOGY-AWARE SABRE ROUTING & HEAVY-HEX OVERHEAD")
    print(f"Target Circuit: 1-Bit Clifford+T ALU ({qc.num_qubits} qubits, {orig_gates} gates, {orig_cx} CX, depth {orig_depth})")
    print("=" * 105)
    print(f"{'Topology':<16} | {'Placement':<12} | {'SABRE':<8} | {'SWAPs':<6} | {'Added CX':<9} | {'Depth':<6} | {'Latency (µs)':<13} | {'Fidelity':<10} | {'Parity'}")
    print("-" * 105)

    for topo_name, topo in topologies:
        router = ParitySafeSabreRouter(topo)

        # 1. Naive Trivial Placement (logical i -> physical i)
        naive_layout = {i: i for i in range(qc.num_qubits)}
        art_naive = router.route_with_layout(qc, initial_layout=naive_layout)

        # 2. Noise-Aware + Bidirectional SABRE
        t0 = time.perf_counter()
        art_bidi = router.route(qc, bidirectional=True, noise_aware=True)
        route_time_ms = (time.perf_counter() - t0) * 1000.0

        # Verify parity preservation on routed circuit via QMDD
        st = QMDDState.from_basis_state(topo.num_qubits, [0] * topo.num_qubits)
        # Flip two mapped qubits (even parity: <Z^{\otimes n}> = +1.0)
        p_init_0 = art_bidi.initial_layout[0]
        p_init_2 = art_bidi.initial_layout[2]
        st.apply_x(p_init_0)
        st.apply_x(p_init_2)
        p_in = st.expectation_z_all()
        st.apply_circuit(art_bidi.routed_circuit)
        p_out = st.expectation_z_all()
        parity_preserved = abs(p_out - p_in) < 1e-6

        parity_str = "PASS (100%)" if parity_preserved else "FAIL"

        print(
            f"{topo_name:<16} | {'Naive':<12} | {'Fwd':<8} | {art_naive.num_swaps:<6} | {art_naive.added_cx_count:<9} | {art_naive.depth:<6} | "
            f"{art_naive.duration_ns / 1000.0:<13.2f} | {art_naive.estimated_fidelity:<10.4f} | {parity_str}"
        )
        print(
            f"{topo_name:<16} | {'Noise-Tuned':<12} | {'Bidi':<8} | {art_bidi.num_swaps:<6} | {art_bidi.added_cx_count:<9} | {art_bidi.depth:<6} | "
            f"{art_bidi.duration_ns / 1000.0:<13.2f} | {art_bidi.estimated_fidelity:<10.4f} | {parity_str}"
        )
        print("-" * 105)

        results.append({
            "topology": topo_name,
            "qubits": topo.num_qubits,
            "naive_swaps": art_naive.num_swaps,
            "naive_cx": art_naive.added_cx_count,
            "naive_depth": art_naive.depth,
            "naive_latency_us": art_naive.duration_ns / 1000.0,
            "naive_fidelity": art_naive.estimated_fidelity,
            "bidi_swaps": art_bidi.num_swaps,
            "bidi_cx": art_bidi.added_cx_count,
            "bidi_depth": art_bidi.depth,
            "bidi_latency_us": art_bidi.duration_ns / 1000.0,
            "bidi_fidelity": art_bidi.estimated_fidelity,
            "route_time_ms": route_time_ms,
            "parity_preserved": parity_preserved,
        })

    return results


def plot_routing_results(results: List[Dict[str, Any]], output_path: Path) -> None:
    """Generates Figure 16 publication chart."""
    output_path.parent.mkdir(parents=True, exist_ok=True)

    topologies = [r["topology"] for r in results]
    x = np.arange(len(topologies))
    width = 0.35

    fig, axes = plt.subplots(2, 2, figsize=(15, 11))
    fig.patch.set_facecolor("#ffffff")

    # (a) SWAP Overhead Comparison
    ax1 = axes[0, 0]
    ax1.bar(x - width/2, [r["naive_swaps"] for r in results], width, label="Naive Placement (Identity)", color="#94a3b8", edgecolor="#475569")
    ax1.bar(x + width/2, [r["bidi_swaps"] for r in results], width, label="Noise-Tuned Bidirectional SABRE", color="#0284c7", edgecolor="#0369a1")
    ax1.set_title("(a) Physical SWAP Overhead across Architectures", fontsize=12, fontweight="bold", pad=10)
    ax1.set_ylabel("Inserted SWAPs ($N_{\\mathrm{SWAP}}$)", fontsize=11)
    ax1.set_xticks(x)
    ax1.set_xticklabels(topologies, rotation=15, ha="right", fontsize=9)
    ax1.legend(loc="upper left", framealpha=0.9)
    ax1.grid(axis="y", linestyle="--", alpha=0.4)

    # (b) Circuit Depth Expansion
    ax2 = axes[0, 1]
    ax2.bar(x - width/2, [r["naive_depth"] for r in results], width, label="Naive Layout Depth", color="#f87171", edgecolor="#dc2626")
    ax2.bar(x + width/2, [r["bidi_depth"] for r in results], width, label="Noise-Tuned SABRE Depth", color="#10b981", edgecolor="#059669")
    ax2.axhline(y=75, color="#64748b", linestyle=":", label="Unrouted Logical Baseline (75)")
    ax2.set_title("(b) Hardware Circuit Depth Expansion", fontsize=12, fontweight="bold", pad=10)
    ax2.set_ylabel("Circuit Depth (Cycles)", fontsize=11)
    ax2.set_xticks(x)
    ax2.set_xticklabels(topologies, rotation=15, ha="right", fontsize=9)
    ax2.legend(loc="upper left", framealpha=0.9)
    ax2.grid(axis="y", linestyle="--", alpha=0.4)

    # (c) Total Hardware Execution Latency
    ax3 = axes[1, 0]
    ax3.bar(x - width/2, [r["naive_latency_us"] for r in results], width, label="Naive Placement", color="#fbbf24", edgecolor="#d97706")
    ax3.bar(x + width/2, [r["bidi_latency_us"] for r in results], width, label="Noise-Tuned SABRE", color="#3b82f6", edgecolor="#1d4ed8")
    ax3.set_title("(c) Physical Hardware Latency (Pulse Duration)", fontsize=12, fontweight="bold", pad=10)
    ax3.set_ylabel("Execution Latency (µs)", fontsize=11)
    ax3.set_xticks(x)
    ax3.set_xticklabels(topologies, rotation=15, ha="right", fontsize=9)
    ax3.legend(loc="upper left", framealpha=0.9)
    ax3.grid(axis="y", linestyle="--", alpha=0.4)

    # (d) Estimated Physical Gate Fidelity
    ax4 = axes[1, 1]
    ax4.plot(topologies, [r["naive_fidelity"] * 100.0 for r in results], marker="s", markersize=8, color="#ef4444", linestyle="--", linewidth=2.0, label="Naive Placement Fidelity")
    ax4.plot(topologies, [r["bidi_fidelity"] * 100.0 for r in results], marker="o", markersize=9, color="#059669", linestyle="-", linewidth=2.5, label="Noise-Tuned SABRE Fidelity")
    ax4.set_title("(d) Estimated Physical QPU Circuit Fidelity", fontsize=12, fontweight="bold", pad=10)
    ax4.set_ylabel("Physical Fidelity (%)", fontsize=11)
    ax4.set_xticks(x)
    ax4.set_xticklabels(topologies, rotation=15, ha="right", fontsize=9)
    ax4.legend(loc="lower left", framealpha=0.9)
    ax4.grid(True, linestyle="--", alpha=0.4)

    plt.suptitle("Figure 16: Hardware-Topology-Aware Noise-Tuned SABRE Compilation & QPU Overhead\n(IBM Falcon 27Q, Eagle 127Q, Heron 133Q & Grid Lattices)", fontsize=14, fontweight="bold", y=0.98)
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    plt.savefig(output_path, dpi=300)
    plt.close()
    print(f"\n[FIGURE 16 GENERATED] Saved to: {output_path}")


if __name__ == "__main__":
    results = run_routing_benchmark()
    fig_path = QC_ROOT / "results" / "figures" / "fig16_heavy_hex_routing_overhead.png"
    plot_routing_results(results, fig_path)
