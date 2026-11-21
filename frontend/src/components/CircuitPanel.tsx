import React, { useRef, useEffect, useState } from 'react';
import { SimulationPayload } from '../types/simulation';
import { WireEgressBlochRail } from './WireEgressBlochRail';
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
  Cpu,
  Repeat,
  ArrowDownToLine,
  ArrowUpFromLine,
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
const DEFAULT_HEIGHT = 295;
const MIN_HEIGHT = 140;
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
  const pinnedLeftRef = useRef<HTMLDivElement>(null);
  const pinnedRightRef = useRef<HTMLDivElement>(null);
  const leftSvgRef = useRef<SVGSVGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [activeDescTab, setActiveDescTab] = useState<'overview' | 'step' | 'pinout' | 'theory'>('overview');

  const handleRightScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (pinnedLeftRef.current) {
      pinnedLeftRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    if (pinnedRightRef.current) {
      pinnedRightRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const [circuitHeight, setCircuitHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 290 && val <= MAX_HEIGHT) {
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
      .svg-target-circle { fill: #04060b; stroke: #38bdf8; stroke-width: 1.5; }
      .svg-target-plus { stroke: #38bdf8; stroke-width: 1.6; stroke-linecap: round; }
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
  const stepData = simulationData.steps?.[currentStep] || simulationData.steps?.[0];

  const rowHeight = numQubits <= 8 ? 32 : 28;
  const colWidth = 36;
  const startX = 20;
  const startY = 32;

  const endWireX = startX + totalSteps * colWidth + 15;
  const pinOutBadgeWidth = 115;
  const gatesSvgWidth = endWireX + pinOutBadgeWidth + 25;
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
        <div className="circuit-pinned-left" ref={pinnedLeftRef}>
          <svg ref={leftSvgRef} width={88} height={svgHeight} className="circuit-svg" xmlns="http://www.w3.org/2000/svg">
            <text x={8} y={22} className="svg-step-num" textAnchor="start" fontWeight="700">
              WIRE
            </text>
            <text x={44} y={22} className="svg-step-num" textAnchor="start" fontWeight="700" fill="#38bdf8">
              PIN IN
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
                    x1={70}
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
          onScroll={handleRightScroll}
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
                  x2={endWireX}
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

                  {(g.name === 'CX' || g.name === 'CNOT') && g.qubits.length === 2 ? (
                    (() => {
                      const cY = startY + g.qubits[0] * rowHeight + rowHeight / 2;
                      const tY = startY + g.qubits[1] * rowHeight + rowHeight / 2;
                      return (
                        <g>
                          <title>{g.name} (Control: Q{g.qubits[0]}, Target: Q{g.qubits[1]}) — double-click for info</title>
                          <line x1={colX} y1={cY} x2={colX} y2={tY} className="svg-ctrl-line" />
                          <circle cx={colX} cy={cY} r={4} className="svg-ctrl-dot" />
                          <circle cx={colX} cy={tY} r={7.5} className="svg-target-circle" fill="#04060b" />
                          {/* Symmetrical horizontal bar of target plus */}
                          <line x1={colX - 5.5} y1={tY} x2={colX + 5.5} y2={tY} className="svg-target-plus" strokeLinecap="round" />
                          {/* Symmetrical vertical bar of target plus (strictly colX to colX, zero slant distortion) */}
                          <line x1={colX} y1={tY - 5.5} x2={colX} y2={tY + 5.5} className="svg-target-plus" strokeLinecap="round" />
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

            {/* PIN OUT (RESULT) Header aligned with step numbers at y=22 */}
            <g>
              <text
                x={endWireX + pinOutBadgeWidth / 2 + 6}
                y={22}
                className="svg-step-num"
                textAnchor="middle"
                fontWeight="700"
                fill="#38bdf8"
              >
                PIN OUT (RESULT)
              </text>
            </g>

            {/* Pin Out Badges at wire termination */}
            {Array.from({ length: numQubits }).map((_, q) => {
              const wireY = startY + q * rowHeight + rowHeight / 2;
              const qName = simulationData.qubit_names[q] || `Q${q}`;
              const sig = getQubitSignalInfo(q, qName, simulationData.circuit_name);
              const outBit = simulationData.output_bits[q];
              const isSel = q === selectedQubit;

              return (
                <g
                  key={`pinout-badge-${q}`}
                  onClick={() => onSelectQubit(q)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`Pin Out: Q${q} (${sig.pinOutName}) = |${outBit}⟩ [${sig.pinOutType}] • Click to inspect wire`}</title>
                  {/* Output wire connector stub */}
                  <line
                    x1={endWireX}
                    y1={wireY}
                    x2={endWireX + 6}
                    y2={wireY}
                    className={`svg-wire ${isSel ? 'selected' : ''}`}
                  />
                  {/* Result badge pill */}
                  <rect
                    x={endWireX + 6}
                    y={wireY - 10}
                    width={pinOutBadgeWidth}
                    height={20}
                    rx={4}
                    fill={isSel ? 'rgba(56, 189, 248, 0.22)' : 'rgba(15, 23, 42, 0.88)'}
                    stroke={isSel ? '#38bdf8' : `${sig.badgeColor}88`}
                    strokeWidth={isSel ? 1.5 : 1}
                  />
                  {/* Output bit ket */}
                  <text
                    x={endWireX + 16}
                    y={wireY}
                    fontFamily="var(--font-mono)"
                    fontSize="9px"
                    fontWeight="700"
                    fill="#34d399"
                    dominantBaseline="central"
                  >
                    |{outBit}⟩
                  </text>
                  {/* Output pin label */}
                  <text
                    x={endWireX + 38}
                    y={wireY}
                    fontSize="8.5px"
                    fontWeight="700"
                    fill={isSel ? '#38bdf8' : '#e2e8f0'}
                    dominantBaseline="central"
                  >
                    {sig.pinOutName.length > 14 ? sig.pinOutName.slice(0, 13) + '…' : sig.pinOutName}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Stationary / Pinned Wire-Aligned Egress Bloch Spheres Rail (Right) */}
        <div className="circuit-pinned-right" ref={pinnedRightRef}>
          <div style={{
            height: `${startY}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
            fontSize: '9px',
            fontWeight: 700,
            color: '#38bdf8',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-mono)',
            userSelect: 'none',
          }}>
            LIVE STATE (3D)
          </div>
          <WireEgressBlochRail
            numQubits={numQubits}
            selectedQubit={selectedQubit}
            onSelectQubit={onSelectQubit}
            stepData={stepData}
            qubitNames={simulationData.qubit_names}
            outputBits={simulationData.output_bits}
            rowHeight={rowHeight}
            startY={startY}
            height={svgHeight}
            width={110}
          />
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

          {/* TAB 3: QUBIT PINOUT, INOUT PRINCIPLE & RESULTS */}
          {activeDescTab === 'pinout' && (() => {
            const stepData = simulationData.steps?.[currentStep] || simulationData.steps?.[0];
            const inWeight = simulationData.input_bits.reduce((acc, b) => acc + b, 0);
            const outWeight = simulationData.output_bits.reduce((acc, b) => acc + b, 0);
            const isParityPreserved = (inWeight % 2) === (outWeight % 2);

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* ─── EDUCATIONAL BANNER: THE REVERSIBLE INOUT WIRE PRINCIPLE ─── */}
                <div style={{
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.6) 100%)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        padding: '4px 6px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <Repeat size={15} color="#38bdf8" />
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
                        The Reversible INOUT Wire Principle
                      </span>
                    </div>
                    <span style={{
                      fontSize: '0.62rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      fontFamily: 'var(--font-mono)',
                    }}>
                      UNITARY INVARIANCE: N_in = N_out = {numQubits}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.68rem', color: '#cbd5e1', lineHeight: 1.45, margin: 0 }}>
                    In classical irreversible CMOS (e.g. standard ALU), input ports (<span style={{ color: '#38bdf8' }}>A, B, Cin</span>) and output ports (<span style={{ color: '#34d399' }}>Y, Cout</span>) are separate physical wires, permanently discarding intermediate states and generating <span style={{ fontFamily: 'var(--font-mono)', color: '#f59e0b' }}>k_B·T·ln(2)</span> Landauer heat. In contrast, quantum circuits are strictly unitary (<span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>U·U† = I</span>) and reversible: <strong>every wire is an INOUT quantum channel</strong>.
                    Each wire begins as a <strong>Pin In</strong> stimulus at <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>t = 0</span>, acts as an inout register transforming step-by-step through quantum gates, and terminates as a <strong>Pin Out</strong> result at <span style={{ fontFamily: 'var(--font-mono)', color: '#94a3b8' }}>t = T</span>.
                  </p>
                </div>

                {/* ─── SECTION 1: 📥 PIN IN (INPUT STIMULUS CONFIGURATION) ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 4,
                    borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowDownToLine size={13} color="#34d399" />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        1. Pin In — Input Stimulus Configuration (t = 0)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                        Input Vector:
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#34d399',
                        background: 'rgba(16, 185, 129, 0.1)',
                        padding: '1px 6px',
                        borderRadius: 3,
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                      }}>
                        |{simulationData.input_bits.slice().reverse().join('')}⟩
                      </span>
                      <span style={{ fontSize: '0.60rem', color: '#64748b' }}>
                        (Hamming W = {inWeight})
                      </span>
                    </div>
                  </div>

                  {/* Input Pins Cards Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 6,
                  }}>
                    {Array.from({ length: numQubits }).map((_, q) => {
                      const qName = simulationData.qubit_names[q] || `Q${q}`;
                      const inBit = simulationData.input_bits[q];
                      const sig = getQubitSignalInfo(q, qName, simulationData.circuit_name);
                      const isSel = q === selectedQubit;

                      return (
                        <div
                          key={`pin-in-card-${q}`}
                          onClick={() => onSelectQubit(q)}
                          style={{
                            background: isSel ? 'rgba(56, 189, 248, 0.12)' : 'rgba(15, 23, 42, 0.5)',
                            border: `1px solid ${isSel ? '#38bdf8' : 'rgba(51, 65, 85, 0.4)'}`,
                            borderRadius: 6,
                            padding: '6px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.64rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 3,
                                background: isSel ? '#38bdf8' : 'rgba(51, 65, 85, 0.6)',
                                color: isSel ? '#04060b' : '#f8fafc',
                              }}>
                                Q{q}
                              </span>
                              <span style={{
                                fontSize: '0.56rem',
                                color: '#34d399',
                                fontWeight: 700,
                                background: 'rgba(16, 185, 129, 0.12)',
                                padding: '1px 4px',
                                borderRadius: 2,
                              }}>
                                PIN IN
                              </span>
                            </div>

                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.74rem',
                              fontWeight: 800,
                              color: inBit === 1 ? '#34d399' : '#94a3b8',
                              background: inBit === 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.1)',
                              padding: '1px 6px',
                              borderRadius: 4,
                              border: inBit === 1 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(148, 163, 184, 0.2)',
                            }}>
                              |{inBit}⟩
                            </span>
                          </div>

                          <div style={{ fontSize: '0.70rem', fontWeight: 700, color: '#f8fafc' }}>
                            {sig.pinInName}
                          </div>

                          <div style={{ fontSize: '0.60rem', color: '#94a3b8' }}>
                            {sig.pinInType}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ─── SECTION 2: 🔄 INOUT WIRE TRANSFORMATION & TRAJECTORY ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 4,
                    borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Repeat size={13} color="#38bdf8" />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        2. Inout Wire Trajectory — Unitary Evolution (t = 0 → T)
                      </span>
                    </div>
                    <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                      Click any row to focus wire on 3D Bloch sphere & circuit
                    </span>
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
                          <th style={{ padding: '6px 8px' }}>Pin In (t=0)</th>
                          <th style={{ padding: '6px 8px', textAlign: 'center' }}>Current ⟨Z⟩</th>
                          <th style={{ padding: '6px 8px' }}>Inout Evolution Path</th>
                          <th style={{ padding: '6px 8px' }}>Pin Out (t=T)</th>
                          <th style={{ padding: '6px 8px' }}>Signal Role</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: numQubits }).map((_, q) => {
                          const qName = simulationData.qubit_names[q] || `Q${q}`;
                          const inBit = simulationData.input_bits[q];
                          const outBit = simulationData.output_bits[q];
                          const bVec = stepData?.bloch_vectors?.[q];
                          const zExp = bVec ? bVec.z.toFixed(2) : (inBit === 1 ? '-1.00' : '1.00');
                          const sig = getQubitSignalInfo(q, qName, simulationData.circuit_name);
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
                              <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)' }}>
                                <span style={{ color: inBit === 1 ? '#34d399' : '#94a3b8', fontWeight: 700 }}>
                                  |{inBit}⟩
                                </span>{' '}
                                <span style={{ color: '#cbd5e1', fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
                                  {sig.pinInName}
                                </span>
                              </td>
                              <td style={{ padding: '5px 8px', textAlign: 'center', fontFamily: 'var(--font-mono)', color: '#38bdf8', fontWeight: 700 }}>
                                {zExp}
                              </td>
                              <td style={{ padding: '5px 8px', color: '#94a3b8', fontSize: '0.62rem' }}>
                                {sig.inoutDesc}
                              </td>
                              <td style={{ padding: '5px 8px', fontFamily: 'var(--font-mono)' }}>
                                <span style={{ color: outBit === 1 ? '#38bdf8' : '#94a3b8', fontWeight: 700 }}>
                                  |{outBit}⟩
                                </span>{' '}
                                <span style={{ color: '#f8fafc', fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
                                  {sig.pinOutName}
                                </span>
                              </td>
                              <td style={{ padding: '5px 8px' }}>
                                <span style={{
                                  fontSize: '0.6rem',
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 3,
                                  background: `${sig.badgeColor}20`,
                                  color: sig.badgeColor,
                                  border: `1px solid ${sig.badgeColor}40`,
                                }}>
                                  {sig.role}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ─── SECTION 3: 📤 PIN OUT (ALU RESULTS & MEASURED STATES) ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingBottom: 4,
                    borderBottom: '1px solid rgba(51, 65, 85, 0.4)',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ArrowUpFromLine size={13} color="#38bdf8" />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        3. Pin Out — Measured Results & Invariant Preservation (t = T)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                        Output Vector:
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: '#38bdf8',
                        background: 'rgba(56, 189, 248, 0.1)',
                        padding: '1px 6px',
                        borderRadius: 3,
                        border: '1px solid rgba(56, 189, 248, 0.25)',
                      }}>
                        |{simulationData.output_bits.slice().reverse().join('')}⟩
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: isParityPreserved ? '#10b981' : '#ef4444', fontSize: '0.60rem', fontWeight: 700 }}>
                        <ShieldCheck size={12} />
                        <span>{isParityPreserved ? 'PARITY PRESERVED (ΔP=0)' : 'PARITY ERROR'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Highlighted Result Cards Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 8,
                  }}>
                    {/* Primary Result Y Card */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(56, 189, 248, 0.35)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                          Primary ALU Result (Y)
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          color: '#38bdf8',
                          background: 'rgba(56, 189, 248, 0.15)',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}>
                          Q0 = |{simulationData.output_bits[0] ?? 0}⟩
                        </span>
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>
                        {getQubitSignalInfo(0, simulationData.qubit_names[0] || 'Q0', simulationData.circuit_name).pinOutType}
                      </div>
                      <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>
                        Delivered on physical inout Wire Q0 via full reversible ALU operator pipeline.
                      </div>
                    </div>

                    {/* Carry Out Cout Card */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(6, 182, 212, 0.35)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#06b6d4', textTransform: 'uppercase' }}>
                          Carry / Borrow Out (Cout)
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.76rem',
                          fontWeight: 800,
                          color: '#06b6d4',
                          background: 'rgba(6, 182, 212, 0.15)',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}>
                          Q1 = |{simulationData.output_bits[1] ?? 0}⟩
                        </span>
                      </div>
                      <div style={{ fontSize: '0.66rem', color: '#cbd5e1' }}>
                        {getQubitSignalInfo(1, simulationData.qubit_names[1] || 'Q1', simulationData.circuit_name).pinOutType}
                      </div>
                      <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>
                        Delivered on physical inout Wire Q1; cascades into next higher-order bit in multi-bit ALU.
                      </div>
                    </div>

                    {/* Preserved Control Registers Card */}
                    <div style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
                          Preserved Control Lines
                        </span>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          color: '#10b981',
                        }}>
                          Zero Information Loss
                        </span>
                      </div>
                      <div style={{ fontSize: '0.64rem', color: '#cbd5e1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {numQubits >= 7 ? (
                          <>
                            <span>Q5 (S2): <strong style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>|{simulationData.output_bits[5]}⟩</strong></span>
                            <span>Q6 (S3): <strong style={{ fontFamily: 'var(--font-mono)', color: '#10b981' }}>|{simulationData.output_bits[6]}⟩</strong></span>
                          </>
                        ) : (
                          <span>Preserved control registers match input bits exactly.</span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>
                        Multiplexer select registers remain uncorrupted for cascading control across ALU slices.
                      </div>
                    </div>
                  </div>
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

export interface QubitSignalInfo {
  pinInName: string;
  pinInType: string;
  inoutDesc: string;
  pinOutName: string;
  pinOutType: string;
  role: string;
  badgeColor: string;
}

export function getQubitSignalInfo(qIdx: number, qName: string, circuitName: string = ''): QubitSignalInfo {
  const cLower = circuitName.toLowerCase();
  const qLower = qName.toLowerCase();

  // 1-Bit ALU (7 qubits)
  if (cLower.includes('alu') || cLower.includes('1-bit')) {
    switch (qIdx) {
      case 0:
        return {
          pinInName: 'Operand A',
          pinInType: 'Primary Data Input',
          inoutDesc: 'Reversible Data Bus: Undergoes full arithmetic/logic transform into primary ALU Result Y',
          pinOutName: 'Result Y',
          pinOutType: 'Primary ALU Output (Sum / Diff / Logic)',
          role: 'ALU Output / Result Y',
          badgeColor: '#38bdf8',
        };
      case 1:
        return {
          pinInName: 'Operand B',
          pinInType: 'Secondary Data Input',
          inoutDesc: 'Reversible Data Bus: Undergoes full arithmetic/logic transform into Carry / Borrow Out',
          pinOutName: 'Carry Out (Cout)',
          pinOutType: 'Arithmetic Carry / Borrow Flag',
          role: 'Carry / Borrow Out Cout',
          badgeColor: '#06b6d4',
        };
      case 2:
        return {
          pinInName: 'Cin / S0',
          pinInType: 'Carry In / Function Select S0',
          inoutDesc: 'Reversible Control Line: Cascaded through FALFG and FRG3 into Garbage G1',
          pinOutName: 'Garbage G1',
          pinOutType: 'Parity-Preserving Garbage Register',
          role: 'Parity Ancilla G1',
          badgeColor: '#a855f7',
        };
      case 3:
        return {
          pinInName: 'Select S1',
          pinInType: 'ALU Function Select S1',
          inoutDesc: 'Reversible Control Line: Selects arithmetic/logic mode in FALFG stage into G3',
          pinOutName: 'Garbage G3',
          pinOutType: 'Parity-Preserving Garbage Register',
          role: 'Parity Ancilla G3',
          badgeColor: '#ec4899',
        };
      case 4:
        return {
          pinInName: 'Mode Select M',
          pinInType: 'Mode Select (0=Logic, 1=Arith)',
          inoutDesc: 'Reversible Mode Control: Swapped through Fredkin multiplexer stage into G2',
          pinOutName: 'Garbage G2',
          pinOutType: 'Parity-Preserving Garbage Register',
          role: 'Parity Ancilla G2',
          badgeColor: '#f59e0b',
        };
      case 5:
        return {
          pinInName: 'Select S2',
          pinInType: 'Fredkin Multiplexer Select S2',
          inoutDesc: 'Reversible Preserved Control: Controls FRG1 & FRG2 without state corruption',
          pinOutName: 'Preserved S2',
          pinOutType: 'Preserved Control Register',
          role: 'Preserved Control S2',
          badgeColor: '#10b981',
        };
      case 6:
        return {
          pinInName: 'Select S3',
          pinInType: 'Fredkin Multiplexer Select S3',
          inoutDesc: 'Reversible Preserved Control: Controls FRG3 final multiplexer without state corruption',
          pinOutName: 'Preserved S3',
          pinOutType: 'Preserved Control Register',
          role: 'Preserved Control S3',
          badgeColor: '#10b981',
        };
      default:
        break;
    }
  }

  // 5x5 FALFG Gate
  if (cLower.includes('falfg')) {
    switch (qIdx) {
      case 0:
        return {
          pinInName: 'Operand A',
          pinInType: 'Primary Data Input',
          inoutDesc: 'Reversible Data Bus: Generates Carry / Borrow P output',
          pinOutName: 'Carry / Borrow P',
          pinOutType: 'Arithmetic Carry/Borrow Output',
          role: 'Carry / Borrow Out P',
          badgeColor: '#06b6d4',
        };
      case 1:
        return {
          pinInName: 'Operand B',
          pinInType: 'Secondary Data Input',
          inoutDesc: 'Reversible Data Bus: Generates Sum / Difference Q output',
          pinOutName: 'Sum / Diff Q',
          pinOutType: 'Primary Arithmetic / Logic Output',
          role: 'Sum / Diff Q',
          badgeColor: '#38bdf8',
        };
      case 2:
        return {
          pinInName: 'Carry In C',
          pinInType: 'Carry In / Function Select C',
          inoutDesc: 'Reversible Control Wire: Undergoes reversible parity transform into R',
          pinOutName: 'Garbage R (G1)',
          pinOutType: 'Parity-Preserving Ancilla',
          role: 'Garbage R (G1)',
          badgeColor: '#a855f7',
        };
      case 3:
        return {
          pinInName: 'Select Line D',
          pinInType: 'Add / Sub Select D',
          inoutDesc: 'Reversible Control Wire: Directs addition vs subtraction into S',
          pinOutName: 'Garbage S (G2)',
          pinOutType: 'Parity-Preserving Ancilla',
          role: 'Garbage S (G2)',
          badgeColor: '#ec4899',
        };
      case 4:
        return {
          pinInName: 'Mode Select E',
          pinInType: 'Mode Select E',
          inoutDesc: 'Reversible Mode Wire: Carries logic mode selection into T',
          pinOutName: 'Garbage T (G3)',
          pinOutType: 'Parity-Preserving Ancilla',
          role: 'Garbage T (G3)',
          badgeColor: '#f59e0b',
        };
      default:
        break;
    }
  }

  // 3x3 Fredkin CSWAP Gate
  if (cLower.includes('fredkin') || cLower.includes('cswap')) {
    switch (qIdx) {
      case 0:
        return {
          pinInName: 'Control Input C',
          pinInType: 'Swap Control Line',
          inoutDesc: 'Reversible Control Wire: Controls conditional swap of target wires without state alteration',
          pinOutName: 'Preserved Control C',
          pinOutType: 'Preserved Control Register',
          role: 'Preserved Control C',
          badgeColor: '#10b981',
        };
      case 1:
        return {
          pinInName: 'Target Input In1 (B)',
          pinInType: 'Target Data Line',
          inoutDesc: 'Reversible Target Bus: If C=1 swapped with In2; if C=0 preserved unchanged',
          pinOutName: 'Target Out Out1',
          pinOutType: 'Conditional Swapped Data Output',
          role: 'Swapped Out1',
          badgeColor: '#38bdf8',
        };
      case 2:
        return {
          pinInName: 'Target Input In2 (C)',
          pinInType: 'Target Data Line',
          inoutDesc: 'Reversible Target Bus: If C=1 swapped with In1; if C=0 preserved unchanged',
          pinOutName: 'Target Out Out2',
          pinOutType: 'Conditional Swapped Data Output',
          role: 'Swapped Out2',
          badgeColor: '#06b6d4',
        };
      default:
        break;
    }
  }

  // Generic heuristic fallback
  if (qLower.includes('sum') || qLower.includes('result') || qLower.includes('diff') || qLower.includes('y')) {
    return {
      pinInName: qName.split(' ')[0] || `In${qIdx}`,
      pinInType: 'Data Input',
      inoutDesc: 'Reversible Data Bus: Undergoes unitary evolution to produce primary computational result',
      pinOutName: 'Result Y',
      pinOutType: 'ALU / Computation Result',
      role: 'ALU Output / Result',
      badgeColor: '#38bdf8',
    };
  }
  if (qLower.includes('cout') || qLower.includes('carry') || qLower.includes('bout')) {
    return {
      pinInName: qName.split(' ')[0] || `In${qIdx}`,
      pinInType: 'Data Input',
      inoutDesc: 'Reversible Data Bus: Generates carry/borrow output flag',
      pinOutName: 'Carry Out',
      pinOutType: 'Arithmetic Carry/Borrow Output',
      role: 'Carry / Borrow Out',
      badgeColor: '#06b6d4',
    };
  }
  if (qLower.includes('ctrl') || qLower.includes('sel') || qLower.includes('cin') || qLower.includes('s0') || qLower.includes('s1')) {
    return {
      pinInName: qName.split(' ')[0] || `In${qIdx}`,
      pinInType: 'Control / Select Input',
      inoutDesc: 'Reversible Control Line: Steers conditional quantum logic transformations',
      pinOutName: `Out_${qName.split(' ')[0]}`,
      pinOutType: 'Preserved Control Register',
      role: 'Control / Select Line',
      badgeColor: '#f59e0b',
    };
  }
  if (qLower.includes('garbage') || qLower.includes('ancilla') || qLower.includes('g1') || qLower.includes('g2')) {
    return {
      pinInName: qName.split(' ')[0] || `Ancilla${qIdx}`,
      pinInType: 'Reversible Ancilla Input',
      inoutDesc: 'Reversible Parity Ancilla: Preserves quantum information and unitary invertibility',
      pinOutName: `Garbage_${qIdx}`,
      pinOutType: 'Reversible Ancilla Output',
      role: 'Reversible Ancilla',
      badgeColor: '#64748b',
    };
  }

  return {
    pinInName: `Wire Input Q${qIdx}`,
    pinInType: 'Quantum Register Input',
    inoutDesc: 'Reversible Quantum Wire: Undergoes coherent unitary transformation |ψ(t)⟩ = U(t)|ψ(0)⟩',
    pinOutName: `Wire Output Q${qIdx}`,
    pinOutType: 'Measured Register State',
    role: 'Quantum Wire',
    badgeColor: '#10b981',
  };
}

