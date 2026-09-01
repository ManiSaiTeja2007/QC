import React, { useState, useEffect } from 'react';
import { GatePalette } from './GatePalette';
import { CircuitCanvas, PlacedGate } from './CircuitCanvas';
import { TransportBar } from '../TransportBar';
import { StatePanel } from '../StatePanel';
import { StateSummaryStrip } from '../StateSummaryStrip';
import { BlochPanel } from '../BlochPanel';
import { fetchCustomSimulationData } from '../../services/api';
import { SimulationPayload } from '../../types/simulation';

export const BuilderWorkspace: React.FC = () => {
  const [numQubits, setNumQubits] = useState<number>(3);
  const [inputBits, setInputBits] = useState<number[]>([1, 0, 1]);
  const [placedGates, setPlacedGates] = useState<PlacedGate[]>([
    { id: '1', name: 'H', qubits: [0], step: 1 },
    { id: '2', name: 'CX', qubits: [0, 1], step: 2 },
    { id: '3', name: 'T', qubits: [0], step: 3 },
  ]);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);

  // Embedded Simulation State
  const [simulationData, setSimulationData] = useState<SimulationPayload | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [measurementBasis, setMeasurementBasis] = useState<'Z' | 'X' | 'Y'>('Z');
  const [viewMode, setViewMode] = useState<'all' | 'grid' | 'focus'>('all');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(200);

  // Auto-run simulation in background whenever circuit changes
  useEffect(() => {
    let isSubscribed = true;
    const runSimulation = async () => {
      try {
        const data = await fetchCustomSimulationData({
          num_qubits: numQubits,
          input_bits: inputBits,
          gates: placedGates.map((g) => ({ name: g.name, qubits: g.qubits })),
          circuit_name: 'Builder Custom Circuit',
        });
        if (isSubscribed) {
          setSimulationData(data);
          setCurrentStep((prev) => Math.min(prev, data.total_primitive_steps));
        }
      } catch (err) {
        console.error('Failed to update builder simulation:', err);
      }
    };
    runSimulation();
    return () => {
      isSubscribed = false;
    };
  }, [numQubits, inputBits, placedGates]);

  // Handlers for Canvas
  const handleAddQubit = () => {
    if (numQubits < 10) {
      setNumQubits((prev) => prev + 1);
      setInputBits((prev) => [...prev, 0]);
    }
  };

  const handleRemoveQubit = () => {
    if (numQubits > 1) {
      const targetQ = numQubits - 1;
      setNumQubits((prev) => prev - 1);
      setInputBits((prev) => prev.slice(0, targetQ));
      setPlacedGates((prev) => prev.filter((g) => !g.qubits.includes(targetQ)));
      if (selectedQubit >= targetQ) setSelectedQubit(0);
    }
  };

  const handleBitToggle = (qIdx: number) => {
    setInputBits((prev) => {
      const next = [...prev];
      next[qIdx] = next[qIdx] ? 0 : 1;
      return next;
    });
  };

  const handlePlaceGate = (qubit: number, step: number) => {
    if (!selectedGate) return;
    const isMulti = ['CX', 'CZ', 'SWAP'].includes(selectedGate);
    const targetQubit = isMulti ? (qubit + 1 < numQubits ? qubit + 1 : qubit - 1) : qubit;

    const newGate: PlacedGate = {
      id: Math.random().toString(36).substring(2, 9),
      name: selectedGate,
      qubits: isMulti ? [qubit, targetQubit] : [qubit],
      step,
    };

    setPlacedGates((prev) => [...prev.filter((g) => !(g.qubits.includes(qubit) && g.step === step)), newGate]);
  };

  const handleRemoveGate = (gateId: string) => {
    setPlacedGates((prev) => prev.filter((g) => g.id !== gateId));
  };

  const stepData = simulationData ? simulationData.steps[currentStep] : null;
  const qubitNames = simulationData?.qubit_names || Array.from({ length: numQubits }, (_, i) => `Q${i}`);

  return (
    <main className="builder-dedicated-workspace">
      {/* 1. Left Gate Palette */}
      <GatePalette selectedGate={selectedGate} onSelectGate={setSelectedGate} />

      {/* 2. Right Canvas & Integrated Simulation Area */}
      <div className="builder-right-area">
        {/* Canvas Section */}
        <CircuitCanvas
          numQubits={numQubits}
          inputBits={inputBits}
          placedGates={placedGates}
          selectedGate={selectedGate}
          onAddQubit={handleAddQubit}
          onRemoveQubit={handleRemoveQubit}
          onInputBitToggle={handleBitToggle}
          onPlaceGate={handlePlaceGate}
          onRemoveGate={handleRemoveGate}
          onClearCircuit={() => setPlacedGates([])}
        />

        {/* Embedded Live Simulation Section */}
        <div className="builder-sim-dock">
          <TransportBar
            currentStep={currentStep}
            totalSteps={simulationData?.total_primitive_steps || 1}
            totalOps={simulationData?.total_logical_ops || 1}
            currentOpId={stepData?.logical_op_id || 0}
            isPlaying={isPlaying}
            speedMs={speedMs}
            onReset={() => { setIsPlaying(false); setCurrentStep(0); }}
            onPrev={() => { setIsPlaying(false); setCurrentStep((prev) => Math.max(0, prev - 1)); }}
            onNext={() => { setIsPlaying(false); setCurrentStep((prev) => Math.min(simulationData?.total_primitive_steps || 1, prev + 1)); }}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            onStepChange={(step) => { setIsPlaying(false); setCurrentStep(step); }}
            onSpeedChange={setSpeedMs}
          />

          <div className="builder-sim-panels">
            <StatePanel
              stepData={stepData}
              selectedQubit={selectedQubit}
              measurementBasis={measurementBasis}
              onBasisChange={setMeasurementBasis}
            />

            <div className="card panel-bloch-wrapper">
              <StateSummaryStrip
                stepData={stepData}
                selectedQubit={selectedQubit}
                qubitNames={qubitNames}
                viewMode={viewMode}
                onSelectQubit={setSelectedQubit}
              />
              <BlochPanel
                numQubits={numQubits}
                qubitNames={qubitNames}
                stepData={stepData}
                selectedQubit={selectedQubit}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onSelectQubit={setSelectedQubit}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
