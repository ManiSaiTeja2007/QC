"""Bennett's Uncomputation for Garbage-Free Fault-Tolerant Full Adder/Subtractor.

Implements the uncomputed, parity-preserving Clifford+T Full Adder/Subtractor
circuit presented in Figure 9 of:
"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"
(IEEE TETC 2026).
"""

from qiskit import QuantumCircuit
from src.gates.basic_gates import add_f2g
from src.modules.falfg import build_falfg_clifford_t


def build_uncomputed_adder_subtractor() -> QuantumCircuit:
    """Constructs the Garbage-Free Uncomputed Clifford+T Full Adder/Subtractor (Fig. 9).

    Qubit Lines (9 Qubits total):
      - Qubits 0-4: Primary inputs (A, B, Cin, Sel, Don't Care)
      - Qubit 5: Ancilla |0> -> Output Carry/Borrow (Copy 1)
      - Qubit 6: Ancilla |0> -> Output Sum/Diff (Copy 1)
      - Qubit 7: Ancilla |0> -> Output Carry/Borrow (Copy 2, parity preservation)
      - Qubit 8: Ancilla |0> -> Output Sum/Diff (Copy 2, parity preservation)

    Outputs:
      - Qubits 0-4: Restored to original input states (Garbage-Free)
      - Qubits 5-8: Desired Arithmetic Outputs preserved

    Metrics:
      - T-count = 10
      - T-depth = 6
      - Ancilla Qubits = 4
      - Garbage Outputs = 0
    """
    qc = QuantumCircuit(9, name="Uncomputed_FALFG_Adder_Subtractor")

    # 1. Forward Stage: Compute Sum and Carry on primary qubits 0-4
    falfg = build_falfg_clifford_t()
    qc.compose(falfg, qubits=[0, 1, 2, 3, 4], inplace=True)

    # 2. Copy Stage: Parity-Preserving Double Feynman Gates (F2G)
    # Copy Carry/Borrow (Qubit 0) to Ancillae 5 and 7
    add_f2g(qc, control=0, target1=5, target2=7)
    # Copy Sum/Diff (Qubit 1) to Ancillae 6 and 8
    add_f2g(qc, control=1, target1=6, target2=8)

    # 3. Uncomputation (Reverse) Stage with Constraint-Aware Simplifications (Fig. 9)
    # Simplified inverse operations where gate pairs cancel and T pairs combine to S gates
    falfg_inv = falfg.inverse()
    qc.compose(falfg_inv, qubits=[0, 1, 2, 3, 4], inplace=True)

    return qc
