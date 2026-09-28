import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  SchematicCircuitModel,
  GateVisualBlock,
  PortVisualBlock,
  WireSegment,
  ClassicalGateType,
} from '../../types/classical_schematic';
import { evaluateSchematic } from '../../services/schematicEvaluator';
import { FloatingToolbox } from '../FloatingToolbox';
import {
  Plus,
  Trash2,
  Cpu,
  CornerDownRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';

interface SchematicCanvasProps {
  model: SchematicCircuitModel;
  onChange: (newModel: SchematicCircuitModel) => void;
  onSelectGate?: (gate: GateVisualBlock | null) => void;
}

const GATE_TYPES: Array<{ type: ClassicalGateType; label: string; defaultFanIn: number; color: string }> = [
  { type: 'AND', label: 'AND Gate', defaultFanIn: 2, color: '#3b82f6' },
  { type: 'OR', label: 'OR Gate', defaultFanIn: 2, color: '#10b981' },
  { type: 'NAND', label: 'NAND Gate', defaultFanIn: 2, color: '#ec4899' },
  { type: 'NOR', label: 'NOR Gate', defaultFanIn: 2, color: '#f59e0b' },
  { type: 'XOR', label: 'XOR Gate', defaultFanIn: 2, color: '#8b5cf6' },
  { type: 'XNOR', label: 'XNOR Gate', defaultFanIn: 2, color: '#06b6d4' },
  { type: 'NOT', label: 'NOT Gate', defaultFanIn: 1, color: '#ef4444' },
  { type: 'BUFFER', label: 'Buffer', defaultFanIn: 1, color: '#64748b' },
];

const GRID_SIZE = 20;

export const SchematicCanvas: React.FC<SchematicCanvasProps> = ({
  model,
  onChange,
  onSelectGate,
}) => {
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [wiringFromPin, setWiringFromPin] = useState<{ pinId: string; x: number; y: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingBlock, setDraggingBlock] = useState<{
    id: string;
    kind: 'gate' | 'input' | 'output';
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  // Live Deterministic Evaluation
  const evalResult = useMemo(() => {
    return evaluateSchematic(model);
  }, [model]);

  // Handle pin toggle for inputs
  const handleToggleInput = (inputId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedInputs = model.inputs.map((inp) => {
      if (inp.id === inputId) {
        const nextVal = inp.currentValue === 1 ? 0 : 1;
        return { ...inp, currentValue: nextVal };
      }
      return inp;
    });
    onChange({ ...model, inputs: updatedInputs });
  };

  // Add Gate to Canvas
  const handleAddGate = (type: ClassicalGateType) => {
    const meta = GATE_TYPES.find((g) => g.type === type);
    const count = model.gates.filter((g) => g.type === type).length + 1;
    const newId = `G_${type}${count}`;
    const newGate: GateVisualBlock = {
      id: newId,
      type,
      x: 200 + (model.gates.length * 20) % 200,
      y: 120 + (model.gates.length * 30) % 260,
      fanIn: meta?.defaultFanIn ?? 2,
      label: `${type} ${count}`,
    };
    onChange({
      ...model,
      gates: [...model.gates, newGate],
    });
    setSelectedGateId(newId);
    onSelectGate?.(newGate);
  };

  // Delete Selected Gate or Element
  const handleDeleteSelected = () => {
    if (!selectedGateId) return;
    const updatedGates = model.gates.filter((g) => g.id !== selectedGateId);
    // Remove wires attached to this gate
    const updatedWires = model.wires.filter(
      (w) => !w.fromPinId.startsWith(`${selectedGateId}.`) && !w.toPinId.startsWith(`${selectedGateId}.`)
    );
    onChange({
      ...model,
      gates: updatedGates,
      wires: updatedWires,
    });
    setSelectedGateId(null);
    onSelectGate?.(null);
  };

  // Compute Pin Positions for Gates
  const getPinPos = (pinId: string): { x: number; y: number } | null => {
    // Check if input port
    const inputPort = model.inputs.find((p) => `${p.id}.pin` === pinId);
    if (inputPort) {
      return { x: inputPort.x + 36, y: inputPort.y + 16 };
    }
    // Check if output port
    const outputPort = model.outputs.find((p) => `${p.id}.pin` === pinId);
    if (outputPort) {
      return { x: outputPort.x, y: outputPort.y + 16 };
    }
    // Check if gate output
    for (const g of model.gates) {
      if (`${g.id}.out` === pinId) {
        return { x: g.x + 90, y: g.y + 30 };
      }
      for (let i = 0; i < g.fanIn; i++) {
        if (`${g.id}.in[${i}]` === pinId) {
          const spacing = 50 / (g.fanIn + 1);
          return { x: g.x, y: g.y + spacing * (i + 1) };
        }
      }
    }
    return null;
  };

  // SVG Mouse handlers for dragging and wiring
  const getSvgCoordinates = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = 900 / (rect.width || 900);
    const scaleY = 500 / (rect.height || 500);
    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;
    const x = Math.round(rawX / GRID_SIZE) * GRID_SIZE;
    const y = Math.round(rawY / GRID_SIZE) * GRID_SIZE;
    return { x: Math.max(0, Math.min(900, x)), y: Math.max(0, Math.min(500, y)) };
  };

  const handleSvgMouseMove = (e: React.MouseEvent) => {
    const coords = getSvgCoordinates(e);
    setMousePos(coords);

    if (draggingBlock) {
      const snapX = Math.round((coords.x - draggingBlock.offsetX) / GRID_SIZE) * GRID_SIZE;
      const snapY = Math.round((coords.y - draggingBlock.offsetY) / GRID_SIZE) * GRID_SIZE;

      if (draggingBlock.kind === 'gate') {
        const updated = model.gates.map((g) =>
          g.id === draggingBlock.id ? { ...g, x: Math.max(80, Math.min(760, snapX)), y: Math.max(40, Math.min(420, snapY)) } : g
        );
        onChange({ ...model, gates: updated });
      } else if (draggingBlock.kind === 'input') {
        const updated = model.inputs.map((inp) =>
          inp.id === draggingBlock.id ? { ...inp, y: Math.max(40, Math.min(440, snapY)) } : inp
        );
        onChange({ ...model, inputs: updated });
      } else if (draggingBlock.kind === 'output') {
        const updated = model.outputs.map((outp) =>
          outp.id === draggingBlock.id ? { ...outp, y: Math.max(40, Math.min(440, snapY)) } : outp
        );
        onChange({ ...model, outputs: updated });
      }
    }
  };

  const handleSvgMouseUp = () => {
    setDraggingBlock(null);
  };

  const handlePinMouseDown = (pinId: string, isOutput: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isOutput) {
      const pos = getPinPos(pinId);
      if (pos) {
        setWiringFromPin({ pinId, x: pos.x, y: pos.y });
      }
    } else if (wiringFromPin) {
      // Connect wire: wiringFromPin -> this input pin
      // Check if this input pin is already driven, remove old wire if present
      const filteredWires = model.wires.filter((w) => w.toPinId !== pinId);
      const newWire: WireSegment = {
        id: `w_${Date.now()}`,
        fromPinId: wiringFromPin.pinId,
        toPinId: pinId,
        netId: `net_${wiringFromPin.pinId}`,
      };
      onChange({
        ...model,
        wires: [...filteredWires, newWire],
      });
      setWiringFromPin(null);
    }
  };

  const handleCanvasClick = () => {
    setSelectedGateId(null);
    setWiringFromPin(null);
    onSelectGate?.(null);
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>

      {/* Compact I/O + Status toolbar — always visible above the canvas */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#0b1325', borderBottom: '1px solid #1a2744',
        padding: '5px 12px', flexShrink: 0, gap: 8, fontSize: '0.75rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Add Input Port */}
          <button
            onClick={() => {
              const idx = model.inputs.length;
              const names = ['a','b','c','d','e','f','g','h'];
              const newPort: PortVisualBlock = {
                id: `p_in_${idx}`,
                name: names[idx] ?? `in${idx}`,
                direction: 'input',
                x: 30,
                y: 60 + idx * 80,
                bitWidth: 1,
                currentValue: 0,
              };
              onChange({ ...model, inputs: [...model.inputs, newPort] });
            }}
            style={{ background: '#064e3b', color: '#34d399', border: '1px solid #059669', borderRadius: 4, padding: '3px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.70rem', fontWeight: 600 }}
            title="Add input port"
          >
            <Plus size={11} /> Input
          </button>

          {/* Add Output Port */}
          <button
            onClick={() => {
              const idx = model.outputs.length;
              const names = ['y','z','out0','out1','out2','out3'];
              const newPort: PortVisualBlock = {
                id: `p_out_${idx}`,
                name: names[idx] ?? `out${idx}`,
                direction: 'output',
                x: 810,
                y: 60 + idx * 80,
                bitWidth: 1,
              };
              onChange({ ...model, outputs: [...model.outputs, newPort] });
            }}
            style={{ background: '#1e1b4b', color: '#a5b4fc', border: '1px solid #4338ca', borderRadius: 4, padding: '3px 9px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.70rem', fontWeight: 600 }}
            title="Add output port"
          >
            <Plus size={11} /> Output
          </button>

          {/* Delete selected gate */}
          {selectedGateId && (
            <button onClick={handleDeleteSelected} className="v-btn-danger">
              <Trash2 size={12} /> Delete Gate
            </button>
          )}

          {/* Clear All */}
          <button
            onClick={() => onChange({ ...model, gates: [], wires: [] })}
            style={{ background: 'transparent', color: '#64748b', border: '1px solid #1e293b', borderRadius: 4, padding: '3px 9px', cursor: 'pointer', fontSize: '0.70rem', display: 'flex', alignItems: 'center', gap: 4 }}
            title="Clear gates and wires (keep I/O ports)"
          >
            <RotateCcw size={11} /> Clear Gates
          </button>
        </div>

        {/* Validation status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#334155', fontSize: '0.68rem' }}>
            {model.inputs.length}in · {model.outputs.length}out · {model.gates.length} gates
          </span>
          {evalResult.isValid ? (
            <div className="v-status-badge valid">
              <CheckCircle2 size={12} /> Valid Schematic
            </div>
          ) : (
            <div className="v-status-badge error" title={evalResult.errors.join(' | ')}>
              <AlertTriangle size={12} /> {evalResult.errors[0]?.slice(0, 40) || 'Validation issue'}
            </div>
          )}
        </div>
      </div>

      {/* IEEE-style Gate Palette — Floating Toolbox */}
      <FloatingToolbox title="🔌 Classical Gates" defaultPosition={{ x: 16, y: 200 }} accentColor="#10b981" width={120}>
        <div style={{ padding: '8px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {GATE_TYPES.map((g) => (
            <button
              key={g.type}
              onClick={() => handleAddGate(g.type)}
              title={`Place ${g.label}`}
              style={{
                background: '#0d1a2e',
                border: `1px solid ${g.color}55`,
                borderRadius: 6,
                padding: '6px 4px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${g.color}22`; (e.currentTarget as HTMLButtonElement).style.borderColor = g.color; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#0d1a2e'; (e.currentTarget as HTMLButtonElement).style.borderColor = `${g.color}55`; }}
            >
              {/* IEEE-style SVG gate symbol */}
              <svg width="56" height="34" viewBox="0 0 56 34">
                {g.type === 'AND' && (
                  <g stroke={g.color} strokeWidth="1.5" fill="none">
                    <path d="M 8 6 L 26 6 C 42 6 42 28 26 28 L 8 28 Z" />
                    <line x1="0" y1="12" x2="8" y2="12" /><line x1="0" y1="22" x2="8" y2="22" />
                    <line x1="42" y1="17" x2="56" y2="17" />
                  </g>
                )}
                {g.type === 'OR' && (
                  <g stroke={g.color} strokeWidth="1.5" fill="none">
                    <path d="M 6 6 Q 16 6 34 17 Q 16 28 6 28 Q 12 17 6 6 Z" />
                    <line x1="0" y1="11" x2="11" y2="11" /><line x1="0" y1="23" x2="11" y2="23" />
                    <line x1="34" y1="17" x2="56" y2="17" />
                  </g>
                )}
                {g.type === 'XOR' && (
                  <g stroke={g.color} strokeWidth="1.5" fill="none">
                    <path d="M 10 6 Q 20 6 38 17 Q 20 28 10 28 Q 16 17 10 6 Z" />
                    <path d="M 4 6 Q 10 17 4 28" />
                    <line x1="0" y1="11" x2="11" y2="11" /><line x1="0" y1="23" x2="11" y2="23" />
                    <line x1="38" y1="17" x2="56" y2="17" />
                  </g>
                )}
                {g.type === 'NAND' && (
                  <g stroke={g.color} strokeWidth="1.5" fill="none">
                    <path d="M 8 6 L 22 6 C 36 6 36 28 22 28 L 8 28 Z" />
                    <circle cx="40" cy="17" r="4" />
                    <line x1="0" y1="12" x2="8" y2="12" /><line x1="0" y1="22" x2="8" y2="22" />
                    <line x1="44" y1="17" x2="56" y2="17" />
                  </g>
                )}
                {g.type === 'NOR' && (
                  <g stroke={g.color} strokeWidth="1.5" fill="none">
                    <path d="M 6 6 Q 14 6 30 17 Q 14 28 6 28 Q 12 17 6 6 Z" />
                    <circle cx="34" cy="17" r="4" />
                    <line x1="0" y1="11" x2="9" y2="11" /><line x1="0" y1="23" x2="9" y2="23" />
                    <line x1="38" y1="17" x2="56" y2="17" />
                  </g>
                )}
                {g.type === 'NOT' && (
                  <g stroke={g.color} strokeWidth="1.5" fill="none">
                    <polygon points="6,6 34,17 6,28" />
                    <circle cx="38" cy="17" r="4" />
                    <line x1="0" y1="17" x2="6" y2="17" />
                    <line x1="42" y1="17" x2="56" y2="17" />
                  </g>
                )}
                {g.type === 'BUFFER' && (
                  <g stroke={g.color} strokeWidth="1.5" fill="none">
                    <polygon points="6,6 38,17 6,28" />
                    <line x1="0" y1="17" x2="6" y2="17" />
                    <line x1="38" y1="17" x2="56" y2="17" />
                  </g>
                )}
              </svg>
              <span style={{ fontSize: '0.62rem', color: g.color, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.02em' }}>
                {g.type}
              </span>
            </button>
          ))}
        </div>
      </FloatingToolbox>

      {/* Main Interactive SVG Canvas */}
      <div className="v-canvas-viewport" style={{ flex: 1, minHeight: 0 }}>
        <svg
          ref={svgRef}
          className="v-canvas-svg"
          viewBox="0 0 900 500"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onClick={handleCanvasClick}
        >
          <defs>
            {/* Arrowhead marker if needed */}
            <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
          </defs>

          {/* Left Boundary: Input Port Pins */}
          {model.inputs.map((inp) => {
            const pinId = `${inp.id}.pin`;
            const val = inp.currentValue ?? 0;
            const isHigh = val === 1;

            return (
              <g
                key={inp.id}
                transform={`translate(${inp.x}, ${inp.y})`}
                className="cursor-pointer group"
                onClick={(e) => handleToggleInput(inp.id, e)}
              >
                {/* Clickable logic toggle box */}
                <rect
                  x="0"
                  y="0"
                  width="36"
                  height="32"
                  rx="4"
                  fill={isHigh ? '#065f46' : '#1e293b'}
                  stroke={isHigh ? '#10b981' : '#475569'}
                  strokeWidth="1.5"
                  className="transition-colors duration-150"
                />
                <text
                  x="18"
                  y="20"
                  textAnchor="middle"
                  fill={isHigh ? '#34d399' : '#94a3b8'}
                  className="font-mono font-bold text-xs select-none"
                >
                  {inp.name}={val}
                </text>

                {/* Pin Terminal */}
                <circle
                  cx="36"
                  cy="16"
                  r="5"
                  fill={isHigh ? '#10b981' : '#475569'}
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="hover:scale-125 transition-transform"
                  onMouseDown={(e) => handlePinMouseDown(pinId, true, e)}
                />
              </g>
            );
          })}

          {/* Right Boundary: Output Port Probes */}
          {model.outputs.map((outp) => {
            const pinId = `${outp.id}.pin`;
            const liveVal = evalResult.outputValues[outp.name] ?? 0;
            const isHigh = liveVal === 1;

            return (
              <g
                key={outp.id}
                transform={`translate(${outp.x}, ${outp.y})`}
                className="group select-none"
              >
                {/* Input Pin Terminal */}
                <circle
                  cx="0"
                  cy="16"
                  r="5"
                  fill={isHigh ? '#10b981' : '#475569'}
                  stroke="#0f172a"
                  strokeWidth="2"
                  className="hover:scale-125 transition-transform cursor-pointer"
                  onMouseDown={(e) => handlePinMouseDown(pinId, false, e)}
                />

                {/* Probe Display Box */}
                <rect
                  x="0"
                  y="0"
                  width="44"
                  height="32"
                  rx="4"
                  fill={isHigh ? '#064e3b' : '#0f172a'}
                  stroke={isHigh ? '#059669' : '#334155'}
                  strokeWidth="1.5"
                />
                <text
                  x="22"
                  y="20"
                  textAnchor="middle"
                  fill={isHigh ? '#6ee7b7' : '#cbd5e1'}
                  className="font-mono font-bold text-xs"
                >
                  {outp.name}={liveVal}
                </text>
              </g>
            );
          })}

          {/* Render All Wires */}
          {model.wires.map((wire) => {
            const startPos = getPinPos(wire.fromPinId);
            const endPos = getPinPos(wire.toPinId);
            if (!startPos || !endPos) return null;

            // Determine if wire signal level is high
            // Extract driver net
            let isHigh = false;
            for (const [net, lvl] of Object.entries(evalResult.netLevels)) {
              if (wire.fromPinId.includes(net.replace('net_', '')) || wire.netId === net) {
                isHigh = lvl === 1;
                break;
              }
            }

            const strokeColor = isHigh ? '#22c55e' : '#15803d';
            const midX = Math.round((startPos.x + endPos.x) / (2 * GRID_SIZE)) * GRID_SIZE;

            // Orthogonal path: start -> (midX, start.y) -> (midX, end.y) -> end
            const pathD = `M ${startPos.x} ${startPos.y} L ${midX} ${startPos.y} L ${midX} ${endPos.y} L ${endPos.x} ${endPos.y}`;

            return (
              <g key={wire.id} className="group">
                {/* Thick invisible hover target */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="10"
                  className="cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    // Remove wire on click
                    onChange({
                      ...model,
                      wires: model.wires.filter((w) => w.id !== wire.id),
                    });
                  }}
                />
                {/* Rendered Wire */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-colors duration-150"
                />
                {/* Junction Dot on midpoint bend */}
                <circle cx={midX} cy={endPos.y} r="2.5" fill={strokeColor} />
              </g>
            );
          })}

          {/* Active Wiring Drag Line */}
          {wiringFromPin && (
            <line
              x1={wiringFromPin.x}
              y1={wiringFromPin.y}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="#38bdf8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {/* Logic Gate Blocks */}
          {model.gates.map((g) => {
            const isSelected = g.id === selectedGateId;
            const gateMeta = GATE_TYPES.find((item) => item.type === g.type);
            const gateColor = gateMeta?.color || '#3b82f6';
            const pinSpacing = 50 / (g.fanIn + 1);

            return (
              <g
                key={g.id}
                transform={`translate(${g.x}, ${g.y})`}
                className="cursor-move"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedGateId(g.id);
                  onSelectGate?.(g);
                }}
                onMouseDown={(e) => {
                  const coords = getSvgCoordinates(e);
                  setDraggingBlock({
                    id: g.id,
                    kind: 'gate',
                    offsetX: coords.x - g.x,
                    offsetY: coords.y - g.y,
                  });
                }}
              >
                {/* Gate Body Box */}
                <rect
                  x="0"
                  y="0"
                  width="90"
                  height="60"
                  rx="6"
                  fill="#0f172a"
                  stroke={isSelected ? '#38bdf8' : gateColor}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
                  filter={isSelected ? 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.4))' : undefined}
                />

                {/* Gate Label & Type */}
                <text
                  x="45"
                  y="28"
                  textAnchor="middle"
                  fill="#f8fafc"
                  className="font-mono font-bold text-sm select-none"
                >
                  {g.type}
                </text>
                <text
                  x="45"
                  y="46"
                  textAnchor="middle"
                  fill="#94a3b8"
                  className="font-mono text-[10px] select-none"
                >
                  {g.label || g.id}
                </text>

                {/* Input Pins */}
                {Array.from({ length: g.fanIn }).map((_, idx) => {
                  const py = pinSpacing * (idx + 1);
                  const inPinId = `${g.id}.in[${idx}]`;
                  return (
                    <g key={inPinId}>
                      <line x1="-8" y1={py} x2="0" y2={py} stroke="#64748b" strokeWidth="1.5" />
                      <circle
                        cx="-8"
                        cy={py}
                        r="4"
                        fill="#334155"
                        stroke="#0f172a"
                        strokeWidth="1.5"
                        className="hover:fill-sky-400 transition-colors cursor-pointer"
                        onMouseDown={(e) => handlePinMouseDown(inPinId, false, e)}
                      />
                    </g>
                  );
                })}

                {/* Output Pin */}
                <g>
                  <line x1="90" y1="30" x2="98" y2="30" stroke="#64748b" strokeWidth="1.5" />
                  <circle
                    cx="98"
                    cy="30"
                    r="4"
                    fill={gateColor}
                    stroke="#0f172a"
                    strokeWidth="1.5"
                    className="hover:scale-125 transition-transform cursor-pointer"
                    onMouseDown={(e) => handlePinMouseDown(`${g.id}.out`, true, e)}
                  />
                </g>
              </g>
            );
          })}
        </svg>

        {/* Floating Controls Overlay */}
        <div className="v-canvas-hint">
          <span>💡 Click input boxes to toggle 0/1 bits</span>
          <span>•</span>
          <span>Drag from output circle to input circle to wire</span>
          <span>•</span>
          <span>Click wire to remove</span>
        </div>
      </div>
    </div>
  );
};
