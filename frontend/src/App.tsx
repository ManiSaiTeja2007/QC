import React, { useState, useEffect } from 'react';
import { StudioMode } from './types/mode';
import { BuilderWorkspace } from './components/builder/BuilderWorkspace';
import { SingleGateWorkspace } from './components/builder/SingleGateWorkspace';
import { LiveSimulationWorkspace } from './components/workspaces/LiveSimulationWorkspace';
import { QMLLabWorkspace } from './components/qml/QMLLabWorkspace';
import { SidebarNav } from './components/SidebarNav';
import { PaperModal } from './components/modals/PaperModal';
import { DocsModal } from './components/modals/DocsModal';
import { CircuitHubModal } from './components/modals/CircuitHubModal';
import { CircuitFileSchema } from './types/circuit';

const VALID_MODES: StudioMode[] = ['builder', 'single-gate-lab', 'live-simulation', 'qml-lab'];

function getInitialMode(): StudioMode {
  // 1. Check URL hash (e.g. #single-gate-lab, #live-simulation, #builder)
  if (typeof window !== 'undefined' && window.location.hash) {
    const hash = window.location.hash.replace(/^#\/?/, '') as StudioMode;
    if (VALID_MODES.includes(hash)) {
      return hash;
    }
  }
  // 2. Check localStorage persistence
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('qc_studio_active_tab') as StudioMode;
    if (VALID_MODES.includes(saved)) {
      return saved;
    }
  }
  return 'builder';
}

export const App: React.FC = () => {
  const [appMode, setAppModeState] = useState<StudioMode>(getInitialMode);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Lifted so sidebar circuit buttons can drive the workspace
  const [selectedArch, setSelectedArch] = useState<string>('1-bit-alu');
  const [isPaperOpen, setIsPaperOpen] = useState(false);
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isCircuitHubOpen, setIsCircuitHubOpen] = useState(false);
  const [builderCircuitToLoad, setBuilderCircuitToLoad] = useState<CircuitFileSchema | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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

