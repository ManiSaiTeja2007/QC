import React from 'react';
import { SimulationPayload } from '../types/simulation';

interface SubBarProps {
  simulationData: SimulationPayload | null;
  inputBits: number[];
  qubitNames: string[];
  onBitToggle: (index: number) => void;
}

export const SubBar: React.FC<SubBarProps> = ({
  simulationData,
  inputBits,
  qubitNames,
  onBitToggle,
}) => {
  const isPass = simulationData ? simulationData.parity_preserved : true;
  const pIn = simulationData ? simulationData.p_in : 1;
  const pOut = simulationData ? simulationData.p_out : 1;
  const inBitsStr = simulationData ? simulationData.input_bits.join('') : '1110110';
  const outBitsStr = simulationData ? simulationData.output_bits.join('') : '0111110';

  const metrics = simulationData?.metrics || {
    quantum_cost: 26,
    t_count: 28,
    t_depth: 14,
    num_gates: 75,
  };

  return (
    <section className="dock-subbar">
      <div className={`badge ${isPass ? 'pass' : 'fail'}`}>
        {isPass
          ? `✅ Parity Preserved: P_in = ${pIn} == P_out = ${pOut} | Input ${inBitsStr} → Output ${outBitsStr}`
          : `⚠️ Parity Altered: P_in = ${pIn} ≠ P_out = ${pOut}`}
      </div>

      <div className="qubit-toggles-inline">
        <span className="label">Qubits:</span>
        <div className="toggles-container">
          {qubitNames.map((name, i) => (
            <button
              key={i}
              className={`bit-toggle ${inputBits[i] ? 'active' : ''}`}
              onClick={() => onBitToggle(i)}
            >
              {name.split(' ')[0]}: {inputBits[i] ?? 0}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics-pills">
        <div className="pill">
          <span className="lbl">Qubits</span>
          <span className="val">{simulationData?.num_qubits || 7}</span>
        </div>
        <div className="pill">
          <span className="lbl">Logical Ops</span>
          <span className="val">{simulationData?.total_logical_ops || 3}</span>
        </div>
        <div className="pill">
          <span className="lbl">Primitive Gates</span>
          <span className="val">{simulationData?.total_primitive_steps || 75}</span>
        </div>
        <div className="pill">
          <span className="lbl">QC</span>
          <span className="val">{metrics.quantum_cost}</span>
        </div>
        <div className="pill">
          <span className="lbl">T-Count</span>
          <span className="val">{metrics.t_count}</span>
        </div>
        <div className="pill">
          <span className="lbl">T-Depth</span>
          <span className="val">{metrics.t_depth}</span>
        </div>
      </div>
    </section>
  );
};
