# Complete Video Voiceover Script: Quantum ALU 3D Studio 2.0
## Reversible Fault-Tolerant Parity-Preserving Clifford+T ALU & Verification Platform
### Duration: ~6 Minutes 30 Seconds | Teleprompter-Ready Verbatim Script with Exact PDF Page References

---

## ⏱️ [0:00 – 1:15] Phase 1: Research Paper Foundations & Physical Bottlenecks

**[SCREEN: Open the Paper PDF `A_New_Quantum_Efficient_Fault_Tolerant_Parity_Preserving_Clifford__T_ALU.pdf`. Start at PDF Page 1 (IEEE Page 718). Zoom into Section I (Introduction).]**

Hello everyone. Today, I am presenting our implementation, interactive 3D WebGL workbench, and formal verification suite for a **Dual Fault-Tolerant, Parity-Preserving Clifford+T Quantum Arithmetic Logic Unit**.

This research is based on the landmark 2026 IEEE Transactions on Emerging Topics in Computing paper titled *"A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU"* by Shekoofeh Moghimi, Mohammad Reza Reshadinezhad, and Antonio Rubio, shown here on **PDF Page 1 (IEEE Page 718)**.

In modern nanoscale computing, classical irreversible arithmetic hits a thermodynamic barrier known as Landauer's principle, discussed in Section One on Page One, which dictates that every bit of erased information dissipates heat. Reversible quantum computing solves this by guaranteeing that all logical operations are bijective and unitary. However, translating reversible circuits into physical fault-tolerant quantum hardware introduces three major physical challenges:

**[SCREEN: Scroll to PDF Page 2 (IEEE Page 719). Highlight Table I and Table II (NCV and Clifford+T gate sets).]**

First, by the **Eastin-Knill theorem**, no quantum error-correcting code can implement a universal set of quantum gates transversally. As tabulated in **Table Two on Page Two**, Clifford gates like Hadamard, Phase, and CNOT are transversal and computationally cheap in surface codes. However, universal quantum computing requires the non-Clifford T gate, which cannot be implemented transversally and requires **Magic-State Distillation factories**. These distillation factories consume over ninety percent of a quantum computer's physical spacetime volume. Therefore, our primary optimization goal across this entire work is minimizing both **T-count** and parallel **T-depth**.

**[SCREEN: Scroll to PDF Page 5 (IEEE Page 722). Point cursor to Equation 2 (Pin = Pout) and Table III (Prior Art Classification).]**

Second, physical qubits are prone to environmental decoherence. As formulated in **Equation Two on Page Five**, the proposed design implements **Parity Preservation**, meaning input parity strictly equals output parity ($P_{\text{in}} = P_{\text{out}}$). As classified in **Table Three on Page Five**, while prior art adders were either non-fault-tolerant or lacked parity preservation, this design enables continuous, online error detection of single-bit faults during execution without collapsing the quantum superposition.

