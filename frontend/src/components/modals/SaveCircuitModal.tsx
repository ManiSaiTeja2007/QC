import React, { useState, useEffect } from 'react';
import { CircuitFileSchema, CircuitGate } from '../../types/circuit';
import { PlacedGate } from '../builder/CircuitCanvas';
import { validateCircuitJson, uploadCircuitJson, updateCircuitJson } from '../../services/api';
import { circuitStore } from '../../services/circuitStore';

interface LoadedCircuitMeta {
  id: string;
  name: string;
  description: string;
  category: string;
  readonly: boolean;
}

interface SaveCircuitModalProps {
  onClose: () => void;
  numQubits: number;
  inputBits: number[];
  placedGates: PlacedGate[];
  loadedMeta: LoadedCircuitMeta | null;
  onSavedSuccess: (savedCircuit: CircuitFileSchema) => void;
}

function slugifyName(name: string): string {
  const clean = name.trim().toLowerCase().replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return clean.slice(0, 36) || 'custom_circuit';
}

export const SaveCircuitModal: React.FC<SaveCircuitModalProps> = ({
  onClose,
  numQubits,
  inputBits,
  placedGates,
  loadedMeta,
  onSavedSuccess,
}) => {
  const isBuiltin = loadedMeta?.readonly === true;
  const isExistingCustom = loadedMeta && !loadedMeta.readonly;

  const [saveMode, setSaveMode] = useState<'update' | 'new'>(
    isExistingCustom ? 'update' : 'new'
  );
  const [name, setName] = useState<string>(
    isBuiltin
      ? `Copy of ${loadedMeta.name}`
      : loadedMeta
      ? loadedMeta.name
      : 'My Custom Circuit'
  );
  const [description, setDescription] = useState<string>(
    loadedMeta ? loadedMeta.description : 'Custom quantum circuit created in Circuit Builder.'
  );
  const [category, setCategory] = useState<string>(
    loadedMeta ? loadedMeta.category : 'Custom'
  );

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Escape key handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Circuit name is required.');
      return;
    }
    if (placedGates.length === 0) {
      setErrorMsg('Cannot save an empty circuit. Place at least one gate on the canvas.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    // Convert placedGates to standardized CircuitGate list
    const sortedGates = [...placedGates].sort((a, b) => a.step - b.step);
    const gates: CircuitGate[] = sortedGates.map((g, idx) => ({
      name: g.name.toUpperCase(),
      qubits: g.qubits,
      params: g.params,
      step: idx + 1,
    }));

    // Generate circuit ID
    let circuitId: string;
    if (saveMode === 'update' && loadedMeta && !loadedMeta.readonly) {
      circuitId = loadedMeta.id;
    } else {
      const baseSlug = slugifyName(name);
      circuitId = `${baseSlug}_${Math.random().toString(36).substring(2, 7)}`;
    }

    const circuitPayload: CircuitFileSchema = {
      schema_version: '1.0',
      id: circuitId,
      name: name.trim(),
      description: description.trim(),
      category: category.trim() || 'Custom',
      num_qubits: numQubits,
      qubit_names: Array.from({ length: numQubits }, (_, i) => `Q${i}`),
      default_input_bits: inputBits.slice(0, numQubits),
      synthesis: 'universal',
      readonly: false, // Custom circuits are never readonly
      gates,
      metadata: {
        author: 'Quantum Circuit Builder User',
        created_at: new Date().toISOString(),
        tags: ['Custom', category.trim() || 'Custom', `${numQubits}-Qubit`],
      },
    };

    try {
      // 1. Authoritative Pre-Flight Semantic Validation
      const valReport = await validateCircuitJson(circuitPayload);
      if (!valReport.valid) {
        setErrorMsg(`Validation error: ${valReport.errors.join('; ')}`);
        setSubmitting(false);
        return;
      }

      // 2. Submit to appropriate endpoint
      if (saveMode === 'update' && loadedMeta && !loadedMeta.readonly) {
        await updateCircuitJson(circuitId, circuitPayload);
      } else {
        await uploadCircuitJson(circuitPayload);
      }

      circuitStore.setCircuit(circuitPayload);
      onSavedSuccess(circuitPayload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(13, 19, 33, 0.98)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 12,
          maxWidth: 520,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(16, 185, 129, 0.2)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(59, 130, 246, 0.1))',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>💾</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399', letterSpacing: '0.04em' }}>
                Save Circuit to Library
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                {numQubits} Qubits · {placedGates.length} Gates · Input bits: [{inputBits.slice(0, numQubits).join(',')}]
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 6,
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 12,
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Built-in Protection Alert */}
          {isBuiltin && (
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 11,
                color: '#bae6fd',
                lineHeight: 1.5,
              }}
            >
              🔒 <strong>Built-in Benchmark Protected:</strong> You modified system benchmark{' '}
              <em>'{loadedMeta.name}'</em>. The original circuit is read-only and immutable. Your changes will be saved as a{' '}
              <strong>NEW custom circuit</strong> in your library.
            </div>
          )}

          {/* Mode Selector for Custom Circuits */}
          {isExistingCustom && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>
                Save Target Option
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: saveMode === 'update' ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                    background: saveMode === 'update' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: saveMode === 'update' ? '#93c5fd' : '#cbd5e1',
                  }}
                >
                  <input
                    type="radio"
                    name="saveMode"
                    value="update"
                    checked={saveMode === 'update'}
                    onChange={() => setSaveMode('update')}
                  />
                  <span>Update Existing ({loadedMeta.id})</span>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: saveMode === 'new' ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                    background: saveMode === 'new' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                    cursor: 'pointer',
                    fontSize: 11,
                    color: saveMode === 'new' ? '#93c5fd' : '#cbd5e1',
                  }}
                >
                  <input
                    type="radio"
                    name="saveMode"
                    value="new"
                    checked={saveMode === 'new'}
                    onChange={() => setSaveMode('new')}
                  />
                  <span>Save as New Circuit</span>
                </label>
              </div>
            </div>
          )}

          {/* Name Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
              Circuit Name <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 4-Bit Carry Lookahead Adder"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 12,
                color: '#f8fafc',
                outline: 'none',
              }}
              required
            />
          </div>

          {/* Category Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Custom, Arithmetic, Logic, Entanglement"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 12,
                color: '#f8fafc',
                outline: 'none',
              }}
            />
          </div>

          {/* Description Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the functionality and gates of this circuit..."
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '7px 10px',
                fontSize: 11,
                color: '#f8fafc',
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 11,
                color: '#fca5a5',
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                borderRadius: 6,
                padding: '7px 14px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={{
                background:
                  saveMode === 'update'
                    ? 'linear-gradient(90deg, #2563eb, #1d4ed8)'
                    : 'linear-gradient(90deg, #10b981, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '7px 16px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{submitting ? 'Saving...' : saveMode === 'update' ? '💾 Update Circuit' : '🚀 Save as New'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
