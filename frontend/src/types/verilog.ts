/**
 * TypeScript Data Models for Verilog ↔ Quantum Equivalence Verification Studio.
 * Maps directly to backend Pydantic models in backend/app/schemas/verification_contract.py.
 */

export type Endianness = 'little_endian' | 'big_endian';
export type PortDirection = 'input' | 'output';
export type VerificationMode = 'statevector_ideal' | 'shot_measurement';
export type ExecutionEngineStatus =
  | 'iverilog_success'
  | 'python_ast_fallback'
  | 'compilation_error'
  | 'simulation_timeout'
  | 'syntax_error'
  | 'runtime_error';

export interface PortMapping {
  name: string;
  direction: PortDirection;
  bit_width: number;
  qubit_indices: number[];
  endianness?: Endianness;
}

export interface AncillaContract {
  qubit_index: number;
  expected_clean_state: number;
  name?: string;
}

export type ReferenceSourceType =
  | 'independent_schematic'
  | 'independent_verilog'
  | 'template_reference'
  | 'quantum_derived';

export interface VerificationContract {
  circuit_id?: string;
  verilog_code: string;
  top_module_name?: string;
  reference_name?: string;
  reference_source_type?: ReferenceSourceType;
  input_ports: PortMapping[];
  output_ports: PortMapping[];
  ancillas: AncillaContract[];
  mode: VerificationMode;
  num_shots: number;
}

export interface TruthTableRow {
  state_index: number;
  input_bitstring: string;
  input_values: Record<string, number>;
  verilog_output_bitstring: string;
  verilog_output_values: Record<string, number>;
  quantum_output_bitstring: string;
  quantum_output_values: Record<string, number>;
  match: boolean;
  ancilla_clean: boolean;
  state_fidelity: number;
  probabilities?: Record<string, number>;
}

export interface BoxPlotStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
}

export interface HeatmapData {
  input_labels: string[];
  output_bit_names: string[];
  matrix: number[][]; // 0 = match, 1 = mismatch
}

export interface HistogramEntry {
  state_label: string;
  verilog_prob: number;
  quantum_prob: number;
}

export interface VerificationResult {
  status: ExecutionEngineStatus;
  message: string;
  stderr?: string | null;
  total_states_tested: number;
  total_errors: number;
  error_rate: number;
  state_fidelity_avg: number;
  state_fidelity_curve: number[];
  box_plot: BoxPlotStats;
  heatmap: HeatmapData;
  histograms: HistogramEntry[];
  truth_table: TruthTableRow[];
  ancilla_clean_all: boolean;
  execution_time_ms: number;
  verilog_source?: string;
  top_module?: string;
  reference_name?: string;
  reference_source_type?: ReferenceSourceType;
  quantum_circuit_name?: string;
  is_golden_eligible?: boolean;
  classical_self_consistency?: boolean | null;
  diagnostics?: string[];
}

export interface VerilogTemplate {
  id: string;
  name: string;
  description: string;
  top_module: string;
  verilog_code: string;
  input_ports: PortMapping[];
  output_ports: PortMapping[];
}

export interface DualExportResponse {
  circuit_name: string;
  num_qubits: number;
  qasm: string;
  circuit_json: any;
  verilog_code: string;
  top_module: string;
}
