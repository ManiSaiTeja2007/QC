import React from 'react';
import { SimulationStep, BlochVector } from '../types/simulation';

interface StatePanelProps {
  stepData: SimulationStep | null;
  selectedQubit: number;
  measurementBasis: 'Z' | 'X' | 'Y';
  onBasisChange: (basis: 'Z' | 'X' | 'Y') => void;
}

const QUBIT_COLORS = [
  '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#a855f7', '#3b82f6',
];

const GATE_INFO: Record<string, { short: string; color: string }> = {
  INIT: { short: 'Initial State |ψ₀⟩', color: '#64748b' },
  H:    { short: 'Hadamard — creates superposition', color: '#38bdf8' },
  X:    { short: 'Pauli-X — bit flip |0⟩↔|1⟩', color: '#10b981' },
  Y:    { short: 'Pauli-Y — bit + phase flip', color: '#a855f7' },
  Z:    { short: 'Pauli-Z — phase flip |1⟩→-|1⟩', color: '#6366f1' },
  S:    { short: 'Phase Gate — π/2 phase on |1⟩', color: '#f59e0b' },
  SDG:  { short: 'S† — -π/2 phase on |1⟩', color: '#f59e0b' },
  T:    { short: 'T Gate — π/4 phase (Clifford+T)', color: '#f43f5e' },
  TDG:  { short: 'T† — -π/4 phase', color: '#f43f5e' },
  CX:   { short: 'CNOT — target flips if ctrl=|1⟩', color: '#38bdf8' },
  CSWAP:{ short: 'Fredkin — controlled SWAP', color: '#10b981' },
};

function blochToKet(bv: BlochVector): { ket: string; color: string } {
  if (bv.z > 0.95) return { ket: '|0⟩', color: '#38bdf8' };
  if (bv.z < -0.95) return { ket: '|1⟩', color: '#10b981' };
  if (Math.abs(bv.x) > 0.9) return { ket: bv.x > 0 ? '|+⟩' : '|-⟩', color: '#f59e0b' };
  if (Math.abs(bv.y) > 0.9) return { ket: bv.y > 0 ? '|i⟩' : '|-i⟩', color: '#a855f7' };
  return { ket: '|ψ⟩', color: '#94a3b8' };
}

