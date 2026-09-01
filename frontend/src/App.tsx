import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { SubBar } from './components/SubBar';
import { TransportBar } from './components/TransportBar';
import { CircuitPanel } from './components/CircuitPanel';
import { StatePanel } from './components/StatePanel';
import { StateSummaryStrip } from './components/StateSummaryStrip';
import { BlochPanel } from './components/BlochPanel';
import { GatePalette } from './components/builder/GatePalette';
import { CircuitCanvas, PlacedGate } from './components/builder/CircuitCanvas';
import { fetchSimulationData, fetchCustomSimulationData } from './services/api';
import { SimulationPayload } from './types/simulation';

export const App: React.FC = () => {
  // App View Mode: 'builder' vs 'simulation'
  const [appMode, setAppMode] = useState<'builder' | 'simulation'>('builder');

  // Architecture & Presets State
  const [architecture, setArchitecture] = useState<string>('1-bit-alu');
  const [synthesis, setSynthesis] = useState<string>('clifford_t');
  const [preset, setPreset] = useState<string>('Full Adder');
  const [inputBits, setInputBits] = useState<number[]>([1, 1, 1, 0, 1, 1, 0]);

  // Circuit Builder State
  const [builderNumQubits, setBuilderNumQubits] = useState<number>(3);
  const [builderInputBits, setBuilderInputBits] = useState<number[]>([1, 0, 1]);
  const [builderGates, setBuilderGates] = useState<PlacedGate[]>([
    { id: '1', name: 'H', qubits: [0], step: 1 },
    { id: '2', name: 'CX', qubits: [0, 1], step: 2 },
    { id: '3', name: 'T', qubits: [0], step: 3 },
  ]);
  const [selectedPaletteGate, setSelectedPaletteGate] = useState<string | null>(null);

  // Simulation State
  const [simulationData, setSimulationData] = useState<SimulationPayload | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [measurementBasis, setMeasurementBasis] = useState<'Z' | 'X' | 'Y'>('Z');
  const [viewMode, setViewMode] = useState<'all' | 'grid' | 'focus'>('all');

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(200);

  const playTimerRef = useRef<number | null>(null);

  // Load preset simulation data from FastAPI backend
  const loadPresetSimulation = async (customBits?: number[]) => {
    const bits = customBits || inputBits;
    try {
      const data = await fetchSimulationData({
        architecture,
        synthesis,
        input_bits: bits,
      });
      setSimulationData(data);
      setCurrentStep(0);
    } catch (err) {
      console.error('Failed to load simulation:', err);
    }
  };

  // Run Custom Builder Circuit Simulation
  const runCustomSimulation = async () => {
    try {
      const data = await fetchCustomSimulationData({
        num_qubits: builderNumQubits,
        input_bits: builderInputBits,
        gates: builderGates.map((g) => ({
          name: g.name,
          qubits: g.qubits,
        })),
        circuit_name: 'Custom User Circuit',
      });
      setSimulationData(data);
      setCurrentStep(0);
      setAppMode('simulation');
    } catch (err) {
      console.error('Failed to simulate custom circuit:', err);
    }
  };

  useEffect(() => {
    if (appMode === 'simulation' && !simulationData) {
      loadPresetSimulation();
    }
  }, [architecture, synthesis, appMode]);

  // Handle Architecture change
  const handleArchChange = (arch: string) => {
    setArchitecture(arch);
    let defaults = [1, 1, 1, 0, 1, 1, 0];
    if (arch === 'falfg-gate') defaults = [1, 1, 1, 0, 0];
    if (arch === 'fredkin-gate') defaults = [1, 0, 1];
    if (arch === 'bennett-adder') defaults = [1, 1, 1, 0, 0, 0, 0, 0, 0];
    setInputBits(defaults);
    setSelectedQubit(0);
    loadPresetSimulation(defaults);
  };

  // Handle Preset change
  const handlePresetChange = (presetName: string) => {
    setPreset(presetName);
    let bits = [1, 1, 1, 0, 1, 1, 0];
    if (presetName === 'Full Adder') bits = [1, 1, 1, 0, 1, 1, 0];
    if (presetName === 'Half Adder') bits = [1, 1, 0, 0, 1, 1, 0];
    if (presetName === 'Full Subtractor') bits = [1, 1, 1, 1, 1, 1, 0];
    if (presetName.includes('XOR')) bits = [1, 0, 0, 0, 0, 1, 0];
    if (presetName === 'AND') bits = [1, 1, 0, 0, 0, 0, 0];

    setInputBits(bits);
    setSelectedQubit(0);
    loadPresetSimulation(bits);
  };

  // Builder Canvas Handlers
  const handleAddQubit = () => {
    if (builderNumQubits < 10) {
      setBuilderNumQubits((prev) => prev + 1);
      setBuilderInputBits((prev) => [...prev, 0]);
    }
  };

  const handleRemoveQubit = () => {
    if (builderNumQubits > 1) {
      const targetQ = builderNumQubits - 1;
      setBuilderNumQubits((prev) => prev - 1);
      setBuilderInputBits((prev) => prev.slice(0, targetQ));
      setBuilderGates((prev) => prev.filter((g) => !g.qubits.includes(targetQ)));
    }
  };

  const handleBuilderBitToggle = (qIdx: number) => {
    setBuilderInputBits((prev) => {
      const next = [...prev];
      next[qIdx] = next[qIdx] ? 0 : 1;
      return next;
    });
  };

  const handlePlaceGate = (qubit: number, step: number) => {
    if (!selectedPaletteGate) return;

    const gateName = selectedPaletteGate;
    const isMulti = ['CX', 'CZ', 'SWAP'].includes(gateName);
    const targetQubit = isMulti ? (qubit + 1 < builderNumQubits ? qubit + 1 : qubit - 1) : qubit;

    const newGate: PlacedGate = {
      id: Math.random().toString(36).substring(2, 9),
      name: gateName,
      qubits: isMulti ? [qubit, targetQubit] : [qubit],
      step,
    };

    setBuilderGates((prev) => [...prev.filter((g) => !(g.qubits.includes(qubit) && g.step === step)), newGate]);
  };

  const handleRemoveGate = (gateId: string) => {
    setBuilderGates((prev) => prev.filter((g) => g.id !== gateId));
  };

  // Playback timer controls
  useEffect(() => {
    if (isPlaying && simulationData) {
      playTimerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < simulationData.total_primitive_steps) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, speedMs);
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    return () => {
      if (playTimerRef.current) clearInterval(playTimerRef.current);
    };
  }, [isPlaying, speedMs, simulationData]);

  const stepData = simulationData ? simulationData.steps[currentStep] : null;

  let activeGateName = 'INIT';
  if (stepData && stepData.gate) {
    activeGateName = `Op ${stepData.logical_op_id}: ${stepData.gate.name} Q[${stepData.gate.qubits.join(',')}]`;
  }

  const qubitNames = simulationData?.qubit_names || [
    'Q0 A (Result)', 'Q1 B (Cout)', 'Q2 S0 (Cin)',
    'Q3 S1', 'Q4 M (Mode)', 'Q5 S2', 'Q6 S3'
  ];

  return (
    <div className="app-container">
      {/* 1. Header Control Dock */}
      <Header
        appMode={appMode}
        architecture={architecture}
        synthesis={synthesis}
        preset={preset}
        onModeChange={setAppMode}
        onArchChange={handleArchChange}
        onSynthChange={setSynthesis}
        onPresetChange={handlePresetChange}
        onRunSimulation={() => {
          if (appMode === 'builder') runCustomSimulation();
          else loadPresetSimulation();
        }}
      />

      {/* Mode-Specific Body Layout */}
      {appMode === 'builder' ? (
        <main className="builder-layout">
          <GatePalette
            selectedGate={selectedPaletteGate}
            onSelectGate={setSelectedPaletteGate}
          />
          <CircuitCanvas
            numQubits={builderNumQubits}
            inputBits={builderInputBits}
            placedGates={builderGates}
            selectedGate={selectedPaletteGate}
            onAddQubit={handleAddQubit}
            onRemoveQubit={handleRemoveQubit}
            onInputBitToggle={handleBuilderBitToggle}
            onPlaceGate={handlePlaceGate}
            onRemoveGate={handleRemoveGate}
            onClearCircuit={() => setBuilderGates([])}
          />
        </main>
      ) : (
        <>
          {/* 2. SubBar Metrics & Bit Toggles */}
          <SubBar
            simulationData={simulationData}
            inputBits={inputBits}
            qubitNames={qubitNames}
            onBitToggle={(i) => {
              const nextBits = [...inputBits];
              nextBits[i] = nextBits[i] ? 0 : 1;
              setInputBits(nextBits);
              loadPresetSimulation(nextBits);
            }}
          />

          {/* 3. Transport Bar & Dual Step Scrubber */}
          <TransportBar
            currentStep={currentStep}
            totalSteps={simulationData?.total_primitive_steps || 75}
            totalOps={simulationData?.total_logical_ops || 3}
            currentOpId={stepData?.logical_op_id || 0}
            isPlaying={isPlaying}
            speedMs={speedMs}
            onReset={() => { setIsPlaying(false); setCurrentStep(0); }}
            onPrev={() => { setIsPlaying(false); setCurrentStep((prev) => Math.max(0, prev - 1)); }}
            onNext={() => { setIsPlaying(false); setCurrentStep((prev) => Math.min(simulationData?.total_primitive_steps || 75, prev + 1)); }}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onStepChange={(step) => { setIsPlaying(false); setCurrentStep(step); }}
            onSpeedChange={setSpeedMs}
          />

          {/* 4. Main 100vh Workspace Grid (3 Panels Side-by-Side) */}
          <main className="workspace-grid">
            {/* Panel 1: SVG Quantum Circuit Schematic */}
            <CircuitPanel
              simulationData={simulationData}
              currentStep={currentStep}
              selectedQubit={selectedQubit}
              activeGateName={activeGateName}
              onSelectQubit={setSelectedQubit}
              onSelectStep={setCurrentStep}
            />

            {/* Panel 2: Dirac |ψ⟩ Ket & Measurement Bars */}
            <StatePanel
              stepData={stepData}
              selectedQubit={selectedQubit}
              measurementBasis={measurementBasis}
              onBasisChange={setMeasurementBasis}
            />

            {/* Panel 3: 3D Three.js WebGL Bloch Studio & State Summary */}
            <div className="card panel-bloch-wrapper">
              <StateSummaryStrip
                stepData={stepData}
                selectedQubit={selectedQubit}
                qubitNames={qubitNames}
                viewMode={viewMode}
                onSelectQubit={setSelectedQubit}
              />
              <BlochPanel
                numQubits={simulationData?.num_qubits || 7}
                qubitNames={qubitNames}
                stepData={stepData}
                selectedQubit={selectedQubit}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onSelectQubit={setSelectedQubit}
              />
            </div>
          </main>
        </>
      )}
    </div>
  );
};
export default App;