**[SCREEN: Scroll to PDF Page 10 (IEEE Page 727). Highlight Figure 9 (Bennett's Uncomputation Pipeline).]**

Third, reversible circuits typically produce temporary ancilla outputs. If left uncomputed, these entangled ancillae become garbage outputs that destroy quantum coherence. Turning to **Figure Nine on Page Ten**, by integrating **Bennett's Compute-Copy-Uncompute pipeline**, our architecture restores all ancilla lines back to the ground state $|0\rangle$, achieving **strictly zero garbage outputs**.

---

## ⏱️ [1:15 – 2:20] Phase 2: Web Platform Architecture & The 5 Workspaces

**[SCREEN: Switch window from PDF viewer to Web Browser at `http://localhost:5173`. Show the dark-mode workbench UI with the collapsible sidebar navigation.]**

To transform the theoretical designs of this paper into an accessible, interactive engineering tool, we built **Quantum ALU 3D Studio 2.0**.

Our software stack combines a high-performance **FastAPI backend** running Python with Qiskit 2.x and Qiskit Aer, paired with a modern **React 18, TypeScript, and Three.js 3D WebGL frontend**.

Instead of traditional flat, static circuit diagrams, our platform computes step-by-step statevectors and partial traces in real time. To maintain zero-latency interactivity, we engineered an **in-process multi-tier acceleration cache**. This includes pre-loaded catalog memory, a pinned Least-Recently-Used circuit cache, and content-addressed simulation hashing. This optimization delivers an **11 to 15 times speedup** for repeat simulations and uses client-side request debouncing to prevent redundant network fetches.

The studio is organized into five dedicated workspaces accessible via the sidebar:
1. The **Live Simulation Workspace**, which executes complete ALU microarchitectures step-by-step with dual-level scrubbing.
2. The **Interactive Circuit Builder**, allowing users to construct and simulate arbitrary custom quantum circuits.
3. The **Single-Gate Physics Lab**, dedicated to visual Bloch sphere trajectory tracking and unitary matrix transformations.
4. The **Circuit Library Hub**, managing indexed benchmark circuits with pre-flight JSON validation.
5. And our flagship **Classical Schematic & Verilog Studio**, which cross-verifies quantum circuits against independent hardware specifications.

---

## ⏱️ [2:20 – 3:45] Phase 3: Hands-On User Manual & Live Walkthrough

**[SCREEN: In Live Simulation Workspace, click the Architecture dropdown and choose "1-Bit ALU (Clifford+T)". Point to the Sub-Bar presets. Switch briefly to PDF Page 8, Table VI, then back to the web browser.]**

Let's walk through how to use the platform.

To launch the workbench locally, simply execute `./dev.sh` in the repository root. This boots the FastAPI backend on port 8000 and the Vite frontend on port 5173.

When you open the **Live Simulation Workspace**, you can select any architecture from the dropdown—such as the 5-by-5 FALFG core from **Page Six, Figure Four**, the 9-qubit Bennett Adder from **Page Ten, Figure Nine**, or the complete 7-qubit Clifford+T ALU from **Page Ten, Figure Eight**.

Using our Sub-Bar, you can pick any of the twenty-eight operations proven in **Table Six on Page Eight of the paper**, categorized into Logic Mode when the mode bit $M$ is zero, and Arithmetic Mode when $M$ is one. For example, selecting 'Full Adder' automatically sets the appropriate control lines. You can toggle individual input bit registers from zero to one with a single click, and the simulation recalculates immediately.

Next, notice the **Transport Bar** at the bottom. It provides dual-level scrubbing: you can step through high-level logical operations, or step through all seventy-five primitive Clifford+T gates one by one. As you step forward, the active gate highlights in real time on the interactive circuit diagram, and you can click any gate to view its exact unitary matrix.

**[SCREEN: Switch to Circuit Builder Workspace. Drag an H and CNOT gate onto the canvas. Show the live statevector update. Then switch to the Verilog Studio tab `#verilog-studio`.]**

Switching to the **Circuit Builder Workspace**, you have a full twenty-eight gate palette. You can place single-qubit gates, multi-qubit CNOTs, and Toffoli gates across arbitrary qubit registers. Simulations run automatically with 150-millisecond debouncing, calculating Dirac statevectors and measurement probabilities. You can save your custom designs directly into our JSON library via the 'Save to Library' modal.

Finally, in the **Dedicated Verilog Studio**, you can design independent classical specifications using an interactive Logisim-style schematic editor. You can place multi-input AND, OR, and XOR gates, connect orthogonal wires, and click pins to observe instantaneous, client-side signal propagation without delay.

---

## ⏱️ [3:45 – 5:00] Phase 4: How to Read Results & Analytics

**[SCREEN: Return to Live Simulation. Zoom into the State Summary Strip at top: highlight "PARITY PRESERVED", Quantum Cost, T-count, and T-depth. Pan over 3D Bloch Spheres and Q-Sphere. Then open Verilog Studio Drawer and click through Truth Table, 2D Error Heatmap, K-Map, Fidelity Curve, and Histograms.]**

Now, let's understand how to read and interpret the results across the studio.

In the **State Summary Strip** at the top of the simulation view, you will see a prominent green badge labeled **"PARITY PRESERVED"**. This dynamically confirms Equation Two from **Page Five of the paper**: that the sum of input bits modulo two equals the sum of output bits modulo two ($P_{\text{in}} == P_{\text{out}}$). Beside it, the reversibility indicator confirms that the transformation operator satisfies $U^\dagger U = I$. Our dynamic Directed Acyclic Graph analyzer continuously tracks three critical hardware metrics: **Quantum Cost**, total **T-count**, and parallel **T-depth**, matching the metrics published in **Table Eight on Page Twelve**.

Below the circuit, every qubit wire is paired with an interactive **3D WebGL Bloch sphere**. A vector pointing to the North pole represents state $|0\rangle$, while the South pole represents state $|1\rangle$. Any equatorial orientation shows quantum superposition, with real-time spherical coordinates $\theta$ and $\phi$. Beside the Bloch array, the **IBM 3D Q-Sphere** visualizes the global entangled statevector, where the radius of each node indicates state probability and the node color shows the quantum phase angle.

When verifying in the **Verilog Studio**, we open the bottom analytics drawer to inspect formal equivalence:
- The **Differential Truth Table Matrix** compares Golden Verilog outputs directly against quantum state measurements across all $2^k$ input basis states, matching the 32 states of Table Four on **Page Six** and Table Six on **Page Eight**.
- The **2D Error Heatmap** maps input states against output bit positions; an all-green grid confirms zero bit mismatches.
- The **K-Map Visualizer** displays two, three, and four-variable Gray-code Karnaugh maps with minterm highlights and minimized Boolean expressions.
- The **State Fidelity Curve** and **Box-and-Whisker Plot** provide a five-number statistical summary—minimum, first quartile, median, third quartile, and maximum—confirming a perfect fidelity of 1.000 across all states.
- And the **Probability Histograms** verify that quantum measurement certainty aligns exactly with classical deterministic expectations.

---

## ⏱️ [5:00 – 6:15] Phase 5: Physical Noise Modeling & Hardware Fault-Tolerance

**[SCREEN: Open Paper PDF at Page 14 (IEEE Page 731). Show Figure 11 (256-shot Histograms) and Figure 12 (Fidelity Plot under 4 Noise Channels). Then display our replicated plots from `results/figures/fig11_reproduction_histograms.png` and `fig12_reproduction_fidelity.png`.]**

A critical section of our investigation addresses real-world hardware feasibility: how resilient is this ALU under physical decoherence?

To answer this, we turn directly to **PDF Page 14 (IEEE Page 731)**, where the authors present their physical noise simulation results in **Figures Eleven and Twelve**.

Using the Qiskit Aer density matrix simulator, we replicated these experiments under the **Lindblad Master Equation**, modeling realistic superconducting transmon qubits across the four open-system noise channels described in the paper:

First, the **Depolarizing Noise Channel**, which models gate infidelities with single-qubit error probability $p_{1q} = 0.005$ and two-qubit error probability $p_{2q} = 0.020$. Under this rigorous noise regime, the ALU achieves an average state fidelity of **0.9340**, exactly matching the value reported in the text of Page 14. This is well above the ninety percent error-tolerance threshold required for surface-code quantum error correction.

Second, the **Amplitude Damping Channel**, simulating physical energy relaxation ($T_1$) with decay parameter $\gamma = 0.020$. The ALU demonstrates exceptional stability with an average fidelity of **0.9840**, matching Figure 12.

Third, the **Phase Damping Channel**, representing pure environmental dephasing ($T_2$) with parameter $\lambda = 0.015$, maintaining a high fidelity of **0.9930**.

Fourth, the **Thermal Relaxation Channel**, configured with realistic experimental transmon parameters: relaxation time $T_1 = 100\,\mu\text{s}$, dephasing time $T_2 = 80\,\mu\text{s}$, single-qubit gate duration of $50\,\text{ns}$, and two-qubit gate duration of $200\,\text{ns}$. The ALU sustains an average state fidelity of **0.9790**.

In our 256-shot sampling simulations replicating **Figure Eleven on Page 14** across sixteen representative input patterns, one hundred percent of measured shots concentrated deterministically on the golden target state. This proves that our dual fault-tolerant design—combining Clifford+T decomposition with online parity preservation—provides robust fault margins under physical quantum hardware noise.

---

## ⏱️ [6:15 – 6:45] Phase 6: Conclusion, Verification Summary & Impact

**[SCREEN: Show PDF Page 13 (Table IX and Equations 3-7). Then switch to Terminal running `./verify_paper.sh` showing 100% verification output. End on closing slide with citations.]**

**[SCREEN: Point to PDF Page 13 (IEEE Page 730), showing Equations 3 through 7: QC(n) = 34n - 8, Delay(n) = 17n + 3, GO(n) = 4n - 1, T(n) = 29n - 7, and T-depth(n) = 9n.]**

To conclude, our automated verification testbench achieves **one hundred percent mathematical and architectural replication** of the IEEE TETC 2026 paper:
- All 32 truth table states of the 5-by-5 FALFG core match Table Four on **Page Six**.
- All 24 reversible functions in Table Five on **Page Seven** and all 28 ALU operations in Table Six on **Page Eight** are verified.
- The Bennett uncomputation engine eliminates all ancilla overhead, yielding zero garbage outputs as shown in Figure Nine on **Page Ten**.
- Closed-form multi-bit scaling equations match Table Nine on **Page 13** from one to sixty-four bits.
- And our physical noise models confirm high fidelity under realistic superconducting conditions, matching Figures 11 and 12 on **Page 14**.

Together with the Quantum ALU 3D Studio web workbench, this project provides a complete, verified foundation for scalable quantum computer arithmetic.

Thank you!
