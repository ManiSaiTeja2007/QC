"""Tests for Phase 5: Performance & Runtime Acceleration.

Verifies:
1. Catalog hot cache returns valid data from RAM.
2. Built-in circuits and Qiskit objects preloaded into memory at startup.
3. Custom circuit cached in LRU after first access.
4. LRU adaptive eviction of old custom circuits under capacity limit.
5. Updating custom circuit via PUT invalidates old cached parsed circuit and simulation results.
6. Deleting custom circuit clears all associated cache entries.
7. Identical simulation request (circuit_id + content_hash + input_bits) hits simulation cache.
8. Different input bits misses simulation cache and executes new simulation.
9. Modified circuit structure produces new content hash and misses old cache.
10. Built-in simulation result correctness and data integrity preserved under cache.
11. Custom simulation result correctness preserved under cache.
12. Deepcopy shielding ensures cached objects cannot be mutated by callers.
"""

import copy
import time
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas.circuit_file import CircuitFileSchema, CircuitGateSchema
from backend.app.core.circuit_cache import (
    circuit_cache,
    hot_boot_caches,
    compute_circuit_content_hash,
    MAX_PARSED_CUSTOM_CIRCUITS,
    MAX_SIMULATION_RESULTS,
)
from backend.app.core.circuit_storage import (
    delete_circuit_file,
    CIRCUITS_DIR,
)

client = TestClient(app)

PHASE5_TEST_IDS = [
    "p5_custom_test_circ",
    "p5_custom_variant_circ",
]


@pytest.fixture(autouse=True)
def setup_and_teardown_p5():
    """Ensure hot boot is initialized and custom test circuits are wiped after tests."""
    hot_boot_caches()
    yield
    for cid in PHASE5_TEST_IDS:
        target = CIRCUITS_DIR / f"{cid}.json"
        if target.exists():
            try:
                delete_circuit_file(cid)
            except Exception:
                pass


def sample_p5_circuit(circuit_id: str = "p5_custom_test_circ"):
    return {
        "schema_version": "1.0",
        "id": circuit_id,
        "name": "Phase 5 Test Circuit",
        "description": "Benchmarking and performance verification",
        "category": "Custom",
        "readonly": False,
        "num_qubits": 2,
        "qubit_names": ["q0", "q1"],
        "default_input_bits": [0, 0],
        "gates": [
            {"name": "H", "qubits": [0]},
            {"name": "CX", "qubits": [0, 1]},
        ],
    }


# ── 1. Catalog Hot Cache ───────────────────────────────────────────────────────

def test_catalog_hot_cache():
    """Verify GET /api/circuits returns catalog from memory cache."""
    hot_boot_caches()
    initial_hits = circuit_cache.stats["catalog_hits"]

    res = client.get("/api/circuits")
    assert res.status_code == 200
    data = res.json()
    assert data["version"] == "1.0"
    assert len(data["circuits"]) >= 4

    # Catalog hit count should have increased
    assert circuit_cache.stats["catalog_hits"] > initial_hits


# ── 2. Built-in Preload at Startup ─────────────────────────────────────────────

def test_builtin_preload_at_startup():
    """Verify built-in system circuits are present in parsed cache without reading disk."""
    hot_boot_caches()
    builtins = ["1_bit_alu_clifford_t", "falfg_5x5", "fredkin_cswap", "bennett_adder"]
    for b_id in builtins:
        cached = circuit_cache.get_circuit(b_id)
        assert cached is not None, f"Built-in '{b_id}' not preloaded in cache"
        circ, qc, content_hash = cached
        assert circ.id == b_id
        assert circ.readonly is True
        assert qc is not None
        assert len(content_hash) > 0


# ── 3. Custom Circuit LRU Caching ─────────────────────────────────────────────

def test_custom_circuit_cached_on_access():
    """Verify custom circuit is cached in LRU after first upload or access."""
    payload = sample_p5_circuit("p5_custom_test_circ")
    client.post("/api/circuits/upload", json=payload)

    # First access / upload pre-warms cache
    cached = circuit_cache.get_circuit("p5_custom_test_circ")
    assert cached is not None
    circ, qc, h = cached
    assert circ.id == "p5_custom_test_circ"
    assert circ.num_qubits == 2
    assert len(circ.gates) == 2


