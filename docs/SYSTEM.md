# Architecture & Master State (`docs/SYSTEM.md`)

> **Bootstrap / Read This First:** This is the master architectural truth document for the **Quantum VLSI Electronic Design Automation (Q-EDA)** platform.
> Any autonomous agent or junior developer starting work on this repository must read this document first before inspecting code or executing modifications.

---

## 1. System Vision & Objective

The repository at `/home/mani/WorkSpace/VLSI/QC` is a full-stack Quantum Electronic Design Automation (Q-EDA) platform. It reproduces and substantially extends the seminal work:
> **Reference Paper:** S. Moghimi, M. R. Reshadinezhad, and A. Rubio, *"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"*, **IEEE Transactions on Emerging and Selected Topics in Computing**, vol. 14, no. 2, pp. 718–733, 2026. DOI: `10.1109/TETC.2026.3696481`.

The system bridges theoretical reversible logic, fault-tolerant Clifford+T synthesis, exact algebraic simulation, and physical hardware deployment on superconducting quantum processors.

---

## 2. High-Level Subsystems & Architecture

```
                                  +-------------------------------------------------------------+
                                  |                 Frontend (React + Vite + TS)                |
                                  |  - LiveSimulationWorkspace (3D WebGL Bloch, QPU Heavy-Hex)  |
                                  |  - BuilderWorkspace (Interactive Circuit Synthesis)         |
                                  |  - VerilogStudio (Icarus Verilog HDL Co-Simulation)         |
                                  |  - SingleGateLab, QML Lab, CircuitHub                       |
                                  +------------------------------+------------------------------+
                                                                 | REST / SSE (Port 8000)
                                                                 v
                                  +-------------------------------------------------------------+
                                  |                 Backend (FastAPI + Python 3.13)             |
                                  +-------------------------------------------------------------+
                                     |             |              |             |            |
                                     v             v              v             v            v
                               +-----------+ +-----------+ +------------+ +-----------+ +-----------+
                               | Circuit   | | Synthesis | | Decision   | | Noise &   | | Hardware  |
                               | Core      | | Engine    | | Diagram    | | Mitig.    | | Router    |
                               | (FALFG,   | | (ESOP     | | Engine     | | (Parity   | | (SABRE,   |
                               | 1-bit ALU)| | Reed-     | | (QMDD      | | Subspace, | | Heavy-    |
                               |           | | Muller,   | | Exact D[w] | | ZNE,      | | Hex,      |
                               |           | | Pebble)   | | Ring)      | | Lindblad) | | 3-CNOT)   |
                               +-----------+ +-----------+ +------------+ +-----------+ +-----------+
```

### 2.1 The Reversible ALU Core (`backend/app/circuits/`)
* **5×5 FALFG Core:** 5-qubit universal reversible Full Adder / Subtractor gate ($A,B,C,D,E \to P,Q,R,S,T$) with Quantum Cost = 11, $T$-count = 7, $T$-depth = 3. Bitwise parity is preserved: $\bigoplus \text{Out} \equiv \bigoplus \text{In}$.
* **7×7 1-Bit ALU:** Cascades FALFG with 3 Fredkin (CSWAP) gates to synthesize 28 operations (12 logic, 16 arithmetic).
* **Bennett Uncomputation:** Compute $\to$ Copy (Transversal F2G) $\to$ Uncompute ($U^\dagger$), guaranteeing 0 garbage outputs ($GO=0$).
* **Library Support:** Dual decomposition modes—NCV (elementary Toffoli-family gates) and strict fault-tolerant Clifford+T ($\{H, S, T, T^\dagger, \text{CX}\}$).

### 2.2 Reversible Logic Compiler & Pebble Uncomputation (`backend/app/compiler/`)
* **ESOP Ingestion:** Translates combinational Verilog HDL and Boolean functions into Exclusive-Sum-of-Products form over $\mathbb{F}_2$ via the Fast Reed-Muller Transform in $O(n \cdot 2^n)$ time.
* **DAG Pebble Game:** Formalizes scratchpad ancilla uncomputation as a pebbling game. Offers 3 operational strategies:
  * `MIN_ANCILLA`: In-place sequential reuse.
  * `MIN_T_DEPTH`: Parallel batched uncomputation (cuts $T$-depth by 32.9% on multipliers).
  * `PARETO_BALANCED`: Knee of the trade-off curve.

