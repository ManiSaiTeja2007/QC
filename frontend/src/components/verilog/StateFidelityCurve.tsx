import React, { useState } from 'react';
import { Activity } from 'lucide-react';

interface StateFidelityCurveProps {
  fidelityCurve: number[];
  avgFidelity: number;
}

export const StateFidelityCurve: React.FC<StateFidelityCurveProps> = ({
  fidelityCurve,
  avgFidelity,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!fidelityCurve || fidelityCurve.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-6 text-center text-slate-400 text-xs">
        No state fidelity curve data available.
      </div>
    );
  }

  const numPoints = fidelityCurve.length;
  const svgWidth = 640;
  const svgHeight = 240;
  const paddingLeft = 55;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 48;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Scale coordinates: X from 0 to numPoints-1, Y from 0.0 to 1.0
  const getX = (idx: number) => {
    if (numPoints <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (idx / (numPoints - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(0.0, Math.min(1.0, val));
    return paddingTop + (1.0 - clamped) * chartHeight;
  };

  // Generate SVG path points
  const points = fidelityCurve.map((val, idx) => `${getX(idx)},${getY(val)}`);
  const pathD = points.length > 0 ? `M ${points.join(' L ')}` : '';
  const areaD =
    points.length > 0
      ? `M ${getX(0)},${getY(0)} L ${points.join(' L ')} L ${getX(numPoints - 1)},${
          paddingTop + chartHeight
        } L ${getX(0)},${paddingTop + chartHeight} Z`
      : '';

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Quantum State Fidelity Curve: F(x) = |⟨ψ_expected|ψ_actual⟩|²
          </span>
          <span className="text-xs text-slate-500 font-mono">
            ({numPoints} basis states)
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <span className="text-slate-400">Mean Fidelity:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded ${
              avgFidelity >= 0.999
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : avgFidelity >= 0.8
                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}
          >
            {avgFidelity.toFixed(4)}
          </span>
        </div>
      </div>

      {/* SVG Line Chart */}
      <div className="overflow-x-auto flex-1 max-h-[440px] rounded border border-slate-800 bg-slate-950/70 p-3 relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto max-h-72 select-none font-mono"
        >
          {/* Horizontal Grid lines at 1.0, 0.75, 0.5, 0.25, 0.0 */}
          {[1.0, 0.75, 0.5, 0.25, 0.0].map((level) => {
            const yPos = getY(level);
            return (
              <g key={`grid-${level}`}>
                <line
                  x1={paddingLeft}
                  y1={yPos}
                  x2={svgWidth - paddingRight}
                  y2={yPos}
                  stroke={level === 1.0 ? '#059669' : '#334155'}
                  strokeDasharray={level === 1.0 ? 'none' : '3,3'}
                  strokeWidth={level === 1.0 ? 1.5 : 1}
                />
                <text
                  x={paddingLeft - 8}
                  y={yPos + 4}
                  textAnchor="end"
                  fill="#ffffff"
                  style={{ fill: '#ffffff', color: '#ffffff' }}
                  fontSize="11"
                  fontWeight="600"
                  className="select-none font-mono"
                >
                  {level.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Area fill */}
          {areaD && (
            <path
              d={areaD}
              fill="url(#fidelityGradient)"
              fillOpacity={0.25}
            />
          )}

          {/* Path line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {fidelityCurve.map((val, idx) => {
            const cx = getX(idx);
            const cy = getY(val);
            const isHovered = hoveredIndex === idx;

            return (
              <circle
                key={`pt-${idx}`}
                cx={cx}
                cy={cy}
                r={isHovered ? 5.5 : 3.5}
                fill={val >= 0.999 ? '#10b981' : val >= 0.5 ? '#f59e0b' : '#ef4444'}
                stroke="#0f172a"
                strokeWidth={1.5}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}

          {/* X Axis Base */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={svgWidth - paddingRight}
            y2={paddingTop + chartHeight}
            stroke="#475569"
            strokeWidth={1.5}
          />

          {/* X Axis Labels */}
          {fidelityCurve.map((_, idx) => {
            // Show every 1st, 2nd or 4th label depending on count
            const step = Math.ceil(numPoints / 16);
            if (idx % step !== 0 && idx !== numPoints - 1) return null;

            return (
              <text
                key={`lbl-${idx}`}
                x={getX(idx)}
                y={paddingTop + chartHeight + 18}
                textAnchor="middle"
                fill="#ffffff"
                style={{ fill: '#ffffff', color: '#ffffff' }}
                fontSize="11"
                fontWeight="500"
                className="select-none font-mono"
              >
                S{idx}
              </text>
            );
          })}

          {/* Gradients */}
          <defs>
            <linearGradient id="fidelityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>

        {/* Floating tooltip */}
        {hoveredIndex !== null && (
          <div className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono shadow-xl backdrop-blur-sm pointer-events-none">
            <span className="text-slate-400">State {hoveredIndex}: </span>
            <span className="text-cyan-300 font-bold">
              F = {fidelityCurve[hoveredIndex].toFixed(4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
