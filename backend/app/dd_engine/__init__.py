"""Quantum Multiple-Valued Decision Diagram (QMDD) & Clifford+T Simulator Package.

Exports:
  - CyclotomicComplex: Exact cyclotomic ring D[ω] = Z[ω, 1/√2] arithmetic.
  - QMDDNode, QMDDEdge: Decision diagram node and weighted edge primitives.
  - QMDDContext: Unique table manager and memoized compute caches.
  - QMDDState: Quantum statevector decision diagram representation.
  - build_multibit_alu_circuit: Parameterized N-bit Quantum ALU circuit generator.
  - simulate_multibit_alu_qmdd: Native QMDD execution engine for N-bit ALUs.
"""

from backend.app.dd_engine.cyclotomic import CyclotomicComplex
from backend.app.dd_engine.qmdd import (
    QMDDNode,
    QMDDEdge,
    QMDDMatrixNode,
    QMDDMatrixEdge,
    QMDDContext,
    QMDDState,
)
from backend.app.dd_engine.multibit_alu import (
    compute_golden_alu_result,
    get_operation_controls,
    build_multibit_alu_circuit,
    simulate_multibit_alu_qmdd,
)

__all__ = [
    "CyclotomicComplex",
    "QMDDNode",
    "QMDDEdge",
    "QMDDMatrixNode",
    "QMDDMatrixEdge",
    "QMDDContext",
    "QMDDState",
    "compute_golden_alu_result",
    "get_operation_controls",
    "build_multibit_alu_circuit",
    "simulate_multibit_alu_qmdd",
]