### 2.3 Closed-Loop Parity Error Mitigation (`backend/app/simulation/`)
* **Parity Subspace Projection:** Reversible circuits evolve within the $+1$ eigenspace of $\Pi_{\text{valid}} = \frac{1}{2}(I + (-1)^{p_0} Z^{\otimes n})$. Physical transmon bit-flips project the state outside $\Pi_{\text{valid}}$ and are discarded post-selection.
* **Richardson Zero-Noise Extrapolation (ZNE):** Two-point noise scaling with factor $c=2.0$ eliminates remaining coherent error, reaching $F=1.0000$ in the zero-noise limit.
* **Open-System Lindblad Dynamics:** Models depolarizing channels, $T_1$ relaxation ($110\,\mu\text{s}$), and $T_2$ dephasing ($85\,\mu\text{s}$).

### 2.4 Exact Cyclotomic $\mathbb{D}[\omega]$ QMDD Engine (`backend/app/simulation/qmdd/`)
* **Memory Wall Resolution:** Replaces dense $O(2^n)$ statevectors with Quantum Multiple-Valued Decision Diagrams.
* **Bit-Exact Arithmetic:** Edge weights are elements of the algebraic cyclotomic ring $\mathbb{D}[\omega] = \mathbb{Z}[\omega, 1/\sqrt{2}]$ where $\omega = e^{i\pi/4}$. Eliminates all floating-point roundoff errors ($\omega^4 = -1$, $\omega + \omega^3 = \sqrt{2}i$).
* **Scalability:** Successfully simulates 64-bit ALUs (448 qubits) in milliseconds using only 1,525 nodes ($>10^{131}\times$ memory compression).

### 2.5 Hardware-Topology-Aware SABRE Router (`backend/app/routing/`)
* **Coupling Graphs:** Models IBM Heavy-Hex QPUs (Falcon 27Q, Eagle 127Q, Heron 133Q) with degree $\le 3$.
* **Noise-Tuned SABRE:** Bidirectional lookahead heuristic guided by Dijkstra log-infidelity weights $W[u,v] = \sum -\ln(1 - p_{2q})$.
* **Parity Preservation Invariant:** Every inserted routing SWAP is strictly decomposed into 3 native CNOTs ($\text{CX}(u,v)\text{CX}(v,u)\text{CX}(u,v)$), guaranteeing that physical routing never breaches the $\Pi_{\text{valid}}$ code space.

---

## 3. Directory Layout & Owning Modules

| Path | Responsibility |
|---|---|
| `backend/app/api/` | FastAPI REST endpoints (`/api/alu`, `/api/circuits`, `/api/compiler`, `/api/verilog`) |
| `backend/app/circuits/` | Core ALU definitions (FALFG, 1-bit ALU, 4-bit ALU, Fredkin, Bennett) |
| `backend/app/compiler/` | ESOP decomposition, pebble scheduling, Reed-Muller transforms |
| `backend/app/core/` | Storage, catalog indexing, validation guards |
| `backend/app/routing/` | SABRE routing heuristic, IBM heavy-hex coupling topologies |
| `backend/app/simulation/` | Density matrix noise simulator, parity projector, ZNE, QMDD engine |
| `frontend/src/components/` | React UI: `alu/`, `builder/`, `verilog/`, `bloch/`, `heavyhex/`, `workspaces/` |
| `circuits/` | Persistent JSON circuit library and `index.json` catalog |
| `pdf/` | Academic publication LaTeX source (`report.tex`) and compiled PDF (`report.pdf`) |
| `results/figures/` | High-resolution publication figures (`fig11` through `fig16`) |
| `tests/` | Pytest regression suite (163 unit and integration tests) |

---

## 4. Key Invariants & Non-Negotiables

1. **Parity Preservation Invariant:** All reversible ALU designs must preserve bitwise XOR parity ($P_{\text{in}} \equiv P_{\text{out}}$). Any new gates or transformations must prove parity invariance.
2. **Garbage Output Zero Invariant:** Bennett uncomputation must reset all auxiliary scratchpads back to $|0\rangle$. Never leak entangled garbage.
3. **Strict Clifford+T Synthesis:** Fault-tolerant modes must only use $\{H, S, T, T^\dagger, \text{CX}\}$. No arbitrary continuous rotation gates are permitted without explicit decomposition.
4. **Three-CNOT SWAP Decomposition:** Every routing SWAP inserted for heavy-hex hardware execution must expand to 3 CNOTs to maintain parity preservation.
5. **Static Typing & Compilation:** All Python edits must satisfy `pyrefly check .` and `python3 -m py_compile <file>`. Frontend edits must pass `bun run build`.
