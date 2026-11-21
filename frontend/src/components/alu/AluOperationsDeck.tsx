import React, { useState, useEffect, useCallback } from 'react';
import {
  AluOperationsResponse,
  fetchAluOperations,
  simulateAluOperation,
  AluMetadata,
} from '../../services/api';
import { SimulationPayload } from '../../types/simulation';
import { Cpu, ShieldCheck, Zap, Activity } from 'lucide-react';

interface AluOperationsDeckProps {
  architecture?: string;
  synthesis: string;
  onSimulationLoaded: (data: SimulationPayload, meta?: AluMetadata) => void;
  onOpenNoiseStudio?: () => void;
}

export const AluOperationsDeck: React.FC<AluOperationsDeckProps> = ({
  architecture = '1-bit-alu',
  synthesis,
  onSimulationLoaded,
  onOpenNoiseStudio,
}) => {
  const [operationsData, setOperationsData] = useState<AluOperationsResponse | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [operandA, setOperandA] = useState<number>(1);
  const [operandB, setOperandB] = useState<number>(1);
  const [operandCin, setOperandCin] = useState<number>(0);
  const [selectedOpName, setSelectedOpName] = useState<string>('Full Adder');
  const [activeMetadata, setActiveMetadata] = useState<AluMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // Set default selected operation per architecture
  useEffect(() => {
    if (architecture === 'falfg-gate') {
      setSelectedOpName('Full Adder');
    } else if (architecture === 'fredkin-gate') {
      setSelectedOpName('Controlled SWAP (Ctrl=1)');
    } else if (architecture === 'bennett-adder') {
      setSelectedOpName('Full Addition (Cin=0)');
    } else {
      setSelectedOpName('Full Adder');
    }
    setSelectedCategory('all');
  }, [architecture]);

  // Fetch operations metadata whenever architecture changes
  useEffect(() => {
    fetchAluOperations(architecture)
      .then((data) => {
        setOperationsData(data);
      })
      .catch((err) => console.warn(`Could not fetch operations for ${architecture}:`, err));
  }, [architecture]);

  const handleExecuteOperation = useCallback(
    async (opName: string, a = operandA, b = operandB, cin = operandCin) => {
      setSelectedOpName(opName);
      setIsLoading(true);
      try {
        const result = await simulateAluOperation({
          architecture,
          operation: opName,
          a,
          b,
          cin,
          synthesis,
        });
        if (result.alu_metadata) {
          setActiveMetadata(result.alu_metadata);
        }
        onSimulationLoaded(result, result.alu_metadata);
      } catch (err) {
        console.error(`Failed to simulate operation ${opName}:`, err);
      } finally {
        setIsLoading(false);
      }
    },
    [architecture, operandA, operandB, operandCin, synthesis, onSimulationLoaded]
  );

  const toggleOperandA = () => {
    const nextA = operandA ? 0 : 1;
    setOperandA(nextA);
    handleExecuteOperation(selectedOpName, nextA, operandB, operandCin);
  };

  const toggleOperandB = () => {
    const nextB = operandB ? 0 : 1;
    setOperandB(nextB);
    handleExecuteOperation(selectedOpName, operandA, nextB, operandCin);
  };

  const toggleOperandCin = () => {
    const nextCin = operandCin ? 0 : 1;
    setOperandCin(nextCin);
    handleExecuteOperation(selectedOpName, operandA, operandB, nextCin);
  };

  const allOps = operationsData
    ? [...operationsData.logic_operations, ...operationsData.arithmetic_operations]
    : [];

  const filteredOps = allOps.filter((op) => {
    if (selectedCategory !== 'all' && op.category !== selectedCategory) return false;
    if (searchFilter.trim() && !op.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Dynamic branding per architecture
  const isFalfg = architecture === 'falfg-gate';
  const isFredkin = architecture === 'fredkin-gate';
  const isBennett = architecture === 'bennett-adder';

  const themeColor = isFalfg ? '#c084fc' : isFredkin ? '#22d3ee' : isBennett ? '#34d399' : '#38bdf8';
  const dockTitle = isFalfg
    ? 'IEEE TETC 2026 FALFG 5×5 FUNCTION GENERATOR DOCK'
    : isFredkin
    ? 'FREDKIN 3×3 REVERSIBLE CSWAP LOGIC DOCK'
    : isBennett
    ? 'BENNETT ZERO-GARBAGE REVERSIBLE ADDER DOCK'
    : 'IEEE TETC 2026 ALU COMMAND DOCK';

  const dockBadge = isFalfg
    ? 'TABLE V (10 OPS)'
    : isFredkin
    ? 'CONSERVATIVE (5 OPS)'
    : isBennett
    ? 'PEBBLE GAME (4 OPS)'
    : 'TABLE VI (28 OPS)';

  const categoryTabs = isFalfg
    ? [
        { id: 'all', label: 'All 10 Ops' },
        { id: 'logic', label: '4 Logic (Table V)' },
        { id: 'arithmetic', label: '6 Arithmetic (Table V)' },
      ]
    : isFredkin
    ? [
        { id: 'all', label: 'All 5 Ops' },
        { id: 'routing', label: 'Routing / MUX' },
        { id: 'logic', label: 'Reversible Logic' },
      ]
    : isBennett
    ? [
        { id: 'all', label: 'All 4 Ops' },
        { id: 'arithmetic', label: 'Arithmetic' },
        { id: 'uncomputed', label: 'Uncomputed Clean Mode' },
      ]
    : [
        { id: 'all', label: 'All 28 Ops' },
        { id: 'logic', label: '12 Logic (M=0)' },
        { id: 'arithmetic', label: '16 Arithmetic (M=1)' },
      ];

  const operandALabel = isFredkin ? 'Ctrl' : 'A';
  const operandBLabel = isFredkin ? 'In1' : 'B';
  const operandCinLabel = isFredkin ? 'In2' : isFalfg ? 'Cin / Bin' : 'Cin / Bin';

  return (
    <div
      style={{
        background: 'rgba(11, 17, 32, 0.98)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: isCollapsed ? '6px 14px' : '10px 14px',
        transition: 'all 0.2s ease',
        flexShrink: 0,
      }}
    >
      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={16} style={{ color: themeColor }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '0.5px' }}>
            {dockTitle}
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              background: `${themeColor}22`,
              color: themeColor,
              padding: '2px 6px',
              borderRadius: 4,
              fontWeight: 600,
              fontFamily: 'monospace',
            }}
          >
            {dockBadge}
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: '0.72rem',
              fontFamily: 'monospace',
            }}
          >
            <span style={{ color: themeColor, fontWeight: 700 }}>{activeMetadata.operation}:</span>
            <span style={{ color: '#f1f5f9' }}>
              {isFalfg ? 'Q (Result/Sum) = ' : isFredkin ? 'Out1 = ' : 'Result = '}
              <strong style={{ color: '#10b981' }}>{activeMetadata.measured_result}</strong>
            </span>
            {activeMetadata.expected_carry !== null && (
              <span style={{ color: '#f1f5f9' }}>
                {isFalfg ? 'P (Carry/Borrow) = ' : isFredkin ? 'Out2 = ' : 'Carry/Borrow = '}
                <strong style={{ color: themeColor }}>{activeMetadata.measured_carry}</strong>
              </span>
            )}
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                color: activeMetadata.parity_preserved ? '#10b981' : '#f43f5e',
              }}
            >
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
              {categoryTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  style={{
                    padding: '3px 8px',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    borderRadius: 4,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: selectedCategory === tab.id ? `${themeColor}33` : 'rgba(15, 23, 42, 0.6)',
                    borderColor: selectedCategory === tab.id ? themeColor : 'rgba(255, 255, 255, 0.1)',
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
                onClick={toggleOperandA}
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
                {operandALabel} = {operandA}
              </button>
              <button
                onClick={toggleOperandB}
                style={{
                  background: operandB ? `${themeColor}33` : 'rgba(15, 23, 42, 0.8)',
                  border: `1px solid ${operandB ? themeColor : '#334155'}`,
                  color: operandB ? themeColor : '#64748b',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {operandBLabel} = {operandB}
              </button>
              <button
                onClick={toggleOperandCin}
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
                {operandCinLabel} = {operandCin}
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
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              maxHeight: 82,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
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
                      ? isArith
                        ? '#065f46'
                        : `${themeColor}44`
                      : 'rgba(15, 23, 42, 0.8)',
                    borderColor: isSelected
                      ? isArith
                        ? '#10b981'
                        : themeColor
                      : 'rgba(255, 255, 255, 0.08)',
                    color: isSelected ? '#ffffff' : isArith ? '#a7f3d0' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'all 0.15s ease',
                  }}
                  title={op.description || `Execute ${op.name}`}
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
