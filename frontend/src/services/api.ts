import { SimulationPayload, SimulationRequestPayload } from '../types/simulation';
import {
  CircuitFileSchema,
  CircuitIndexResponse,
  CircuitValidationResponse,
  CircuitUploadResponse,
} from '../types/circuit';
import {
  VerificationContract,
  VerificationResult,
  VerilogTemplate,
  DualExportResponse,
  PortMapping,
  VerilogSimulateResponse,
} from '../types/verilog';

const API_BASE = '/api';

export interface CustomGatePayload {
  name: string;
  qubits: number[];
  params?: number[];
}

export interface CustomCircuitPayload {
  num_qubits: number;
  input_bits: number[];
  gates: CustomGatePayload[];
  circuit_name?: string;
}

export async function fetchSimulationData(payload: SimulationRequestPayload): Promise<SimulationPayload> {
  const response = await fetch(`${API_BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Simulation API error: ${response.statusText}`);
  }

  return response.json();
}

export async function fetchCustomSimulationData(
  payload: CustomCircuitPayload,
  signal?: AbortSignal
): Promise<SimulationPayload> {
  const response = await fetch(`${API_BASE}/simulate-custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Custom Simulation API error: ${response.statusText}`);
  }

  return response.json();
}

export interface SingleGatePayload {
  gate_name: string;
  input_bits: number[];
  params?: number[];
  initial_state_mode?: string;
  custom_polar_angles?: number[];
}

export async function fetchSingleGateSimulationData(payload: SingleGatePayload): Promise<SimulationPayload> {
  const response = await fetch(`${API_BASE}/simulate-single-gate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Single Gate Simulation API error: ${response.statusText}`);
  }

  return response.json();
}

// ==============================================================================
// 🧠 PennyLane Quantum Machine Learning (QML) API
// ==============================================================================

export interface QmlInfoResponse {
  pennylane_version: string;
  devices: string[];
  optimizers: string[];
  ansatzes: { id: string; name: string; wires: number; params: number }[];
  qml_tasks: { id: string; name: string }[];
}

export interface StateOptimizationPayload {
  target_state: string;
  custom_angles?: number[];
  ansatz_type?: string;
  optimizer_name?: string;
  learning_rate?: number;
  num_steps?: number;
  initial_params?: number[];
}

export interface OptimizationStepRecord {
  step: number;
  loss: number;
  fidelity: number;
  parameters: number[];
  gradient_norm: number;
  statevector: { real: number; imag: number }[];
  bloch_vectors: { x: number; y: number; z: number; r: number; purity: number }[];
  probabilities: Record<string, number>;
}

export interface StateOptimizationResponse {
  target_state: string;
  ansatz_type: string;
  optimizer: string;
  final_loss: number;
  final_fidelity: number;
  total_steps: number;
  converged: boolean;
  steps: OptimizationStepRecord[];
  circuit_description: string;
  target_bloch: { x: number; y: number; z: number };
}

export interface VQCTrainPayload {
  dataset: string;
  n_layers?: number;
  learning_rate?: number;
  epochs?: number;
}

export interface VQCTrainResponse {
  dataset: string;
  n_qubits: number;
  n_layers: number;
  epochs: number;
  final_loss: number;
  final_accuracy: number;
  epoch_history: { epoch: number; loss: number; accuracy: number }[];
  learned_weights_summary: number[];
  circuit_spec: string;
}

export async function fetchQmlInfo(): Promise<QmlInfoResponse> {
  const response = await fetch(`${API_BASE}/qml/info`);
  if (!response.ok) {
    throw new Error(`Failed to fetch PennyLane QML info: ${response.statusText}`);
  }
  return response.json();
}

export async function runStateOptimization(payload: StateOptimizationPayload): Promise<StateOptimizationResponse> {
  const response = await fetch(`${API_BASE}/qml/optimize-state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`PennyLane state optimization failed: ${response.statusText}`);
  }

  return response.json();
}

export async function runVqcTraining(payload: VQCTrainPayload): Promise<VQCTrainResponse> {
  const response = await fetch(`${API_BASE}/qml/train-vqc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`PennyLane VQC training failed: ${response.statusText}`);
  }

  return response.json();
}

