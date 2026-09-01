/**
 * TypeScript Data Models for Quantum ALU 3D Studio
 */

export interface BlochVector {
  x: number;
  y: number;
  z: number;
  purity: number;
}

export interface PrimitiveGate {
  step_index: number;
  name: string;
  qubits: number[];
  logical_op_id: number;
}

export interface LogicalOperation {
  op_id: number;
  name: string;
  primitive_start: number;
  primitive_end: number;
  num_primitive_gates: number;
}

export interface SimulationStep {
  primitive_step: number;
  logical_op_id: number;
  logical_op_name: string;
  gate: PrimitiveGate | null;
  psi_ket: string;
  probabilities: Record<string, number>;
  bloch_vectors: BlochVector[];
  unitary_fidelity: number;
}

export interface CircuitMetrics {
  quantum_cost: number;
  t_count: number;
  t_depth: number;
  num_gates: number;
}

export interface SimulationPayload {
  circuit_name: string;
  num_qubits: number;
  qubit_names: string[];
  input_bits: number[];
  output_bits: number[];
  p_in: number;
  p_out: number;
  parity_preserved: boolean;
  total_logical_ops: number;
  total_primitive_steps: number;
  logical_operations: LogicalOperation[];
  primitive_gates: PrimitiveGate[];
  steps: SimulationStep[];
  metrics: CircuitMetrics;
}

export interface SimulationRequestPayload {
  architecture: string;
  synthesis: string;
  input_bits: number[];
  preset_name?: string;
}
