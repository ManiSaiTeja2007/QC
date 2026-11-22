# Contributor Code of Conduct & Engineering Discipline

## 1. Our Standard

As contributors, researchers, and developers on this Quantum Electronic Design Automation (Q-EDA) platform, we commit to engineering integrity, reproducibility, and rigorous scientific inquiry. We prioritize verifiable physical evidence over intuition and mathematical correctness over shortcut approximations.

---

## 2. The 13 Non-Negotiable Invariants

Any human contributor or AI agent operating in this codebase must adhere strictly to these engineering invariants:

1. **User Authority & Plan Alignment:** Never invent architectures, delete existing subsystems, or modify public interfaces without documented justification.
2. **Search Tooling Nuance:** Always prefer `rg` over `grep` and `fd` over `find` for repository exploration. Use `grep` / `git grep` only where needed for `.git/` internals or Unix pipelines.
3. **Python Execution Pipeline:** Strictly follow: **Code Edit $\to$ `pyrefly check .` $\to$ `python3 -m py_compile <file>` $\to$ Test Execution**. Never commit uncompiled or un-typechecked Python edits.
4. **No Destructive Operations:** Never run `git reset --hard`, `git clean`, bulk deletes, or destructive migrations without explicit permission.
5. **Change Containment:** Always run `git status --short` before and after edits. Touch only scoped files. Preserve unrelated working tree changes.
6. **No Greenwashing or Gaming:** Never suppress type errors (`# type: ignore`, blanket `Any`), delete tests, weaken assertions, or declare tasks `DONE` without executable proof.
7. **Four-State Gate Evidence:** Every quality gate must be strictly `PASS`, `FAIL`, `NOT APPLICABLE`, or `NOT MEASURED`. Never convert missing tools or skipped checks into `PASS`.
8. **Canonical Truth Sync:** Keep `docs/` ledgers (`SYSTEM.md`, `TASKS.md`, `DECISIONS.md`, `MEMORY.md`, `BENCHMARKS.md`) synchronized whenever architecture, interfaces, or state change.
9. **No Unprompted Pushes:** Do not commit or push to git remotes unless explicitly directed.
10. **Context Drift & Scope Lock:** Never fix opportunistic "out-of-scope" issues discovered during task execution. Focus exclusively on the requested deliverable.
11. **Upstream Source Authority:** Always modify upstream source files (`.tex`, `.md`, `.py`, `.tsx`) and recompile. Never mutate source-generated binaries (PDFs, SVGs) via post-processing tools.
12. **Red-First Falsification (TDD Invariant):** For bug fixes or new features, write the failing test or reproduction proof FIRST. Verify it fails with the expected symptom before implementing the fix.
13. **Process & Shell Safety:** Never invoke unbounded interactive commands that block waiting for stdin (`vim`, `nano`, interactive CLI prompts without `-y`/`--non-interactive`). Use explicit timeouts and monitor background jobs.

---

## 3. Quantum-Specific Scientific Standards

* **Parity Invariance:** In this codebase, $P_{\text{in}} \equiv P_{\text{out}}$ is a physical security and error-detection invariant. Any new reversible logic block or routing transformation must preserve bitwise parity.
* **Garbage-Free Uncomputation:** Scratch ancilla registers must always be uncomputed back to $|0\rangle$ using Bennett's pipeline. Never leak entangled garbage outputs ($GO=0$).
* **Exact Simulation:** When modifying decision-diagram simulation, preserve exact algebraic ring arithmetic $\mathbb{D}[\omega] = \mathbb{Z}[\omega, 1/\sqrt{2}]$. Do not substitute floating-point approximations.
