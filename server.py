"""FastAPI High-Performance Backend & Quantum Simulation Engine.

IEEE TETC 2026 Paper Replication & Interactive Web Workbench:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"

Provides REST API endpoints:
  - GET  /api/presets  -> Returns predefined ALU/FALFG/Fredkin/Bennett operational configs.
  - POST /api/simulate -> Executes Canonical IR gate-by-gate simulation with dual-level stepping
                          (Logical Operations vs Primitive Gates) & unitary step verification.
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from qiskit import QuantumCircuit
from backend.app.gates.basic_gates import build_fredkin_circuit
from backend.app.modules.falfg import build_falfg_clifford_t, build_falfg_ncv
from backend.app.modules.one_bit_alu import (
    build_one_bit_alu_clifford_t,
    build_one_bit_alu_ncv,
    ALU_LOGIC_OPERATIONS,
    ALU_ARITHMETIC_OPERATIONS,
)
from backend.app.modules.uncomputation import build_uncomputed_adder_subtractor
from backend.app.simulation.canonical_ir import build_canonical_circuit_ir
from backend.app.simulation.cost_metrics import analyze_circuit_cost


app = FastAPI(title="Quantum ALU 3D Workbench API", version="3.0.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SimulationRequest(BaseModel):
    architecture: str
    synthesis: str = "clifford_t"
    input_bits: List[int]
    preset_name: Optional[str] = None


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

    if len(req.input_bits) != qc.num_qubits:
        raise HTTPException(
            status_code=400,
            detail=f"Architecture '{arch_title}' expects {qc.num_qubits} input bits, got {len(req.input_bits)}"
        )

    # Build Canonical IR with dual-level stepping (Logical Ops vs Primitive Gates)
    ir = build_canonical_circuit_ir(qc, req.input_bits)
    metrics = analyze_circuit_cost(qc, arch_title)

    return {
        "architecture": arch_title,
        "synthesis": "Clifford+T" if is_ct else "NCV",
        "num_qubits": ir["num_qubits"],
        "qubit_names": qubit_names,
        "input_bits": ir["input_bits"],
        "output_bits": ir["output_bits"],
        "p_in": ir["p_in"],
        "p_out": ir["p_out"],
        "parity_preserved": ir["parity_preserved"],
        "total_primitive_steps": ir["total_primitive_steps"],
        "total_logical_ops": ir["total_logical_ops"],
        "logical_operations": ir["logical_operations"],
        "primitive_gates": ir["primitive_gates"],
        "metrics": metrics,
        "steps": ir["steps"],
    }


# Mount static frontend directory
STATIC_DIR = PROJECT_ROOT / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
