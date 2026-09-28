import React, { useState } from 'react';
import { Cpu, Plus, Trash2, ArrowRight, Sparkles } from 'lucide-react';

interface IOSetupPanelProps {
  onConfirm: (inputs: Array<{ name: string }>, outputs: Array<{ name: string }>) => void;
  builderContract?: { num_qubits: number; input_bits: number[] } | null;
  onDismissBuilderHint?: () => void;
}

const DEFAULT_INPUT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const DEFAULT_OUTPUT_NAMES = ['y', 'z', 'out0', 'out1', 'out2', 'out3'];

export const IOSetupPanel: React.FC<IOSetupPanelProps> = ({
  onConfirm,
  builderContract,
  onDismissBuilderHint,
}) => {
  const [inputs, setInputs] = useState<string[]>(['a', 'b']);
  const [outputs, setOutputs] = useState<string[]>(['y']);
  const [showBuilderHint, setShowBuilderHint] = useState<boolean>(true);

  // Template presets
  const applyTemplate = (type: 'and' | 'or' | 'xor' | 'half_adder' | 'full_adder') => {
    switch (type) {
      case 'and':
      case 'or':
      case 'xor':
        setInputs(['a', 'b']);
        setOutputs(['y']);
        break;
      case 'half_adder':
        setInputs(['a', 'b']);
        setOutputs(['sum', 'cout']);
        break;
      case 'full_adder':
        setInputs(['a', 'b', 'cin']);
        setOutputs(['sum', 'cout']);
        break;
    }
  };

  const handleAddInput = () => {
    if (inputs.length >= 8) return;
    const nextName = DEFAULT_INPUT_NAMES[inputs.length] || `in${inputs.length}`;
    setInputs([...inputs, nextName]);
  };

  const handleRemoveInput = (idx: number) => {
    if (inputs.length <= 1) return;
    setInputs(inputs.filter((_, i) => i !== idx));
  };

  const handleAddOutput = () => {
    if (outputs.length >= 4) return;
    const nextName = DEFAULT_OUTPUT_NAMES[outputs.length] || `out${outputs.length}`;
    setOutputs([...outputs, nextName]);
  };

  const handleRemoveOutput = (idx: number) => {
    if (outputs.length <= 1) return;
    setOutputs(outputs.filter((_, i) => i !== idx));
  };

  const handleAcceptBuilderContract = () => {
    if (!builderContract) return;
    const numQubits = Math.max(1, builderContract.num_qubits || 1);
    const inCount = builderContract.input_bits?.length ? Math.min(numQubits - 1, builderContract.input_bits.length) : Math.floor(numQubits / 2) || 1;
    const outCount = Math.max(1, numQubits - inCount);

    const newIns = Array.from({ length: inCount }, (_, i) => DEFAULT_INPUT_NAMES[i] || `in${i}`);
    const newOuts = Array.from({ length: outCount }, (_, i) => DEFAULT_OUTPUT_NAMES[i] || `out${i}`);

    setInputs(newIns);
    setOutputs(newOuts);
    setShowBuilderHint(false);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      padding: 24,
      boxSizing: 'border-box',
    }}>
      <div style={{
        maxWidth: 580,
        width: '100%',
        background: '#090f1d',
        border: '1px solid #1e293b',
        borderRadius: 12,
        padding: '24px 28px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        color: '#f1f5f9',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.15)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#38bdf8',
            padding: 8,
            borderRadius: 8,
          }}>
            <Cpu size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
              Define Classical Circuit Interface
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '3px 0 0 0' }}>
              Configure inputs and outputs before placing gates on the schematic canvas
            </p>
          </div>
        </div>

        {/* Builder Hint Banner */}
        {showBuilderHint && builderContract && (
          <div style={{
            background: 'rgba(14, 165, 233, 0.1)',
            border: '1px solid rgba(14, 165, 233, 0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: '0.78rem',
          }}>
            <span style={{ color: '#7dd3fc' }}>
              📥 <b>Active Quantum Circuit:</b> {builderContract.num_qubits} qubits detected in Quantum Builder. Auto-derive classical ports?
            </span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                onClick={handleAcceptBuilderContract}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Accept
              </button>
              <button
                onClick={() => {
                  setShowBuilderHint(false);
                  onDismissBuilderHint?.();
                }}
                style={{
                  background: 'transparent',
                  color: '#94a3b8',
                  border: '1px solid #334155',
                  borderRadius: 4,
                  padding: '4px 8px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Template Quick Starts */}
        <div style={{ marginBottom: 20 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Quick Presets / Templates:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {[
              { id: 'and', label: 'AND Gate (2→1)' },
              { id: 'or', label: 'OR Gate (2→1)' },
              { id: 'xor', label: 'XOR Gate (2→1)' },
              { id: 'half_adder', label: 'Half Adder (2→2)' },
              { id: 'full_adder', label: 'Full Adder (3→2)' },
            ].map((tmpl) => (
              <button
                key={tmpl.id}
                onClick={() => applyTemplate(tmpl.id as any)}
                style={{
                  background: '#131d33',
                  border: '1px solid #1e293b',
                  color: '#cbd5e1',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#38bdf8';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#1e293b';
                  e.currentTarget.style.color = '#cbd5e1';
                }}
              >
                <Sparkles size={11} style={{ color: '#38bdf8' }} />
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs Configuration */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>
              Inputs ({inputs.length})
            </span>
            <button
              onClick={handleAddInput}
              disabled={inputs.length >= 8}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: '#34d399',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: '0.70rem',
                cursor: inputs.length >= 8 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={11} /> Add Input
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {inputs.map((name, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#040814',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  padding: '3px 6px',
                  gap: 4,
                }}
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value.trim().toLowerCase();
                    setInputs(inputs.map((v, i) => (i === idx ? val : v)));
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    width: 44,
                    outline: 'none',
                  }}
                />
                {inputs.length > 1 && (
                  <button
                    onClick={() => handleRemoveInput(idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remove input"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Outputs Configuration */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#818cf8' }}>
              Outputs ({outputs.length})
            </span>
            <button
              onClick={handleAddOutput}
              disabled={outputs.length >= 4}
              style={{
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                color: '#a5b4fc',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: '0.70rem',
                cursor: outputs.length >= 4 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Plus size={11} /> Add Output
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {outputs.map((name, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#040814',
                  border: '1px solid #1e293b',
                  borderRadius: 4,
                  padding: '3px 6px',
                  gap: 4,
                }}
              >
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value.trim().toLowerCase();
                    setOutputs(outputs.map((v, i) => (i === idx ? val : v)));
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#f8fafc',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    width: 44,
                    outline: 'none',
                  }}
                />
                {outputs.length > 1 && (
                  <button
                    onClick={() => handleRemoveOutput(idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 1,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remove output"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            const formattedInputs = inputs.filter(Boolean).map((name) => ({ name }));
            const formattedOutputs = outputs.filter(Boolean).map((name) => ({ name }));
            onConfirm(
              formattedInputs.length > 0 ? formattedInputs : [{ name: 'a' }],
              formattedOutputs.length > 0 ? formattedOutputs : [{ name: 'y' }]
            );
          }}
          style={{
            width: '100%',
            background: 'linear-gradient(90deg, #059669, #10b981)',
            color: '#022c22',
            fontWeight: 700,
            border: 'none',
            borderRadius: 8,
            padding: '10px 16px',
            fontSize: '0.84rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
          }}
        >
          <span>Create Classical Schematic</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
};
