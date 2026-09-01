import React, { useState, useEffect } from 'react';
import { SingleGatePanel } from './SingleGatePanel';
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
  const [currentStep, setCurrentStep] = useState<number>(1); // Default to Step 1 (Post-Gate)
  const [selectedQubit, setSelectedQubit] = useState<number>(0);
  const [measurementBasis, setMeasurementBasis] = useState<'Z' | 'X' | 'Y'>('Z');
  const [viewMode, setViewMode] = useState<'all' | 'grid' | 'focus'>('all');

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
          setCurrentStep(1); // Show transformed state by default
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

  const step0 = simulationData?.steps[0] || null;
  const step1 = simulationData?.steps[1] || null;
  const currentStepData = simulationData ? simulationData.steps[currentStep] : null;
  const qubitNames = simulationData?.qubit_names || ['Q0'];

  return (
    <main className="single-gate-workspace">
      {/* Left Gate & Input State Controls */}
      <aside className="single-gate-left-controls">
        <SingleGatePanel onSimulateSingleGate={handleSimulateSingleGate} />
      </aside>

      {/* Right Integrated Dual Before/After Comparison Laboratory */}
      <div className="single-gate-right-sim">
        {/* Step Selector Header */}
        <div className="gate-step-toggle-dock">
          <span className="gate-flow-lbl">
            <b>{step0?.psi_ket || '|0⟩'}</b> &nbsp; ──[ <b>{gateName}</b> ]──→ &nbsp; <b>{step1?.psi_ket || '|+⟩'}</b>
          </span>

          <div className="step-btn-group">
            <button
              className={`btn btn-xs ${currentStep === 0 ? 'active' : ''}`}
              onClick={() => setCurrentStep(0)}
            >
              Step 0: Initial State |ψ₀⟩
            </button>
            <button
              className={`btn btn-xs ${currentStep === 1 ? 'active' : ''}`}
              onClick={() => setCurrentStep(1)}
            >
              Step 1: Post-Gate State |ψ₁⟩
            </button>
          </div>
        </div>

        <div className="single-gate-sim-panels">
          <StatePanel
            stepData={currentStepData}
            selectedQubit={selectedQubit}
            measurementBasis={measurementBasis}
            onBasisChange={setMeasurementBasis}
          />

          <div className="card panel-bloch-wrapper">
            <StateSummaryStrip
              stepData={currentStepData}
              selectedQubit={selectedQubit}
              qubitNames={qubitNames}
              viewMode={viewMode}
              onSelectQubit={setSelectedQubit}
            />
            <BlochPanel
              numQubits={simulationData?.num_qubits || 1}
              qubitNames={qubitNames}
              stepData={currentStepData}
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
