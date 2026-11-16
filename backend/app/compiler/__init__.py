"""Quantum Electronic Design Automation (Q-EDA) Reversible Logic Synthesis & Compiler Package.

Modules:
  - esop_synthesizer: Boolean AST / Reed-Muller / Positive-Davio ESOP expansion and cube optimizer.
  - parity_mapper: Maps ESOP cubes to strictly parity-preserving Clifford+T reversible logic gadgets.
  - pebble_scheduler: Reversible pebble game Bennett uncomputation engine with Pareto depth/ancilla scheduling.
"""

from backend.app.compiler.esop_synthesizer import (
    ESOPCube,
    ESOPNetwork,
    truth_table_to_esop,
    optimize_esop_cubes,
    parse_verilog_assign_to_esop,
)
from backend.app.compiler.parity_mapper import (
    build_parity_preserving_circuit,
    is_circuit_clifford_t,
)
from backend.app.compiler.pebble_scheduler import (
    PebbleStrategy,
    schedule_pebble_uncomputation,
    compile_boolean_to_parity_clifford_t,
    CompiledCircuitArtifact,
)

__all__ = [
    "ESOPCube",
    "ESOPNetwork",
    "truth_table_to_esop",
    "optimize_esop_cubes",
    "parse_verilog_assign_to_esop",
    "build_parity_preserving_circuit",
    "is_circuit_clifford_t",
    "PebbleStrategy",
    "schedule_pebble_uncomputation",
    "compile_boolean_to_parity_clifford_t",
    "CompiledCircuitArtifact",
]
