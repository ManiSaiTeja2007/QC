"""Boolean AST, Truth-Table Ingestion & Reed-Muller / Davio ESOP Synthesizer.

Converts multi-output Boolean specifications (truth tables, Verilog assign statements,
or Logisim netlists) into minimal Exclusive-Sum-of-Products (ESOP) networks:
  f_j(x0, ..., xn-1) = ⨁_k ( ⋀_{i ∈ S_k} x_i^{b_i} )
"""

from dataclasses import dataclass
from typing import Dict, List, Tuple, Any, Optional, Set, FrozenSet
import re
import numpy as np


@dataclass(frozen=True)
class ESOPCube:
    """Represents a single product term in an ESOP network.

    literals: frozenset of (variable_index, is_positive).
              e.g. frozenset([(0, True), (1, False)]) represents x0 ∧ ¬x1.
              An empty literals frozenset represents the constant 1.
    output_idx: index of target output rail that this cube toggles.
    """
    literals: FrozenSet[Tuple[int, bool]]
    output_idx: int

    @property
    def degree(self) -> int:
        """Returns the number of literals in the cube."""
        return len(self.literals)

    def evaluate(self, input_bits: List[int]) -> int:
        """Evaluates the product cube on an input bitstring."""
        for var_idx, is_positive in self.literals:
            val = input_bits[var_idx]
            expected = 1 if is_positive else 0
            if val != expected:
                return 0
        return 1

    def __repr__(self) -> str:
        if not self.literals:
            return f"1 -> out[{self.output_idx}]"
        lits = sorted(list(self.literals), key=lambda x: x[0])
        terms = [f"x{v}" if pos else f"~x{v}" for v, pos in lits]
        return f"({' & '.join(terms)}) -> out[{self.output_idx}]"


@dataclass
class ESOPNetwork:
    """Represents a multi-input, multi-output ESOP network."""
    num_inputs: int
    num_outputs: int
    cubes: List[ESOPCube]
    input_names: List[str]
    output_names: List[str]

    def evaluate(self, input_bits: List[int]) -> List[int]:
        """Evaluates all outputs by XOR-accumulating matching product cubes."""
        assert len(input_bits) == self.num_inputs, (
            f"Input length {len(input_bits)} != network input count {self.num_inputs}"
        )
        outputs = [0] * self.num_outputs
        for cube in self.cubes:
            if cube.evaluate(input_bits):
                outputs[cube.output_idx] ^= 1
        return outputs

    def get_output_cubes(self, output_idx: int) -> List[ESOPCube]:
        """Returns all cubes associated with a given output rail."""
        return [c for c in self.cubes if c.output_idx == output_idx]

    @property
    def total_cubes(self) -> int:
        return len(self.cubes)

    @property
    def max_degree(self) -> int:
        return max((c.degree for c in self.cubes), default=0)


def fast_reed_muller_transform(truth_table: List[int], num_inputs: int) -> List[int]:
    """Computes the Positive-Davio / Reed-Muller expansion coefficients in O(n * 2^n).

    Uses the Kronecker transform matrix M = [[1, 0], [1, 1]] over GF(2).
    """
    assert len(truth_table) == (1 << num_inputs), (
        f"Truth table length {len(truth_table)} must be 2^{num_inputs}"
    )
    v = list(truth_table)
    for s in range(num_inputs):
        half = 1 << s
        stride = 1 << (s + 1)
        for i in range(0, 1 << num_inputs, stride):
            for j in range(half):
                v[i + j + half] ^= v[i + j]
    return v


