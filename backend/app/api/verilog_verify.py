"""Verilog ↔ Quantum Equivalence Verification API Router.

Provides endpoints for:
- Retrieving curated golden Verilog reference templates
- Standalone Verilog simulation via Icarus Verilog
- Full differential cross-checking between Verilog and Quantum circuits
- Dual export of Quantum (QASM/JSON) and Classical (Verilog .v/_tb.v) descriptions
"""

import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Body, status
from pydantic import BaseModel, Field

from backend.app.schemas.verification_contract import (
    VerificationContract,
    VerificationResult,
    VerilogSimulateRequest,
    VerilogSimulateResponse,
    ExecutionEngineStatus,
)
from backend.app.schemas.simulation import CustomCircuitRequest
from backend.app.simulation.verilog_engine import (
    simulate_verilog,
    generate_testbench,
    extract_top_module_name,
)
from backend.app.core.verilog_generator import (
    list_verilog_templates,
    get_verilog_template,
    export_circuit_to_verilog,
)
from backend.app.simulation.equivalence_metrics import run_full_verification
from backend.app.simulation.quantum_verifier import build_circuit_from_gates
from backend.app.core.circuit_storage import (
    load_circuit_by_id,
    circuit_to_qiskit,
)
from qiskit import QuantumCircuit
from qiskit.qasm2 import dumps as qasm2_dumps

router = APIRouter()


from backend.app.schemas.classical_netlist import ClassicalNetlist


class CircuitVerifyPayload(BaseModel):
    """Payload for differential verification endpoint."""
    contract: VerificationContract
    circuit_id: Optional[str] = Field(None, description="Optional ID of existing circuit from storage/catalog")
    custom_circuit: Optional[CustomCircuitRequest] = Field(None, description="Optional custom circuit from Builder")
    schematic_netlist: Optional[ClassicalNetlist] = Field(None, description="Optional canonical classical schematic netlist for self-consistency checking")


class DualExportPayload(BaseModel):
    """Payload requesting dual export of Quantum + Classical files."""
    circuit_id: Optional[str] = None
    custom_circuit: Optional[CustomCircuitRequest] = None
    verilog_code: Optional[str] = None
    top_module_name: Optional[str] = None


@router.get("/templates", response_model=List[Dict[str, Any]])
def get_templates():
    """Returns curated golden reference Verilog templates (AND, Half Adder, Full Adder, FALFG, ALU)."""
    return list_verilog_templates()


@router.get("/templates/{template_id}")
def get_template_by_id(template_id: str):
    """Returns a specific golden Verilog template by its ID."""
    t = get_verilog_template(template_id)
    if not t:
        raise HTTPException(status_code=404, detail=f"Verilog template '{template_id}' not found.")
    return {
        "id": t["id"],
        "name": t["name"],
        "description": t["description"],
        "top_module": t["top_module"],
        "verilog_code": t["verilog_code"],
        "input_ports": [p.model_dump() for p in t["input_ports"]],
        "output_ports": [p.model_dump() for p in t["output_ports"]],
    }


@router.post("/simulate-verilog", response_model=VerilogSimulateResponse)
def simulate_standalone_verilog(req: VerilogSimulateRequest):
    """Executes Icarus Verilog simulation directly for a Verilog module across all 2^k states."""
    status_code, table, message, stderr, elapsed = simulate_verilog(
        verilog_code=req.verilog_code,
        input_ports=req.input_ports,
        output_ports=req.output_ports,
        top_module_name=req.top_module_name,
    )
    return VerilogSimulateResponse(
        status=status_code,
        message=message,
        stderr=stderr,
        total_states=len(table),
        table=table,
        execution_time_ms=round(elapsed, 2),
    )


