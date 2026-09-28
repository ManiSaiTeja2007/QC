import React from 'react';
import {
  PortMapping,
  AncillaContract,
  VerificationMode,
  Endianness,
} from '../../types/verilog';
import { Cpu, Plus, Trash2, ShieldCheck } from 'lucide-react';

interface PortMappingConfigProps {
  inputPorts: PortMapping[];
  outputPorts: PortMapping[];
  ancillas: AncillaContract[];
  mode: VerificationMode;
  numShots: number;
  totalQubits: number;
  onUpdateInputPorts: (ports: PortMapping[]) => void;
  onUpdateOutputPorts: (ports: PortMapping[]) => void;
  onUpdateAncillas: (ancillas: AncillaContract[]) => void;
  onUpdateMode: (mode: VerificationMode) => void;
  onUpdateNumShots: (shots: number) => void;
}

export const PortMappingConfig: React.FC<PortMappingConfigProps> = ({
  inputPorts,
  outputPorts,
  ancillas,
  mode,
  numShots,
  totalQubits,
  onUpdateInputPorts,
  onUpdateOutputPorts,
  onUpdateAncillas,
  onUpdateMode,
  onUpdateNumShots,
}) => {
  const handleAddInputPort = () => {
    onUpdateInputPorts([
      ...inputPorts,
      {
        name: `in_${inputPorts.length}`,
        direction: 'input',
        bit_width: 1,
        qubit_indices: [Math.min(inputPorts.length, Math.max(0, totalQubits - 1))],
        endianness: 'little_endian',
      },
    ]);
  };

  const handleRemoveInputPort = (idx: number) => {
    onUpdateInputPorts(inputPorts.filter((_, i) => i !== idx));
  };

  const handleAddOutputPort = () => {
    onUpdateOutputPorts([
      ...outputPorts,
      {
        name: `out_${outputPorts.length}`,
        direction: 'output',
        bit_width: 1,
        qubit_indices: [Math.min(totalQubits - 1, outputPorts.length + inputPorts.length)],
        endianness: 'little_endian',
      },
    ]);
  };

  const handleRemoveOutputPort = (idx: number) => {
    onUpdateOutputPorts(outputPorts.filter((_, i) => i !== idx));
  };

  const handleAddAncilla = () => {
    onUpdateAncillas([
      ...ancillas,
      {
        qubit_index: Math.max(0, totalQubits - 1),
        expected_clean_state: 0,
        name: `anc_${ancillas.length}`,
      },
    ]);
  };

  const handleRemoveAncilla = (idx: number) => {
    onUpdateAncillas(ancillas.filter((_, i) => i !== idx));
  };

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-3 text-xs flex flex-col gap-3">
      {/* Verification Mode & Shots Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu size={14} className="text-amber-400" />
          <span className="font-semibold text-slate-300 uppercase tracking-wider text-[11px]">
            Canonical Verification Contract
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Mode:</span>
            <select
              value={mode}
              onChange={(e) => onUpdateMode(e.target.value as VerificationMode)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2 py-0.5 focus:outline-none focus:border-amber-500"
            >
              <option value="statevector_ideal">Ideal Statevector (100% Precision)</option>
              <option value="shot_measurement">Noisy / Measurement Shots</option>
            </select>
          </div>

          {mode === 'shot_measurement' && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[11px]">Shots:</span>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={numShots}
                onChange={(e) => onUpdateNumShots(parseInt(e.target.value, 10) || 1024)}
                className="w-16 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-1.5 py-0.5 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* Input Ports Mapping */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-amber-300 text-[11px] uppercase">
            Input Ports ({inputPorts.reduce((acc, p) => acc + p.bit_width, 0)} bits)
          </span>
          <button
            onClick={handleAddInputPort}
            className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800"
          >
            <Plus size={11} /> Add Port
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {inputPorts.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded border border-slate-700 font-mono text-xs">
              <input
                type="text"
                value={p.name}
                onChange={(e) => {
                  const updated = [...inputPorts];
                  updated[idx].name = e.target.value;
                  onUpdateInputPorts(updated);
                }}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                placeholder="port_name"
              />
              <span className="text-slate-500">w:</span>
              <input
                type="number"
                min={1}
                max={8}
                value={p.bit_width}
                onChange={(e) => {
                  const w = Math.max(1, parseInt(e.target.value, 10) || 1);
                  const updated = [...inputPorts];
                  updated[idx].bit_width = w;
                  // adjust qubit indices count
                  while (updated[idx].qubit_indices.length < w) {
                    updated[idx].qubit_indices.push(updated[idx].qubit_indices.length);
                  }
                  updated[idx].qubit_indices = updated[idx].qubit_indices.slice(0, w);
                  onUpdateInputPorts(updated);
                }}
                className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-slate-200"
              />
              <span className="text-slate-500">qubits:</span>
              <input
                type="text"
                value={p.qubit_indices.join(',')}
                onChange={(e) => {
                  const parts = e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                  if (parts.length > 0) {
                    const updated = [...inputPorts];
                    updated[idx].qubit_indices = parts;
                    updated[idx].bit_width = parts.length;
                    onUpdateInputPorts(updated);
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                placeholder="e.g. 0,1"
              />
              {inputPorts.length > 1 && (
                <button
                  onClick={() => handleRemoveInputPort(idx)}
                  className="text-slate-500 hover:text-rose-400 p-0.5"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Output Ports Mapping */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-indigo-300 text-[11px] uppercase">
            Target Output Ports ({outputPorts.reduce((acc, p) => acc + p.bit_width, 0)} bits)
          </span>
          <button
            onClick={handleAddOutputPort}
            className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800"
          >
            <Plus size={11} /> Add Port
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {outputPorts.map((p, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded border border-slate-700 font-mono text-xs">
              <input
                type="text"
                value={p.name}
                onChange={(e) => {
                  const updated = [...outputPorts];
                  updated[idx].name = e.target.value;
                  onUpdateOutputPorts(updated);
                }}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                placeholder="port_name"
              />
              <span className="text-slate-500">w:</span>
              <input
                type="number"
                min={1}
                max={8}
                value={p.bit_width}
                onChange={(e) => {
                  const w = Math.max(1, parseInt(e.target.value, 10) || 1);
                  const updated = [...outputPorts];
                  updated[idx].bit_width = w;
                  while (updated[idx].qubit_indices.length < w) {
                    updated[idx].qubit_indices.push(updated[idx].qubit_indices.length);
                  }
                  updated[idx].qubit_indices = updated[idx].qubit_indices.slice(0, w);
                  onUpdateOutputPorts(updated);
                }}
                className="w-10 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-slate-200"
              />
              <span className="text-slate-500">qubits:</span>
              <input
                type="text"
                value={p.qubit_indices.join(',')}
                onChange={(e) => {
                  const parts = e.target.value.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
                  if (parts.length > 0) {
                    const updated = [...outputPorts];
                    updated[idx].qubit_indices = parts;
                    updated[idx].bit_width = parts.length;
                    onUpdateOutputPorts(updated);
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                placeholder="e.g. 2,3"
              />
              {outputPorts.length > 1 && (
                <button
                  onClick={() => handleRemoveOutputPort(idx)}
                  className="text-slate-500 hover:text-rose-400 p-0.5"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Ancillae Cleanliness Checks */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-emerald-300 text-[11px] uppercase flex items-center gap-1">
            <ShieldCheck size={12} /> Ancilla Cleanliness Checks ({ancillas.length})
          </span>
          <button
            onClick={handleAddAncilla}
            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800"
          >
            <Plus size={11} /> Add Ancilla
          </button>
        </div>
        {ancillas.length === 0 ? (
          <div className="text-[11px] text-slate-500 italic p-1">
            No ancilla uncomputation checks specified.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {ancillas.map((anc, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded border border-slate-700 font-mono text-xs">
                <span className="text-slate-400">Qubit:</span>
                <input
                  type="number"
                  min={0}
                  max={totalQubits - 1}
                  value={anc.qubit_index}
                  onChange={(e) => {
                    const updated = [...ancillas];
                    updated[idx].qubit_index = parseInt(e.target.value, 10) || 0;
                    onUpdateAncillas(updated);
                  }}
                  className="w-12 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-center text-slate-200"
                />
                <span className="text-slate-400">Expected State:</span>
                <select
                  value={anc.expected_clean_state}
                  onChange={(e) => {
                    const updated = [...ancillas];
                    updated[idx].expected_clean_state = parseInt(e.target.value, 10) || 0;
                    onUpdateAncillas(updated);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-slate-200"
                >
                  <option value={0}>|0⟩ Clean</option>
                  <option value={1}>|1⟩ Clean</option>
                </select>
                <button
                  onClick={() => handleRemoveAncilla(idx)}
                  className="text-slate-500 hover:text-rose-400 p-0.5 ml-auto"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
