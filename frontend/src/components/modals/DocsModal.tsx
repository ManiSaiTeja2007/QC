import React, { useEffect } from 'react';

interface DocsModalProps {
  onClose: () => void;
}

export const DocsModal: React.FC<DocsModalProps> = ({ onClose }) => {
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
            <span style={{ fontSize: '1.2rem' }}>📖</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                Quantum ALU Studio Documentation & User Guide
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Interactive Platform Guide & Workspaces</div>
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
          {/* Section 1: Circuit Builder */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>🎨</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>1. Circuit Builder Workspace</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
              <li><b>Drag and Drop:</b> Click & drag any gate from the left palette and drop it onto any column and qubit wire.</li>
              <li><b>Click-to-Place:</b> Click a gate in the palette to activate it, then click wire locations to place rapidly.</li>
              <li><b>Qubit Inputs:</b> Click the <code style={{ color: '#34d399' }}>|0⟩</code> / <code style={{ color: '#60a5fa' }}>|1⟩</code> badges on the left of each wire to toggle input basis states.</li>
              <li><b>Delete Gate:</b> Click any placed gate on the canvas and press <kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: 3 }}>Delete</kbd> or click <i>Delete Selected Gate</i>.</li>
            </ul>
          </div>

          {/* Section 2: Live Simulation */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>2. Live Simulation Workspace</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
              <li><b>Step-by-Step Playback:</b> Use the transport bar (<code style={{ color: '#38bdf8' }}>▶ Play</code>, <code style={{ color: '#38bdf8' }}>◀ Step</code>, <code style={{ color: '#38bdf8' }}>▶ Step</code>) or scrub slider.</li>
              <li><b>Gate Inspector:</b> Double-click any gate or click the active gate badge <code style={{ color: '#38bdf8' }}>Op X: Gate 🔍</code> to inspect its Unitary Matrix and T-count.</li>
              <li><b>One-Click Export:</b> Export publication-ready vector graphics (<code style={{ color: '#38bdf8' }}>SVG</code>), 2x DPI images (<code style={{ color: '#38bdf8' }}>PNG</code>), or JSON simulation datasets.</li>
              <li><b>3D Bloch & Statevector:</b> Interactive Three.js spheres showing pure state vectors across Z/X/Y measurement bases.</li>
            </ul>
          </div>

          {/* Section 3: Single Gate Lab & QML */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>🔬</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f8fafc' }}>3. Single Gate Lab & QML Lab</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
              <li><b>Single Gate Lab:</b> Isolated test bench for 28+ quantum operators with spherical coordinate sliders ($\theta, \phi$) and matrix visualizer.</li>
              <li><b>QML Lab:</b> Variational Quantum Classifier (VQC) and Variational Quantum State Preparation powered by PennyLane and Adam optimizer.</li>
            </ul>
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
            Got it (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
