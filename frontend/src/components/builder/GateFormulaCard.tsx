import React from 'react';
import { GateDefinition } from '../../services/gateRegistry';

export interface GateFormulaDetails {
  operator: string;
  matrixScalar?: string;
  matrix: string[][];
  ketEquations: string[];
  blochRotation?: { axis: string; angle: string };
  unitaryType: string;
  inverse: string;
}

export function getGateFormulaData(gate: GateDefinition, paramTheta?: number): GateFormulaDetails {
  const g = gate.name.toUpperCase();
  const th = paramTheta !== undefined ? paramTheta : Math.PI / 2;
  const thPi = (th / Math.PI).toFixed(2);
  const thStr = thPi === '0.50' ? 'π/2' : thPi === '1.00' ? 'π' : thPi === '0.25' ? 'π/4' : thPi === '1.50' ? '3π/2' : `${thPi}π`;

  switch (g) {
    case 'I':
      return {
        operator: 'Î',
        matrix: [['1', '0'], ['0', '1']],
        ketEquations: ['|0⟩ ↦ |0⟩', '|1⟩ ↦ |1⟩'],
        blochRotation: { axis: '—', angle: '0' },
        unitaryType: 'Identity (Clifford)',
        inverse: 'I',
      };
    case 'H':
      return {
        operator: 'Ĥ',
        matrixScalar: '1/√2',
        matrix: [['1', ' 1'], ['1', '-1']],
        ketEquations: [
          '|0⟩ ↦ (|0⟩ + |1⟩)/√2 = |+⟩',
          '|1⟩ ↦ (|0⟩ - |1⟩)/√2 = |-⟩',
        ],
        blochRotation: { axis: '(X + Z)/√2', angle: 'π (180°)' },
        unitaryType: 'Clifford / Self-Inverse (H† = H)',
        inverse: 'H',
      };
    case 'X':
      return {
        operator: 'X̂',
        matrix: [['0', '1'], ['1', '0']],
        ketEquations: ['|0⟩ ↦ |1⟩', '|1⟩ ↦ |0⟩', '|x⟩ ↦ |x ⊕ 1⟩ [Bit Flip]'],
        blochRotation: { axis: 'X-axis', angle: 'π (180°)' },
        unitaryType: 'Pauli-X (X† = X = X⁻¹)',
        inverse: 'X',
      };
    case 'Y':
      return {
        operator: 'Ŷ',
        matrix: [['0', '-i'], ['i', ' 0']],
        ketEquations: ['|0⟩ ↦ i|1⟩', '|1⟩ ↦ -i|0⟩'],
        blochRotation: { axis: 'Y-axis', angle: 'π (180°)' },
        unitaryType: 'Pauli-Y (Bit + Phase Flip)',
        inverse: 'Y',
      };
    case 'Z':
      return {
        operator: 'Ẑ',
        matrix: [['1', ' 0'], ['0', '-1']],
        ketEquations: ['|0⟩ ↦ |0⟩', '|1⟩ ↦ -|1⟩'],
        blochRotation: { axis: 'Z-axis', angle: 'π (180°)' },
        unitaryType: 'Pauli-Z / Phase Flip (Z† = Z)',
        inverse: 'Z',
      };
    case 'S':
      return {
        operator: 'Ŝ = √Z',
        matrix: [['1', '0'], ['0', 'i']],
        ketEquations: ['|0⟩ ↦ |0⟩', '|1⟩ ↦ i|1⟩ = e^(iπ/2)|1⟩'],
        blochRotation: { axis: 'Z-axis', angle: 'π/2 (90°)' },
        unitaryType: 'Clifford Phase Gate',
        inverse: 'S†',
      };
    case 'SDG':
      return {
        operator: 'Ŝ† = S⁻¹',
        matrix: [['1', ' 0'], ['0', '-i']],
        ketEquations: ['|0⟩ ↦ |0⟩', '|1⟩ ↦ -i|1⟩ = e^(-iπ/2)|1⟩'],
        blochRotation: { axis: 'Z-axis', angle: '-π/2 (-90°)' },
        unitaryType: 'Clifford Phase Gate',
        inverse: 'S',
      };
    case 'T':
      return {
        operator: 'T̂ = √S = ⁴√Z',
        matrix: [['1', '0'], ['0', 'e^(iπ/4)']],
        ketEquations: ['|0⟩ ↦ |0⟩', '|1⟩ ↦ e^(iπ/4)|1⟩'],
        blochRotation: { axis: 'Z-axis', angle: 'π/4 (45°)' },
        unitaryType: 'Universal Non-Clifford Gate',
        inverse: 'T†',
      };
    case 'TDG':
      return {
        operator: 'T̂† = T⁻¹',
        matrix: [['1', '0'], ['0', 'e^(-iπ/4)']],
        ketEquations: ['|0⟩ ↦ |0⟩', '|1⟩ ↦ e^(-iπ/4)|1⟩'],
        blochRotation: { axis: 'Z-axis', angle: '-π/4 (-45°)' },
        unitaryType: 'Universal Non-Clifford Gate',
        inverse: 'T',
      };
    case 'P':
      return {
        operator: `P̂(${thStr})`,
        matrix: [['1', '0'], ['0', 'e^(iφ)']],
        ketEquations: ['|0⟩ ↦ |0⟩', '|1⟩ ↦ e^(iφ)|1⟩'],
        blochRotation: { axis: 'Z-axis', angle: `φ = ${thStr}` },
        unitaryType: 'Parametric Phase Shift',
        inverse: 'P(-φ)',
      };
    case 'RX':
      return {
        operator: `R̂_x(${thStr})`,
        matrix: [['cos(θ/2)', '-i·sin(θ/2)'], ['-i·sin(θ/2)', 'cos(θ/2)']],
        ketEquations: ['|ψ⟩ ↦ cos(θ/2)|ψ⟩ - i·sin(θ/2)·X|ψ⟩', `U = exp(-i · (θ/2) · X̂)`],
        blochRotation: { axis: 'X-axis', angle: `θ = ${thStr}` },
        unitaryType: 'Continuous Rotation SU(2)',
        inverse: 'RX(-θ)',
      };
    case 'RY':
      return {
        operator: `R̂_y(${thStr})`,
        matrix: [['cos(θ/2)', '-sin(θ/2)'], ['sin(θ/2)', 'cos(θ/2)']],
        ketEquations: ['|ψ⟩ ↦ cos(θ/2)|ψ⟩ - sin(θ/2)·Y|ψ⟩', `U = exp(-i · (θ/2) · Ŷ)`],
        blochRotation: { axis: 'Y-axis', angle: `θ = ${thStr}` },
        unitaryType: 'Continuous Rotation SU(2)',
        inverse: 'RY(-θ)',
      };
    case 'RZ':
      return {
        operator: `R̂_z(${thStr})`,
        matrix: [['e^(-iθ/2)', '0'], ['0', 'e^(iθ/2)']],
        ketEquations: ['|0⟩ ↦ e^(-iθ/2)|0⟩', '|1⟩ ↦ e^(iθ/2)|1⟩', `U = exp(-i · (θ/2) · Ẑ)`],
        blochRotation: { axis: 'Z-axis', angle: `θ = ${thStr}` },
        unitaryType: 'Continuous Rotation SU(2)',
        inverse: 'RZ(-θ)',
      };
    case 'CX':
    case 'CNOT':
      return {
        operator: 'CNOT (CX)',
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', '0', '1'],
          ['0', '0', '1', '0'],
        ],
        ketEquations: ['|c, t⟩ ↦ |c, c ⊕ t⟩', '|10⟩ ↔ |11⟩ (Flips target when control=|1⟩)'],
        unitaryType: '2-Qubit Clifford Entangler',
        inverse: 'CX',
      };
    case 'CZ':
      return {
        operator: 'CZ',
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', '1', '0'],
          ['0', '0', '0', '-1'],
        ],
        ketEquations: ['|c, t⟩ ↦ (-1)^(c·t)|c, t⟩', '|11⟩ ↦ -|11⟩ (Controlled Phase Flip)'],
        unitaryType: '2-Qubit Clifford Phase Gate',
        inverse: 'CZ',
      };
    case 'CY':
      return {
        operator: 'CY',
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', '0', '-i'],
          ['0', '0', 'i', '0'],
        ],
        ketEquations: ['|c, t⟩ ↦ |c⟩ ⊗ Y^c|t⟩'],
        unitaryType: '2-Qubit Controlled-Y',
        inverse: 'CY',
      };
    case 'CH':
      return {
        operator: 'CH',
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', '1/√2', '1/√2'],
          ['0', '0', '1/√2', '-1/√2'],
        ],
        ketEquations: ['|c, t⟩ ↦ |c⟩ ⊗ H^c|t⟩', 'Applies Hadamard on target if control=|1⟩'],
        unitaryType: '2-Qubit Controlled-Hadamard',
        inverse: 'CH',
      };
    case 'CRX':
      return {
        operator: `CRX(${thStr})`,
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', 'cos(θ/2)', '-i·sin(θ/2)'],
          ['0', '0', '-i·sin(θ/2)', 'cos(θ/2)'],
        ],
        ketEquations: ['|c, t⟩ ↦ |c⟩ ⊗ RX(θ)^c|t⟩'],
        unitaryType: '2-Qubit Controlled Rotation',
        inverse: 'CRX(-θ)',
      };
    case 'CRY':
      return {
        operator: `CRY(${thStr})`,
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', 'cos(θ/2)', '-sin(θ/2)'],
          ['0', '0', 'sin(θ/2)', 'cos(θ/2)'],
        ],
        ketEquations: ['|c, t⟩ ↦ |c⟩ ⊗ RY(θ)^c|t⟩'],
        unitaryType: '2-Qubit Controlled Rotation',
        inverse: 'CRY(-θ)',
      };
    case 'CRZ':
      return {
        operator: `CRZ(${thStr})`,
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', 'e^(-iθ/2)', '0'],
          ['0', '0', '0', 'e^(iθ/2)'],
        ],
        ketEquations: ['|c, t⟩ ↦ |c⟩ ⊗ RZ(θ)^c|t⟩'],
        unitaryType: '2-Qubit Controlled Rotation',
        inverse: 'CRZ(-θ)',
      };
    case 'SWAP':
      return {
        operator: 'SWAP',
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '0', '1', '0'],
          ['0', '1', '0', '0'],
          ['0', '0', '0', '1'],
        ],
        ketEquations: ['|a, b⟩ ↦ |b, a⟩', '|01⟩ ↔ |10⟩ (State exchange)'],
        unitaryType: '2-Qubit Permutation (Self-Inverse)',
        inverse: 'SWAP',
      };
    case 'ISWAP':
      return {
        operator: 'iSWAP',
        matrix: [
          ['1', '0', '0', '0'],
          ['0', '0', 'i', '0'],
          ['0', 'i', '0', '0'],
          ['0', '0', '0', '1'],
        ],
        ketEquations: ['|01⟩ ↦ i|10⟩', '|10⟩ ↦ i|01⟩'],
        unitaryType: '2-Qubit Entangling Gate',
        inverse: 'iSWAP†',
      };
    case 'CCX':
    case 'TOFFOLI':
      return {
        operator: 'CCX (Toffoli)',
        matrix: [
          ['1', '0', '0', '0', '0', '0', '0', '0'],
          ['0', '1', '0', '0', '0', '0', '0', '0'],
          ['0', '0', '1', '0', '0', '0', '0', '0'],
          ['0', '0', '0', '1', '0', '0', '0', '0'],
          ['0', '0', '0', '0', '1', '0', '0', '0'],
          ['0', '0', '0', '0', '0', '1', '0', '0'],
          ['0', '0', '0', '0', '0', '0', '0', '1'],
          ['0', '0', '0', '0', '0', '0', '1', '0'],
        ],
        ketEquations: ['|a, b, c⟩ ↦ |a, b, c ⊕ (a·b)⟩', 'Universal Reversible Classical Gate'],
        unitaryType: '3-Qubit Controlled-Controlled-NOT',
        inverse: 'CCX',
      };
    case 'CSWAP':
    case 'FREDKIN':
      return {
        operator: 'CSWAP (Fredkin)',
        matrix: [
          ['1', '0', '0', '0', '0', '0', '0', '0'],
          ['0', '1', '0', '0', '0', '0', '0', '0'],
          ['0', '0', '1', '0', '0', '0', '0', '0'],
          ['0', '0', '0', '1', '0', '0', '0', '0'],
          ['0', '0', '0', '0', '1', '0', '0', '0'],
          ['0', '0', '0', '0', '0', '0', '1', '0'],
          ['0', '0', '0', '0', '0', '1', '0', '0'],
          ['0', '0', '0', '0', '0', '0', '0', '1'],
        ],
        ketEquations: ['|c, a, b⟩ ↦ c ? |c, b, a⟩ : |c, a, b⟩', 'Controlled exchange of A and B'],
        unitaryType: '3-Qubit Universal Fredkin Gate',
        inverse: 'CSWAP',
      };
    case 'MEASURE':
      return {
        operator: 'MEASURE (M)',
        matrix: [['1', '0'], ['0', '1']],
        ketEquations: ['|ψ⟩ ↦ |0⟩ with Prob |⟨0|ψ⟩|²', '|ψ⟩ ↦ |1⟩ with Prob |⟨1|ψ⟩|²'],
        blochRotation: { axis: 'Z-axis', angle: 'Collapse' },
        unitaryType: 'Projective Z-Basis Measurement',
        inverse: 'Irreversible (Non-Unitary)',
      };
    case 'RESET':
      return {
        operator: '|0⟩ RESET',
        matrix: [['1', '0'], ['0', '0']],
        ketEquations: ['|ψ⟩ ↦ |0⟩ unconditionally', 'Clears register to ground state'],
        blochRotation: { axis: '+Z Pole', angle: 'Reset' },
        unitaryType: 'Quantum Channel Non-Unitary Reset',
        inverse: 'Non-Unitary',
      };
    default:
      return {
        operator: `Û_${gate.name}`,
        matrix: [['—', '—'], ['—', '—']],
        ketEquations: [gate.mathMapping || '|ψ⟩ ↦ U|ψ⟩'],
        unitaryType: 'Quantum Unitary Gate',
        inverse: gate.inverse || 'U†',
      };
  }
}

