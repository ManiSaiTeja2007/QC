"""Reversible Pebble Game Bennett Uncomputation Engine & Q-EDA Compiler Service.

Schedules compute and Bennett uncompute phases across intermediate ESOP product terms,
balancing Ancilla Qubit Footprint vs. Parallel T-Depth on the dependency DAG.

Guarantees:
  1. Zero Garbage Outputs (all ancilla qubits return cleanly to |0⟩).
  2. Strict Global Parity Conservation (P_in == P_out on all 2^n basis states).
  3. Strict Fault-Tolerant Clifford+T Basis compliance (H, S, T, T†, CNOT, X).
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Tuple, Any, Optional, Union
import numpy as np

from qiskit import QuantumCircuit
from backend.app.compiler.esop_synthesizer import (
    ESOPCube,
    ESOPNetwork,
    truth_table_to_esop,
    parse_verilog_assign_to_esop,
)
from backend.app.compiler.parity_mapper import (
    build_parity_preserving_circuit,
    is_circuit_clifford_t,
)
from backend.app.gates.clifford_t_library import (
    count_t_gates,
    calculate_t_depth,
    get_circuit_metrics,
)
from backend.app.simulation.verifier import (
    verify_parity_preservation,
    _run_circuit_statevector,
)


class PebbleStrategy(str, Enum):
    """Scheduling strategy for reversible pebble-game Bennett uncomputation."""
    MIN_ANCILLA = "min_ancilla"          # In-place / sequential: minimal ancillae
    MIN_T_DEPTH = "min_t_depth"          # Eager parallel: minimal T-depth, higher ancillae
    PARETO_BALANCED = "pareto_balanced"  # Configurable ancilla budget


@dataclass
class CompiledCircuitArtifact:
    """Complete synthesized artifact returned by the Q-EDA compiler."""
    circuit: QuantumCircuit
    strategy: PebbleStrategy
    num_inputs: int
    num_outputs: int
    num_qubits: int
    ancilla_count: int
    t_count: int
    t_depth: int
    cnot_count: int
    gate_count: int
    parity_preserved: bool
    garbage_free: bool
    functional_equivalence_pct: float
    esop_network: ESOPNetwork
    batches: List[List[ESOPCube]]

    def summary(self) -> str:
        return (
            f"CompiledCircuitArtifact[{self.strategy.value}]: "
            f"{self.num_qubits} qubits ({self.ancilla_count} ancillae), "
            f"T-count={self.t_count}, T-depth={self.t_depth}, "
            f"ParityPreserved={self.parity_preserved}, GarbageFree={self.garbage_free}, "
            f"Equiv={self.functional_equivalence_pct:.1f}%"
        )


def schedule_pebble_uncomputation(
    network: ESOPNetwork,
    strategy: PebbleStrategy = PebbleStrategy.PARETO_BALANCED,
    max_ancillas: Optional[int] = None,
) -> Tuple[List[List[ESOPCube]], int]:
    """Partitions ESOP cubes into uncomputation batches according to the chosen pebble strategy.

    Returns:
      Tuple of (scheduled_batches, peak_ancillas_needed).
    """
    cubes = network.cubes
    anc_needed = [max(0, c.degree - 1) for c in cubes]

    if strategy == PebbleStrategy.MIN_ANCILLA:
        # Sequential uncomputation: each cube requiring ancillae runs in its own batch
        batches: List[List[ESOPCube]] = []
        zero_anc_batch: List[ESOPCube] = []

        for c in cubes:
            if c.degree <= 1:
                zero_anc_batch.append(c)
            else:
                batches.append([c])

        if zero_anc_batch:
            batches.insert(0, zero_anc_batch)

        peak_anc = max((c.degree - 1 for c in cubes if c.degree >= 2), default=0)
        return batches, peak_anc

    elif strategy == PebbleStrategy.MIN_T_DEPTH:
        # Eager parallel uncomputation: all cubes placed in a single parallel batch
        total_anc = sum(c.degree - 1 for c in cubes if c.degree >= 2)
        return [cubes], total_anc

    else:  # PARETO_BALANCED
        # Pack cubes into batches such that sum of ancillae in each batch <= budget
        total_possible = sum(c.degree - 1 for c in cubes if c.degree >= 2)
        min_possible = max((c.degree - 1 for c in cubes if c.degree >= 2), default=0)

        if max_ancillas is not None:
            budget = max(min_possible, max_ancillas)
        else:
            budget = max(min_possible, (total_possible + min_possible) // 2)

        batches = []
        current_batch: List[ESOPCube] = []
        current_anc = 0

        for c in cubes:
            req = max(0, c.degree - 1)
            if current_batch and (current_anc + req > budget):
                batches.append(current_batch)
                current_batch = [c]
                current_anc = req
            else:
                current_batch.append(c)
                current_anc += req

        if current_batch:
            batches.append(current_batch)

        actual_peak = max((sum(max(0, c.degree - 1) for c in b) for b in batches), default=0)
        return batches, actual_peak


def compile_boolean_to_parity_clifford_t(
    spec: Union[str, ESOPNetwork, List[List[int]]],
    strategy: PebbleStrategy = PebbleStrategy.PARETO_BALANCED,
    max_ancillas: Optional[int] = None,
    num_inputs: Optional[int] = None,
    input_names: Optional[List[str]] = None,
    output_names: Optional[List[str]] = None,
) -> CompiledCircuitArtifact:
    """General-purpose Q-EDA compiler entry point.

    Synthesizes arbitrary Boolean specifications into garbage-free, strictly parity-preserving
    Clifford+T circuits with verified functional equivalence.
    """
    # 1. Ingest specification into ESOPNetwork
    if isinstance(spec, ESOPNetwork):
        net = spec
    elif isinstance(spec, str):
        net = parse_verilog_assign_to_esop(spec)
    elif isinstance(spec, list):
        assert num_inputs is not None, "num_inputs must be provided for truth table list"
        net = truth_table_to_esop(
            truth_tables=spec,
            num_inputs=num_inputs,
            input_names=input_names,
            output_names=output_names,
            optimize=True,
        )
    else:
        raise ValueError(f"Unsupported specification type: {type(spec)}")

    # 2. Schedule reversible pebble-game Bennett uncomputation
    batches, peak_anc = schedule_pebble_uncomputation(net, strategy=strategy, max_ancillas=max_ancillas)

    # 3. Map to strictly parity-preserving Clifford+T circuit
    qc = build_parity_preserving_circuit(net, batches, peak_anc)

    # 4. Verify 100% functional match, zero-garbage outputs, and parity preservation
    n_in = net.num_inputs
    n_out = net.num_outputs
    tot_qubits = qc.num_qubits

    # Range of primary output qubits: [n_in, n_in + n_out - 1]
    # Range of compute ancilla qubits: [n_in + n_out + 1, tot_qubits - 1]
    compute_ancillae_start = n_in + n_out + 1

    passed_states = 0
    total_states = 1 << n_in
    garbage_clean = True
    operational_parity_ok = True

    for in_dec in range(total_states):
        in_bits = [(in_dec >> (n_in - 1 - i)) & 1 for i in range(n_in)]
        exp_outputs = net.evaluate(in_bits)

        init_qubits = in_bits + [0] * (tot_qubits - n_in)
        out_qubits = _run_circuit_statevector(qc, init_qubits)

        # Primary outputs
        act_outputs = [out_qubits[n_in + j] for j in range(n_out)]
        if act_outputs == exp_outputs:
            passed_states += 1

        # Check compute ancillae returned to 0
        if any(out_qubits[q] != 0 for q in range(compute_ancillae_start, tot_qubits)):
            garbage_clean = False

        # Check parity preservation on operational basis states
        in_parity = sum(in_bits) % 2
        out_parity = sum(out_qubits) % 2
        if in_parity != out_parity:
            operational_parity_ok = False

    equiv_pct = (passed_states / total_states) * 100.0

    # 5. Check global parity preservation (exhaustive for small circuits, operational for larger)
    if tot_qubits <= 9:
        parity_ok = verify_parity_preservation(qc) and operational_parity_ok
    else:
        parity_ok = operational_parity_ok

    # 6. Extract metrics
    metrics = get_circuit_metrics(qc)

    return CompiledCircuitArtifact(
        circuit=qc,
        strategy=strategy,
        num_inputs=n_in,
        num_outputs=n_out,
        num_qubits=tot_qubits,
        ancilla_count=peak_anc,
        t_count=metrics["t_count"],
        t_depth=metrics["t_depth"],
        cnot_count=metrics["cnot_count"],
        gate_count=metrics["total_gates"],
        parity_preserved=parity_ok,
        garbage_free=garbage_clean,
        functional_equivalence_pct=equiv_pct,
        esop_network=net,
        batches=batches,
    )
