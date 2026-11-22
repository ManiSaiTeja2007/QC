# Open Questions, Assumptions & Research Horizons (`docs/OPEN_QUESTIONS.md`)

> **Purpose:** Captures active research horizons, theoretical assumptions, unmeasured edge cases, and future directions for the Q-EDA framework.

---

### [OQ-01] Transversal Parity vs. High-Distance Color/Surface Code Integration
* **Status:** OPEN
* **Context:** Current error mitigation relies on post-selection subspace projection $\Pi_{\text{valid}} = \frac{1}{2}(I + (-1)^{p_0} Z^{\otimes n})$ and Richardson ZNE on physical qubits.
* **Question:** How does bitwise parity preservation map onto logical distance-$d$ Surface Code patches? Specifically, can parity checks be extracted via stabilizer measurements without consuming magic states?
* **Assumptions:** Transmon bit-flip errors are dominant and uncorrelated across adjacent data qubits.

---

### [OQ-02] Dynamic Lookahead Window Sizing in Bidirectional SABRE Routing
* **Status:** OPEN
* **Context:** The current SABRE router uses a fixed lookahead window $E$ of size 20 gates.
* **Question:** Would a dynamically adaptive lookahead window scaled by the local heavy-hex graph diameter reduce SWAP thrashing on high-qubit QPUs (e.g., IBM Condor 1121Q)?
* **Assumptions:** Dijkstra log-infidelity weights remain quasi-static during single circuit execution.

---

### [OQ-03] Polynomial Synthesis for Arbitrary Sequential Logic
* **Status:** OPEN
* **Context:** The ESOP compiler currently ingests purely combinational Verilog HDL (assign statements, bitwise gates).
* **Question:** How can sequential circuits with flip-flops and clock domains be mapped to reversible unitary states without introducing non-unitary measurement cycles?
* **Assumptions:** Circuit executes strictly within a single reversible clock cycle where all registers are initialized and finalized deterministically.
