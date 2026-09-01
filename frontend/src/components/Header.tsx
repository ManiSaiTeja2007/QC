import React from 'react';

interface HeaderProps {
  appMode: 'builder' | 'simulation';
  architecture: string;
  synthesis: string;
  preset: string;
  onModeChange: (mode: 'builder' | 'simulation') => void;
  onArchChange: (arch: string) => void;
  onSynthChange: (synth: string) => void;
  onPresetChange: (preset: string) => void;
  onRunSimulation: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  appMode,
  architecture,
  synthesis,
  preset,
  onModeChange,
  onArchChange,
  onSynthChange,
  onPresetChange,
  onRunSimulation,
}) => {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="icon">⚛️</span>
        <div>
          <h1>Quantum ALU 3D Studio 2.0</h1>
          <p className="subtitle">Circuit Builder & Stepwise State Laboratory</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="mode-switch-group">
          <button
            className={`btn btn-xs ${appMode === 'builder' ? 'active' : ''}`}
            onClick={() => onModeChange('builder')}
          >
            🎨 Circuit Builder
          </button>
          <button
            className={`btn btn-xs ${appMode === 'simulation' ? 'active' : ''}`}
            onClick={() => onModeChange('simulation')}
          >
            ⚡ Live Simulation
          </button>
        </div>

        {appMode === 'simulation' && (
          <>
            <div className="control-group">
              <label>Architecture</label>
              <select value={architecture} onChange={(e) => onArchChange(e.target.value)}>
                <option value="1-bit-alu">1-Bit Quantum ALU (28 Ops)</option>
                <option value="falfg-gate">5×5 FALFG Gate</option>
                <option value="fredkin-gate">3×3 Fredkin CSWAP Gate</option>
                <option value="bennett-adder">Bennett Uncomputed Adder</option>
              </select>
            </div>

            <div className="control-group">
              <label>Library</label>
              <select value={synthesis} onChange={(e) => onSynthChange(e.target.value)}>
                <option value="clifford_t">Clifford+T (Fault-Tolerant)</option>
                <option value="ncv">NCV Library</option>
              </select>
            </div>

            <div className="control-group">
              <label>Preset / Test Gallery</label>
              <select value={preset} onChange={(e) => onPresetChange(e.target.value)}>
                <option value="Full Adder">Full Adder (M=1, S2=1)</option>
                <option value="Half Adder">Half Adder (M=1, S2=1, S1=0)</option>
                <option value="Full Subtractor">Full Subtractor</option>
                <option value="XOR (A!=B)">Logic XOR (M=0)</option>
                <option value="AND">Logic AND (M=0)</option>
              </select>
            </div>
          </>
        )}

        <button className="btn btn-primary" onClick={onRunSimulation}>
          ⚡ Run Simulation
        </button>
      </div>
    </header>
  );
};
