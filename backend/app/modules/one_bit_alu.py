"""1-Bit Fault-Tolerant Parity-Preserving Quantum ALU.

7x7 Reversible Circuit combining the 5x5 FALFG module with a 4:1 Multiplexer
(3 Fredkin gates) implementing 28 Arithmetic & Logic operations, as presented
in Section IV.C, Figures 6-8, and Table VI of:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"
(IEEE TETC 2026).
"""

from typing import Dict, Tuple, Any, Callable
from qiskit import QuantumCircuit
from backend.app.gates.basic_gates import add_fredkin_ncv, add_fredkin_clifford_t
from backend.app.modules.falfg import build_falfg_ncv, build_falfg_clifford_t


# Complete Table VI Operation Specifications
ALU_LOGIC_OPERATIONS: Dict[str, Dict[str, Any]] = {
    "AND": {"S0": 0, "S1": 0, "S2": 0, "S3": 0, "M": 0, "func": lambda a, b: a & b},
    "A'B (A<B)": {"S0": 0, "S1": 1, "S2": 0, "S3": 0, "M": 0, "func": lambda a, b: (1 - a) & b},
    "OR": {"S0": 1, "S1": 0, "S2": 0, "S3": 0, "M": 0, "func": lambda a, b: a | b},
    "A'+B": {"S0": 1, "S1": 1, "S2": 0, "S3": 0, "M": 0, "func": lambda a, b: (1 - a) | b},
    "XOR (A!=B)": {"S0": 0, "S1": 0, "S2": 1, "S3": 0, "M": 0, "func": lambda a, b: a ^ b},
    "XNOR (A=B)": {"S0": 1, "S1": 0, "S2": 1, "S3": 0, "M": 0, "func": lambda a, b: 1 - (a ^ b)},
    "AB' (A>B)": {"S0": 0, "S1": 0, "S2": 0, "S3": 1, "M": 0, "func": lambda a, b: a & (1 - b)},
    "NOR": {"S0": 0, "S1": 1, "S2": 0, "S3": 1, "M": 0, "func": lambda a, b: 1 - (a | b)},
    "A+B'": {"S0": 1, "S1": 0, "S2": 0, "S3": 1, "M": 0, "func": lambda a, b: a | (1 - b)},
    "NAND": {"S0": 1, "S1": 1, "S2": 0, "S3": 1, "M": 0, "func": lambda a, b: 1 - (a & b)},
    "Transfer B": {"S0": 0, "S1": 0, "S2": 1, "S3": 1, "M": 0, "func": lambda a, b: b},
    "Complement B": {"S0": 0, "S1": 1, "S2": 1, "S3": 1, "M": 0, "func": lambda a, b: 1 - b},
}

ALU_ARITHMETIC_OPERATIONS: Dict[str, Dict[str, Any]] = {
    "Half Adder": {
        "S0": 0, "S1": 0, "S2": 1, "S3": 0, "M": 1,
        "sum_func": lambda a, b, cin=0: a ^ b,
        "carry_func": lambda a, b, cin=0: a & b
    },
    "Half Subtractor": {
        "S0": 0, "S1": 1, "S2": 1, "S3": 0, "M": 1,
        "diff_func": lambda a, b, bin_in=0: a ^ b,
        "borrow_func": lambda a, b, bin_in=0: (1 - a) & b
    },
    "Full Adder": {
        "S0": "Cin", "S1": 0, "S2": 1, "S3": 0, "M": 1,
        "sum_func": lambda a, b, cin: a ^ b ^ cin,
        "carry_func": lambda a, b, cin: (a & b) | (b & cin) | (a & cin)
    },
    "Full Subtractor": {
        "S0": "Bin", "S1": 1, "S2": 1, "S3": 0, "M": 1,
        "diff_func": lambda a, b, bin_in: a ^ b ^ bin_in,
        "borrow_func": lambda a, b, bin_in: ((1 - a) & b) | ((1 - a) & bin_in) | (b & bin_in)
    },
    "Increment A": {
        "B": 0, "S0": 1, "S1": 0, "S2": 1, "S3": 0, "M": 1,
        "sum_func": lambda a, b=0, cin=1: a ^ 1,
        "carry_func": lambda a, b=0, cin=1: a
    },
    "Decrement A": {
        "B": 0, "S0": 1, "S1": 1, "S2": 1, "S3": 0, "M": 1,
        "diff_func": lambda a, b=0, bin_in=1: a ^ 1,
        "borrow_func": lambda a, b=0, bin_in=1: 1 - a
    },
    "Set": {"B": 0, "S0": 0, "S1": 0, "S2": 1, "S3": 1, "M": 1, "func": lambda a: 1},
    "Reset": {"B": 0, "S0": 0, "S1": 1, "S2": 1, "S3": 1, "M": 1, "func": lambda a: 0},
    "Transfer A": {"B": 0, "S0": 0, "S1": 0, "S2": 1, "S3": 0, "M": 1, "func": lambda a: a},
    "Complement A": {"B": 0, "S0": 0, "S1": 1, "S2": 1, "S3": 0, "M": 1, "func": lambda a: 1 - a},
}

