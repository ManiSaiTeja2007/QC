import React, { useRef, useEffect } from 'react';
import { SimulationPayload } from '../types/simulation';

interface CircuitPanelProps {
  simulationData: SimulationPayload | null;
  currentStep: number;
  selectedQubit: number;
  activeGateName: string;
  onSelectQubit: (qIdx: number) => void;
  onSelectStep: (stepIdx: number) => void;
}

export const CircuitPanel: React.FC<CircuitPanelProps> = ({
  simulationData,
  currentStep,
  selectedQubit,
  activeGateName,
  onSelectQubit,
  onSelectStep,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);

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
      <div className="card-header">
        <h3>⚡ Circuit Wire & Logical Operation Highlight</h3>
        <span className="badge-gate">{activeGateName}</span>
      </div>

      <div className="circuit-viewport" ref={viewportRef}>
        <svg className="circuit-svg" width={svgWidth} height={svgHeight} xmlns="http://www.w3.org/2000/svg">
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
              <g key={stepNum} onClick={() => onSelectStep(stepNum)} style={{ cursor: 'pointer' }}>
                <text x={colX} y={22} className={`svg-step-num ${isSelected ? 'active' : ''}`}>
                  {stepNum}
                </text>

                {g.name === 'CX' && g.qubits.length === 2 ? (
                  (() => {
                    const cY = startY + g.qubits[0] * rowHeight + rowHeight / 2;
                    const tY = startY + g.qubits[1] * rowHeight + rowHeight / 2;
                    return (
                      <g>
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
