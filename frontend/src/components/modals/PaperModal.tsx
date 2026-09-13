import React, { useEffect } from 'react';

interface PaperModalProps {
  onClose: () => void;
}

export const PaperModal: React.FC<PaperModalProps> = ({ onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(13, 19, 33, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12,
          maxWidth: 680,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(56, 189, 248, 0.2)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12), rgba(37, 99, 235, 0.08))',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>📄</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                IEEE Transactions on Emerging Topics in Computing (TETC 2026)
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Research Paper & Architecture Reference</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Paper Title & Authors */}
          <div>
            <h4 style={{ fontSize: 14, color: '#f8fafc', fontWeight: 700, lineHeight: 1.4, marginBottom: 4 }}>
              A New Quantum Efficient Fault Tolerant Parity Preserving Clifford + T ALU
            </h4>
            <div style={{ fontSize: 11, color: '#93c5fd', fontWeight: 500, marginBottom: 3 }}>
              Shekoofeh Moghimi · Mohammad Reza Reshadinezhad · Antonio Rubio
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              IEEE Transactions on Emerging Topics in Computing, Vol. 14, No. 2, pp. 718–733 (2026) ·{' '}
              <a
                href="https://doi.org/10.1109/TETC.2026.3696481"
                target="_blank"
                rel="noreferrer"
                style={{ color: '#38bdf8', textDecoration: 'underline' }}
              >
                DOI: 10.1109/TETC.2026.3696481
              </a>
            </div>
          </div>

          {/* Abstract */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#38bdf8', marginBottom: 6 }}>
              Abstract & Core Methodology
            </div>
            <p style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.6, margin: 0 }}>
              This research presents a novel 1-bit fault-tolerant reversible quantum Arithmetic Logic Unit (ALU)
              operating across 7 qubits and executing 28 distinct arithmetic and logical operations without ancilla garbage growth.
              The architecture employs a specialized 5×5 Fault-tolerant Arithmetic Logic Function Generator (FALFG) decomposed
              into the universal fault-tolerant Clifford+T gate library. Strict parity preservation is mathematically proven,
              achieving optimal quantum cost (QC: 26) and minimized T-depth (14).
            </p>
          </div>

          {/* Architecture Benchmark Table */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 8 }}>
              Architecture Benchmark Comparison
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, color: '#e2e8f0' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.04)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Architecture</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Qubits</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Total Gates</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Quantum Cost</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>T-Count</th>
                  <th style={{ padding: '6px 8px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>T-Depth</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '6px 8px', color: '#38bdf8', fontWeight: 600 }}>1-Bit Quantum ALU (Proposed)</td>
                  <td style={{ padding: '6px 8px' }}>7</td>
                  <td style={{ padding: '6px 8px' }}>75</td>
                  <td style={{ padding: '6px 8px' }}>26</td>
                  <td style={{ padding: '6px 8px' }}>28</td>
                  <td style={{ padding: '6px 8px' }}>14</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '6px 8px' }}>5×5 FALFG Reversible Gate</td>
                  <td style={{ padding: '6px 8px' }}>5</td>
                  <td style={{ padding: '6px 8px' }}>12</td>
                  <td style={{ padding: '6px 8px' }}>10</td>
                  <td style={{ padding: '6px 8px' }}>14</td>
                  <td style={{ padding: '6px 8px' }}>8</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <td style={{ padding: '6px 8px' }}>Fredkin 3×3 CSWAP</td>
                  <td style={{ padding: '6px 8px' }}>3</td>
                  <td style={{ padding: '6px 8px' }}>7</td>
                  <td style={{ padding: '6px 8px' }}>5</td>
                  <td style={{ padding: '6px 8px' }}>7</td>
                  <td style={{ padding: '6px 8px' }}>4</td>
                </tr>
                <tr>
                  <td style={{ padding: '6px 8px' }}>Bennett Uncomputed Adder</td>
                  <td style={{ padding: '6px 8px' }}>4</td>
                  <td style={{ padding: '6px 8px' }}>14</td>
                  <td style={{ padding: '6px 8px' }}>12</td>
                  <td style={{ padding: '6px 8px' }}>14</td>
                  <td style={{ padding: '6px 8px' }}>8</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Parity Invariant Proof */}
          <div style={{
            background: 'rgba(52, 211, 153, 0.05)',
            border: '1px solid rgba(52, 211, 153, 0.15)',
            borderRadius: 8,
            padding: '10px 14px',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#34d399', marginBottom: 4 }}>
              Theorem 1 (Parity Conservation Invariant)
            </div>
            <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.5 }}>
              Every reversible quantum gate in the proposed ALU satisfies exact parity conservation:
              the input parity bit equals the output parity bit.
              This property enables instantaneous run-time fault detection for single bit-flip and phase errors on NISQ and fault-tolerant architectures.
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(0, 0, 0, 0.2)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={onClose}
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 18px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Done (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
