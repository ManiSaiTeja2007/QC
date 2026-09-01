import React, { useState, useEffect, useMemo } from 'react';
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
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(200);

  // Phase 124–128: Active Qubits Layer & Display Modes
  const [displayMode, setDisplayMode] = useState<'active' | 'selected' | 'all' | 'custom'>('active');
  const [customDisplayedQubits, setCustomDisplayedQubits] = useState<number[]>([]);

  // Calculate active qubits from placed gates and non-ground inputs
  const activeQubits = useMemo(() => {
    const activeSet = new Set<number>();
    placedGates.forEach((g) => g.qubits.forEach((q) => activeSet.add(q)));
    inputBits.forEach((bit, q) => {
      if (bit === 1) activeSet.add(q);
    });
    const list = Array.from(activeSet).sort((a, b) => a - b);
    return list.length > 0 ? list : [0];
  }, [placedGates, inputBits]);

  // Derived effective displayed qubits for Bloch Studio
  const displayedQubits = useMemo(() => {
    if (displayMode === 'selected') {
      return [selectedQubit];
    }
    if (displayMode === 'all') {
      return Array.from({ length: numQubits }, (_, i) => i);
    }
    if (displayMode === 'custom' && customDisplayedQubits.length > 0) {
      return customDisplayedQubits;
    }
    // Default: 'active'
    return activeQubits;
  }, [displayMode, selectedQubit, numQubits, customDisplayedQubits, activeQubits]);

  const handleToggleCustomQubit = (qIdx: number) => {
    setDisplayMode('custom');
    setCustomDisplayedQubits((prev) => {
      const current = prev.length > 0 ? prev : displayedQubits;
      if (current.includes(qIdx)) {
        const next = current.filter((q) => q !== qIdx);
        return next.length > 0 ? next : [qIdx];
      } else {
        return [...current, qIdx].sort((a, b) => a - b);
      }
    });
  };

  const playTimerRef = React.useRef<number | null>(null);

  // Playback timer controls: step through circuit simulation automatically
  useEffect(() => {
    if (isPlaying && simulationData && simulationData.total_primitive_steps > 0) {
      playTimerRef.current = window.setInterval(() => {
        setCurrentStep((prev) => {
          if (prev < simulationData.total_primitive_steps) {
            return prev + 1;
          } else {
            return 0; // loop back to initial step 0
          }
        });
      }, Math.max(80, speedMs));
    } else if (playTimerRef.current) {
      clearInterval(playTimerRef.current);
      playTimerRef.current = null;
    }
    return () => {
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [isPlaying, simulationData, speedMs]);

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
      setCustomDisplayedQubits((prev) => prev.filter((q) => q < targetQ));
    }
  };

  const handleBitToggle = (qIdx: number) => {
    setInputBits((prev) => {
      const next = [...prev];
      next[qIdx] = next[qIdx] ? 0 : 1;
      return next;
    });
  };

  const handlePlaceGate = (qubit: number, step: number, targetQubit?: number) => {
    const gateName = selectedGate;
    if (!gateName) return;
    const isMulti = ['CX', 'CY', 'CZ', 'CH', 'CRX', 'CRY', 'CRZ', 'SWAP', 'ISWAP', 'CCX', 'CSWAP'].includes(gateName);
    const resolvedTarget = isMulti
      ? targetQubit !== undefined && targetQubit !== qubit
        ? targetQubit
        : qubit + 1 < numQubits
        ? qubit + 1
        : qubit - 1
      : qubit;

    const newGate: PlacedGate = {
      id: Math.random().toString(36).substring(2, 9),
      name: gateName,
      qubits: isMulti ? [qubit, resolvedTarget] : [qubit],
      step,
    };

    setPlacedGates((prev) => [
      ...prev.filter((g) => !(g.qubits.includes(qubit) && g.step === step)),
      newGate,
    ]);
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
                displayedQubits={displayedQubits}
                activeQubits={activeQubits}
                onSelectQubit={setSelectedQubit}
              />
              <BlochPanel
                numQubits={numQubits}
                qubitNames={qubitNames}
                stepData={stepData}
                selectedQubit={selectedQubit}
                displayedQubits={displayedQubits}
                activeQubits={activeQubits}
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
                onToggleCustomQubit={handleToggleCustomQubit}
                onSelectQubit={setSelectedQubit}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
