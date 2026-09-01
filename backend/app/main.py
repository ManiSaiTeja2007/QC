"""FastAPI Modular Application Server for Quantum ALU 3D Studio."""

import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Add backend directory to sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.app.schemas.simulation import SimulationRequest, CustomCircuitRequest, SingleGateRequest
from backend.app.gates.basic_gates import build_fredkin_circuit
from backend.app.modules.falfg import build_falfg_clifford_t, build_falfg_ncv
from backend.app.modules.one_bit_alu import (
    build_one_bit_alu_clifford_t,
    build_one_bit_alu_ncv,
    ALU_LOGIC_OPERATIONS,
    ALU_ARITHMETIC_OPERATIONS,
)
from backend.app.modules.uncomputation import build_uncomputed_adder_subtractor
from backend.app.core.canonical_ir import build_canonical_circuit_ir
from backend.app.core.cost_metrics import analyze_circuit_cost


app = FastAPI(
    title="Quantum ALU 3D Studio Modular Backend API",
    description="Research-grade Quantum Canonical IR, Dual-Level Step Store, and Unitary Verification Engine",
    version="3.0.0",
)

# Enable CORS for React frontend (Vite port 5173 / 8502)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Quantum ALU Backend", "version": "3.0.0"}


@app.get("/api/presets")
def get_presets():
    """Returns preset operational configs."""
    return {
        "logic_operations": list(ALU_LOGIC_OPERATIONS.keys()),
        "arithmetic_operations": list(ALU_ARITHMETIC_OPERATIONS.keys()),
        "architectures": [
            "1-bit-alu",
            "falfg-gate",
            "fredkin-gate",
            "bennett-adder",
        ]
    }


@app.post("/api/simulate")
def simulate_circuit(req: SimulationRequest):
    """Executes Canonical Quantum IR simulation with dual-level stepping and unitary verification."""
    arch = req.architecture.lower()
    is_ct = "clifford" in req.synthesis.lower()

    if "alu" in arch or "1-bit" in arch or "one_bit" in arch:
        qubit_names = ["Q0 A (Result)", "Q1 B (Cout)", "Q2 S0 (Cin)",
                       "Q3 S1", "Q4 M (Mode)", "Q5 S2", "Q6 S3"]
        qc = build_one_bit_alu_clifford_t() if is_ct else build_one_bit_alu_ncv()
        arch_title = "1-Bit Fault-Tolerant ALU"
    elif "falfg" in arch:
        qubit_names = ["Q0 A (Carry/P)", "Q1 B (Sum/Q)", "Q2 C (R)", "Q3 D (S)", "Q4 E (T)"]
        qc = build_falfg_clifford_t() if is_ct else build_falfg_ncv()
        arch_title = "5×5 FALFG Reversible Gate"
    elif "fredkin" in arch or "cswap" in arch:
        qubit_names = ["Q0 Control A", "Q1 Target B", "Q2 Target C"]
        qc = build_fredkin_circuit("clifford_t" if is_ct else "ncv")
        arch_title = "3×3 Fredkin CSWAP Gate"
    elif "bennett" in arch or "uncompute" in arch:
        qubit_names = ["Q0 A", "Q1 B", "Q2 Cin", "Q3 Sel", "Q4 Mode",
                       "Q5 Cout", "Q6 Sum", "Q7 Cout'", "Q8 Sum'"]
        qc = build_uncomputed_adder_subtractor()
        arch_title = "Bennett Uncomputed Adder/Subtractor"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown architecture: {req.architecture}")

    # Gracefully adjust input_bits length to match architecture qubit count
    if len(req.input_bits) < qc.num_qubits:
        input_bits = req.input_bits + [0] * (qc.num_qubits - len(req.input_bits))
    else:
        input_bits = req.input_bits[:qc.num_qubits]

    # 1. Execute Canonical IR Dual-Level Step Store Simulation
    ir_payload = build_canonical_circuit_ir(qc, input_bits)

    # 2. Analyze Cost Metrics
    metrics = analyze_circuit_cost(qc)

    ir_payload["circuit_name"] = arch_title
    ir_payload["qubit_names"] = qubit_names
    ir_payload["metrics"] = metrics

    return ir_payload


