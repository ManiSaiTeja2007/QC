import React from 'react';
import { Terminal, CheckCircle2, AlertTriangle, Clock, Trash2 } from 'lucide-react';
import { VerilogSimulateResponse } from '../../types/verilog';

interface CompilerTerminalProps {
  simulationResponse: VerilogSimulateResponse | null;
  logs: string[];
  onClearLogs: () => void;
  isSimulating: boolean;
}

export const CompilerTerminal: React.FC<CompilerTerminalProps> = ({
  simulationResponse,
  logs,
  onClearLogs,
  isSimulating,
}) => {
  const isSuccess = simulationResponse?.status === 'iverilog_success';
  const isError =
    simulationResponse?.status === 'syntax_error' ||
    simulationResponse?.status === 'compilation_error' ||
    simulationResponse?.status === 'runtime_error' ||
    simulationResponse?.status === 'simulation_timeout';

  return (
    <div className="v-ide-terminal-container">
      {/* Terminal Title Bar */}
      <div className="v-ide-terminal-header">
        <div className="v-ide-terminal-title">
          <Terminal size={14} className="text-emerald-400" />
          <span>Icarus Verilog Execution Terminal</span>
          {simulationResponse && (
            <span className={`v-status-pill ${isSuccess ? 'success' : isError ? 'error' : 'neutral'}`}>
              {isSuccess && <CheckCircle2 size={11} />}
              {isError && <AlertTriangle size={11} />}
              <span>{simulationResponse.status}</span>
            </span>
          )}
        </div>

        <div className="v-ide-terminal-meta">
          {simulationResponse?.execution_time_ms !== undefined && (
            <span className="v-meta-item">
              <Clock size={11} />
              <span>{simulationResponse.execution_time_ms.toFixed(1)} ms</span>
            </span>
          )}
          {simulationResponse?.total_states !== undefined && (
            <span className="v-meta-item">
              <span>{simulationResponse.total_states} truth-table states</span>
            </span>
          )}
          <button onClick={onClearLogs} className="v-ide-btn-icon" title="Clear Terminal Logs">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Terminal Output Body */}
      <div className="v-ide-terminal-body">
        {isSimulating && (
          <div className="v-term-line text-cyan-400">
            [iverilog] Compiling Verilog module and generating self-contained 2^k testbench...
          </div>
        )}

        {logs.map((log, idx) => (
          <div key={idx} className="v-term-line">
            {log}
          </div>
        ))}

        {simulationResponse?.message && (
          <div className={`v-term-line ${isSuccess ? 'text-emerald-400' : 'text-amber-400'}`}>
            {simulationResponse.message}
          </div>
        )}

        {simulationResponse?.stderr && (
          <div className="v-term-error-block">
            <div className="v-term-error-header">Compiler Diagnostics / Stderr:</div>
            <pre className="v-term-stderr">{simulationResponse.stderr}</pre>
          </div>
        )}

        {simulationResponse?.table && simulationResponse.table.length > 0 && (
          <div className="v-term-table-summary">
            <div className="v-term-table-header">Generated Classical Truth Table Preview:</div>
            <div className="v-term-table-grid">
              {simulationResponse.table.slice(0, 16).map((row, idx) => (
                <div key={idx} className="v-term-table-row">
                  <span className="text-sky-300 font-mono">in: {row.input_bitstring}</span>
                  <span className="text-gray-500">→</span>
                  <span className="text-emerald-300 font-mono">out: {row.output_bitstring}</span>
                </div>
              ))}
              {simulationResponse.table.length > 16 && (
                <div className="v-term-table-row text-gray-500">
                  ... +{simulationResponse.table.length - 16} additional states (see Equivalence Drawer below)
                </div>
              )}
            </div>
          </div>
        )}

        {!isSimulating && logs.length === 0 && !simulationResponse && (
          <div className="v-term-placeholder">
            <span>Ready. Click <b>"Run Icarus"</b> above to compile standalone, or <b>"Verify Against Quantum"</b> to cross-verify against the active circuit.</span>
          </div>
        )}
      </div>
    </div>
  );
};
