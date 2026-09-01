# ⚛️ Quantum ALU 3D Studio 2.0: Fault-Tolerant Parity-Preserving Clifford+T ALU

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![Qiskit 2.x](https://img.shields.io/badge/Qiskit-2.x-purple.svg)](https://qiskit.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-v0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Vite + React](https://img.shields.io/badge/Vite%2BReact-TypeScript-646CFF.svg)](https://vitejs.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20WebGL-black.svg)](https://threejs.org/)
[![Tests](https://img.shields.io/badge/pytest-100%25%20passed-brightgreen.svg)]()
[![Selenium E2E](https://img.shields.io/badge/Selenium%20E2E-5%2F5%20OK-success.svg)]()

> **IEEE Transactions on Emerging Topics in Computing (TETC 2026) Paper Replication & Interactive 3D WebGL Workbench:**  
> **"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"**  
> *S. S. Tehrani, H. Aghababa, M. H. Majidi, and B. Safaei (2026)*

---

## 🎯 Executive Overview

This project provides a complete mathematical verification suite, automated replication testbench, single-strip circuit generator, and an interactive **3D WebGL Quantum Studio Workbench** for fault-tolerant reversible quantum arithmetic logic units (ALUs).

Unlike general-purpose drag-and-drop circuit editors, **Quantum Studio 2.0** is purpose-built as a **Quantum Microarchitecture Workbench**, delivering dual-level execution stepping (Logical Operations vs Primitive Gates), fault-tolerant Clifford+T decomposition analysis ($T$-count and $T$-depth), IBM 3D Q-Sphere statevector mapping, and explicit online parity preservation error detection proofs.

---

## 🔬 Architectural Comparison: Quantum Studio 2.0 vs IBM Quantum Composer vs Quirk

| Feature / Capability | ⚛️ **Quantum Studio 2.0** *(Our Work)* | 🌐 **Quirk** *(algassert.com)* | ☁️ **IBM Quantum Composer** |
| :--- | :--- | :--- | :--- |
| **Primary Design Focus** | **Fault-Tolerant Reversible ALU Microarchitecture & Verification** | Lightweight exploratory circuit sandbox | Drag-and-drop OpenQASM circuit editor for IBM Cloud QPU execution |
| **Reversible ALU Specialization** | **Full 28-Operation ALU, 5x5 FALFG Function Generator, Bennett Uncomputation** | None (generic gate placement) | None (generic gate placement) |
| **Execution Stepping** | **Dual-Level Stepping** *(Logical Ops vs Primitive Gate Steps)* | Single column-by-column | Whole-circuit job submission |
| **Single-Gate Physics Laboratory** | **Dedicated Side-by-Side Before ↔ After 3D Bloch & State Comparison** | Hover tooltips only | Basic single-qubit inspect panel |
| **Fault-Tolerance Analysis** | **Automated Parity Preservation ($P_{\text{in}}=P_{\text{out}}$) & Clifford+T $T$-count / $T$-depth** | Manual inspection | Basic gate count |
| **3D Statevector Visualizer** | **IBM-Style 3D WebGL Q-Sphere** *(Hamming-weight latitude rings)* | 2D inline density circles | 2D Q-Sphere plot |
| **Mode State Isolation** | **Strict Discriminated Workspaces** *(Zero state leakage between Builder, Lab, and Live Sim)* | Single canvas | Single project canvas |
| **Automated Verification Suite** | **Exhaustive Truth Table Testbenches & Replicating Paper Figures 11 & 12** | None | None |

### 💡 Why Quantum Studio 2.0 is Unique:
1. **Dedicated Reversible ALU Workloads**: Provides built-in canonical circuit generators for FALFG (Arithmetic Logic Function Generator), 1-Bit Parity-Preserving ALU (28 operations), Bennett's 9-qubit garbage-free uncomputed adder, and 4-Bit scalable architectures.
2. **Dual-Level Stepping & Scrubber**: Allows stepping through high-level ALU logical operations (e.g. *Op 2: Full Adder*) as well as underlying primitive gate steps ($1 \to 75$).
3. **Independent Workspaces with 100% State Isolation**: Changing a qubit value or rotation angle in the Single Gate Lab **never resets or alters** your active Circuit Builder canvas or Live ALU simulation.

---

## 💻 Web Application Architecture & Studio Workspaces

Quantum Studio 2.0 consists of **3 Independent Dedicated Workspaces** managed by a top-level Discriminated Studio Mode Router (`src/types/mode.ts` & `App.tsx`):

```text
                                  QUANTUM STUDIO 2.0
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
   1. BUILDER WORKSPACE         2. SINGLE GATE LAB WORKSPACE   3. LIVE SIMULATION WORKSPACE
   (Drag-and-Place Canvas,      (Dual Before/After 3D Bloch,   (ALU Presets, Dual Scrubber,
    Arbitrary Target Wiring)     Gate Diagrams & Mappings)       3D Q-Sphere & Statevector)
            │                             │                             │
            └─────────────────────────────┼─────────────────────────────┘
                                          ▼
                               SHARED PRESENTATIONAL CORE
                        (BlochPanel, StatePanel, QSpherePanel)
```

### 1. 🎨 Interactive Circuit Builder Workspace (`BuilderWorkspace.tsx`)
- **Searchable Palette**: 28+ quantum gates categorized by type (`Basic`, `Phase & Clifford+T`, `Parametric Rotations`, `Controlled`, `Multi-Qubit / Reversible`, `Measurement`).
- **Arbitrary Target Wiring**: Connect control dots (`●`) and target XOR circles (`⊕`) across non-adjacent wires (e.g. Control $Q_0 \to$ Target $Q_2$ spanning $Q_1$).
- **Keyboard Shortcuts**: Select any placed gate and press `Delete` or `Backspace` to remove it.
- **Embedded Real-Time Simulation**: Toggling an input bit (`|0⟩` $\leftrightarrow$ `|1⟩`) or adding/deleting gates updates the embedded 3D Bloch spheres, Dirac Ket $|\psi\rangle$, and state summary **live in-place**.

### 2. 🔬 Single Gate Laboratory Workspace (`SingleGateWorkspace.tsx`)
- **Side-by-Side Before ↔ After Dual State Comparison**: Visualizes input state $|0\rangle$ (North Pole) transforming into output state $|+\rangle$ (Sky Blue Equatorial Vector).
- **Graphical SVG Circuit Schematics**: Displays an inline circuit diagram representation for the active gate (`GateSchematicDiagram`).
- **Mathematical State Mapping Badges**: Displays exact operational equations:
  - **CNOT (`CX`)**: `(A, B) ↦ (A, A ⊕ B)`
  - **Hadamard (`H`)**: `|0⟩ ↦ (|0⟩ + |1⟩)/√2  |  |1⟩ ↦ (|0⟩ - |1⟩)/√2`
  - **Toffoli (`CCX`)**: `(A, B, C) ↦ (A, B, C ⊕ AB)`
  - **Fredkin (`CSWAP`)**: `(A, B, C) ↦ A ? (A, C, B) : (A, B, C)`
- **Parametric Rotation Sliders**: Continuous slider for rotation angle $\theta \in [0, 2\pi]$ for `RX`, `RY`, `RZ`, `CRX`, etc.

### 3. ⚡ Live Simulation / ALU Laboratory Workspace (`LiveSimulationWorkspace.tsx`)
- **Preset Architectures**: 1-Bit ALU (28 Operations), FALFG Gate, Fredkin Gate, Bennett Uncomputed Adder/Subtractor.
- **Dual-Step Transport Scrubber**: Move through primitive gate steps ($1 \to 75$) or logical op blocks ($1 \to 3$).
- **IBM 3D WebGL Q-Sphere Visualizer**: 3D Three.js WebGL Q-Sphere mapping computational basis states onto Hamming-weight latitude rings with amplitude-scaled sphere node radii and phase-angle HSL colors.
- **Dirac Ket $|\psi\rangle$ & Basis Measurement**: Instantaneous statevector expansion and Z/X/Y-basis projective measurement probabilities.

---

## 📊 Paper Replication & Verification Suite

We verified all 6 core mathematical claims of the IEEE TETC 2026 paper:

| Verification Target | Paper Target | Experimental Replication Result | Status |
| :--- | :--- | :--- | :--- |
| **Table IV: 5x5 FALFG Gate** | 32 Truth Table States | **32 / 32 Matched** (Clifford+T & NCV) | `100% MATCH` |
| **Table V: FALFG Functions** | 24 Reversible Functions | **24 / 24 Verified** (Arithmetic + Logic) | `100% MATCH` |
| **Table VI: 1-Bit ALU Ops** | 28 ALU Operations | **28 / 28 Verified** ($M=0$ Logic, $M=1$ Arith) | `100% MATCH` |
| **Parity Preservation** | $P_{\text{in}} = P_{\text{out}}$ | **True** (Both FALFG and 1-Bit ALU) | `VERIFIED` |
| **Reversibility** | $U^\dagger U = I$ | **True** (Bijective state mapping) | `VERIFIED` |
| **Figure 9: Bennett Adder** | Zero Garbage Uncomputation | **9 Qubits, 0 Garbage Outputs** | `VERIFIED` |
| **Table IX: 4-Bit Scaling** | $QC=128, \text{Delay}=71, G=15, T=109$ | **Formula & Implementation match Table IX** | `100% MATCH` |

### Generated Publication Figures & Circuit Strips (`results/`):
- **Single Straight-Strip Circuit Schematics (`results/circuits/`)**: `fig4_falfg_ncv.png`, `fig5_falfg_clifford_t.png`, `fig7_1bit_alu_ncv.png`, `fig8_1bit_alu_clifford_t.png`, `fig9_uncomputed_adder_subtractor.png`, `fig10_4bit_alu.png` generated as single continuous horizontal strips (`fold=-1`).
- **Figure 11 Reproduction (`results/figures/fig11_reproduction_histograms.png`)**: Qiskit Aer simulation histograms over 256 shots across 16 representative input patterns.
- **Figure 12 Reproduction (`results/figures/fig12_reproduction_fidelity.png`)**: Quantum state fidelity $F = |\langle\Psi_{\text{ideal}}|\Psi_{\text{sim}}\rangle|^2 = 1.000$ across all 128 computational basis states.
- **Step Visualizations (`results/figures/visualizations/`)**: Gate-by-gate 3D Bloch trajectories and step probability heatmaps.

---

## 🛠️ Software Stack & Project Structure

```text
.
├── dev.sh                          # Development server launcher (FastAPI :8000 + Vite :5173)
├── verify_paper.sh                 # Master paper replication script
├── backend/                        # Modular FastAPI Python Backend
│   └── app/
│       ├── main.py                 # REST API endpoints (/api/simulate, /api/simulate-custom, /api/simulate-single-gate)
│       ├── gates/                  # Basic gates & Clifford+T library
│       ├── modules/                # FALFG, 1-Bit ALU, Bennett Adder, 4-Bit ALU
│       └── simulation/             # Verifier, Cost Metrics, Fidelity Simulator, Bloch Adapter
├── frontend/                       # Vite React TypeScript 3D WebGL Frontend
│   ├── src/
│   │   ├── components/             # Header, TransportBar, StatePanel, BlochPanel, QSpherePanel
│   │   │   ├── builder/            # BuilderWorkspace, CircuitCanvas, GatePalette, SingleGateWorkspace
│   │   │   └── workspaces/         # LiveSimulationWorkspace
│   │   ├── services/               # api.ts, gateRegistry.ts (28+ gate metadata & mappings)
│   │   └── types/                  # mode.ts, simulation.ts
│   └── package.json
├── experiments/                    # Replication & figure generation scripts
│   ├── run_all_verifications.py    # Master mathematical verification script
│   ├── plot_histograms_fidelity.py  # Replicates Figures 11 & 12
│   ├── generate_circuit_diagrams.py # Exports single straight-strip circuit PNGs
│   └── visualize_circuit_step_by_step.py # Step-by-step Bloch trajectory tracking
├── tests/                          # Automated PyTest & Selenium E2E test suites
│   ├── test_bloch_math.py          # Mandatory Bloch coordinate unit tests
│   └── test_e2e_selenium.py        # Automated Headless Chrome E2E state isolation tests
└── results/                        # Generated output reports, figures, and circuit strips
```

---

## 🚀 Quickstart & Usage

### 1. Launch Interactive Studio Workbench
Run `./dev.sh` to start both the FastAPI backend and Vite frontend with automatic hot reloading:

```bash
./dev.sh
```

- **Vite React Frontend**: **http://localhost:5173**
- **FastAPI Backend**: **http://localhost:8000** *(Swagger API docs at http://localhost:8000/docs)*

### 2. Run Master Paper Replication Suite
Re-generate all verification reports, single-strip PNG circuit diagrams, and publication figures:

```bash
./verify_paper.sh
```

### 3. Run Automated Selenium E2E Test Suite
Run Headless Chrome end-to-end tests for workspace state isolation and multi-hop persistence:

```bash
python3 tests/test_e2e_selenium.py
```

### 4. Run Backend Python Unit Tests
```bash
python3 tests/test_bloch_math.py && python3 tests/test_visualization_invariants.py
```