// ==============================================================================
// 📦 Quantum Circuit Hub & Storage API (/api/circuits)
// ==============================================================================

export interface CircuitQueryParams {
  category?: string;
  max_qubits?: number;
  synthesis?: string;
  search?: string;
}

export async function fetchCircuits(params?: CircuitQueryParams): Promise<CircuitIndexResponse> {
  const query = new URLSearchParams();
  if (params?.category) query.append('category', params.category);
  if (params?.max_qubits) query.append('max_qubits', String(params.max_qubits));
  if (params?.synthesis) query.append('synthesis', params.synthesis);
  if (params?.search) query.append('search', params.search);

  const qs = query.toString();
  const url = `${API_BASE}/circuits${qs ? `?${qs}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to list circuits: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchCircuitDetails(circuitId: string): Promise<CircuitFileSchema> {
  const response = await fetch(`${API_BASE}/circuits/${encodeURIComponent(circuitId)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch circuit '${circuitId}': ${response.statusText}`);
  }
  return response.json();
}

export async function simulateStoredCircuit(circuitId: string, inputBits?: number[]): Promise<SimulationPayload> {
  const response = await fetch(`${API_BASE}/circuits/${encodeURIComponent(circuitId)}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input_bits: inputBits }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Simulation failed: ${response.statusText}`);
  }
  return response.json();
}

export async function validateCircuitJson(circuitData: unknown): Promise<CircuitValidationResponse> {
  const response = await fetch(`${API_BASE}/circuits/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(circuitData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Validation request failed: ${response.statusText}`);
  }
  return response.json();
}

export async function uploadCircuitJson(circuitData: CircuitFileSchema): Promise<CircuitUploadResponse> {
  const response = await fetch(`${API_BASE}/circuits/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(circuitData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Upload failed: ${response.statusText}`);
  }
  return response.json();
}

export async function updateCircuitJson(circuitId: string, circuitData: CircuitFileSchema): Promise<CircuitUploadResponse> {
  const response = await fetch(`${API_BASE}/circuits/${encodeURIComponent(circuitId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(circuitData),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Update failed: ${response.statusText}`);
  }
  return response.json();
}

export async function uploadCircuitFile(file: File): Promise<CircuitUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/circuits/upload-file`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `File upload failed: ${response.statusText}`);
  }
  return response.json();
}

export async function deleteStoredCircuit(circuitId: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/circuits/${encodeURIComponent(circuitId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Delete failed: ${response.statusText}`);
  }
  return response.json();
}

export function getCircuitExportUrl(circuitId: string): string {
  return `${API_BASE}/circuits/${encodeURIComponent(circuitId)}/export`;
}

// ====================================================================
// Verilog ↔ Quantum Equivalence Verification API
// ====================================================================

export async function fetchVerilogTemplates(): Promise<VerilogTemplate[]> {
  const response = await fetch(`${API_BASE}/verilog/templates`);
  if (!response.ok) {
    throw new Error(`Failed to fetch Verilog templates: ${response.statusText}`);
  }
  return response.json();
}

export async function simulateVerilogStandalone(payload: {
  verilog_code: string;
  top_module_name?: string;
  input_ports: PortMapping[];
  output_ports: PortMapping[];
}): Promise<VerilogSimulateResponse> {
  const response = await fetch(`${API_BASE}/verilog/simulate-verilog`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Verilog simulation failed: ${response.statusText}`);
  }
  return response.json();
}

export async function verifyCircuitAgainstVerilog(payload: {
  contract: VerificationContract;
  circuit_id?: string;
  custom_circuit?: CustomCircuitPayload;
  schematic_netlist?: any;
}): Promise<VerificationResult> {
  const response = await fetch(`${API_BASE}/verilog/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Verification failed: ${response.statusText}`);
  }
  return response.json();
}

export async function exportDualCircuits(payload: {
  circuit_id?: string;
  custom_circuit?: CustomCircuitPayload;
  verilog_code?: string;
  top_module_name?: string;
}): Promise<DualExportResponse> {
  const response = await fetch(`${API_BASE}/verilog/export-dual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(err.detail || `Dual export failed: ${response.statusText}`);
  }
  return response.json();
}

