#!/usr/bin/env bash
# ==============================================================================
# IEEE TETC 2026 Paper Verification & Replication Master Script
# "A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================================================="
echo "⚡ RUNNING COMPLETE PAPER REPLICATION & VERIFICATION SUITE"
echo "=============================================================================="

# 1. Master Mathematical Verification (Truth Tables, Functions, Cost Metrics)
echo "▶ [STEP 1/4] Running Master Truth Table & Cost Metrics Verification..."
python3 experiments/run_all_verifications.py

# 2. Publication Figures (Figure 11 Histograms & Figure 12 State Fidelity)
echo ""
echo "▶ [STEP 2/4] Generating Publication Figures 11 & 12..."
python3 experiments/plot_histograms_fidelity.py

# 3. Single-Strip Circuit Schematics (Figure 4, 5, 7, 8, 9, 10)
echo ""
echo "▶ [STEP 3/4] Exporting Single Straight-Strip Circuit Diagrams..."
python3 experiments/generate_circuit_diagrams.py

# 4. Step-by-Step Gate Visualizations & Bloch Trajectories
echo ""
echo "▶ [STEP 4/4] Tracking Step-by-Step State Evolution & Bloch Trajectories..."
python3 experiments/visualize_circuit_step_by_step.py

echo ""
echo "=============================================================================="
echo "🎉 ALL PAPER VERIFICATIONS & FIGURE GENERATIONS COMPLETED SUCCESSFULLY!"
echo "   - Summary Report:  results/verification_report.md"
echo "   - Circuit Strips:  results/circuits/"
echo "   - Figures & Traj:  results/figures/"
echo "=============================================================================="
