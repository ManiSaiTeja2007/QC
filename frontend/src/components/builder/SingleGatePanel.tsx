import React, { useState } from 'react';
import { GATE_REGISTRY, GateDefinition } from '../../services/gateRegistry';

interface SingleGatePanelProps {
  onSimulateSingleGate: (gateName: string, inputBits: number[], params?: number[]) => void;
}

export const SingleGatePanel: React.FC<SingleGatePanelProps> = ({ onSimulateSingleGate }) => {
  const [selectedGateName, setSelectedGateName] = useState<string>('H');
  const [inputStateStr, setInputStateStr] = useState<string>('0');
  const [paramTheta, setParamTheta] = useState<number>(1.570796); // π/2

  const currentGate = GATE_REGISTRY.find((g) => g.name === selectedGateName) || GATE_REGISTRY[1]; // default H

  const numQubits = currentGate.numQubits;

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

  const handleSimulate = () => {
    const bits = getInputBits();
    const isParametric = ['RX', 'RY', 'RZ', 'P', 'CRX', 'CRY', 'CRZ'].includes(currentGate.name);
    onSimulateSingleGate(currentGate.name, bits, isParametric ? [paramTheta] : undefined);
  };

  return (
    <div className="single-gate-lab-card">
      <div className="lab-header">
        <h3>🔬 Individual Quantum Gate Laboratory</h3>
        <p className="subtitle">Simulate individual gate physics, 3D rotations & unitary matrices</p>
      </div>

      <div className="lab-controls-grid">
        {/* 1. Gate Picker */}
        <div className="control-group">
          <label>Select Quantum Gate:</label>
          <select
            value={selectedGateName}
            onChange={(e) => setSelectedGateName(e.target.value)}
            className="gate-select"
          >
            {GATE_REGISTRY.map((g) => (
              <option key={g.id} value={g.name}>
                {g.name} — {g.description} ({g.numQubits}Q)
              </option>
            ))}
          </select>
        </div>

        {/* 2. Initial State Picker */}
        <div className="control-group">
          <label>Initial Computational Input State |ψ₀⟩:</label>
          <select
            value={inputStateStr}
            onChange={(e) => setInputStateStr(e.target.value)}
            className="state-select"
          >
            {numQubits === 1 && (
              <>
                <option value="0">|0⟩ (Ground State)</option>
                <option value="1">|1⟩ (Excited State)</option>
              </>
            )}
            {numQubits === 2 && (
              <>
                <option value="00">|00⟩</option>
                <option value="01">|01⟩</option>
                <option value="10">|10⟩</option>
                <option value="11">|11⟩</option>
              </>
            )}
            {numQubits === 3 && (
              <>
                <option value="000">|000⟩</option>
                <option value="001">|001⟩</option>
                <option value="010">|010⟩</option>
                <option value="011">|011⟩</option>
                <option value="100">|100⟩</option>
                <option value="101">|101⟩</option>
                <option value="110">|110⟩</option>
                <option value="111">|111⟩</option>
              </>
            )}
          </select>
        </div>

        {/* 3. Parametric Angle Slider (if applicable) */}
        {['RX', 'RY', 'RZ', 'P', 'CRX', 'CRY', 'CRZ'].includes(currentGate.name) && (
          <div className="control-group">
            <label>Rotation Angle θ: {(paramTheta / Math.PI).toFixed(2)}π</label>
            <input
              type="range"
              min={0}
              max={2 * Math.PI}
              step={0.1}
              value={paramTheta}
              onChange={(e) => setParamTheta(parseFloat(e.target.value))}
              className="angle-slider"
            />
          </div>
        )}

        <button className="btn btn-primary btn-run-gate" onClick={handleSimulate}>
          🚀 Simulate Gate Action
        </button>
      </div>

      {/* Gate Metadata Inspector */}
      <div className="lab-info-card">
        <div className="info-title">
          <b>{currentGate.name}</b> ({currentGate.label}) — {currentGate.description}
        </div>
        <p className="info-phys">{currentGate.physicalExplanation}</p>
        {currentGate.matrixHtml && (
          <pre className="info-matrix">{currentGate.matrixHtml}</pre>
        )}
      </div>
    </div>
  );
};
