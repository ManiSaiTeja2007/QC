import React, { useState } from 'react';
import { Header } from './components/Header';
import { StudioMode } from './types/mode';
import { BuilderWorkspace } from './components/builder/BuilderWorkspace';
import { SingleGateWorkspace } from './components/builder/SingleGateWorkspace';
import { LiveSimulationWorkspace } from './components/workspaces/LiveSimulationWorkspace';

export const App: React.FC = () => {
  // App View Mode: Discriminated Union 'builder' | 'single-gate-lab' | 'live-simulation'
  const [appMode, setAppMode] = useState<StudioMode>('builder');

  // Live Simulation Presets & Architecture State
  const [architecture, setArchitecture] = useState<string>('1-bit-alu');
  const [synthesis, setSynthesis] = useState<string>('clifford_t');
  const [preset, setPreset] = useState<string>('Full Adder');

  return (
    <div className="app-container">
      {/* Top Header Mode Controller */}
      <Header
        appMode={appMode}
        architecture={architecture}
        synthesis={synthesis}
        preset={preset}
        onModeChange={setAppMode}
        onArchChange={setArchitecture}
        onSynthChange={setSynthesis}
        onPresetChange={setPreset}
        onRunSimulation={() => setAppMode('live-simulation')}
      />

      {/* Discriminated Workspace Router */}
      {appMode === 'builder' ? (
        <BuilderWorkspace />
      ) : appMode === 'single-gate-lab' ? (
        <SingleGateWorkspace />
      ) : (
        <LiveSimulationWorkspace
          architecture={architecture}
          synthesis={synthesis}
          preset={preset}
          onArchChange={setArchitecture}
          onSynthChange={setSynthesis}
          onPresetChange={setPreset}
        />
      )}
    </div>
  );
};

export default App;
