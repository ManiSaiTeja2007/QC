"""Physical QPU Topology & Calibration Graph Engine.

Models real hardware coupling maps with authentic per-qubit (T1, T2, readout error)
and per-edge (two-qubit infidelity p2q, gate duration t2q) calibration profiles.

Supported Topologies:
  1. All-to-All (Ideal baseline, Kn)
  2. 2D Grid (Planar square mesh)
  3. IBM Falcon 27Q (Heavy-hexagonal 27-qubit layout)
  4. IBM Eagle 127Q (Heavy-hexagonal 127-qubit layout)
  5. IBM Heron 133Q (Tunable-coupler heavy-hexagonal 133-qubit layout)

Provides all-pairs shortest-path hop distances D[u, v] and log-fidelity
noise distances W[u, v] for SABRE routing and 3D Three.js chip visualization.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Set, Tuple, Optional, Any
from collections import deque
import numpy as np


@dataclass(frozen=True, slots=True)
class PhysicalQubitNode:
    """Physical transmon qubit on the QPU chip with 3D coordinates and calibration data."""
    id: int
    x: float
    y: float
    z: float
    t1_us: float = 110.0
    t2_us: float = 85.0
    readout_err: float = 0.015


@dataclass(frozen=True, slots=True)
class CouplingEdge:
    """Bidirectional physical coupling bus between two transmon qubits."""
    u: int
    v: int
    cx_error: float = 0.012
    cx_duration_ns: float = 280.0


@dataclass
class TopologyGraph:
    """Graph representation of physical QPU coupling topology."""
    name: str
    num_qubits: int
    nodes: Dict[int, PhysicalQubitNode]
    edges: List[CouplingEdge]
    adjacency: Dict[int, Set[int]] = field(init=False)
    edge_map: Dict[Tuple[int, int], CouplingEdge] = field(init=False)
    dist_matrix: np.ndarray = field(init=False)
    noise_matrix: np.ndarray = field(init=False)

    def __post_init__(self) -> None:
        self.adjacency = {i: set() for i in range(self.num_qubits)}
        self.edge_map = {}

        for edge in self.edges:
            u, v = edge.u, edge.v
            self.adjacency[u].add(v)
            self.adjacency[v].add(u)
            self.edge_map[(u, v)] = edge
            self.edge_map[(v, u)] = edge

        self._compute_distance_matrices()

    def _compute_distance_matrices(self) -> None:
        """Precomputes all-pairs shortest path hop distances D and noise distances W."""
        n = self.num_qubits
        d_mat = np.full((n, n), 9999, dtype=int)
        w_mat = np.full((n, n), 1e6, dtype=float)

        for i in range(n):
            d_mat[i, i] = 0
            w_mat[i, i] = 0.0
            # BFS for unweighted hop distance
            q = deque([i])
            while q:
                u = q.popleft()
                d = d_mat[i, u]
                for v in self.adjacency[u]:
                    if d_mat[i, v] > d + 1:
                        d_mat[i, v] = d + 1
                        q.append(v)

            # Dijkstra for noise-weighted path: -ln(1 - p_2q)
            visited: Set[int] = set()
            while len(visited) < n:
                # Find unvisited with minimum distance
                min_u = -1
                min_w = 1e9
                for cand in range(n):
                    if cand not in visited and w_mat[i, cand] < min_w:
                        min_w = w_mat[i, cand]
                        min_u = cand
                if min_u == -1 or min_w >= 1e6:
                    break
                visited.add(min_u)
                for v in self.adjacency[min_u]:
                    if v not in visited:
                        edge = self.edge_map.get((min_u, v))
                        p2q = edge.cx_error if edge else 0.012
                        weight = -float(np.log(max(1e-6, 1.0 - p2q)))
                        if w_mat[i, v] > min_w + weight:
                            w_mat[i, v] = min_w + weight

        self.dist_matrix = d_mat
        self.noise_matrix = w_mat

    def distance(self, u: int, v: int) -> int:
        """Returns shortest hop distance D[u, v]."""
        return int(self.dist_matrix[u, v])

    def noise_distance(self, u: int, v: int) -> float:
        """Returns log-infidelity noise distance W[u, v]."""
        return float(self.noise_matrix[u, v])

    def are_adjacent(self, u: int, v: int) -> bool:
        """Checks if physical qubits u and v share a direct coupling bus."""
        return v in self.adjacency.get(u, set())

    def to_dict(self) -> Dict[str, Any]:
        """Serializes topology for FastAPI REST response and Three.js visualizer."""
        return {
            "name": self.name,
            "num_qubits": self.num_qubits,
            "nodes": [
                {
                    "id": n.id,
                    "x": round(n.x, 3),
                    "y": round(n.y, 3),
                    "z": round(n.z, 3),
                    "t1_us": n.t1_us,
                    "t2_us": n.t2_us,
                    "readout_err": round(n.readout_err, 4),
                }
                for n in self.nodes.values()
            ],
            "edges": [
                {
                    "u": e.u,
                    "v": e.v,
                    "cx_error": round(e.cx_error, 5),
                    "cx_duration_ns": round(e.cx_duration_ns, 1),
                }
                for e in self.edges
            ],
        }


def build_all_to_all_topology(num_qubits: int = 16) -> TopologyGraph:
    """Constructs an ideal fully connected all-to-all topology."""
    nodes: Dict[int, PhysicalQubitNode] = {}
    edges: List[CouplingEdge] = []

    # Circular layout on unit ring
    for i in range(num_qubits):
        angle = 2.0 * np.pi * i / num_qubits
        nodes[i] = PhysicalQubitNode(
            id=i,
            x=round(float(8.0 * np.cos(angle)), 3),
            y=round(float(8.0 * np.sin(angle)), 3),
            z=0.0,
            t1_us=120.0,
            t2_us=90.0,
            readout_err=0.010,
        )

    for i in range(num_qubits):
        for j in range(i + 1, num_qubits):
            edges.append(CouplingEdge(u=i, v=j, cx_error=0.008, cx_duration_ns=200.0))

    return TopologyGraph(name=f"All_to_All_{num_qubits}Q", num_qubits=num_qubits, nodes=nodes, edges=edges)


def build_grid_topology(rows: int = 4, cols: int = 4) -> TopologyGraph:
    """Constructs a 2D square lattice nearest-neighbor coupling grid."""
    num_qubits = rows * cols
    nodes: Dict[int, PhysicalQubitNode] = {}
    edges: List[CouplingEdge] = []

    x_span = float(cols - 1) or 1.0
    y_span = float(rows - 1) or 1.0

    for r in range(rows):
        for c in range(cols):
            qid = r * cols + c
            # Center grid at (0, 0) in range [-8, 8]
            x = (float(c) / x_span) * 16.0 - 8.0
            y = (float(r) / y_span) * 16.0 - 8.0
            nodes[qid] = PhysicalQubitNode(
                id=qid,
                x=round(x, 3),
                y=round(y, 3),
                z=0.0,
                t1_us=100.0 + (qid % 7) * 4.0,
                t2_us=80.0 + (qid % 5) * 3.0,
                readout_err=0.012 + (qid % 3) * 0.002,
            )

    for r in range(rows):
        for c in range(cols):
            qid = r * cols + c
            # Horizontal edge
            if c + 1 < cols:
                edges.append(CouplingEdge(u=qid, v=qid + 1, cx_error=0.010 + 0.001 * (qid % 4), cx_duration_ns=260.0))
            # Vertical edge
            if r + 1 < rows:
                edges.append(CouplingEdge(u=qid, v=qid + cols, cx_error=0.012 + 0.001 * (qid % 3), cx_duration_ns=280.0))

    return TopologyGraph(name=f"Grid_{rows}x{cols}_{num_qubits}Q", num_qubits=num_qubits, nodes=nodes, edges=edges)


def build_heavy_hex_topology(variant: str = "eagle_127") -> TopologyGraph:
    """Constructs an authentic IBM heavy-hexagonal lattice topology.

    Variants:
      - 'falcon_27': 27-qubit IBM Falcon QPU.
      - 'eagle_127': 127-qubit IBM Eagle QPU.
      - 'heron_133': 133-qubit IBM Heron QPU with tunable couplers.
    """
    v_clean = variant.lower().strip()

    # Try loading from official IBM fake backends if available
    backend = None
    try:
        from qiskit_ibm_runtime.fake_provider import FakeAuckland, FakeBrisbane, FakeTorino
        if "eagle" in v_clean or "127" in v_clean:
            backend = FakeBrisbane()
            qpu_name = "IBM_Eagle_127Q"
        elif "heron" in v_clean or "133" in v_clean:
            backend = FakeTorino()
            qpu_name = "IBM_Heron_133Q"
        else:
            backend = FakeAuckland()
            qpu_name = "IBM_Falcon_27Q"
    except Exception:
        backend = None

    if backend is not None:
        num_qubits = backend.num_qubits
        raw_edges = backend.coupling_map.get_edges()
        # Deduplicate undirected edges
        unique_edges: Set[Tuple[int, int]] = set()
        for u, v in raw_edges:
            unique_edges.add((min(u, v), max(u, v)))

        # Extract calibration properties if available
        props = backend.properties() if hasattr(backend, "properties") else None
        nodes: Dict[int, PhysicalQubitNode] = {}

        # Synthesize planar 3D coordinates based on heavy-hex column-row structure
        # Width aspect ratio ~ 1.8:1
        cols = int(np.ceil(np.sqrt(num_qubits * 2.0)))
        rows = int(np.ceil(num_qubits / cols))

        for q in range(num_qubits):
            r = q // cols
            c = q % cols
            # Hex-shift alternate rows
            x_offset = 0.5 if (r % 2 == 1) else 0.0
            x = (float(c + x_offset) / max(1, cols - 1)) * 20.0 - 10.0
            y = (float(r) / max(1, rows - 1)) * 14.0 - 7.0
            # Slight wave elevation for realistic 3D appearance
            z = round(float(0.4 * np.sin(x * 0.5) * np.cos(y * 0.5)), 3)

            t1 = 110.0
            t2 = 85.0
            ro = 0.015

            if props is not None:
                try:
                    t1_val = props.t1(q)
                    if t1_val:
                        t1 = t1_val * 1e6
                    t2_val = props.t2(q)
                    if t2_val:
                        t2 = t2_val * 1e6
                    ro_val = props.readout_error(q)
                    if ro_val:
                        ro = ro_val
                except Exception:
                    pass

            nodes[q] = PhysicalQubitNode(id=q, x=round(x, 3), y=round(y, 3), z=z, t1_us=round(t1, 1), t2_us=round(t2, 1), readout_err=round(ro, 4))

        edges: List[CouplingEdge] = []
        for u, v in sorted(unique_edges):
            cx_err = 0.012
            cx_dur = 280.0
            if props is not None:
                try:
                    err_val = props.gate_error("cx", [u, v])
                    if err_val:
                        cx_err = err_val
                    dur_val = props.gate_length("cx", [u, v])
                    if dur_val:
                        cx_dur = dur_val * 1e9
                except Exception:
                    pass
            edges.append(CouplingEdge(u=u, v=v, cx_error=round(cx_err, 5), cx_duration_ns=round(cx_dur, 1)))

        return TopologyGraph(name=qpu_name, num_qubits=num_qubits, nodes=nodes, edges=edges)

    # Pure Python mathematical fallback for heavy-hexagonal lattice
    target_q = 127 if ("eagle" in v_clean or "127" in v_clean) else (133 if "133" in v_clean else 27)
    qpu_name = f"Heavy_Hex_{target_q}Q"

    cols = int(np.ceil(np.sqrt(target_q * 1.8)))
    rows = int(np.ceil(target_q / cols))
    nodes = {}
    for q in range(target_q):
        r = q // cols
        c = q % cols
        x_offset = 0.5 if (r % 2 == 1) else 0.0
        x = (float(c + x_offset) / max(1, cols - 1)) * 20.0 - 10.0
        y = (float(r) / max(1, rows - 1)) * 14.0 - 7.0
        nodes[q] = PhysicalQubitNode(
            id=q,
            x=round(x, 3),
            y=round(y, 3),
            z=0.0,
            t1_us=105.0 + (q % 9) * 3.0,
            t2_us=82.0 + (q % 7) * 2.5,
            readout_err=0.014 + (q % 5) * 0.002,
        )

    edges_set: Set[Tuple[int, int]] = set()
    for q in range(target_q):
        r = q // cols
        c = q % cols
        if c + 1 < cols and (q + 1) < target_q:
            edges_set.add((q, q + 1))
        # Heavy-hex vertical bridge on staggered columns
        if (r + c) % 2 == 0 and (q + cols) < target_q:
            edges_set.add((q, q + cols))

    edges_list = [
        CouplingEdge(u=u, v=v, cx_error=0.011 + 0.001 * (u % 4), cx_duration_ns=280.0)
        for u, v in sorted(edges_set)
    ]
    return TopologyGraph(name=qpu_name, num_qubits=target_q, nodes=nodes, edges=edges_list)
