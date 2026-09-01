import React, { useState, useEffect, useRef } from 'react';
import { SingleGatePanel } from './SingleGatePanel';
import { StatePanel } from '../StatePanel';
import { StateSummaryStrip } from '../StateSummaryStrip';
import { BlochPanel } from '../BlochPanel';
import { fetchSingleGateSimulationData } from '../../services/api';
import { SimulationPayload } from '../../types/simulation';
import { GATE_REGISTRY } from '../../services/gateRegistry';
import { BlochVector3D, computeBlochTrajectoryAtTime, computeLiveStateReadout } from '../../services/blochMath';

export type LabStatus = 'SIMULATING' | 'READY' | 'PLAYING' | 'PAUSED';

function stateToBloch(mode: string, polarAngles?: number[], bits?: number[], qubitIdx: number = 0): BlochVector3D {
  if (mode === '0')  return { x: 0,  y: 0,  z:  1 };
  if (mode === '1')  return { x: 0,  y: 0,  z: -1 };
  if (mode === '+')  return { x: 1,  y: 0,  z:  0 };
  if (mode === '-')  return { x: -1, y: 0,  z:  0 };
  if (mode === '+i') return { x: 0,  y: 1,  z:  0 };
  if (mode === '-i') return { x: 0,  y: -1, z:  0 };
  if (mode === 'custom' && polarAngles && polarAngles.length >= 2) {
    const [theta, phi] = polarAngles;
    return { x: Math.sin(theta)*Math.cos(phi), y: Math.sin(theta)*Math.sin(phi), z: Math.cos(theta) };
  }
  // If computational multi-qubit binary string like '011', '00', '110', etc.
  if (typeof mode === 'string' && /^[01]+$/.test(mode)) {
    const bitChar = mode[qubitIdx] || '0';
    return bitChar === '1' ? { x: 0, y: 0, z: -1 } : { x: 0, y: 0, z: 1 };
  }
  if (bits && bits.length > qubitIdx) {
    return bits[qubitIdx] === 1 ? { x: 0, y: 0, z: -1 } : { x: 0, y: 0, z: 1 };
  }
  return { x: 1, y: 0, z: 0 };
}