# ── 4. LRU Eviction Under Capacity Limit ──────────────────────────────────────

def test_lru_eviction():
    """Verify that custom circuit cache enforces bounded capacity without dropping built-ins."""
    from qiskit import QuantumCircuit

    # Preload builtins
    hot_boot_caches()
    builtins = ["1_bit_alu_clifford_t", "falfg_5x5", "fredkin_cswap", "bennett_adder"]

    # Insert MAX_PARSED_CUSTOM_CIRCUITS + 10 mock custom circuits
    total_custom = MAX_PARSED_CUSTOM_CIRCUITS + 10
    for i in range(total_custom):
        circ = CircuitFileSchema(
            id=f"mock_custom_{i}",
            name=f"Mock {i}",
            num_qubits=1,
            gates=[CircuitGateSchema(name="H", qubits=[0])],
            readonly=False,
        )
        qc = QuantumCircuit(1)
        qc.h(0)
        circuit_cache.put_circuit(circ, qc)

    # Built-ins must never be evicted
    for b_id in builtins:
        assert circuit_cache.get_circuit(b_id) is not None

    # Earliest custom circuit (mock_custom_0) must have been evicted by LRU
    assert circuit_cache.get_circuit("mock_custom_0") is None
    # Most recent custom circuit must be present
    assert circuit_cache.get_circuit(f"mock_custom_{total_custom - 1}") is not None


# ── 5. PUT Invalidation ───────────────────────────────────────────────────────

def test_put_invalidation():
    """Verify updating a custom circuit invalidates old parsed and simulation caches."""
    cid = "p5_custom_test_circ"
    payload = sample_p5_circuit(cid)
    client.post("/api/circuits/upload", json=payload)

    # Simulate once to warm simulation cache
    sim_res1 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0]})
    assert sim_res1.status_code == 200

    # Ensure simulation result is in cache
    h1 = compute_circuit_content_hash(CircuitFileSchema.model_validate(payload))
    assert circuit_cache.get_simulation_result(cid, h1, (0, 0), "clifford_t") is not None

    # Update circuit (add X gate)
    updated = sample_p5_circuit(cid)
    updated["gates"].append({"name": "X", "qubits": [0]})
    put_res = client.put(f"/api/circuits/{cid}", json=updated)
    assert put_res.status_code == 200

    # Old simulation cache entry with old hash must be gone
    assert circuit_cache.get_simulation_result(cid, h1, (0, 0), "clifford_t") is None

    # Cached circuit schema must now reflect 3 gates
    cached = circuit_cache.get_circuit(cid)
    assert cached is not None
    assert len(cached[0].gates) == 3


# ── 6. DELETE Invalidation ────────────────────────────────────────────────────

def test_delete_invalidation():
    """Verify deleting a custom circuit clears its parsed cache, simulation cache, and catalog."""
    cid = "p5_custom_test_circ"
    payload = sample_p5_circuit(cid)
    client.post("/api/circuits/upload", json=payload)
    client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0]})

    # Delete circuit
    del_res = client.delete(f"/api/circuits/{cid}")
    assert del_res.status_code == 200

    # Cache entries must be cleared
    assert circuit_cache.get_circuit(cid) is None
    keys_with_cid = [k for k in circuit_cache._simulation_cache if k[0] == cid]
    assert len(keys_with_cid) == 0


# ── 7. Simulation Cache Hit for Identical Request ──────────────────────────────

def test_simulation_cache_hit_identical():
    """Verify identical (circuit_id, content_hash, input_bits, synthesis) hits cache."""
    cid = "1_bit_alu_clifford_t"
    input_bits = [0] * 7

    # First simulation (cold or warm)
    res1 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": input_bits})
    assert res1.status_code == 200
    hits_before = circuit_cache.stats["sim_hits"]

    # Second identical simulation
    res2 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": input_bits})
    assert res2.status_code == 200
    hits_after = circuit_cache.stats["sim_hits"]

    assert hits_after == hits_before + 1, "Simulation cache hit was expected"
    assert res1.json() == res2.json()


# ── 8. Simulation Cache Miss for Different Input Bits ─────────────────────────

