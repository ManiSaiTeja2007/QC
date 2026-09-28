import React from 'react';
import { HistogramEntry } from '../../types/verilog';
import { BarChart3 } from 'lucide-react';

interface StateHistogramProps {
  histograms: HistogramEntry[];
}

export const StateHistogram: React.FC<StateHistogramProps> = ({ histograms }) => {
  if (!histograms || histograms.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-6 text-center text-slate-400 text-xs">
        No histogram data available.
      </div>
    );
  }

  // Cap at 32 states for clean display or scroll
  const displayItems = histograms.slice(0, 32);

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4 flex flex-col h-full">
      {/* Header with Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <BarChart3 size={15} className="text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Probability Distribution Comparison
          </span>
          <span className="text-xs text-slate-500 font-mono">
            (Showing {displayItems.length} computational basis states)
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span className="text-amber-300 text-[11px]">Verilog Reference (1.0)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
            <span className="text-indigo-300 text-[11px]">Quantum Measured P(Y_ref)</span>
          </div>
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="overflow-x-auto flex-1 max-h-[440px] rounded border border-slate-800 bg-slate-950/70 p-4">
        <div className="flex items-end gap-3 min-w-max h-56 pt-6 pb-2 border-b border-slate-800">
          {displayItems.map((item, idx) => {
            const qHeightPercent = Math.max(2, item.quantum_prob * 100);
            const isPerfect = item.quantum_prob >= 0.999;

            return (
              <div
                key={idx}
                className="flex flex-col items-center gap-1 group relative w-12"
              >
                {/* Floating tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 border border-slate-700 text-[10px] text-slate-200 px-2 py-1 rounded whitespace-nowrap pointer-events-none z-20 shadow-lg font-mono">
                  State {item.state_label}: {item.quantum_prob.toFixed(3)}
                </div>

                {/* Bars side-by-side */}
                <div className="flex items-end gap-1 h-44 w-full justify-center">
                  {/* Verilog Reference Bar (always 100%) */}
                  <div
                    className="w-3.5 bg-amber-500/80 hover:bg-amber-500 rounded-t transition-all"
                    style={{ height: '100%' }}
                    title={`Verilog Target: 1.0`}
                  />

                  {/* Quantum Probability Bar */}
                  <div
                    className={`w-3.5 rounded-t transition-all ${
                      isPerfect
                        ? 'bg-indigo-500 hover:bg-indigo-400'
                        : item.quantum_prob > 0.5
                        ? 'bg-amber-500 hover:bg-amber-400'
                        : 'bg-rose-500 hover:bg-rose-400'
                    }`}
                    style={{ height: `${qHeightPercent}%` }}
                    title={`Quantum Measured: ${item.quantum_prob.toFixed(3)}`}
                  />
                </div>

                {/* State Label */}
                <span className="text-[10px] font-mono text-slate-400 truncate max-w-full group-hover:text-slate-200">
                  {item.state_label}
                </span>
                <span className="text-[9px] font-mono font-bold text-slate-300">
                  {item.quantum_prob.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
