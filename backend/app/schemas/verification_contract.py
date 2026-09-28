"""Pydantic schemas for the Canonical Verilog ↔ Quantum Verification Contract."""

from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, model_validator


class Endianness(str, Enum):
    """Bit order convention for multi-bit ports and qubit mappings.
    
    LITTLE_ENDIAN: qubit_indices[0] is LSB (bit 0), qubit_indices[-1] is MSB.
    BIG_ENDIAN: qubit_indices[0] is MSB, qubit_indices[-1] is LSB.
    """
    LITTLE_ENDIAN = "little_endian"
    BIG_ENDIAN = "big_endian"


class PortDirection(str, Enum):
    INPUT = "input"
    OUTPUT = "output"


class PortMapping(BaseModel):
    """Mapping between a Verilog module port and quantum circuit qubits."""
    name: str = Field(..., description="Verilog port identifier, e.g. 'a', 'b', 'cin', 'sum', 'cout'")
    direction: PortDirection = Field(..., description="Port direction: input or output")
    bit_width: int = Field(1, ge=1, le=16, description="Bit width of the port")
    qubit_indices: List[int] = Field(
        ...,
        min_length=1,
        description="Physical qubit indices assigned to this port, in order from bit 0 to bit N-1 (if LITTLE_ENDIAN) or bit N-1 down to 0 (if BIG_ENDIAN)"
    )
    endianness: Endianness = Field(Endianness.LITTLE_ENDIAN, description="Bit ordering convention")

    @model_validator(mode="after")
    def validate_width_matches_qubits(self) -> "PortMapping":
        if len(self.qubit_indices) != self.bit_width:
            raise ValueError(
                f"Port '{self.name}' has bit_width={self.bit_width} but received {len(self.qubit_indices)} qubit indices."
            )
        return self


class AncillaContract(BaseModel):
    """Specification of an ancilla qubit expected to uncompute back to |0>."""
    qubit_index: int = Field(..., ge=0, description="Qubit index of the ancilla line")
    expected_clean_state: int = Field(0, description="Expected computational state after circuit execution (typically 0)")
    name: Optional[str] = Field(None, description="Optional label for the ancilla, e.g. 'anc_borrow'")


class VerificationMode(str, Enum):
    STATEVECTOR_IDEAL = "statevector_ideal"
    SHOT_MEASUREMENT = "shot_measurement"


class ExecutionEngineStatus(str, Enum):
    IVERILOG_SUCCESS = "iverilog_success"
    PYTHON_AST_FALLBACK = "python_ast_fallback"
    COMPILATION_ERROR = "compilation_error"
    SIMULATION_TIMEOUT = "simulation_timeout"
    SYNTAX_ERROR = "syntax_error"
    RUNTIME_ERROR = "runtime_error"


class ReferenceSourceType(str, Enum):
    INDEPENDENT_SCHEMATIC = "independent_schematic"
    INDEPENDENT_VERILOG = "independent_verilog"
    TEMPLATE_REFERENCE = "template_reference"
    QUANTUM_DERIVED = "quantum_derived"


