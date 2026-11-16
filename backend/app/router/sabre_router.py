"""Hardware-Topology-Aware SABRE Routing & Parity-Safe SWAP Decomposition.

Implements:
  1. NoiseAwarePlacement: Maps high-interaction logical qubits to minimum-error,
     tightly connected physical transmon subgraphs on IBM Heavy-Hex and Grid QPUs.
  2. ParitySafeSabreRouter: Bidirectional SABRE heuristic search with lookahead window,
     decay penalties to prevent thrashing, and strict 3-CNOT SWAP decomposition
     guaranteeing 100% preservation of the global parity invariant (P_in = P_out).
  3. RoutedCircuitArtifact: Complete routing telemetry including physical circuit,
     layout maps, hardware latency, estimated fidelity, and edge SWAP congestion heatmap.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional, Any
from collections import deque
import numpy as np

from qiskit import QuantumCircuit, QuantumRegister
from qiskit.circuit import CircuitInstruction, Qubit

from backend.app.router.topology_graph import (
    TopologyGraph,
    CouplingEdge,
    PhysicalQubitNode,
    build_all_to_all_topology,
    build_grid_topology,
    build_heavy_hex_topology,
)


@dataclass
class RoutedCircuitArtifact:
    """Comprehensive artifact containing routed quantum circuit and hardware telemetry."""
    routed_circuit: QuantumCircuit
    topology_name: str
    initial_layout: Dict[int, int]   # logical -> physical
    final_layout: Dict[int, int]     # logical -> physical
    num_swaps: int
    added_cx_count: int
    depth: int
    duration_ns: float
    estimated_fidelity: float
    edge_swap_heatmap: Dict[Tuple[int, int], int] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Serializes routing artifact for REST API and Three.js visualizer."""
        return {
            "topology": self.topology_name,
            "num_qubits": self.routed_circuit.num_qubits,
            "initial_layout": {str(k): v for k, v in self.initial_layout.items()},
            "final_layout": {str(k): v for k, v in self.final_layout.items()},
            "num_swaps": self.num_swaps,
            "added_cx_count": self.added_cx_count,
            "depth": self.depth,
            "duration_ns": round(self.duration_ns, 1),
            "estimated_fidelity": round(self.estimated_fidelity, 5),
            "heatmap": [
                {"u": u, "v": v, "swaps": count}
                for (u, v), count in sorted(self.edge_swap_heatmap.items())
            ],
        }


@dataclass
class _GateRecord:
    """Internal lightweight representation of a circuit gate."""
    id: int
    name: str
    logical_qubits: List[int]
    params: List[float] = field(default_factory=list)


