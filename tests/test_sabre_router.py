"""Unit Tests for Hardware-Topology-Aware SABRE Routing & Parity Preservation.

Tests:
  1. Topology graph generation, distance matrices, connectivity, and serialization.
  2. Interaction graph extraction & noise-aware initial placement.
  3. SABRE routing hardware compliance: all routed 2Q gates lie strictly on physical coupling edges.
  4. Parity preservation invariant: routed circuits preserve bitwise parity (P_in = P_out).
  5. Bidirectional SABRE optimization: forward-backward-forward pass efficiency.
  6. Routing telemetry, hardware latency, and edge SWAP congestion heatmap.
"""

from __future__ import annotations
import pytest
import numpy as np
from qiskit import QuantumCircuit
from qiskit.circuit.library import CXGate

from backend.app.router.topology_graph import (
    TopologyGraph,
    build_all_to_all_topology,
    build_grid_topology,
    build_heavy_hex_topology,
)
from backend.app.router.sabre_router import (
    NoiseAwarePlacement,
    ParitySafeSabreRouter,
    RoutedCircuitArtifact,
    route_circuit_to_topology,
)
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t
from backend.app.dd_engine.qmdd import QMDDContext, QMDDState


def test_01_topology_graph_properties() -> None:
    """Validates distance metrics, degree limits, and serialization for supported QPU topologies."""
    # 1. All-to-all
    a2a = build_all_to_all_topology(8)
    assert a2a.num_qubits == 8
    assert a2a.distance(0, 1) == 1
    assert a2a.distance(0, 7) == 1

    # 2. 2D Grid 4x4
    grid = build_grid_topology(4, 4)
    assert grid.num_qubits == 16
    assert grid.distance(0, 1) == 1
    assert grid.distance(0, 4) == 1
    assert grid.distance(0, 15) == 6  # Manhattan distance (0,0) to (3,3) is 3+3=6

    # 3. Heavy-Hex (Eagle 127Q)
    eagle = build_heavy_hex_topology("eagle_127")
    assert eagle.num_qubits == 127
    # Heavy-hex vertices have degree at most 3
    for q, neighbors in eagle.adjacency.items():
        assert len(neighbors) <= 3, f"Qubit {q} has degree {len(neighbors)} > 3 in heavy-hex"

    # 4. Serialization
    d = grid.to_dict()
    assert d["name"].startswith("Grid_4x4")
    assert len(d["nodes"]) == 16
    assert len(d["edges"]) == 24


def test_02_interaction_graph_and_placement() -> None:
    """Validates interaction frequency extraction and noise-aware placement."""
    qc = build_one_bit_alu_clifford_t()

    topo = build_heavy_hex_topology("falcon_27")
    placer = NoiseAwarePlacement(topo)

    # Compute interaction frequencies
    interaction_map = placer.extract_interaction_graph(qc)
    assert len(interaction_map) > 0

    # Place 7 logical qubits onto 27 physical qubits
    logical_to_physical = placer.find_initial_placement(qc, noise_aware=True)
    assert len(logical_to_physical) == qc.num_qubits
    # All assigned physical qubits must be unique
    phys_qubits = list(logical_to_physical.values())
    assert len(set(phys_qubits)) == len(phys_qubits)
    # Physical qubits must be valid IDs in topology
    for p in phys_qubits:
        assert 0 <= p < topo.num_qubits


def test_03_sabre_hardware_compliance() -> None:
    """Asserts that EVERY two-qubit gate in routed circuit is strictly an adjacent coupling edge."""
    qc = build_one_bit_alu_clifford_t()

    topo = build_grid_topology(4, 4)  # 16 qubits
    router = ParitySafeSabreRouter(topo)
    artifact = router.route(qc, bidirectional=True)

    routed_qc = artifact.routed_circuit
    assert routed_qc.num_qubits == topo.num_qubits

    # Check all 2Q gates
    for instruction in routed_qc.data:
        op = instruction.operation
        qargs = instruction.qubits
        if len(qargs) == 2:
            p0 = routed_qc.find_bit(qargs[0]).index
            p1 = routed_qc.find_bit(qargs[1]).index
            assert topo.are_adjacent(p0, p1), f"Violation: 2Q gate on non-adjacent physical qubits ({p0}, {p1})"

    # Check that added CX count is exactly 3 * num_swaps
    assert artifact.added_cx_count == 3 * artifact.num_swaps


def test_04_parity_preservation_under_routing() -> None:
    """Asserts that routed circuit strictly preserves bitwise parity (P_in = P_out) on valid states."""
    qc = build_one_bit_alu_clifford_t()

    topo = build_grid_topology(4, 4)
    router = ParitySafeSabreRouter(topo)
    artifact = router.route(qc, bidirectional=False)

    # Verify via QMDD: parity-preserving circuit remains parity-preserving after routing
    # because every SWAP is decomposed into 3 parity-preserving CNOTs!
    state = QMDDState.from_basis_state(topo.num_qubits, [0] * topo.num_qubits)

    # Prepare an initial computational basis state on logical qubits (e.g. A=1, B=0, Cin=1 -> parity 0)
    # Logical qubits are mapped to physical qubits via artifact.initial_layout
    initial_map = artifact.initial_layout
    log_qubits_active = [0, 2]  # parity is 2 (even)
    for lq in log_qubits_active:
        pq = initial_map[lq]
        state.apply_x(pq)

    # Initial physical parity:
    p_in_parity = state.expectation_z_all()
    assert abs(p_in_parity - 1.0) < 1e-6  # Even parity -> <Z^{\otimes n}> = +1.0

    # Execute all Clifford+T gates from the routed circuit directly via QMDD engine
    state.apply_circuit(artifact.routed_circuit)

    # Final physical parity:
    p_out_parity = state.expectation_z_all()
    assert abs(p_out_parity - p_in_parity) < 1e-6, (
        f"Parity violated! Initial parity {p_in_parity}, Final parity {p_out_parity}"
    )


