import React, { useState, useEffect } from 'react';
import { StudioMode } from './types/mode';
import { BuilderWorkspace } from './components/builder/BuilderWorkspace';
import { SingleGateWorkspace } from './components/builder/SingleGateWorkspace';
import { LiveSimulationWorkspace } from './components/workspaces/LiveSimulationWorkspace';
import { QMLLabWorkspace } from './components/qml/QMLLabWorkspace';
import { VerilogStudioWorkspace } from './components/verilog/VerilogStudioWorkspace';
import { SidebarNav } from './components/SidebarNav';
import { PaperModal } from './components/modals/PaperModal';
import { DocsModal } from './components/modals/DocsModal';
import { CircuitHubModal } from './components/modals/CircuitHubModal';
import { CircuitFileSchema } from './types/circuit';
import { IOContract } from './types/io_contract';
import { circuitStore } from './services/circuitStore';

const VALID_MODES: StudioMode[] = [
  'live-simulation',
  'builder',
  'single-gate-lab',
  'verilog-studio',
  'qml-lab',
];

function getInitialMode(): StudioMode {
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.replace(/^#\/?/, '') as StudioMode;
    if (VALID_MODES.includes(hash)) return hash;
  }
  const saved = localStorage.getItem('qc_studio_active_tab') as StudioMode | null;
  if (saved && VALID_MODES.includes(saved)) return saved;
  return 'live-simulation';
}

export function App() {
  const [appMode, setAppModeState] = useState<StudioMode>(getInitialMode);
  // Default sidebarCollapsed to true per rule 19 for maximum spacious layout
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  // Lifted so sidebar circuit buttons can drive the workspace
  const [selectedArch, setSelectedArch] = useState<string>('1-bit-alu');
  const [isPaperOpen, setIsPaperOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isCircuitHubOpen, setIsCircuitHubOpen] = useState(false);
  const [builderCircuitToLoad, setBuilderCircuitToLoad] = useState<CircuitFileSchema | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeBuilderCircuit, setActiveBuilderCircuit] = useState<{
    name: string;
    num_qubits: number;
    input_bits: number[];
    gates: Array<{ name: string; qubits: number[]; params?: number[] }>;
  } | null>(null);
  const [ioContract, setIoContract] = useState<IOContract | null>(null);

  const handleModeChange = (mode: StudioMode) => {
    setAppModeState(mode);
    if (typeof window !== 'undefined') {
      window.location.hash = `#${mode}`;
      localStorage.setItem('qc_studio_active_tab', mode);
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      const currentHash = window.location.hash.replace(/^#\/?/, '') as StudioMode;
      if (VALID_MODES.includes(currentHash)) {
        setAppModeState(currentHash);
        localStorage.setItem('qc_studio_active_tab', currentHash);
      }
    };
    if (!window.location.hash) window.location.hash = `#${appMode}`;
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []); // eslint-disable-line

  return (
    <div className="app-container">
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <SidebarNav
          appMode={appMode}
          collapsed={sidebarCollapsed}
          onModeChange={handleModeChange}
          onToggle={() => setSidebarCollapsed(c => !c)}
          onCircuitSelect={setSelectedArch}
          onOpenPaper={() => setIsPaperOpen(true)}
          onOpenDocs={() => setIsDocsOpen(true)}
          onOpenCircuitHub={() => setIsCircuitHubOpen(true)}
          refreshTrigger={refreshTrigger}
        />

        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div
            className="workspace-tab-container"
            style={{ display: appMode === 'builder' ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <BuilderWorkspace
              circuitToLoad={builderCircuitToLoad}
              onCircuitSaved={() => setRefreshTrigger(t => t + 1)}
              onCircuitChange={setActiveBuilderCircuit}
              ioContract={ioContract}
              onIOContractChange={setIoContract}
            />
          </div>

          <div
            className="workspace-tab-container"
            style={{ display: appMode === 'single-gate-lab' ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <SingleGateWorkspace />
          </div>

          <div
            className="workspace-tab-container"
            style={{ display: appMode === 'live-simulation' ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <LiveSimulationWorkspace
              initialArchitecture={selectedArch}
              onArchChange={setSelectedArch}
              onNavigateToVerilogStudio={() => handleModeChange('verilog-studio')}
            />
          </div>

          <div
            className="workspace-tab-container"
            style={{ display: appMode === 'verilog-studio' ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <VerilogStudioWorkspace
              builderCircuit={activeBuilderCircuit}
              ioContract={ioContract}
              onIOContractChange={setIoContract}
            />
          </div>

          <div
            className="workspace-tab-container"
            style={{ display: appMode === 'qml-lab' ? 'flex' : 'none', flex: 1, minHeight: 0 }}
          >
            <QMLLabWorkspace />
          </div>
        </div>
      </div>

      {/* Circuit Hub & Library Modal */}
      {isCircuitHubOpen && (
        <CircuitHubModal
          onClose={() => setIsCircuitHubOpen(false)}
          onSimulateCircuit={(circuitId) => {
            setSelectedArch(circuitId);
            handleModeChange('live-simulation');
          }}
          onOpenInBuilder={(circuit) => {
            setBuilderCircuitToLoad(circuit);
            handleModeChange('builder');
          }}
        />
      )}

      {/* Info Modals */}
      {isPaperOpen && <PaperModal onClose={() => setIsPaperOpen(false)} />}
      {isDocsOpen && <DocsModal onClose={() => setIsDocsOpen(false)} />}
    </div>
  );
};

export default App;

