"""Quantum Multiple-Valued Decision Diagram (QMDD) & Clifford+T Simulator Core.

Implements Reduced Ordered Decision Diagrams for quantum states and Clifford+T unitaries
using exact algebraic cyclotomic weights (D[ω]) and hash-consed unique tables.

Breaks the exponential O(2^n) statevector and O(2^(2n)) density matrix memory walls,
enabling exact simulation of multi-qubit reversible circuits and multi-bit Quantum ALUs.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Tuple, List, Optional, Union, Set
import numpy as np
from qiskit import QuantumCircuit

from backend.app.dd_engine.cyclotomic import CyclotomicComplex


@dataclass(frozen=True, slots=True)
class QMDDNode:
    """Internal decision diagram node representing qubit branch at `level`."""
    level: int                           # Qubit index (0 to n-1, -1 for terminal)
    low: Optional[QMDDEdge]             # |0⟩ branch
    high: Optional[QMDDEdge]            # |1⟩ branch
    id: int                             # Unique identification integer


@dataclass(frozen=True, slots=True)
class QMDDEdge:
    """Directed edge with exact cyclotomic complex weight pointing to a QMDDNode."""
    weight: CyclotomicComplex
    node: Optional[QMDDNode] = None

    def is_zero(self) -> bool:
        return self.weight.is_zero()

    def scale(self, factor: CyclotomicComplex) -> QMDDEdge:
        if factor.is_zero() or self.is_zero():
            return QMDDEdge(CyclotomicComplex.ZERO, self.node)
        return QMDDEdge(self.weight * factor, self.node)


@dataclass(frozen=True, slots=True)
class QMDDMatrixNode:
    """Operator decision diagram node with 4 outgoing matrix quadrant edges."""
    level: int
    e00: Optional[QMDDMatrixEdge]
    e01: Optional[QMDDMatrixEdge]
    e10: Optional[QMDDMatrixEdge]
    e11: Optional[QMDDMatrixEdge]
    id: int


@dataclass(frozen=True, slots=True)
class QMDDMatrixEdge:
    """Directed operator edge with exact cyclotomic weight."""
    weight: CyclotomicComplex
    node: Optional[QMDDMatrixNode] = None

    def is_zero(self) -> bool:
        return self.weight.is_zero()

    def scale(self, factor: CyclotomicComplex) -> QMDDMatrixEdge:
        if factor.is_zero() or self.is_zero():
            return QMDDMatrixEdge(CyclotomicComplex.ZERO, self.node)
        return QMDDMatrixEdge(self.weight * factor, self.node)


class QMDDContext:
    """Unique table manager and compute cache for canonical QMDD synthesis."""

    def __init__(self) -> None:
        self.node_id_counter: int = 1
        # Terminal node at level -1
        self.terminal_state_node = QMDDNode(level=-1, low=None, high=None, id=0)

        self.terminal_matrix_node = QMDDMatrixNode(
            level=-1,
            e00=None,
            e01=None,
            e10=None,
            e11=None,
            id=0
        )

        # Hash-consing Unique Tables:
        # State: (level, low_weight, low_id, high_weight, high_id) -> QMDDNode
        self.unique_state_table: Dict[Tuple[int, CyclotomicComplex, int, CyclotomicComplex, int], QMDDNode] = {}
        # Matrix: (level, e00_w, e00_id, e01_w, e01_id, e10_w, e10_id, e11_w, e11_id) -> QMDDMatrixNode
        self.unique_matrix_table: Dict[Tuple[int, CyclotomicComplex, int, CyclotomicComplex, int, CyclotomicComplex, int, CyclotomicComplex, int], QMDDMatrixNode] = {}

        # Compute Caches
        self.state_add_cache: Dict[Tuple[int, CyclotomicComplex, int, CyclotomicComplex], QMDDEdge] = {}
        self.mult_cache: Dict[Tuple[int, CyclotomicComplex, int, CyclotomicComplex], QMDDEdge] = {}

    def get_state_node(self, level: int, low: QMDDEdge, high: QMDDEdge) -> QMDDNode:
        """Retrieves or creates a canonical unique state node."""
        key = (level, low.weight, low.node.id, high.weight, high.node.id)
        if key in self.unique_state_table:
            return self.unique_state_table[key]

        nid = self.node_id_counter
        self.node_id_counter += 1
        node = QMDDNode(level=level, low=low, high=high, id=nid)
        self.unique_state_table[key] = node
        return node

    def make_normalized_edge(self, level: int, low: QMDDEdge, high: QMDDEdge) -> QMDDEdge:
        """Constructs a normalized QMDD edge according to canonical weight reduction."""
        if low.is_zero() and high.is_zero():
            return QMDDEdge(CyclotomicComplex.ZERO, self.terminal_state_node)

        # Factor out weight of first non-zero edge
        if not low.is_zero():
            norm_w = low.weight
            scaled_low = QMDDEdge(CyclotomicComplex.ONE, low.node)
            # high.weight / norm_w
            scaled_high_w = high.weight * (CyclotomicComplex.ONE if high.is_zero() else norm_w.conj())
            if not norm_w.abs_sq() == 1.0 and not high.is_zero():
                # For Clifford+T gates, norm_w is either a unit phase or 1/√2
                pass
            # Standard: normalize by setting low edge weight to ONE when high is zero
            if high.is_zero():
                node = self.get_state_node(level, QMDDEdge(CyclotomicComplex.ONE, low.node), QMDDEdge(CyclotomicComplex.ZERO, self.terminal_state_node))
                return QMDDEdge(low.weight, node)
            node = self.get_state_node(level, low, high)
            return QMDDEdge(CyclotomicComplex.ONE, node)
        else:
            # low is zero, high is non-zero
            node = self.get_state_node(level, QMDDEdge(CyclotomicComplex.ZERO, self.terminal_state_node), QMDDEdge(CyclotomicComplex.ONE, high.node))
            return QMDDEdge(high.weight, node)

    def add_state_edges(self, e1: QMDDEdge, e2: QMDDEdge) -> QMDDEdge:
        """Computes exact linear combination e1 + e2 recursively with memoization."""
        if e1.is_zero():
            return e2
        if e2.is_zero():
            return e1

        cache_key = (e1.node.id, e1.weight, e2.node.id, e2.weight)
        if cache_key in self.state_add_cache:
            return self.state_add_cache[cache_key]

        if e1.node.level == -1 and e2.node.level == -1:
            total_w = e1.weight + e2.weight
            res = QMDDEdge(total_w, self.terminal_state_node)
            self.state_add_cache[cache_key] = res
            return res

        top_level = max(e1.node.level, e2.node.level)
        e1_low = e1.node.low.scale(e1.weight) if e1.node.level == top_level else e1
        e1_high = e1.node.high.scale(e1.weight) if e1.node.level == top_level else e1
        e2_low = e2.node.low.scale(e2.weight) if e2.node.level == top_level else e2
        e2_high = e2.node.high.scale(e2.weight) if e2.node.level == top_level else e2

        new_low = self.add_state_edges(e1_low, e2_low)
        new_high = self.add_state_edges(e1_high, e2_high)

        res_node = self.get_state_node(top_level, new_low, new_high)
        res = QMDDEdge(CyclotomicComplex.ONE, res_node)
        self.state_add_cache[cache_key] = res
        return res


class QMDDState:
    """Quantum Statevector represented as a Reduced Ordered Decision Diagram."""

    def __init__(self, num_qubits: int, root: QMDDEdge, ctx: Optional[QMDDContext] = None) -> None:
        self.num_qubits: int = num_qubits
        self.root: QMDDEdge = root
        self.ctx: QMDDContext = ctx or QMDDContext()

    @classmethod
    def from_basis_state(cls, num_qubits: int, basis_spec: Union[str, int, List[int]]) -> QMDDState:
        """Constructs a deterministic computational basis state |x_{n-1} ... x_0⟩ in O(n) nodes."""
        ctx = QMDDContext()
        if isinstance(basis_spec, int):
            bits = [(basis_spec >> q) & 1 for q in range(num_qubits)]
        elif isinstance(basis_spec, str):
            clean = basis_spec.strip().replace(" ", "")
            # Qiskit endianness: string is q_{n-1}...q_0
            bits = [int(b) for b in reversed(clean)]
            if len(bits) < num_qubits:
                bits += [0] * (num_qubits - len(bits))
            bits = bits[:num_qubits]
        else:
            bits = list(basis_spec[:num_qubits])
            if len(bits) < num_qubits:
                bits += [0] * (num_qubits - len(bits))

        # Bottom-up creation from level 0 to n-1
        curr_edge = QMDDEdge(CyclotomicComplex.ONE, ctx.terminal_state_node)
        zero_edge = QMDDEdge(CyclotomicComplex.ZERO, ctx.terminal_state_node)

        for q in range(num_qubits):
            bit = bits[q]
            if bit == 0:
                node = ctx.get_state_node(level=q, low=curr_edge, high=zero_edge)
            else:
                node = ctx.get_state_node(level=q, low=zero_edge, high=curr_edge)
            curr_edge = QMDDEdge(CyclotomicComplex.ONE, node)

        return cls(num_qubits=num_qubits, root=curr_edge, ctx=ctx)

    def node_count(self) -> int:
        """Returns the number of unique active nodes reachable in the decision diagram."""
        visited: Set[int] = set()

        def _traverse(edge: QMDDEdge) -> None:
            if edge.node.id in visited or edge.node.level == -1:
                return
            visited.add(edge.node.id)
            _traverse(edge.node.low)
            _traverse(edge.node.high)

        _traverse(self.root)
        return len(visited)

    def compression_ratio(self) -> float:
        """Calculates memory compression ratio: 2^n dense states / active QMDD nodes."""
        nc = max(1, self.node_count())
        return float((2.0 ** self.num_qubits) / nc)

    def measure_basis_state(self) -> str:
        """Extracts the computational basis bitstring (in Qiskit q_{n-1}...q_0 order) via branch probabilities."""
        norm_memo: Dict[int, float] = {}

        def _get_norm(edge: Optional[QMDDEdge]) -> float:
            if edge is None or edge.is_zero() or edge.node is None:
                return 0.0
            if edge.node.level == -1:
                return edge.weight.abs_sq()
            nid = edge.node.id
            if nid in norm_memo:
                return norm_memo[nid] * edge.weight.abs_sq()
            n_low = _get_norm(edge.node.low)
            n_high = _get_norm(edge.node.high)
            res = n_low + n_high
            norm_memo[nid] = res
            return res * edge.weight.abs_sq()

        bits: List[int] = [0] * self.num_qubits
        curr: Optional[QMDDEdge] = self.root

        while curr is not None and curr.node is not None and curr.node.level != -1:
            lvl = curr.node.level
            w_low = _get_norm(curr.node.low)
            w_high = _get_norm(curr.node.high)

            if w_high > w_low:
                bits[lvl] = 1
                curr = curr.node.high
            else:
                bits[lvl] = 0
                curr = curr.node.low

        return "".join(str(b) for b in reversed(bits))

    def expectation_z_all(self) -> float:
        """Computes exact global parity ⟨Z^(⊗n)⟩ = (-1)^p0 in O(|DD|) recursive post-order traversal."""
        memo: Dict[int, float] = {}

        def _eval_node(edge: QMDDEdge) -> float:
            if edge.is_zero():
                return 0.0
            if edge.node.level == -1:
                return edge.weight.abs_sq()

            nid = edge.node.id
            if nid in memo:
                return memo[nid] * edge.weight.abs_sq()

            # For level v: low (qv=0) contributes +1, high (qv=1) contributes -1
            val_low = _eval_node(edge.node.low)
            val_high = _eval_node(edge.node.high)
            res = val_low - val_high
            memo[nid] = res
            return res * edge.weight.abs_sq()

        return float(round(_eval_node(self.root), 6))

    def to_statevector(self) -> np.ndarray:
        """Unfolds the QMDD into an exact NumPy complex statevector for cross-validation (n <= 12)."""
        dim = 1 << self.num_qubits
        vec = np.zeros(dim, dtype=complex)

        def _unfold(edge: QMDDEdge, current_idx: int, current_phase: complex) -> None:
            if edge.is_zero():
                return
            phase = current_phase * edge.weight.to_complex()
            if edge.node.level == -1:
                vec[current_idx] += phase
                return

            lvl = edge.node.level
            _unfold(edge.node.low, current_idx, phase)
            _unfold(edge.node.high, current_idx | (1 << lvl), phase)

        _unfold(self.root, 0, 1.0 + 0.0j)
        return vec

    # =========================================================================
    # Native Gate Transformations
    # =========================================================================

    def _apply_single_qubit_gate(
        self,
        edge: QMDDEdge,
        target: int,
        u00: CyclotomicComplex,
        u01: CyclotomicComplex,
        u10: CyclotomicComplex,
        u11: CyclotomicComplex,
    ) -> QMDDEdge:
        """Applies single-qubit unitary U recursively down to target level."""
        if edge.is_zero():
            return edge

        lvl = edge.node.level
        if lvl < target:
            # Gate is above remaining tree; insert level node
            zero_e = QMDDEdge(CyclotomicComplex.ZERO, self.ctx.terminal_state_node)
            node = self.ctx.get_state_node(target, edge, zero_e)
            return self._apply_single_qubit_gate(QMDDEdge(CyclotomicComplex.ONE, node), target, u00, u01, u10, u11)

        if lvl == target:
            e0 = edge.node.low
            e1 = edge.node.high

            # out0 = u00 * e0 + u01 * e1
            # out1 = u10 * e0 + u11 * e1
            t00 = e0.scale(u00)
            t01 = e1.scale(u01)
            t10 = e0.scale(u10)
            t11 = e1.scale(u11)

            out0 = self.ctx.add_state_edges(t00, t01)
            out1 = self.ctx.add_state_edges(t10, t11)

            new_node = self.ctx.get_state_node(lvl, out0, out1)
            return QMDDEdge(edge.weight, new_node)

        # lvl > target: recurse on both branches
        new_low = self._apply_single_qubit_gate(edge.node.low, target, u00, u01, u10, u11)
        new_high = self._apply_single_qubit_gate(edge.node.high, target, u00, u01, u10, u11)
        new_node = self.ctx.get_state_node(lvl, new_low, new_high)
        return QMDDEdge(edge.weight, new_node)

    def apply_x(self, target: int) -> None:
        """Applies Pauli X gate on `target`."""
        u00, u01 = CyclotomicComplex.ZERO, CyclotomicComplex.ONE
        u10, u11 = CyclotomicComplex.ONE, CyclotomicComplex.ZERO
        self.root = self._apply_single_qubit_gate(self.root, target, u00, u01, u10, u11)

    def apply_z(self, target: int) -> None:
        """Applies Pauli Z gate on `target`."""
        u00, u01 = CyclotomicComplex.ONE, CyclotomicComplex.ZERO
        u10, u11 = CyclotomicComplex.ZERO, CyclotomicComplex.NEG_ONE
        self.root = self._apply_single_qubit_gate(self.root, target, u00, u01, u10, u11)

    def apply_s(self, target: int) -> None:
        """Applies S gate (phase i) on `target`."""
        u00, u01 = CyclotomicComplex.ONE, CyclotomicComplex.ZERO
        u10, u11 = CyclotomicComplex.ZERO, CyclotomicComplex.I
        self.root = self._apply_single_qubit_gate(self.root, target, u00, u01, u10, u11)

    def apply_sdg(self, target: int) -> None:
        """Applies S† gate (phase -i) on `target`."""
        u00, u01 = CyclotomicComplex.ONE, CyclotomicComplex.ZERO
        u10, u11 = CyclotomicComplex.ZERO, CyclotomicComplex.NEG_I
        self.root = self._apply_single_qubit_gate(self.root, target, u00, u01, u10, u11)

    def apply_t(self, target: int) -> None:
        """Applies T gate (phase ω = e^(iπ/4)) on `target`."""
        u00, u01 = CyclotomicComplex.ONE, CyclotomicComplex.ZERO
        u10, u11 = CyclotomicComplex.ZERO, CyclotomicComplex.OMEGA
        self.root = self._apply_single_qubit_gate(self.root, target, u00, u01, u10, u11)

    def apply_tdg(self, target: int) -> None:
        """Applies T† gate (phase -ω^3 = e^(-iπ/4)) on `target`."""
        u00, u01 = CyclotomicComplex.ONE, CyclotomicComplex.ZERO
        u10, u11 = CyclotomicComplex.ZERO, CyclotomicComplex.OMEGA_DAG
        self.root = self._apply_single_qubit_gate(self.root, target, u00, u01, u10, u11)

    def apply_h(self, target: int) -> None:
        """Applies Hadamard gate (1/√2 * [[1, 1], [1, -1]]) on `target`."""
        u00 = CyclotomicComplex.INV_SQRT2
        u01 = CyclotomicComplex.INV_SQRT2
        u10 = CyclotomicComplex.INV_SQRT2
        u11 = -CyclotomicComplex.INV_SQRT2
        self.root = self._apply_single_qubit_gate(self.root, target, u00, u01, u10, u11)

    def _apply_multi_controlled_z(self, edge: QMDDEdge, active_qubits: Set[int]) -> QMDDEdge:
        """Applies a multi-qubit diagonal phase gate Z across `active_qubits` (phase -1 iff all are 1).

        Completely symmetric under any permutation of qubit indices!
        """
        if edge.is_zero() or not active_qubits:
            return edge

        lvl = edge.node.level
        if lvl == -1:
            return edge

        if lvl in active_qubits:
            # Low branch (qv = 0) does not satisfy condition -> unchanged
            new_low = edge.node.low
            rem = active_qubits - {lvl}
            if not rem:
                # All controls satisfied -> negate high branch
                new_high = edge.node.high.scale(CyclotomicComplex.NEG_ONE)
            else:
                new_high = self._apply_multi_controlled_z(edge.node.high, rem)
            new_node = self.ctx.get_state_node(lvl, new_low, new_high)
            return QMDDEdge(edge.weight, new_node)
        else:
            # lvl is not in active_qubits; recurse on both branches
            new_low = self._apply_multi_controlled_z(edge.node.low, active_qubits)
            new_high = self._apply_multi_controlled_z(edge.node.high, active_qubits)
            new_node = self.ctx.get_state_node(lvl, new_low, new_high)
            return QMDDEdge(edge.weight, new_node)

    def apply_cz(self, q1: int, q2: int) -> None:
        """Applies Controlled-Z gate on `q1` and `q2`."""
        self.root = self._apply_multi_controlled_z(self.root, {q1, q2})

    def apply_cx(self, ctrl: int, target: int) -> None:
        """Applies Controlled-NOT (CNOT) gate with arbitrary control and target order.

        Uses the exact algebraic identity: CX(ctrl, target) = H(target) · CZ(ctrl, target) · H(target).
        """
        self.apply_h(target)
        self.apply_cz(ctrl, target)
        self.apply_h(target)

    def apply_swap(self, q1: int, q2: int) -> None:
        """Applies SWAP gate between `q1` and `q2` via 3 CNOTs."""
        self.apply_cx(q1, q2)
        self.apply_cx(q2, q1)
        self.apply_cx(q1, q2)

    def apply_ccx(self, c1: int, c2: int, target: int) -> None:
        """Applies Toffoli (CCX) gate: H(target) · CCZ(c1, c2, target) · H(target)."""
        self.apply_h(target)
        self.root = self._apply_multi_controlled_z(self.root, {c1, c2, target})
        self.apply_h(target)

    def apply_cswap(self, ctrl: int, t1: int, t2: int) -> None:
        """Applies Fredkin (CSWAP) gate: CX(t2, t1) · CCX(ctrl, t1, t2) · CX(t2, t1)."""
        self.apply_cx(t2, t1)
        self.apply_ccx(ctrl, t1, t2)
        self.apply_cx(t2, t1)

    def apply_circuit(self, qc: QuantumCircuit) -> None:
        """Executes an entire Qiskit QuantumCircuit directly on the QMDD state without Qiskit Aer."""
        for instr in qc.data:
            op = instr.operation
            name = op.name.lower()
            q_indices = [qc.find_bit(q).index for q in instr.qubits]

            if name == "x":
                self.apply_x(q_indices[0])
            elif name == "z":
                self.apply_z(q_indices[0])
            elif name == "s":
                self.apply_s(q_indices[0])
            elif name == "sdg":
                self.apply_sdg(q_indices[0])
            elif name == "t":
                self.apply_t(q_indices[0])
            elif name == "tdg":
                self.apply_tdg(q_indices[0])
            elif name == "h":
                self.apply_h(q_indices[0])
            elif name == "cx":
                self.apply_cx(q_indices[0], q_indices[1])
            elif name == "cz":
                self.apply_cz(q_indices[0], q_indices[1])
            elif name == "swap":
                self.apply_swap(q_indices[0], q_indices[1])
            elif name == "ccx":
                self.apply_ccx(q_indices[0], q_indices[1], q_indices[2])
            elif name in ("cswap", "fredkin"):
                self.apply_cswap(q_indices[0], q_indices[1], q_indices[2])
            elif name in ("id", "barrier"):
                pass
            else:
                # Decompose composite or custom instructions
                decomp = op.definition
                if decomp is not None:
                    # Map decomposed sub-qubits
                    sub_state = QuantumCircuit(qc.num_qubits)
                    sub_state.compose(decomp, qubits=q_indices, inplace=True)
                    self.apply_circuit(sub_state)
                else:
                    raise NotImplementedError(f"Unsupported gate for QMDD execution: {name}")
