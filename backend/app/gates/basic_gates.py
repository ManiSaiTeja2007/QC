"""Fundamental Quantum Gates for Reversible Logic & Clifford+T Synthesis.

Implements Controlled-V, Controlled-V†, Fredkin (NCV and Clifford+T),
Feynman (CNOT), and Double Feynman (F2G) gates as presented in:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"
(IEEE TETC 2026).
"""

import numpy as np
from qiskit import QuantumCircuit


def add_cv(qc: QuantumCircuit, control: int, target: int) -> None:
    """Applies Controlled-V (CV) gate using Clifford+T decomposition (Fig. 1(a)).

    V = sqrt(X). Controlled-V applies V on target when control is |1>.
    Decomposition: H(t), T(t), CX(c, t), T_dag(t), CX(c, t), H(t), T(c).
    """
    qc.h(target)
    qc.t(target)
    qc.cx(control, target)
    qc.tdg(target)
    qc.cx(control, target)
    qc.h(target)
    qc.t(control)


def add_cv_dag(qc: QuantumCircuit, control: int, target: int) -> None:
    """Applies Controlled-V† (CV†) gate using Clifford+T decomposition (Fig. 1(b)).

    V† = sqrt(X)†. Controlled-V† applies V† on target when control is |1>.
    Decomposition: H(t), T_dag(t), CX(c, t), T(t), CX(c, t), H(t), T_dag(c).
    """
    qc.h(target)
    qc.tdg(target)
    qc.cx(control, target)
    qc.t(target)
    qc.cx(control, target)
    qc.h(target)
    qc.tdg(control)


def add_feynman(qc: QuantumCircuit, control: int, target: int) -> None:
    """Feynman Gate (reversible CNOT, FG).

    Maps (A, B) -> (A, A ^ B). Parity-preserving if control is invariant.
    """
    qc.cx(control, target)


def add_f2g(qc: QuantumCircuit, control: int, target1: int, target2: int) -> None:
    """Double Feynman Gate (Double CNOT, F2G).

    Maps (A, B, C) -> (A, A ^ B, A ^ C).
    Strictly parity-preserving: Parity_in = A ^ B ^ C,
    Parity_out = A ^ (A ^ B) ^ (A ^ C) = A ^ B ^ C.
    Used for fan-out and copying signals without destroying parity.
    """
    qc.cx(control, target1)
    qc.cx(control, target2)


def add_fredkin_ncv(qc: QuantumCircuit, control: int, target1: int, target2: int) -> None:
    """NCV Realization of Fredkin Gate (CSWAP) (Fig. 2(a)).

    Quantum Cost = 5. Swaps target1 and target2 when control is 1.
    """
    qc.cswap(control, target1, target2)


def add_fredkin_clifford_t(qc: QuantumCircuit, control: int, target1: int, target2: int) -> None:
    """Fault-Tolerant Clifford+T Realization of Fredkin Gate (Fig. 2(b)).

    T-count = 7, T-depth = 3 (with standard CCX layer compaction).
    """
    qc.cx(target2, target1)
    qc.h(target2)
    qc.cx(target1, target2)
    qc.tdg(target2)
    qc.cx(control, target2)
    qc.t(target2)
    qc.cx(target1, target2)
    qc.tdg(target2)
    qc.cx(control, target2)
    qc.t(target1)
    qc.t(target2)
    qc.cx(control, target1)
    qc.h(target2)
    qc.t(control)
    qc.tdg(target1)
    qc.cx(control, target1)
    qc.cx(target2, target1)


def build_fredkin_circuit(mode: str = "clifford_t") -> QuantumCircuit:
    """Constructs a 3-qubit Fredkin (CSWAP) gate circuit."""
    qc = QuantumCircuit(3, name="Fredkin_CSWAP")
    if mode == "clifford_t":
        add_fredkin_clifford_t(qc, 0, 1, 2)
    elif mode == "ncv":
        add_fredkin_ncv(qc, 0, 1, 2)
    elif mode == "native":
        qc.cswap(0, 1, 2)
    else:
        raise ValueError(f"Unknown Fredkin mode: {mode}")
    return qc
