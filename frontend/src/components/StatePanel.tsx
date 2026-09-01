import React from 'react';
import { SimulationStep, BlochVector } from '../types/simulation';

interface StatePanelProps {
  stepData: SimulationStep | null;
  selectedQubit: number;
  measurementBasis: 'Z' | 'X' | 'Y';
  onBasisChange: (basis: 'Z' | 'X' | 'Y') => void;
}

const GATE_PHYSICAL_EFFECTS: Record<string, string> = {
  INIT: '<b>INIT</b>: Initial computational basis state |ψ₀⟩.',
  H: '<b>Hadamard (H)</b>: Creates equal superposition |+⟩ = (|0⟩+|1⟩)/√2. Rotates Bloch vector by π about axis (X+Z)/√2.',
  X: '<b>Pauli-X (NOT)</b>: Bit-flip gate |0⟩ ↔ |1⟩. Rotates Bloch vector by π about X-axis.',
  Y: '<b>Pauli-Y</b>: Bit and phase-flip gate |0⟩ → i|1⟩, |1⟩ → -i|0⟩. Rotates Bloch vector by π about Y-axis.',
  Z: '<b>Pauli-Z</b>: Phase-flip gate |1⟩ → -|1⟩. Rotates Bloch vector by π about Z-axis.',
  S: '<b>Phase (S)</b>: Applies π/2 phase shift to |1⟩. Rotates Bloch vector by π/2 about Z-axis.',
  SDG: '<b>S-Dagger (S†)</b>: Applies -π/2 phase shift to |1⟩. Rotates Bloch vector by -π/2 about Z-axis.',
  T: '<b>T Gate (π/8)</b>: Fault-tolerant Clifford+T gate. Applies π/4 phase shift to |1⟩. Rotates Bloch vector by π/4 about Z-axis.',
  TDG: '<b>T-Dagger (T†)</b>: Applies -π/4 phase shift to |1⟩. Rotates Bloch vector by -π/4 about Z-axis.',
  CX: '<b>Controlled-NOT (CNOT)</b>: 2-Qubit entangling gate. Target flips if control is |1⟩. Creates multi-qubit entanglement.',
  CSWAP: '<b>Fredkin (CSWAP)</b>: 3-Qubit controlled-SWAP gate. Swaps target qubits if control is |1⟩.',
};

export const StatePanel: React.FC<StatePanelProps> = ({
  stepData,
  selectedQubit,
  measurementBasis,
  onBasisChange,
}) => {
  const diracKet = stepData?.psi_ket || '|0⟩';
  const gateObj = stepData?.gate;
  const gateKey = gateObj ? gateObj.name.toUpperCase() : 'INIT';
  const explanation = GATE_PHYSICAL_EFFECTS[gateKey] || `<b>${gateKey} Gate</b>: Applied to Qubit.`;

  const renderBars = () => {
    if (!stepData) return null;

    if (measurementBasis === 'Z') {
      const entries = Object.entries(stepData.probabilities).filter(([_, p]) => p > 0.001);
      return entries.map(([stateStr, prob]) => {
        const pct = (prob * 100).toFixed(1);
        return (
          <div key={stateStr} className="prob-row">
            <span className="prob-state-lbl">|{stateStr}⟩</span>
            <div className="prob-bar-wrapper">
              <div className="prob-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="prob-val-text">{prob.toFixed(3)}</span>
          </div>
        );
      });
    } else {
      const bv: BlochVector | undefined = stepData.bloch_vectors[selectedQubit];
      if (!bv) return null;

      const val = measurementBasis === 'X' ? bv.x : bv.y;
      const pPlus = (1 + val) / 2;
      const pMinus = (1 - val) / 2;

      const plusLabel = measurementBasis === 'X' ? '|+⟩' : '|+i⟩';
      const minusLabel = measurementBasis === 'X' ? '|-⟩' : '|-i⟩';

      return [
        { label: `Q${selectedQubit} ${plusLabel}`, prob: pPlus },
        { label: `Q${selectedQubit} ${minusLabel}`, prob: pMinus },
      ].map(({ label, prob }) => {
        const pct = (prob * 100).toFixed(1);
        return (
          <div key={label} className="prob-row">
            <span className="prob-state-lbl">{label}</span>
            <div className="prob-bar-wrapper">
              <div className="prob-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="prob-val-text">{prob.toFixed(3)}</span>
          </div>
        );
      });
    }
  };

  return (
    <article className="card panel-state">
      <div className="card-header">
        <h3>⚛️ Quantum Statevector & Measurement</h3>
        <div className="basis-selector">
          <label>Basis:</label>
          {(['Z', 'X', 'Y'] as const).map((b) => (
            <button
              key={b}
              className={`btn-xs ${measurementBasis === b ? 'active' : ''}`}
              onClick={() => onBasisChange(b)}
            >
              {b}-Basis
            </button>
          ))}
        </div>
      </div>

      <div className="state-container">
        <div className="dirac-box">
          <span className="psi-lbl">|ψ⟩ = </span>
          <span className="dirac-formula">{diracKet}</span>
        </div>

        <div className="prob-box">
          <h4>State Probability Distribution ({measurementBasis}-Basis)</h4>
          <div className="prob-bars-grid">{renderBars()}</div>
        </div>

        <div className="gate-explanation-box">
          <h4>Active Gate Physical Transformation</h4>
          <div
            className="explanation-text"
            dangerouslySetInnerHTML={{ __html: explanation }}
          />
        </div>
      </div>
    </article>
  );
};