export const SingleGateWorkspace: React.FC = () => {
  const [gateName, setGateName]       = useState('H');
  const [inputBits, setInputBits]     = useState<number[]>([0]);
  const [params, setParams]           = useState([1.570796]);
  const [stateMode, setStateMode]     = useState('+');
  const [polarAngles, setPolarAngles] = useState<number[] | undefined>(undefined);

  // r0: current input Bloch — updates client-side instantly on state card click
  const [r0, setR0] = useState<BlochVector3D>({ x: 1, y: 0, z: 0 });
  // r1: output Bloch — only exists after backend simulation
  const [r1, setR1] = useState<BlochVector3D | null>(null);

  const [result, setResult]       = useState<SimulationPayload | null>(null);
  const [labStatus, setLabStatus] = useState<LabStatus>('SIMULATING');

  // Animation
  const [animTime, setAnimTime]   = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1.0);
  const [animMode, setAnimMode]   = useState<'vector'|'trajectory'|'both'>('both');

  // UI
  const [measurementBasis, setMeasurementBasis] = useState<'Z'|'X'|'Y'>('Z');
  const [viewMode, setViewMode]                 = useState<'all'|'grid'|'focus'>('focus');
  const [selectedQubit, setSelectedQubit]       = useState(0);
  const [showWhyModal, setShowWhyModal]         = useState(false);

  const animRef    = useRef<number | null>(null);
  const lastTsRef  = useRef<number | null>(null);

  // Simulate immediately on mount
  useEffect(() => { simulate('H', [0], [1.570796], '+', undefined); }, []); // eslint-disable-line

  // Animation loop with LOOP PLAY
  useEffect(() => {
    if (!isPlaying) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      lastTsRef.current = null;
      if (labStatus === 'PLAYING') setLabStatus('READY');
      return;
    }
    setLabStatus('PLAYING');
    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setAnimTime(prev => {
        const next = prev + dt * 0.5 * playSpeed;
        return next >= 1.0 ? 0.0 : next; // LOOP back to 0
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isPlaying, playSpeed]); // eslint-disable-line

  const simulate = async (
    gate: string,
    bits: number[],
    gateParams: number[],
    mode: string,
    angles: number[] | undefined
  ) => {
    setLabStatus('SIMULATING');
    setIsPlaying(false);
    try {
      const data = await fetchSingleGateSimulationData({
        gate_name: gate,
        input_bits: bits,
        params: gateParams,
        initial_state_mode: mode,
        custom_polar_angles: angles,
      });
      const newR1 = data.steps[1]?.bloch_vectors[0] ?? { x: 0, y: 0, z: 1 };
      setResult(data);
      setR1(newR1);
      setAnimTime(1.0);
      setLabStatus('READY');
    } catch (err) {
      console.error('Simulation failed:', err);
      setLabStatus('READY');
    }
  };

  // Called from panel when user picks a state — instant client-side update + auto-simulate
  const handleSetupChange = (
    gate: string,
    bits: number[],
    gateParams?: number[],
    mode?: string,
    angles?: number[]
  ) => {
    const newGate   = gate;
    const newParams = gateParams ?? params;
    const newMode   = mode ?? stateMode;
    const newAngles = angles;
    const newBits   = bits;

    setGateName(newGate);
    setInputBits(newBits);
    setParams(newParams);
    setStateMode(newMode);
    setPolarAngles(newAngles);

    const gateDefFound = GATE_REGISTRY.find(g => g.name === newGate);
    const gateQubits = gateDefFound?.numQubits ?? 1;
    if (gateQubits > 1) {
      setViewMode('all'); // Show all qubits (grid) for multi-qubit gates like CCX, CX, SWAP
    } else {
      setViewMode('focus');
    }

    // Instantly update input Bloch vector — no backend needed
    const newR0 = stateToBloch(newMode, newAngles, newBits, selectedQubit);
    setR0(newR0);
    setR1(null); // clear old output until backend returns

    // Auto-simulate in background with correct bits!
    simulate(newGate, newBits, newParams, newMode, newAngles);
  };

  // handleSimulate is now just a direct alias — the Simulate button also triggers setup change
  const handleSimulate = (
    gate: string,
    bits: number[],
    gateParams?: number[],
    mode?: string,
    angles?: number[]
  ) => {
    handleSetupChange(gate, bits, gateParams, mode, angles);
  };

  const handlePlayPause = () => {
    if (!r1) return;
    if (animTime >= 1.0) setAnimTime(0.0);
    setIsPlaying(p => !p);
  };

  const effectiveR1    = r1 ?? r0; // if no result yet, hold at r0
  const effectiveAnim  = r1 ? animTime : 1.0;

  const currentBlochT = computeBlochTrajectoryAtTime(gateName, r0, effectiveR1, effectiveAnim, params);
  const liveReadout   = computeLiveStateReadout(currentBlochT, effectiveAnim);

  const step0     = result?.steps[0] ?? null;
  const step1     = result?.steps[1] ?? null;
  const stepForPanel = effectiveAnim < 0.5 ? step0 : step1;
  const qubitNames   = result?.qubit_names ?? ['Q0'];
  const gateDef      = GATE_REGISTRY.find(g => g.name === gateName) ?? GATE_REGISTRY[1];

  return (
    <main className="single-gate-workspace">

      {/* LEFT: Setup */}
      <aside className="single-gate-left-controls">
        <SingleGatePanel
          onSimulateSingleGate={handleSimulate}
          onPendingSetupChange={handleSetupChange}
          isDirty={false}
        />
      </aside>

      {/* RIGHT: Live Lab */}
      <div className="single-gate-right-sim">

        {/* Header */}
        <div className="gate-step-toggle-dock">
          <div className="flow-badge-wrapper">
            <span className="gate-flow-lbl">
              <b>{step0?.psi_ket ?? '—'}</b>
              &nbsp;──[&nbsp;<b>{gateName}</b>&nbsp;]──→&nbsp;
              <b>{step1?.psi_ket ?? '—'}</b>
            </span>
            {labStatus === 'SIMULATING' && <span className="status-badge simulating">⚡ Simulating…</span>}
            {labStatus === 'READY'      && <span className="status-badge ready">🟢 Ready</span>}
            {labStatus === 'PLAYING'    && <span className="status-badge playing">🔵 Playing (t={animTime.toFixed(2)})</span>}
            {labStatus === 'PAUSED'     && <span className="status-badge paused">🟣 Paused (t={animTime.toFixed(2)})</span>}
          </div>
          <div className="step-btn-group">
            <button className="btn btn-xs btn-why-physics" onClick={() => setShowWhyModal(true)}>
              💡 Why? (Physics)
            </button>
          </div>
        </div>

        {/* Animation transport */}
        <div className="live-animation-dock">
          <div className="anim-transport-btns">
            <button className="btn-anim-ctrl" onClick={() => { setIsPlaying(false); setAnimTime(0); }} title="Reset to t=0">
              ↻ Reset
            </button>
            <button className="btn-anim-ctrl" onClick={() => setAnimTime(t => Math.max(0, parseFloat((t - 0.05).toFixed(2))))} disabled={!r1}>
              ◀ Step
            </button>
            <button className={`btn-anim-ctrl btn-play ${isPlaying ? 'playing' : ''}`} onClick={handlePlayPause} disabled={!r1}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button className="btn-anim-ctrl" onClick={() => setAnimTime(t => Math.min(1, parseFloat((t + 0.05).toFixed(2))))} disabled={!r1}>
              Step ▶
            </button>
          </div>

          <div className="anim-scrubber-group">
            <span className="time-val-label">t = {effectiveAnim.toFixed(2)}</span>
            <input
              type="range" min={0} max={1} step={0.01}
              value={effectiveAnim}
              disabled={!r1}
              onChange={e => { setIsPlaying(false); setAnimTime(parseFloat(e.target.value)); }}
              className="anim-scrubber-slider"
            />
            <span className="time-end-label">1.00</span>
          </div>

          <div className="anim-mode-toggles">
            <select value={playSpeed} onChange={e => setPlaySpeed(parseFloat(e.target.value))} className="anim-select-sm">
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1.0}>1.0×</option>
              <option value={2.0}>2.0×</option>
            </select>
            <div className="mode-btn-group">
              {(['vector','trajectory','both'] as const).map(m => (
                <button key={m} className={`btn-mode-xs ${animMode===m?'active':''}`} onClick={() => setAnimMode(m)}>
                  {m==='vector'?'Vector':m==='trajectory'?'Trail':'Both'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live readout */}
        <div className="live-numerical-banner">
          <div className="live-readout-item">
            <span className="readout-lbl">|ψ(t)⟩:</span>
            <span className="readout-val psi-ket-val">{liveReadout.psiKet}</span>
          </div>
          <div className="live-readout-item">
            <span className="readout-lbl">Bloch:</span>
            <span className="readout-val bloch-val">
              X=<b>{liveReadout.bloch.x.toFixed(3)}</b>&nbsp;
              Y=<b>{liveReadout.bloch.y.toFixed(3)}</b>&nbsp;
              Z=<b>{liveReadout.bloch.z.toFixed(3)}</b>&nbsp;
              (|r|={liveReadout.magnitude.toFixed(3)})
            </span>
          </div>
          <div className="live-readout-item">
            <span className="readout-lbl">Angles:</span>
            <span className="readout-val angle-val">
              θ=<b>{liveReadout.thetaDeg.toFixed(1)}°</b>&nbsp;
              φ=<b>{liveReadout.phiDisplay}</b>
            </span>
          </div>
        </div>

        {/* Main panels */}
        <div className="single-gate-sim-panels">
          <StatePanel
            stepData={stepForPanel}
            selectedQubit={selectedQubit}
            measurementBasis={measurementBasis}
            onBasisChange={setMeasurementBasis}
          />

          <div className="card panel-bloch-wrapper">
            <StateSummaryStrip
              stepData={stepForPanel}
              selectedQubit={selectedQubit}
              qubitNames={qubitNames}
              viewMode={viewMode}
              onSelectQubit={setSelectedQubit}
            />
            <BlochPanel
              stepData={stepForPanel}
              selectedQubit={selectedQubit}
              qubitNames={qubitNames}
              viewMode={viewMode}
              numQubits={result?.num_qubits ?? 1}
              onSelectQubit={setSelectedQubit}
              onViewModeChange={setViewMode}
              animTime={effectiveAnim}
              animMode={animMode}
              r0={r0}
              r1={effectiveR1}
              gateName={gateName}
              gateParams={params}
            />
          </div>
        </div>
      </div>

      {/* Physics modal */}
      {showWhyModal && (
        <div className="why-modal-backdrop" onClick={() => setShowWhyModal(false)}>
          <div className="why-modal-card" onClick={e => e.stopPropagation()}>
            <div className="why-modal-header">
              <h4>💡 {step0?.psi_ket ?? '|ψ₀⟩'} ──[ {gateName} ]──→ {step1?.psi_ket ?? '|ψ₁⟩'}</h4>
              <button className="btn-close-modal" onClick={() => setShowWhyModal(false)}>✕</button>
            </div>
            <div className="why-modal-body">
              <div className="why-section">
                <h5>1. Unitary Transformation</h5>
                <p className="why-math-eq">|ψ₁⟩ = U<sub>{gateName}</sub> |ψ₀⟩</p>
                {gateDef.matrixHtml && <pre className="why-matrix-code">{gateDef.matrixHtml}</pre>}
                {gateDef.mathMapping && <div className="why-mapping-badge">Mapping: <b>{gateDef.mathMapping}</b></div>}
              </div>
              <div className="why-section">
                <h5>2. Bloch Vector Rotation</h5>
                <div className="why-bloch-coords-grid">
                  <div className="bloch-coord-box">
                    <h6>Before (t=0)</h6>
                    <span>x = {r0.x.toFixed(3)}</span>
                    <span>y = {r0.y.toFixed(3)}</span>
                    <span>z = {r0.z.toFixed(3)}</span>
                  </div>
                  <div className="bloch-arrow">➔</div>
                  <div className="bloch-coord-box transformed">
                    <h6>After (t=1)</h6>
                    <span>x = {effectiveR1.x.toFixed(3)}</span>
                    <span>y = {effectiveR1.y.toFixed(3)}</span>
                    <span>z = {effectiveR1.z.toFixed(3)}</span>
                  </div>
                </div>
              </div>
              <div className="why-section">
                <h5>3. Physical Meaning</h5>
                <p className="why-phys-desc">{gateDef.physicalExplanation}</p>
              </div>
            </div>
            <div className="why-modal-footer">
              <button className="btn btn-primary" onClick={() => setShowWhyModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
