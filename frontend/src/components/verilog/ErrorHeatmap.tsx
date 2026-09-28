import React, { useState } from 'react';
import { HeatmapData } from '../../types/verilog';
import { Grid, HelpCircle } from 'lucide-react';

interface ErrorHeatmapProps {
  heatmap: HeatmapData;
  errorRate: number;
}

export const ErrorHeatmap: React.FC<ErrorHeatmapProps> = ({ heatmap, errorRate }) => {
  const [hoveredCell, setHoveredCell] = useState<{
    stateIdx: number;
    bitIdx: number;
    isError: boolean;
    stateLabel: string;
    bitName: string;
  } | null>(null);

  const { input_labels, output_bit_names, matrix } = heatmap;
  const numRows = matrix.length;
  const numCols = output_bit_names.length;

  if (numRows === 0 || numCols === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-6 text-center text-slate-400 text-xs">
        No heatmap data available. Run verification to generate error matrix.
      </div>
    );
  }

  // Cell sizing constants for SVG grid
  const cellWidth = Math.max(36, Math.min(60, 480 / Math.max(numCols, 1)));
  const cellHeight = Math.max(20, Math.min(28, 380 / Math.max(numRows, 1)));
  const labelWidth = 140;
  const headerHeight = 36;
  const totalSvgWidth = labelWidth + numCols * cellWidth + 20;
  const totalSvgHeight = headerHeight + numRows * cellHeight + 20;

  return (
    <div className="bg-slate-900/90 border border-slate-700 rounded-lg p-4 flex flex-col h-full">
      {/* Header with legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Grid size={15} className="text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            2D Error & Discrepancy Heatmap
          </span>
          <span className="text-xs text-slate-400 font-mono">
            ({numRows} states × {numCols} bits)
          </span>
        </div>

        {/* Color Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500/90 border border-emerald-400 shadow-sm inline-block" />
            <span className="text-slate-300 text-[11px]">Match (Bit Error = 0)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-600 border border-rose-400 shadow-sm inline-block" />
            <span className="text-rose-300 text-[11px] font-semibold">Mismatch (Bit Error = 1)</span>
          </div>
          <span className="text-slate-500 text-[11px] border-l border-slate-700 pl-3">
            Error Rate: {(errorRate * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* SVG Heatmap Container */}
      <div className="overflow-auto flex-1 max-h-[440px] rounded border border-slate-800 bg-slate-950/70 p-2 relative">
        <svg
          width={totalSvgWidth}
          height={totalSvgHeight}
          className="select-none font-mono"
        >
          {/* Column Headers (Output Bits) */}
          {output_bit_names.map((bitName, c) => (
            <text
              key={`col-${c}`}
              x={labelWidth + c * cellWidth + cellWidth / 2}
              y={headerHeight - 8}
              textAnchor="middle"
              className="fill-slate-300 text-[11px] font-bold"
            >
              {bitName}
            </text>
          ))}

          {/* Rows */}
          {matrix.map((row, r) => {
            const y = headerHeight + r * cellHeight;
            const stateLabel = input_labels[r] || `State ${r}`;

            return (
              <g key={`row-${r}`}>
                {/* Row Label (Input State) */}
                <text
                  x={labelWidth - 10}
                  y={y + cellHeight / 2 + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px]"
                >
                  {stateLabel}
                </text>

                {/* Cells */}
                {row.map((val, c) => {
                  const x = labelWidth + c * cellWidth;
                  const isError = val === 1;
                  const isHovered =
                    hoveredCell?.stateIdx === r && hoveredCell?.bitIdx === c;

                  return (
                    <rect
                      key={`cell-${r}-${c}`}
                      x={x + 1}
                      y={y + 1}
                      width={cellWidth - 2}
                      height={cellHeight - 2}
                      rx={3}
                      fill={isError ? '#ef4444' : '#10b981'}
                      fillOpacity={isError ? 0.95 : 0.85}
                      stroke={isHovered ? '#ffffff' : isError ? '#f87171' : '#34d399'}
                      strokeWidth={isHovered ? 2 : 1}
                      className="cursor-pointer transition-all duration-150"
                      onMouseEnter={() =>
                        setHoveredCell({
                          stateIdx: r,
                          bitIdx: c,
                          isError,
                          stateLabel,
                          bitName: output_bit_names[c],
                        })
                      }
                      onMouseLeave={() => setHoveredCell(null)}
                    />
                  );
                })}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredCell && (
          <div className="absolute bottom-3 right-3 bg-slate-900/95 border border-slate-700 rounded px-3 py-2 text-xs shadow-xl backdrop-blur-sm pointer-events-none z-10 font-mono">
            <div className="text-slate-200 font-semibold mb-1">
              {hoveredCell.stateLabel} → {hoveredCell.bitName}
            </div>
            <div
              className={`flex items-center gap-1 font-bold ${
                hoveredCell.isError ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {hoveredCell.isError ? 'BIT MISMATCH (1)' : 'EXACT BIT MATCH (0)'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
