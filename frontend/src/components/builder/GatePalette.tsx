import React, { useState } from 'react';
import { GATE_REGISTRY, GateDefinition } from '../../services/gateRegistry';

interface GatePaletteProps {
  selectedGate: string | null;
  onSelectGate: (gateName: string | null) => void;
}

export const GatePalette: React.FC<GatePaletteProps> = ({
  selectedGate,
  onSelectGate,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredGate, setHoveredGate] = useState<GateDefinition | null>(null);

  const filteredGates = GATE_REGISTRY.filter((g) => {
    const q = searchQuery.toLowerCase();
    return (
      g.name.toLowerCase().includes(q) ||
      g.label.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.category.toLowerCase().includes(q)
    );
  });

  const categories = [
    { id: 'basic', title: 'Basic Gates' },
    { id: 'phase', title: 'Phase & Clifford+T' },
    { id: 'rotation', title: 'Parametric Rotations' },
    { id: 'controlled', title: 'Controlled Gates' },
    { id: 'multi', title: 'Multi-Qubit / Reversible' },
    { id: 'measurement', title: 'Measurement & Reset' },
  ] as const;

  const displayGate = hoveredGate || GATE_REGISTRY.find((g) => g.name === selectedGate) || GATE_REGISTRY.find((g) => g.name === 'H') || GATE_REGISTRY[0];

  return (
    <aside className="builder-palette">
      <div className="palette-header">
        <h4>🎨 Gate Palette</h4>
        <span className="subtitle">Drag gate to wire or click to select</span>
      </div>

      <div className="palette-search">
        <input
          type="text"
          placeholder="🔍 Search gates (e.g. H, CX, rot)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="palette-categories">
        {categories.map((cat) => {
          const gatesInCat = filteredGates.filter((g) => g.category === cat.id);
          if (gatesInCat.length === 0) return null;

          return (
            <div key={cat.id} className="palette-group">
              <h5>{cat.title}</h5>
              <div className="gate-buttons-grid">
                {gatesInCat.map((gate) => {
                  const isSelected = selectedGate === gate.name;
                  return (
                    <button
                      key={gate.id}
                      className={`palette-gate-btn ${isSelected ? 'selected' : ''}`}
                      title={`${gate.description} (${gate.numQubits}Q) — Drag to place or click`}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', gate.name);
                        e.dataTransfer.setData('text', gate.name);
                        e.dataTransfer.setData('application/x-qc-gate', JSON.stringify({ name: gate.name, numQubits: gate.numQubits }));
                        e.dataTransfer.effectAllowed = 'copy';
                        onSelectGate(gate.name);
                      }}
                      onClick={() => onSelectGate(isSelected ? null : gate.name)}
                      onMouseEnter={() => setHoveredGate(gate)}
                      onMouseLeave={() => setHoveredGate(null)}
                    >
                      <span className="gate-drag-indicator">⋮⋮</span>
                      <span className="gate-name">{gate.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {displayGate && (
        <div className="gate-hover-inspector">
          <div className="gate-hover-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              <b>{displayGate.name}</b> — {displayGate.description}
            </span>
            <span style={{ fontSize: '0.62rem', color: '#64748b' }}>{displayGate.numQubits}Q</span>
          </div>
          <p className="gate-hover-phys">{displayGate.physicalExplanation}</p>
          {displayGate.matrixHtml && (
            <pre className="gate-hover-matrix">{displayGate.matrixHtml}</pre>
          )}
        </div>
      )}
    </aside>
  );
};
