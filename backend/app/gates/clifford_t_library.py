"""Clifford + T Analysis and Metrics Library.

Provides utilities to evaluate T-count, T-depth, Clifford gate counts,
and quantum cost metrics.
"""

from typing import Dict, Any
from qiskit import QuantumCircuit


CLIFFORD_GATES = {"h", "s", "sdg", "x", "y", "z", "cx", "cz", "swap", "id"}
T_GATES = {"t", "tdg"}


def is_clifford_t(qc: QuantumCircuit) -> bool:
    """Checks if all operations in the circuit belong to the Clifford+T library."""
    for instruction in qc.data:
        op_name = instruction.operation.name.lower()
        if op_name not in CLIFFORD_GATES and op_name not in T_GATES:
            return False
    return True


def count_t_gates(qc: QuantumCircuit) -> int:
    """Returns the total number of T and T† gates in the circuit (T-count)."""
    t_count = 0
    for instruction in qc.data:
        op_name = instruction.operation.name.lower()
        if op_name in T_GATES:
            t_count += 1
    return t_count


def calculate_t_depth(qc: QuantumCircuit) -> int:
    """Calculates the T-depth of the circuit.

    T-depth is the number of T-gate layers on the critical path,
    where T and T† gates acting on disjoint qubits can execute in parallel.
    """
    qubit_t_depths = {q: 0 for q in qc.qubits}

    for instruction in qc.data:
        op_name = instruction.operation.name.lower()
        qargs = instruction.qubits

        if op_name in T_GATES:
            # T gate advances depth on that qubit
            current_max = max(qubit_t_depths[q] for q in qargs)
            new_depth = current_max + 1
            for q in qargs:
                qubit_t_depths[q] = new_depth
        else:
            # Two-qubit Clifford gate (like CX) synchronizes the T-depth between qubits
            if len(qargs) > 1:
                sync_depth = max(qubit_t_depths[q] for q in qargs)
                for q in qargs:
                    qubit_t_depths[q] = sync_depth

    return max(qubit_t_depths.values()) if qubit_t_depths else 0


def get_circuit_metrics(qc: QuantumCircuit) -> Dict[str, Any]:
    """Computes full architectural metrics for a quantum circuit."""
    op_counts = qc.count_ops()
    t_count = count_t_gates(qc)
    t_depth = calculate_t_depth(qc)
    cnot_count = op_counts.get("cx", 0)
    h_count = op_counts.get("h", 0)
    s_count = op_counts.get("s", 0) + op_counts.get("sdg", 0)
    total_gates = sum(op_counts.values())

    return {
        "num_qubits": qc.num_qubits,
        "total_gates": total_gates,
        "circuit_depth": qc.depth(),
        "t_count": t_count,
        "t_depth": t_depth,
        "cnot_count": cnot_count,
        "h_count": h_count,
        "s_count": s_count,
        "is_clifford_t": is_clifford_t(qc),
        "gate_breakdown": dict(op_counts),
    }