@router.post("/verify", response_model=VerificationResult)
def verify_circuit_against_verilog(payload: CircuitVerifyPayload):
    """Executes full differential cross-checking between Verilog golden reference and Quantum circuit."""
    contract = payload.contract
    target_circuit_id = payload.circuit_id or contract.circuit_id

    # Auto-resolve from template if top_module_name matches and ports/code are missing
    if contract.top_module_name:
        tmpl = get_verilog_template(contract.top_module_name)
        if tmpl:
            if not contract.verilog_code:
                contract.verilog_code = tmpl["verilog_code"]
            if not contract.input_ports:
                contract.input_ports = tmpl["input_ports"]
            if not contract.output_ports:
                contract.output_ports = tmpl["output_ports"]

    # Auto-resolve from schematic_netlist if provided and ports are missing
    if payload.schematic_netlist:
        from backend.app.schemas.verification_contract import PortMapping, PortDirection
        if not contract.input_ports and payload.schematic_netlist.inputs:
            contract.input_ports = [
                PortMapping(name=p.name, direction=PortDirection.INPUT, bit_width=p.bit_width, qubit_indices=list(range(i, i + p.bit_width)))
                for i, p in enumerate(payload.schematic_netlist.inputs)
            ]
        if not contract.output_ports and payload.schematic_netlist.outputs:
            in_offset = sum(len(p.qubit_indices) for p in contract.input_ports)
            contract.output_ports = [
                PortMapping(name=p.name, direction=PortDirection.OUTPUT, bit_width=p.bit_width, qubit_indices=list(range(in_offset + i, in_offset + i + p.bit_width)))
                for i, p in enumerate(payload.schematic_netlist.outputs)
            ]

    # Validate that at least 1 input and 1 output port are present
    if not contract.input_ports or not contract.output_ports:
        raise HTTPException(
            status_code=400,
            detail="Verification contract must specify at least one input port and one output port (or a recognized reference template).",
        )

    # Resolve QuantumCircuit instance
    qc: Optional[QuantumCircuit] = None

    if payload.custom_circuit:
        c_req = payload.custom_circuit
        gates_list = [
            {"name": g.name, "qubits": g.qubits, "params": g.params}
            for g in c_req.gates
        ]
        qc = build_circuit_from_gates(
            num_qubits=c_req.num_qubits,
            gates_data=gates_list,
            circuit_name=c_req.circuit_name or "Custom Circuit Under Test",
        )
    elif target_circuit_id:
        stored = load_circuit_by_id(target_circuit_id)
        if not stored:
            raise HTTPException(
                status_code=404,
                detail=f"Circuit with ID '{target_circuit_id}' not found in storage.",
            )
        qc = circuit_to_qiskit(stored)
    else:
        raise HTTPException(
            status_code=400,
            detail="Either 'custom_circuit' or 'circuit_id' must be provided for verification.",
        )

    assert qc is not None

    # Validate qubit indices in contract against circuit width
    max_qubit_in_contract = 0
    for p in contract.input_ports + contract.output_ports:
        for q in p.qubit_indices:
            max_qubit_in_contract = max(max_qubit_in_contract, q)
    for anc in contract.ancillas:
        max_qubit_in_contract = max(max_qubit_in_contract, anc.qubit_index)

    if max_qubit_in_contract >= qc.num_qubits:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Verification contract references qubit index {max_qubit_in_contract}, "
                f"but the quantum circuit only has {qc.num_qubits} qubits (indices 0..{qc.num_qubits - 1})."
            ),
        )

    # Run verification pipeline
    result = run_full_verification(
        contract=contract,
        quantum_circuit=qc,
        schematic_netlist=payload.schematic_netlist,
    )
    return result


@router.post("/export-dual")
def export_dual_circuits(payload: DualExportPayload):
    """Exports synchronized Quantum (QASM 2.0 / JSON) and Verilog (.v / _tb.v) representations."""
    qc: Optional[QuantumCircuit] = None
    circ_name = "circuit"
    num_qubits = 1
    circ_dict: Dict[str, Any] = {}

    if payload.custom_circuit:
        c = payload.custom_circuit
        circ_name = c.circuit_name or "custom_circuit"
        num_qubits = c.num_qubits
        gates_list = [{"name": g.name, "qubits": g.qubits, "params": g.params} for g in c.gates]
        qc = build_circuit_from_gates(num_qubits, gates_list, circ_name)
        circ_dict = c.model_dump()
    elif payload.circuit_id:
        stored = load_circuit_by_id(payload.circuit_id)
        if not stored:
            raise HTTPException(status_code=404, detail=f"Circuit '{payload.circuit_id}' not found.")
        circ_name = stored.name
        num_qubits = stored.num_qubits
        qc = circuit_to_qiskit(stored)
        circ_dict = stored.model_dump()
    else:
        raise HTTPException(status_code=400, detail="Must provide circuit_id or custom_circuit.")

    # Generate QASM
    try:
        assert qc is not None
        qasm_str = qasm2_dumps(qc)
    except Exception as e:
        qasm_str = f"// QASM export failed: {str(e)}"

    # Generate or retain Verilog
    top_mod = payload.top_module_name or extract_top_module_name(payload.verilog_code or "") or "quantum_circuit"
    if payload.verilog_code and payload.verilog_code.strip():
        verilog_str = payload.verilog_code
    else:
        verilog_str = export_circuit_to_verilog(circ_name, num_qubits)

    return {
        "circuit_name": circ_name,
        "num_qubits": num_qubits,
        "qasm": qasm_str,
        "circuit_json": circ_dict,
        "verilog_code": verilog_str,
        "top_module": top_mod,
    }