def test_05_bidirectional_sabre_efficiency() -> None:
    """Asserts that bidirectional SABRE achieves <= SWAP overhead compared to naive initial layout."""
    qc = build_one_bit_alu_clifford_t()

    topo = build_heavy_hex_topology("falcon_27")
    router = ParitySafeSabreRouter(topo)

    # Naive trivial layout (logical i -> physical i)
    naive_layout = {i: i for i in range(qc.num_qubits)}
    artifact_naive = router.route_with_layout(qc, initial_layout=naive_layout)

    # Bidirectional SABRE with noise-aware placement
    artifact_bidi = router.route(qc, bidirectional=True, noise_aware=True)

    # Bidirectional with noise-aware placement should require equal or fewer SWAPs than naive
    assert artifact_bidi.num_swaps <= artifact_naive.num_swaps


def test_06_routing_telemetry_and_heatmap() -> None:
    """Validates routing telemetry metrics: edge congestion heatmap, estimated fidelity, latency."""
    qc = build_one_bit_alu_clifford_t()

    topo = build_grid_topology(4, 4)
    artifact = route_circuit_to_topology(qc, topo, bidirectional=True)

    assert isinstance(artifact, RoutedCircuitArtifact)
    assert artifact.depth > 0
    assert artifact.duration_ns > 0.0
    assert 0.0 < artifact.estimated_fidelity <= 1.0
    assert len(artifact.edge_swap_heatmap) >= 0

    # Serialization
    summary = artifact.to_dict()
    assert summary["topology"] == topo.name
    assert summary["num_swaps"] == artifact.num_swaps
    assert summary["added_cx_count"] == 3 * artifact.num_swaps
    assert "heatmap" in summary


def test_07_fastapi_qeda_endpoints() -> None:
    """Validates FastAPI REST endpoints /api/qeda/topologies and /api/qeda/route-topology."""
    from fastapi.testclient import TestClient
    from backend.app.main import app

    client = TestClient(app)

    # 1. Test GET /api/qeda/topologies
    resp_topos = client.get("/api/qeda/topologies")
    assert resp_topos.status_code == 200
    topos = resp_topos.json()
    assert len(topos) >= 5
    topo_ids = [t["id"] for t in topos]
    assert "falcon_27" in topo_ids
    assert "eagle_127" in topo_ids
    assert "heron_133" in topo_ids

    # 2. Test POST /api/qeda/route-topology
    payload = {
        "circuit_name": "1-bit-alu",
        "synthesis": "clifford_t",
        "target_topology": "falcon_27",
        "noise_aware": True,
        "bidirectional": True,
    }
    resp_route = client.post("/api/qeda/route-topology", json=payload)
    assert resp_route.status_code == 200
    data = resp_route.json()
    assert data["status"] == "success"
    assert "topology" in data
    assert "routing" in data
    assert data["topology"]["num_qubits"] == 27
    assert data["routing"]["num_swaps"] >= 0
    assert data["routing"]["added_cx_count"] == 3 * data["routing"]["num_swaps"]
    assert "routed_circuit_qasm" in data

    # 3. Test POST /api/qeda/full-compile-flow (End-to-End 4-Pillar Pipeline)
    flow_payload = {
        "verilog_or_boolean": "module f(input a, input b, input c, output s, output co); assign s = a ^ b ^ c; assign co = (a & b) ^ (b & c) ^ (a & c); endmodule",
        "circuit_name": "Full_Adder_Test",
        "strategy": "min_ancilla",
        "target_topology": "falcon_27",
        "depolarizing_p": 0.005,
    }
    resp_flow = client.post("/api/qeda/full-compile-flow", json=flow_payload)
    assert resp_flow.status_code == 200
    flow_data = resp_flow.json()
    assert flow_data["status"] == "success"
    assert "pillar_a_synthesis" in flow_data
    assert "pillar_c_qmdd_simulation" in flow_data
    assert "pillar_d_hardware_routing" in flow_data
    assert "pillar_b_error_mitigation" in flow_data
    assert flow_data["pillar_a_synthesis"]["garbage_free"] is True
    assert flow_data["pillar_a_synthesis"]["parity_preserved"] is True
    assert flow_data["pillar_c_qmdd_simulation"]["parity_verified"] is True
    assert flow_data["pillar_d_hardware_routing"]["target_topology"] == "IBM_Falcon_27Q"
    assert flow_data["pillar_b_error_mitigation"]["parity_mitigated_fidelity"] >= flow_data["pillar_b_error_mitigation"]["raw_fidelity"]
    assert "summary" in flow_data


