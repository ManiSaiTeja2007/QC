import React, { useState, useEffect, useRef } from 'react';
import {
  fetchQmlInfo,
  runStateOptimization,
  runVqcTraining,
  QmlInfoResponse,
  StateOptimizationResponse,
  VQCTrainResponse,
} from '../../services/api';
import { BlochPanel } from '../BlochPanel';
import { StateSummaryStrip } from '../StateSummaryStrip';
import { SimulationStep } from '../../types/simulation';

export const QMLLabWorkspace: React.FC = () => {
  const [qmlInfo, setQmlInfo] = useState<QmlInfoResponse | null>(null);
  const [activeTask, setActiveTask] = useState<'state_fitting' | 'vqc_classifier'>('state_fitting');

  // State Fitting Configuration
  const [targetState, setTargetState] = useState<string>('+');
  const [customTheta, setCustomTheta] = useState<number>(Math.PI / 2);
  const [customPhi, setCustomPhi] = useState<number>(0);
  const [ansatzType, setAnsatzType] = useState<string>('rot_single');
  const [optimizer, setOptimizer] = useState<string>('adam');
  const [learningRate, setLearningRate] = useState<number>(0.15);
  const [numSteps, setNumSteps] = useState<number>(30);

  // VQC Classifier Configuration
  const [vqcDataset, setVqcDataset] = useState<string>('parity');
  const [vqcLayers, setVqcLayers] = useState<number>(2);
  const [vqcEpochs, setVqcEpochs] = useState<number>(25);

  // Training State & Results
  const [isTraining, setIsTraining] = useState<boolean>(false);
  const [optResult, setOptResult] = useState<StateOptimizationResponse | null>(null);
  const [vqcResult, setVqcResult] = useState<VQCTrainResponse | null>(null);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);

  // Animation Playback
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const playTimerRef = useRef<number | null>(null);

  // Load PennyLane Info on mount
  useEffect(() => {
    fetchQmlInfo()
      .then(setQmlInfo)
      .catch((err) => console.error('Failed to load PennyLane info:', err));
  }, []);

  // Run initial state optimization demo on mount
  useEffect(() => {
    handleRunOptimization();
  }, []); // eslint-disable-line

  const handleRunOptimization = async () => {
    setIsTraining(true);
    setIsPlaying(false);
    try {
      const res = await runStateOptimization({
        target_state: targetState,
        custom_angles: targetState === 'custom' ? [customTheta, customPhi] : undefined,
        ansatz_type: ansatzType,
        optimizer_name: optimizer,
        learning_rate: learningRate,
        num_steps: numSteps,
      });
      setOptResult(res);
      setCurrentStepIdx(res.steps.length - 1); // default to final optimized step
    } catch (err) {
      console.error('PennyLane state optimization error:', err);
    } finally {
      setIsTraining(false);
    }
  };

  const handleRunVqc = async () => {
    setIsTraining(true);
    try {
      const res = await runVqcTraining({
        dataset: vqcDataset,
        n_layers: vqcLayers,
        learning_rate: 0.15,
        epochs: vqcEpochs,
      });
      setVqcResult(res);
    } catch (err) {
      console.error('PennyLane VQC training error:', err);
    } finally {
      setIsTraining(false);
    }
  };

  // Playback timer to animate optimization trajectory
  useEffect(() => {
    if (isPlaying && optResult && optResult.steps.length > 0) {
      playTimerRef.current = window.setInterval(() => {
        setCurrentStepIdx((prev) => {
          if (prev < optResult.steps.length - 1) {
            return prev + 1;
          } else {
            return 0; // loop back to initial step
          }
        });
      }, 150);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, optResult]);

  // Current step record
  const currentRecord = optResult ? optResult.steps[currentStepIdx] : null;

  // Adapt current step record into a SimulationStep for BlochPanel & StateSummaryStrip
  const blochStepData: SimulationStep | null = currentRecord
    ? {
        primitive_step: currentRecord.step,
        logical_op_id: 0,
        logical_op_name: `Optimization Step ${currentRecord.step}`,
        bloch_vectors: currentRecord.bloch_vectors.map((bv) => ({
          x: bv.x,
          y: bv.y,
          z: bv.z,
          purity: bv.purity,
        })),
        probabilities: currentRecord.probabilities,
        gate: null,
        psi_ket: formatPsiKet(currentRecord.statevector),
        unitary_fidelity: currentRecord.fidelity,
      }
    : null;

  const numQubits = currentRecord ? currentRecord.bloch_vectors.length : 1;
  const qubitNames = Array.from({ length: numQubits }, (_, i) => `Q${i} (Ansatz Wire ${i})`);

  return (
    <div className="qml-workspace">
      {/* ─── Top Banner ──────────────────────────────────────────────────────── */}
      <div className="qml-top-banner">
        <div className="qml-banner-left">
          <h2>🧠 PennyLane Quantum Machine Learning Studio</h2>
          <span className="qml-badge">
            PennyLane {qmlInfo?.pennylane_version || 'v0.45.1'} • Automatic Differentiation • Autograd / Parameter-Shift
          </span>
        </div>

        {/* Task Mode Switcher */}
        <div className="qml-task-switch">
          <button
            className={`btn btn-xs ${activeTask === 'state_fitting' ? 'active' : ''}`}
            onClick={() => {
              setActiveTask('state_fitting');
              if (!optResult) handleRunOptimization();
            }}
          >
            🎯 Variational State Fitting
          </button>
          <button
            className={`btn btn-xs ${activeTask === 'vqc_classifier' ? 'active' : ''}`}
            onClick={() => {
              setActiveTask('vqc_classifier');
              if (!vqcResult) handleRunVqc();
            }}
          >
            🤖 Quantum Classifier (QNN)
          </button>
        </div>
      </div>

      <div className="qml-main-layout">
        {/* ─── Left Control Panel ────────────────────────────────────────────── */}
        <aside className="qml-left-sidebar">
          {activeTask === 'state_fitting' ? (
            <>
              <div className="sidebar-section">
                <h4>1. Target Quantum State</h4>
                <div className="target-state-grid">
                  {[
                    { id: '+', label: '|+⟩ (+X)' },
                    { id: '-', label: '|-⟩ (-X)' },
                    { id: '+i', label: '|+i⟩ (+Y)' },
                    { id: '-i', label: '|-i⟩ (-Y)' },
                    { id: '1', label: '|1⟩ (-Z)' },
                    { id: '0', label: '|0⟩ (+Z)' },
                    { id: 'bell_phi_plus', label: '|Φ⁺⟩ (Bell 2Q)' },
                    { id: 'custom', label: 'Custom (θ, φ)' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      className={`btn-state-pick ${targetState === s.id ? 'active' : ''}`}
                      onClick={() => {
                        setTargetState(s.id);
                        if (s.id === 'bell_phi_plus') setAnsatzType('entangled_2q');
                        else if (ansatzType === 'entangled_2q') setAnsatzType('rot_single');
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {targetState === 'custom' && (
                  <div className="custom-angle-box">
                    <label>Polar Angle θ: {(customTheta / Math.PI).toFixed(2)}π</label>
                    <input
                      type="range"
                      min={0}
                      max={Math.PI}
                      step={0.05}
                      value={customTheta}
                      onChange={(e) => setCustomTheta(parseFloat(e.target.value))}
                    />
                    <label>Azimuthal Angle φ: {(customPhi / Math.PI).toFixed(2)}π</label>
                    <input
                      type="range"
                      min={0}
                      max={2 * Math.PI}
                      step={0.05}
                      value={customPhi}
                      onChange={(e) => setCustomPhi(parseFloat(e.target.value))}
                    />
                  </div>
                )}
              </div>

              <div className="sidebar-section">
                <h4>2. Parameterized Quantum Circuit (Ansatz)</h4>
                <select
                  value={ansatzType}
                  onChange={(e) => setAnsatzType(e.target.value)}
                  className="qml-select"
                >
                  <option value="rot_single">1-Qubit Euler: Rot(φ, θ, ω)</option>
                  <option value="entangled_2q">2-Qubit Entangled: Rot ⊗ Rot → CNOT</option>
                </select>
              </div>

              <div className="sidebar-section">
                <h4>3. PennyLane Optimizer & Hyperparameters</h4>
                <div className="param-row">
                  <label>Optimizer:</label>
                  <select
                    value={optimizer}
                    onChange={(e) => setOptimizer(e.target.value)}
                    className="qml-select-sm"
                  >
                    <option value="adam">Adam (Adaptive Moments)</option>
                    <option value="gd">Gradient Descent (SGD)</option>
                  </select>
                </div>
                <div className="param-row">
                  <label>Learning Rate (η): {learningRate}</label>
                  <input
                    type="range"
                    min={0.02}
                    max={0.4}
                    step={0.01}
                    value={learningRate}
                    onChange={(e) => setLearningRate(parseFloat(e.target.value))}
                  />
                </div>
                <div className="param-row">
                  <label>Optimization Steps: {numSteps}</label>
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={5}
                    value={numSteps}
                    onChange={(e) => setNumSteps(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <button
                className="btn btn-primary qml-train-btn"
                disabled={isTraining}
                onClick={handleRunOptimization}
              >
                {isTraining ? '⚡ Optimizing via Autograd...' : '▶ Train & Optimize State'}
              </button>
            </>
          ) : (
            <>
              <div className="sidebar-section">
                <h4>1. Classification Dataset</h4>
                <select
                  value={vqcDataset}
                  onChange={(e) => setVqcDataset(e.target.value)}
                  className="qml-select"
                >
                  <option value="parity">Quantum Parity (XOR Quadrants)</option>
                  <option value="circle">Concentric Decision Circle</option>
                  <option value="half_sphere">Bloch Hemisphere Boundary</option>
                </select>
              </div>

              <div className="sidebar-section">
                <h4>2. Quantum Neural Network Depth</h4>
                <div className="param-row">
                  <label>Strongly Entangling Layers: {vqcLayers}</label>
                  <input
                    type="range"
                    min={1}
                    max={4}
                    step={1}
                    value={vqcLayers}
                    onChange={(e) => setVqcLayers(parseInt(e.target.value))}
                  />
                </div>
                <div className="param-row">
                  <label>Training Epochs: {vqcEpochs}</label>
                  <input
                    type="range"
                    min={10}
                    max={50}
                    step={5}
                    value={vqcEpochs}
                    onChange={(e) => setVqcEpochs(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <button
                className="btn btn-primary qml-train-btn"
                disabled={isTraining}
                onClick={handleRunVqc}
              >
                {isTraining ? '⚡ Training QNN with PennyLane...' : '▶ Train Quantum Classifier'}
              </button>
            </>
          )}
        </aside>

        {/* ─── Right Visualization Area ────────────────────────────────────── */}
        <main className="qml-content-area">
          {activeTask === 'state_fitting' && optResult && (
            <>
              {/* Training Playback Transport */}
              <div className="qml-transport-card">
                <button
                  className="btn btn-xs btn-primary"
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  {isPlaying ? '❚❚ Pause' : '▶ Play Optimization'}
                </button>
                <span className="step-label">
                  Step <b>{currentStepIdx}</b> / {optResult.steps.length - 1}
                </span>
                <input
                  type="range"
                  min={0}
                  max={optResult.steps.length - 1}
                  value={currentStepIdx}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentStepIdx(parseInt(e.target.value));
                  }}
                  className="qml-step-slider"
                />
                <div className="step-metrics">
                  <span>
                    Loss: <b>{currentRecord?.loss.toFixed(5)}</b>
                  </span>
                  <span>
                    Fidelity: <b>{((currentRecord?.fidelity || 0) * 100).toFixed(2)}%</b>
                  </span>
                  <span>
                    ‖∇L‖: <b>{currentRecord?.gradient_norm.toFixed(4)}</b>
                  </span>
                </div>
              </div>

              {/* Visualization Grid: Loss Curve + 3D Bloch Evolution */}
              <div className="qml-viz-grid">
                {/* 1. Loss & Fidelity Convergence Chart */}
                <div className="card qml-chart-card">
                  <div className="card-header">
                    <h4>📉 Loss & Fidelity Convergence (Autograd / Parameter-Shift)</h4>
                    <span className="badge-fidelity">
                      Fidelity: {((optResult.final_fidelity) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="qml-svg-chart-box">
                    <LossConvergenceSvg
                      steps={optResult.steps}
                      currentStep={currentStepIdx}
                    />
                  </div>
                  <div className="chart-legend">
                    <span className="legend-loss">— Infidelity Loss L(θ)</span>
                    <span className="legend-fid">— Fidelity |⟨ψ|ψ(θ)⟩|²</span>
                  </div>
                </div>

                {/* 2. 3D Bloch Dynamics of Variational State */}
                <div className="card panel-bloch-wrapper qml-bloch-card">
                  <StateSummaryStrip
                    stepData={blochStepData}
                    selectedQubit={0}
                    qubitNames={qubitNames}
                    viewMode={numQubits > 1 ? 'grid' : 'focus'}
                    onSelectQubit={() => {}}
                  />
                  <BlochPanel
                    numQubits={numQubits}
                    qubitNames={qubitNames}
                    stepData={blochStepData}
                    selectedQubit={0}
                    viewMode={numQubits > 1 ? 'grid' : 'focus'}
                    onSelectQubit={() => {}}
                  />
                </div>
              </div>

              {/* Parameter Meters Dashboard */}
              <div className="card qml-param-card">
                <h4>Learned Gate Parameters θ at Step {currentStepIdx}</h4>
                <div className="params-meters-grid">
                  {currentRecord?.parameters.map((p, i) => (
                    <div key={i} className="param-meter">
                      <span className="param-name">θ_{i}</span>
                      <div className="param-bar-bg">
                        <div
                          className="param-bar-fill"
                          style={{ width: `${Math.min(100, (Math.abs(p) / (2 * Math.PI)) * 100)}%` }}
                        />
                      </div>
                      <span className="param-val">{p.toFixed(3)} rad</span>
                      <span className="param-deg">{((p * 180) / Math.PI).toFixed(1)}°</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTask === 'vqc_classifier' && vqcResult && (
            <div className="vqc-results-container">
              <div className="card qml-chart-card">
                <div className="card-header">
                  <h4>🤖 Quantum Neural Network Training: {vqcResult.dataset.toUpperCase()} Dataset</h4>
                  <span className="badge-accuracy">
                    Final Accuracy: {(vqcResult.final_accuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="qml-svg-chart-box">
                  <VqcConvergenceSvg history={vqcResult.epoch_history} />
                </div>
                <div className="chart-legend">
                  <span className="legend-loss">— Mean Squared Error</span>
                  <span className="legend-acc">— Classification Accuracy</span>
                </div>
              </div>

              <div className="card qml-param-card">
                <h4>Ansatz Architecture: {vqcResult.circuit_spec}</h4>
                <p className="vqc-desc">
                  Input features are embedded via <code>AngleEmbedding</code> phase rotations into 2 qubits. 
                  The {vqcResult.n_layers}-layer <code>StronglyEntanglingLayers</code> applies universal parameter-shift gates 
                  before measuring ⟨Z₀⟩ for classification.
                </p>
                <div className="params-meters-grid">
                  {vqcResult.learned_weights_summary.map((w, i) => (
                    <div key={i} className="param-meter">
                      <span className="param-name">W_{i}</span>
                      <div className="param-bar-bg">
                        <div
                          className="param-bar-fill"
                          style={{ width: `${Math.min(100, (Math.abs(w) / (2 * Math.PI)) * 100)}%` }}
                        />
                      </div>
                      <span className="param-val">{w.toFixed(3)} rad</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// ─── Loss Convergence SVG Line Chart ─────────────────────────────────────────
function LossConvergenceSvg({
  steps,
  currentStep,
}: {
  steps: { step: number; loss: number; fidelity: number }[];
  currentStep: number;
}) {
  const W = 520;
  const H = 200;
  const pad = 35;

  if (steps.length === 0) return null;

  const maxStep = Math.max(1, steps.length - 1);
  const getX = (s: number) => pad + (s / maxStep) * (W - 2 * pad);
  const getY = (v: number) => H - pad - v * (H - 2 * pad);

  // Loss path points
  const lossPts = steps.map((s) => `${getX(s.step)},${getY(Math.max(0, Math.min(1, s.loss)))}`).join(' ');
  // Fidelity path points
  const fidPts = steps.map((s) => `${getX(s.step)},${getY(Math.max(0, Math.min(1, s.fidelity)))}`).join(' ');

  const curPt = steps[currentStep] || steps[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="qml-svg-chart" style={{ width: '100%', height: '100%' }}>
      {/* Grid lines */}
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#334155" strokeWidth={1} />
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#334155" strokeWidth={1} />
      <line x1={pad} y1={getY(0.5)} x2={W - pad} y2={getY(0.5)} stroke="#1e293b" strokeDasharray="3 3" />
      <line x1={pad} y1={getY(1.0)} x2={W - pad} y2={getY(1.0)} stroke="#1e293b" strokeDasharray="3 3" />

      <text x={pad - 6} y={getY(1.0)} fill="#94a3b8" fontSize="10" textAnchor="end" dominantBaseline="central">
        1.0
      </text>
      <text x={pad - 6} y={getY(0.5)} fill="#94a3b8" fontSize="10" textAnchor="end" dominantBaseline="central">
        0.5
      </text>
      <text x={pad - 6} y={getY(0.0)} fill="#94a3b8" fontSize="10" textAnchor="end" dominantBaseline="central">
        0.0
      </text>

      {/* Curves */}
      <polyline points={lossPts} fill="none" stroke="#f43f5e" strokeWidth={2.5} />
      <polyline points={fidPts} fill="none" stroke="#10b981" strokeWidth={2.5} />

      {/* Current Step Marker */}
      <line
        x1={getX(curPt.step)}
        y1={pad}
        x2={getX(curPt.step)}
        y2={H - pad}
        stroke="#38bdf8"
        strokeWidth={1.5}
        strokeDasharray="2 2"
      />
      <circle cx={getX(curPt.step)} cy={getY(curPt.loss)} r={4} fill="#f43f5e" />
      <circle cx={getX(curPt.step)} cy={getY(curPt.fidelity)} r={4} fill="#10b981" />
    </svg>
  );
}

// ─── VQC Convergence SVG ─────────────────────────────────────────────────────
function VqcConvergenceSvg({ history }: { history: { epoch: number; loss: number; accuracy: number }[] }) {
  const W = 520;
  const H = 200;
  const pad = 35;

  if (history.length === 0) return null;

  const maxEpoch = Math.max(1, history.length);
  const getX = (ep: number) => pad + ((ep - 1) / (maxEpoch - 1)) * (W - 2 * pad);
  const getY = (v: number) => H - pad - v * (H - 2 * pad);

  const lossPts = history.map((h) => `${getX(h.epoch)},${getY(Math.max(0, Math.min(1, h.loss)))}`).join(' ');
  const accPts = history.map((h) => `${getX(h.epoch)},${getY(Math.max(0, Math.min(1, h.accuracy)))}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="qml-svg-chart" style={{ width: '100%', height: '100%' }}>
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="#334155" strokeWidth={1} />
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#334155" strokeWidth={1} />
      <polyline points={lossPts} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
      <polyline points={accPts} fill="none" stroke="#38bdf8" strokeWidth={2.5} />
    </svg>
  );
}

function formatPsiKet(sv: { real: number; imag: number }[]): string {
  if (!sv || sv.length === 0) return '|0⟩';
  const parts: string[] = [];
  const nWires = Math.log2(sv.length) || 1;
  sv.forEach((c, idx) => {
    const mag = Math.sqrt(c.real * c.real + c.imag * c.imag);
    if (mag > 0.05) {
      const bitStr = formatBinary(idx, nWires);
      parts.push(`${mag.toFixed(2)}|${bitStr}⟩`);
    }
  });
  return parts.length > 0 ? parts.join(' + ') : '|0⟩';
}

function formatBinary(val: number, bits: number): string {
  let s = val.toString(2);
  while (s.length < bits) s = '0' + s;
  return s;
}
