import { SimulationPayload, SimulationRequestPayload } from '../types/simulation';

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

export async function fetchCustomSimulationData(payload: CustomCircuitPayload): Promise<SimulationPayload> {
  const response = await fetch(`${API_BASE}/simulate-custom`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
