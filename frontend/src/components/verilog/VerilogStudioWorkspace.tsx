import React, { useState, useEffect, useMemo } from 'react';
import {
  SchematicCircuitModel,
  GateVisualBlock,
  CanonicalClassicalNetlist,
} from '../../types/classical_schematic';
import {
  VerificationContract,
  VerificationResult,
  VerilogTemplate,
  ReferenceSourceType,
} from '../../types/verilog';
import { IOContract, makeDefaultIOContract } from '../../types/io_contract';
import { SchematicCanvas } from './SchematicCanvas';
import { TruthTableMatrix } from './TruthTableMatrix';
import { ErrorHeatmap } from './ErrorHeatmap';
import { StateFidelityCurve } from './StateFidelityCurve';
import { FidelityDistributionBoxPlot } from './FidelityDistributionBoxPlot';
import { StateHistogram } from './StateHistogram';
import { KarnaughMapVisualizer } from './KarnaughMapVisualizer';
import { PortMappingConfig } from './PortMappingConfig';
import { IOSetupPanel } from './IOSetupPanel';
import {
  convertSchematicToCanonicalNetlist,
  generateVerilogFromNetlist,
} from '../../services/schematicToNetlist';
import {
  fetchVerilogTemplates,
  verifyCircuitAgainstVerilog,
  exportDualCircuits,
  fetchCircuits,
} from '../../services/api';
import {
  Cpu,
  Code,
  Layers,
  Play,
  CheckCircle2,
  AlertTriangle,
  Download,
  Share2,
  Maximize2,
  Minimize2,
  FileCode2,
  ShieldCheck,
  Zap,
  Sliders,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

/** Blank canvas — the IOSetupPanel creates the port stubs */
const BLANK_SCHEMATIC_MODEL: SchematicCircuitModel = {
  name: 'untitled_schematic',
  inputs: [],
  outputs: [],
  gates: [],
  wires: [],
};

interface VerilogStudioWorkspaceProps {
  builderCircuit?: {
    name: string;
    num_qubits: number;
    input_bits: number[];
    gates: Array<{ name: string; qubits: number[]; params?: number[] }>;
  } | null;
  ioContract?: IOContract | null;
  onIOContractChange?: (contract: IOContract) => void;
}

export const VerilogStudioWorkspace: React.FC<VerilogStudioWorkspaceProps> = ({
  builderCircuit,
  ioContract,
  onIOContractChange,
}) => {
  const [activeView, setActiveView] = useState<'schematic' | 'verilog' | 'mapping'>('schematic');
  const [schematicModel, setSchematicModel] = useState<SchematicCircuitModel>(BLANK_SCHEMATIC_MODEL);
  const [templates, setTemplates] = useState<VerilogTemplate[]>([]);
  const [availableCircuits, setAvailableCircuits] = useState<Array<{ id: string; name: string; num_qubits: number }>>([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('');

  // Show banner when Builder side pushes a new ioContract
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  useEffect(() => {
    if (ioContract && ioContract.source === 'builder') {
      setShowSyncBanner(true);
    }
  }, [ioContract]);

  // Contract State — starts empty (populated after I/O setup)
  const [contract, setContract] = useState<VerificationContract>({
    verilog_code: '',
    top_module_name: 'untitled_schematic',
    reference_name: 'Independent Classical Schematic',
    reference_source_type: 'independent_schematic',
    input_ports: [],
    output_ports: [],
    ancillas: [],
    mode: 'statevector_ideal',
    num_shots: 1024,
  });

  // Verification Results & Drawer State — drawer starts collapsed
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'table' | 'kmap' | 'heatmap' | 'curve' | 'boxplot' | 'histogram'>('table');
  const [drawerCollapsed, setDrawerCollapsed] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Derive Canonical Netlist and Verilog HDL whenever schematic changes
  const canonicalNetlist: CanonicalClassicalNetlist = useMemo(() => {
    return convertSchematicToCanonicalNetlist(schematicModel);
  }, [schematicModel]);

  const synthesizedVerilog = useMemo(() => {
    return generateVerilogFromNetlist(canonicalNetlist);
  }, [canonicalNetlist]);

  // Keep contract verilog_code synchronized if in schematic mode
  useEffect(() => {
    if (contract.reference_source_type === 'independent_schematic') {
      setContract((prev) => ({
        ...prev,
        verilog_code: synthesizedVerilog,
        top_module_name: canonicalNetlist.name,
      }));
    }
  }, [synthesizedVerilog, canonicalNetlist.name, contract.reference_source_type]);

  // Load Templates & Stored Circuits on Mount
  useEffect(() => {
    fetchVerilogTemplates()
      .then((res) => setTemplates(res))
      .catch((err) => console.warn('Could not load verilog templates:', err));

    fetchCircuits()
      .then((res) => {
        if (res.circuits && res.circuits.length > 0) {
          setAvailableCircuits(res.circuits.map((c) => ({ id: c.id, name: c.name, num_qubits: c.num_qubits })));
          // Do NOT auto-select — let user pick explicitly
        }
      })
      .catch((err) => console.warn('Could not load circuit catalog:', err));
  }, []);

  /** Called when IOSetupPanel confirms the circuit interface */
  const handleIOSetup = (
    inputs: Array<{ name: string }>,
    outputs: Array<{ name: string }>
  ) => {
    const newModel: SchematicCircuitModel = {
      name: 'my_schematic',
      inputs: inputs.map((inp, i) => ({
        id: `p_in_${i}`,
        name: inp.name,
        direction: 'input' as const,
        x: 30,
        y: 60 + i * 80,
        bitWidth: 1,
        currentValue: 0,
      })),
      outputs: outputs.map((out, i) => ({
        id: `p_out_${i}`,
        name: out.name,
        direction: 'output' as const,
        x: 810,
        y: 60 + i * 80,
        bitWidth: 1,
      })),
      gates: [],
      wires: [],
    };
    setSchematicModel(newModel);

    // Build and emit the IOContract so Builder can sync
    const newContract = makeDefaultIOContract(inputs.length, outputs.length, 'verilog-studio');
    // Override names from what the user typed
    newContract.inputs = newContract.inputs.map((p, i) => ({ ...p, name: inputs[i]?.name ?? p.name }));
    newContract.outputs = newContract.outputs.map((p, i) => ({ ...p, name: outputs[i]?.name ?? p.name }));
    onIOContractChange?.(newContract);

    // Update contract ports
    setContract((prev) => ({
      ...prev,
      top_module_name: 'my_schematic',
      input_ports: inputs.map((inp, i) => ({ name: inp.name, direction: 'input' as const, bit_width: 1, qubit_indices: [i] })),
      output_ports: outputs.map((out, i) => ({ name: out.name, direction: 'output' as const, bit_width: 1, qubit_indices: [inputs.length + i] })),
    }));
  };

  // Run Full Differential Verification
  const handleRunVerification = async () => {
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const isCustomBuilder = selectedCircuitId === '__builder_active__' && builderCircuit;
      const resolvedInputPorts = contract.input_ports.length > 0
        ? contract.input_ports
        : schematicModel.inputs.map((inp, idx) => ({
            name: inp.name,
            direction: 'input' as const,
            bit_width: 1,
            qubit_indices: [idx],
          }));

      const resolvedOutputPorts = contract.output_ports.length > 0
        ? contract.output_ports
        : schematicModel.outputs.map((out, idx) => ({
            name: out.name,
            direction: 'output' as const,
            bit_width: 1,
            qubit_indices: [schematicModel.inputs.length + idx],
          }));

      const payload = {
        contract: {
          ...contract,
          verilog_code: contract.reference_source_type === 'independent_schematic' ? synthesizedVerilog : contract.verilog_code,
          input_ports: resolvedInputPorts,
          output_ports: resolvedOutputPorts,
        },
        circuit_id: isCustomBuilder ? undefined : (selectedCircuitId || undefined),
        custom_circuit: isCustomBuilder && builderCircuit ? {
          num_qubits: builderCircuit.num_qubits,
          input_bits: builderCircuit.input_bits,
          gates: builderCircuit.gates.map((g) => ({ name: g.name, qubits: g.qubits, params: g.params })),
          circuit_name: builderCircuit.name,
        } : undefined,
        schematic_netlist: contract.reference_source_type === 'independent_schematic' ? canonicalNetlist : undefined,
      };

      const result = await verifyCircuitAgainstVerilog(payload);
      setVerificationResult(result);
      setDrawerCollapsed(false); // Pop drawer up with results
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Export Dual Circuits
  const handleExportDual = async () => {
    try {
      const res = await exportDualCircuits({
        circuit_id: selectedCircuitId || undefined,
        verilog_code: synthesizedVerilog,
        top_module_name: canonicalNetlist.name,
      });

      // Download Verilog file
      const blob = new Blob([res.verilog_code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${res.top_module || 'golden_reference'}.v`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    }
  };

  /** Whether the schematic canvas is blank (needs I/O setup) */
  const isBlankCanvas = schematicModel.inputs.length === 0 && schematicModel.outputs.length === 0;

  return (
    <div className="v-studio-container select-none">
      {/* Top Header — simplified */}
      <header className="v-studio-header">
        <div className="v-studio-brand">
          <div className="v-studio-icon">
            <Cpu size={18} />
          </div>
          <div>
            <h1 className="v-studio-title">Classical Schematic &amp; Verification Studio</h1>
            <p className="v-studio-subtext">
              Independent classical specification · Icarus Verilog · Qiskit Aer cross-verify
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="v-studio-actions">
          {/* Target Quantum Circuit Selector */}
          <div className="v-studio-select-box">
            <span style={{ fontFamily: 'var(--font-mono)' }}>Quantum target:</span>
            <select
              value={selectedCircuitId}
              onChange={(e) => setSelectedCircuitId(e.target.value)}
              className="v-studio-select"
            >
              <option value="">— select circuit —</option>
              {builderCircuit && (
                <option value="__builder_active__" style={{ fontWeight: 'bold', color: '#f59e0b' }}>
                  ⚡ Active Builder ({builderCircuit.num_qubits}Q)
                </option>
              )}
              {availableCircuits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.num_qubits}Q)
                </option>
              ))}
            </select>
          </div>

          {/* Export */}
          {!isBlankCanvas && (
            <button onClick={handleExportDual} className="v-btn-secondary" title="Download Verilog HDL">
              <Download size={14} /> Export HDL
            </button>
          )}

          {/* Verify — disabled when canvas blank or no quantum target */}
          <button
            onClick={handleRunVerification}
            disabled={isVerifying || isBlankCanvas || !selectedCircuitId}
            className="v-btn-primary"
            title={isBlankCanvas ? 'Define circuit interface first' : !selectedCircuitId ? 'Select a quantum target first' : ''}
          >
            <ShieldCheck size={16} />
            <span>{isVerifying ? 'SIMULATING…' : 'VERIFY AGAINST QUANTUM'}</span>
          </button>
        </div>
      </header>

      {/* Builder sync banner — shown when builder pushed a new I/O contract */}
      {showSyncBanner && ioContract && ioContract.source === 'builder' && (
        <div style={{
          background: '#0c1a0e', borderBottom: '1px solid #166534',
          padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 10,
          fontSize: '0.75rem', color: '#86efac', flexShrink: 0,
        }}>
          <span>📥 Quantum Builder has {ioContract.inputs.length} inputs + {ioContract.outputs.length} outputs — sync I/O to classical schematic?</span>
          <button
            onClick={() => {
              handleIOSetup(
                ioContract.inputs.map((p) => ({ name: p.name })),
                ioContract.outputs.map((p) => ({ name: p.name }))
              );
              setShowSyncBanner(false);
            }}
            style={{ background: '#166534', color: '#bbf7d0', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
          >
            Accept
          </button>
          <button
            onClick={() => setShowSyncBanner(false)}
            style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.72rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error message inline */}
      {errorMsg && (
        <div style={{
          background: '#2d0b0b', borderBottom: '1px solid #7f1d1d',
          padding: '5px 18px', fontSize: '0.72rem', color: '#fca5a5', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={13} /> {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
        </div>
      )}

      {/* Sub-Header Navigation Tabs — hidden when canvas is blank */}
      {!isBlankCanvas && (
        <nav className="v-studio-subnav">
          <div className="v-subnav-tabs">
            <button onClick={() => setActiveView('schematic')} className={`v-tab-btn ${activeView === 'schematic' ? 'active' : ''}`}>
              <Layers size={14} /> <span>Visual Schematic</span>
            </button>
            <button onClick={() => setActiveView('verilog')} className={`v-tab-btn ${activeView === 'verilog' ? 'active-emerald' : ''}`}>
              <FileCode2 size={14} /> <span>Verilog HDL</span>
            </button>
            <button onClick={() => setActiveView('mapping')} className={`v-tab-btn ${activeView === 'mapping' ? 'active-purple' : ''}`}>
              <Sliders size={14} /> <span>Port ↔ Qubit</span>
            </button>
          </div>
          <div className="v-subnav-meta">
            <span>{schematicModel.inputs.length}in · {schematicModel.outputs.length}out · {canonicalNetlist.name}</span>
          </div>
        </nav>
      )}

      {/* Main Studio Viewport */}
      <main style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* I/O Setup Panel — shown on blank canvas */}
        {isBlankCanvas ? (
          <IOSetupPanel
            onConfirm={handleIOSetup}
            builderContract={builderCircuit ? { num_qubits: builderCircuit.num_qubits, input_bits: builderCircuit.input_bits } : null}
            onDismissBuilderHint={() => {}}
          />
        ) : (
          <>
            {activeView === 'schematic' && (
              <SchematicCanvas
                model={schematicModel}
                onChange={setSchematicModel}
              />
            )}

            {activeView === 'verilog' && (
              <div className="v-code-view">
                <div className="v-code-header">
                  <span style={{ fontWeight: 600, color: '#e2e8f0' }}>Generated Synthesizable Verilog</span>
                  <span style={{ fontSize: '0.70rem', color: '#64748b' }}>Auto-synthesized from Classical Schematic IR</span>
                </div>
                <pre className="v-code-block">
                  {synthesizedVerilog || '// Draw the classical circuit in the Visual Schematic tab first.'}
                </pre>
              </div>
            )}

            {activeView === 'mapping' && (
              <div className="v-mapping-view">
                <div className="v-mapping-card">
                  <PortMappingConfig
                    inputPorts={contract.input_ports}
                    outputPorts={contract.output_ports}
                    ancillas={contract.ancillas}
                    mode={contract.mode}
                    numShots={contract.num_shots}
                    totalQubits={contract.input_ports.length + contract.output_ports.length}
                    onUpdateInputPorts={(ports) => setContract((c) => ({ ...c, input_ports: ports }))}
                    onUpdateOutputPorts={(ports) => setContract((c) => ({ ...c, output_ports: ports }))}
                    onUpdateAncillas={(ancillas) => setContract((c) => ({ ...c, ancillas }))}
                    onUpdateMode={(mode) => setContract((c) => ({ ...c, mode }))}
                    onUpdateNumShots={(numShots) => setContract((c) => ({ ...c, num_shots: numShots }))}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Slide-Up Bottom Analytics Drawer */}
      <footer
        className="v-drawer-container"
        style={{ height: drawerCollapsed ? 38 : 300 }}
      >
        {/* Drawer Header & Tabs */}
        <div className="v-drawer-header">
          <div className="v-drawer-title-group">
            <button
              onClick={() => setDrawerCollapsed(!drawerCollapsed)}
              className="v-drawer-toggle-btn"
              title={drawerCollapsed ? "Expand Analytics" : "Minimize Analytics"}
            >
              {drawerCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <span className="v-drawer-title">
              <Zap size={14} style={{ color: '#fbbf24' }} />
              Equivalence Analytics Drawer
            </span>

            {verificationResult && (
              <div className="v-drawer-metrics">
                <span
                  className={verificationResult.error_rate === 0 ? 'v-badge-success' : 'v-badge-error'}
                >
                  {verificationResult.error_rate === 0 ? '100% MATCH' : `${verificationResult.total_errors} MISMATCHES`}
                </span>
                <span className="v-metric-label">
                  Avg Fidelity: {(verificationResult.state_fidelity_avg * 100).toFixed(1)}%
                </span>
                {verificationResult.classical_self_consistency !== null && (
                  <span className="v-metric-label" style={{ color: '#34d399' }}>
                    • Schematic ↔ Verilog: CONSISTENT
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Drawer Tab Buttons */}
          <div className="v-drawer-tabs">
            <button
              onClick={() => { setActiveDrawerTab('table'); setDrawerCollapsed(false); }}
              className={`v-drawer-tab-btn ${activeDrawerTab === 'table' ? 'active' : ''}`}
            >
              Truth Table
            </button>
            <button
              onClick={() => { setActiveDrawerTab('kmap'); setDrawerCollapsed(false); }}
              className={`v-drawer-tab-btn ${activeDrawerTab === 'kmap' ? 'active' : ''}`}
              style={{ color: activeDrawerTab === 'kmap' ? '#fbbf24' : undefined }}
            >
              🗺️ K-Map Synthesis
            </button>
            <button
              onClick={() => { setActiveDrawerTab('heatmap'); setDrawerCollapsed(false); }}
              className={`v-drawer-tab-btn ${activeDrawerTab === 'heatmap' ? 'active' : ''}`}
            >
              Error Heatmap
            </button>
            <button
              onClick={() => { setActiveDrawerTab('curve'); setDrawerCollapsed(false); }}
              className={`v-drawer-tab-btn ${activeDrawerTab === 'curve' ? 'active' : ''}`}
            >
              State Fidelity Curve
            </button>
            <button
              onClick={() => { setActiveDrawerTab('boxplot'); setDrawerCollapsed(false); }}
              className={`v-drawer-tab-btn ${activeDrawerTab === 'boxplot' ? 'active' : ''}`}
            >
              Distribution Box Plot
            </button>
            <button
              onClick={() => { setActiveDrawerTab('histogram'); setDrawerCollapsed(false); }}
              className={`v-drawer-tab-btn ${activeDrawerTab === 'histogram' ? 'active' : ''}`}
            >
              Probability Histogram
            </button>
          </div>
        </div>

        {/* Drawer Content Body */}
        {!drawerCollapsed && (
          <div className="v-drawer-body">
            {verificationResult ? (
              <>
                {activeDrawerTab === 'table' && (
                  <TruthTableMatrix
                    truthTable={verificationResult.truth_table}
                    totalStates={verificationResult.total_states_tested}
                    totalErrors={verificationResult.total_errors}
                  />
                )}
                {activeDrawerTab === 'kmap' && (
                  <KarnaughMapVisualizer
                    truthTable={verificationResult.truth_table}
                    outputPortNames={contract.output_ports.map((p) => p.name)}
                  />
                )}
                {activeDrawerTab === 'heatmap' && (
                  <ErrorHeatmap
                    heatmap={verificationResult.heatmap}
                    errorRate={verificationResult.error_rate}
                  />
                )}
                {activeDrawerTab === 'curve' && (
                  <StateFidelityCurve
                    fidelityCurve={verificationResult.state_fidelity_curve}
                    avgFidelity={verificationResult.state_fidelity_avg}
                  />
                )}
                {activeDrawerTab === 'boxplot' && (
                  <FidelityDistributionBoxPlot
                    stats={verificationResult.box_plot}
                    totalStates={verificationResult.total_states_tested}
                  />
                )}
                {activeDrawerTab === 'histogram' && (
                  <StateHistogram histograms={verificationResult.histograms} />
                )}
              </>
            ) : (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '0.75rem', gap: 6 }}>
                <ShieldCheck size={28} style={{ color: '#475569' }} />
                <span>No verification has been executed yet.</span>
                <span>Click &quot;VERIFY AGAINST QUANTUM&quot; above to cross-verify classical and quantum circuits.</span>
              </div>
            )}
          </div>
        )}
      </footer>
    </div>
  );
};
