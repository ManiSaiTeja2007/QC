import React from 'react';

export interface GatePaletteItem {
  name: string;
  category: 'basic' | 'phase' | 'multi' | 'parametric';
  numQubits: number;
  label: string;
  description: string;
}

export const GATE_PALETTE: GatePaletteItem[] = [
  { name: 'H', category: 'basic', numQubits: 1, label: 'H', description: 'Hadamard (Superposition)' },
  { name: 'X', category: 'basic', numQubits: 1, label: 'X', description: 'Pauli-X (NOT)' },
  { name: 'Y', category: 'basic', numQubits: 1, label: 'Y', description: 'Pauli-Y' },
  { name: 'Z', category: 'basic', numQubits: 1, label: 'Z', description: 'Pauli-Z (Phase Flip)' },
  
  { name: 'S', category: 'phase', numQubits: 1, label: 'S', description: 'Phase (π/2)' },
  { name: 'SDG', category: 'phase', numQubits: 1, label: 'S†', description: 'S-Dagger (-π/2)' },
  { name: 'T', category: 'phase', numQubits: 1, label: 'T', description: 'T Gate (π/4)' },
  { name: 'TDG', category: 'phase', numQubits: 1, label: 'T†', description: 'T-Dagger (-π/4)' },
  
  { name: 'CX', category: 'multi', numQubits: 2, label: 'CNOT', description: 'Controlled-NOT' },
  { name: 'CZ', category: 'multi', numQubits: 2, label: 'CZ', description: 'Controlled-Z' },
  { name: 'SWAP', category: 'multi', numQubits: 2, label: 'SWAP', description: 'Swap Qubits' },
  
  { name: 'RX', category: 'parametric', numQubits: 1, label: 'RX(θ)', description: 'X Rotation' },
  { name: 'RY', category: 'parametric', numQubits: 1, label: 'RY(θ)', description: 'Y Rotation' },
  { name: 'RZ', category: 'parametric', numQubits: 1, label: 'RZ(θ)', description: 'Z Rotation' },
];

interface GatePaletteProps {
  selectedGate: string | null;
  onSelectGate: (gateName: string | null) => void;
}

export const GatePalette: React.FC<GatePaletteProps> = ({
  selectedGate,
  onSelectGate,
}) => {
  const categories = [
    { id: 'basic', title: 'Basic Gates' },
    { id: 'phase', title: 'Phase & Clifford+T' },
    { id: 'multi', title: 'Multi-Qubit Gates' },
    { id: 'parametric', title: 'Parametric Rotations' },
  ] as const;

  return (
    <aside className="builder-palette">
      <div className="palette-header">
        <h4>🎨 Gate Palette</h4>
        <span className="subtitle">Click gate to place on wire</span>
      </div>

      <div className="palette-categories">
        {categories.map((cat) => (
          <div key={cat.id} className="palette-group">
            <h5>{cat.title}</h5>
            <div className="gate-buttons-grid">
              {GATE_PALETTE.filter((g) => g.category === cat.id).map((gate) => {
                const isSelected = selectedGate === gate.name;
                return (
                  <button
                    key={gate.name}
                    className={`palette-gate-btn ${isSelected ? 'selected' : ''}`}
                    title={gate.description}
                    onClick={() => onSelectGate(isSelected ? null : gate.name)}
                  >
                    <span className="gate-name">{gate.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
