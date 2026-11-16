import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  VerificationContract,
  VerificationResult,
  VerilogTemplate,
  VerilogSimulateResponse,
  PortMapping,
} from '../../types/verilog';
import { IOContract } from '../../types/io_contract';
import { VerilogCodeEditor } from './VerilogCodeEditor';
import { CompilerTerminal } from './CompilerTerminal';
import { PortMappingConfig } from './PortMappingConfig';
import { TruthTableMatrix } from './TruthTableMatrix';
import { ErrorHeatmap } from './ErrorHeatmap';
import { StateFidelityCurve } from './StateFidelityCurve';
import { FidelityDistributionBoxPlot } from './FidelityDistributionBoxPlot';
import { StateHistogram } from './StateHistogram';
import { KarnaughMapVisualizer } from './KarnaughMapVisualizer';
import { parseVerilogPorts } from '../../services/verilogParser';
import {
  fetchVerilogTemplates,
  simulateVerilogStandalone,
  verifyCircuitAgainstVerilog,
  exportDualCircuits,
  fetchCircuits,
} from '../../services/api';
import {
  Terminal,
  Sliders,
  BookOpen,
  ShieldCheck,
  Download,
  ChevronUp,
  ChevronDown,
  Zap,
  AlertTriangle,
  FileCode,
  FolderGit2,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

const CIRCUIT_TO_TEMPLATE_MAP: Record<string, string> = {
  falfg_5x5: 'falfg_gate',
  fredkin_cswap: 'fredkin_cswap',
  '1_bit_alu_clifford_t': 'alu_1bit',
  bennett_adder: 'bennett_adder',
};

const TEMPLATE_TO_CIRCUIT_MAP: Record<string, string> = {
  falfg_gate: 'falfg_5x5',
  fredkin_cswap: 'fredkin_cswap',
  alu_1bit: '1_bit_alu_clifford_t',
  bennett_adder: 'bennett_adder',
};

const DEFAULT_VERILOG_CODE = `// ==========================================================
// Independent Golden Reference: 1-Bit Full Adder
// Verified against Quantum Clifford+T / Bennett ALU
// ==========================================================
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    assign sum  = a ^ b ^ cin;
    assign cout = (a & b) | (cin & (a ^ b));
endmodule
`;

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
  // Code and Template State
  const [code, setCode] = useState<string>(DEFAULT_VERILOG_CODE);
  const [templates, setTemplates] = useState<VerilogTemplate[]>([]);
  const [availableCircuits, setAvailableCircuits] = useState<Array<{ id: string; name: string; num_qubits: number }>>([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState<string>('');

  // Right Panel Inspector Tab
  const [inspectorTab, setInspectorTab] = useState<'terminal' | 'mapping' | 'guide'>('terminal');

  // Terminal & Standalone Simulator State
  const [simulationResponse, setSimulationResponse] = useState<VerilogSimulateResponse | null>(null);
  const [isSimulatingStandalone, setIsSimulatingStandalone] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    `[system] Verilog Studio IDE initialized. Icarus Verilog testbench engine online.`,
    `[system] Desktop Logisim-evolution available at /home/mani/WorkSpace/VLSI/logisim-evolution.`,
  ]);

  // Contract State
  const [contract, setContract] = useState<VerificationContract>({
    verilog_code: DEFAULT_VERILOG_CODE,
    top_module_name: 'full_adder',
    reference_name: 'Independent Verilog HDL Reference',
    reference_source_type: 'independent_verilog',
    input_ports: [
      { name: 'a', direction: 'input', bit_width: 1, qubit_indices: [0] },
      { name: 'b', direction: 'input', bit_width: 1, qubit_indices: [1] },
      { name: 'cin', direction: 'input', bit_width: 1, qubit_indices: [2] },
    ],
    output_ports: [
      { name: 'sum', direction: 'output', bit_width: 1, qubit_indices: [3] },
      { name: 'cout', direction: 'output', bit_width: 1, qubit_indices: [4] },
    ],
    ancillas: [],
    mode: 'statevector_ideal',
    num_shots: 1024,
  });

  // Verification Results & Drawer State
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<'table' | 'kmap' | 'heatmap' | 'curve' | 'boxplot' | 'histogram'>('table');
  const [drawerCollapsed, setDrawerCollapsed] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync banner from builder
  const [showSyncBanner, setShowSyncBanner] = useState(false);
  useEffect(() => {
    if (ioContract && ioContract.source === 'builder') {
      setShowSyncBanner(true);
    }
  }, [ioContract]);

  // Helper to add logs to terminal
  const addLog = useCallback((msg: string) => {
    setTerminalLogs((prev) => [...prev, msg]);
  }, []);

  // Parse top module name from code
  const parsedMeta = useMemo(() => {
    return parseVerilogPorts(code);
  }, [code]);

  // Unified Target & HDL Synchronization Function
  const applyTargetCircuit = useCallback((targetId: string, currentTemplates: VerilogTemplate[]) => {
    setSelectedCircuitId(targetId);
    if (!targetId) return;

    if (targetId === '__builder_active__') {
      if (builderCircuit) {
        const numQubits = builderCircuit.num_qubits || 1;
        let inPorts: PortMapping[] = [];
        let outPorts: PortMapping[] = [];

        if (ioContract && ioContract.inputs.length > 0 && ioContract.outputs.length > 0) {
          let qIdx = 0;
          inPorts = ioContract.inputs.map((inp) => ({
            name: inp.name,
            direction: 'input' as const,
            bit_width: inp.bitWidth || 1,
            qubit_indices: Array.from({ length: inp.bitWidth || 1 }, () => qIdx++),
          }));
          outPorts = ioContract.outputs.map((out) => ({
            name: out.name,
            direction: 'output' as const,
            bit_width: out.bitWidth || 1,
            qubit_indices: Array.from({ length: out.bitWidth || 1 }, () => qIdx++),
          }));
        } else {
          inPorts = Array.from({ length: numQubits }, (_, i) => ({
            name: `q_in_${i}`,
            direction: 'input' as const,
            bit_width: 1,
            qubit_indices: [i],
          }));
          outPorts = Array.from({ length: numQubits }, (_, i) => ({
            name: `q_out_${i}`,
            direction: 'output' as const,
            bit_width: 1,
            qubit_indices: [i],
          }));
        }

        const safeModuleName = (builderCircuit.name || 'custom_quantum_circuit')
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, '_')
          .replace(/^([0-9])/, 'c_$1');

        const stub = `// ==========================================================
// Custom Quantum Target: ${builderCircuit.name || 'Active Builder Circuit'}
// Auto-Generated Synthesizable Verilog Interface (${numQubits} Qubits)
// ==========================================================
module ${safeModuleName} (
${inPorts.map((p) => `    input  wire ${p.name}`).concat(outPorts.map((p) => `    output wire ${p.name}`)).join(',\n')}
);
    // Write synthesizable logic matching your quantum circuit:
    // e.g., assign ${outPorts[0]?.name || 'q_out_0'} = ${inPorts.map((p) => p.name).join(' ^ ')};

endmodule
`;
        setCode(stub);
        setContract((prev) => ({
          ...prev,
          verilog_code: stub,
          top_module_name: safeModuleName,
          input_ports: inPorts,
          output_ports: outPorts,
          ancillas: [],
        }));
        addLog(`[unified-sync] ⚡ Active Builder synced: ${numQubits} qubits ↔ Module ${safeModuleName}.v`);
      }
      return;
    }

    const tmplId = CIRCUIT_TO_TEMPLATE_MAP[targetId] || targetId;
    const tmpl = currentTemplates.find((t) => t.id === tmplId || t.id === targetId);
    if (tmpl) {
      setCode(tmpl.verilog_code);
      setContract((prev) => ({
        ...prev,
        verilog_code: tmpl.verilog_code,
        top_module_name: tmpl.top_module,
        input_ports: tmpl.input_ports,
        output_ports: tmpl.output_ports,
        ancillas: tmpl.ancillas || [],
      }));
      addLog(`[unified-sync] 🟢 Target '${targetId}' synced with golden HDL '${tmpl.top_module}.v' (${tmpl.input_ports.length} inputs, ${tmpl.output_ports.length} outputs).`);
    } else {
      addLog(`[unified-sync] Target '${targetId}' selected.`);
    }
  }, [builderCircuit, ioContract, addLog]);

  // Load Templates & Circuit Catalog on Mount and initialize sync
  useEffect(() => {
    Promise.all([fetchVerilogTemplates(), fetchCircuits()])
      .then(([tmpls, circs]) => {
        setTemplates(tmpls);
        if (circs.circuits && circs.circuits.length > 0) {
          const list = circs.circuits.map((c) => ({ id: c.id, name: c.name, num_qubits: c.num_qubits }));
          setAvailableCircuits(list);

          // Initial target selection: if builder active, use builder; otherwise default to falfg_5x5
          const initialTarget = builderCircuit
            ? '__builder_active__'
            : (list.find((c) => c.id === 'falfg_5x5')?.id || list[0].id);

          applyTargetCircuit(initialTarget, tmpls);
        }
      })
      .catch((err) => console.warn('Could not load verilog templates or catalog:', err));
  }, []);

  // Compute currently matched template ID for editor dropdown
  const selectedTemplateId = useMemo(() => {
    if (selectedCircuitId === '__builder_active__') return '';
    const mapped = CIRCUIT_TO_TEMPLATE_MAP[selectedCircuitId] || selectedCircuitId;
    const match = templates.find((t) => t.id === mapped || t.id === selectedCircuitId);
    return match ? match.id : '';
  }, [selectedCircuitId, templates]);

  // Check if current editor code matches golden reference of target
  const isCodeSyncedWithTarget = useMemo(() => {
    if (!selectedCircuitId) return true;
    if (selectedCircuitId === '__builder_active__') return true;
    const tmplId = CIRCUIT_TO_TEMPLATE_MAP[selectedCircuitId] || selectedCircuitId;
    const tmpl = templates.find((t) => t.id === tmplId || t.id === selectedCircuitId);
    if (!tmpl) return true;
    return code.trim() === tmpl.verilog_code.trim();
  }, [selectedCircuitId, templates, code]);

  // Synchronize ports when code changes
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    const parsed = parseVerilogPorts(newCode);

    setContract((prev) => {
      let qubitIdx = 0;
      const updatedInputs: PortMapping[] = parsed.inputs.map((inp) => {
        const existing = prev.input_ports.find((p) => p.name === inp.name);
        const assignedIndices = existing ? existing.qubit_indices : Array.from({ length: inp.bitWidth }, () => qubitIdx++);
        return {
          name: inp.name,
          direction: 'input' as const,
          bit_width: inp.bitWidth,
          qubit_indices: assignedIndices,
        };
      });

      const updatedOutputs: PortMapping[] = parsed.outputs.map((out) => {
        const existing = prev.output_ports.find((p) => p.name === out.name);
        const assignedIndices = existing ? existing.qubit_indices : Array.from({ length: out.bitWidth }, () => qubitIdx++);
        return {
          name: out.name,
          direction: 'output' as const,
          bit_width: out.bitWidth,
          qubit_indices: assignedIndices,
        };
      });

      return {
        ...prev,
        verilog_code: newCode,
        top_module_name: parsed.topModuleName,
        input_ports: updatedInputs,
        output_ports: updatedOutputs,
      };
    });
  };

  // Select a pre-built template from editor dropdown
  const handleSelectTemplate = (templateId: string) => {
    const tmpl = templates.find((t) => t.id === templateId);
    if (!tmpl) return;
    setCode(tmpl.verilog_code);
    setContract((prev) => ({
      ...prev,
      verilog_code: tmpl.verilog_code,
      top_module_name: tmpl.top_module,
      input_ports: tmpl.input_ports,
      output_ports: tmpl.output_ports,
      ancillas: tmpl.ancillas || [],
    }));

    // Bidirectional sync: set selected quantum target to matching circuit
    const matchedCircuitId = TEMPLATE_TO_CIRCUIT_MAP[templateId];
    if (matchedCircuitId) {
      setSelectedCircuitId(matchedCircuitId);
      addLog(`[unified-sync] Loaded template '${tmpl.name}'. Quantum Target auto-synced to '${matchedCircuitId}'.`);
    } else {
      addLog(`[template] Loaded template: ${tmpl.name} (Module: ${tmpl.top_module})`);
    }
  };

  // Run standalone Icarus Verilog compilation & simulation
  const handleRunIcarus = async () => {
    setIsSimulatingStandalone(true);
    setInspectorTab('terminal');
    const timestamp = new Date().toLocaleTimeString();
    addLog(`[${timestamp}] Launching Icarus Verilog (iverilog + vvp) on ${parsedMeta.topModuleName}...`);

    try {
      const res = await simulateVerilogStandalone({
        verilog_code: code,
        top_module_name: parsedMeta.topModuleName,
        input_ports: contract.input_ports,
        output_ports: contract.output_ports,
      });
      setSimulationResponse(res);

      if (res.status === 'iverilog_success') {
        addLog(`[iverilog] Compilation & testbench execution SUCCESS in ${res.execution_time_ms.toFixed(1)} ms.`);
        addLog(`[iverilog] Generated ${res.total_states} truth-table combinations.`);
      } else {
        addLog(`[iverilog] Compilation error (${res.status}): ${res.message}`);
      }
    } catch (err: any) {
      addLog(`[error] Icarus Verilog execution failed: ${err.message}`);
    } finally {
      setIsSimulatingStandalone(false);
    }
  };

  // Run full differential cross-verification between Verilog and Quantum
  const handleRunVerification = async () => {
    if (!selectedCircuitId) {
      setErrorMsg('Please select a target quantum circuit before running cross-verification.');
      return;
    }
    setIsVerifying(true);
    setErrorMsg(null);
    setInspectorTab('terminal');
    const timestamp = new Date().toLocaleTimeString();
    addLog(`[${timestamp}] Starting differential cross-verification: Verilog (${parsedMeta.topModuleName}) ↔ Quantum Circuit...`);

    try {
      const isCustomBuilder = selectedCircuitId === '__builder_active__' && builderCircuit;
      const payload = {
        contract: {
          ...contract,
          verilog_code: code,
          top_module_name: parsedMeta.topModuleName,
        },
        circuit_id: isCustomBuilder ? undefined : selectedCircuitId,
        custom_circuit: isCustomBuilder && builderCircuit ? {
          num_qubits: builderCircuit.num_qubits,
          input_bits: builderCircuit.input_bits,
          gates: builderCircuit.gates.map((g) => ({ name: g.name, qubits: g.qubits, params: g.params })),
          circuit_name: builderCircuit.name,
        } : undefined,
      };

      const result = await verifyCircuitAgainstVerilog(payload);
      setVerificationResult(result);
      setDrawerCollapsed(false); // Open drawer automatically

      if (result.error_rate === 0) {
        addLog(`[verify] Differential Verification PASSED with 100% equivalence match.`);
        addLog(`[verify] Average State Fidelity: ${(result.state_fidelity_avg * 100).toFixed(2)}% across ${result.total_states_tested} states.`);
      } else {
        addLog(`[verify] Differential Verification found ${result.total_errors} mismatches (${(result.error_rate * 100).toFixed(1)}% error rate).`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
      addLog(`[error] Verification failed: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  // Export synthesizable Verilog code
  const handleExportVerilog = () => {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parsedMeta.topModuleName || 'golden_reference'}.v`;
    a.click();
    URL.revokeObjectURL(url);
    addLog(`[export] Exported Verilog source file: ${parsedMeta.topModuleName}.v`);
  };

  // Accept Builder I/O sync
  const handleAcceptBuilderSync = () => {
    if (!ioContract) return;
    const inputs = ioContract.inputs.map((p) => p.name);
    const outputs = ioContract.outputs.map((p) => p.name);

    const generatedStub = `// ==========================================================
// Auto-Generated Verilog Template from Quantum Circuit Interface
// Total Quantum Qubits: ${inputs.length + outputs.length}
// ==========================================================
module quantum_verified_module (
${inputs.map((name) => `    input  wire ${name}`).concat(outputs.map((name) => `    output wire ${name}`)).join(',\n')}
);
    // Write synthesizable logic matching your quantum circuit
    // Example: assign ${outputs[0] || 'out'} = ${inputs.join(' ^ ')};

endmodule
`;
    handleCodeChange(generatedStub);
    setShowSyncBanner(false);
    addLog(`[sync] Synchronized I/O interface from Quantum Builder (${inputs.length} in, ${outputs.length} out).`);
  };

  return (
    <div className="v-studio-container select-none">
      {/* Top Header — Replit IDE Toolbar */}
      <header className="v-studio-header">
        <div className="v-studio-brand">
          <div className="v-studio-icon">
            <FileCode size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="v-studio-title">Verilog HDL &amp; Formal Verification Studio</h1>
              <span className="v-studio-badge">Icarus + Qiskit IDE</span>
            </div>
            <p className="v-studio-subtext">
              Replit-Style IDE · Golden Reference Verilog · Logisim-evolution &amp; LTspice Import · Quantum Aer Cross-Check
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="v-studio-actions">
          {/* Target Quantum Circuit Selector */}
          <div className="v-studio-select-box">
            <span style={{ fontFamily: 'var(--font-mono)' }}>Quantum Target:</span>
            <select
              value={selectedCircuitId}
              onChange={(e) => applyTargetCircuit(e.target.value, templates)}
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

          {/* Resync Golden Reference Button */}
          {!isCodeSyncedWithTarget && selectedCircuitId && (
            <button
              onClick={() => applyTargetCircuit(selectedCircuitId, templates)}
              className="v-btn-secondary"
              style={{
                borderColor: '#f59e0b',
                color: '#fbbf24',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
              title="HDL code was modified — click to restore the target golden reference"
            >
              <RefreshCw size={12} />
              <span>Resync Golden</span>
            </button>
          )}

          {/* Export Verilog Source */}
          <button onClick={handleExportVerilog} className="v-btn-secondary" title="Download synthesizable Verilog source (.v)">
            <Download size={14} /> Export .v
          </button>

          {/* Cross-Verification Button */}
          <button
            onClick={handleRunVerification}
            disabled={isVerifying || !selectedCircuitId || !code.trim()}
            className="v-btn-primary"
            title={!selectedCircuitId ? 'Select a quantum circuit to verify against' : 'Run formal differential cross-verification'}
          >
            <ShieldCheck size={16} />
            <span>{isVerifying ? 'VERIFYING…' : 'VERIFY AGAINST QUANTUM'}</span>
          </button>
        </div>
      </header>

      {/* Builder Sync Banner */}
      {showSyncBanner && ioContract && ioContract.source === 'builder' && (
        <div style={{
          background: 'rgba(22, 101, 52, 0.2)', borderBottom: '1px solid #166534',
          padding: '6px 18px', display: 'flex', alignItems: 'center', gap: 10,
          fontSize: '0.75rem', color: '#86efac', flexShrink: 0,
        }}>
          <span>📥 Active Quantum Circuit has {ioContract.inputs.length} inputs + {ioContract.outputs.length} outputs. Generate matching Verilog template?</span>
          <button
            onClick={handleAcceptBuilderSync}
            style={{ background: '#166534', color: '#bbf7d0', border: '1px solid #16a34a', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
          >
            Generate Template
          </button>
          <button
            onClick={() => setShowSyncBanner(false)}
            style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: '0.72rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div style={{
          background: 'rgba(153, 27, 27, 0.2)', borderBottom: '1px solid #7f1d1d',
          padding: '5px 18px', fontSize: '0.72rem', color: '#fca5a5', flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={13} /> {errorMsg}
          <button onClick={() => setErrorMsg(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', marginLeft: 'auto' }}>✕</button>
        </div>
      )}

      {/* Main Split-Pane Workspace (Replit-Style) */}
      <main className="v-ide-layout">
        {/* Left Pane: Code Editor */}
        <div className="v-ide-editor-container">
          <VerilogCodeEditor
            code={code}
            onChange={handleCodeChange}
            templates={templates}
            onSelectTemplate={handleSelectTemplate}
            selectedTemplateId={selectedTemplateId}
            onSimulateStandalone={handleRunIcarus}
            isSimulating={isSimulatingStandalone}
            topModuleName={parsedMeta.topModuleName}
            isSyncedWithTarget={isCodeSyncedWithTarget}
          />
        </div>

        {/* Right Pane: Inspector / Terminal / Mapping */}
        <div className="v-ide-inspector">
          {/* Inspector Header Tabs */}
          <div className="v-ide-inspector-header">
            <div className="v-ide-inspector-tabs">
              <button
                onClick={() => setInspectorTab('terminal')}
                className={`v-ide-inspector-tab ${inspectorTab === 'terminal' ? 'active' : ''}`}
              >
                <Terminal size={13} />
                <span>Compiler Terminal</span>
              </button>
              <button
                onClick={() => setInspectorTab('mapping')}
                className={`v-ide-inspector-tab ${inspectorTab === 'mapping' ? 'active' : ''}`}
              >
                <Sliders size={13} />
                <span>Port ↔ Qubit Mapping ({contract.input_ports.length} in, {contract.output_ports.length} out)</span>
              </button>
              <button
                onClick={() => setInspectorTab('guide')}
                className={`v-ide-inspector-tab ${inspectorTab === 'guide' ? 'active' : ''}`}
              >
                <BookOpen size={13} />
                <span>Logisim / LTspice Guide</span>
              </button>
            </div>
          </div>

          {/* Inspector Content */}
          <div className="v-ide-inspector-content">
            {inspectorTab === 'terminal' && (
              <CompilerTerminal
                simulationResponse={simulationResponse}
                logs={terminalLogs}
                onClearLogs={() => setTerminalLogs([])}
                isSimulating={isSimulatingStandalone}
              />
            )}

            {inspectorTab === 'mapping' && (
              <div style={{ padding: 14, overflowY: 'auto', flex: 1 }}>
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
            )}

            {inspectorTab === 'guide' && (
              <div style={{ padding: 18, overflowY: 'auto', flex: 1, fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: 1.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <FolderGit2 size={18} style={{ color: '#38bdf8' }} />
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>
                    Desktop EDA Schematic Integration (Logisim &amp; LTspice)
                  </h3>
                </div>

                <p style={{ color: 'var(--text-muted)', marginBottom: 14 }}>
                  In professional VLSI engineering, visual schematics are drawn in dedicated desktop EDA tools rather than browser canvases. You can design your circuits externally and import them directly into this testbench:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: 12 }}>
                    <div style={{ fontWeight: 600, color: '#38bdf8', marginBottom: 4 }}>1. Using Logisim-evolution (Installed Locally)</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Logisim-evolution is available at:
                      <code style={{ display: 'block', background: 'var(--bg-dark)', padding: '4px 8px', borderRadius: 4, margin: '6px 0', fontFamily: 'var(--font-mono)' }}>
                        /home/mani/WorkSpace/VLSI/logisim-evolution
                      </code>
                      Draw your circuit, name input and output pins, and save as <b>.circ</b>. Click the <b>Import</b> button in the editor above to auto-extract ports and create a Verilog stub.
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: 12 }}>
                    <div style={{ fontWeight: 600, color: '#34d399', marginBottom: 4 }}>2. Synthesize to Verilog directly from Logisim</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      In Logisim-evolution, choose <b>FPGA &rarr; Synthesize &amp; Download</b> or export HDL. Copy the generated synthesizable Verilog code and paste it directly into the editor on the left.
                    </div>
                  </div>

                  <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: 12 }}>
                    <div style={{ fontWeight: 600, color: '#fbbf24', marginBottom: 4 }}>3. Independent Differential Cross-Checking</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Our platform runs your Verilog against <b>Icarus Verilog</b> to generate the exhaustive $2^k$ truth table, then simulates the quantum target with <b>Qiskit Aer</b> statevector engine. The results are compared row-by-row in the Equivalence Drawer below.
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Slide-Up Bottom Analytics Drawer */}
      <footer
        className="v-drawer-container"
        style={{ height: drawerCollapsed ? 38 : 390 }}
      >
        {/* Drawer Header & Tabs */}
        <div className="v-drawer-header">
          <div className="v-drawer-title-group">
            <button
              onClick={() => setDrawerCollapsed(!drawerCollapsed)}
              className="v-drawer-toggle-btn"
              title={drawerCollapsed ? 'Expand Analytics' : 'Minimize Analytics'}
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
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', gap: 6 }}>
                <ShieldCheck size={28} style={{ color: 'var(--text-muted)' }} />
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