class NoiseAwarePlacement:
    """Extracts logical qubit interaction frequency and finds noise-optimal initial placement."""

    def __init__(self, topology: TopologyGraph) -> None:
        self.topology = topology

    def extract_interaction_graph(self, circuit: QuantumCircuit) -> Dict[Tuple[int, int], float]:
        """Counts two-qubit gate interactions between logical qubit pairs."""
        interactions: Dict[Tuple[int, int], float] = {}
        for inst in circuit.data:
            qubits = inst.qubits
            if len(qubits) == 2:
                q0 = circuit.find_bit(qubits[0]).index
                q1 = circuit.find_bit(qubits[1]).index
                pair = (min(q0, q1), max(q0, q1))
                weight = 1.0
                if inst.operation.name.lower() in ("cx", "cz", "swap"):
                    weight = 1.0
                interactions[pair] = interactions.get(pair, 0.0) + weight
        return interactions

    def find_initial_placement(
        self,
        circuit: QuantumCircuit,
        noise_aware: bool = True,
    ) -> Dict[int, int]:
        """Computes initial mapping from logical qubit index to physical qubit index."""
        num_logical = circuit.num_qubits
        if num_logical > self.topology.num_qubits:
            raise ValueError(
                f"Logical circuit has {num_logical} qubits, but topology has only {self.topology.num_qubits}"
            )

        if not noise_aware:
            # Trivial identity layout
            return {i: i for i in range(num_logical)}

        interactions = self.extract_interaction_graph(circuit)

        # Logical qubit total interaction traffic
        logical_traffic: Dict[int, float] = {i: 0.0 for i in range(num_logical)}
        for (q0, q1), w in interactions.items():
            if q0 < num_logical:
                logical_traffic[q0] += w
            if q1 < num_logical:
                logical_traffic[q1] += w

        # Sort logical qubits by descending traffic
        sorted_logical = sorted(range(num_logical), key=lambda q: logical_traffic[q], reverse=True)

        # Search for best physical subgraph of size num_logical
        best_root = 0
        best_subgraph_cost = 1e9
        best_physical_nodes: List[int] = []

        # Evaluate candidate connected subgraphs grown around each physical qubit
        for root in range(self.topology.num_qubits):
            # Grow connected subgraph via greedy lowest noise distance
            subgraph: List[int] = [root]
            candidates: Set[int] = set(self.topology.adjacency[root])

            while len(subgraph) < num_logical and candidates:
                # Pick candidate with lowest average noise distance to current subgraph
                best_cand = -1
                best_cand_dist = 1e9
                for c in candidates:
                    avg_w = sum(self.topology.noise_distance(c, s) for s in subgraph) / len(subgraph)
                    ro = self.topology.nodes[c].readout_err
                    cost = avg_w + ro * 10.0
                    if cost < best_cand_dist:
                        best_cand_dist = cost
                        best_cand = c

                if best_cand == -1:
                    break

                subgraph.append(best_cand)
                candidates.remove(best_cand)
                for neighbor in self.topology.adjacency[best_cand]:
                    if neighbor not in subgraph:
                        candidates.add(neighbor)

            if len(subgraph) == num_logical:
                # Evaluate total subgraph noise cost
                total_cost = 0.0
                for u in subgraph:
                    total_cost += self.topology.nodes[u].readout_err * 5.0
                    for v in subgraph:
                        if u < v and self.topology.are_adjacent(u, v):
                            edge = self.topology.edge_map.get((u, v))
                            total_cost += edge.cx_error if edge else 0.012

                if total_cost < best_subgraph_cost:
                    best_subgraph_cost = total_cost
                    best_root = root
                    best_physical_nodes = list(subgraph)

        if len(best_physical_nodes) < num_logical:
            # Fallback to first num_logical nodes
            best_physical_nodes = list(range(num_logical))

        # Assign logical qubits to physical nodes in chosen subgraph
        # Central physical node (lowest sum of distances to other nodes in subgraph) gets highest traffic logical qubit
        phys_centrality = {
            p: sum(self.topology.distance(p, other) for other in best_physical_nodes)
            for p in best_physical_nodes
        }
        sorted_physical = sorted(best_physical_nodes, key=lambda p: phys_centrality[p])

        mapping: Dict[int, int] = {}
        assigned_phys: Set[int] = set()

        for log_q in sorted_logical:
            if not mapping:
                # First node: most central physical qubit
                mapping[log_q] = sorted_physical[0]
                assigned_phys.add(sorted_physical[0])
            else:
                # Find physical qubit that minimizes interaction-weighted distance to already placed logical qubits
                best_p = -1
                best_placement_score = 1e9
                for cand_p in best_physical_nodes:
                    if cand_p in assigned_phys:
                        continue
                    score = 0.0
                    for placed_l, placed_p in mapping.items():
                        pair = (min(log_q, placed_l), max(log_q, placed_l))
                        traffic = interactions.get(pair, 0.1)
                        dist = self.topology.distance(cand_p, placed_p)
                        noise = self.topology.noise_distance(cand_p, placed_p)
                        score += traffic * (dist + noise * 2.0)
                    if score < best_placement_score:
                        best_placement_score = score
                        best_p = cand_p

                if best_p == -1:
                    # Pick any unassigned
                    for cand_p in sorted_physical:
                        if cand_p not in assigned_phys:
                            best_p = cand_p
                            break

                mapping[log_q] = best_p
                assigned_phys.add(best_p)

        return mapping


