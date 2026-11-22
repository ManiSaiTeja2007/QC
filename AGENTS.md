# AGENTS.md — Onboarding & Operational Guide for Autonomous Agents & Junior Engineers

> **To Any Future AI Agent or Junior Developer:**
> Welcome to the Quantum Electronic Design Automation (Q-EDA) platform.
> **DO NOT roam the codebase aimlessly.** Everything you need to know about the system architecture, design decisions, past traps, and how to verify your work is documented right here and in the `docs/` truth ledgers.

---

## 1. What Is This Codebase?

This repository (`/home/mani/WorkSpace/VLSI/QC`) is an end-to-end Quantum Electronic Design Automation (Q-EDA) framework developed by the Quantum VLSI Research Group. It reproduces and significantly extends the landmark paper:
> **Moghimi et al.**, *"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"*, **IEEE Transactions on Emerging and Selected Topics in Computing**, vol. 14, no. 2, pp. 718–733, 2026. DOI: `10.1109/TETC.2026.3696481`.

It provides a full pipeline from high-level Verilog/Boolean input down to routed physical execution on IBM Heavy-Hex superconducting quantum processors.

---

## 2. Master Map: Where Things Live

```
/home/mani/WorkSpace/VLSI/QC/
├── docs/                   <- Canonical Truth Ledgers (READ FIRST)
│   ├── SYSTEM.md           <- Master system architecture, component topology, invariants
│   ├── TASKS.md            <- Living execution ledger & milestone checklists
│   ├── DECISIONS.md        <- Architectural Decision Records (ADRs) & trade-offs
│   ├── MEMORY.md           <- Negative knowledge, anti-patterns, and documented traps
│   ├── BENCHMARKS.md       <- Empirical execution metrics & hardware telemetry
│   └── OPEN_QUESTIONS.md   <- Open research horizons & active assumptions
├── SYMBOLS.md              <- Public API, exported schemas, and function catalog
├── CODE_OF_CONDUCT.md      <- 13 non-negotiable engineering invariants
├── backend/                <- FastAPI + Python 3.13 backend
│   ├── app/circuits/       <- FALFG 5x5, 1-bit ALU, 4-bit ALU, Fredkin, Bennett definitions
│   ├── app/compiler/       <- ESOP decomposer, Fast Reed-Muller, DAG Pebble Game scheduler
│   ├── app/simulation/     <- Density matrix noise simulator, parity projector, ZNE
│   │   └── qmdd/           <- Exact cyclotomic D[w] Quantum Decision Diagram engine
│   ├── app/routing/        <- Noise-tuned bidirectional SABRE router, Heavy-Hex graphs
│   └── app/api/            <- REST API endpoints (/api/alu, /api/circuits, /api/compiler)
├── frontend/               <- React + Vite + TypeScript frontend
│   └── src/components/     <- Workspaces: LiveSimulation, Builder, VerilogStudio, HeavyHex
├── circuits/               <- Persistent JSON circuit storage & index.json catalog
├── experiments/            <- Benchmark scripts generating publication figures
├── pdf/                    <- Academic publication LaTeX source (report.tex) & report.pdf
├── results/figures/        <- Generated high-res publication figures (fig11 - fig16)
└── tests/                  <- Pytest test suite (163 tests, 100% pass)
```

---

## 3. The 4 Major Innovations Beyond the Base Paper

When working on or extending this platform, keep these four core capabilities in mind:

1. **Automated ESOP Synthesis & Pebble Uncomputation (`backend/app/compiler/`):**
   * Translates arbitrary Boolean/Verilog into algebraic polynomials over $\mathbb{F}_2$.
   * Optimizes Bennett uncomputation via a DAG Pebble Game, offering `MIN_ANCILLA`, `PARETO_BALANCED`, and `MIN_T_DEPTH` modes (slashes $T$-depth by 32.9% with 0 garbage).
2. **Closed-Loop Parity Error Mitigation (`backend/app/simulation/`):**
   * Exploits $P_{\text{in}} = P_{\text{out}}$ invariance. Single bit-flip errors fall outside the projector $\Pi_{\text{valid}} = \frac{1}{2}(I + (-1)^{p_0} Z^{\otimes n})$ and are filtered out.
   * Combined with Richardson Zero-Noise Extrapolation (ZNE), recovers state fidelity from $0.8663 \to 1.0000$ under transmon noise.
3. **Exact Cyclotomic $\mathbb{D}[\omega]$ QMDD Engine (`backend/app/simulation/qmdd/`):**
   * Solves the $O(2^n)$ memory wall of dense statevector simulators.
   * Uses exact algebraic ring arithmetic $\mathbb{D}[\omega] = \mathbb{Z}[\omega, 1/\sqrt{2}]$ with zero floating-point roundoff.
   * Simulates up to 64-bit ALUs (448 qubits) in milliseconds using only 1,525 graph nodes ($>10^{131}\times$ memory compression).
4. **Hardware-Topology-Aware SABRE Routing (`backend/app/routing/`):**
   * Routes circuits onto IBM Heavy-Hex QPUs (Falcon 27Q, Eagle 127Q, Heron 133Q).
   * Evaluates Dijkstra log-infidelity weights ($W = \sum -\ln(1 - p_{2q})$) to route along low-noise paths.
   * **Crucial Invariant:** Strictly decomposes every SWAP into 3 native CNOTs to guarantee bitwise parity preservation throughout physical routing.

---

## 4. Verification Workflow (How to Test & Verify)

Whenever you make any change to the codebase, execute this exact verification sequence:

### Step 1: Static Type Checking
```bash
cd /home/mani/WorkSpace/VLSI/QC
pyrefly check .
```
*Expectation: 0 type errors.*

### Step 2: Target File Syntax Compilation
```bash
python3 -m py_compile <modified_file.py>
```
*Expectation: Exit code 0.*

### Step 3: Run the Regression Test Suite
```bash
pytest -k "not e2e" tests/
```
*Expectation: 163/163 tests passing.*

### Step 4: Frontend Validation (If UI was touched)
```bash
cd /home/mani/WorkSpace/VLSI/QC/frontend
bun run build
```
*Expectation: Clean build with 0 TypeScript errors.*

### Step 5: PDF Paper Recompilation (If report was touched)
```bash
cd /home/mani/WorkSpace/VLSI/QC/pdf
pdflatex -interaction=nonstopmode report.tex && pdflatex -interaction=nonstopmode report.tex
```
*Expectation: 5 pages, exit code 0, all figures centered.*

---

## 5. Non-Negotiable Rules for Any AI Agent

1. **Check `docs/MEMORY.md` First:** Before debugging any unexpected simulation or routing issue, check `docs/MEMORY.md`. Common traps (like Qiskit Aer OOM at 28 qubits, floating-point hash collisions in decision diagrams, or SWAP parity violations) are already documented there.
2. **Never Break Parity:** Any new gate decomposition or circuit transformation MUST preserve the XOR parity invariant ($P_{\text{in}} \equiv P_{\text{out}}$).
3. **Never Suppress Type Errors:** Never use `# type: ignore` or blanket `Any`. Solve the type signature at the root cause.
4. **Never Commit or Push Without User Approval:** Always wait for explicit user confirmation before running `git commit` or `git push`.
5. **Update Canonical Truth:** If your change alters architecture, APIs, or performance metrics, update `docs/SYSTEM.md`, `SYMBOLS.md`, `docs/TASKS.md`, or `docs/BENCHMARKS.md` before finishing your turn.
