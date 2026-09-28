import React, { useState } from 'react';
import { TruthTableRow } from '../../types/verilog';
import { CheckCircle2, XCircle, AlertTriangle, Filter, Search } from 'lucide-react';

interface TruthTableMatrixProps {
  truthTable: TruthTableRow[];
  totalStates: number;
  totalErrors: number;
}

export const TruthTableMatrix: React.FC<TruthTableMatrixProps> = ({
  truthTable,
  totalStates,
  totalErrors,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'mismatches' | 'clean_ancilla'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRows = truthTable.filter((row) => {
    if (filterMode === 'mismatches' && row.match) return false;
    if (filterMode === 'clean_ancilla' && !row.ancilla_clean) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const inMatch = row.input_bitstring.includes(q);
      const vMatch = row.verilog_output_bitstring.includes(q);
      const qMatch = row.quantum_output_bitstring.includes(q);
      const stateMatch = row.state_index.toString().includes(q);
      return inMatch || vMatch || qMatch || stateMatch;
    }
    return true;
  });

  return (
    <div className="v-analytics-card">
      {/* Control bar */}
      <div className="v-analytics-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
            Truth Table Matrix
          </span>
          <span style={{ fontSize: '0.70rem', background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', padding: '2px 8px', borderRadius: 9999, fontFamily: 'var(--font-mono)' }}>
            {filteredRows.length} / {totalStates} states
          </span>
          {totalErrors === 0 ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.70rem', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              <CheckCircle2 size={13} /> 100% Match
            </span>
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.70rem', color: '#fb7185', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
              <XCircle size={13} /> {totalErrors} Mismatch{totalErrors > 1 ? 'es' : ''}
            </span>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search bits/state..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="v-search-input"
              style={{ paddingLeft: 26, width: 150 }}
            />
          </div>

          <div className="v-filter-group">
            <button
              onClick={() => setFilterMode('all')}
              className={`v-filter-btn ${filterMode === 'all' ? 'active-all' : ''}`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('mismatches')}
              className={`v-filter-btn ${filterMode === 'mismatches' ? 'active-mismatch' : ''}`}
            >
              Mismatches Only
            </button>
            <button
              onClick={() => setFilterMode('clean_ancilla')}
              className={`v-filter-btn ${filterMode === 'clean_ancilla' ? 'active-clean' : ''}`}
            >
              Clean Ancilla
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="v-analytics-table-wrapper">
        <table className="v-analytics-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Input Vector (X)</th>
              <th style={{ color: '#fbbf24' }}>Golden Verilog (Y_ref)</th>
              <th style={{ color: '#818cf8' }}>Quantum Measured (Y_quant)</th>
              <th style={{ textAlign: 'center' }}>Match</th>
              <th style={{ textAlign: 'center' }}>Fidelity F(x)</th>
              <th style={{ textAlign: 'center' }}>Ancilla</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No states matching the active filter criteria.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.state_index}
                  className={`hover:bg-slate-800/40 transition-colors ${
                    !row.match ? 'bg-rose-950/20' : ''
                  }`}
                >
                  <td className="py-1.5 px-3 text-slate-500">{row.state_index}</td>
                  <td className="py-1.5 px-3 text-slate-200 font-bold tracking-wider">
                    |{row.input_bitstring}⟩
                  </td>
                  <td className="py-1.5 px-3 text-amber-400 tracking-wider">
                    {row.verilog_output_bitstring}
                  </td>
                  <td className="py-1.5 px-3 text-indigo-300 tracking-wider">
                    {row.quantum_output_bitstring}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    {row.match ? (
                      <span className="inline-flex items-center text-emerald-400 font-medium">
                        <CheckCircle2 size={13} className="mr-1" /> EQUAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-rose-400 font-medium">
                        <XCircle size={13} className="mr-1" /> MISMATCH
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        row.state_fidelity >= 0.999
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : row.state_fidelity > 0.5
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                      }`}
                    >
                      {row.state_fidelity.toFixed(3)}
                    </span>
                  </td>
                  <td className="py-1.5 px-3 text-center">
                    {row.ancilla_clean ? (
                      <span className="text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                        Clean
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-800 flex items-center justify-center gap-1">
                        <AlertTriangle size={10} /> Dirty
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
