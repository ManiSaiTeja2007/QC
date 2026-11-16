import React, { useState, useEffect } from 'react';
import {
  AluOperationSpec,
  AluOperationsResponse,
  fetchAluOperations,
  simulateAluOperation,
  AluMetadata,
} from '../../services/api';
import { SimulationPayload } from '../../types/simulation';
import { Cpu, CheckCircle2, ShieldCheck, Zap, Activity } from 'lucide-react';

interface AluOperationsDeckProps {
  synthesis: string;
  onSimulationLoaded: (data: SimulationPayload, meta?: AluMetadata) => void;
  onOpenNoiseStudio?: () => void;
}

export const AluOperationsDeck: React.FC<AluOperationsDeckProps> = ({
  synthesis,
  onSimulationLoaded,
  onOpenNoiseStudio,
}) => {
  const [operationsData, setOperationsData] = useState<AluOperationsResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'logic' | 'arithmetic'>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [operandA, setOperandA] = useState<number>(1);
  const [operandB, setOperandB] = useState<number>(1);
  const [operandCin, setOperandCin] = useState<number>(0);
  const [selectedOpName, setSelectedOpName] = useState<string>('Full Adder');
  const [activeMetadata, setActiveMetadata] = useState<AluMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    fetchAluOperations()
      .then((data) => {
        setOperationsData(data);
      })
      .catch((err) => console.warn('Could not fetch ALU operations:', err));
  }, []);

  const handleExecuteOperation = async (opName: string) => {
    setSelectedOpName(opName);
    setIsLoading(true);
    try {
      const result = await simulateAluOperation({
        operation: opName,
        a: operandA,
        b: operandB,
        cin: operandCin,
        synthesis,
      });
      if (result.alu_metadata) {
        setActiveMetadata(result.alu_metadata);
      }
      onSimulationLoaded(result, result.alu_metadata);
    } catch (err) {
      console.error('Failed to simulate ALU operation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const allOps = operationsData
    ? [...operationsData.logic_operations, ...operationsData.arithmetic_operations]
    : [];

  const filteredOps = allOps.filter((op) => {
    if (selectedCategory === 'logic' && op.category !== 'logic') return false;
    if (selectedCategory === 'arithmetic' && op.category !== 'arithmetic') return false;
    if (searchFilter.trim() && !op.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div style={{
      background: 'rgba(11, 17, 32, 0.98)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: isCollapsed ? '6px 14px' : '10px 14px',
      transition: 'all 0.2s ease',
      flexShrink: 0,
    }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={16} style={{ color: '#38bdf8' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.5px' }}>
            IEEE TETC 2026 ALU COMMAND DOCK
          </span>
          <span style={{
            fontSize: '0.65rem',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '2px 6px',
            borderRadius: 4,
            fontWeight: 600,
            fontFamily: 'monospace',
          }}>
            TABLE VI (28 OPS)
          </span>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.7rem',
              cursor: 'pointer',
              marginLeft: 6,
              textDecoration: 'underline',
            }}
          >
            {isCollapsed ? 'Expand Dock ▼' : 'Collapse ▲'}
          </button>
        </div>

        {/* Live Execution Result Pill */}
        {activeMetadata && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 6,
            padding: '4px 10px',
            fontSize: '0.72rem',
            fontFamily: 'monospace',
          }}>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{activeMetadata.operation}:</span>
            <span style={{ color: '#f1f5f9' }}>
              Result = <strong style={{ color: '#10b981' }}>{activeMetadata.measured_result}</strong>
            </span>
            {activeMetadata.expected_carry !== null && (
              <span style={{ color: '#f1f5f9' }}>
                Carry/Borrow = <strong style={{ color: '#38bdf8' }}>{activeMetadata.measured_carry}</strong>
              </span>
            )}
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              color: activeMetadata.parity_preserved ? '#10b981' : '#f43f5e',
            }}>
              <ShieldCheck size={13} />
              {activeMetadata.parity_preserved ? 'Parity Valid' : 'Parity Violated'}
            </span>
          </div>
        )}

        {/* Noise Studio launcher button */}
        {onOpenNoiseStudio && (
          <button
            onClick={onOpenNoiseStudio}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(234, 179, 8, 0.12)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              color: '#fbbf24',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Activity size={13} />
            Physical Noise Studio
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Controls & Operands Ribbon */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            {/* Category Filter Chips */}
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { id: 'all', label: `All 28 Ops` },
                { id: 'logic', label: `12 Logic (M=0)` },
                { id: 'arithmetic', label: `16 Arithmetic (M=1)` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id as any)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: selectedCategory === tab.id ? '#0284c7' : 'rgba(15, 23, 42, 0.6)',
                    borderColor: selectedCategory === tab.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.1)',
                    color: selectedCategory === tab.id ? '#ffffff' : '#94a3b8',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Operand Bit Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.72rem', fontFamily: 'monospace' }}>
              <span style={{ color: '#94a3b8' }}>Operands:</span>
              <button
                onClick={() => setOperandA(operandA ? 0 : 1)}
                style={{
                  background: operandA ? 'rgba(16, 185, 129, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                  border: `1px solid ${operandA ? '#10b981' : '#334155'}`,
                  color: operandA ? '#34d399' : '#64748b',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                A = {operandA}
              </button>
              <button
                onClick={() => setOperandB(operandB ? 0 : 1)}
                style={{
                  background: operandB ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                  border: `1px solid ${operandB ? '#38bdf8' : '#334155'}`,
                  color: operandB ? '#38bdf8' : '#64748b',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                B = {operandB}
              </button>
              <button
                onClick={() => setOperandCin(operandCin ? 0 : 1)}
                style={{
                  background: operandCin ? 'rgba(234, 179, 8, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                  border: `1px solid ${operandCin ? '#f59e0b' : '#334155'}`,
                  color: operandCin ? '#fbbf24' : '#64748b',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cin / Bin = {operandCin}
              </button>

              {/* Quick Search Input */}
              <input
                type="text"
                placeholder="Filter op (e.g. Full, XOR)..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 4,
                  padding: '3px 8px',
                  fontSize: '0.68rem',
                  color: '#f1f5f9',
                  width: 140,
                }}
              />
            </div>
          </div>

          {/* Quick Action Operation Chips Grid */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            maxHeight: 82,
            overflowY: 'auto',
            paddingRight: 4,
          }}>
            {filteredOps.map((op) => {
              const isSelected = selectedOpName === op.name;
              const isArith = op.category === 'arithmetic';
              return (
                <button
                  key={op.name}
                  onClick={() => handleExecuteOperation(op.name)}
                  disabled={isLoading}
                  style={{
                    padding: '3px 7px',
                    fontSize: '0.66rem',
                    fontWeight: isSelected ? 700 : 500,
                    borderRadius: 4,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: isSelected
                      ? isArith ? '#065f46' : '#0369a1'
                      : 'rgba(15, 23, 42, 0.8)',
                    borderColor: isSelected
                      ? isArith ? '#10b981' : '#38bdf8'
                      : 'rgba(255, 255, 255, 0.08)',
                    color: isSelected ? '#ffffff' : isArith ? '#a7f3d0' : '#bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                  title={`Execute ${op.name} (M=${op.m}, S0=${op.s0}, S1=${op.s1}, S2=${op.s2}, S3=${op.s3})`}
                >
                  {isSelected && <Zap size={10} style={{ color: '#fbbf24' }} />}
                  {op.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
