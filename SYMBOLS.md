# Symbol Catalog (`SYMBOLS.md`)

This living reference document catalogs all public classes, functions, schemas, and REST endpoints authored for the Quantum Circuit Storage & Hub architecture.

---

## 1. Backend Schemas (`backend/app/schemas/circuit_file.py`)

| Symbol | Type | Description |
|---|---|---|
| [`CircuitGateSchema`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L10-L16) | Pydantic Model | Single primitive/multi-qubit gate specification (`name`, `qubits`, `params`, `step`). |
| [`CircuitLogicalOpSchema`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L18-L25) | Pydantic Model | High-level logical block partition (`op_id`, `name`, `primitive_start`, `primitive_end`, `num_primitive_gates`). |
| [`CircuitMetadataSchema`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L27-L37) | Pydantic Model | Metadata documenting author, paper citation, quantum cost, T-count, T-depth, and tags. |
| [`CircuitFileSchema`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L39-L54) | Pydantic Model | Root schema for standalone JSON circuit file (`id`, `name`, `num_qubits`, `gates`, `readonly`, etc.). |
| [`CircuitIndexEntrySchema`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L56-L68) | Pydantic Model | Lightweight entry in `circuits/index.json` catalog. |
| [`CircuitIndexSchema`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L70-L74) | Pydantic Model | Master index catalog schema (`version`, `circuits`). |
| [`StoredCircuitSimulationRequest`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L76-L80) | Pydantic Model | Request payload for `/api/circuits/{circuit_id}/simulate`. |
| [`CircuitValidationResponse`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/circuit_file.py#L82-L88) | Pydantic Model | Validation report payload (`valid`, `errors`, `warnings`, `circuit_summary`). |

---

## 2. Storage & Conversion Core (`backend/app/core/circuit_storage.py`)

| Symbol | Type | Description |
|---|---|---|
| [`CIRCUITS_DIR`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L29) | Constant (`Path`) | Storage directory path (`circuits/`). |
| [`SUPPORTED_GATES`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L32-L37) | Constant (`Set[str]`) | Whitelist of supported quantum gate names. |
| [`sanitize_circuit_id`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L46-L53) | Function | Validates alphanumeric ID to guard against path traversal. |
| [`get_circuit_file_path`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L55-L65) | Function | Confirms canonical path is strictly contained within `circuits/`. |
| [`validate_circuit_semantics`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L67-L96) | Function | Enforces qubit bounds ($[0, n-1]$), distinct controls/targets, and supported gate types. |
| [`load_circuit_index`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L98-L113) | Function | Thread-safe load of `circuits/index.json`. |
| [`save_circuit_index`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L115-L122) | Function | Atomic persistence of index catalog using `.tmp` and replace. |
| [`load_circuit_by_id`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L124-L135) | Function | Loads and validates circuit JSON by ID. |
| [`save_circuit_file`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L137-L176) | Function | Validates semantics, atomically saves circuit file, and updates index. |
| [`delete_circuit_file`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L178-L195) | Function | Deletes custom circuit file and removes index entry; forbids deleting `readonly: true`. |
| [`rebuild_circuit_index`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L197-L229) | Function | Scans `circuits/*.json` to regenerate index catalog. |
| [`qiskit_to_circuit_schema`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L231-L281) | Function | Converts Qiskit `QuantumCircuit` to `CircuitFileSchema`. |
| [`circuit_to_qiskit`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_storage.py#L283-L351) | Function | Reconstructs executable Qiskit `QuantumCircuit` from `CircuitFileSchema`. |

---

## 3. REST API Router (`backend/app/api/circuits.py`)

| Method | Route | Description | Security / Guard |
|---|---|---|---|
| `GET` | `/api/circuits` | Lists indexed circuits with filtering (`category`, `max_qubits`, `synthesis`, `search`). | Open catalog retrieval |
| `GET` | `/api/circuits/{circuit_id}` | Retrieves full JSON specification for circuit ID. | Path traversal check (`^[a-zA-Z0-9_-]+$`), 404 on missing |
| `POST` | `/api/circuits/validate` | Pre-flight circuit validation without persisting to disk. | Strict schema + semantic validation |
| `POST` | `/api/circuits/upload` | Persists a JSON circuit and updates catalog index. | Overwrite protection for `readonly`, size & gate bounds |
| `POST` | `/api/circuits/upload-file` | Multipart file upload (`.json` up to 1 MB). | Extension check, 1 MB limit (413), syntax + semantic validation |
| `PUT` | `/api/circuits/{circuit_id}` | Updates an existing custom circuit in storage. | Rejects built-in `readonly: true` with 403 Forbidden; path validation |
| `POST` | `/api/circuits/{circuit_id}/simulate` | Simulates stored circuit using Canonical IR engine and cost analyzer. | Bounded qubit count, identical response schema to legacy visualizer |
| `DELETE` | `/api/circuits/{circuit_id}` | Deletes custom user circuit and removes from index. | Rejects `readonly: true` circuits with 403 Forbidden |
| `GET` | `/api/circuits/{circuit_id}/export` | Downloads JSON circuit file as attachment. | Safe ID check, Content-Disposition header |

---

## 4. Frontend Data Models & Components

### Types (`frontend/src/types/circuit.ts`)
| Symbol | Type | Description |
|---|---|---|
| [`CircuitGate`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/types/circuit.ts#L6-L11) | Interface | Single gate data model on frontend (`name`, `qubits`, `params`, `step`). |
| [`CircuitLogicalOp`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/types/circuit.ts#L13-L19) | Interface | Logical block partition model. |
| [`CircuitMetadata`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/types/circuit.ts#L21-L30) | Interface | Paper, author, and cost metadata. |
| [`CircuitFileSchema`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/types/circuit.ts#L32-L46) | Interface | Full circuit specification model. |
| [`CircuitIndexEntry`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/types/circuit.ts#L48-L59) | Interface | Summary catalog entry for cards and sidebar. |
| [`CircuitIndexResponse`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/types/circuit.ts#L61-L64) | Interface | Catalog response wrapper (`version`, `circuits`). |
| [`CircuitValidationResponse`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/types/circuit.ts#L66-L77) | Interface | Pre-flight validation report (`valid`, `errors`, `warnings`, `circuit_summary`). |

### Components & Services
| Symbol | Type | Description |
|---|---|---|
| [`CircuitHubModal`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/modals/CircuitHubModal.tsx#L25) | React Component | Unified Circuit Library Hub & Drag-and-Drop JSON Uploader. |
| [`SaveCircuitModal`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/modals/SaveCircuitModal.tsx#L29) | React Component | Save/Update Circuit to Library modal with immutability warnings and pre-flight validation. |
| [`fetchCircuits`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L186-L199) | Function | Fetches catalog index with filtering params. |
| [`fetchCircuitDetails`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L201-L207) | Function | Fetches complete circuit JSON specification. |
| [`simulateStoredCircuit`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L209-L219) | Function | Executes simulation for stored circuit. |
| [`validateCircuitJson`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L221-L231) | Function | Executes authoritative pre-flight validation dry-run. |
| [`uploadCircuitJson`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L233-L243) | Function | Uploads raw JSON object payload to storage. |
| [`uploadCircuitFile`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L245-L258) | Function | Uploads JSON file via multipart form. |
| [`updateCircuitJson`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L260-L271) | Function | Updates existing custom circuit via `PUT /api/circuits/{circuit_id}`. |
| [`deleteStoredCircuit`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L273-L282) | Function | Deletes custom circuit and refreshes library. |
| [`getCircuitExportUrl`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/api.ts#L284-L286) | Function | Generates downloadable JSON URL. |
| [`circuitStore`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/circuitStore.ts#L125) | Singleton (`CircuitStore`) | Shared in-memory catalog and circuit cache with request coalescing and pub/sub. |

---

## 5. In-Process Acceleration & Cache Layer (`backend/app/core/circuit_cache.py`)

| Symbol | Type | Description |
|---|---|---|
| [`compute_circuit_content_hash`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_cache.py#L26-L40) | Function | Computes deterministic SHA256 content hash of all simulation-affecting circuit elements. |
| [`CircuitCacheManager`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_cache.py#L43-L175) | Class | Thread-safe multi-tier cache manager (Catalog, Parsed Circuit LRU, Simulation Result LRU). |
| [`circuit_cache`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_cache.py#L178) | Singleton (`CircuitCacheManager`) | Global singleton cache instance used across FastAPI application. |
| [`hot_boot_caches`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/circuit_cache.py#L181-L203) | Function | Preloads catalog and immutable built-in circuits into RAM at application startup. |



