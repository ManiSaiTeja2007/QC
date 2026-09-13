import React, { useEffect } from 'react';
import { GATE_REGISTRY } from '../services/gateRegistry';

interface GateInfoModalProps {
  gateName: string;
  qubits: number[];
  stepIndex: number;
  qubitNames: string[];
  onClose: () => void;
}

// T-count cost reference for common Clifford+T gates
const T_COST: Record<string, number> = {
  T: 1, TDG: 1, TDAG: 1,
  S: 2, SDG: 2, SDAG: 2,
  H: 0, X: 0, Y: 0, Z: 0, I: 0, CX: 0, CNOT: 0,
  CCX: 7, TOFFOLI: 7, FREDKIN: 7, CSWAP: 7,
  SW: 3, SWAP: 3,
  RZ: 1, RX: 1, RY: 1,
};

export const GateInfoModal: React.FC<GateInfoModalProps> = ({
  gateName, qubits, stepIndex, qubitNames, onClose
}) => {
  const info = GATE_REGISTRY.find(g => g.name === gateName);
  const tCost = T_COST[gateName.toUpperCase()] ?? '—';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const qubitLabels = qubits.map(q => qubitNames[q] ?? `Q${q}`).join(', ');

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(13,19,33,0.98)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          width: 380,
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.15)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(59,130,246,0.08)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '1rem', fontWeight: 800,
              color: '#60a5fa',
              background: 'rgba(59,130,246,0.15)',
              padding: '2px 10px', borderRadius: 6,
              letterSpacing: '0.05em',
            }}>{gateName}</span>
            <span style={{ fontSize: 11, color: '#64748b' }}>Step {stepIndex}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: '#94a3b8',
              cursor: 'pointer', fontSize: 13,
              width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Description */}
          {info ? (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 4 }}>Description</div>
                <div style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5 }}>{info.description}</div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 4 }}>Physical Meaning</div>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>{info.physicalExplanation}</div>
              </div>

              {info.matrixHtml && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 4 }}>Unitary Matrix</div>
                  <pre style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: '#a78bfa',
                    background: 'rgba(139,92,246,0.07)',
                    border: '1px solid rgba(139,92,246,0.15)',
                    borderRadius: 6, padding: '8px 10px',
                    margin: 0, whiteSpace: 'pre',
                  }}>{info.matrixHtml}</pre>
                </div>
              )}
            </>
          ) : (
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Gate <code style={{ color: '#60a5fa' }}>{gateName}</code> — part of the Clifford+T decomposition.
            </div>
          )}

          {/* Metadata row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8, borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: 10,
          }}>
            {[
              { label: 'Qubits', value: qubitLabels },
              { label: 'T-Cost', value: tCost },
              { label: 'Type', value: info?.category ?? 'gate' },
            ].map(({ label, value }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6, padding: '6px 8px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{String(value)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, color: '#94a3b8',
              cursor: 'pointer', fontSize: 12, padding: '4px 14px',
              fontFamily: 'var(--font-sans)',
            }}
          >Close  (Esc)</button>
        </div>
      </div>
    </div>
  );
};
