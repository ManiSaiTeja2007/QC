import React, { useState, useEffect, useRef } from 'react';
import { SubBar } from '../SubBar';
import { TransportBar } from '../TransportBar';
import { CircuitPanel } from '../CircuitPanel';
import { StatePanel } from '../StatePanel';
import { StateSummaryStrip } from '../StateSummaryStrip';
import { BlochPanel } from '../BlochPanel';
import { fetchSimulationData } from '../../services/api';
import { SimulationPayload } from '../../types/simulation';

interface LiveSimulationWorkspaceProps {
  architecture: string;
  synthesis: string;
  preset: string;
  onArchChange: (arch: string) => void;
  onSynthChange: (synth: string) => void;
  onPresetChange: (preset: string) => void;
}

export const LiveSimulationWorkspace: React.FC<LiveSimulationWorkspaceProps> = ({
  architecture,
  synthesis,
  preset,
  onArchChange,
  onSynthChange,
  onPresetChange,
}) => {
  const [inputBits, setInputBits] = useState<number[]>([1, 1, 1, 0, 1, 1, 0]);
  const [simulationData, setSimulationData] = useState<SimulationPayload | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [measurementBasis, setMeasurementBasis] = useState<'Z' | 'X' | 'Y'>('Z');
  const [viewMode, setViewMode] = useState<'all' | 'grid' | 'focus'>('all');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(200);

  const playTimerRef = useRef<number | null>(null);

  // Load preset simulation data from FastAPI backend
  const loadPresetSimulation = async (overrideArch?: string, customBits?: number[]) => {
    const arch = overrideArch || architecture;
    const bits = customBits || inputBits;
    try {
      const data = await fetchSimulationData({
        architecture: arch,
        synthesis,
        input_bits: bits,
      });
      setSimulationData(data);
      setCurrentStep(0);
    } catch (err) {
      console.error('Failed to load preset simulation:', err);
    }
  };

  useEffect(() => {
    loadPresetSimulation();
  }, [architecture, synthesis]);

  // Handle Bit Toggle
  const handleBitToggle = (index: number) => {
    const nextBits = [...inputBits];
    nextBits[index] = nextBits[index] ? 0 : 1;
    setInputBits(nextBits);
    loadPresetSimulation(architecture, nextBits);
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
    <div className="live-simulation-workspace">
      {/* 1. SubBar Metrics & Bit Toggles */}
      <SubBar
        simulationData={simulationData}
        inputBits={inputBits}
        qubitNames={qubitNames}
        onBitToggle={handleBitToggle}
      />

      {/* 2. Transport Bar & Dual Step Scrubber */}
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

      {/* 3. Main 100vh Workspace Grid (3 Panels Side-by-Side) */}
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
    </div>
  );
};
