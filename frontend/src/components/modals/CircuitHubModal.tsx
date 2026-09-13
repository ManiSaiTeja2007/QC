import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CircuitIndexEntry,
  CircuitFileSchema,
  CircuitValidationResponse,
} from '../../types/circuit';
import {
  fetchCircuits,
  fetchCircuitDetails,
  validateCircuitJson,
  uploadCircuitFile,
  deleteStoredCircuit,
  getCircuitExportUrl,
} from '../../services/api';
import { circuitStore } from '../../services/circuitStore';

interface CircuitHubModalProps {
  onClose: () => void;
  onSimulateCircuit: (circuitId: string) => void;
  onOpenInBuilder: (circuit: CircuitFileSchema) => void;
}

export const CircuitHubModal: React.FC<CircuitHubModalProps> = ({
  onClose,
  onSimulateCircuit,
  onOpenInBuilder,
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'upload'>('catalog');
  const [circuits, setCircuits] = useState<CircuitIndexEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCircuitId, setSelectedCircuitId] = useState<string | null>(null);
  const [selectedCircuitDetail, setSelectedCircuitDetail] = useState<CircuitFileSchema | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Uploader State
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<CircuitValidationResponse | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard Escape listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load catalog
  const refreshCatalog = useCallback(async (selectIdAfter?: string, forceRefresh = false) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await circuitStore.getCatalog(forceRefresh);
      setCircuits(res.circuits);
      if (selectIdAfter) {
        setSelectedCircuitId(selectIdAfter);
      } else if (res.circuits.length > 0 && !selectedCircuitId) {
        setSelectedCircuitId(res.circuits[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Failed to load circuit library: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [selectedCircuitId]);

  useEffect(() => {
    refreshCatalog();
  }, []); // eslint-disable-line

  // Load circuit details on selection with in-memory caching
  useEffect(() => {
    if (!selectedCircuitId) {
      setSelectedCircuitDetail(null);
      return;
    }
    let isCurrent = true;
    setDetailLoading(true);
    circuitStore.getCircuit(selectedCircuitId)
      .then((detail) => {
        if (isCurrent) setSelectedCircuitDetail(detail);
      })
      .catch((err) => {
        if (isCurrent) {
          console.error('Failed to load circuit details:', err);
          setSelectedCircuitDetail(null);
        }
      })
      .finally(() => {
        if (isCurrent) setDetailLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedCircuitId]);

  // Categories list
  const categories = ['all', ...Array.from(new Set(circuits.map((c) => c.category)))];

  // Filtered circuits
  const filteredCircuits = circuits.filter((c) => {
    const matchesCategory = selectedCategory === 'all' || c.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  // Handle custom circuit deletion
  const handleDelete = async (circuitId: string) => {
    if (!window.confirm(`Are you sure you want to delete custom circuit '${circuitId}'?`)) {
      return;
    }
    setDeletingId(circuitId);
    try {
      await deleteStoredCircuit(circuitId);
      circuitStore.invalidateCircuit(circuitId);
      if (selectedCircuitId === circuitId) {
        setSelectedCircuitId(null);
        setSelectedCircuitDetail(null);
      }
      await refreshCatalog(undefined, true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Delete error: ${msg}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Uploader Handlers
  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChosen(e.dataTransfer.files[0]);
    }
  };

  const handleFileChosen = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      alert('Only .json circuit files are supported.');
      return;
    }
    setSelectedFile(file);
    setValidationReport(null);
    setUploadSuccess(null);
    setValidating(true);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const report = await validateCircuitJson(parsed);
      setValidationReport(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setValidationReport({
        valid: false,
        errors: [`JSON Parse Error: ${msg}`],
        warnings: [],
      });
    } finally {
      setValidating(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const res = await uploadCircuitFile(selectedFile);
      circuitStore.invalidateCatalog();
      setUploadSuccess(`Circuit '${res.circuit_id}' uploaded successfully!`);
      setSelectedFile(null);
      setValidationReport(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshCatalog(res.circuit_id, true);
      setActiveTab('catalog');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Upload failed: ${msg}`);
    } finally {
      setUploading(false);
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
        zIndex: 9999,
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
          maxWidth: 960,
          width: '100%',
          height: '86vh',
          maxHeight: 780,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(56, 189, 248, 0.2)',
          overflow: 'hidden',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {/* ── Modal Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12), rgba(37, 99, 235, 0.08))',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.3rem' }}>📦</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#38bdf8', letterSpacing: '0.04em' }}>
                Quantum Circuit Hub & Storage
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                Catalog · Benchmarks · JSON Storage · Immutability Protected
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Tabs */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 6,
                padding: 2,
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                onClick={() => setActiveTab('catalog')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'catalog' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'catalog' ? '#fff' : '#94a3b8',
                  transition: 'all 0.12s',
                }}
              >
                Browse Catalog ({circuits.length})
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                style={{
                  padding: '4px 12px',
                  borderRadius: 4,
                  border: 'none',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: activeTab === 'upload' ? 'var(--accent-blue)' : 'transparent',
                  color: activeTab === 'upload' ? '#fff' : '#94a3b8',
                  transition: 'all 0.12s',
                }}
              >
                + Upload Circuit
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: 13,
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Modal Body ── */}
        {activeTab === 'catalog' ? (
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {/* Left: Search, Filters & Circuit List */}
            <div
              style={{
                width: '54%',
                borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              {/* Search & Category Filter Bar */}
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: 'rgba(0,0,0,0.15)',
                  flexShrink: 0,
                }}
              >
                <input
                  type="text"
                  placeholder="Search circuits by name, tag, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 11,
                    color: '#f8fafc',
                    outline: 'none',
                  }}
                />

                {/* Category Chips */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: 99,
                        fontSize: 10,
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor:
                          selectedCategory === cat ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)',
                        background:
                          selectedCategory === cat ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                        color: selectedCategory === cat ? '#60a5fa' : '#94a3b8',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Circuit Cards Scrollable List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                    Loading circuits from repository...
                  </div>
                ) : errorMsg ? (
                  <div style={{ padding: 14, color: '#f87171', fontSize: 12, background: 'rgba(248, 113, 113, 0.1)', borderRadius: 6 }}>
                    {errorMsg}
                  </div>
                ) : filteredCircuits.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                    No circuits match your filter criteria.
                  </div>
                ) : (
                  filteredCircuits.map((c) => {
                    const isSelected = c.id === selectedCircuitId;
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCircuitId(c.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: isSelected
                            ? 'rgba(59, 130, 246, 0.15)'
                            : 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid',
                          borderColor: isSelected
                            ? 'rgba(59, 130, 246, 0.5)'
                            : 'rgba(255, 255, 255, 0.06)',
                          transition: 'all 0.12s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: isSelected ? '#60a5fa' : '#f8fafc' }}>
                            {c.name}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: c.readonly
                                ? 'rgba(56, 189, 248, 0.15)'
                                : 'rgba(52, 211, 153, 0.15)',
                              color: c.readonly ? '#38bdf8' : '#34d399',
                              border: `1px solid ${c.readonly ? 'rgba(56, 189, 248, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`,
                            }}
                          >
                            {c.readonly ? 'SYSTEM BUILT-IN' : 'CUSTOM'}
                          </span>
                        </div>

                        <div style={{ fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                          {c.description}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#64748b' }}>
                          <span>📏 {c.num_qubits} Qubits</span>
                          <span>·</span>
                          <span>⚡ {c.num_gates} Gates</span>
                          <span>·</span>
                          <span style={{ textTransform: 'capitalize' }}>🏷️ {c.synthesis}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Detailed Inspection & Actions Pane */}
            <div
              style={{
                width: '46%',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '16px 18px',
                overflowY: 'auto',
              }}
            >
              {detailLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>
                  Loading circuit details...
                </div>
              ) : !selectedCircuitDetail ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                  Select a circuit from the catalog to inspect details.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Title & Category */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                        {selectedCircuitDetail.name}
                      </h3>
                    </div>
                    <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>
                      Category: {selectedCircuitDetail.category} · Synthesis: {selectedCircuitDetail.synthesis}
                    </div>
                  </div>

                  {/* Description */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 11,
                      color: '#cbd5e1',
                      lineHeight: 1.5,
                    }}
                  >
                    {selectedCircuitDetail.description || 'No description provided.'}
                  </div>

                  {/* Specification Table */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', marginBottom: 8 }}>
                      Circuit Specifications
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
                      <div><span style={{ color: '#64748b' }}>Qubit Count:</span> <strong>{selectedCircuitDetail.num_qubits}</strong></div>
                      <div><span style={{ color: '#64748b' }}>Total Gates:</span> <strong>{selectedCircuitDetail.gates.length}</strong></div>
                      <div>
                        <span style={{ color: '#64748b' }}>Quantum Cost:</span>{' '}
                        <strong>{selectedCircuitDetail.metadata?.quantum_cost ?? 'Calculated at run-time'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>T-Count:</span>{' '}
                        <strong>{selectedCircuitDetail.metadata?.t_count ?? 'Calculated at run-time'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>T-Depth:</span>{' '}
                        <strong>{selectedCircuitDetail.metadata?.t_depth ?? 'Calculated at run-time'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Parity Conserved:</span>{' '}
                        <strong style={{ color: selectedCircuitDetail.metadata?.parity_preserved ? '#34d399' : '#94a3b8' }}>
                          {selectedCircuitDetail.metadata?.parity_preserved ? 'Yes (Verified)' : 'N/A'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedCircuitDetail.metadata?.tags && selectedCircuitDetail.metadata.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {selectedCircuitDetail.metadata.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: 9,
                            padding: '2px 6px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: 4,
                            color: '#94a3b8',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Primary Action Buttons */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    <button
                      onClick={() => {
                        onSimulateCircuit(selectedCircuitDetail.id);
                        onClose();
                      }}
                      style={{
                        background: 'linear-gradient(90deg, #2563eb, #1d4ed8)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span>⚡</span>
                      <span>Simulate in Live Lab</span>
                    </button>

                    <button
                      onClick={() => {
                        onOpenInBuilder(selectedCircuitDetail);
                        onClose();
                      }}
                      style={{
                        background: selectedCircuitDetail.readonly ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.06)',
                        color: selectedCircuitDetail.readonly ? '#38bdf8' : '#f8fafc',
                        border: selectedCircuitDetail.readonly
                          ? '1px solid rgba(56, 189, 248, 0.3)'
                          : '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: 6,
                        padding: '8px 14px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{selectedCircuitDetail.readonly ? '📋' : '🎨'}</span>
                      <span>{selectedCircuitDetail.readonly ? 'Duplicate & Edit in Builder' : 'Open in Circuit Builder'}</span>
                    </button>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <a
                        href={getCircuitExportUrl(selectedCircuitDetail.id)}
                        download={`${selectedCircuitDetail.id}.json`}
                        style={{
                          flex: 1,
                          textDecoration: 'none',
                          background: 'rgba(56, 189, 248, 0.1)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          borderRadius: 6,
                          padding: '7px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <span>📥</span>
                        <span>Download JSON</span>
                      </a>

                      {/* Delete Custom Circuit Only - Never for built-in readonly */}
                      {!selectedCircuitDetail.readonly && (
                        <button
                          disabled={deletingId === selectedCircuitDetail.id}
                          onClick={() => handleDelete(selectedCircuitDetail.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.12)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 6,
                            padding: '7px 12px',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>🗑️</span>
                          <span>{deletingId === selectedCircuitDetail.id ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Uploader Tab ── */
          <div
            style={{
              flex: 1,
              padding: '24px 28px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflowY: 'auto',
            }}
          >
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                Upload & Store Quantum Circuit
              </h3>
              <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5, margin: 0 }}>
                Upload any custom quantum circuit JSON file into the local repository. The server authoritative
                validator ensures gate whitelisting, qubit boundary constraints, and structural integrity.
              </p>
            </div>

            {uploadSuccess && (
              <div
                style={{
                  background: 'rgba(52, 211, 153, 0.15)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  color: '#34d399',
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              >
                ✅ {uploadSuccess}
              </div>
            )}

            {/* Drag & Drop Box */}
            <div
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed',
                borderColor: dragActive ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.15)',
                borderRadius: 10,
                background: dragActive ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                padding: '36px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChosen(e.target.files[0]);
                  }
                }}
              />
              <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 4 }}>
                {selectedFile ? selectedFile.name : 'Drag & drop circuit .json file here, or click to browse'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                Maximum file size: 1 MB · JSON schema version 1.0
              </div>
            </div>

            {/* Pre-Flight Validation Results */}
            {validating && (
              <div style={{ padding: 12, textAlign: 'center', color: '#38bdf8', fontSize: 12 }}>
                Validating circuit semantics with backend...
              </div>
            )}

            {validationReport && (
              <div
                style={{
                  background: validationReport.valid ? 'rgba(52, 211, 153, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${validationReport.valid ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: validationReport.valid ? '#34d399' : '#f87171',
                    marginBottom: 6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{validationReport.valid ? '✅ Circuit Semantics Valid' : '❌ Validation Failed'}</span>
                </div>

                {validationReport.circuit_summary && (
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 6 }}>
                    Name: <strong>{validationReport.circuit_summary.name}</strong> · Qubits:{' '}
                    <strong>{validationReport.circuit_summary.num_qubits}</strong> · Gates:{' '}
                    <strong>{validationReport.circuit_summary.num_gates}</strong>
                  </div>
                )}

                {/* Errors */}
                {validationReport.errors.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: '#fca5a5' }}>
                    {validationReport.errors.map((err, i) => (
                      <li key={i} style={{ marginBottom: 3 }}>{err}</li>
                    ))}
                  </ul>
                )}

                {/* Warnings */}
                {validationReport.warnings.length > 0 && (
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 11, color: '#fcd34d' }}>
                    {validationReport.warnings.map((warn, i) => (
                      <li key={i} style={{ marginBottom: 3 }}>⚠️ {warn}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Upload Button */}
            {selectedFile && validationReport?.valid && (
              <button
                disabled={uploading}
                onClick={handleUploadSubmit}
                style={{
                  background: 'linear-gradient(90deg, #10b981, #059669)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '10px 18px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <span>🚀</span>
                <span>{uploading ? 'Uploading to Repository...' : 'Confirm & Save to Library'}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
