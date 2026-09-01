"""Pydantic schemas for Quantum Simulation API."""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class CustomGateModel(BaseModel):
    name: str
    qubits: List[int]
    params: Optional[List[float]] = None


class CustomCircuitRequest(BaseModel):
    num_qubits: int = Field(..., ge=1, le=10)
    input_bits: List[int]
    gates: List[CustomGateModel]
    circuit_name: Optional[str] = "User Custom Circuit"


class SimulationRequest(BaseModel):
    architecture: str = Field(..., description="Architecture name (e.g. 1-bit-alu, falfg-gate, fredkin-gate, bennett-adder)")
    synthesis: str = Field("clifford_t", description="Synthesis library (clifford_t, ncv)")
    input_bits: List[int] = Field(..., description="List of computational input bits (0 or 1)")
    preset_name: Optional[str] = Field(None, description="Optional preset name")


class BlochVectorModel(BaseModel):
    x: float
    y: float
    z: float
    purity: float


class SimulationStepModel(BaseModel):
    primitive_step: int
    logical_op_id: int
    logical_op_name: str
    gate: Optional[Dict[str, Any]]
    psi_ket: str
    probabilities: Dict[str, float]
    bloch_vectors: List[BlochVectorModel]
    unitary_fidelity: float


class SimulationMetricsModel(BaseModel):
    quantum_cost: int
    t_count: int
    t_depth: int
    num_gates: int


class SimulationResponse(BaseModel):
    circuit_name: str
    num_qubits: int
    qubit_names: List[str]
    input_bits: List[int]
    output_bits: List[int]
    p_in: int
    p_out: int
    parity_preserved: bool
    total_logical_ops: int
    total_primitive_steps: int
    logical_operations: List[Dict[str, Any]]
    primitive_gates: List[Dict[str, Any]]
    steps: List[SimulationStepModel]
    metrics: SimulationMetricsModel
