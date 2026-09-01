import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { StudioMode } from './types/mode';
import { BuilderWorkspace } from './components/builder/BuilderWorkspace';
import { SingleGateWorkspace } from './components/builder/SingleGateWorkspace';
import { LiveSimulationWorkspace } from './components/workspaces/LiveSimulationWorkspace';

const VALID_MODES: StudioMode[] = ['builder', 'single-gate-lab', 'live-simulation'];

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
  // App View Mode initialized with persistent state from URL Hash & LocalStorage
  const [appMode, setAppModeState] = useState<StudioMode>(getInitialMode);

  // Live Simulation Presets & Architecture State
  const [architecture, setArchitecture] = useState<string>('1-bit-alu');
  const [synthesis, setSynthesis] = useState<string>('clifford_t');
  const [preset, setPreset] = useState<string>('Full Adder');

  const handleModeChange = (mode: StudioMode) => {
    setAppModeState(mode);
    if (typeof window !== 'undefined') {
      window.location.hash = `#${mode}`;
      localStorage.setItem('qc_studio_active_tab', mode);
    }
  };

  useEffect(() => {
    // Synchronize browser history / URL hash changes
    const onHashChange = () => {
      const currentHash = window.location.hash.replace(/^#\/?/, '') as StudioMode;
      if (VALID_MODES.includes(currentHash)) {
        setAppModeState(currentHash);
        localStorage.setItem('qc_studio_active_tab', currentHash);
      }
    };

    // If URL hash is not set, initialize it with current mode
    if (!window.location.hash) {
      window.location.hash = `#${appMode}`;
    }

    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []); // eslint-disable-line

  return (
    <div className="app-container">
      {/* Top Header Mode Controller */}
      <Header
        appMode={appMode}
        architecture={architecture}
        synthesis={synthesis}
        preset={preset}
        onModeChange={handleModeChange}
        onArchChange={setArchitecture}
        onSynthChange={setSynthesis}
        onPresetChange={setPreset}
        onRunSimulation={() => handleModeChange('live-simulation')}
      />

      {/* Persistent Discriminated Workspaces (preserves state across mode tab switches) */}
      <div
        className="workspace-tab-container"
        style={{ display: appMode === 'builder' ? 'flex' : 'none', flex: 1, minHeight: 0 }}
      >
        <BuilderWorkspace />
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
          architecture={architecture}
          synthesis={synthesis}
          preset={preset}
          onArchChange={setArchitecture}
          onSynthChange={setSynthesis}
          onPresetChange={setPreset}
        />
      </div>
    </div>
  );
};

export default App;
