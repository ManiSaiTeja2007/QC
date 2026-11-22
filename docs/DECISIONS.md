# Architectural Decision Records (`docs/DECISIONS.md`)

This ledger documents the core architectural decisions, alternatives evaluated, trade-offs, and design rationale for the Q-EDA platform.

---

### [ADR-01] Strict Clifford+T Basis Decomposition over Continuous Angle Rotations
* **Status:** ACCEPTED
* **Context:** Quantum algorithms often rely on continuous single-qubit rotations $R_x(\theta), R_y(\theta), R_z(\theta)$ or non-transversal multi-qubit gates (Toffoli, Fredkin).
* **Decision:** Enforce strict decomposition into the universal fault-tolerant Clifford+T set $\{H, S, T, T^\dagger, \text{CX}\}$.
* **Rationale:** By the Eastin-Knill Theorem, no quantum error-correcting code can implement universal gates transversally. In surface codes, Clifford gates are transversal, while $T$ gates require magic-state distillation. Synthesizing directly to Clifford+T exposes the exact physical distillation bottleneck ($T$-count and $T$-depth) required for real fault-tolerant execution.
* **Alternative Considered:** Retaining native NCV (NOT, CNOT, Controlled-$V$) gates. Rejected as unviable for physical surface-code implementations without further decomposition.

---

### [ADR-02] 3-CNOT Parity-Preserving SWAP Decomposition in Hardware Routing
* **Status:** ACCEPTED
* **Context:** Physical IBM Heavy-Hex QPUs enforce nearest-neighbor connectivity. Routing logical gates requires inserting SWAP gates between non-adjacent physical qubits.
* **Decision:** Decompose every physical SWAP strictly into three alternating CNOT gates:
  $$\text{SWAP}(u, v) \equiv \text{CX}(u, v) \cdot \text{CX}(v, u) \cdot \text{CX}(u, v)$$
* **Rationale:** Each individual CNOT gate preserves bitwise parity ($a \oplus (a \oplus b) = b$). Consequently, the 3-CNOT SWAP decomposition preserves global XOR parity ($P_{\text{in}} = P_{\text{out}}$). This guarantees that routing does not violate or invalidate the online parity-syndrome error mitigation projector $\Pi_{\text{valid}}$.
* **Alternative Considered:** Using native exchange pulses or 2-parametric fermionic SWAP gates. Rejected because they destroy bitwise parity invariance.

---

### [ADR-03] Algebraic Cyclotomic Ring $\mathbb{D}[\omega]$ for Quantum Decision Diagrams
* **Status:** ACCEPTED
* **Context:** Simulating multi-bit quantum ALUs (e.g., 64-bit ALU = 448 qubits) exceeds classical statevector RAM limits ($2^{448}$ amplitudes). Furthermore, IEEE-754 64-bit complex floating-point numbers accumulate numerical drift over hundreds of gates.
* **Decision:** Represent edge weights in the algebraic cyclotomic field $\mathbb{D}[\omega] = \mathbb{Z}[\omega, 1/\sqrt{2}]$, where $\omega = e^{i\pi/4}$.
* **Rationale:** Every Clifford+T unitary matrix entry and state amplitude is expressible exactly as:
  $$z = \frac{a + b\omega + c\omega^2 + d\omega^3}{2^{k/2}}, \quad a,b,c,d,k \in \mathbb{Z}$$
  Algebraic reduction ($\omega^4 = -1$, $\omega + \omega^3 = \sqrt{2}i$) enables bit-exact node sharing and canonical reduction without transcendental floating-point approximations.
* **Alternative Considered:** Standard complex double-precision floats (`std::complex<double>`). Rejected due to roundoff errors causing cache-lookup misses and failure to identify equivalent sub-trees.

---

### [ADR-04] Formulation of Bennett Uncomputation as a DAG Pebble Game
* **Status:** ACCEPTED
* **Context:** Naive uncomputation either holds all intermediate logic terms in memory (blowing up ancilla count) or eagerly uncomputes after every gate (serializing operations and increasing $T$-depth).
* **Decision:** Model the uncomputation schedule as an asymmetric pebble game over the Directed Acyclic Graph (DAG) of ESOP terms.
* **Rationale:** Allows the compiler to provide user-selectable Pareto optimization modes: `MIN_ANCILLA` (in-place uncomputation), `MIN_T_DEPTH` (parallel batches), and `PARETO_BALANCED` (compromise). On the 2-bit multiplier benchmark, this cuts parallel $T$-depth by 32.9% with 0 garbage outputs.
* **Alternative Considered:** Fixed recursive Bennett pebbling (always power-of-2). Rejected because arbitrary Boolean logic structures do not have uniform tree branching.

---

### [ADR-05] Permanently Locked Dark Mode & 3-Column Workspace UX
* **Status:** ACCEPTED
* **Context:** The original workspace suffered from visual crowding: unaligned Bloch spheres, noisy 3D Q-spheres, light/dark mode inconsistencies, and overlapping gate palettes.
* **Decision:** Enforce locked professional dark mode and refactor the interface into a 3-column proportional grid: Circuit (1.65fr) : State (0.75fr) : QPU / Deep Dive Inspector (1.1fr). Wire-aligned 3D Bloch spheres are projected 1:1 on the circuit egress rail.
* **Rationale:** Maximizes cognitive bandwidth for researchers analyzing deep multi-wire quantum circuits while preserving real-time physical QPU inspection.
