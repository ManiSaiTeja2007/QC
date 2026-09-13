import React, { useState, useEffect } from 'react';
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
  onPlaceGate: (qubit: number, step: number, targetQubit?: number, specificGateName?: string) => void;
  onRemoveGate: (gateId: string) => void;
  onClearCircuit: () => void;
  onSaveToLibrary?: () => void;
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
  onSaveToLibrary,
}) => {
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [customTargetQubit, setCustomTargetQubit] = useState<number>(1);
  const [dragOverCell, setDragOverCell] = useState<{ q: number; col: number } | null>(null);

  const maxStep = Math.max(14, ...placedGates.map((g) => g.step + 2));
  const columns = Array.from({ length: maxStep }, (_, i) => i + 1);

  const rowHeight = 36;
  const colWidth = 44;
  const startX = 110;
  const startY = 40;

  const svgWidth = startX + maxStep * colWidth + 40;
  const svgHeight = startY + numQubits * rowHeight + 20;

  // Keyboard shortcut: Delete or Backspace removes selected gate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedGateId) {
        onRemoveGate(selectedGateId);
        setSelectedGateId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedGateId, onRemoveGate]);

  const handleCellClick = (q: number, col: number) => {
    if (!selectedGate) return;
    const isMulti = ['CX', 'CY', 'CZ', 'CH', 'CRX', 'CRY', 'CRZ', 'SWAP', 'ISWAP', 'CCX', 'CSWAP'].includes(selectedGate);
    const targetQ = isMulti ? customTargetQubit : q;
    onPlaceGate(q, col, targetQ);
  };

  const handleDropGate = (gateName: string, q: number, col: number) => {
    const isMulti = ['CX', 'CY', 'CZ', 'CH', 'CRX', 'CRY', 'CRZ', 'SWAP', 'ISWAP', 'CCX', 'CSWAP'].includes(gateName);
    const targetQ = isMulti
      ? customTargetQubit !== q
        ? customTargetQubit
        : q + 1 < numQubits
        ? q + 1
        : q - 1
      : q;
    onPlaceGate(q, col, targetQ, gateName);
  };

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

          {selectedGate && ['CX', 'CY', 'CZ', 'CH', 'CRX', 'CRY', 'CRZ', 'SWAP', 'ISWAP'].includes(selectedGate) && (
            <div className="target-select-dock">
              <label>Target Wire:</label>
              <select
                value={customTargetQubit}
                onChange={(e) => setCustomTargetQubit(parseInt(e.target.value))}
                className="target-select"
              >
                {Array.from({ length: numQubits }).map((_, i) => (
                  <option key={i} value={i}>
                    Q{i}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="canvas-actions">
          {selectedGate && (
            <span className="active-placement-badge">
              Active: <b>{selectedGate}</b> (click wire to place)
            </span>
          )}
          {selectedGateId && (
            <button
              className="btn btn-xs btn-danger"
              onClick={() => {
                onRemoveGate(selectedGateId);
                setSelectedGateId(null);
              }}
            >
              🗑️ Delete Selected Gate (Del)
            </button>
          )}
          <button className="btn btn-xs btn-danger" onClick={onClearCircuit}>
            Clear Circuit
          </button>
          <button
            className="btn btn-xs"
            onClick={onSaveToLibrary}
            style={{
              background: 'linear-gradient(90deg, #10b981, #059669)',
              color: '#fff',
              border: 'none',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>💾</span>
            <span>Save to Library</span>
          </button>
        </div>
      </div>

      <div className="canvas-viewport" onDragOver={(e) => e.preventDefault()}>
        <svg
          className="builder-svg"
          width={svgWidth}
          height={svgHeight}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Step Column Numbers */}
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

          {/* Qubit Wires & Input Basis Toggles */}
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
                  <title>Click to toggle initial input bit |0⟩ ↔ |1⟩</title>
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

          {/* Placement Drop Target Cells */}
          {Array.from({ length: numQubits }).map((_, q) => {
            const wireY = startY + q * rowHeight + rowHeight / 2;
            return columns.map((col) => {
              const colX = startX + (col - 1) * colWidth + colWidth / 2;
              const isDragHover = dragOverCell?.q === q && dragOverCell?.col === col;

              return (
                <g key={`${q}-${col}`}>
                  <rect
                    x={colX - 16}
                    y={wireY - 14}
                    width={32}
                    height={28}
                    className={`builder-cell ${selectedGate ? 'droppable' : ''} ${isDragHover ? 'drag-hover' : ''}`}
                    onClick={() => handleCellClick(q, col)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'copy';
                      setDragOverCell({ q, col });
                    }}
                    onDragLeave={() => {
                      setDragOverCell((prev) => (prev?.q === q && prev?.col === col ? null : prev));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverCell(null);
                      const gateName =
                        e.dataTransfer.getData('text/plain') ||
                        e.dataTransfer.getData('text') ||
                        selectedGate;
                      if (gateName) {
                        handleDropGate(gateName, q, col);
                      }
                    }}
                  />
                  {isDragHover && (
                    <rect
                      x={colX - 14}
                      y={wireY - 14}
                      width={28}
                      height={28}
                      rx={4}
                      className="builder-drag-ghost"
                    />
                  )}
                </g>
              );
            });
          })}

          {/* Placed Gates on Grid */}
          {placedGates.map((g) => {
            const colX = startX + (g.step - 1) * colWidth + colWidth / 2;
            const isMulti = g.qubits.length >= 2;
            const isSelected = selectedGateId === g.id;

            if (isMulti) {
              const cY = startY + g.qubits[0] * rowHeight + rowHeight / 2;
              const tY = startY + g.qubits[1] * rowHeight + rowHeight / 2;
              return (
                <g
                  key={g.id}
                  {...({
                    draggable: true,
                    onDragStart: (e: React.DragEvent) => {
                      e.dataTransfer.setData('text/plain', g.name);
                      e.dataTransfer.effectAllowed = 'move';
                      onRemoveGate(g.id);
                    },
                  } as any)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedGateId(isSelected ? null : g.id);
                  }}
                  style={{ cursor: 'grab' }}
                >
                  <title>{`${g.name} (Control: Q${g.qubits[0]}, Target: Q${g.qubits[1]}) — Click to select/delete, drag to move`}</title>
                  <line
                    x1={colX}
                    y1={cY}
                    x2={colX}
                    y2={tY}
                    className={`builder-multi-line ${isSelected ? 'selected' : ''}`}
                  />
                  <circle cx={colX} cy={cY} r={5} className="builder-ctrl-dot" />
                  {g.name === 'SWAP' || g.name === 'ISWAP' ? (
                    <circle cx={colX} cy={tY} r={5} className="builder-ctrl-dot" />
                  ) : (
                    <g>
                      <circle
                        cx={colX}
                        cy={tY}
                        r={8}
                        className={`builder-target-circle ${isSelected ? 'selected' : ''}`}
                      />
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
                {...({
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => {
                    e.dataTransfer.setData('text/plain', g.name);
                    e.dataTransfer.effectAllowed = 'move';
                    onRemoveGate(g.id);
                  },
                } as any)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGateId(isSelected ? null : g.id);
                }}
                style={{ cursor: 'grab' }}
              >
                <title>{`${g.name} on Q${g.qubits[0]} — Click to select/delete, drag to move`}</title>
                <rect
                  x={colX - boxSize / 2}
                  y={qY - boxSize / 2}
                  width={boxSize}
                  height={boxSize}
                  className={`builder-gate-box ${isSelected ? 'selected' : ''}`}
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
