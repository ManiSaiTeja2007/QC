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

---

## 6. Canonical Verification Contract & Schemas (`backend/app/schemas/verification_contract.py`)

| Symbol | Type | Description |
|---|---|---|
| [`Endianness`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L8-L16) | Enum (`str`) | Bit order convention (`little_endian` vs `big_endian`). |
| [`PortDirection`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L19-L21) | Enum (`str`) | Port direction (`input`, `output`). |
| [`PortMapping`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L24-L44) | Pydantic Model | Mapping between Verilog port and physical quantum circuit qubits. |
| [`AncillaContract`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L47-L51) | Pydantic Model | Contract for ancilla uncomputation check back to clean state. |
| [`VerificationMode`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L54-L56) | Enum (`str`) | Simulation mode (`statevector_ideal` vs `shot_measurement`). |
| [`ExecutionEngineStatus`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L59-L65) | Enum (`str`) | Engine status codes (`iverilog_success`, `compilation_error`, `simulation_timeout`, etc.). |
| [`VerificationContract`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L72-L105) | Pydantic Model | Canonical verification contract defining Verilog golden source, provenance, and port maps. |
| [`TruthTableRow`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L112-L125) | Pydantic Model | Row in the differential verification truth table. |
| [`BoxPlotStats`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L127-L135) | Pydantic Model | Five-number summary + IQR for fidelity box plot. |
| [`HeatmapData`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L137-L142) | Pydantic Model | 2D matrix of bitwise errors across input states and output bits. |
| [`HistogramEntry`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L144-L149) | Pydantic Model | Probability comparison entry between Verilog and Quantum. |
| [`VerificationResult`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/verification_contract.py#L151-L176) | Pydantic Model | Comprehensive verification result payload returned by comparator with provenance metadata. |
| [`ClassicalGateType`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/classical_netlist.py#L13-L22) | Enum | Classical gate types (`AND`, `OR`, `NAND`, `NOR`, `XOR`, `XNOR`, `NOT`, `BUFFER`). |
| [`ClassicalGateInstance`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/classical_netlist.py#L24-L48) | Pydantic Model | Gate block instance with structural fan-in $N \ge 2$, inputs, and output net. |
| [`PortPin`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/classical_netlist.py#L50-L62) | Pydantic Model | Boundary port pin mapping to net IDs. |
| [`ClassicalNetlist`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/schemas/classical_netlist.py#L64-L318) | Pydantic Model | Canonical structural netlist IR with combinational loop detection, local Boolean evaluation, and Verilog generation. |

---

## 7. Verilog Simulation & Cross-Checking Engines

| Symbol | File | Type | Description |
|---|---|---|---|
| [`simulate_verilog`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/verilog_engine.py#L170-L314) | `verilog_engine.py` | Function | Compiles and simulates Verilog code using Icarus Verilog (`iverilog` + `vvp`) over all $2^k$ states. |
| [`generate_testbench`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/verilog_engine.py#L68-L168) | `verilog_engine.py` | Function | Synthesizes an exhaustive testbench driving all $2^k$ input combinations. |
| [`get_verilog_template`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/verilog_generator.py#L190-L192) | `verilog_generator.py` | Function | Retrieves curated golden Verilog reference templates (AND, Adder, FALFG, ALU). |
| [`export_circuit_to_verilog`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/core/verilog_generator.py#L210-L245) | `verilog_generator.py` | Function | Generates synthesizable Verilog module for inspection / export. |
| [`run_quantum_verification_for_state`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/quantum_verifier.py#L140-L278) | `quantum_verifier.py` | Function | Simulates quantum circuit for a basis state and computes state fidelity. |
| [`compute_box_plot_statistics`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/equivalence_metrics.py#L31-L51) | `equivalence_metrics.py` | Function | Calculates Min, $Q_1$, Median, $Q_3$, Max, and IQR. |
| [`run_full_verification`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/equivalence_metrics.py#L90-L284) | `equivalence_metrics.py` | Function | Coordinates netlist validation, self-consistency check, Verilog execution, quantum simulation, and differential comparison. |
| [`router`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/api/verilog_verify.py#L42) | `verilog_verify.py` | APIRouter | REST router mounted at `/api/verilog` for templates, simulation, and verification. |

---

## 8. Frontend Verilog & Analytics Components

| Component | File | Description |
|---|---|---|
| [`VerilogStudioWorkspace`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/VerilogStudioWorkspace.tsx) | `VerilogStudioWorkspace.tsx` | First-class dedicated workspace for classical schematic design, Verilog synthesis, and quantum equivalence verification. |
| [`SchematicCanvas`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/SchematicCanvas.tsx) | `SchematicCanvas.tsx` | Logisim-style SVG schematic editor with gate pallet, wire routing, interactive input toggling, and live signal propagation. |
| [`evaluateSchematic`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/schematicEvaluator.ts) | `schematicEvaluator.ts` | Deterministic browser-side logic evaluator with DFS cycle detection. |
| [`convertSchematicToCanonicalNetlist`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/schematicToNetlist.ts) | `schematicToNetlist.ts` | Translates visual schematic graph into Canonical ClassicalNetlist IR. |
| [`generateVerilogFromNetlist`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/services/schematicToNetlist.ts) | `schematicToNetlist.ts` | Synthesizes clean, human-readable Verilog HDL from netlist. |
| [`TruthTableMatrix`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/TruthTableMatrix.tsx) | `TruthTableMatrix.tsx` | Exhaustive truth table matrix with mismatch filtering and fidelity badges. |
| [`ErrorHeatmap`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/ErrorHeatmap.tsx) | `ErrorHeatmap.tsx` | 2D SVG heatmap grid mapping basis states against output bit error indicators. |
| [`StateFidelityCurve`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/StateFidelityCurve.tsx) | `StateFidelityCurve.tsx` | Dedicated state-by-state quantum fidelity curve across all computational basis states. |
| [`FidelityDistributionBoxPlot`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/FidelityDistributionBoxPlot.tsx) | `FidelityDistributionBoxPlot.tsx` | Five-number summary box-and-whisker plot displaying quartile distributions and IQR. |
| [`StateHistogram`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/StateHistogram.tsx) | `StateHistogram.tsx` | Side-by-side probability bars comparing Verilog reference against quantum measurements. |
| [`PortMappingConfig`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/verilog/PortMappingConfig.tsx) | `PortMappingConfig.tsx` | Canonical contract configurator for ports, qubit indices, and ancilla clean checks. |
| [`VerilogSubPanel`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/builder/VerilogSubPanel.tsx) | `VerilogSubPanel.tsx` | Integrated verification studio sub-view embedded into Circuit Builder workspace. |





---

## 9. Physical Transmon Noise Models & Simulation Engine

| Symbol | File | Type | Description |
|---|---|---|---|
| [`TransmonNoiseConfig`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L32-L46) | `noise_models.py` | Dataclass | Hardware calibration parameters ($T_1=110\,\mu\text{s}$, $T_2=85\,\mu\text{s}$, $t_{1q}=35\,\text{ns}$, $t_{2q}=280\,\text{ns}$, $p_{1q}=0.0015$, $p_{2q}=0.012$). |
| [`build_depolarizing_noise_model`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L48-L62) | `noise_models.py` | Function | Constructs stochastic Pauli gate infidelity noise model. |
| [`build_amplitude_damping_noise_model`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L64-L85) | `noise_models.py` | Function | Constructs $T_1$ energy relaxation noise model with Kraus operators. |
| [`build_phase_damping_noise_model`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L87-L108) | `noise_models.py` | Function | Constructs pure $T_2$ environmental dephasing noise model. |
| [`build_thermal_relaxation_noise_model`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L110-L129) | `noise_models.py` | Function | Constructs combined $T_1$ relaxation and $T_2$ dephasing thermal noise model. |
| [`build_transmon_composite_noise_model`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L131-L151) | `noise_models.py` | Function | Constructs composite Falcon/Eagle transmon noise model combining relaxation and depolarizing errors. |
| [`simulate_noisy_density_matrix`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L153-L188) | `noise_models.py` | Function | Simulates open-system density matrix $\rho_{\text{noisy}}$ and evaluates state fidelity $F(\rho, |\psi_{\text{ideal}}\rangle)$. |
| [`simulate_noisy_shots`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L190-L208) | `noise_models.py` | Function | Runs Monte Carlo shot sampling under physical noise channels. |
| [`evaluate_noise_fidelities`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L210-L230) | `noise_models.py` | Function | Evaluates circuit state fidelity across all 4 noise channels for a given input state. |
| [`run_figure12_noisy_reproduction`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/fidelity_simulator.py#L141-L194) | `fidelity_simulator.py` | Function | Dynamically evaluates empirical state fidelity distributions across basis states under all 4 transmon channels. |
| [`build_parity_projector`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L237-L253) | `noise_models.py` | Function | Constructs $2^n \times 2^n$ diagonal parity subspace projector $\Pi_{\text{valid}}$. |
| [`apply_parity_postselection`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L255-L274) | `noise_models.py` | Function | Applies $\Pi_{\text{valid}} \rho \Pi_{\text{valid}}$ and computes acceptance probability $P_{\text{accept}}$. |
| [`scale_transmon_noise_config`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L276-L289) | `noise_models.py` | Function | Scales hardware error parameters for Zero-Noise Extrapolation (ZNE). |
| [`compute_zne_richardson_fidelity`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L291-L305) | `noise_models.py` | Function | Computes two-point Richardson linear ZNE: $F_{\text{ZNE}} = (c F_1 - F_2)/(c-1)$. |
| [`simulate_parity_mitigated_density_matrix`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/noise_models.py#L307-L359) | `noise_models.py` | Function | Computes raw, parity-mitigated, acceptance rate, and ZNE fidelities via density matrix simulation. |
| [`simulate_parity_mitigated_shots`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/fidelity_simulator.py#L213-L252) | `fidelity_simulator.py` | Function | Monte Carlo shot sampling with empirical parity post-selection filtering. |
| [`run_figure12_mitigated_comparison`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/simulation/fidelity_simulator.py#L254-L308) | `fidelity_simulator.py` | Function | Comprehensive comparative benchmark of Raw vs. Parity-Mitigated vs. ZNE across all 4 noise channels. |

---

## 10. Q-EDA Reversible Logic Compiler & Synthesis Engine

| Symbol | File | Type | Description |
|---|---|---|---|
| [`ESOPCube`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/esop_synthesizer.py#L14-L44) | `esop_synthesizer.py` | Dataclass | Product term representation with literals, polarity, and target output rail. |
| [`ESOPNetwork`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/esop_synthesizer.py#L47-L73) | `esop_synthesizer.py` | Dataclass | Multi-output ESOP network with evaluation and cube inspection methods. |
| [`fast_reed_muller_transform`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/esop_synthesizer.py#L76-L92) | `esop_synthesizer.py` | Function | Computes Positive-Davio / Reed-Muller expansion coefficients in $O(n \cdot 2^n)$. |
| [`optimize_esop_cubes`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/esop_synthesizer.py#L95-L151) | `esop_synthesizer.py` | Function | Algebraic ESOP reduction: duplicate cancellation ($c \oplus c = 0$) and variable merging ($Ax \oplus A\bar{x} = A$). |
| [`truth_table_to_esop`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/esop_synthesizer.py#L154-L187) | `esop_synthesizer.py` | Function | Synthesizes an optimized ESOPNetwork from multi-output truth tables. |
| [`parse_verilog_assign_to_esop`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/esop_synthesizer.py#L190-L235) | `esop_synthesizer.py` | Function | Ingests combinational Verilog `assign` statements into an optimized ESOPNetwork. |
| [`add_clifford_t_toffoli`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/parity_mapper.py#L23-L49) | `parity_mapper.py` | Function | Fault-tolerant Clifford+T Toffoli decomposition (7 $T$ gates, 2 $H$, 6 CNOTs). |
| [`build_parity_preserving_circuit`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/parity_mapper.py#L112-L188) | `parity_mapper.py` | Function | Maps ESOP cubes and scheduled batches to a strictly parity-preserving Clifford+T circuit. |
| [`PebbleStrategy`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/pebble_scheduler.py#L35-L39) | `pebble_scheduler.py` | Enum | Scheduling strategies: `MIN_ANCILLA`, `MIN_T_DEPTH`, and `PARETO_BALANCED`. |
| [`schedule_pebble_uncomputation`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/pebble_scheduler.py#L65-L121) | `pebble_scheduler.py` | Function | DAG pebble-game scheduling balancing ancilla count vs. parallel $T$-depth. |
| [`compile_boolean_to_parity_clifford_t`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/pebble_scheduler.py#L124-L245) | `pebble_scheduler.py` | Function | End-to-end Q-EDA compiler entry point with 100% equivalence, zero garbage, and parity verification. |
| [`CompiledCircuitArtifact`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/compiler/pebble_scheduler.py#L42-L62) | `pebble_scheduler.py` | Dataclass | Synthesized circuit artifact with metrics, pebble trace, and verification status. |

---

## 11. Native Quantum Decision Diagram (QMDD) & Multi-Bit Scaling Engine

| Symbol | File | Type | Description |
|---|---|---|---|
| [`CyclotomicComplex`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/cyclotomic.py#L51-L188) | `cyclotomic.py` | Dataclass | Exact algebraic cyclotomic ring $\mathbb{D}[\omega] = \mathbb{Z}[\omega, 1/\sqrt{2}]$ arithmetic eliminating floating-point drift across Clifford+T gates. |
| [`QMDDNode`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/qmdd.py#L19-L26) | `qmdd.py` | Dataclass | Decision diagram internal qubit branching node (level, low edge, high edge, id). |
| [`QMDDEdge`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/qmdd.py#L29-L43) | `qmdd.py` | Dataclass | Directed edge carrying exact cyclotomic complex weight and pointing to target node. |
| [`QMDDMatrixNode`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/qmdd.py#L46-L55) | `qmdd.py` | Dataclass | Operator decision diagram node with 4 quadrant matrix edges. |
| [`QMDDMatrixEdge`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/qmdd.py#L58-L72) | `qmdd.py` | Dataclass | Directed operator edge carrying exact cyclotomic weight. |
| [`QMDDContext`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/qmdd.py#L75-L157) | `qmdd.py` | Class | Global/local hash-consing Unique Table and memoized compute caches. |
| [`QMDDState`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/qmdd.py#L160-L400) | `qmdd.py` | Class | Quantum Statevector Decision Diagram supporting native Clifford+T gate execution, exact expectation values, basis measurement, and statevector extraction. |
| [`compute_golden_alu_result`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/multibit_alu.py#L24-L80) | `multibit_alu.py` | Function | Classical reference arithmetic and bitwise logic model for $N$-bit ALUs. |
| [`get_operation_controls`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/multibit_alu.py#L83-L135) | `multibit_alu.py` | Function | Resolves Table VI control signals ($M, S_0, S_1, S_2, S_3$) with robust word matching. |
| [`build_multibit_alu_circuit`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/multibit_alu.py#L138-L198) | `multibit_alu.py` | Function | Constructs parameterized $N$-bit Ripple-Carry Quantum ALU circuits (scaling up to 448 qubits). |
| [`simulate_multibit_alu_qmdd`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/dd_engine/multibit_alu.py#L201-L255) | `multibit_alu.py` | Function | Simulates $N$-bit Quantum ALUs ($N \in \{1, 2, 4, 8, 16, 32, 64\}$) natively on the QMDD engine in milliseconds. |

---

## 12. Hardware Topology & SABRE Router Engine

| Symbol | File | Type | Description |
|---|---|---|---|
| [`PhysicalQubitNode`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/topology_graph.py#L24-L34) | `topology_graph.py` | Dataclass | Physical transmon qubit with 3D coordinates $(x, y, z)$, $T_1$, $T_2$, and readout error. |
| [`CouplingEdge`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/topology_graph.py#L36-L43) | `topology_graph.py` | Dataclass | Physical coupling bus between qubits with CX error and gate duration. |
| [`TopologyGraph`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/topology_graph.py#L46-L152) | `topology_graph.py` | Class | Coupling topology representation with all-pairs BFS hop distances $D[u, v]$ and Dijkstra log-infidelity noise distances $W[u, v]$. |
| [`build_all_to_all_topology`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/topology_graph.py#L154-L176) | `topology_graph.py` | Function | Constructs ideal all-to-all lattice ($K_n$) baseline. |
| [`build_grid_topology`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/topology_graph.py#L179-L215) | `topology_graph.py` | Function | Constructs 2D square lattice nearest-neighbor planar grid. |
| [`build_heavy_hex_topology`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/topology_graph.py#L217-L345) | `topology_graph.py` | Function | Constructs authentic IBM Heavy-Hexagonal lattices (Falcon 27Q, Eagle 127Q, Heron 133Q). |
| [`NoiseAwarePlacement`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/sabre_router.py#L65-L195) | `sabre_router.py` | Class | Analyzes two-qubit interaction graph and maps high-traffic logical qubits to minimum-infidelity physical subgraphs. |
| [`ParitySafeSabreRouter`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/sabre_router.py#L198-L476) | `sabre_router.py` | Class | Bidirectional SABRE router enforcing strict 3-CNOT parity-preserving SWAP decomposition ($P_{\text{in}} = P_{\text{out}}$). |
| [`RoutedCircuitArtifact`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/sabre_router.py#L33-L62) | `sabre_router.py` | Dataclass | Hardware routing artifact with routed circuit, layout maps, latency, estimated fidelity, and SWAP congestion heatmap. |
| [`route_circuit_to_topology`](file:///home/mani/WorkSpace/VLSI/QC/backend/app/router/sabre_router.py#L479-L487) | `sabre_router.py` | Function | High-level convenience compiler entry point to route quantum circuits onto physical topologies. |
| [`HeavyHexPanel`](file:///home/mani/WorkSpace/VLSI/QC/frontend/src/components/HeavyHexPanel.tsx#L23-L445) | `HeavyHexPanel.tsx` | React.FC | Interactive Three.js 3D WebGL physical transmon QPU visualizer with OrbitControls, pulsating node indicators, and SWAP congestion heatmap. |