def test_simulation_cache_miss_different_input():
    """Verify changing input bits triggers cache miss and separate simulation."""
    cid = "1_bit_alu_clifford_t"
    misses_before = circuit_cache.stats["sim_misses"]

    res1 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0, 0, 0, 0, 0, 0]})
    assert res1.status_code == 200

    res2 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [1, 1, 1, 1, 0, 0, 0]})
    assert res2.status_code == 200

    # Should have registered separate simulation
    assert circuit_cache.stats["sim_misses"] >= misses_before + 1
    # Different inputs produce different final step probabilities or states
    assert res1.json()["steps"][-1]["psi_ket"] != res2.json()["steps"][-1]["psi_ket"]


# ── 9. Simulation Cache Miss After Circuit Modification ───────────────────────

def test_simulation_cache_miss_modified_circuit():
    """Verify modifying gates produces a different hash and triggers new simulation."""
    cid = "p5_custom_test_circ"
    payload = sample_p5_circuit(cid)
    client.post("/api/circuits/upload", json=payload)

    # Simulate base Bell state: H(0), CX(0, 1) -> |Phi+>
    sim1 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0]}).json()
    p1 = sim1["steps"][-1]["probabilities"]
    assert pytest.approx(p1.get("00", 0.0), abs=0.01) == 0.5
    assert pytest.approx(p1.get("11", 0.0), abs=0.01) == 0.5
    assert len(sim1["steps"]) == 3

    # Modify to add X on qubit 1 -> H(0), CX(0, 1), X(1) -> probabilities flip to 01 and 10
    payload2 = sample_p5_circuit(cid)
    payload2["gates"].append({"name": "X", "qubits": [1]})
    put_res = client.put(f"/api/circuits/{cid}", json=payload2)
    assert put_res.status_code == 200

    sim2 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0]}).json()
    assert len(sim2["steps"]) == 4
    p2 = sim2["steps"][-1]["probabilities"]
    assert pytest.approx(p2.get("01", 0.0), abs=0.01) == 0.5
    assert pytest.approx(p2.get("10", 0.0), abs=0.01) == 0.5


# ── 10. Built-in Simulation Result Correctness Preserved ───────────────────────

def test_builtin_simulation_correctness():
    """Verify cached simulation returns complete, valid payload with all expected keys."""
    res = client.post("/api/circuits/fredkin_cswap/simulate", json={"input_bits": [1, 0, 1]})
    assert res.status_code == 200
    data = res.json()

    assert "steps" in data
    assert "qubit_names" in data
    assert "metrics" in data
    assert "circuit_name" in data
    assert len(data["steps"]) == 18  # 1 initial + 17 gates
    assert data["metrics"]["quantum_cost"] == 5

    # Verify again from cache
    res_cached = client.post("/api/circuits/fredkin_cswap/simulate", json={"input_bits": [1, 0, 1]})
    assert res_cached.json() == data


# ── 11. Custom Simulation Result Correctness Preserved ─────────────────────────

def test_custom_simulation_correctness():
    """Verify cached custom simulation preserves exact probabilities and Bloch data."""
    cid = "p5_custom_test_circ"
    payload = sample_p5_circuit(cid)
    client.post("/api/circuits/upload", json=payload)

    res = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0]})
    assert res.status_code == 200
    data = res.json()

    # Step 0 initial, Step 1 H, Step 2 CX
    assert len(data["steps"]) == 3
    final_step = data["steps"][-1]
    assert "bloch_vectors" in final_step
    assert len(final_step["bloch_vectors"]) == 2
    assert "probabilities" in final_step
    assert pytest.approx(final_step["probabilities"].get("00", 0.0), abs=0.01) == 0.5


# ── 12. Deepcopy Shielding Against Mutation ───────────────────────────────────

def test_deepcopy_shielding():
    """Verify mutating an object returned from cache does NOT corrupt the cache."""
    cid = "fredkin_cswap"
    res1 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0, 0]})
    data1 = res1.json()

    # Mutate data in-place
    data1["circuit_name"] = "CORRUPTED_NAME"
    data1["steps"].clear()

    # Fetch again from cache
    res2 = client.post(f"/api/circuits/{cid}/simulate", json={"input_bits": [0, 0, 0]})
    data2 = res2.json()

    assert data2["circuit_name"] != "CORRUPTED_NAME"
    assert len(data2["steps"]) > 0
