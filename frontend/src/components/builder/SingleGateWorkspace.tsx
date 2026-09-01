import React, { useState, useEffect } from 'react';
import { SingleGatePanel } from './SingleGatePanel';
import { TransportBar } from '../TransportBar';
import { StatePanel } from '../StatePanel';
import { StateSummaryStrip } from '../StateSummaryStrip';
import { BlochPanel } from '../BlochPanel';
import { fetchSingleGateSimulationData } from '../../services/api';
import { SimulationPayload } from '../../types/simulation';

export const SingleGateWorkspace: React.FC = () => {
  const [gateName, setGateName] = useState<string>('H');
  const [inputBits, setInputBits] = useState<number[]>([0]);
  const [params, setParams] = useState<number[]>([1.570796]);

  const [simulationData, setSimulationData] = useState<SimulationPayload | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [measurementBasis, setMeasurementBasis] = useState<'Z' | 'X' | 'Y'>('Z');
  const [viewMode, setViewMode] = useState<'all' | 'grid' | 'focus'>('all');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speedMs, setSpeedMs] = useState<number>(300);

  // Auto-run simulation whenever gate, input bits, or params change
  useEffect(() => {
    let isSubscribed = true;
    const runGateSimulation = async () => {
      try {
        const data = await fetchSingleGateSimulationData({
          gate_name: gateName,
          input_bits: inputBits,
          params,
        });
        if (isSubscribed) {
          setSimulationData(data);
          setCurrentStep(0);
        }
      } catch (err) {
        console.error('Failed to update single gate simulation:', err);
      }
    };
    runGateSimulation();
    return () => {
      isSubscribed = false;
    };
  }, [gateName, inputBits, params]);

  const handleSimulateSingleGate = (name: string, bits: number[], gateParams?: number[]) => {
    setGateName(name);
    setInputBits(bits);
    if (gateParams) setParams(gateParams);
  };

  const stepData = simulationData ? simulationData.steps[currentStep] : null;
  const qubitNames = simulationData?.qubit_names || ['Q0'];

  return (
    <main className="single-gate-workspace">
      {/* Left Gate & Input State Controls */}
      <aside className="single-gate-left-controls">
        <SingleGatePanel onSimulateSingleGate={handleSimulateSingleGate} />
      </aside>

      {/* Right Integrated 3D Simulation Laboratory */}
      <div className="single-gate-right-sim">
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

        <div className="single-gate-sim-panels">
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
              numQubits={simulationData?.num_qubits || 1}
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
    </main>
  );
};
