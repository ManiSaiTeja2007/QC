"""Fundamental Quantum Gates and Reversible Elements."""

from .basic_gates import (
    add_cv,
    add_cv_dag,
    add_fredkin_ncv,
    add_fredkin_clifford_t,
    add_feynman,
    add_f2g,
    build_fredkin_circuit,
)

from .clifford_t_library import (
    count_t_gates,
    calculate_t_depth,
    get_circuit_metrics,
    is_clifford_t,
)

__all__ = [
    "add_cv",
    "add_cv_dag",
    "add_fredkin_ncv",
    "add_fredkin_clifford_t",
    "add_feynman",
    "add_f2g",
    "build_fredkin_circuit",
    "count_t_gates",
    "calculate_t_depth",
    "get_circuit_metrics",
    "is_clifford_t",
]
