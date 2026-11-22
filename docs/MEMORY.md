# Negative Knowledge, Traps & Learned Instincts (`docs/MEMORY.md`)

> **Purpose:** This file documents anti-patterns, non-obvious traps, hardware limits, and subtle coupling mechanisms encountered during development.
> **Mandatory Rule:** Consult this ledger before making architectural changes or debugging unexpected failures.

---

### [TRAP-261121] Qiskit Aer Statevector Out-Of-Memory (OOM) on Multi-Bit Circuits
- **Context:** Dense statevector simulation in `backend/app/simulation/`
- **Failure Symptom:** Silent process kill or `MemoryError` when simulating circuits with $\ge 28$ qubits (e.g., 4-bit ALU with 28 qubits requires $>4\,\text{GB}$ RAM; 8-bit requires millions of GB).
- **Root Cause:** Dense statevectors scale as $O(2^n)$ in memory.
- **Preventive Invariant:** For circuits exceeding 9 qubits in automated batch benchmarks, use empirical shot-based sampling (`simulate_parity_mitigated_shots`) or route simulation through the native cyclotomic QMDD engine (`simulate_qmdd`), which scales linearly for reversible ALUs.

---

### [TRAP-261120] Floating-Point Drift in Decision Diagram Node Canonicalization
- **Context:** Quantum Decision Diagram (QMDD) complex edge-weight equality checks.
- **Failure Symptom:** Exponential explosion in decision diagram node count; failure to identify identical sub-trees despite mathematically equivalent states.
- **Root Cause:** IEEE-754 floating-point inaccuracies ($\cos(\pi/4) \approx 0.7071067811865476$) lead to non-identical hash keys in the unique table for identical unitary sub-matrices.
- **Preventive Invariant:** Use exact algebraic representation $\mathbb{D}[\omega] = \mathbb{Z}[\omega, 1/\sqrt{2}]$. Never use floating-point comparisons for node table caching in Clifford+T circuits.

---

### [TRAP-261119] Non-Parity-Preserving Routing SWAPs Invalidating Mitigation
- **Context:** Hardware routing on IBM Heavy-Hex coupling graphs.
- **Failure Symptom:** Parity error mitigation filter (`simulate_parity_mitigated_density_matrix`) drops 100% of physical shots as "invalid errors" when simulating routed circuits on IBM Falcon.
- **Root Cause:** Naive SWAP decomposition or asymmetric compiler SWAPs flip bit parity ($P_{\text{in}} \neq P_{\text{out}}$), causing the projector $\Pi_{\text{valid}}$ to reject the routed state as an uncorrectable fault.
- **Preventive Invariant:** Always decompose physical routing SWAPs into exactly 3 native CNOTs: $\text{CX}(u,v)\text{CX}(v,u)\text{CX}(u,v)$. This maintains global bitwise parity invariance across all routing layers.

---

### [TRAP-261118] Two-Column LaTeX Floating Figure Clipping & Alignment
- **Context:** IEEE two-column article formatting (`pdf/report.tex`).
- **Failure Symptom:** Figures placed using `\begin{figure}[h]` are squeezed into a single column (half width) and appear left-aligned with truncated captions and overlapping legends.
- **Root Cause:** In standard two-column LaTeX, wide composite figures must use the starred `\begin{figure*}[!t]` environment with explicit `\centering` to span both columns cleanly.
- **Preventive Invariant:** Always format full-width visual telemetry with `\begin{figure*}[!t] \centering \includegraphics[width=0.68\textwidth]{...} \end{figure*}`.

---

### [TRAP-261117] SVG Coordinate Offset Drift in Wire-Egress Three.js Rails
- **Context:** `WireEgressBlochRail.tsx` alignment with `CircuitPanel.tsx`.
- **Failure Symptom:** 3D Bloch sphere centers drift downward relative to the circuit wires by $+32\,\text{px}$ on qubit 4 through 6.
- **Root Cause:** Compounding double-offset: a container `div` applied an initial padding of `startY` while the inner Three.js orthographic camera also applied `startY` projection offset.
- **Preventive Invariant:** When projecting 3D WebGL scenes 1:1 against 2D SVG canvas wires, pin the Three.js viewport to the exact SVG coordinate origin ($y=0$) and compute wire centers strictly via $y_q = \text{startY} + q \cdot \text{rowHeight} + \text{rowHeight} / 2$.
