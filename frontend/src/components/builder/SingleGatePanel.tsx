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

import { GateFormulaCard } from './GateFormulaCard';

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
