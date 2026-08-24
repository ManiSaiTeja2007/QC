# Fault-Tolerant Parity-Preserving Clifford+T Quantum ALU

[![Python 3.13+](https://img.shields.io/badge/python-3.13+-blue.svg)](https://www.python.org/)
[![Qiskit 2.x](https://img.shields.io/badge/Qiskit-2.x-purple.svg)](https://qiskit.org/)
[![Tests](https://img.shields.io/badge/pytest-19%20passed%20(100%25)-brightgreen.svg)]()
[![Hardware](https://img.shields.io/badge/platform-CPU%20Only-success.svg)]()

Complete replication and verification suite for the IEEE Transactions on Emerging Topics in Computing (TETC 2026) paper:

> **"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"**  
> *S. S. Tehrani, H. Aghababa, M. H. Majidi, and B. Safaei (2026)*

---

## 🔬 Architectural Summary

This project implements the dual fault-tolerant Quantum Arithmetic Logic Unit (QALU) combining **parity-preserving logic** with **Clifford+T fault-tolerant universal synthesis**:

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
├── requirements.txt            # Clean, unpinned CPU-only dependencies
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
│   └── simulation/             # Verification and simulation engine
│       ├── verifier.py         # Exhaustive Table IV, V, VI & parity/reversibility verifiers
│       ├── cost_metrics.py     # Hardware cost & theoretical scaling analyzer
│       └── fidelity_simulator.py # Aer shot-based & state fidelity simulator
├── tests/                      # Automated pytest test suite (19 test cases)
│   ├── test_gates.py           # Unit tests for fundamental gates
│   ├── test_falfg.py           # Verification of FALFG (Table IV & V)
│   ├── test_one_bit_alu.py     # Verification of 1-bit ALU (Table VI 28 ops)
│   ├── test_n_bit_alu.py       # Scaling & 4-bit ALU validation
│   ├── test_uncomputation.py   # Verification of Bennett uncomputation
│   └── test_metrics.py         # Verification of cost equations & T-metrics
├── experiments/                # Replication & visualization scripts
│   ├── run_all_verifications.py    # Master paper verification script
│   ├── generate_circuit_diagrams.py # Exports all circuit diagrams (PNG & text)
│   └── plot_histograms_fidelity.py  # Replicates Figures 11 & 12
└── results/                    # Generated outputs, figures, and reports
    ├── verification_report.txt # Full text verification report
    ├── verification_report.md  # Markdown verification summary
    ├── circuits/               # Exported circuit diagrams (Fig 4, 5, 7, 8, 9, 10)
    └── figures/                # Publication plots (Fig 11 histograms, Fig 12 fidelity)
```

---

## 🚀 Quickstart & Usage

### 1. Requirements & Setup
The project runs entirely on **CPU** without GPU or cuDNN requirements:

```bash
pip install -r requirements.txt
```

### 2. Run the Full Test Suite
Execute the 19 automated unit tests:

```bash
pytest -v tests/
```

### 3. Run the Master Paper Verification
Run the verification suite across all tables, gates, and formulas:

```bash
python experiments/run_all_verifications.py
```

### 4. Export Circuit Diagrams & Reproduce Publication Figures
Generate circuit diagrams and publication figures (Figures 11 & 12):

```bash
python experiments/generate_circuit_diagrams.py
python experiments/plot_histograms_fidelity.py
```

---

## 📊 Verification & Comparison Results

### Table IV: FALFG 32-State Truth Table Verification
- **Permutation Status**: 100% Bijective (32 unique outputs from 32 inputs).
- **Parity Preservation**: $P_{\text{in}} = P_{\text{out}}$ for all 32 states ($100\%$).
- **State Accuracy**: 32/32 state matches against Table IV.

### Table VI: 1-Bit ALU 28-Operation Summary

| No | Function | Select $(S_0, S_1, S_2, S_3, M)$ | Formula | Verification Status |
|:---|:---|:---:|:---|:---:|
| 1 | AND | $(0, 0, 0, 0, 0)$ | $A \cdot B$ | **PASS (100%)** |
| 2 | $A'B$ ($A < B$) | $(0, 1, 0, 0, 0)$ | $A' \cdot B$ | **PASS (100%)** |
| 3 | OR | $(1, 0, 0, 0, 0)$ | $A + B$ | **PASS (100%)** |
| 4 | $A' + B$ | $(1, 1, 0, 0, 0)$ | $A' + B$ | **PASS (100%)** |
| 5 | XOR ($A \ne B$) | $(0, 0, 1, 0, 0)$ | $A \oplus B$ | **PASS (100%)** |
| 6 | XNOR ($A = B$) | $(1, 0, 1, 0, 0)$ | $(A \oplus B)'$ | **PASS (100%)** |
| 7 | $AB'$ ($A > B$) | $(0, 0, 0, 1, 0)$ | $A \cdot B'$ | **PASS (100%)** |
| 8 | NOR | $(0, 1, 0, 1, 0)$ | $(A + B)'$ | **PASS (100%)** |
| 9 | $A + B'$ | $(1, 0, 0, 1, 0)$ | $A + B'$ | **PASS (100%)** |
| 10 | NAND | $(1, 1, 0, 1, 0)$ | $(A \cdot B)'$ | **PASS (100%)** |
| 11 | Transfer B | $(0, 0, 1, 1, 0)$ | $B$ | **PASS (100%)** |
| 12 | Complement B | $(0, 1, 1, 1, 0)$ | $B'$ | **PASS (100%)** |
| 13 | Half Adder | $(0, 0, 1, 0, 1)$ | $\text{Sum} = A \oplus B, \text{Cout} = AB$ | **PASS (100%)** |
| 14 | Half Subtractor | $(0, 1, 1, 0, 1)$ | $\text{Diff} = A \oplus B, \text{Bout} = A'B$ | **PASS (100%)** |
| 15 | Full Adder | $(C_{\text{in}}, 0, 1, 0, 1)$ | $\text{Sum} = A \oplus B \oplus C_{\text{in}}$ | **PASS (100%)** |
| 16 | Full Subtractor | $(B_{\text{in}}, 1, 1, 0, 1)$ | $\text{Diff} = A \oplus B \oplus B_{\text{in}}$ | **PASS (100%)** |
| 17 | Increment A | $(1, 0, 1, 0, 1)$ | $A + 1$ | **PASS (100%)** |
| 18 | Decrement A | $(1, 1, 1, 0, 1)$ | $A - 1$ | **PASS (100%)** |
| 19 | Set | $(0, 0, 1, 1, 1)$ | $1$ | **PASS (100%)** |
| 20 | Reset | $(0, 1, 1, 1, 1)$ | $0$ | **PASS (100%)** |
| 21 | Transfer A | $(0, 0, 1, 0, 1)$ | $A$ | **PASS (100%)** |
| 22 | Complement A | $(0, 1, 1, 0, 1)$ | $A'$ | **PASS (100%)** |

### Benchmark Comparison (Table VIII & IX in Paper)

| ALU Architecture | Quantum Cost (QC) | Delay | Garbage Outputs | $T$-Count | $T$-Depth | Parity Preserving |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Proposed 1-Bit ALU** | **26** | **20** | **3** | **22** | **9** | **Yes** |
| Moradi et al. [29] | 33 | 29 | 4 | 29 | 11 | No |
| Sen et al. [31] | 56 | 40 | 8 | 44 | 16 | No |
| **Proposed 4-Bit ALU** | **128** | **71** | **15** | **109** | **36** | **Yes** |
| Moradi et al. [29] (4-Bit) | 164 | 108 | 20 | 145 | 45 | No |
| Sen et al. [31] (4-Bit) | 276 | 152 | 38 | 216 | 64 | No |

---

## 📜 Citation

If you use this replication codebase in your research, please cite the target IEEE paper:

```bibtex
@article{tehrani2026quantumalu,
  title={A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU},
  author={Tehrani, S. S. and Aghababa, H. and Majidi, M. H. and Safaei, B.},
  journal={IEEE Transactions on Emerging Topics in Computing},
  year={2026}
}
```
