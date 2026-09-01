import React from 'react';
import { SimulationStep, BlochVector } from '../types/simulation';

interface StateSummaryStripProps {
  stepData: SimulationStep | null;
  selectedQubit: number;
  qubitNames: string[];
  viewMode: 'all' | 'grid' | 'focus';
  onSelectQubit: (qIdx: number) => void;
}

const QUBIT_COLORS = [
  '#ef4444', '#3b82f6', '#10b981', '#f59e0b',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'
];

export const StateSummaryStrip: React.FC<StateSummaryStripProps> = ({
  stepData,
  selectedQubit,
  qubitNames,
  viewMode,
  onSelectQubit,
}) => {
  if (!stepData) return null;

  const q = selectedQubit;
  const bv: BlochVector | undefined = stepData.bloch_vectors[q];
  const qName = qubitNames[q] || `Q${q}`;
  const hexColor = QUBIT_COLORS[q % QUBIT_COLORS.length];

  const r = bv ? Math.sqrt(bv.x * bv.x + bv.y * bv.y + bv.z * bv.z) : 1.0;
  const purity = bv?.purity !== undefined ? bv.purity : r * r;

  let stateType = 'Pure State';
  if (r < 0.1) stateType = 'Maximally Mixed (Entangled)';
  else if (r < 0.95) stateType = 'Partially Mixed (Entangled)';

  const theta = bv ? (Math.acos(Math.max(-1, Math.min(1, bv.z / (r || 1)))) * 180) / Math.PI : 0;
  const phi = bv ? (Math.atan2(bv.y, bv.x) * 180) / Math.PI : 0;

  const activeGateQubits = stepData.gate ? stepData.gate.qubits : [];

  return (
    <>
      {/* Top Single Selected Qubit Summary */}
      <div className="bloch-state-summary">
        <div className="summary-row-1">
          <b style={{ color: hexColor }}>{qName}</b>
          <span className="badge-tag">{stateType}</span>
        </div>
        <div className="summary-row-2">
          <span>
            <b>Bloch:</b> X: {bv?.x ? (bv.x > 0 ? '+' : '') + bv.x.toFixed(3) : '0.000'}, Y:{' '}
            {bv?.y ? (bv.y > 0 ? '+' : '') + bv.y.toFixed(3) : '0.000'}, Z:{' '}
            {bv?.z ? (bv.z > 0 ? '+' : '') + bv.z.toFixed(3) : '0.000'}
          </span>
          <span>
            <b>Angles:</b> θ: {theta.toFixed(1)}°, φ: {phi.toFixed(1)}°
          </span>
          <span>
            <b>|r|:</b> {r.toFixed(3)} (Purity: {purity.toFixed(3)})
          </span>
        </div>
      </div>

      {/* Multi-Qubit Results Strip (Shown in All & Grid modes) */}
      {viewMode !== 'focus' && (
        <div className="all-qubits-summary-strip">
          {stepData.bloch_vectors.map((vec, i) => {
            const isSel = i === selectedQubit;
            const isActiveGate = activeGateQubits.includes(i);
            const name = qubitNames[i] ? qubitNames[i].split(' ')[0] : `Q${i}`;
            const color = QUBIT_COLORS[i % QUBIT_COLORS.length];

            let basisState = '|0⟩';
            if (vec.z <= -0.95) basisState = '|1⟩';
            else if (Math.abs(vec.z) < 0.95) basisState = '|ψ⟩';

            const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);

            return (
              <div
                key={i}
                className={`q-summary-card ${isSel ? 'selected' : ''} ${isActiveGate ? 'active-gate' : ''}`}
                onClick={() => onSelectQubit(i)}
              >
                <div className="q-card-header">
                  <span style={{ color }}>{name}</span>
                  <span className="q-card-state">{basisState}</span>
                </div>
                <div className="q-card-z">
                  Z: {vec.z > 0 ? '+' : ''}{vec.z.toFixed(2)} |r|: {len.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
};
