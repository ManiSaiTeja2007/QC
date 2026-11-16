import React from 'react';
import { BoxPlotStats } from '../../types/verilog';
import { Sliders } from 'lucide-react';

interface FidelityDistributionBoxPlotProps {
  stats: BoxPlotStats;
  totalStates: number;
}

export const FidelityDistributionBoxPlot: React.FC<FidelityDistributionBoxPlotProps> = ({
  stats,
  totalStates,
}) => {
  const { min, q1, median, q3, max, iqr } = stats;

  const svgWidth = 580;
  const svgHeight = 160;
  const paddingLeft = 50;
  const paddingRight = 50;
  const chartWidth = svgWidth - paddingLeft - paddingRight;

  // Scale: 0.0 to 1.0 along the horizontal axis
  const getX = (val: number) => {
    const clamped = Math.max(0.0, Math.min(1.0, val));
    return paddingLeft + clamped * chartWidth;
  };

  const xMin = getX(min);
  const xQ1 = getX(q1);
  const xMedian = getX(median);
  const xQ3 = getX(q3);
  const xMax = getX(max);

  const boxY = 40;
  const boxHeight = 55;
  const centerY = boxY + boxHeight / 2;

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sliders size={15} className="text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Fidelity Distribution Box Plot (Five-Number Summary)
          </span>
          <span className="text-xs text-slate-500 font-mono">
            (N = {totalStates} states)
          </span>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <span>IQR (Q3 - Q1):</span>
          <span className="font-bold text-amber-300 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800">
            {iqr.toFixed(4)}
          </span>
        </div>
      </div>

      {/* SVG Box-and-Whisker Visualization */}
      <div className="overflow-x-auto flex-1 max-h-[300px] rounded border border-slate-800 bg-slate-950/70 p-4">
        <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto select-none font-mono">
          {/* Axis ticks at 0.0, 0.25, 0.5, 0.75, 1.0 */}
          {[0.0, 0.25, 0.5, 0.75, 1.0].map((tick) => {
            const tx = getX(tick);
            return (
              <g key={`tick-${tick}`}>
                <line
                  x1={tx}
                  y1={boxY - 10}
                  x2={tx}
                  y2={boxY + boxHeight + 20}
                  stroke="#334155"
                  strokeDasharray="2,2"
                  strokeWidth={1}
                />
                <text
                  x={tx}
                  y={boxY + boxHeight + 34}
                  textAnchor="middle"
                  fill="#ffffff"
                  style={{ fill: '#ffffff', color: '#ffffff' }}
                  fontSize="11"
                  fontWeight="600"
                  className="select-none font-mono"
                >
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Left Whisker (Min to Q1) */}
          <line
            x1={xMin}
            y1={centerY}
            x2={xQ1}
            y2={centerY}
            stroke="#94a3b8"
            strokeWidth={2}
          />
          {/* Min Cap */}
          <line
            x1={xMin}
            y1={centerY - 14}
            x2={xMin}
            y2={centerY + 14}
            stroke="#94a3b8"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* Right Whisker (Q3 to Max) */}
          <line
            x1={xQ3}
            y1={centerY}
            x2={xMax}
            y2={centerY}
            stroke="#94a3b8"
            strokeWidth={2}
          />
          {/* Max Cap */}
          <line
            x1={xMax}
            y1={centerY - 14}
            x2={xMax}
            y2={centerY + 14}
            stroke="#94a3b8"
            strokeWidth={2.5}
            strokeLinecap="round"
          />

          {/* IQR Box (Q1 to Q3) */}
          <rect
            x={xQ1}
            y={boxY}
            width={Math.max(2, xQ3 - xQ1)}
            height={boxHeight}
            rx={4}
            fill="#065f46"
            fillOpacity={0.65}
            stroke="#10b981"
            strokeWidth={2}
          />

          {/* Median Bar */}
          <line
            x1={xMedian}
            y1={boxY}
            x2={xMedian}
            y2={boxY + boxHeight}
            stroke="#38bdf8"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Value Labels Above (De-duplicated & Staggered to Prevent Text Collisions) */}
          {Math.abs(max - min) < 0.001 ? (
            <text
              x={xMedian}
              y={boxY - 14}
              textAnchor="end"
              fill="#ffffff"
              style={{ fill: '#ffffff', color: '#ffffff' }}
              fontSize="12"
              fontWeight="bold"
              className="select-none font-mono"
            >
              Fidelity: {median.toFixed(3)} (Uniform 100% Match)
            </text>
          ) : (
            <>
              <text
                x={xMin}
                y={boxY - 14}
                textAnchor="start"
                fill="#ffffff"
                style={{ fill: '#ffffff', color: '#ffffff' }}
                fontSize="11"
                fontWeight="bold"
                className="select-none font-mono"
              >
                Min: {min.toFixed(3)}
              </text>
              {Math.abs(xMedian - xMin) > 50 && Math.abs(xMax - xMedian) > 50 && (
                <text
                  x={xMedian}
                  y={boxY - 14}
                  textAnchor="middle"
                  fill="#ffffff"
                  style={{ fill: '#ffffff', color: '#ffffff' }}
                  fontSize="11"
                  fontWeight="bold"
                  className="select-none font-mono"
                >
                  Med: {median.toFixed(3)}
                </text>
              )}
              <text
                x={xMax}
                y={boxY - 14}
                textAnchor="end"
                fill="#ffffff"
                style={{ fill: '#ffffff', color: '#ffffff' }}
                fontSize="11"
                fontWeight="bold"
                className="select-none font-mono"
              >
                Max: {max.toFixed(3)}
              </text>
            </>
          )}
        </svg>

        {/* Statistical Summary Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-2 pt-3 border-t border-slate-800 font-mono text-center">
          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Min</div>
            <div className="text-xs font-bold text-slate-300">{min.toFixed(4)}</div>
          </div>
          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Q1 (25%)</div>
            <div className="text-xs font-bold text-emerald-400">{q1.toFixed(4)}</div>
          </div>
          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Median</div>
            <div className="text-xs font-bold text-sky-400">{median.toFixed(4)}</div>
          </div>
          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Q3 (75%)</div>
            <div className="text-xs font-bold text-emerald-400">{q3.toFixed(4)}</div>
          </div>
          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">Max</div>
            <div className="text-xs font-bold text-slate-300">{max.toFixed(4)}</div>
          </div>
          <div className="bg-slate-900/80 p-1.5 rounded border border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase">IQR</div>
            <div className="text-xs font-bold text-amber-400">{iqr.toFixed(4)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
