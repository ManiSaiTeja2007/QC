/**
 * TypeScript Data Models for Circuit Storage, Indexing, and Hub Management.
 * Maps directly to backend Pydantic models in backend/app/schemas/circuit_file.py.
 */

export interface CircuitGate {
  name: string;
  qubits: number[];
  params?: number[];
  step?: number;
}

export interface CircuitLogicalOp {
  op_id: number;
  name: string;
  primitive_start: number;
  primitive_end: number;
  num_primitive_gates: number;
}

export interface CircuitMetadata {
  author?: string;
  paper_reference?: string;
  parity_preserved?: boolean;
  quantum_cost?: number;
  t_count?: number;
  t_depth?: number;
  created_at?: string;
  tags?: string[];
}

export interface CircuitFileSchema {
  schema_version: string;
  id: string;
  name: string;
  description: string;
  category: string;
  num_qubits: number;
  qubit_names?: string[];
  default_input_bits?: number[];
  synthesis: string;
  readonly: boolean;
  gates: CircuitGate[];
  logical_operations?: CircuitLogicalOp[];
  metadata?: CircuitMetadata;
}

export interface CircuitIndexEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  num_qubits: number;
  num_gates: number;
  synthesis: string;
  readonly: boolean;
  tags: string[];
  file_name: string;
}

export interface CircuitIndexResponse {
  version: string;
  circuits: CircuitIndexEntry[];
}

export interface CircuitValidationResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  circuit_summary?: {
    id: string;
    name: string;
    category: string;
    num_qubits: number;
    num_gates: number;
    synthesis: string;
  };
}

export interface CircuitUploadResponse {
  status: string;
  message: string;
  circuit_id: string;
}
