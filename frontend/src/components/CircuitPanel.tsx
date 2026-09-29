import React, { useRef, useEffect, useState } from 'react';
import { SimulationPayload } from '../types/simulation';
import {
  BookOpen,
  Zap,
  Layers,
  Binary,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Activity,
  FileText,
  ChevronRight,
  Info,
  Cpu
} from 'lucide-react';

interface CircuitPanelProps {
  simulationData: SimulationPayload | null;
  currentStep: number;
  selectedQubit: number;
  activeGateName: string;
  onSelectQubit: (qIdx: number) => void;
  onSelectStep: (stepIdx: number) => void;
  onGateClick?: (gateName: string, qubits: number[], stepIndex: number) => void;
  onInspectActiveGate?: () => void;
}

const STORAGE_KEY = 'quantum_studio_circuit_viewport_height';
const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 650;

export const CircuitPanel: React.FC<CircuitPanelProps> = ({
  simulationData,
  currentStep,
  selectedQubit,
  activeGateName,
  onSelectQubit,
  onSelectStep,
  onGateClick,
  onInspectActiveGate,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const leftSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeDescTab, setActiveDescTab] = useState<'overview' | 'step' | 'pinout' | 'theory'>('overview');

  const [circuitHeight, setCircuitHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= MIN_HEIGHT && val <= MAX_HEIGHT) {
          return val;
        }
      }
    } catch {
      // fallback
    }
    return DEFAULT_HEIGHT;
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef(0);
  const startHeightRef = useRef(DEFAULT_HEIGHT);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    startHeightRef.current = circuitHeight;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - dragStartYRef.current;
      const nextHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeightRef.current + deltaY));
      setCircuitHeight(nextHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setCircuitHeight((current) => {
        try {
          localStorage.setItem(STORAGE_KEY, current.toString());
        } catch {}
        return current;
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleDoubleClickSplitter = () => {
    setCircuitHeight(DEFAULT_HEIGHT);
    try {
      localStorage.setItem(STORAGE_KEY, DEFAULT_HEIGHT.toString());
    } catch {}
  };

  // ─── Mature Anti-Jitter Camera Tracking ─────────────────────────────────
  // Maintains static index position, avoids constant back-and-forth shaking,
  // and only smoothly pans when the playhead approaches the viewport margins.
  useEffect(() => {
    if (!viewportRef.current || currentStep < 0) return;

    const el = viewportRef.current;
    const clientWidth = el.clientWidth;
    const scrollWidth = el.scrollWidth;

    // 1. If entire circuit fits in visible area (e.g. Fredkin 17 steps), DO NOT SCROLL AT ALL!
    if (scrollWidth <= clientWidth + 10) {
      if (el.scrollLeft !== 0) {
        el.scrollTo({ left: 0, behavior: 'instant' as ScrollBehavior });
      }
      return;
    }

    if (currentStep === 0) {
      el.scrollTo({ left: 0, behavior: 'smooth' });
      return;
    }

    const startX = 20;
    const colWidth = 36;
    const activeX = startX + (currentStep - 1) * colWidth + colWidth / 2;

    const currentScroll = el.scrollLeft;
    const visibleLeft = currentScroll;
    const visibleRight = currentScroll + clientWidth;

    // Comfortable margin buffer zones
    const leftMargin = 80;
    const rightMargin = 140;

    if (activeX > visibleRight - rightMargin) {
      // Pan forward smoothly so the active gate is at ~1/3 of the viewport
      const targetScroll = Math.min(scrollWidth - clientWidth, activeX - clientWidth / 3);
      el.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    } else if (activeX < visibleLeft + leftMargin) {
      // Pan backward smoothly
      const targetScroll = Math.max(0, activeX - clientWidth / 2);
      el.scrollTo({ left: targetScroll, behavior: 'smooth' });
    }
    // If activeX is within [visibleLeft + leftMargin, visibleRight - rightMargin],
    // DO NOTHING! Cursor glides smoothly across static gates with ZERO jitter!
  }, [currentStep]);

  const getStandaloneSVGString = (): string => {
    if (!svgRef.current) return '';
    const gatesWidth = svgRef.current.clientWidth || 800;
    const fullWidth = 88 + gatesWidth;
    const fullHeight = svgRef.current.clientHeight || 400;

    const styleBlock = `
      .circuit-svg { background: #04060b; font-family: monospace; }
      .svg-wire { stroke: #26334d; stroke-width: 1.5; }
      .svg-wire.selected { stroke: #38bdf8; stroke-width: 2.5; }
      .svg-qubit-lbl { font-size: 10px; font-weight: 600; fill: #94a3b8; font-family: system-ui, sans-serif; }
      .svg-qubit-lbl.selected { fill: #38bdf8; font-weight: 700; }
      .svg-init-state { font-size: 9px; font-family: monospace; fill: #34d399; font-weight: 600; }
      .svg-gate-box { fill: #172136; stroke: #3b82f6; stroke-width: 1.2; rx: 4px; }
      .svg-gate-text { font-size: 9px; font-weight: 700; fill: #f8fafc; text-anchor: middle; dominant-baseline: central; font-family: monospace; }
      .svg-ctrl-dot { fill: #38bdf8; stroke: #0284c7; stroke-width: 1; }
      .svg-target-circle { fill: #080d1a; stroke: #38bdf8; stroke-width: 1.5; }
      .svg-target-plus { stroke: #38bdf8; stroke-width: 1.5; }
      .svg-ctrl-line { stroke: #38bdf8; stroke-width: 1.5; }
      .svg-step-num { font-size: 8px; fill: #64748b; text-anchor: middle; font-family: monospace; }
      .svg-step-num.active { fill: #38bdf8; font-weight: bold; }
      .svg-active-cursor-bg { fill: rgba(56, 189, 248, 0.08); rx: 4px; }
      .svg-active-line { stroke: #38bdf8; stroke-width: 1.5; stroke-dasharray: 2 2; }
    `;

    const leftContent = leftSvgRef.current ? leftSvgRef.current.innerHTML : '';
    const rightContent = svgRef.current.innerHTML;

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${fullWidth}" height="${fullHeight}" viewBox="0 0 ${fullWidth} ${fullHeight}" class="circuit-svg">
        <style>${styleBlock}</style>
        <rect width="100%" height="100%" fill="#04060b" />
        <g id="pinned-qubit-labels">
          ${leftContent}
        </g>
        <g id="circuit-gates" transform="translate(88, 0)">
          ${rightContent}
        </g>
      </svg>
    `.trim();
  };

  const handleExportSVG = () => {
    const svgStr = getStandaloneSVGString();
    if (!svgStr) return;
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = (simulationData?.circuit_name || 'quantum_circuit').toLowerCase().replace(/\s+/g, '_');
    a.download = `${name}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = () => {
    const svgStr = getStandaloneSVGString();
    if (!svgStr || !svgRef.current) return;

    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement('canvas');
      const w = svgRef.current?.clientWidth || 800;
      const h = svgRef.current?.clientHeight || 400;
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#04060b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngUrl;
      const name = (simulationData?.circuit_name || 'quantum_circuit').toLowerCase().replace(/\s+/g, '_');
      a.download = `${name}.png`;
      a.click();
    };
    img.src = url;
  };

  const handleExportJSON = () => {
    if (!simulationData) return;
    const jsonStr = JSON.stringify(simulationData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = (simulationData?.circuit_name || 'quantum_circuit').toLowerCase().replace(/\s+/g, '_');
    a.download = `${name}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!simulationData || !simulationData.primitive_gates) {
    return (
      <article className="card panel-circuit">
        <div className="card-header">
          <h3>⚡ Circuit Wire & Logical Operation Highlight</h3>
          <span className="badge-gate">INIT</span>
        </div>
        <div className="circuit-viewport">Loading circuit schematic...</div>
      </article>
    );
  }

  const numQubits = simulationData.num_qubits;
  const gates = simulationData.primitive_gates;
  const logicalOps = simulationData.logical_operations || [];
  const totalSteps = simulationData.total_primitive_steps;

  const rowHeight = 28;
  const colWidth = 36;
  const startX = 20;
  const startY = 32;

  const gatesSvgWidth = startX + totalSteps * colWidth + 40;
  const svgHeight = startY + numQubits * rowHeight + 15;

  return (
    <article className="card panel-circuit">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          <h3>⚡ Circuit Wire & Logical Operation Highlight</h3>
          <span
            className="badge-gate"
            onClick={onInspectActiveGate}
            style={{ cursor: onInspectActiveGate ? 'pointer' : 'default' }}
            title={onInspectActiveGate ? "Click to inspect gate unitary & details (or double-click any gate below)" : undefined}
          >
            {activeGateName} {onInspectActiveGate && activeGateName !== 'INIT' ? '🔍' : ''}
          </span>
        </div>

        {/* Circuit Export Button Group */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: '0.62rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Export:
          </span>
          <button
            className="btn-xs"
            onClick={handleExportSVG}
            title="Download scalable vector graphic (.svg) for LaTeX/paper figures"
          >
            SVG
          </button>
          <button
            className="btn-xs"
            onClick={handleExportPNG}
            title="Download high-resolution image (.png) at 2x DPI"
          >
            PNG
          </button>
          <button
            className="btn-xs"
            onClick={handleExportJSON}
            title="Download circuit simulation payload (.json) for data analysis"
          >
            JSON
          </button>
        </div>
      </div>

      {/* ─── Circuit Canvas Viewport (Fixed Pinned Rail + Scrolling Track) ─── */}
      <div
        className="circuit-viewport-wrapper"
        style={{ height: `${circuitHeight}px` }}
      >
        {/* Stationary / Pinned Qubit Header (Left Rail) */}
        <div className="circuit-pinned-left">
          <svg ref={leftSvgRef} width={88} height={svgHeight} xmlns="http://www.w3.org/2000/svg">
            <text x={8} y={18} fontSize="8.5px" fontWeight="700" fill="#64748b" letterSpacing="0.05em">
              WIRE
            </text>
            <text x={50} y={18} fontSize="8.5px" fontWeight="700" fill="#64748b" letterSpacing="0.05em">
              INIT
            </text>

            {Array.from({ length: numQubits }).map((_, q) => {
              const wireY = startY + q * rowHeight + rowHeight / 2;
              const qName = simulationData.qubit_names[q] ? simulationData.qubit_names[q].split(' ')[0] : `Q${q}`;
              const bitVal = simulationData.input_bits[q];
              const isSel = q === selectedQubit;

              return (
                <g key={q} onClick={() => onSelectQubit(q)} style={{ cursor: 'pointer' }}>
                  {isSel && (
                    <rect
                      x={2}
                      y={startY + q * rowHeight + 2}
                      width={84}
                      height={rowHeight - 4}
                      fill="rgba(56, 189, 248, 0.12)"
                      rx={3}
                    />
                  )}
                  <text
                    x={8}
                    y={wireY}
                    className={`svg-qubit-lbl ${isSel ? 'selected' : ''}`}
                    dominantBaseline="central"
                  >
                    {qName}
                  </text>
                  <text x={50} y={wireY} className="svg-init-state" dominantBaseline="central">
                    |{bitVal}⟩
                  </text>
                  {/* Seamless connecting wire stub into right track */}
                  <line
                    x1={72}
                    y1={wireY}
                    x2={88}
                    y2={wireY}
                    className={`svg-wire ${isSel ? 'selected' : ''}`}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Smooth Scrolling Right Track (Gates & Execution Cursor) */}
        <div
          className="circuit-viewport"
          ref={viewportRef}
        >
          <svg ref={svgRef} className="circuit-svg" width={gatesSvgWidth} height={svgHeight} xmlns="http://www.w3.org/2000/svg">
            {/* Logical Operation Background Blocks */}
            {logicalOps.map((op) => {
              const startColX = startX + (op.primitive_start - 1) * colWidth;
              const width = (op.primitive_end - op.primitive_start + 1) * colWidth;
              const opacity = op.op_id % 2 === 1 ? 0.04 : 0.08;
              return (
                <g key={op.op_id}>
                  <rect
                    x={startColX}
                    y={startY - 22}
                    width={width}
                    height={numQubits * rowHeight + 26}
                    fill="#38bdf8"
                    opacity={opacity}
                    rx={4}
                  />
                  <text
                    x={startColX + width / 2}
                    y={10}
                    fontSize="8.5px"
                    fontWeight="600"
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {op.name.split(' ')[0]}
                  </text>
                </g>
              );
            })}

            {/* Continuous Qubit Wires */}
            {Array.from({ length: numQubits }).map((_, q) => {
              const wireY = startY + q * rowHeight + rowHeight / 2;
              const isSel = q === selectedQubit;
              return (
                <line
                  key={q}
                  x1={0}
                  y1={wireY}
                  x2={gatesSvgWidth - 15}
                  y2={wireY}
                  className={`svg-wire ${isSel ? 'selected' : ''}`}
                  onClick={() => onSelectQubit(q)}
                  style={{ cursor: 'pointer' }}
                />
              );
            })}

            {/* Active Step Cursor */}
            {currentStep > 0 && (
              <g>
                <rect
                  x={startX + (currentStep - 1) * colWidth}
                  y={startY - 4}
                  width={colWidth}
                  height={numQubits * rowHeight + 8}
                  className="svg-active-cursor-bg"
                />
                <line
                  x1={startX + (currentStep - 1) * colWidth + colWidth / 2}
                  y1={startY - 4}
                  x2={startX + (currentStep - 1) * colWidth + colWidth / 2}
                  y2={startY - 4 + numQubits * rowHeight + 8}
                  className="svg-active-line"
                />
              </g>
            )}

            {/* Gates */}
            {gates.map((g) => {
              const stepNum = g.step_index;
              const colX = startX + (stepNum - 1) * colWidth + colWidth / 2;
              const isSelected = stepNum === currentStep;

              return (
                <g
                  key={stepNum}
                  onClick={() => onSelectStep(stepNum)}
                  onDoubleClick={() => onGateClick?.(g.name, g.qubits, stepNum)}
                  style={{ cursor: 'pointer' }}
                >
                  <text x={colX} y={22} className={`svg-step-num ${isSelected ? 'active' : ''}`}>
                    {stepNum}
                  </text>

                  {g.name === 'CX' && g.qubits.length === 2 ? (
                    (() => {
                      const cY = startY + g.qubits[0] * rowHeight + rowHeight / 2;
                      const tY = startY + g.qubits[1] * rowHeight + rowHeight / 2;
                      return (
                        <g>
                           <title>{g.name} — double-click for info</title>
                          <line x1={colX} y1={cY} x2={colX} y2={tY} className="svg-ctrl-line" />
                          <circle cx={colX} cy={cY} r={4} className="svg-ctrl-dot" />
                          <circle cx={colX} cy={tY} r={7} className="svg-target-circle" />
                          <line x1={colX - 4} y1={tY} x2={colX + 4} y2={tY} className="svg-target-plus" />
                          <line x1={colX} y1={tY - 4} x2={colX} y2={tY + 4} className="svg-target-plus" />
                        </g>
                      );
                    })()
                  ) : (
                    g.qubits.map((q) => {
                      const gY = startY + q * rowHeight + rowHeight / 2;
                      const boxW = 22;
                      const boxH = 22;
                      return (
                        <g key={q}>
                          <title>{g.name} on {simulationData?.qubit_names?.[q] ?? `Q${q}`} — double-click for info</title>
                          <rect
                            x={colX - boxW / 2}
                            y={gY - boxH / 2}
                            width={boxW}
                            height={boxH}
                            className="svg-gate-box"
                          />
                          <text x={colX} y={gY} className="svg-gate-text">
                            {g.name}
                          </text>
                        </g>
                      );
                    })
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* ─── Resizable Splitter Handle (Persisted across refreshes) ─────────── */}
      <div
        className={`circuit-splitter-handle ${isDragging ? 'dragging' : ''}`}
        onMouseDown={handleSplitterMouseDown}
        onDoubleClick={handleDoubleClickSplitter}
        title="Drag up or down to resize circuit diagram and description panels (Double-click to reset to default)"
      >
        <div className="circuit-splitter-grip" />
      </div>

      {/* ─── Circuit Architectural Theory & Description Subpanel (Lower Half) ─── */}
      <div className="circuit-desc-panel">
        {/* Navigation Tabs */}
        <div className="circuit-desc-nav">
          <button
            className={`circuit-desc-tab-btn ${activeDescTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveDescTab('overview')}
            title="Circuit architecture, paper citation, and logical stage pipeline"
          >
            <BookOpen size={13} />
            <span>Architecture & Theory</span>
          </button>
          <button
            className={`circuit-desc-tab-btn ${activeDescTab === 'step' ? 'active' : ''}`}
            onClick={() => setActiveDescTab('step')}
            title="Inspect active gate transformation, physics, and state ket"
          >
            <Zap size={13} />
            <span>Active Step Action</span>
          </button>
          <button
            className={`circuit-desc-tab-btn ${activeDescTab === 'pinout' ? 'active' : ''}`}
            onClick={() => setActiveDescTab('pinout')}
            title="Interactive qubit wire pinout and signal definitions"
          >
            <Binary size={13} />
            <span>Qubit Pinout & Signals</span>
          </button>
          <button
            className={`circuit-desc-tab-btn ${activeDescTab === 'theory' ? 'active' : ''}`}
            onClick={() => setActiveDescTab('theory')}
            title="Mathematical specifications, ALU truth equations, and parity invariance"
          >
            <Sparkles size={13} />
            <span>Formulas & Math</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="circuit-desc-content">
          {/* TAB 1: ARCHITECTURE & OVERVIEW */}
          {activeDescTab === 'overview' && (() => {
            const arch = getCircuitArchitectureOverview(simulationData.circuit_name);
            const activeOp = logicalOps.find(
              (op) => currentStep >= op.primitive_start && currentStep <= op.primitive_end
            );

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Header Banner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                        {arch.title}
                      </span>
                      <span style={{
                        fontSize: '0.62rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                      }}>
                        {arch.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 2 }}>
                      {arch.subtitle}
                    </div>
                  </div>

                  {/* Parity Status Badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 8px',
                    borderRadius: 4,
                    background: simulationData.parity_preserved ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    border: `1px solid ${simulationData.parity_preserved ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                  }}>
                    <ShieldCheck size={13} color={simulationData.parity_preserved ? '#10b981' : '#f59e0b'} />
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      color: simulationData.parity_preserved ? '#10b981' : '#f59e0b',
                    }}>
                      {simulationData.parity_preserved
                        ? `Parity Preserved (P_in=${simulationData.p_in} ≡ P_out=${simulationData.p_out})`
                        : `Parity Alert (P_in=${simulationData.p_in} ≠ P_out=${simulationData.p_out})`}
                    </span>
                  </div>
                </div>

                {/* Synthesis Metrics Chips */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(85px, 1fr))',
                  gap: 6,
                }}>
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--card-border)', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Quantum Cost</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
                      {simulationData.metrics?.quantum_cost ?? '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--card-border)', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>T-Count</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
                      {simulationData.metrics?.t_count ?? '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--card-border)', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>T-Depth</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#ec4899', fontFamily: 'var(--font-mono)' }}>
                      {simulationData.metrics?.t_depth ?? '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--card-border)', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Gates</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
                      {simulationData.metrics?.num_gates ?? '—'}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--card-border)', borderRadius: 5, padding: '5px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Wires</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a855f7', fontFamily: 'var(--font-mono)' }}>
                      {numQubits} Qubits
                    </div>
                  </div>
                </div>

                {/* Architecture Executive Summary */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: '0.72rem',
                  lineHeight: '1.45',
                  color: '#cbd5e1',
                }}>
                  <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Cpu size={12} />
                    <span>Architectural Synthesis & Decomposition</span>
                  </div>
                  <p style={{ margin: 0, color: '#94a3b8' }}>
                    {arch.summary}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6, marginTop: 8 }}>
                    {arch.highlights.map((h, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, background: 'rgba(2, 6, 23, 0.5)', padding: '5px 7px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                        <CheckCircle2 size={12} color="#38bdf8" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.66rem', fontWeight: 600, color: '#e2e8f0' }}>{h.label}</div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', lineHeight: 1.3 }}>{h.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logical Operations Execution Timeline */}
                {logicalOps.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Layers size={11} color="#38bdf8" />
                      <span>Logical Operation Stages (Click stage to seek step)</span>
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                      gap: 6,
                    }}>
                      {logicalOps.map((op) => {
                        const isCurrent = currentStep >= op.primitive_start && currentStep <= op.primitive_end;
                        return (
                          <div
                            key={op.op_id}
                            onClick={() => onSelectStep(op.primitive_start)}
                            style={{
                              background: isCurrent ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.4)',
                              border: `1px solid ${isCurrent ? '#38bdf8' : 'var(--card-border)'}`,
                              borderRadius: 5,
                              padding: '5px 8px',
                              cursor: 'pointer',
                              boxShadow: isCurrent ? '0 0 8px rgba(56, 189, 248, 0.3)' : 'none',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isCurrent ? '#38bdf8' : '#e2e8f0' }}>
                                Stage {op.op_id}
                              </span>
                              {isCurrent && (
                                <span style={{
                                  fontSize: '0.55rem',
                                  fontWeight: 700,
                                  background: '#38bdf8',
                                  color: '#080d1a',
                                  padding: '0 4px',
                                  borderRadius: 3,
                                }}>
                                  RUNNING
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.64rem', color: '#94a3b8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {op.name}
                            </div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b', marginTop: 2 }}>
                              Steps {op.primitive_start}–{op.primitive_end} ({op.num_primitive_gates} gates)
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* TAB 2: ACTIVE STEP ACTION */}
          {activeDescTab === 'step' && (() => {
            const stepData = simulationData.steps?.[currentStep] || simulationData.steps?.[0];
            const gate = stepData?.gate;
            const gateInfo = getGateInfo(activeGateName);
            const activeOp = logicalOps.find(
              (op) => currentStep >= op.primitive_start && currentStep <= op.primitive_end
            );

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Step Banner */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(15, 23, 42, 0.7)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 6,
                  padding: '8px 12px',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      background: gateInfo.color,
                      color: '#04060b',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono)',
                    }}>
                      {activeGateName}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc' }}>
                        {gateInfo.label}
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>
                        Primitive Step {currentStep} of {totalSteps} {activeOp ? `• ${activeOp.name}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>TARGET WIRES:</span>
                    {gate?.qubits?.map((q) => (
                      <span
                        key={q}
                        onClick={() => onSelectQubit(q)}
                        style={{
                          fontSize: '0.64rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 3,
                          background: q === selectedQubit ? '#38bdf8' : 'rgba(56, 189, 248, 0.15)',
                          color: q === selectedQubit ? '#04060b' : '#38bdf8',
                          cursor: 'pointer',
                        }}
                      >
                        Q{q} ({simulationData.qubit_names[q]?.split(' ')[0] || `Q${q}`})
                      </span>
                    )) || <span style={{ fontSize: '0.64rem', color: '#64748b' }}>All (Register Init)</span>}
                  </div>
                </div>

                {/* Transformation Details Card */}
                <div style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(51, 65, 85, 0.4)', paddingBottom: 4 }}>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                      Quantum Operator & Transformation Physics
                    </span>
                    <span style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                      {gateInfo.type}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.68rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                    {gateInfo.desc}
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    marginTop: 4,
                  }}>
                    <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: '5px 8px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Unitary Operator Representation</div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {gateInfo.matrix}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: '5px 8px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                      <div style={{ fontSize: '0.58rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Fault-Tolerant Overhead Cost</div>
                      <div style={{ fontSize: '0.66rem', fontWeight: 600, color: '#f97316', marginTop: 2 }}>
                        {gateInfo.cost}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instantaneous State Ket Vector */}
                <div style={{
                  background: 'rgba(2, 6, 23, 0.7)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 6,
                  padding: '8px 10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      Current State Vector |ψ⟩ at Step {currentStep}
                    </span>
                    <span style={{ fontSize: '0.62rem', color: '#10b981', fontWeight: 600 }}>
                      Fidelity: {((stepData?.unitary_fidelity ?? 1) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.74rem',
                    color: '#38bdf8',
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '6px 8px',
                    borderRadius: 4,
                    border: '1px solid rgba(56, 189, 248, 0.2)',
                    wordBreak: 'break-all',
                  }}>
                    {stepData?.psi_ket || '|0000000⟩'}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* TAB 3: QUBIT PINOUT & SIGNALS */}
          {activeDescTab === 'pinout' && (() => {
            const stepData = simulationData.steps?.[currentStep] || simulationData.steps?.[0];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Interactive Qubit Signal Mapping (Click row to focus wire & 3D Bloch sphere)</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{numQubits} Qubits Total</span>
                </div>

                <div style={{
                  border: '1px solid var(--card-border)',
                  borderRadius: 6,
                  overflow: 'hidden',
                  background: 'rgba(15, 23, 42, 0.4)',
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.66rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--card-border)', color: '#64748b' }}>
                        <th style={{ padding: '6px 8px' }}>Wire</th>
                        <th style={{ padding: '6px 8px' }}>Signal / Port</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Input</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Current ⟨Z⟩</th>
                        <th style={{ padding: '6px 8px', textAlign: 'center' }}>Output</th>
                        <th style={{ padding: '6px 8px' }}>Architectural Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: numQubits }).map((_, q) => {
                        const qName = simulationData.qubit_names[q] || `Q${q}`;
                        const inBit = simulationData.input_bits[q];
                        const outBit = simulationData.output_bits[q];
                        const bVec = stepData?.bloch_vectors?.[q];
                        const zExp = bVec ? bVec.z.toFixed(2) : (inBit === 1 ? '-1.00' : '1.00');
                        const role = getQubitRole(q, qName);
                        const isSelected = q === selectedQubit;

                        return (
                          <tr
                            key={q}
                            onClick={() => onSelectQubit(q)}
                            style={{
                              borderBottom: '1px solid rgba(51, 65, 85, 0.25)',
                              background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.1s ease',
                            }}
                          >
                            <td style={{ padding: '5px 8px', fontWeight: 700, color: isSelected ? '#38bdf8' : '#cbd5e1' }}>
                              <span style={{
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: isSelected ? '#38bdf8' : 'rgba(51, 65, 85, 0.5)',
                                color: isSelected ? '#04060b' : '#f8fafc',
                                fontFamily: 'var(--font-mono)',
                              }}>
                                Q{q}
                              </span>
                            </td>
                            <td style={{ padding: '5px 8px', fontWeight: 600, color: '#f8fafc' }}>
                              {qName}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: inBit === 1 ? '#38bdf8' : '#94a3b8' }}>
                              |{inBit}⟩
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#34d399' }}>
                              {zExp}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: outBit === 1 ? '#38bdf8' : '#94a3b8' }}>
                              |{outBit}⟩
                            </td>
                            <td style={{ padding: '5px 8px' }}>
                              <span style={{
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                padding: '1px 6px',
                                borderRadius: 3,
                                background: `${role.color}20`,
                                color: role.color,
                                border: `1px solid ${role.color}40`,
                              }}>
                                {role.role}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* TAB 4: MATHEMATICAL SPECIFICATIONS */}
          {activeDescTab === 'theory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Arithmetic & Logic Equations */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--card-border)',
                borderRadius: 6,
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#38bdf8', marginBottom: 4 }}>
                  📐 Arithmetic & Logic Reversible Equations
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
                  <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600 }}>Full Adder Mode</div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#e2e8f0', marginTop: 2 }}>
                      Sum = A ⊕ B ⊕ Cin
                    </div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', marginTop: 1 }}>
                      Cout = AB ⊕ Cin(A ⊕ B)
                    </div>
                  </div>
                  <div style={{ background: 'rgba(2, 6, 23, 0.6)', padding: '6px 8px', borderRadius: 4, border: '1px solid rgba(51, 65, 85, 0.3)' }}>
                    <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 600 }}>Full Subtractor Mode</div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#e2e8f0', marginTop: 2 }}>
                      Diff = A ⊕ B ⊕ Bin
                    </div>
                    <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: '#94a3b8', marginTop: 1 }}>
                      Bout = ĀB ⊕ Bin(Ā ⊕ B̄)
                    </div>
                  </div>
                </div>
              </div>

              {/* Parity Invariance & Fault Detection */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--card-border)',
                borderRadius: 6,
                padding: '8px 10px',
              }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#10b981', marginBottom: 4 }}>
                  🛡️ Parity Preservation Invariant Theorem
                </div>
                <div style={{ fontSize: '0.66rem', color: '#cbd5e1', lineHeight: 1.4 }}>
                  A reversible circuit is defined as <em>Parity Preserving</em> if and only if:
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  color: '#34d399',
                  background: 'rgba(2, 6, 23, 0.7)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  margin: '4px 0',
                  textAlign: 'center',
                }}>
                  P_in = ⨁(i=0 to n-1) Q_i^(in) ≡ P_out = ⨁(i=0 to n-1) Q_i^(out) (mod 2)
                </div>
                <div style={{ fontSize: '0.64rem', color: '#94a3b8', lineHeight: 1.3 }}>
                  Physical Significance: Any single-event quantum bit-flip error (Pauli-X) occurring along any wire during execution inverts the output parity, providing 100% concurrent fault detectability without collapsing quantum superposition states.
                </div>
              </div>

              {/* Fault-Tolerant Clifford+T & Landauer Limit */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 6,
              }}>
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#f59e0b' }}>
                    ⚡ Clifford+T Fault-Tolerance
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2, lineHeight: 1.35 }}>
                    Clifford gates {`{H, S, CX}`} are transversal in CSS codes (fault-tolerant with zero overhead). Non-Clifford T-gates require magic state distillation (Bravyi-Kitaev protocol). Minimizing T-depth directly minimizes physical qubit and time budgets.
                  </div>
                </div>
                <div style={{ background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '6px 8px' }}>
                  <div style={{ fontSize: '0.64rem', fontWeight: 700, color: '#a855f7' }}>
                    ❄️ Landauer Reversibility Limit
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginTop: 2, lineHeight: 1.35 }}>
                    Irreversible bit erasure dissipates kT ln(2) heat. By synthesizing a bijective transformation with zero ancilla garbage accumulation, the theoretical entropy loss ΔS = 0, achieving near-zero heat dissipation in superconducting quantum circuits.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

/* ─── Architectural Knowledge Helpers ───────────────────────────────────── */
function getCircuitArchitectureOverview(name?: string) {
  const cName = (name || '').toLowerCase();
  if (cName.includes('alu') || cName.includes('1_bit') || cName.includes('1-bit')) {
    return {
      title: 'Fault-Tolerant Clifford+T Reversible ALU',
      subtitle: 'Universal 1-Bit Arithmetic Logic Unit with Parity Invariance',
      badge: 'IEEE TETC 2026 Core',
      summary: 'State-of-the-art fault-tolerant reversible ALU architecture integrating a 5×5 Fault-Tolerant Full Adder/Subtractor Gate (FALFG) as its central arithmetic engine, cascading into three conservative Fredkin (CSWAP) multiplexer stages to synthesize 28 arithmetic and logic operations.',
      highlights: [
        { label: 'Arithmetic Engine', desc: '5×5 FALFG computing Full Adder / Full Subtractor outputs simultaneously' },
        { label: 'Multiplexer Network', desc: '3 Cascaded Fredkin (CSWAP) stages performing control routing with zero data loss' },
        { label: 'Synthesis Basis', desc: 'Strictly Clifford+T (H, S, T, T†, CX) ensuring compatibility with CSS fault-tolerant codes' },
        { label: 'Parity Invariance', desc: 'Guaranteed P_in ≡ P_out (mod 2) across all 28 functions for concurrent error detection' },
      ],
    };
  }
  if (cName.includes('falfg')) {
    return {
      title: '5×5 Universal FALFG Core Gate',
      subtitle: 'Fault-Tolerant Reversible Full Adder & Subtractor',
      badge: 'IEEE TETC 2026 Primary Unit',
      summary: 'The Fault-Tolerant Reversible Full Adder/Subtractor Gate (FALFG) is a universal 5-qubit reversible gate designed to compute both Full Adder (Sum, Cout) and Full Subtractor (Difference, Bout) functions with bit-level parity invariance.',
      highlights: [
        { label: 'Parity Preserving', desc: 'Maintains identical input and output parity (P_in = P_out) without auxiliary parity bits' },
        { label: 'Clifford+T Decomposition', desc: 'Optimized decomposition achieving T-count of 28 and T-depth of 14' },
        { label: 'Zero Ancilla Leaks', desc: 'No uncomputed quantum scratchpad states, enabling seamless cascading in multi-bit ALUs' },
      ],
    };
  }
  if (cName.includes('fredkin') || cName.includes('cswap')) {
    return {
      title: 'Conservative Fredkin (CSWAP) Gate',
      subtitle: 'Controlled-SWAP Reversible Multiplexer Core',
      badge: 'Conservative Logic',
      summary: 'The Fredkin gate is a fundamental 3-qubit conservative reversible logic gate. It leaves the control qubit unchanged while swapping the target qubits if and only if the control qubit is |1⟩. It strictly preserves Hamming weight and parity.',
      highlights: [
        { label: 'Hamming Weight Conservation', desc: 'Conserves total number of 1s: W(A,B,C) = W(P,Q,R)' },
        { label: 'Fault-Tolerant T-Count', desc: 'Decomposed into 7 T/T† gates and 8 CNOTs (optimal Clifford+T synthesis)' },
        { label: 'Universal Routing', desc: 'Acts as a quantum-coherent 2-to-1 multiplexer for quantum state registers' },
      ],
    };
  }
  if (cName.includes('bennett')) {
    return {
      title: 'Bennett Reversible Adder with Uncomputation',
      subtitle: 'Garbage-Free Quantum Computing Paradigm',
      badge: 'Bennett Paradigm',
      summary: 'Demonstrates Charles Bennett’s seminal 1973 reversible computation theorem: any irreversible computation can be made reversible with zero net thermodynamic entropy dissipation by computing the result, copying it, and uncomputing intermediate states.',
      highlights: [
        { label: 'Garbage Free', desc: 'Clears ancilla wires back to |0⟩ via reversed adjoint operations' },
        { label: 'Zero Landauer Loss', desc: 'Prevents kT ln(2) energy loss per erased bit' },
        { label: 'Clifford+T Compliant', desc: 'All primitive steps compiled to fault-tolerant universal gates' },
      ],
    };
  }
  return {
    title: name || 'Quantum Reversible Circuit',
    subtitle: 'Clifford+T Fault-Tolerant Synthesis',
    badge: 'Reversible Logic',
    summary: 'Universal quantum reversible circuit compiled into fault-tolerant Clifford+T primitive gates with parity preservation verification.',
    highlights: [
      { label: 'Fault-Tolerant Basis', desc: 'Clifford+T decomposition compatible with CSS error-correcting codes' },
      { label: 'Parity Checked', desc: 'Monitors P_in ≡ P_out for concurrent quantum fault detection' },
    ],
  };
}

function getGateInfo(gateName: string) {
  switch (gateName) {
    case 'T':
      return {
        label: 'T-Gate (π/8 Gate)',
        type: 'Non-Clifford Phase Rotation',
        matrix: 'diag(1, e^{iπ/4})',
        desc: 'Non-Clifford gate essential for universal quantum computation. In fault-tolerant architectures, T-gates cannot be implemented transversally and require Magic State Distillation (Bravyi-Kitaev protocol).',
        cost: 'T-depth +1, Magic State Distillation Required',
        color: '#f59e0b',
      };
    case 'Tdg':
      return {
        label: 'T† Gate (Adjoint T)',
        type: 'Non-Clifford Phase Rotation (-π/4)',
        matrix: 'diag(1, e^{-iπ/4})',
        desc: 'Adjoint of T-gate. Rotates state by -π/4 around Z-axis. Synthesized using distilled magic states for fault-tolerant phase cancellation.',
        cost: 'T-depth +1, Magic State Distillation Required',
        color: '#f97316',
      };
    case 'H':
      return {
        label: 'Hadamard Gate',
        type: 'Clifford Basis Changer',
        matrix: '1/√2 [[1, 1], [1, -1]]',
        desc: 'Creates balanced quantum superposition between computational basis states |0⟩ and |1⟩. Transversal and fault-tolerant in CSS quantum error-correcting codes.',
        cost: 'Clifford (Fault-Tolerant, zero T-cost)',
        color: '#06b6d4',
      };
    case 'CX':
      return {
        label: 'Controlled-NOT (CX / CNOT)',
        type: 'Clifford 2-Qubit Entangler',
        matrix: '|0⟩⟨0|⊗I + |1⟩⟨1|⊗X',
        desc: 'Entangles control and target qubits. In reversible logic, maps |c, t⟩ ↦ |c, c ⊕ t⟩, performing modulo-2 addition (XOR) while preserving bitwise parity.',
        cost: 'Clifford 2-Qubit (Transversal in CSS codes)',
        color: '#3b82f6',
      };
    case 'S':
      return {
        label: 'S-Gate (Phase Gate)',
        type: 'Clifford Phase Shift (π/2)',
        matrix: 'diag(1, i)',
        desc: 'Generates a 90° phase rotation around the Z-axis. Corresponds to T², fully fault-tolerant in Clifford group.',
        cost: 'Clifford (Zero T-cost)',
        color: '#8b5cf6',
      };
    case 'Sdg':
      return {
        label: 'S† Gate (Adjoint S)',
        type: 'Clifford Phase Shift (-π/2)',
        matrix: 'diag(1, -i)',
        desc: 'Generates a -90° phase rotation around the Z-axis. Clifford-group fault-tolerant operation.',
        cost: 'Clifford (Zero T-cost)',
        color: '#a855f7',
      };
    case 'X':
      return {
        label: 'Pauli-X (NOT Gate)',
        type: 'Clifford Bit Flip',
        matrix: '[[0, 1], [1, 0]]',
        desc: 'Performs unconditional bit flip |0⟩ ↔ |1⟩ on the target qubit. Zero T-cost.',
        cost: 'Clifford Single-Qubit',
        color: '#ef4444',
      };
    case 'INIT':
      return {
        label: 'Initial State Vector',
        type: 'Quantum Register Preparation',
        matrix: '|ψ₀⟩ = ⊗|qᵢ⟩',
        desc: 'Register initialized to the computational basis state defined by the input stimulus vector.',
        cost: 'Initialization',
        color: '#10b981',
      };
    default:
      return {
        label: `${gateName} Gate`,
        type: 'Quantum Logic Gate',
        matrix: 'Unitary Operator U',
        desc: 'Primitive quantum gate operating on target qubit register.',
        cost: 'Primitive Step',
        color: '#38bdf8',
      };
  }
}

function getQubitRole(qIdx: number, qName: string) {
  const lowerName = qName.toLowerCase();
  if (lowerName.includes('sum') || lowerName.includes('result') || lowerName.includes('diff') || lowerName.includes('out')) {
    return { role: 'ALU Output / Result', color: '#38bdf8' };
  }
  if (lowerName.includes('cout') || lowerName.includes('bout') || lowerName.includes('carry')) {
    return { role: 'Carry / Borrow Out', color: '#06b6d4' };
  }
  if (lowerName.includes('ctrl') || lowerName.includes('sel') || lowerName.includes('s0') || lowerName.includes('s1') || lowerName.includes('s2') || lowerName.includes('cin')) {
    return { role: 'Control / Select Line', color: '#f59e0b' };
  }
  if (lowerName.includes('garbage') || lowerName.includes('ancilla') || lowerName.includes('g1') || lowerName.includes('g2')) {
    return { role: 'Reversible Ancilla', color: '#64748b' };
  }
  return { role: 'Operand Input Wire', color: '#10b981' };
}