export const StatePanel: React.FC<StatePanelProps> = ({
  stepData,
  selectedQubit,
  measurementBasis,
  onBasisChange,
}) => {
  const blochVecs = stepData?.bloch_vectors || [];
  const diracKet = stepData?.psi_ket || ('|' + '0'.repeat(blochVecs.length || 7) + '⟩');
  const gateObj = stepData?.gate;
  const gateKey = gateObj ? gateObj.name.toUpperCase() : 'INIT';
  const gateInfo = GATE_INFO[gateKey] || { short: `${gateKey} gate applied`, color: '#94a3b8' };

  const renderMeasurementBars = () => {
    if (!stepData) return null;
    if (measurementBasis === 'Z') {
      return blochVecs.map((bv, q) => {
        const p1 = (1 - bv.z) / 2;
        const p0 = 1 - p1;
        const color = QUBIT_COLORS[q % QUBIT_COLORS.length];
        const qName = `Q${q}`;
        return (
          <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 24, fontFamily: 'var(--font-mono)', fontSize: 10,
              color, fontWeight: 700, flexShrink: 0,
            }}>{qName}</span>
            <div style={{ flex: 1, background: '#172136', borderRadius: 3, height: 10, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', width: `${p0 * 100}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
                borderRadius: 3, transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{
              width: 32, fontSize: 9, fontFamily: 'var(--font-mono)',
              color: '#94a3b8', textAlign: 'right', flexShrink: 0,
            }}>{p0.toFixed(2)}</span>
            <span style={{
              width: 24, fontSize: 9, fontFamily: 'var(--font-mono)',
              color: p1 > 0.05 ? '#10b981' : '#334155', textAlign: 'right', flexShrink: 0,
            }}>{blochToKet(bv).ket}</span>
          </div>
        );
      });
    }

    // X or Y basis — show selected qubit only
    const bv = blochVecs[selectedQubit];
    if (!bv) return null;
    const val = measurementBasis === 'X' ? bv.x : bv.y;
    const pPlus = (1 + val) / 2;
    const pMinus = 1 - pPlus;
    const labels = measurementBasis === 'X'
      ? [{ l: '|+⟩', p: pPlus }, { l: '|-⟩', p: pMinus }]
      : [{ l: '|+i⟩', p: pPlus }, { l: '|-i⟩', p: pMinus }];
    return labels.map(({ l, p }) => (
      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 32, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#94a3b8' }}>{l}</span>
        <div style={{ flex: 1, background: '#172136', borderRadius: 3, height: 10, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${p * 100}%`, background: '#3b82f6', borderRadius: 3 }} />
        </div>
        <span style={{ width: 36, fontSize: 9, fontFamily: 'var(--font-mono)', color: '#94a3b8', textAlign: 'right' }}>
          {p.toFixed(3)}
        </span>
      </div>
    ));
  };

  return (
    <article className="card panel-state">
      {/* ─── Header: Gate Info ───────────────────────────────────────── */}
      <div style={{
        background: 'var(--header-bg)',
        padding: '6px 10px',
        borderBottom: '1px solid var(--card-border)',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}>
        {/* Ket display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 9, fontWeight: 600, color: '#64748b',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>State</span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: '#34d399', fontWeight: 700,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1,
          }} title={diracKet}>{diracKet}</span>
        </div>

        {/* Gate pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            background: `${gateInfo.color}22`,
            color: gateInfo.color,
            border: `1px solid ${gateInfo.color}44`,
            flexShrink: 0,
          }}>{gateKey}</span>
          <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.3 }}>
            {gateInfo.short}
          </span>
        </div>
      </div>

      {/* ─── Basis selector ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 10px',
        borderBottom: '1px solid var(--card-border)',
        background: '#060a12',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Basis</span>
        {(['Z', 'X', 'Y'] as const).map((b) => (
          <button
            key={b}
            onClick={() => onBasisChange(b)}
            style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: measurementBasis === b ? '#2563eb' : '#1e293b',
              color: measurementBasis === b ? 'white' : '#94a3b8',
              transition: 'all 0.15s ease',
            }}
          >{b}</button>
        ))}
        <span style={{ fontSize: 9, color: '#334155', marginLeft: 'auto' }}>
          {measurementBasis === 'Z' ? 'All qubits' : `Q${selectedQubit} only`}
        </span>
      </div>

      {/* ─── Measurement bars ────────────────────────────────────────── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '8px 10px',
        display: 'flex', flexDirection: 'column', gap: 5,
      }}>
        {blochVecs.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#334155', fontSize: 11,
          }}>Run simulation to see qubit states</div>
        ) : renderMeasurementBars()}
      </div>

      {/* ─── Qubit state table ───────────────────────────────────────── */}
      {blochVecs.length > 0 && measurementBasis === 'Z' && (
        <div style={{
          borderTop: '1px solid var(--card-border)',
          padding: '6px 10px',
          display: 'flex', flexWrap: 'wrap', gap: 4,
          flexShrink: 0,
          background: '#060a12',
        }}>
          {blochVecs.map((bv, q) => {
            const { ket, color } = blochToKet(bv);
            const isSelected = q === selectedQubit;
            return (
              <div key={q} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '3px 6px', borderRadius: 4, gap: 1,
                background: isSelected ? 'rgba(37,99,235,0.2)' : '#172136',
                border: `1px solid ${isSelected ? '#3b82f6' : '#1e293b'}`,
                minWidth: 36,
              }}>
                <span style={{ fontSize: 9, color: QUBIT_COLORS[q % QUBIT_COLORS.length], fontWeight: 700 }}>Q{q}</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color, fontWeight: 700 }}>{ket}</span>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
};
