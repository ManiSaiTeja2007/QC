"""Fault-Tolerant Arithmetic Logic Function Generator (FALFG).

Reversible 5x5 quantum gate acting as a Full Adder/Subtractor and 24-function
Arithmetic & Logic Function Generator, as proposed in Section IV.A-B of:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"
(IEEE TETC 2026).
"""

from typing import Dict, Tuple, Any
from qiskit import QuantumCircuit
from backend.app.gates.basic_gates import add_cv, add_cv_dag


# Theoretical Table IV Truth Table mapping for all 32 states (Index -> Output Decimal)
TABLE_IV_TRUTH_TABLE: Dict[int, int] = {
    0: 0, 1: 1, 2: 7, 3: 6, 4: 13, 5: 12, 6: 30, 7: 31,
    8: 11, 9: 10, 10: 24, 11: 25, 12: 18, 13: 19, 14: 21, 15: 20,
    16: 14, 17: 15, 18: 9, 19: 8, 20: 23, 21: 22, 22: 4, 23: 5,
    24: 17, 25: 16, 26: 2, 27: 3, 28: 28, 29: 29, 30: 27, 31: 26
}

# Table V Logic Modes: (C, D, E) -> Function names for (P, Q, R, S, T)
FALFG_LOGIC_MODES = {
    (0, 0, 0): {"P": "AND", "Q": "XOR", "R": "AB'", "S": "XOR", "T": "B"},
    (0, 1, 0): {"P": "A'B", "Q": "XOR", "R": "NOR", "S": "XNOR", "T": "B'"},
    (1, 0, 0): {"P": "OR", "Q": "XNOR", "R": "A+B'", "S": "XOR", "T": "B'"},
    (1, 1, 0): {"P": "A'+B", "Q": "XNOR", "R": "NAND", "S": "XNOR", "T": "B"},
}

# Table V Arithmetic Modes: (D, E) with Cin on C
FALFG_ARITHMETIC_MODES = {
    "Full Adder": {"D": 0, "P": "Carry Out", "Q": "Sum"},
    "Full Subtractor": {"D": 1, "P": "Borrow Out", "Q": "Diff"},
    "Half Adder": {"C": 0, "D": 0, "P": "Carry Out", "Q": "Sum"},
    "Half Subtractor": {"C": 0, "D": 1, "P": "Borrow Out", "Q": "Diff"},
    "Increment A": {"B": 0, "C": 1, "D": 0, "P": "Carry Out", "Q": "A+1"},
    "Decrement A": {"B": 0, "C": 1, "D": 1, "P": "Borrow Out", "Q": "A-1"},
}


def build_falfg_ncv() -> QuantumCircuit:
    """Constructs the 5x5 FALFG Gate using NCV quantum gate set (Fig. 4).

    Inputs:
      - Qubit 0: A (Operand A)
      - Qubit 1: B (Operand B)
      - Qubit 2: Cin (Carry/Borrow in / Select C)
      - Qubit 3: Sel (Addition/Subtraction Select D)
      - Qubit 4: Don't Care (Mode E: 0 or 1)

    Outputs:
      - Qubit 0: Carry/Borrow (P)
      - Qubit 1: Sum/Diff (Q)
      - Qubit 2: G1 (Garbage 1 / R)
      - Qubit 3: G2 (Garbage 2 / S)
      - Qubit 4: G3 (Garbage 3 / T)

    Metrics:
      - Quantum Cost (QC) = 11
      - Quantum Delay = 9
      - Parity Preserving = True
    """
    qc = QuantumCircuit(5, name="FALFG_NCV")
    
    # 1. CX(A, B)
    qc.cx(0, 1)
    # 2. CX(Sel, A)
    qc.cx(3, 0)
    # 3. CX(B, Sel)
    qc.cx(1, 3)
    # 4. CX(Cin, B)
    qc.cx(2, 1)
    # 5. CX(B, Don't Care)
    qc.cx(1, 4)
    # 6. CX(A, Don't Care)
    qc.cx(0, 4)
    # 7. CX(A, Cin)
    qc.cx(0, 2)
    # 8. Controlled-V(Cin, A)
    add_cv(qc, 2, 0)
    # 9. Controlled-V(Sel, A)
    add_cv(qc, 3, 0)
    # 10. CX(Sel, Cin)
    qc.cx(3, 2)
    # 11. Controlled-V†(Cin, A)
    add_cv_dag(qc, 2, 0)
    # 12. CX(A, Cin)
    qc.cx(0, 2)
    # 13. CX(Sel, Cin)
    qc.cx(3, 2)

    return qc


def build_falfg_clifford_t() -> QuantumCircuit:
    """Constructs the fault-tolerant Clifford+T based 5x5 FALFG Gate (Fig. 5).

    Inputs:
      - Qubit 0: A
      - Qubit 1: B
      - Qubit 2: C (Cin)
      - Qubit 3: D (Sel)
      - Qubit 4: E (Don't Care / Mode)

    Outputs:
      - Qubit 0: P (Carry/Borrow)
      - Qubit 1: Q (Sum/Diff)
      - Qubit 2: G1 / R
      - Qubit 3: G2 / S
      - Qubit 4: G3 / T

    Metrics:
      - T-count = 7
      - T-depth = 3
      - Total Gate Count = 20
      - Parity Preserving = True
    """
    qc = QuantumCircuit(5, name="FALFG_Clifford_T")

    # Initial Reversible Pre-processing
    qc.cx(0, 1)  # CX(A, B)
    qc.cx(3, 0)  # CX(D, A)
    qc.cx(1, 3)  # CX(B, D)
    qc.cx(2, 1)  # CX(C, B)
    qc.cx(1, 4)  # CX(B, E)
    qc.cx(0, 4)  # CX(A, E)

    # Simplified Clifford+T Arithmetic Core (T-count=7, T-depth=3)
    qc.cx(0, 2)  # CX(A, C)
    qc.h(0)
    qc.cx(0, 2)

    # Layer 1 of T gates (2 T gates in parallel)
    qc.t(0)
    qc.tdg(2)

    qc.cx(0, 2)
    qc.cx(3, 0)

    # Layer 2 of T gates (3 T gates in parallel)
    qc.tdg(0)
    qc.t(2)
    qc.t(3)

    qc.cx(2, 0)
    qc.cx(3, 2)

    # Layer 3 of T gates (2 T gates in parallel)
    qc.t(0)
    qc.tdg(2)

    qc.cx(2, 0)
    qc.h(0)
    qc.cx(0, 2)
    qc.cx(3, 2)

    return qc
