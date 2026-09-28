import React, { useState, useMemo } from 'react';
import { TruthTableRow } from '../../types/verilog';
import { Grid, Sparkles } from 'lucide-react';

interface KarnaughMapVisualizerProps {
  truthTable: TruthTableRow[];
  outputPortNames?: string[];
}

export const KarnaughMapVisualizer: React.FC<KarnaughMapVisualizerProps> = ({
  truthTable,
  outputPortNames = ['sum', 'cout'],
}) => {
  // Discover available outputs if not specified
  const outputs = useMemo(() => {
    if (truthTable.length > 0 && truthTable[0].verilog_output_values) {
      const keys = Object.keys(truthTable[0].verilog_output_values);
      if (keys.length > 0) return keys;
    }
    return outputPortNames;
  }, [truthTable, outputPortNames]);

  const [selectedOutput, setSelectedOutput] = useState<string>(outputs[0] || 'sum');

  // Input variable count and names
  const inputVarNames = useMemo(() => {
    if (truthTable.length > 0 && truthTable[0].input_values) {
      return Object.keys(truthTable[0].input_values);
    }
    if (truthTable.length > 0) {
      const len = truthTable[0].input_bitstring.length;
      return len === 3 ? ['A', 'B', 'Cin'] : len === 2 ? ['A', 'B'] : ['A', 'B', 'C', 'D'].slice(0, len);
    }
    return ['A', 'B', 'Cin'];
  }, [truthTable]);

  const numVars = inputVarNames.length;

  // Build a lookup map: input_bitstring -> output bit value (0 or 1)
  const bitLookup = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of truthTable) {
      const val = row.verilog_output_values?.[selectedOutput] ?? 0;
      map.set(row.input_bitstring, val);
    }
    return map;
  }, [truthTable, selectedOutput]);

  // Gray Code headers
  // For 3 variables (e.g. A on row, B Cin on cols):
  // Rows: A in ['0', '1']
  // Cols: BCin in ['00', '01', '11', '10']
  const rowHeaders = useMemo(() => {
    if (numVars <= 3) return ['0', '1'];
    return ['00', '01', '11', '10']; // 4 variables
  }, [numVars]);

  const colHeaders = useMemo(() => {
    if (numVars === 2) return ['0', '1'];
    return ['00', '01', '11', '10']; // 3 or 4 variables
  }, [numVars]);

  const rowVarsLabel = useMemo(() => {
    if (numVars <= 3) return inputVarNames[0] || 'A';
    return `${inputVarNames[0]}${inputVarNames[1]}`;
  }, [numVars, inputVarNames]);

  const colVarsLabel = useMemo(() => {
    if (numVars <= 2) return inputVarNames[1] || 'B';
    if (numVars === 3) return `${inputVarNames[1]}${inputVarNames[2]}`;
    return `${inputVarNames[2]}${inputVarNames[3]}`;
  }, [numVars, inputVarNames]);

  // Compute cell value for row (rIdx) and col (cIdx)
  const getCellValue = (rHeader: string, cHeader: string): { bit: number; bitstring: string } => {
    const bitstring = `${rHeader}${cHeader}`;
    const bit = bitLookup.get(bitstring) ?? 0;
    return { bit, bitstring };
  };

  // Extract minterms (indices where output is 1) for Canonical SOP
  const minterms = useMemo(() => {
    const terms: number[] = [];
    for (const row of truthTable) {
      const val = row.verilog_output_values?.[selectedOutput] ?? 0;
      if (val === 1) terms.push(row.state_index);
    }
    return terms;
  }, [truthTable, selectedOutput]);

  // Generate a simplified or canonical representation text
  const sopExpression = useMemo(() => {
    if (minterms.length === 0) return '0 (Always False)';
    if (minterms.length === Math.pow(2, numVars)) return '1 (Always True)';
    return `Σ m(${minterms.join(', ')})`;
  }, [minterms, numVars]);

  return (
    <div className="v-analytics-card">
      {/* K-Map Header */}
      <div className="v-analytics-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Grid size={15} style={{ color: '#fbbf24' }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#e2e8f0' }}>
            Karnaugh Map (K-Map) Synthesis
          </span>
          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', background: 'rgba(56, 189, 248, 0.12)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: 4 }}>
            {numVars}-Variable Gray-Code Grid
          </span>
        </div>

        {/* Output Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.70rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>Target Output:</span>
          <div className="v-filter-group">
            {outputs.map((out) => (
              <button
                key={out}
                onClick={() => setSelectedOutput(out)}
                className={`v-filter-btn ${selectedOutput === out ? 'active-all' : ''}`}
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {out}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main K-Map Grid Visualization */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, padding: '8px 4px', flexWrap: 'wrap' }}>
        {/* The 2D Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Header Row: Variables label & Column Gray codes */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 70,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px 0 0 0',
                fontSize: '0.70rem',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                color: '#38bdf8',
              }}
            >
              {rowVarsLabel} \ {colVarsLabel}
            </div>
            {colHeaders.map((colH) => (
              <div
                key={colH}
                style={{
                  width: 64,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0d1527',
                  border: '1px solid #334155',
                  borderLeft: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: '#94a3b8',
                }}
              >
                {colH}
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          {rowHeaders.map((rowH) => (
            <div key={rowH} style={{ display: 'flex', alignItems: 'center' }}>
              {/* Row Header */}
              <div
                style={{
                  width: 70,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0d1527',
                  border: '1px solid #334155',
                  borderTop: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  color: '#94a3b8',
                }}
              >
                {rowH}
              </div>

              {/* Data Cells */}
              {colHeaders.map((colH) => {
                const { bit, bitstring } = getCellValue(rowH, colH);
                const isHigh = bit === 1;

                return (
                  <div
                    key={colH}
                    title={`Input: ${bitstring} -> Output: ${bit}`}
                    style={{
                      width: 64,
                      height: 52,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isHigh ? 'rgba(16, 185, 129, 0.18)' : '#070c18',
                      border: '1px solid #1e293b',
                      borderTop: 'none',
                      borderLeft: 'none',
                      position: 'relative',
                      transition: 'all 0.15s ease',
                      cursor: 'default',
                    }}
                  >
                    {/* Cell bit value */}
                    <span
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        color: isHigh ? '#34d399' : '#475569',
                      }}
                    >
                      {bit}
                    </span>

                    {/* Miniature input address subscript */}
                    <span
                      style={{
                        fontSize: '0.55rem',
                        fontFamily: 'var(--font-mono)',
                        color: '#64748b',
                        position: 'absolute',
                        bottom: 3,
                        right: 4,
                      }}
                    >
                      m{parseInt(bitstring, 2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Synthesis & Equations Panel */}
        <div
          style={{
            flex: 1,
            minWidth: 260,
            background: '#070d1a',
            border: '1px solid #1e293b',
            borderRadius: 6,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #1e293b', paddingBottom: 6 }}>
            <Sparkles size={14} style={{ color: '#38bdf8' }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase' }}>
              Canonical Form & Boolean Minimization
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Minterm Indices (SOP):</span>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                color: '#fbbf24',
                background: '#0d1527',
                padding: '6px 10px',
                borderRadius: 4,
                border: '1px solid #1e293b',
              }}
            >
              {sopExpression}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Target Circuit Function:</span>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: '#34d399',
                background: '#0d1527',
                padding: '6px 10px',
                borderRadius: 4,
                border: '1px solid #1e293b',
              }}
            >
              {selectedOutput === 'sum'
                ? 'sum = A ⊕ B ⊕ Cin'
                : selectedOutput === 'cout'
                ? 'cout = (A & B) | (Cin & (A ⊕ B))'
                : `${selectedOutput} = f(${inputVarNames.join(', ')})`}
            </div>
          </div>

          <div style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.4, marginTop: 4 }}>
            💡 K-Maps optimize classical combinational logic into minimal two-level Sum-of-Products (AND-OR) or Product-of-Sums (OR-AND) structures, which can be synthesized directly into reversible Toffoli / Fredkin cascades.
          </div>
        </div>
      </div>
    </div>
  );
};
