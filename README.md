# Fault-Tolerant Parity-Preserving Clifford+T Quantum ALU

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![Qiskit 2.x](https://img.shields.io/badge/Qiskit-2.x-purple.svg)](https://qiskit.org/)
[![Streamlit Dashboard](https://img.shields.io/badge/Streamlit-Live%20Dashboard-red.svg)](https://streamlit.io/)
[![Tests](https://img.shields.io/badge/pytest-20%20passed%20(100%25)-brightgreen.svg)]()
[![Hardware](https://img.shields.io/badge/platform-CPU%20Only-success.svg)]()

Complete replication, verification, and interactive dashboard suite for the IEEE Transactions on Emerging Topics in Computing (TETC 2026) paper:

> **"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"**  
> *S. S. Tehrani, H. Aghababa, M. H. Majidi, and B. Safaei (2026)*

---

## 🌐 Interactive Streamlit Dashboard & Live Simulator

Launch the live interactive Streamlit dashboard:

```bash
streamlit run app.py
```

- **Live 3D Bloch Sphere Explorer**: Interactive Plotly rendering of qubit Bloch vectors $(x, y, z)$ at every gate step.
- **Step Slider**: Move through gate execution step-by-step to watch quantum state evolution live.
- **28 Table VI Operations Selector**: Test all logic and arithmetic ALU operations interactively.
- **Real-Time Fault-Tolerance Verification**: Live checks for Parity Preservation ($P_{\text{in}} = P_{\text{out}}$) and Reversibility.

---

## 🔬 Architectural Summary

1. **5×5 FALFG Gate (Figures 4 & 5)**:
   - Full Adder/Subtractor and 24-function Arithmetic & Logic Function Generator.
   - Dual metrics: Quantum Cost = 11, Delay = 9 (NCV); $T$-count = 7, $T$-depth = 3 (Clifford+T).
   - Validated against all **32/32 states of Table IV** and **24 functions of Table V**.
2. **1-Bit Parity-Preserving ALU (Figures 6, 7 & 8)**:
   - 7-Qubit architecture cascading FALFG with a 4:1 Multiplexer (3 Fredkin gates).
   - Generates **28 operations** (Table VI): 12 logic operations ($M=0$) and 16 arithmetic operations ($M=1$).
   - Dual metrics: Quantum Cost = 26, Delay = 20 (NCV); $T$-count = 22, $T$-depth = 9 (Clifford+T).
3. **Bennett's Uncomputation for Garbage-Free Adder/Subtractor (Figure 9)**:
   - 9-Qubit circuit with Double Feynman ($F2G$) copy gates and reverse uncomputation.
   - Restores primary inputs with **0 garbage outputs**, $T$-count = 10, $T$-depth = 6.
4. **Scalable N-Bit / 4-Bit ALU (Figure 10)**:
   - Cascaded architecture with inter-stage Fredkin 2:1 multiplexers for carry propagation.
   - Verified theoretical scaling equations:
     $$\text{QC}(n) = 34n - 8, \quad \text{Delay}(n) = 17n + 3, \quad \text{GO}(n) = 4n - 1, \quad T\text{-count}(n) = 29n - 7, \quad T\text{-depth}(n) = 9n$$
     $$\text{For } n=4: \quad \text{QC} = 128, \quad \text{Delay} = 71, \quad \text{GO} = 15, \quad T\text{-count} = 109, \quad T\text{-depth} = 36$$

---

## 📁 Repository Structure

```text
.
├── app.py                      # Interactive Streamlit dashboard & live simulator
├── requirements.txt            # CPU-only dependencies (including Streamlit & Plotly)
├── README.md                   # Complete architectural documentation
├── src/                        # Modular source code
│   ├── gates/                  # Fundamental reversible and Clifford+T gates
│   │   ├── basic_gates.py      # CV, CV†, Fredkin (NCV & Clifford+T), Feynman, F2G
│   │   └── clifford_t_library.py # T-count, T-depth, Clifford+T analyzer
│   ├── modules/                # Core quantum circuit modules
│   │   ├── falfg.py            # 5x5 FALFG Gate & 24 function generator
│   │   ├── one_bit_alu.py      # 1-bit 28-operation Parity-Preserving ALU
│   │   ├── n_bit_alu.py        # Scalable N-bit & 4-bit ALU architecture
│   │   └── uncomputation.py    # Garbage-free Bennett uncomputation
│   └── simulation/             # Verification, metrics, and visualizer engine
│       ├── verifier.py         # Exhaustive Table IV, V, VI & parity/reversibility verifiers
│       ├── cost_metrics.py     # Hardware cost & theoretical scaling analyzer
│       ├── fidelity_simulator.py # Aer shot-based & state fidelity simulator
│       └── step_visualizer.py  # Step-by-step gate evolution & 3D Bloch visualizer
├── tests/                      # Automated pytest test suite (20 test cases)
├── experiments/                # Verification and visualization scripts
│   ├── run_all_verifications.py    # Master paper verification script
│   ├── generate_circuit_diagrams.py # Exports all circuit diagrams (PNG & text)
│   ├── plot_histograms_fidelity.py  # Replicates Figures 11 & 12
│   └── visualize_circuit_step_by_step.py # Step-by-step Bloch trajectory generator
└── results/                    # Generated outputs, figures, and reports
```

---

## 🚀 Quickstart & Usage

### 1. Launch Interactive Streamlit Dashboard
```bash
streamlit run app.py
```

### 2. Run the Full Test Suite
```bash
pytest -v tests/
```

### 3. Run the Master Paper Verification
```bash
python experiments/run_all_verifications.py
```

### 4. Export Circuit Diagrams & Step Visualizations
```bash
python experiments/generate_circuit_diagrams.py
python experiments/plot_histograms_fidelity.py
python experiments/visualize_circuit_step_by_step.py
```
