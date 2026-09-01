import React, { useState, useEffect } from 'react';
import { GATE_REGISTRY, GateDefinition } from '../../services/gateRegistry';

interface SingleGatePanelProps {
  onSimulateSingleGate: (
    gateName: string,
    inputBits: number[],
    params?: number[],
    initialStateMode?: string,
    customPolarAngles?: number[]
  ) => void;
  onPendingSetupChange?: (
    gateName: string,
    inputBits: number[],
    params?: number[],
    initialStateMode?: string,
    customPolarAngles?: number[]
  ) => void;
  isDirty?: boolean;
}

const StateCardMiniSvg: React.FC<{ symbol: string }> = ({ symbol }) => {
  return (
    <svg width={36} height={36} viewBox="0 0 36 36" className="state-card-mini-svg">
      <circle cx={18} cy={18} r={14} fill="none" stroke="#334155" strokeWidth={1} strokeDasharray="2 2" />
      <line x1={4} y1={18} x2={32} y2={18} stroke="#1e293b" strokeWidth={1} />
      <line x1={18} y1={4} x2={18} y2={32} stroke="#1e293b" strokeWidth={1} />

      {symbol === '0' && (
        <g>
          <line x1={18} y1={18} x2={18} y2={7} stroke="#10b981" strokeWidth={2} />
          <polygon points="18,4 14,9 22,9" fill="#10b981" />
        </g>
      )}
      {symbol === '1' && (
        <g>
          <line x1={18} y1={18} x2={18} y2={29} stroke="#f43f5e" strokeWidth={2} />
          <polygon points="18,31 14,26 22,26" fill="#f43f5e" />
        </g>
      )}
      {symbol === '+' && (
        <g>
          <line x1={18} y1={18} x2={29} y2={18} stroke="#38bdf8" strokeWidth={2} />
          <polygon points="32,18 27,14 27,22" fill="#38bdf8" />
        </g>
      )}
      {symbol === '-' && (
        <g>
          <line x1={18} y1={18} x2={7} y2={18} stroke="#38bdf8" strokeWidth={2} />
          <polygon points="4,18 9,14 9,22" fill="#38bdf8" />
        </g>
      )}
      {symbol === '+i' && (
        <g>
          <line x1={18} y1={18} x2={27} y2={9} stroke="#fbbf24" strokeWidth={2} />
          <polygon points="29,7 23,9 27,13" fill="#fbbf24" />
        </g>
      )}
      {symbol === '-i' && (
        <g>
          <line x1={18} y1={18} x2={9} y2={27} stroke="#fbbf24" strokeWidth={2} />
          <polygon points="7,29 13,27 9,23" fill="#fbbf24" />
        </g>
      )}
    </svg>
  );
};

interface GateFormulaDetails {
  operator: string;
  matrixScalar?: string;
  matrix: string[][];
  ketEquations: string[];
  blochRotation?: { axis: string; angle: string };
  unitaryType: string;
  inverse: string;
}