class ParitySafeSabreRouter:
    """Bidirectional SABRE router enforcing strict 3-CNOT parity-preserving SWAP decomposition."""

    def __init__(
        self,
        topology: TopologyGraph,
        lookahead_size: int = 20,
        extended_weight: float = 0.5,
        decay_delta: float = 0.15,
        decay_reset_period: int = 5,
    ) -> None:
        self.topology = topology
        self.lookahead_size = lookahead_size
        self.extended_weight = extended_weight
        self.decay_delta = decay_delta
        self.decay_reset_period = decay_reset_period

    def _circuit_to_records(self, circuit: QuantumCircuit) -> List[_GateRecord]:
        """Converts Qiskit QuantumCircuit into sequential gate records."""
        records: List[_GateRecord] = []
        for idx, inst in enumerate(circuit.data):
            q_indices = [circuit.find_bit(q).index for q in inst.qubits]
            params = [float(p) for p in inst.operation.params if isinstance(p, (int, float))]
            records.append(_GateRecord(
                id=idx,
                name=inst.operation.name.upper(),
                logical_qubits=q_indices,
                params=params,
            ))
        return records

    def _build_dag(self, records: List[_GateRecord], num_qubits: int) -> Tuple[
        Dict[int, Set[int]], Dict[int, Set[int]], Dict[int, int]
    ]:
        """Constructs DAG dependency structures for the gate records."""
        predecessors: Dict[int, Set[int]] = {r.id: set() for r in records}
        successors: Dict[int, Set[int]] = {r.id: set() for r in records}
        in_degree: Dict[int, int] = {r.id: 0 for r in records}

        last_gate_on_qubit: Dict[int, int] = {}
        for r in records:
            preds: Set[int] = set()
            for q in r.logical_qubits:
                if q in last_gate_on_qubit:
                    preds.add(last_gate_on_qubit[q])
            for p in preds:
                predecessors[r.id].add(p)
                successors[p].add(r.id)
            in_degree[r.id] = len(preds)
            for q in r.logical_qubits:
                last_gate_on_qubit[q] = r.id

        return predecessors, successors, in_degree

    def _run_sabre_pass(
        self,
        records: List[_GateRecord],
        num_logical: int,
        initial_layout: Dict[int, int],
        collect_circuit: bool = True,
    ) -> Tuple[QuantumCircuit, Dict[int, int], int, Dict[Tuple[int, int], int]]:
        """Executes a single SABRE routing pass (forward or backward)."""
        _, successors, in_degree = self._build_dag(records, num_logical)
        record_map = {r.id: r for r in records}

        # Current layout: logical -> physical, and reverse: physical -> logical
        layout = dict(initial_layout)
        reverse_layout: Dict[int, Optional[int]] = {p: None for p in range(self.topology.num_qubits)}
        for lq, pq in layout.items():
            reverse_layout[pq] = lq

        # Front layer: gates with in_degree == 0
        front_layer: Set[int] = {r.id for r in records if in_degree[r.id] == 0}

        # Dynamic decay counters to prevent SWAP thrashing
        decay: Dict[int, float] = {p: 1.0 for p in range(self.topology.num_qubits)}

        # Output routed circuit
        qr = QuantumRegister(self.topology.num_qubits, "q")
        routed_qc = QuantumCircuit(qr, name="routed_circuit")

        num_swaps = 0
        swap_heatmap: Dict[Tuple[int, int], int] = {}
        step_count = 0

        while front_layer and num_swaps < 1000:
            # 1. Execute all ready gates that are physically executable
            executed_any = True
            while executed_any and front_layer:
                executed_any = False
                executable_gates: List[int] = []

                for gid in sorted(front_layer):
                    g = record_map[gid]
                    if len(g.logical_qubits) == 1:
                        # 1Q gates are always executable at their physical location
                        executable_gates.append(gid)
                    elif len(g.logical_qubits) == 2:
                        p0 = layout[g.logical_qubits[0]]
                        p1 = layout[g.logical_qubits[1]]
                        if self.topology.are_adjacent(p0, p1):
                            executable_gates.append(gid)

                for gid in executable_gates:
                    g = record_map[gid]
                    front_layer.remove(gid)
                    executed_any = True

                    if collect_circuit:
                        phys_qubits = [qr[layout[q]] for q in g.logical_qubits]
                        op_name = g.name.lower()
                        if op_name == "cx":
                            routed_qc.cx(phys_qubits[0], phys_qubits[1])
                        elif op_name == "cz":
                            routed_qc.cz(phys_qubits[0], phys_qubits[1])
                        elif op_name == "h":
                            routed_qc.h(phys_qubits[0])
                        elif op_name == "x":
                            routed_qc.x(phys_qubits[0])
                        elif op_name == "z":
                            routed_qc.z(phys_qubits[0])
                        elif op_name == "s":
                            routed_qc.s(phys_qubits[0])
                        elif op_name == "sdg":
                            routed_qc.sdg(phys_qubits[0])
                        elif op_name == "t":
                            routed_qc.t(phys_qubits[0])
                        elif op_name == "tdg":
                            routed_qc.tdg(phys_qubits[0])
                        else:
                            # Generic fallback
                            routed_qc.append(CircuitInstruction(inst=g.name, qubits=phys_qubits))

                    # Update successors
                    for s_id in successors[gid]:
                        in_degree[s_id] -= 1
                        if in_degree[s_id] == 0:
                            front_layer.add(s_id)

            if not front_layer:
                break

            # 2. Compute extended lookahead set E
            extended_set: Set[int] = set()
            layer_queue = deque(sorted(front_layer))
            visited_ext: Set[int] = set(front_layer)

            while layer_queue and len(extended_set) < self.lookahead_size:
                curr_id = layer_queue.popleft()
                for succ_id in successors[curr_id]:
                    if succ_id not in visited_ext:
                        visited_ext.add(succ_id)
                        extended_set.add(succ_id)
                        layer_queue.append(succ_id)

            # 3. Find candidate SWAPs
            # Active physical qubits involved in front layer
            active_phys: Set[int] = set()
            for gid in front_layer:
                g = record_map[gid]
                for q in g.logical_qubits:
                    active_phys.add(layout[q])

            candidate_swaps: List[Tuple[int, int]] = []
            for edge in self.topology.edges:
                u, v = edge.u, edge.v
                if u in active_phys or v in active_phys:
                    candidate_swaps.append((u, v))

            if not candidate_swaps:
                # Fallback to any edge touching an active qubit or neighbor
                for p in active_phys:
                    for nbr in self.topology.adjacency.get(p, set()):
                        pair = (min(p, nbr), max(p, nbr))
                        if pair not in candidate_swaps:
                            candidate_swaps.append(pair)

            if not candidate_swaps:
                break

            # 4. Evaluate SABRE heuristic for each candidate SWAP
            best_swap = candidate_swaps[0]
            best_score = 1e9

            for u, v in candidate_swaps:
                # Trial layout after swap(u, v)
                trial_layout = dict(layout)
                l_u = reverse_layout[u]
                l_v = reverse_layout[v]
                if l_u is not None:
                    trial_layout[l_u] = v
                if l_v is not None:
                    trial_layout[l_v] = u

                # Front layer distance cost
                f_cost = 0.0
                f_2q_count = 0
                for gid in front_layer:
                    g = record_map[gid]
                    if len(g.logical_qubits) == 2:
                        p0 = trial_layout[g.logical_qubits[0]]
                        p1 = trial_layout[g.logical_qubits[1]]
                        f_cost += self.topology.distance(p0, p1)
                        f_2q_count += 1
                f_mean = f_cost / max(1, f_2q_count)

                # Extended lookahead cost
                e_cost = 0.0
                e_2q_count = 0
                for gid in extended_set:
                    g = record_map[gid]
                    if len(g.logical_qubits) == 2:
                        p0 = trial_layout[g.logical_qubits[0]]
                        p1 = trial_layout[g.logical_qubits[1]]
                        e_cost += self.topology.distance(p0, p1)
                        e_2q_count += 1
                e_mean = e_cost / max(1, e_2q_count)

                edge_info = self.topology.edge_map.get((u, v))
                cx_err = edge_info.cx_error if edge_info else 0.012

                # Combined score with decay factor
                raw_score = f_mean + self.extended_weight * e_mean + cx_err * 2.0
                decay_factor = max(decay[u], decay[v])
                total_score = raw_score * decay_factor

                if total_score < best_score:
                    best_score = total_score
                    best_swap = (u, v)

            # 5. Execute best candidate SWAP
            u_star, v_star = best_swap
            num_swaps += 1
            step_count += 1

            edge_key = (min(u_star, v_star), max(u_star, v_star))
            swap_heatmap[edge_key] = swap_heatmap.get(edge_key, 0) + 1

            if collect_circuit:
                # Strict 3-CNOT Parity-Preserving SWAP Decomposition:
                # SWAP(u, v) = CX(u, v) * CX(v, u) * CX(u, v)
                routed_qc.cx(qr[u_star], qr[v_star])
                routed_qc.cx(qr[v_star], qr[u_star])
                routed_qc.cx(qr[u_star], qr[v_star])

            # Update layout mappings
            l_u = reverse_layout[u_star]
            l_v = reverse_layout[v_star]
            if l_u is not None:
                layout[l_u] = v_star
            if l_v is not None:
                layout[l_v] = u_star
            reverse_layout[u_star] = l_v
            reverse_layout[v_star] = l_u

            # Update decay
            decay[u_star] += self.decay_delta
            decay[v_star] += self.decay_delta

            if step_count % self.decay_reset_period == 0:
                for p in range(self.topology.num_qubits):
                    decay[p] = max(1.0, decay[p] * 0.9)

        return routed_qc, layout, num_swaps, swap_heatmap

    def route_with_layout(
        self,
        circuit: QuantumCircuit,
        initial_layout: Dict[int, int],
    ) -> RoutedCircuitArtifact:
        """Routes circuit with an explicit initial layout without bidirectional search."""
        records = self._circuit_to_records(circuit)
        routed_qc, final_layout, num_swaps, heatmap = self._run_sabre_pass(
            records=records,
            num_logical=circuit.num_qubits,
            initial_layout=initial_layout,
            collect_circuit=True,
        )
        return self._compute_artifact(routed_qc, initial_layout, final_layout, num_swaps, heatmap)

    def route(
        self,
        circuit: QuantumCircuit,
        bidirectional: bool = True,
        noise_aware: bool = True,
    ) -> RoutedCircuitArtifact:
        """Routes circuit with optional bidirectional SABRE search and noise-aware placement."""
        placer = NoiseAwarePlacement(self.topology)
        init_layout_0 = placer.find_initial_placement(circuit, noise_aware=noise_aware)

        records_fwd = self._circuit_to_records(circuit)
        num_logical = circuit.num_qubits

        if not bidirectional:
            routed_qc, final_layout, num_swaps, heatmap = self._run_sabre_pass(
                records=records_fwd,
                num_logical=num_logical,
                initial_layout=init_layout_0,
                collect_circuit=True,
            )
            return self._compute_artifact(routed_qc, init_layout_0, final_layout, num_swaps, heatmap)

        # Pass 1: Forward from initial layout
        _, layout_1, swaps_1, _ = self._run_sabre_pass(
            records=records_fwd,
            num_logical=num_logical,
            initial_layout=init_layout_0,
            collect_circuit=False,
        )

        # Pass 2: Backward from layout_1 on reversed circuit
        records_bwd = list(reversed(records_fwd))
        # Re-index reversed records for clean DAG
        for i, r in enumerate(records_bwd):
            records_bwd[i] = _GateRecord(id=i, name=r.name, logical_qubits=r.logical_qubits, params=r.params)

        _, layout_2, _, _ = self._run_sabre_pass(
            records=records_bwd,
            num_logical=num_logical,
            initial_layout=layout_1,
            collect_circuit=False,
        )

        # Pass 3: Final forward pass from layout_2
        routed_qc_3, final_layout_3, swaps_3, heatmap_3 = self._run_sabre_pass(
            records=records_fwd,
            num_logical=num_logical,
            initial_layout=layout_2,
            collect_circuit=True,
        )

        # If bidirectional pass didn't improve over pass 1, we still ensure the best result is kept
        if swaps_3 <= swaps_1:
            return self._compute_artifact(routed_qc_3, layout_2, final_layout_3, swaps_3, heatmap_3)

        # Fallback to forward pass if pass 1 was better
        routed_qc_1, final_layout_1, swaps_1, heatmap_1 = self._run_sabre_pass(
            records=records_fwd,
            num_logical=num_logical,
            initial_layout=init_layout_0,
            collect_circuit=True,
        )
        return self._compute_artifact(routed_qc_1, init_layout_0, final_layout_1, swaps_1, heatmap_1)

    def _compute_artifact(
        self,
        routed_qc: QuantumCircuit,
        initial_layout: Dict[int, int],
        final_layout: Dict[int, int],
        num_swaps: int,
        heatmap: Dict[Tuple[int, int], int],
    ) -> RoutedCircuitArtifact:
        """Computes hardware telemetry, duration, and fidelity for the routed circuit."""
        added_cx = 3 * num_swaps
        depth = routed_qc.depth()

        # Hardware latency calculation
        total_duration_ns = 0.0
        # Estimate fidelity as product of (1 - error) across all executed gates
        fidelity = 1.0

        for inst in routed_qc.data:
            qargs = inst.qubits
            if len(qargs) == 1:
                total_duration_ns += 35.0  # standard 1Q gate duration
                fidelity *= 0.9995         # 1Q infidelity ~ 5e-4
            elif len(qargs) == 2:
                u = routed_qc.find_bit(qargs[0]).index
                v = routed_qc.find_bit(qargs[1]).index
                edge = self.topology.edge_map.get((u, v))
                dur = edge.cx_duration_ns if edge else 280.0
                err = edge.cx_error if edge else 0.012
                total_duration_ns += dur
                fidelity *= max(0.01, 1.0 - err)

        # Readout infidelity for mapped qubits
        for phys_q in final_layout.values():
            node = self.topology.nodes.get(phys_q)
            ro_err = node.readout_err if node else 0.015
            fidelity *= (1.0 - ro_err)

        return RoutedCircuitArtifact(
            routed_circuit=routed_qc,
            topology_name=self.topology.name,
            initial_layout=initial_layout,
            final_layout=final_layout,
            num_swaps=num_swaps,
            added_cx_count=added_cx,
            depth=depth,
            duration_ns=total_duration_ns,
            estimated_fidelity=float(np.clip(fidelity, 1e-6, 1.0)),
            edge_swap_heatmap=heatmap,
        )


def route_circuit_to_topology(
    circuit: QuantumCircuit,
    topology: TopologyGraph,
    bidirectional: bool = True,
    noise_aware: bool = True,
) -> RoutedCircuitArtifact:
    """Convenience helper to route a quantum circuit onto a target QPU topology."""
    router = ParitySafeSabreRouter(topology)
    return router.route(circuit, bidirectional=bidirectional, noise_aware=noise_aware)
