import React, { useRef, useEffect } from 'react';
import { SimulationPayload } from '../types/simulation';

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
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (viewportRef.current && currentStep > 0) {
      const colWidth = 36;
      const startX = 85;
      const activeX = startX + (currentStep - 1) * colWidth;
      const targetScrollLeft = activeX - viewportRef.current.clientWidth / 2 + colWidth / 2;
      viewportRef.current.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
    }
  }, [currentStep]);

  const getStandaloneSVGString = (): string => {
    if (!svgRef.current) return '';
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
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
    svgClone.insertBefore(styleEl, svgClone.firstChild);

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('width', '100%');
    bgRect.setAttribute('height', '100%');
    bgRect.setAttribute('fill', '#04060b');
    svgClone.insertBefore(bgRect, svgClone.childNodes[1] || null);

    return new XMLSerializer().serializeToString(svgClone);
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
  const startX = 85;
  const startY = 32;

  const svgWidth = startX + totalSteps * colWidth + 30;
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

      <div className="circuit-viewport" ref={viewportRef}>
        <svg ref={svgRef} className="circuit-svg" width={svgWidth} height={svgHeight} xmlns="http://www.w3.org/2000/svg">
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

          {/* Qubit Wires & Labels */}
          {Array.from({ length: numQubits }).map((_, q) => {
            const wireY = startY + q * rowHeight + rowHeight / 2;
            const qName = simulationData.qubit_names[q] ? simulationData.qubit_names[q].split(' ')[0] : `Q${q}`;
            const bitVal = simulationData.input_bits[q];
            const isSel = q === selectedQubit;

            return (
              <g key={q} onClick={() => onSelectQubit(q)} style={{ cursor: 'pointer' }}>
                <text
                  x={8}
                  y={wireY}
                  className={`svg-qubit-lbl ${isSel ? 'selected' : ''}`}
                  dominantBaseline="central"
                >
                  {qName}
                </text>
                <text x={58} y={wireY} className="svg-init-state" dominantBaseline="central">
                  |{bitVal}⟩
                </text>
                <line
                  x1={startX - 10}
                  y1={wireY}
                  x2={svgWidth - 15}
                  y2={wireY}
                  className={`svg-wire ${isSel ? 'selected' : ''}`}
                />
              </g>
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
    </article>
  );
};
