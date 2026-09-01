import React from 'react';
import { CustomGatePayload } from '../../services/api';

export interface PlacedGate extends CustomGatePayload {
  id: string;
  step: number;
}

interface CircuitCanvasProps {
  numQubits: number;
  inputBits: number[];
  placedGates: PlacedGate[];
  selectedGate: string | null;
  onAddQubit: () => void;
  onRemoveQubit: () => void;
  onInputBitToggle: (qIdx: number) => void;
  onPlaceGate: (qubit: number, step: number) => void;
  onRemoveGate: (gateId: string) => void;
  onClearCircuit: () => void;
}

export const CircuitCanvas: React.FC<CircuitCanvasProps> = ({
  numQubits,
  inputBits,
  placedGates,
  selectedGate,
  onAddQubit,
  onRemoveQubit,
  onInputBitToggle,
  onPlaceGate,
  onRemoveGate,
  onClearCircuit,
}) => {
  const maxStep = Math.max(12, ...placedGates.map((g) => g.step + 1));
  const columns = Array.from({ length: maxStep }, (_, i) => i + 1);

  const rowHeight = 36;
  const colWidth = 44;
  const startX = 110;
  const startY = 40;

  const svgWidth = startX + maxStep * colWidth + 40;
  const svgHeight = startY + numQubits * rowHeight + 20;

  return (
    <article className="builder-canvas-card">
      <div className="canvas-toolbar">
        <div className="wire-controls">
          <button className="btn btn-xs" onClick={onAddQubit}>
            ➕ Add Qubit
          </button>
          <button className="btn btn-xs" onClick={onRemoveQubit} disabled={numQubits <= 1}>
            ➖ Remove Qubit
          </button>

          <span className="qubits-count">Qubits: {numQubits}</span>
        </div>

        <div className="canvas-actions">
          {selectedGate && (
            <span className="active-placement-badge">
              Active: <b>{selectedGate}</b> (click cell to place)
            </span>
          )}
          <button className="btn btn-xs btn-danger" onClick={onClearCircuit}>
            🗑️ Clear Canvas
          </button>
        </div>
      </div>

      <div className="canvas-viewport">
        <svg className="builder-svg" width={svgWidth} height={svgHeight}>
          {/* Step Headers */}
          {columns.map((col) => (
            <text
              key={col}
              x={startX + (col - 1) * colWidth + colWidth / 2}
              y={22}
              className="builder-col-lbl"
            >
              {col}
            </text>
          ))}

          {/* Qubit Wires & Toggle Labels */}
          {Array.from({ length: numQubits }).map((_, q) => {
            const wireY = startY + q * rowHeight + rowHeight / 2;
            const bitVal = inputBits[q] ?? 0;

            return (
              <g key={q}>
                <text
                  x={12}
                  y={wireY}
                  className="builder-q-lbl"
                  dominantBaseline="central"
                >
                  Q{q}
                </text>

                <g
                  className="builder-init-toggle"
                  onClick={() => onInputBitToggle(q)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={42}
                    y={wireY - 9}
                    width={24}
                    height={18}
                    rx={4}
                    fill={bitVal ? '#2563eb' : '#1e293b'}
                    stroke={bitVal ? '#60a5fa' : '#334155'}
                  />
                  <text
                    x={54}
                    y={wireY}
                    className="builder-init-val"
                    dominantBaseline="central"
                    textAnchor="middle"
                  >
                    |{bitVal}⟩
                  </text>
                </g>

                <line
                  x1={startX - 10}
                  y1={wireY}
                  x2={svgWidth - 20}
                  y2={wireY}
                  className="builder-wire"
                />
              </g>
            );
          })}

          {/* Placement Cell Drop Targets */}
          {Array.from({ length: numQubits }).map((_, q) => {
            const wireY = startY + q * rowHeight + rowHeight / 2;
            return columns.map((col) => {
              const colX = startX + (col - 1) * colWidth + colWidth / 2;
              return (
                <rect
                  key={`${q}-${col}`}
                  x={colX - 16}
                  y={wireY - 14}
                  width={32}
                  height={28}
                  className={`builder-cell ${selectedGate ? 'droppable' : ''}`}
                  onClick={() => onPlaceGate(q, col)}
                />
              );
            });
          })}

          {/* Placed Gates */}
          {placedGates.map((g) => {
            const colX = startX + (g.step - 1) * colWidth + colWidth / 2;
            const isMulti = g.qubits.length >= 2;

            if (isMulti) {
              const cY = startY + g.qubits[0] * rowHeight + rowHeight / 2;
              const tY = startY + g.qubits[1] * rowHeight + rowHeight / 2;
              return (
                <g
                  key={g.id}
                  onClick={() => onRemoveGate(g.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>Click to remove gate</title>
                  <line x1={colX} y1={cY} x2={colX} y2={tY} className="builder-multi-line" />
                  <circle cx={colX} cy={cY} r={5} className="builder-ctrl-dot" />
                  {g.name === 'SWAP' ? (
                    <circle cx={colX} cy={tY} r={5} className="builder-ctrl-dot" />
                  ) : (
                    <g>
                      <circle cx={colX} cy={tY} r={8} className="builder-target-circle" />
                      <line x1={colX - 5} y1={tY} x2={colX + 5} y2={tY} className="builder-target-cross" />
                      <line x1={colX} y1={tY - 5} x2={colX} y2={tY + 5} className="builder-target-cross" />
                    </g>
                  )}
                </g>
              );
            }

            const qY = startY + g.qubits[0] * rowHeight + rowHeight / 2;
            const boxSize = 26;

            return (
              <g
                key={g.id}
                onClick={() => onRemoveGate(g.id)}
                style={{ cursor: 'pointer' }}
              >
                <title>Click to remove gate</title>
                <rect
                  x={colX - boxSize / 2}
                  y={qY - boxSize / 2}
                  width={boxSize}
                  height={boxSize}
                  className="builder-gate-box"
                />
                <text x={colX} y={qY} className="builder-gate-lbl">
                  {g.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </article>
  );
};
