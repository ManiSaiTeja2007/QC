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
  alu_metadata?: any;
}

export interface PhysicalQubitNodeInfo {
  id: number;
  x: number;
  y: number;
  z: number;
  t1_us: number;
  t2_us: number;
  readout_err: number;
}

export interface CouplingEdgeInfo {
  u: number;
  v: number;
  cx_error: number;
  cx_duration_ns: number;
}

export interface TopologyInfo {
  name: string;
  num_qubits: number;
  nodes: PhysicalQubitNodeInfo[];
  edges: CouplingEdgeInfo[];
}

export interface EdgeSwapHeatmapItem {
  u: number;
  v: number;
  swaps: number;
}

export interface RoutingTelemetry {
  topology: string;
  num_qubits: number;
  initial_layout: Record<string, number>;
  final_layout: Record<string, number>;
  num_swaps: number;
  added_cx_count: number;
  depth: number;
  duration_ns: number;
  estimated_fidelity: number;
  heatmap: EdgeSwapHeatmapItem[];
}

export interface RouteTopologyResponse {
  status: string;
  topology: TopologyInfo;
  routing: RoutingTelemetry;
  routed_circuit_qasm: string;
}

export interface TopologyCatalogItem {
  id: string;
  name: string;
  qubits: number;
  architecture: string;
  lattice: string;
  description: string;
}


export interface SimulationRequestPayload {
  architecture: string;
  synthesis: string;
  input_bits: number[];
  preset_name?: string;
}