@app.post("/api/simulate-custom")
def simulate_custom_circuit(req: CustomCircuitRequest):
    """Executes Canonical Quantum IR simulation for user-built custom circuits from the Circuit Builder."""
    from qiskit import QuantumCircuit
    n_qubits = req.num_qubits
    if len(req.input_bits) < n_qubits:
        input_bits = req.input_bits + [0] * (n_qubits - len(req.input_bits))
    else:
        input_bits = req.input_bits[:n_qubits]

    qc = QuantumCircuit(n_qubits, name=req.circuit_name or "User Custom Circuit")

    for g in req.gates:
        name = g.name.upper()
        q = g.qubits
        params = g.params or []

        if name == "H":
            qc.h(q[0])
        elif name == "X":
            qc.x(q[0])
        elif name == "Y":
            qc.y(q[0])
        elif name == "Z":
            qc.z(q[0])
        elif name == "S":
            qc.s(q[0])
        elif name == "SDG":
            qc.sdg(q[0])
        elif name == "T":
            qc.t(q[0])
        elif name == "TDG":
            qc.tdg(q[0])
        elif name == "CX" and len(q) >= 2:
            qc.cx(q[0], q[1])
        elif name == "CZ" and len(q) >= 2:
            qc.cz(q[0], q[1])
        elif name == "SWAP" and len(q) >= 2:
            qc.swap(q[0], q[1])
        elif name == "RX" and params:
            qc.rx(params[0], q[0])
        elif name == "RY" and params:
            qc.ry(params[0], q[0])
        elif name == "RZ" and params:
            qc.rz(params[0], q[0])

    qubit_names = [f"Q{i}" for i in range(n_qubits)]
    ir_payload = build_canonical_circuit_ir(qc, input_bits)
    metrics = analyze_circuit_cost(qc)

    ir_payload["circuit_name"] = req.circuit_name or "User Custom Circuit"
    ir_payload["qubit_names"] = qubit_names
    ir_payload["metrics"] = metrics

    return ir_payload


@app.post("/api/simulate-single-gate")
def simulate_single_gate(req: SingleGateRequest):
    """Executes standalone 2-step simulation for an individual quantum gate."""
    from qiskit import QuantumCircuit
    import numpy as np
    name = req.gate_name.upper()

    # Determine qubit count based on gate type
    if name in ["CX", "CY", "CZ", "CH", "CRX", "CRY", "CRZ", "SWAP", "ISWAP"]:
        n_qubits = 2
    elif name in ["CCX", "CSWAP"]:
        n_qubits = 3
    else:
        n_qubits = 1

    input_bits = (req.input_bits + [0] * n_qubits)[:n_qubits]
    params = req.params or [np.pi / 2]

    qc = QuantumCircuit(n_qubits, name=f"Single Gate Laboratory: {name}")

    if name == "H":
        qc.h(0)
    elif name == "X":
        qc.x(0)
    elif name == "Y":
        qc.y(0)
    elif name == "Z":
        qc.z(0)
    elif name == "S":
        qc.s(0)
    elif name == "SDG":
        qc.sdg(0)
    elif name == "T":
        qc.t(0)
    elif name == "TDG":
        qc.tdg(0)
    elif name in ["P", "PHASE"]:
        qc.p(params[0], 0)
    elif name == "RX":
        qc.rx(params[0], 0)
    elif name == "RY":
        qc.ry(params[0], 0)
    elif name == "RZ":
        qc.rz(params[0], 0)
    elif name == "CX" and n_qubits >= 2:
        qc.cx(0, 1)
    elif name == "CY" and n_qubits >= 2:
        qc.cy(0, 1)
    elif name == "CZ" and n_qubits >= 2:
        qc.cz(0, 1)
    elif name == "CH" and n_qubits >= 2:
        qc.ch(0, 1)
    elif name == "CRX" and n_qubits >= 2:
        qc.crx(params[0], 0, 1)
    elif name == "CRY" and n_qubits >= 2:
        qc.cry(params[0], 0, 1)
    elif name == "CRZ" and n_qubits >= 2:
        qc.crz(params[0], 0, 1)
    elif name == "SWAP" and n_qubits >= 2:
        qc.swap(0, 1)
    elif name == "ISWAP" and n_qubits >= 2:
        qc.iswap(0, 1)
    elif name == "CCX" and n_qubits >= 3:
        qc.ccx(0, 1, 2)
    elif name == "CSWAP" and n_qubits >= 3:
        qc.cswap(0, 1, 2)
    else:
        qc.h(0)

    qubit_names = [f"Q{i}" for i in range(n_qubits)]
    ir_payload = build_canonical_circuit_ir(qc, input_bits)
    metrics = analyze_circuit_cost(qc)

    ir_payload["circuit_name"] = f"Individual Gate Simulation: {name}"
    ir_payload["qubit_names"] = qubit_names
    ir_payload["metrics"] = metrics

    return ir_payload


# Serve static files if directory exists
static_dir = Path(__file__).resolve().parent.parent.parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
