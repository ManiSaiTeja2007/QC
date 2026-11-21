import React, { useState } from 'react';
import {
  NoiseSimulationResponse,
  simulatePhysicalNoise,
} from '../../services/api';
import { Activity, X, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

interface PhysicalNoiseDrawerProps {
  architecture: string;
  synthesis: string;
  inputBits: number[];
  isOpen: boolean;
  onClose: () => void;
}

export const PhysicalNoiseDrawer: React.FC<PhysicalNoiseDrawerProps> = ({
  architecture,
  synthesis,
  inputBits,
  isOpen,
  onClose,
}) => {
  const [depolP, setDepolP] = useState<number>(0.002);
  const [t1Us, setT1Us] = useState<number>(110.0);
  const [t2Us, setT2Us] = useState<number>(85.0);
  const [noiseResult, setNoiseResult] = useState<NoiseSimulationResponse | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunNoiseSim = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const res = await simulatePhysicalNoise({
        architecture,
        synthesis,
        input_bits: inputBits,
        depolarizing_p: depolP,
        t1_us: t1Us,
        t2_us: t2Us,
      });
      setNoiseResult(res);
    } catch (err: any) {
      console.error('Noise simulation error:', err);
      setErrorMsg(err.message || 'Failed to execute noise simulation');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 12,
      right: 12,
      width: 440,
      maxHeight: '85vh',
      background: 'rgba(11, 17, 32, 0.98)',
      border: '1px solid rgba(56, 189, 248, 0.3)',
      boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7), 0 0 15px rgba(56, 189, 248, 0.15)',
      borderRadius: 10,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      backdropFilter: 'blur(16px)',
    }}>
      {/* Drawer Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(15, 23, 42, 0.9)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
          <Activity size={16} style={{ color: '#fbbf24' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9' }}>
            Physical Transmon Noise Studio
          </span>
          <span style={{
            fontSize: '0.62rem',
            padding: '2px 7px',
            borderRadius: 4,
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: '#38bdf8',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}>
            {architecture}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Drawer Content */}
      <div style={{ padding: '12px 14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: '0.72rem', color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
          Simulate open-system Lindblad master equation decay on superconducting transmon qubits ($T_1$ relaxation, $T_2$ dephasing, and depolarizing channels).
        </p>

        {/* Parameter Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(15, 23, 42, 0.6)', padding: 10, borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {/* Depolarizing Error p */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#f1f5f9', marginBottom: 3 }}>
              <span>Single-Qubit Gate Error (p):</span>
              <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
                {(depolP * 100).toFixed(2)}%
              </span>
            </div>
            <input
              type="range"
              min="0.0005"
              max="0.02"
              step="0.0005"
              value={depolP}
              onChange={(e) => setDepolP(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#38bdf8' }}
            />
          </div>

          {/* T1 Relaxation */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#f1f5f9', marginBottom: 3 }}>
              <span>T1 Energy Relaxation:</span>
              <span style={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>
                {t1Us.toFixed(0)} µs
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={t1Us}
              onChange={(e) => setT1Us(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#10b981' }}
            />
          </div>

          {/* T2 Dephasing */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#f1f5f9', marginBottom: 3 }}>
              <span>T2 Phase Coherence:</span>
              <span style={{ fontFamily: 'monospace', color: '#a855f7', fontWeight: 700 }}>
                {t2Us.toFixed(0)} µs
              </span>
            </div>
            <input
              type="range"
              min="10"
              max="250"
              step="10"
              value={t2Us}
              onChange={(e) => setT2Us(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#a855f7' }}
            />
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleRunNoiseSim}
          disabled={isRunning}
          style={{
            background: isRunning ? '#334155' : '#0284c7',
            border: 'none',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <RefreshCw size={14} className={isRunning ? 'animate-spin' : ''} />
          {isRunning ? 'Solving Lindblad Master Equation...' : 'Simulate Physical Transmon Noise'}
        </button>

        {errorMsg && (
          <div style={{ color: '#f43f5e', fontSize: '0.7rem', background: 'rgba(244, 63, 94, 0.1)', padding: 8, borderRadius: 4 }}>
            {errorMsg}
          </div>
        )}

        {/* Results View */}
        {noiseResult && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 6,
            padding: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>State Fidelity:</span>
              <span style={{
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                fontWeight: 700,
                color: noiseResult.state_fidelity >= 0.8 ? '#10b981' : '#f59e0b',
              }}>
                {(noiseResult.state_fidelity * 100).toFixed(2)}%
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Quantum Purity Tr(ρ²):</span>
              <span style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 600 }}>
                {noiseResult.purity.toFixed(4)}
              </span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.7rem',
              color: noiseResult.error_margin_passed ? '#10b981' : '#fbbf24',
              background: noiseResult.error_margin_passed ? 'rgba(16, 185, 129, 0.1)' : 'rgba(234, 179, 8, 0.1)',
              padding: '4px 8px',
              borderRadius: 4,
            }}>
              {noiseResult.error_margin_passed ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
              <span>
                {noiseResult.error_margin_passed
                  ? 'Fault Tolerance Threshold Met (F ≥ 90%)'
                  : 'Parity Subspace Error Mitigation Recommended'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