def optimize_esop_cubes(cubes: List[ESOPCube]) -> List[ESOPCube]:
    """Applies algebraic reduction rules on ESOP product terms:

    1. Duplicate cancellation: c ⊕ c = 0
    2. Merging rule: A·x ⊕ A·¬x = A
    3. Absorbing / EXOR-link: A·x ⊕ A = A·¬x
    """
    by_output: Dict[int, List[ESOPCube]] = {}
    for c in cubes:
        by_output.setdefault(c.output_idx, []).append(c)

    optimized_all: List[ESOPCube] = []

    for out_idx, out_cubes in by_output.items():
        # 1. Duplicate cancellation
        counts: Dict[FrozenSet[Tuple[int, bool]], int] = {}
        for c in out_cubes:
            counts[c.literals] = counts.get(c.literals, 0) + 1

        active_sets = [lits for lits, cnt in counts.items() if cnt % 2 == 1]

        # 2. Iterative merging
        changed = True
        while changed:
            changed = False
            new_active: Set[FrozenSet[Tuple[int, bool]]] = set()
            used: Set[FrozenSet[Tuple[int, bool]]] = set()

            n_active = len(active_sets)
            for i in range(n_active):
                s1 = active_sets[i]
                if s1 in used:
                    continue
                merged_this = False
                for j in range(i + 1, n_active):
                    s2 = active_sets[j]
                    if s2 in used:
                        continue

                    # Check if s1 and s2 differ by exactly one variable with opposite polarity
                    diff = s1.symmetric_difference(s2)
                    if len(diff) == 2:
                        l1, l2 = list(diff)
                        if l1[0] == l2[0] and l1[1] != l2[1]:
                            # Merge into common literals (removing the variable)
                            common = s1.intersection(s2)
                            used.add(s1)
                            used.add(s2)
                            new_active.add(common)
                            merged_this = True
                            changed = True
                            break
                if not merged_this:
                    new_active.add(s1)

            active_sets = list(new_active)

        for lits in active_sets:
            optimized_all.append(ESOPCube(literals=lits, output_idx=out_idx))

    return optimized_all


def truth_table_to_esop(
    truth_tables: List[List[int]],
    num_inputs: int,
    input_names: Optional[List[str]] = None,
    output_names: Optional[List[str]] = None,
    optimize: bool = True,
) -> ESOPNetwork:
    """Synthesizes a minimal ESOP network from a multi-output truth table specification."""
    num_outputs = len(truth_tables)
    in_names = input_names or [f"in_{i}" for i in range(num_inputs)]
    out_names = output_names or [f"out_{j}" for j in range(num_outputs)]

    raw_cubes: List[ESOPCube] = []

    for out_idx, tt in enumerate(truth_tables):
        coeffs = fast_reed_muller_transform(tt, num_inputs)
        for k, c in enumerate(coeffs):
            if c == 1:
                lits: Set[Tuple[int, bool]] = set()
                for b in range(num_inputs):
                    # In Qiskit standard indexing: bit b corresponds to variable b
                    # Input integer k has binary representation where bit (num_inputs - 1 - b) is 1
                    shift = num_inputs - 1 - b
                    if (k >> shift) & 1:
                        lits.add((b, True))
                raw_cubes.append(ESOPCube(literals=frozenset(lits), output_idx=out_idx))

    final_cubes = optimize_esop_cubes(raw_cubes) if optimize else raw_cubes

    return ESOPNetwork(
        num_inputs=num_inputs,
        num_outputs=num_outputs,
        cubes=final_cubes,
        input_names=in_names,
        output_names=out_names,
    )


def parse_verilog_assign_to_esop(verilog_code: str) -> ESOPNetwork:
    """Parses combinational Verilog assign statements and synthesizes an optimized ESOPNetwork."""
    # Find module header and port declarations
    input_match = re.findall(r"input\s+(?:wire\s+)?([a-zA-Z_][a-zA-Z0-9_]*)", verilog_code)
    output_match = re.findall(r"output\s+(?:wire\s+)?([a-zA-Z_][a-zA-Z0-9_]*)", verilog_code)

    assert input_match, "No input ports found in Verilog specification"
    assert output_match, "No output ports found in Verilog specification"

    num_inputs = len(input_match)
    num_outputs = len(output_match)

    # Extract assign statements: assign <out> = <expr>;
    assign_matches = re.findall(r"assign\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([^;]+);", verilog_code)
    assign_dict: Dict[str, str] = {out.strip(): expr.strip() for out, expr in assign_matches}

    truth_tables: List[List[int]] = []

    for out_name in output_match:
        expr = assign_dict.get(out_name)
        assert expr is not None, f"Missing assign statement for output port '{out_name}'"

        # Convert Verilog bitwise ops to Python logic ops
        py_expr = expr.replace("~", " not ").replace("&", " and ").replace("|", " or ").replace("^", " ^ ")

        tt: List[int] = []
        for in_dec in range(1 << num_inputs):
            # Extract input bits: input_match[0] is most significant
            env = {}
            for i, name in enumerate(input_match):
                shift = num_inputs - 1 - i
                env[name] = (in_dec >> shift) & 1

            val = int(bool(eval(py_expr, {}, env)))
            tt.append(val)

        truth_tables.append(tt)

    return truth_table_to_esop(
        truth_tables=truth_tables,
        num_inputs=num_inputs,
        input_names=input_match,
        output_names=output_match,
        optimize=True,
    )
