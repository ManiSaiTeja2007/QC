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