class VerificationContract(BaseModel):
    """Canonical, independent contract specifying inputs, outputs, and verification settings."""
    circuit_id: Optional[str] = Field(None, description="Optional ID of existing circuit or custom circuit")
    verilog_code: str = Field(default="", description="Independent classical Verilog HDL source code for golden reference")
    top_module_name: Optional[str] = Field(None, description="Top-level Verilog module name; auto-detected if omitted")
    input_ports: List[PortMapping] = Field(default_factory=list, description="List of mapped input ports")
    output_ports: List[PortMapping] = Field(default_factory=list, description="List of mapped output ports")
    ancillas: List[AncillaContract] = Field(default_factory=list, description="List of ancillae expected to remain clean")
    reference_name: str = Field("Classical Reference", description="Name of the reference design")
    reference_source_type: ReferenceSourceType = Field(
        ReferenceSourceType.INDEPENDENT_VERILOG,
        description="Provenance of reference: independent_schematic, independent_verilog, template_reference, or quantum_derived"
    )
    mode: VerificationMode = Field(VerificationMode.STATEVECTOR_IDEAL, description="Simulation mode")
    num_shots: int = Field(1024, ge=1, le=65536, description="Number of shots for shot measurement mode")

    @model_validator(mode="after")
    def validate_unique_qubits(self) -> "VerificationContract":
        # Check input ports do not overlap with each other
        input_qubits: List[int] = []
        for port in self.input_ports:
            for q in port.qubit_indices:
                if q in input_qubits:
                    raise ValueError(f"Qubit index {q} assigned to multiple input ports.")
                input_qubits.append(q)

        # Check ancillae do not overlap with input ports
        for anc in self.ancillas:
            if anc.qubit_index in input_qubits:
                raise ValueError(f"Ancilla qubit {anc.qubit_index} cannot also be an input port qubit.")

        return self

    def total_input_bits(self) -> int:
        return sum(port.bit_width for port in self.input_ports)

    def total_output_bits(self) -> int:
        return sum(port.bit_width for port in self.output_ports)


class TruthTableRow(BaseModel):
    """Row in the differential verification truth table."""
    state_index: int
    input_bitstring: str
    input_values: Dict[str, int]
    verilog_output_bitstring: str
    verilog_output_values: Dict[str, int]
    quantum_output_bitstring: str
    quantum_output_values: Dict[str, int]
    match: bool
    ancilla_clean: bool
    state_fidelity: float = 1.0
    probabilities: Optional[Dict[str, float]] = None


class BoxPlotStats(BaseModel):
    """Five-number summary + IQR for state fidelity and error distributions."""
    min: float
    q1: float
    median: float
    q3: float
    max: float
    iqr: float


class HeatmapData(BaseModel):
    """2D grid of errors: input states (rows) vs output bits (columns)."""
    input_labels: List[str]
    output_bit_names: List[str]
    matrix: List[List[int]]  # 0 for match, 1 for mismatch


class HistogramEntry(BaseModel):
    """Probability comparison between Verilog reference (deterministic 1.0) and quantum distribution."""
    state_label: str
    verilog_prob: float
    quantum_prob: float


class VerificationResult(BaseModel):
    """Complete result returned to the client and analytics dashboard."""
    status: ExecutionEngineStatus
    message: str
    stderr: Optional[str] = None
    total_states_tested: int
    total_errors: int
    error_rate: float
    state_fidelity_avg: float
    state_fidelity_curve: List[float]
    box_plot: BoxPlotStats
    heatmap: HeatmapData
    histograms: List[HistogramEntry]
    truth_table: List[TruthTableRow]
    ancilla_clean_all: bool
    execution_time_ms: float
    verilog_source: Optional[str] = None
    top_module: Optional[str] = None
    session_id: Optional[str] = None
    reference_name: str = Field("Classical Reference", description="Label of classical reference")
    reference_source_type: ReferenceSourceType = Field(ReferenceSourceType.INDEPENDENT_VERILOG, description="Reference provenance")
    quantum_circuit_name: str = Field("Quantum Circuit", description="Target quantum circuit name")
    is_golden_eligible: bool = Field(True, description="False if derived from quantum circuit")
    classical_self_consistency: Optional[bool] = Field(None, description="True if schematic logic matches compiled Verilog")
    diagnostics: List[str] = Field(default_factory=list, description="Validation warnings or loop notices")


class VerilogSimulateRequest(BaseModel):
    """Direct Verilog simulation request without quantum circuit comparison."""
    verilog_code: str
    top_module_name: Optional[str] = None
    input_ports: List[PortMapping]
    output_ports: List[PortMapping]


class VerilogSimulateResponse(BaseModel):
    """Result of direct Verilog simulation."""
    status: ExecutionEngineStatus
    message: str
    stderr: Optional[str] = None
    total_states: int
    table: List[Dict[str, Any]]
    execution_time_ms: float
