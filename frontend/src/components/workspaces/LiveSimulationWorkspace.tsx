import React, { useState, useEffect, useRef } from 'react';
import { SubBar } from '../SubBar';
import { TransportBar } from '../TransportBar';
import { CircuitPanel } from '../CircuitPanel';
import { StatePanel } from '../StatePanel';
import { StateSummaryStrip } from '../StateSummaryStrip';
import { BlochPanel } from '../BlochPanel';
import { fetchSimulationData, simulateStoredCircuit } from '../../services/api';
import { SimulationPayload } from '../../types/simulation';
import { CircuitIndexEntry } from '../../types/circuit';
import { circuitStore } from '../../services/circuitStore';
import { GateInfoModal } from '../GateInfoModal';

import { FloatingToolbox } from '../FloatingToolbox';
import { CrossVerifyPanel } from '../verilog/CrossVerifyPanel';

interface LiveSimulationWorkspaceProps {
  initialArchitecture?: string;
  onArchChange?: (arch: string) => void;
  onNavigateToVerilogStudio?: () => void;
}

const LEGACY_PRESETS = ['1-bit-alu', 'falfg-gate', 'fredkin-gate', 'bennett-adder'];

export const LiveSimulationWorkspace: React.FC<LiveSimulationWorkspaceProps> = ({
  initialArchitecture = '1-bit-alu',
  onArchChange,
  onNavigateToVerilogStudio,
}) => {
  // Simulation controls — architecture is also driven externally by sidebar
  const [architecture, setArchitectureState] = useState<string>(initialArchitecture);
  const [synthesis, setSynthesis] = useState<string>('clifford_t');
  const [preset, setPreset] = useState<string>('Full Adder');
  const [availableCircuits, setAvailableCircuits] = useState<CircuitIndexEntry[]>([]);

  // Fetch all stored library circuits via shared circuitStore
  useEffect(() => {
    circuitStore.getCatalog()
      .then((res) => setAvailableCircuits(res.circuits))
      .catch((err) => console.warn('Could not fetch stored circuits:', err));

    const unsubscribe = circuitStore.subscribe(() => {
      circuitStore.getCatalog()
        .then((res) => setAvailableCircuits(res.circuits))
        .catch(() => {});
    });
    return unsubscribe;
  }, []);

  // Sync when sidebar or modal changes the architecture
  useEffect(() => {
    setArchitectureState(initialArchitecture);
  }, [initialArchitecture]);

  // Wrapper that also notifies App so selectedArch stays in sync
  const setArchitecture = (arch: string) => {
    setArchitectureState(arch);
    onArchChange?.(arch);
  };

  const [inputBits, setInputBits] = useState<number[]>([1, 1, 1, 0, 1, 1, 0]);
  const [simulationData, setSimulationData] = useState<SimulationPayload | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [measurementBasis, setMeasurementBasis] = useState<'Z' | 'X' | 'Y'>('Z');
  const [viewMode, setViewMode] = useState<'all' | 'grid' | 'focus'>('all');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(200);
  const [activeModalGate, setActiveModalGate] = useState<{
    name: string;
    qubits: number[];
    stepIndex: number;
  } | null>(null);

  const playTimerRef = useRef<number | null>(null);

  const loadPresetSimulation = async (overrideArch?: string, customBits?: number[]) => {
    const arch = overrideArch || architecture;
    const bits = customBits || inputBits;
    const isLegacy = LEGACY_PRESETS.includes(arch);

    try {
      let data: SimulationPayload;
      if (isLegacy) {
        data = await fetchSimulationData({
          architecture: arch,
          synthesis,
          input_bits: bits,
        });
      } else {
        data = await simulateStoredCircuit(arch, bits);
      }
      setSimulationData(data);
      if (data.num_qubits !== bits.length) {
        const adjusted = [...bits, ...Array(data.num_qubits).fill(0)].slice(0, data.num_qubits);
        setInputBits(adjusted);
      }
      setCurrentStep(0);
    } catch (err) {
      console.error('Failed to load preset simulation:', err);
    }
  };

  useEffect(() => {
    loadPresetSimulation();
  }, [architecture, synthesis]); // eslint-disable-line

  const handleBitToggle = (index: number) => {
    const nextBits = [...inputBits];
    nextBits[index] = nextBits[index] ? 0 : 1;
    setInputBits(nextBits);
    loadPresetSimulation(architecture, nextBits);
  };

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
      {/* ── Inline Controls Bar (replaces removed Header controls) ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 14px',
        background: 'rgba(13,19,33,0.95)',
        borderBottom: '1px solid var(--card-border)',
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        {/* Architecture */}
        <div className="control-group">
          <label>Architecture</label>
          <select value={architecture} onChange={e => setArchitecture(e.target.value)}>
            <optgroup label="Core Presets">
              <option value="1-bit-alu">1-Bit Quantum ALU (28 Ops)</option>
              <option value="falfg-gate">5×5 FALFG Gate</option>
              <option value="fredkin-gate">3×3 Fredkin CSWAP Gate</option>
              <option value="bennett-adder">Bennett Uncomputed Adder</option>
            </optgroup>
            {availableCircuits.filter(c => !['1_bit_alu_clifford_t', 'falfg_5x5', 'fredkin_cswap', 'bennett_adder'].includes(c.id)).length > 0 && (
              <optgroup label="Stored Custom Circuits">
                {availableCircuits
                  .filter(c => !['1_bit_alu_clifford_t', 'falfg_5x5', 'fredkin_cswap', 'bennett_adder'].includes(c.id))
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.num_qubits}Q)
                    </option>
                  ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Library */}
        <div className="control-group">
          <label>Library</label>
          <select value={synthesis} onChange={e => setSynthesis(e.target.value)}>
            <option value="clifford_t">Clifford+T (Fault-Tolerant)</option>
            <option value="ncv">NCV Library</option>
          </select>
        </div>

        {/* Preset */}
        <div className="control-group">
          <label>Preset / Test Gallery</label>
          <select value={preset} onChange={e => setPreset(e.target.value)}>
            <option value="Full Adder">Full Adder (M=1, S2=1)</option>
            <option value="Half Adder">Half Adder (M=1, S2=1, S1=0)</option>
            <option value="Full Subtractor">Full Subtractor</option>
            <option value="XOR (A!=B)">Logic XOR (M=0)</option>
            <option value="AND">Logic AND (M=0)</option>
          </select>
        </div>

        {/* Run button */}
        <button
          className="btn btn-primary"
          style={{ marginLeft: 4 }}
          onClick={() => loadPresetSimulation()}
        >
          ⚡ Run Simulation
        </button>
      </div>

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

      {/* 3. Main Workspace Grid (3 Panels Side-by-Side) */}
      <main className="workspace-grid">
        {/* Panel 1: SVG Quantum Circuit Schematic */}
        <CircuitPanel
          simulationData={simulationData}
          currentStep={currentStep}
          selectedQubit={selectedQubit}
          activeGateName={activeGateName}
          onSelectQubit={setSelectedQubit}
          onSelectStep={setCurrentStep}
          onGateClick={(name, qubits, stepIndex) => setActiveModalGate({ name, qubits, stepIndex })}
          onInspectActiveGate={() => {
            if (stepData?.gate) {
              setActiveModalGate({
                name: stepData.gate.name,
                qubits: stepData.gate.qubits,
                stepIndex: currentStep,
              });
            }
          }}
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

      {/* Classical Cross-Verify Floating Toolbox */}
      <FloatingToolbox
        title="🔌 Classical Cross-Verify"
        defaultPosition={{ x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 430) : 740, y: 110 }}
        collapsedByDefault={false}
        width={410}
        accentColor="#10b981"
      >
        <CrossVerifyPanel
          simulationData={simulationData}
          architecture={architecture}
          inputBits={inputBits}
          qubitNames={qubitNames}
          onOpenInVerilogStudio={onNavigateToVerilogStudio}
        />
      </FloatingToolbox>

      {/* Gate Inspection Modal */}
      {activeModalGate && (
        <GateInfoModal
          gateName={activeModalGate.name}
          qubits={activeModalGate.qubits}
          stepIndex={activeModalGate.stepIndex}
          qubitNames={qubitNames}
          onClose={() => setActiveModalGate(null)}
        />
      )}
    </div>
  );
};



