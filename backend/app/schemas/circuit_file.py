"""Pydantic schemas for JSON Circuit Storage and Catalog Indexing.

Ensures strict validation, bounded limits, and security constraints for circuit JSON files.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class CircuitGateSchema(BaseModel):
    """Represents a single primitive or multi-qubit gate."""
    name: str = Field(..., description="Standardized gate identifier (e.g. H, CX, T, TDG, X, Z)")
    qubits: List[int] = Field(..., description="0-indexed list of qubit wire indices")
    params: Optional[List[float]] = Field(None, description="Optional angle parameters for rotation gates")
    step: Optional[int] = Field(None, description="Optional step execution sequence index")


class CircuitLogicalOpSchema(BaseModel):
    """Represents a high-level logical operation block composed of primitive gates."""
    op_id: int
    name: str
    primitive_start: int
    primitive_end: int
    num_primitive_gates: int


class CircuitMetadataSchema(BaseModel):
    """Optional metadata documenting circuit origin, citations, and metrics."""
    author: Optional[str] = "Quantum ALU Studio"
    paper_reference: Optional[str] = "IEEE TETC 2026"
    parity_preserved: Optional[bool] = None
    quantum_cost: Optional[int] = None
    t_count: Optional[int] = None
    t_depth: Optional[int] = None
    created_at: Optional[str] = None
    tags: List[str] = Field(default_factory=list)


class CircuitFileSchema(BaseModel):
    """Full schema for a standalone JSON circuit file."""
    schema_version: str = Field("1.0", description="Schema format version")
    id: str = Field(..., pattern=r"^[a-zA-Z0-9_-]+$", description="Safe alphanumeric ID/slug")
    name: str = Field(..., min_length=1, max_length=120, description="Human-readable circuit title")
    description: str = Field("", max_length=1000, description="Circuit description or specification")
    category: str = Field("General", max_length=50, description="Category classification")
    num_qubits: int = Field(..., ge=1, le=12, description="Total number of qubits (bounded 1-12 for DoS protection)")
    qubit_names: List[str] = Field(default_factory=list, description="Labels for each qubit wire")
    default_input_bits: List[int] = Field(default_factory=list, description="Default initial computational basis bits")
    synthesis: str = Field("clifford_t", description="Target gate library (clifford_t, ncv, universal)")
    readonly: bool = Field(False, description="Whether circuit is an immutable built-in system benchmark")
    gates: List[CircuitGateSchema] = Field(..., description="Ordered list of quantum gates")
    logical_operations: Optional[List[CircuitLogicalOpSchema]] = Field(None, description="Logical operation partitions")
    metadata: Optional[CircuitMetadataSchema] = Field(default_factory=CircuitMetadataSchema)


class CircuitIndexEntrySchema(BaseModel):
    """Catalog summary entry stored in circuits/index.json."""
    id: str
    name: str
    description: str
    category: str
    num_qubits: int
    num_gates: int
    synthesis: str
    readonly: bool
    tags: List[str] = Field(default_factory=list)
    file_name: str


class CircuitIndexSchema(BaseModel):
    """Root catalog schema for circuits/index.json."""
    version: str = "1.0"
    circuits: List[CircuitIndexEntrySchema] = Field(default_factory=list)


class StoredCircuitSimulationRequest(BaseModel):
    """Request payload for simulating a circuit from the storage library."""
    input_bits: Optional[List[int]] = Field(None, description="Optional computational basis bits (0 or 1)")
    synthesis: Optional[str] = Field(None, description="Optional synthesis library override")


class CircuitValidationResponse(BaseModel):
    """Pre-flight validation report for uploaded or drafted circuit JSON."""
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    circuit_summary: Optional[Dict[str, Any]] = None

