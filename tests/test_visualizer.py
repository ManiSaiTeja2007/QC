"""Unit tests for Step-by-Step Quantum Circuit Visualizer."""

import pytest
from src.gates.basic_gates import build_fredkin_circuit
from src.simulation.step_visualizer import track_circuit_evolution


def test_track_circuit_evolution_fredkin():
    """Verify gate-by-gate state tracking for Fredkin circuit."""
    qc = build_fredkin_circuit("clifford_t")
    in_bits = [1, 0, 1]

    data = track_circuit_evolution(qc, in_bits)

    assert data["num_qubits"] == 3
    assert data["total_steps"] == len(qc.data)
    assert len(data["steps"]) == len(qc.data) + 1  # Step 0 + N steps

    # Check Step 0 initial state (A=1, B=0, C=1)
    s0 = data["steps"][0]
    assert s0["step"] == 0
    assert len(s0["bloch_vectors"]) == 3

    # Check final state (A=1, B=1, C=0) -> Targets swapped!
    sf = data["steps"][-1]
    # In Qiskit label order: bit 2 is C (0), bit 1 is B (1), bit 0 is A (1) -> "011"
    assert "011" in sf["probabilities"]
    assert sf["probabilities"]["011"] > 0.99