function getGateFormulaData(gate: GateDefinition, paramTheta?: number): GateFormulaDetails {
  const g = gate.name.toUpperCase();
  const th = paramTheta !== undefined ? paramTheta : Math.PI / 2;
  const thPi = (th / Math.PI).toFixed(2);
  const thStr = thPi === '0.50' ? 'π/2' : thPi === '1.00' ? 'π' : thPi === '0.25' ? 'π/4' : `${thPi}π`;

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

const GateFormulaCard: React.FC<{ gate: GateDefinition; paramTheta?: number }> = ({ gate, paramTheta }) => {
  const formula = getGateFormulaData(gate, paramTheta);
  const dim = gate.numQubits === 1 ? '2×2' : gate.numQubits === 2 ? '4×4' : '8×8';

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

export const SingleGatePanel: React.FC<SingleGatePanelProps> = ({
  onSimulateSingleGate,
  onPendingSetupChange,
  isDirty,
}) => {
  const [selectedGateName, setSelectedGateName] = useState<string>('H');
  const [activeCategory, setActiveCategory] = useState<'basic' | 'phase' | 'rotation' | 'controlled' | 'multi'>('basic');

  const [inputStateCategory, setInputStateCategory] = useState<'computational' | 'superposition' | 'entangled' | 'custom'>('superposition');
  const [inputStateStr, setInputStateStr] = useState<string>('+');

  const [paramTheta, setParamTheta] = useState<number>(1.570796); // π/2
  const [customTheta, setCustomTheta] = useState<number>(1.570796); // π/2
  const [customPhi, setCustomPhi] = useState<number>(0.0); // 0

  const currentGate = GATE_REGISTRY.find((g) => g.name === selectedGateName) || GATE_REGISTRY[1]; // default H
  const numQubits = currentGate.numQubits;

  const isParametric = ['RX', 'RY', 'RZ', 'P', 'CRX', 'CRY', 'CRZ'].includes(currentGate.name);

  // Derive input_bits array from selected state string
  const getInputBits = (): number[] => {
    if (numQubits === 1) {
      return inputStateStr === '1' ? [1] : [0];
    } else if (numQubits === 2) {
      if (inputStateStr === '01') return [0, 1];
      if (inputStateStr === '10') return [1, 0];
      if (inputStateStr === '11') return [1, 1];
      return [0, 0];
    } else {
      if (inputStateStr === '001') return [0, 0, 1];
      if (inputStateStr === '010') return [0, 1, 0];
      if (inputStateStr === '011') return [0, 1, 1];
      if (inputStateStr === '100') return [1, 0, 0];
      if (inputStateStr === '101') return [1, 0, 1];
      if (inputStateStr === '110') return [1, 1, 0];
      if (inputStateStr === '111') return [1, 1, 1];
      return [0, 0, 0];
    }
  };

  // Real-time synchronization callback whenever pending setup changes
  useEffect(() => {
    if (onPendingSetupChange) {
      const bits = getInputBits();
      const customAngles = inputStateStr === 'custom' ? [customTheta, customPhi] : undefined;
      onPendingSetupChange(
        selectedGateName,
        bits,
        isParametric ? [paramTheta] : undefined,
        inputStateStr,
        customAngles
      );
    }
  }, [selectedGateName, inputStateStr, paramTheta, customTheta, customPhi, isParametric]);

  const handleSelectGate = (name: string) => {
    setSelectedGateName(name);
    const g = GATE_REGISTRY.find((x) => x.name === name);
    if (g) {
      if (g.numQubits === 2) {
        setInputStateCategory('computational');
        setInputStateStr('00');
      } else if (g.numQubits === 3) {
        setInputStateCategory('computational');
        setInputStateStr('000');
      } else if (g.numQubits === 1) {
        setInputStateCategory('superposition');
        setInputStateStr('+');
      }
    }
  };

  const handleRunSimulation = () => {
    const bits = getInputBits();
    const customAngles = inputStateStr === 'custom' ? [customTheta, customPhi] : undefined;

    onSimulateSingleGate(
      currentGate.name,
      bits,
      isParametric ? [paramTheta] : undefined,
      inputStateStr,
      customAngles
    );
  };

  // Custom State Amplitudes & Bloch Calculation
  const alphaVal = Math.cos(customTheta / 2);
  const betaMag = Math.sin(customTheta / 2);
  const blochX = Math.sin(customTheta) * Math.cos(customPhi);
  const blochY = Math.sin(customTheta) * Math.sin(customPhi);
  const blochZ = Math.cos(customTheta);

  const getSymbolicRadian = (rad: number): string => {
    const piFrac = rad / Math.PI;
    if (Math.abs(piFrac - 0) < 0.01) return '0';
    if (Math.abs(piFrac - 0.25) < 0.01) return 'π/4';
    if (Math.abs(piFrac - 0.5) < 0.01) return 'π/2';
    if (Math.abs(piFrac - 0.75) < 0.01) return '3π/4';
    if (Math.abs(piFrac - 1.0) < 0.01) return 'π';
    if (Math.abs(piFrac - 1.5) < 0.01) return '3π/2';
    if (Math.abs(piFrac - 2.0) < 0.01) return '2π';
    return `${piFrac.toFixed(2)}π`;
  };

  return (
    <div className="single-gate-lab-card">
      <div className="lab-header">
        <h3>🔬 Single Gate Laboratory Setup</h3>
        <p className="subtitle">Configure gate physics, initial quantum states & rotation angles</p>
      </div>

      {/* ─── PHASE 105: VISUAL GATE SELECTOR PALETTE ────────────────────────── */}
      <div className="visual-gate-palette">
        <div className="palette-title">1. Select Quantum Gate (Arity: {numQubits} Qubit)</div>
        <div className="gate-category-tabs">
          {(['basic', 'phase', 'rotation', 'controlled', 'multi'] as const).map((cat) => (
            <button
              key={cat}
              className={`cat-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="gate-badge-grid">
          {GATE_REGISTRY.filter((g) => g.category === activeCategory).map((g) => (
            <button
              key={g.id}
              className={`gate-badge ${selectedGateName === g.name ? 'selected' : ''}`}
              onClick={() => handleSelectGate(g.name)}
            >
              <span className="gate-badge-symbol">{g.symbol}</span>
              <span className="gate-badge-name">{g.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── PHASE 109: PARAMETRIC CONTROLS (ONLY WHEN REQUIRED) ───────────── */}
      {isParametric && (
        <div className="parametric-controls-box">
          <div className="control-group">
            <label>
              Rotation Parameter θ = <b>{paramTheta.toFixed(6)} rad</b> ({getSymbolicRadian(paramTheta)})
            </label>
            <input
              type="range"
              min={0}
              max={2 * Math.PI}
              step={0.05}
              value={paramTheta}
              onChange={(e) => setParamTheta(parseFloat(e.target.value))}
              className="angle-slider"
            />
          </div>
          <div className="quick-angle-buttons">
            <button className="btn-angle" onClick={() => setParamTheta(0)}>0</button>
            <button className="btn-angle" onClick={() => setParamTheta(Math.PI / 4)}>π/4</button>
            <button className="btn-angle" onClick={() => setParamTheta(Math.PI / 2)}>π/2</button>
            <button className="btn-angle" onClick={() => setParamTheta(Math.PI)}>π</button>
            <button className="btn-angle" onClick={() => setParamTheta(2 * Math.PI)}>2π</button>
          </div>
        </div>
      )}

      {/* ─── PHASE 106 & 108: INTELLIGENT ARITY-AWARE INPUT STATE SELECTOR ──── */}
      <div className="visual-state-picker">
        <div className="palette-title">2. Select Initial Input State |ψ₀⟩ ({numQubits} Qubit)</div>

        <div className="state-category-tabs">
          <button
            className={`cat-tab ${inputStateCategory === 'computational' ? 'active' : ''}`}
            onClick={() => { setInputStateCategory('computational'); setInputStateStr(numQubits === 1 ? '0' : numQubits === 2 ? '00' : '000'); }}
          >
            Computational
          </button>
          <button
            className={`cat-tab ${inputStateCategory === 'superposition' ? 'active' : ''}`}
            onClick={() => { setInputStateCategory('superposition'); setInputStateStr(numQubits === 1 ? '+' : numQubits === 2 ? '++' : '+++'); }}
          >
            Superposition
          </button>
          {numQubits >= 2 && (
            <button
              className={`cat-tab ${inputStateCategory === 'entangled' ? 'active' : ''}`}
              onClick={() => { setInputStateCategory('entangled'); setInputStateStr(numQubits === 2 ? 'bell_phi_plus' : 'ghz'); }}
            >
              Entangled
            </button>
          )}
          {numQubits === 1 && (
            <button
              className={`cat-tab ${inputStateCategory === 'custom' ? 'active' : ''}`}
              onClick={() => { setInputStateCategory('custom'); setInputStateStr('custom'); }}
            >
              Custom (θ, φ)
            </button>
          )}
        </div>

        {/* ─── STATE CARDS WITH MINI 2D SVG VECTOR DIAGRAMS (Image 2 Matching) ──── */}
        <div className="state-cards-grid">
          {inputStateCategory === 'computational' && (
            numQubits === 1 ? (
              <>
                <button
                  className={`state-card ${inputStateStr === '0' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('0')}
                >
                  {inputStateStr === '0' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-content">
                    <div className="state-card-symbol">|0⟩</div>
                    <div className="state-card-dir">(+Z)</div>
                  </div>
                  <StateCardMiniSvg symbol="0" />
                </button>
                <button
                  className={`state-card ${inputStateStr === '1' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('1')}
                >
                  {inputStateStr === '1' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-content">
                    <div className="state-card-symbol">|1⟩</div>
                    <div className="state-card-dir">(-Z)</div>
                  </div>
                  <StateCardMiniSvg symbol="1" />
                </button>
              </>
            ) : numQubits === 2 ? (
              ['00', '01', '10', '11'].map((st) => (
                <button
                  key={st}
                  className={`state-card ${inputStateStr === st ? 'active' : ''}`}
                  onClick={() => setInputStateStr(st)}
                >
                  {inputStateStr === st && <span className="card-check-badge">✓</span>}
                  <div className="state-card-symbol">|{st}⟩</div>
                </button>
              ))
            ) : (
              ['000', '001', '010', '011', '100', '101', '110', '111'].map((st) => (
                <button
                  key={st}
                  className={`state-card ${inputStateStr === st ? 'active' : ''}`}
                  onClick={() => setInputStateStr(st)}
                >
                  {inputStateStr === st && <span className="card-check-badge">✓</span>}
                  <div className="state-card-symbol">|{st}⟩</div>
                </button>
              ))
            )
          )}

          {inputStateCategory === 'superposition' && (
            numQubits === 1 ? (
              <>
                <button
                  className={`state-card ${inputStateStr === '+' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('+')}
                >
                  {inputStateStr === '+' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-content">
                    <div className="state-card-symbol">|+⟩</div>
                    <div className="state-card-dir">(+X)</div>
                  </div>
                  <StateCardMiniSvg symbol="+" />
                </button>
                <button
                  className={`state-card ${inputStateStr === '-' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('-')}
                >
                  {inputStateStr === '-' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-content">
                    <div className="state-card-symbol">|-⟩</div>
                    <div className="state-card-dir">(-X)</div>
                  </div>
                  <StateCardMiniSvg symbol="-" />
                </button>
                <button
                  className={`state-card ${inputStateStr === '+i' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('+i')}
                >
                  {inputStateStr === '+i' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-content">
                    <div className="state-card-symbol">|+i⟩</div>
                    <div className="state-card-dir">(+Y)</div>
                  </div>
                  <StateCardMiniSvg symbol="+i" />
                </button>
                <button
                  className={`state-card ${inputStateStr === '-i' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('-i')}
                >
                  {inputStateStr === '-i' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-content">
                    <div className="state-card-symbol">|-i⟩</div>
                    <div className="state-card-dir">(-Y)</div>
                  </div>
                  <StateCardMiniSvg symbol="-i" />
                </button>
              </>
            ) : numQubits === 2 ? (
              <button
                className={`state-card ${inputStateStr === '++' ? 'active' : ''}`}
                onClick={() => setInputStateStr('++')}
              >
                {inputStateStr === '++' && <span className="card-check-badge">✓</span>}
                <div className="state-card-symbol">|++⟩</div>
                <div className="state-card-lbl">Dual Superposition</div>
              </button>
            ) : (
              <button
                className={`state-card ${inputStateStr === '+++' ? 'active' : ''}`}
                onClick={() => setInputStateStr('+++')}
              >
                {inputStateStr === '+++' && <span className="card-check-badge">✓</span>}
                <div className="state-card-symbol">|+++⟩</div>
                <div className="state-card-lbl">Triple Superposition</div>
              </button>
            )
          )}

          {inputStateCategory === 'entangled' && (
            numQubits === 2 ? (
              <>
                <button
                  className={`state-card ${inputStateStr === 'bell_phi_plus' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('bell_phi_plus')}
                >
                  {inputStateStr === 'bell_phi_plus' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-symbol">|Φ⁺⟩</div>
                  <div className="state-card-lbl">Bell (|00⟩+|11⟩)/√2</div>
                </button>
                <button
                  className={`state-card ${inputStateStr === 'bell_psi_plus' ? 'active' : ''}`}
                  onClick={() => setInputStateStr('bell_psi_plus')}
                >
                  {inputStateStr === 'bell_psi_plus' && <span className="card-check-badge">✓</span>}
                  <div className="state-card-symbol">|Ψ⁺⟩</div>
                  <div className="state-card-lbl">Bell (|01⟩+|10⟩)/√2</div>
                </button>
              </>
            ) : (
              <button
                className={`state-card ${inputStateStr === 'ghz' ? 'active' : ''}`}
                onClick={() => setInputStateStr('ghz')}
              >
                {inputStateStr === 'ghz' && <span className="card-check-badge">✓</span>}
                <div className="state-card-symbol">|GHZ⟩</div>
                <div className="state-card-lbl">GHZ (|000⟩+|111⟩)/√2</div>
              </button>
            )
          )}
        </div>

        {/* ─── CUSTOM STATE MINI-LABORATORY ───────────────────────────────── */}
        {inputStateCategory === 'custom' && numQubits === 1 && (
          <div className="custom-state-minilab">
            <div className="minilab-title">
              |ψ⟩ = cos(θ/2)|0⟩ + e^(iφ)sin(θ/2)|1⟩
            </div>

            <div className="control-group">
              <label>Polar Angle θ = <b>{customTheta.toFixed(4)} rad</b> ({(customTheta * (180 / Math.PI)).toFixed(0)}°)</label>
              <input
                type="range"
                min={0}
                max={Math.PI}
                step={0.02}
                value={customTheta}
                onChange={(e) => setCustomTheta(parseFloat(e.target.value))}
                className="angle-slider"
              />
            </div>

            <div className="control-group">
              <label>Azimuthal Phase φ = <b>{customPhi.toFixed(4)} rad</b> ({(customPhi * (180 / Math.PI)).toFixed(0)}°)</label>
              <input
                type="range"
                min={0}
                max={2 * Math.PI}
                step={0.05}
                value={customPhi}
                onChange={(e) => setCustomPhi(parseFloat(e.target.value))}
                className="angle-slider"
              />
            </div>

            <div className="custom-readout-card">
              <div className="readout-col">
                <span>α = {alphaVal.toFixed(3)}</span>
                <span>β = ({betaMag * Math.cos(customPhi) >= 0 ? '+' : ''}${(betaMag * Math.cos(customPhi)).toFixed(3)} + ${(betaMag * Math.sin(customPhi)).toFixed(3)}i)</span>
              </div>
              <div className="readout-col bloch-coords">
                <span>x = {blochX.toFixed(3)}</span>
                <span>y = {blochY.toFixed(3)}</span>
                <span>z = {blochZ.toFixed(3)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quantum Mathematical Formulation & Matrix Card */}
      <GateFormulaCard gate={currentGate} paramTheta={isParametric ? paramTheta : undefined} />
    </div>
  );
};