ALL_ALU_OPERATIONS = {**ALU_LOGIC_OPERATIONS, **ALU_ARITHMETIC_OPERATIONS}


def build_one_bit_alu_ncv() -> QuantumCircuit:
    """Constructs the 7x7 1-Bit ALU using NCV gate library (Fig. 7).

    Inputs (7 Qubits):
      - Qubit 0: A (Data input A)
      - Qubit 1: B (Data input B)
      - Qubit 2: S0 or Cin (Carry in / Select S0)
      - Qubit 3: S1 (Select line S1)
      - Qubit 4: M (Mode select: 0 = Logic, 1 = Arithmetic)
      - Qubit 5: S2 (Select line S2)
      - Qubit 6: S3 (Select line S3)

    Outputs (7 Qubits):
      - Qubit 0: Result (ALU computation result)
      - Qubit 1: Carry Out (Carry-out / Borrow-out)
      - Qubit 2: G1 (Garbage 1)
      - Qubit 3: G3 (Garbage 3)
      - Qubit 4: G2 (Garbage 2)
      - Qubit 5: S2 (Transferred select line S2)
      - Qubit 6: S3 (Transferred select line S3)

    Metrics:
      - Quantum Cost (QC) = 26
      - Delay = 20
      - Constant Inputs = 0
      - Garbage Outputs = 3
    """
    qc = QuantumCircuit(7, name="1Bit_QALU_NCV")

    # 1. 5x5 FALFG NCV Gate on qubits (0, 1, 2, 3, 4)
    qc.compose(build_falfg_ncv(), qubits=[0, 1, 2, 3, 4], inplace=True)

    # 2. FRG1: controlled by S2 (5), acts on P (0) and Q (1)
    add_fredkin_ncv(qc, control=5, target1=0, target2=1)

    # 3. FRG2: controlled by S2 (5), acts on R (2) and T (4)
    add_fredkin_ncv(qc, control=5, target1=2, target2=4)

    # 4. FRG3: controlled by S3 (6), acts on wire 0 (from FRG1) and wire 2 (from FRG2)
    add_fredkin_ncv(qc, control=6, target1=0, target2=2)

    return qc


def build_one_bit_alu_clifford_t() -> QuantumCircuit:
    """Constructs the fault-tolerant Clifford+T 1-Bit ALU (Fig. 8).

    Metrics:
      - T-count = 22
      - T-depth = 9
      - Quantum Cost = 26
      - Delay = 20
      - Total functions = 28
    """
    qc = QuantumCircuit(7, name="1Bit_QALU_Clifford_T")

    # 1. 5x5 FALFG Clifford+T Gate on qubits (0, 1, 2, 3, 4)
    qc.compose(build_falfg_clifford_t(), qubits=[0, 1, 2, 3, 4], inplace=True)

    # 2. FRG1: controlled by S2 (5), acts on P (0) and Q (1)
    add_fredkin_clifford_t(qc, control=5, target1=0, target2=1)

    # 3. FRG2: controlled by S2 (5), acts on R (2) and T (4)
    add_fredkin_clifford_t(qc, control=5, target1=2, target2=4)

    # 4. FRG3: controlled by S3 (6), acts on wire 0 (from FRG1) and wire 2 (from FRG2)
    add_fredkin_clifford_t(qc, control=6, target1=0, target2=2)

    return qc
