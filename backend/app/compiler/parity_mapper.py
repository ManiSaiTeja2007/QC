"""Parity-Preserving Gadget Mapper & Fault-Tolerant Clifford+T Synthesizer.

Lowers ESOP product cubes into strictly parity-preserving reversible logic networks
where every single macro-cell satisfies:
  P_in == P_out  (global Hamming weight parity conservation)
and decomposes every gate into universal fault-tolerant Clifford+T basis:
  H, S, S†, T, T†, CNOT, X
"""

from typing import Dict, List, Tuple, Any, Optional, Set
from qiskit import QuantumCircuit
from backend.app.compiler.esop_synthesizer import ESOPCube, ESOPNetwork
from backend.app.gates.clifford_t_library import (
    CLIFFORD_GATES,
    T_GATES,
    is_clifford_t,
    count_t_gates,
    calculate_t_depth,
)


def add_clifford_t_toffoli(
    qc: QuantumCircuit,
    control1: int,
    control2: int,
    target: int,
) -> None:
    """Synthesizes a 3-qubit Toffoli gate using the 7-T Clifford+T library.

    Metrics:
      - T-count = 7
      - T-depth = 3
      - CNOT count = 6
      - H count = 2
    """
    c1, c2, t = control1, control2, target

    qc.h(t)
    qc.cx(c2, t)
    qc.tdg(t)
    qc.cx(c1, t)
    qc.t(t)
    qc.cx(c2, t)
    qc.tdg(t)
    qc.cx(c1, t)
    qc.t(c2)
    qc.t(t)
    qc.h(t)
    qc.cx(c1, c2)
    qc.t(c1)
    qc.tdg(c2)
    qc.cx(c1, c2)


def is_circuit_clifford_t(qc: QuantumCircuit) -> bool:
    """Verifies that all operations in the circuit strictly belong to Clifford+T."""
    return is_clifford_t(qc)


def build_cube_and_tree(
    qc: QuantumCircuit,
    literals: List[Tuple[int, bool]],
    ancilla_indices: List[int],
    invert_phase: bool = False,
) -> int:
    """Constructs a balanced binary tree of Toffoli gates to compute a k-literal AND.

    Args:
      qc: Target QuantumCircuit.
      literals: List of (var_idx, is_positive).
      ancilla_indices: Available temporary compute ancilla qubits.
      invert_phase: If False, compute phase; if True, uncompute phase (executed in reverse).

    Returns:
      Index of the qubit holding the computed product term.
    """
    assert len(literals) >= 2, "Binary tree requires at least 2 literals"
    num_toffolis = len(literals) - 1
    assert len(ancilla_indices) >= num_toffolis, (
        f"Need {num_toffolis} ancillae for {len(literals)} literals, got {len(ancilla_indices)}"
    )

    # 1. Invert negative literals
    # We invert negative literals before computing and re-invert after
    var_indices: List[int] = []
    inverted_vars: List[int] = []

    for v, pos in literals:
        if not pos:
            inverted_vars.append(v)
        var_indices.append(v)

    if not invert_phase:
        # Forward pass: invert negative inputs
        for v in inverted_vars:
            qc.x(v)

    # Compute binary tree:
    # First Toffoli: ancilla_indices[0] = var_indices[0] & var_indices[1]
    # Next Toffolis: ancilla_indices[i] = ancilla_indices[i-1] & var_indices[i+1]
    if not invert_phase:
        add_clifford_t_toffoli(qc, var_indices[0], var_indices[1], ancilla_indices[0])
        for i in range(1, num_toffolis):
            add_clifford_t_toffoli(qc, ancilla_indices[i - 1], var_indices[i + 1], ancilla_indices[i])
        root_qubit = ancilla_indices[num_toffolis - 1]
    else:
        # Reverse pass for uncomputation
        for i in reversed(range(1, num_toffolis)):
            add_clifford_t_toffoli(qc, ancilla_indices[i - 1], var_indices[i + 1], ancilla_indices[i])
        add_clifford_t_toffoli(qc, var_indices[0], var_indices[1], ancilla_indices[0])
        root_qubit = ancilla_indices[num_toffolis - 1]

        # Re-invert negative inputs
        for v in inverted_vars:
            qc.x(v)

    return root_qubit


def build_parity_preserving_circuit(
    network: ESOPNetwork,
    scheduled_batches: List[List[ESOPCube]],
    peak_ancillas: int,
) -> QuantumCircuit:
    """Builds a complete, garbage-free, strictly parity-preserving Clifford+T circuit.

    Qubit Layout:
      - 0 .. n_in - 1: Primary Inputs (X)
      - n_in .. n_in + n_out - 1: Primary Outputs (Y, initialized to |0⟩)
      - n_in + n_out: Parity Compensation Rail (P, initialized to |0⟩)
      - n_in + n_out + 1 .. Total - 1: Temporary Compute Ancillae (A, initialized to |0⟩)
    """
    n_in = network.num_inputs
    n_out = network.num_outputs
    p_rail = n_in + n_out
    first_ancilla = p_rail + 1
    total_qubits = first_ancilla + peak_ancillas

    qc = QuantumCircuit(total_qubits, name="Parity_ESOP_Clifford_T")

    ancilla_pool = list(range(first_ancilla, total_qubits))

    for batch in scheduled_batches:
        # Step 1: Compute cubes in batch and accumulate into output & parity rails
        # To support parallel execution when ancillae are disjoint
        anc_offset = 0
        computed_roots: List[Tuple[int, int, List[Tuple[int, bool]], List[int]]] = []

        for cube in batch:
            deg = cube.degree
            lits = sorted(list(cube.literals), key=lambda x: x[0])
            out_wire = n_in + cube.output_idx

            if deg == 0:
                # Constant 1: toggle output and parity rail
                qc.x(out_wire)
                qc.x(p_rail)
            elif deg == 1:
                # Single literal: F2G parity-balanced CNOT pair
                v, pos = lits[0]
                if pos:
                    qc.cx(v, out_wire)
                    qc.cx(v, p_rail)
                else:
                    # Inverted literal: ¬v = v ⊕ 1
                    qc.cx(v, out_wire)
                    qc.cx(v, p_rail)
                    qc.x(out_wire)
                    qc.x(p_rail)
            else:
                # Degree >= 2: compute via Toffoli tree, copy, and uncompute
                req_anc = deg - 1
                batch_anc = ancilla_pool[anc_offset : anc_offset + req_anc]
                anc_offset += req_anc

                # Compute tree
                root = build_cube_and_tree(qc, lits, batch_anc, invert_phase=False)
                # Accumulate into target output rail and parity rail
                qc.cx(root, out_wire)
                qc.cx(root, p_rail)

                computed_roots.append((out_wire, root, lits, batch_anc))

        # Step 2: Uncompute compute trees in reverse order (Bennett uncomputation)
        for out_wire, root, lits, batch_anc in reversed(computed_roots):
            build_cube_and_tree(qc, lits, batch_anc, invert_phase=True)

    return qc
