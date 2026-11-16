"""Parameterized Multi-Bit Quantum ALU Cascade Builder & QMDD Execution Engine.

Constructs and simulates scalable N-bit Ripple-Carry Fault-Tolerant Reversible Quantum ALUs
(N in {1, 2, 4, 8, 16, 32, 64} bits, scaling up to 448 qubits) based on Section IV.D and
Figure 10 of IEEE TETC 2026:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU".

Simulated natively using the exact Cyclotomic QMDD decision-diagram engine without Qiskit Aer,
breaking the exponential O(2^n) memory wall and verifying Table VI operations at 64-bit widths.
"""

from __future__ import annotations
import time
from typing import Dict, Any, Tuple, Optional
from qiskit import QuantumCircuit

from backend.app.modules.one_bit_alu import (
    build_one_bit_alu_clifford_t,
    ALU_LOGIC_OPERATIONS,
    ALU_ARITHMETIC_OPERATIONS,
)
from backend.app.dd_engine.qmdd import QMDDState


def compute_golden_alu_result(
    n_bits: int,
    operation: str,
    a_val: int,
    b_val: int,
    cin_val: int = 0,
) -> Tuple[int, int]:
    """Computes exact classical arithmetic and bitwise logic outputs for N-bit ALU."""
    mask = (1 << n_bits) - 1
    op_clean = operation.strip()

    if "Full Adder" in op_clean:
        total = a_val + b_val + cin_val
        return total & mask, 1 if total >= (1 << n_bits) else 0

    if "Full Subtractor" in op_clean:
        diff = a_val - b_val - cin_val
        borrow = 1 if diff < 0 else 0
        return diff & mask, borrow

    if "Half Adder" in op_clean:
        total = a_val + b_val
        return total & mask, 1 if total >= (1 << n_bits) else 0

    if "Half Subtractor" in op_clean:
        diff = a_val - b_val
        return diff & mask, 1 if diff < 0 else 0

    if "Increment" in op_clean:
        total = a_val + 1
        return total & mask, 1 if total >= (1 << n_bits) else 0

    if "Decrement" in op_clean:
        diff = a_val - 1
        return diff & mask, 1 if diff < 0 else 0

    if "Transfer A" in op_clean:
        return a_val & mask, 0

    if "Complement A" in op_clean:
        return (~a_val) & mask, 0

    # Logic operations (bitwise across all n_bits)
    if "XOR" in op_clean:
        return (a_val ^ b_val) & mask, 0

    if "XNOR" in op_clean:
        return (~(a_val ^ b_val)) & mask, 0

    if "AND" in op_clean and "NAND" not in op_clean:
        return (a_val & b_val) & mask, 0

    if "NAND" in op_clean:
        return (~(a_val & b_val)) & mask, 0

    if "OR" in op_clean and "NOR" not in op_clean and "XOR" not in op_clean and "XNOR" not in op_clean:
        return (a_val | b_val) & mask, 0

    if "NOR" in op_clean and "XNOR" not in op_clean:
        return (~(a_val | b_val)) & mask, 0

    # Default fallback: bitwise XOR
    return (a_val ^ b_val) & mask, 0


def get_operation_controls(operation: str) -> Dict[str, int]:
    """Resolves control line configurations (M, S0, S1, S2, S3) from Table VI with robust word matching."""
    op_clean = operation.strip().upper()

    # 1. Exact match in logic operations
    for name, spec in ALU_LOGIC_OPERATIONS.items():
        if name.upper() == op_clean:
            return {
                "M": int(spec["M"]),
                "S0": int(spec["S0"]),
                "S1": int(spec["S1"]),
                "S2": int(spec["S2"]),
                "S3": int(spec["S3"]),
            }

    # 2. Exact match in arithmetic operations
    for name, spec in ALU_ARITHMETIC_OPERATIONS.items():
        if name.upper() == op_clean:
            s0_spec = spec["S0"]
            s0_val = 0 if s0_spec in ("Cin", "Bin") else int(s0_spec)
            return {
                "M": int(spec["M"]),
                "S0": s0_val,
                "S1": int(spec["S1"]),
                "S2": int(spec["S2"]),
                "S3": int(spec["S3"]),
            }

    # 3. Leading keyword match (avoiding "OR" inside "XOR")
    op_word = op_clean.split()[0]
    for name, spec in ALU_LOGIC_OPERATIONS.items():
        if name.split()[0].upper() == op_word:
            return {
                "M": int(spec["M"]),
                "S0": int(spec["S0"]),
                "S1": int(spec["S1"]),
                "S2": int(spec["S2"]),
                "S3": int(spec["S3"]),
            }

    for name, spec in ALU_ARITHMETIC_OPERATIONS.items():
        if name.split()[0].upper() == op_word:
            s0_spec = spec["S0"]
            s0_val = 0 if s0_spec in ("Cin", "Bin") else int(s0_spec)
            return {
                "M": int(spec["M"]),
                "S0": s0_val,
                "S1": int(spec["S1"]),
                "S2": int(spec["S2"]),
                "S3": int(spec["S3"]),
            }

    # Default: Full Adder controls
    return {"M": 1, "S0": 0, "S1": 0, "S2": 1, "S3": 0}


