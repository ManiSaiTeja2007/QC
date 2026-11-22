# Empirical Benchmarks & Telemetry Ledger (`docs/BENCHMARKS.md`)

> **Measurement Rules:** Every metric documented below must include the exact command, target architecture, baseline comparison, and empirical environment. Never interpolate or estimate benchmark numbers.

---

## 1. Master Q-EDA Telemetry (Replication & Extension)

* **Environment:** Python 3.13 / Qiskit Aer / Icarus Verilog / Linux x86_64
* **Validation Command:** `python3 -m pytest tests/` (163 passed) & `python3 experiments/plot_histograms_fidelity.py`

| Benchmark Circuit | Qubits | $T$-Depth | QMDD Nodes | Router SWAPs | Raw Transmon Fidelity | Parity-Mitigated Fidelity $\mathcal{F}_{\text{mit}}$ |
|---|---|---|---|---|---|---|
| **Full Adder (1-Bit)** | 7 | 24 | 16 | 0 | 0.6263 | **0.8192** (+19.3%) |
| **3_17 Benchmark** | 8 | 8 | 24 | 2 | 0.7946 | **0.9129** (+11.8%) |
| **4gt11 Benchmark** | 7 | 16 | 28 | 4 | 0.7437 | **0.8943** (+15.1%) |
| **2bit Multiplier** | 12 | 51 | 48 | 12 | 0.2661 | **0.4504** (+18.4%) |
| **1-Bit ALU (Falcon 27Q)** | 27 | 14 | 16 | 24 | 0.6500 | **0.9490** (+29.9%) |
| **4-Bit ALU (Grid 4×4)** | 28 | 36 | 85 | 42 | 0.5820 | **0.9250** (+34.3%) |
| **16-Bit ALU (Eagle 127Q)** | 127 | 144 | 373 | 88 | 0.4100 | **0.8920** (+48.2%) |
| **64-Bit ALU (Native QMDD)** | 448 | 576 | 1,525 | --- | --- | **1.0000$^*$** (Exact) |

$^*$*Ideal cyclotomic ring $\mathbb{D}[\omega]$ evolution with verified global parity $\langle Z^{\otimes 448} \rangle \equiv +1.0$.*

---

## 2. Synthesis Pareto Frontier (Pebble Uncomputation Scheduling)

* **Source File:** `experiments/benchmark_esop_compiler.py`
* **Target Output:** `results/figures/fig14_compiler_pareto_frontier.png`

| Benchmark | Strategy | Ancilla Count | Total Qubits | $T$-Count | Parallel $T$-Depth | Critical Path Gain |
|---|---|---|---|---|---|---|
| **Full Adder** | `MIN_ANCILLA` | 1 | 7 | 42 | 24 | Baseline |
| | `PARETO_BALANCED` | 2 | 8 | 42 | 24 | +0.0% |
| | `MIN_T_DEPTH` | 3 | 9 | 42 | 22 | **+8.3% depth reduction** |
| **3_17** | `MIN_ANCILLA` | 1 | 8 | 14 | 8 | Baseline |
| | `PARETO_BALANCED` | 1 | 8 | 14 | 8 | Optimal |
| | `MIN_T_DEPTH` | 1 | 8 | 14 | 8 | Optimal |
| **4gt11** | `MIN_ANCILLA` | 1 | 7 | 28 | 16 | Baseline |
| | `PARETO_BALANCED` | 2 | 8 | 28 | 11 | **+31.2% depth reduction** |
| | `MIN_T_DEPTH` | 2 | 8 | 28 | 11 | **+31.2% depth reduction** |
| **2bit Multiplier** | `MIN_ANCILLA` | 3 | 12 | 140 | 76 | Baseline |
| | `PARETO_BALANCED` | 3 | 12 | 140 | 68 | +10.5% depth reduction |
| | `MIN_T_DEPTH` | 10 | 19 | 140 | 51 | **+32.9% depth reduction** |

---

## 3. IBM Heavy-Hex Hardware Routing Performance

* **Source File:** `backend/app/routing/sabre_router.py`
* **Target Output:** `results/figures/fig16_heavy_hex_routing_overhead.png`

| Target Architecture | Coupling Type | Naive SWAPs | Noise-Tuned SABRE SWAPs | SWAP Reduction | Physical Fidelity Gain |
|---|---|---|---|---|---|
| **All-to-All 16Q** | Complete Graph | 0 | 0 | 0.0% | 1.0000 |
| **Grid 4×4 (16Q)** | 2D Planar Mesh | 23 | 16 | **-30.4%** | +28.4% |
| **IBM Falcon 27Q** | Heavy-Hex (Auckland) | 28 | 24 | **-14.3%** | +31.2% |
| **IBM Eagle 127Q** | Heavy-Hex (Brisbane) | 27 | 25 | **-7.4%** | +38.6% |
| **IBM Heron 133Q** | Heavy-Hex (Torino) | 26 | 24 | **-7.7%** | **+45.3% relative gain** |
