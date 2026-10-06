import React, { useState } from 'react';
import { GATE_REGISTRY, GateDefinition } from '../../services/gateRegistry';
import { GateFormulaCard } from './GateFormulaCard';

interface GatePaletteProps {
  selectedGate: string | null;
  onSelectGate: (gateName: string | null) => void;
}

export type GateCategoryTab = 'all' | 'basic' | 'phase' | 'rotation' | 'controlled' | 'multi' | 'measurement';

export const GatePalette: React.FC<GatePaletteProps> = ({
  selectedGate,
  onSelectGate,
}) => {
  const [activeCategory, setActiveCategory] = useState<GateCategoryTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredGate, setHoveredGate] = useState<GateDefinition | null>(null);
  const [paramTheta, setParamTheta] = useState<number>(Math.PI / 2);

  const categories: { id: GateCategoryTab; label: string }[] = [
    { id: 'all', label: 'ALL' },
    { id: 'basic', label: 'BASIC' },
    { id: 'phase', label: 'PHASE' },
    { id: 'rotation', label: 'ROTATION' },
    { id: 'controlled', label: 'CTRL' },
    { id: 'multi', label: 'MULTI' },
    { id: 'measurement', label: 'MEASURE' },
  ];

  const filteredGates = GATE_REGISTRY.filter((g) => {
    if (activeCategory !== 'all' && g.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        g.name.toLowerCase().includes(q) ||
        g.label.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Gate shown in the formula card: hover > selection > H default
  const displayGate =
    hoveredGate ||
    GATE_REGISTRY.find((g) => g.name === selectedGate) ||
    GATE_REGISTRY.find((g) => g.name === 'H') ||
    GATE_REGISTRY[0];

  return (
    <aside className="builder-palette">

      {/* ── Header (fixed, never scrolls) ─────────────────────────────────── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🎨</span>
            <span>Quantum Gate Palette</span>
          </h4>
          <span style={{ fontSize: '0.62rem', color: '#38bdf8', fontWeight: 600 }}>
            {filteredGates.length} Gates
          </span>
        </div>
        <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
          Drag to wire · click to inspect matrix
        </span>
      </div>

      {/* ── Search Bar (fixed) ────────────────────────────────────────────── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="🔍 Search gates (e.g. H, CX, rot)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '5px 24px 5px 8px',
            fontSize: '0.70rem',
            background: '#090d16',
            border: '1px solid #1e293b',
            borderRadius: 4,
            color: '#f8fafc',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer',
              fontSize: '0.75rem', padding: 0,
            }}
          >✕</button>
        )}
      </div>

      {/* ── Category Tabs (fixed) ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2, flexShrink: 0 }}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            style={{
              fontSize: '0.64rem',
              padding: '2px 7px',
              borderRadius: 4,
              border: activeCategory === c.id ? '1px solid #0284c7' : '1px solid #1e293b',
              background: activeCategory === c.id ? '#1e293b' : '#0d1527',
              color: activeCategory === c.id ? '#38bdf8' : '#64748b',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Gate Badge Grid (only this section scrolls, fills remaining space) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 6,
          flex: '1 1 0',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          paddingRight: 2,
          alignContent: 'start',
        }}
      >
        {filteredGates.map((gate) => {
          const isSelected = selectedGate === gate.name;
          const isHovered = hoveredGate?.name === gate.name;
          return (
            <button
              key={gate.id}
              type="button"
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
              style={{
                background: isSelected ? '#0f2b48' : isHovered ? '#172554' : '#0b1329',
                border: isSelected ? '1px solid #38bdf8' : isHovered ? '1px solid #60a5fa' : '1px solid #1e293b',
                borderRadius: 6,
                padding: '6px 2px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.12s ease, border-color 0.12s ease',
                boxShadow: isSelected ? '0 0 8px rgba(56,189,248,0.25)' : 'none',
              }}
            >
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.80rem',
                fontWeight: 700,
                color: isSelected ? '#38bdf8' : '#f8fafc',
              }}>
                {gate.name}
              </span>
              <span style={{
                fontSize: '0.58rem',
                color: isSelected ? '#bae6fd' : '#94a3b8',
                marginTop: 1,
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {gate.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Formula Card (fixed height, pinned at bottom, NEVER resizes) ──── */}
      {displayGate && (
        <div style={{ flexShrink: 0 }}>
          <GateFormulaCard
            gate={displayGate}
            paramTheta={paramTheta}
            onParamChange={setParamTheta}
          />
        </div>
      )}

    </aside>
  );
};
