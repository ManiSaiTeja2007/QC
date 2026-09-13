"""In-Process Accelerator & Multi-Tiered Cache Layer for Quantum Circuits.

Provides:
1. Hot Boot Pre-loading: Preloads catalog index and immutable built-in circuits into RAM.
2. Parsed Circuit Cache: Bounded LRU for custom circuits (max 64), pinned memory for built-ins.
3. Content-Addressed Simulation Cache: Bounded LRU (max 128) keyed by (circuit_id, content_hash, input_bits, synthesis).
4. Explicit Invalidation: Guarantees filesystem remains authoritative upon POST/PUT/DELETE mutations.
5. Thread-safe operations and deepcopy shielding against state mutation.
"""

import copy
import hashlib
import json
import threading
from collections import OrderedDict
from typing import Optional, Dict, Any, Tuple
from qiskit import QuantumCircuit

from backend.app.schemas.circuit_file import (
    CircuitFileSchema,
    CircuitIndexSchema,
)

# Cache capacities
MAX_PARSED_CUSTOM_CIRCUITS = 64
MAX_SIMULATION_RESULTS = 128


def compute_circuit_content_hash(circuit: CircuitFileSchema) -> str:
    """Computes deterministic SHA256 content hash of all simulation-affecting circuit elements."""
    content_repr = {
        "num_qubits": circuit.num_qubits,
        "synthesis": circuit.synthesis.lower() if circuit.synthesis else "clifford_t",
        "gates": [
            {
                "name": g.name.upper(),
                "qubits": g.qubits,
                "params": [round(p, 9) for p in g.params] if g.params else None,
            }
            for g in circuit.gates
        ],
    }
    dumped = json.dumps(content_repr, sort_keys=True)
    return hashlib.sha256(dumped.encode("utf-8")).hexdigest()[:16]


