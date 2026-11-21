# Task Execution Ledger (`docs/TASKS.md`)

## Feature: [INC-261121] Wire-Aligned Egress Bloch Spheres (WA-EBS) & Workspace Decongestion

* **Status:** DONE
* **Date Completed:** 2026-11-21
* **Evidence:**
  - Frontend Build: `bun run build` completed cleanly in 2.06s with 0 errors.
  - Backend Type Check: `pyrefly check .` passed with 0 errors.
  - Regression Test Suite: `pytest -k "not e2e" tests/` passed 162/162 in 43.66s.
  - Visual Verification: Headless Chrome screenshots (`/tmp/devtools_screenshot_1080p.png` and `/tmp/devtools_screenshot_deepdive.png`) confirm pixel-perfect wire alignment, 3D Bloch sphere egress vectors, ket badges, and seamless switching between Heavy-Hex QPU topology and Qubit Deep Dive.

### Milestones

- [x] **M1: Build `WireEgressBlochRail.tsx` Component**
  - Implemented Three.js component using an `OrthographicCamera` mapped 1:1 to circuit SVG wire coordinates ($y_q = \text{startY} + q \cdot \text{rowHeight} + \text{rowHeight} / 2$).
  - Rendered a crisp 3D Bloch sphere per wire with neon equator/meridian rings and real-time SO(3) rotating state vector arrow with Slerp/Lerp interpolation.
  - Added interactive raycast click handlers to select qubits (`onSelectQubit(q)`).

- [x] **M2: Integrate Wire-Aligned Egress Rail into `CircuitPanel.tsx`**
  - Attached the rail directly to the right edge of the circuit wires as `.circuit-pinned-right` in `circuit-viewport-wrapper`.
  - Aligned each wire's output path seamlessly into the left equator of its respective sphere.
  - Displayed live bit status badge ($|0\rangle, |1\rangle$) and qubit name next to each sphere.
  - Synchronized vertical scroll between left pin, circuit track, and right egress rail.

- [x] **M3: Enhance `BlochPanel.tsx` into a High-Res Focused Qubit Inspector**
  - When a qubit is selected, provided an expanded high-resolution 3D Bloch sphere with full Euler angles $(\theta, \phi)$, $(x, y, z)$ coordinates, and purity $|r|$.
  - Freed the right dock from the congested 3x3 grid.

- [x] **M4: Update `LiveSimulationWorkspace.tsx` Layout**
  - Configured the right inspector with tabs: `⬡ Heavy-Hex QPU` (Pillar D Hardware Topology & SABRE Router) and `🌐 Qubit Deep Dive (Q{selectedQubit})`.
  - Defaulted to `HeavyHexPanel` so users immediately see physical QPU mapping while observing per-wire state rotations on the circuit.
  - Auto-switches to Qubit Deep Dive when clicking any wire's sphere or wire label.

- [x] **M5: Full Verification & Screenshot Evidence**
  - Verified static typing: `pyrefly check .` (0 errors).
  - Verified test suite: `pytest -k "not e2e" tests/` (162/162 passed).
  - Verified frontend build: `bun run build` (0 errors).
  - Captured browser screenshots confirming clean wire-aligned visualization.

- [x] **M6: Ledger Digestion & Scratch Purge**
  - Updated `docs/SYSTEM.md` and `SYMBOLS.md`.
  - Purged completed proposal `[INC-261121]` from `docs/scratch.md` per Rule §5.1.

## Feature: [UX-261121] Live Simulation Workspace Visual Decongestion & Human-Centered UX Redesign

* **Status:** DONE
* **Date Completed:** 2026-11-21
* **Evidence:**
  - Frontend Build: `bun run build` passed cleanly in 3.43s with 0 errors.
  - Backend Type Check: `pyrefly check .` passed with 0 errors.
  - Regression Test Suite: `pytest -k "not e2e" tests/` passed 162/162 in 48.86s.
  - Visual Verification: Headless Chrome 1080p screenshot (`docs/images/05_live_simulation_alu.png`) confirms:
    - Balanced 3-column workspace ratio: 1.65fr (Circuit) : 0.75fr (State) : 1.1fr (QPU/Bloch)
    - Replaced noisy 3D Q-Sphere globe with clear, readable per-qubit measurement probability bars and compact computational basis ket badges
    - Compacted HeavyHex panel header into an inline control row with pill tab segmented control (`⬡ QPU Router` / `🌐 Q{n} Bloch`)
    - Complete elimination of light mode across the application (permanently locked dark mode)

## Feature: [FIX-261121] Wire-Egress Alignment, Builder Gate Palette & Dynamic Qubit Addition

* **Status:** DONE
* **Date Completed:** 2026-11-21
* **Evidence:**
  - Multi-Agent Diagnosis: `research` subagent diagnosed double startY offset (+32px), flex-chain collapse in gate palette, and displayMode active filter on newly added builder qubits.
  - Fix Execution:
    - Removed redundant `${startY}px` DOM container in `CircuitPanel.tsx`; rendered `LIVE STATE (3D)` header at $y=22$ inside `WireEgressBlochRail` SVG for 1:1 pixel coordinate parity.
    - Added `height: 100%`, flex column structure, and `minHeight: 150px` badge grid floor to `GatePalette.tsx` & `index.css`.
    - Switched default `displayMode` to `'all'` in `BuilderWorkspace.tsx`, removed `slice(0, 7)` cap in `StatePanel.tsx`, and provided immediate fallback vector in `StateSummaryStrip.tsx`.
  - Frontend Build: `bun run build` passed cleanly in 1.63s with 0 errors.
  - Backend Static Type Check: `pyrefly check .` passed with 0 errors.
  - Regression Test Suite: `pytest -k "not e2e" tests/` passed 162/162 in 52.08s.
  - Visual Verification: Chrome screenshots (`docs/images/05_live_simulation_alu.png` and `docs/images/01_circuit_builder.png`) confirm pixel-perfect wire-to-sphere alignment and full 27-gate palette visibility with dynamic 3-qubit addition.
  - Multi-Agent Adversarial Review: `self` adversarial reviewer completed full evaluation: 4/4 PASS across all quality dimensions and anti-gaming invariants.