interface GateFormulaCardProps {
  gate: GateDefinition;
  paramTheta?: number;
  onParamChange?: (theta: number) => void;
}

export const GateFormulaCard: React.FC<GateFormulaCardProps> = ({ gate, paramTheta, onParamChange }) => {
  const formula = getGateFormulaData(gate, paramTheta);
  const dim = gate.numQubits === 1 ? '2×2' : gate.numQubits === 2 ? '4×4' : '8×8';
  const isParametric = ['RX', 'RY', 'RZ', 'P', 'CRX', 'CRY', 'CRZ'].includes(gate.name.toUpperCase());

  return (
    <div className="gate-formula-card">
      <div className="formula-header">
        <div className="formula-op-badge">
          <span className="formula-op-symbol">{formula.operator}</span>
          <span className="formula-dim-tag">{dim} Unitary</span>
        </div>
        <span className="formula-type-badge">{formula.unitaryType}</span>
      </div>

      {/* State Transformation Ket Formulas */}
      <div className="formula-section">
        <div className="formula-sec-lbl">STATE TRANSFORMATION LAW</div>
        <div className="formula-ket-box">
          {formula.ketEquations.map((eq, i) => (
            <div key={i} className="ket-eq-row">
              <span className="ket-eq-bullet">▸</span>
              <span className="ket-eq-text">{eq}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Matrix Operator */}
      <div className="formula-section">
        <div className="formula-sec-lbl">UNITARY OPERATOR MATRIX</div>
        <div className="formula-matrix-container">
          {formula.matrixScalar && (
            <span className="matrix-scalar-prefix">{formula.matrixScalar} ·</span>
          )}
          <div className={`matrix-bracket-box dim-${gate.numQubits}`}>
            {formula.matrix.map((row, rIdx) => (
              <div key={rIdx} className="matrix-row">
                {row.map((cell, cIdx) => (
                  <span
                    key={cIdx}
                    className={`matrix-cell ${
                      cell.includes('i') ? 'cell-imag' : cell.startsWith('-') ? 'cell-neg' : cell === '0' ? 'cell-zero' : 'cell-pos'
                    }`}
                  >
                    {cell}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Optional Parametric Rotation Angle Buttons */}
      {isParametric && onParamChange && (
        <div style={{ marginTop: 6, marginBottom: 6 }}>
          <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700, marginBottom: 3 }}>
            PRESET ANGLE θ:
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { lbl: 'π/4', val: Math.PI / 4 },
              { lbl: 'π/2', val: Math.PI / 2 },
              { lbl: 'π', val: Math.PI },
              { lbl: '3π/2', val: (3 * Math.PI) / 2 },
            ].map((p) => (
              <button
                key={p.lbl}
                type="button"
                onClick={() => onParamChange(p.val)}
                style={{
                  flex: 1,
                  background: Math.abs((paramTheta ?? Math.PI / 2) - p.val) < 0.05 ? '#0284c7' : '#0f172a',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono)',
                  padding: '2px 0',
                  borderRadius: 3,
                  cursor: 'pointer',
                }}
              >
                {p.lbl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantum Invariants Footer */}
      <div className="formula-footer-grid">
        {formula.blochRotation && (
          <div className="formula-stat-pill">
            <span className="stat-pill-k">Bloch Axis:</span>
            <span className="stat-pill-v">{formula.blochRotation.axis} ({formula.blochRotation.angle})</span>
          </div>
        )}
        <div className="formula-stat-pill">
          <span className="stat-pill-k">Inverse U⁻¹:</span>
          <span className="stat-pill-v">{formula.inverse}</span>
        </div>
      </div>
    </div>
  );
};