class CircuitCacheManager:
    """Singleton multi-tier cache manager for quantum circuits and simulation results."""

    def __init__(self):
        self._lock = threading.Lock()

        # 1. Catalog Cache
        self._cached_catalog: Optional[CircuitIndexSchema] = None

        # 2. Parsed Circuit Cache:
        # - Built-ins permanently pinned in dict: {id -> (CircuitFileSchema, QuantumCircuit, content_hash)}
        self._builtin_circuits: Dict[str, Tuple[CircuitFileSchema, QuantumCircuit, str]] = {}
        # - Custom circuits stored in bounded OrderedDict for LRU eviction
        self._custom_circuits: OrderedDict[str, Tuple[CircuitFileSchema, QuantumCircuit, str]] = OrderedDict()

        # 3. Simulation Result Cache:
        # Key: (circuit_id, content_hash, input_bits_tuple, synthesis) -> payload (dict)
        self._simulation_cache: OrderedDict[Tuple[str, str, Tuple[int, ...], str], Dict[str, Any]] = OrderedDict()

        # 4. Metrics & Diagnostics
        self.stats = {
            "catalog_hits": 0,
            "catalog_misses": 0,
            "circuit_hits": 0,
            "circuit_misses": 0,
            "sim_hits": 0,
            "sim_misses": 0,
        }

    # ── Catalog Cache ──────────────────────────────────────────────────────────

    def get_catalog(self) -> Optional[CircuitIndexSchema]:
        """Returns cached catalog index if present."""
        with self._lock:
            if self._cached_catalog is not None:
                self.stats["catalog_hits"] += 1
                return self._cached_catalog
            self.stats["catalog_misses"] += 1
            return None

    def set_catalog(self, catalog: CircuitIndexSchema) -> None:
        """Sets cached catalog index."""
        with self._lock:
            self._cached_catalog = catalog

    def invalidate_catalog(self) -> None:
        """Purges cached catalog index so next fetch reloads from disk."""
        with self._lock:
            self._cached_catalog = None

    # ── Parsed Circuit Cache ───────────────────────────────────────────────────

    def get_circuit(self, circuit_id: str) -> Optional[Tuple[CircuitFileSchema, QuantumCircuit, str]]:
        """Retrieves cached parsed circuit, Qiskit object, and content hash."""
        with self._lock:
            # Check built-in permanent cache
            if circuit_id in self._builtin_circuits:
                self.stats["circuit_hits"] += 1
                entry = self._builtin_circuits[circuit_id]
                # Return deepcopy of circuit schema to prevent caller tampering
                return (copy.deepcopy(entry[0]), entry[1].copy(), entry[2])

            # Check custom LRU cache
            if circuit_id in self._custom_circuits:
                self.stats["circuit_hits"] += 1
                # Move to end (most recently used)
                self._custom_circuits.move_to_end(circuit_id)
                entry = self._custom_circuits[circuit_id]
                return (copy.deepcopy(entry[0]), entry[1].copy(), entry[2])

            self.stats["circuit_misses"] += 1
            return None

    def put_circuit(self, circuit: CircuitFileSchema, qc: QuantumCircuit, content_hash: Optional[str] = None) -> None:
        """Caches parsed circuit and Qiskit circuit representation."""
        if content_hash is None:
            content_hash = compute_circuit_content_hash(circuit)

        with self._lock:
            entry = (circuit, qc, content_hash)
            if circuit.readonly:
                self._builtin_circuits[circuit.id] = entry
            else:
                if circuit.id in self._custom_circuits:
                    self._custom_circuits.move_to_end(circuit.id)
                self._custom_circuits[circuit.id] = entry

                # Enforce bounded LRU capacity
                while len(self._custom_circuits) > MAX_PARSED_CUSTOM_CIRCUITS:
                    self._custom_circuits.popitem(last=False)

    # ── Simulation Result Cache ────────────────────────────────────────────────

    def get_simulation_result(
        self,
        circuit_id: str,
        content_hash: str,
        input_bits: Tuple[int, ...],
        synthesis: str = "clifford_t",
    ) -> Optional[Dict[str, Any]]:
        """Retrieves cached simulation payload if exact key matches."""
        key = (circuit_id, content_hash, input_bits, synthesis.lower())
        with self._lock:
            if key in self._simulation_cache:
                self.stats["sim_hits"] += 1
                self._simulation_cache.move_to_end(key)
                # Return deepcopy so caller cannot mutate cached state
                return copy.deepcopy(self._simulation_cache[key])

            self.stats["sim_misses"] += 1
            return None

    def put_simulation_result(
        self,
        circuit_id: str,
        content_hash: str,
        input_bits: Tuple[int, ...],
        synthesis: str,
        payload: Dict[str, Any],
    ) -> None:
        """Stores simulation result payload in bounded LRU cache."""
        key = (circuit_id, content_hash, input_bits, synthesis.lower())
        with self._lock:
            # Store deepcopy to protect against post-cache caller mutations
            if key in self._simulation_cache:
                self._simulation_cache.move_to_end(key)
            self._simulation_cache[key] = copy.deepcopy(payload)

            # Enforce bounded LRU capacity
            while len(self._simulation_cache) > MAX_SIMULATION_RESULTS:
                self._simulation_cache.popitem(last=False)

    # ── Explicit Invalidation ──────────────────────────────────────────────────

    def invalidate_circuit(self, circuit_id: str) -> None:
        """Invalidates all cached parsed representations and simulation results for a circuit ID."""
        with self._lock:
            # Cannot remove built-ins from permanent store, but custom circuits are cleared
            self._custom_circuits.pop(circuit_id, None)

            # Purge all simulation results matching this circuit_id
            keys_to_remove = [k for k in self._simulation_cache if k[0] == circuit_id]
            for k in keys_to_remove:
                del self._simulation_cache[k]

            # Invalidate catalog index
            self._cached_catalog = None

    def clear_all(self) -> None:
        """Clears all caches completely (useful for isolated tests)."""
        with self._lock:
            self._cached_catalog = None
            self._builtin_circuits.clear()
            self._custom_circuits.clear()
            self._simulation_cache.clear()
            for k in self.stats:
                self.stats[k] = 0


# Global singleton instance
circuit_cache = CircuitCacheManager()


def hot_boot_caches() -> None:
    """Preloads catalog and immutable built-in circuits into RAM at application startup."""
    from backend.app.core.circuit_storage import (
        load_circuit_index,
        load_circuit_by_id,
        circuit_to_qiskit,
    )

    try:
        # 1. Preload master catalog index
        index = load_circuit_index()
        circuit_cache.set_catalog(index)

        # 2. Preload and compile all built-in benchmarks
        for entry in index.circuits:
            if entry.readonly:
                circ = load_circuit_by_id(entry.id)
                if circ:
                    qc = circuit_to_qiskit(circ)
                    h = compute_circuit_content_hash(circ)
                    circuit_cache.put_circuit(circ, qc, h)
    except Exception as e:
        # Non-fatal: filesystem remains fallback
        pass