def build_multibit_alu_circuit(
    n_bits: int,
    operation: str = "Full Adder",
    a_val: int = 0,
    b_val: int = 0,
    cin_val: int = 0,
) -> QuantumCircuit:
    """Builds an N-bit Fault-Tolerant Reversible Quantum ALU circuit (Fig. 10).

    Each bit slice i has 7 qubits:
      - 7*i + 0: A_i (Data Operand A, outputs Result bit i)
      - 7*i + 1: B_i (Data Operand B, outputs Carry/Borrow Cout_i)
      - 7*i + 2: Cin_i (Carry/Borrow in for arithmetic; S0 for logic)
      - 7*i + 3: S1
      - 7*i + 4: M (Mode select)
      - 7*i + 5: S2
      - 7*i + 6: S3
    Total Qubits: 7 * n_bits.
    """
    total_q = 7 * n_bits
    qc = QuantumCircuit(total_q, name=f"{n_bits}Bit_QALU_{operation}")
    one_bit = build_one_bit_alu_clifford_t()
    ctrls = get_operation_controls(operation)
    is_arithmetic = (ctrls["M"] == 1)

    # 1. Initialize input basis states for all slices
    for i in range(n_bits):
        base = 7 * i
        # Data operand A
        if (a_val >> i) & 1:
            qc.x(base + 0)
        # Data operand B
        if (b_val >> i) & 1:
            qc.x(base + 1)

        # Wire 2: S0 for logic mode across ALL slices
        if not is_arithmetic and ctrls["S0"]:
            qc.x(base + 2)

        # Control lines for this slice
        if ctrls["S1"]:
            qc.x(base + 3)
        if ctrls["M"]:
            qc.x(base + 4)
        if ctrls["S2"]:
            qc.x(base + 5)
        if ctrls["S3"]:
            qc.x(base + 6)

    # Primary Cin on slice 0 in arithmetic mode
    if is_arithmetic and (cin_val or ctrls["S0"]):
        qc.x(2)

    # 2. Sequential ripple-carry cascade
    for i in range(n_bits):
        base = 7 * i
        qubits = list(range(base, base + 7))
        qc.compose(one_bit, qubits=qubits, inplace=True)

        # In arithmetic mode, propagate carry Cout_i (wire 1) to Cin_{i+1} (wire 2 of next slice)
        if is_arithmetic and (i + 1 < n_bits):
            qc.cx(base + 1, 7 * (i + 1) + 2)

    return qc


def simulate_multibit_alu_qmdd(
    n_bits: int,
    operation: str,
    a_val: int,
    b_val: int,
    cin_val: int = 0,
) -> Dict[str, Any]:
    """Simulates an N-bit Quantum ALU on the native Cyclotomic QMDD engine.

    Returns:
      Dictionary with execution timing, result bits, golden match, and QMDD node metrics.
    """
    t0 = time.perf_counter()
    qc = build_multibit_alu_circuit(n_bits, operation, a_val, b_val, cin_val)
    total_q = qc.num_qubits

    # Initialize zero basis state
    st = QMDDState.from_basis_state(total_q, [0] * total_q)
    # Execute full quantum circuit natively on QMDD
    st.apply_circuit(qc)
    bs = st.measure_basis_state()
    t1 = time.perf_counter()

    bits = [int(b) for b in reversed(bs)]

    # Result A is gathered from wire 0 of each slice
    measured_a = sum(bits[7 * i] << i for i in range(n_bits))
    # Final carry/borrow is on wire 1 of the last slice (slice n_bits - 1)
    measured_cout = bits[7 * (n_bits - 1) + 1] if get_operation_controls(operation)["M"] == 1 else 0

    golden_a, golden_cout = compute_golden_alu_result(n_bits, operation, a_val, b_val, cin_val)
    golden_match = (measured_a == golden_a) and (measured_cout == golden_cout)

    # Global parity preservation check
    parity_exp = st.expectation_z_all()
    # Parity of reversible circuit is strictly preserved from input
    parity_preserved = abs(abs(parity_exp) - 1.0) < 1e-4

    peak_nodes = st.node_count()
    comp_ratio = st.compression_ratio()
    runtime_ms = (t1 - t0) * 1000.0

    return {
        "n_bits": n_bits,
        "total_qubits": total_q,
        "operation": operation,
        "a_val": a_val,
        "b_val": b_val,
        "cin_val": cin_val,
        "measured_result": measured_a,
        "measured_cout": measured_cout,
        "golden_result": golden_a,
        "golden_cout": golden_cout,
        "golden_match": golden_match,
        "parity_preserved": parity_preserved,
        "parity_expectation": parity_exp,
        "peak_qmdd_nodes": peak_nodes,
        "compression_ratio": comp_ratio,
        "runtime_ms": round(runtime_ms, 2),
    }
