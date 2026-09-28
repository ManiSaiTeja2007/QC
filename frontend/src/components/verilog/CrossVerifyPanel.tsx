import React, { useState, useMemo } from 'react';
import { verifyCircuitAgainstVerilog } from '../../services/api';
import { SimulationPayload } from '../../types/simulation';
import { VerificationResult, TruthTableRow } from '../../types/verilog';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FileText,
  Calculator,
  ChevronDown,
  ChevronUp,
  Cpu,
  Sliders,
} from 'lucide-react';

interface CrossVerifyPanelProps {
  simulationData: SimulationPayload | null;
  architecture: string;
  inputBits?: number[];
  qubitNames?: string[];
  onOpenInVerilogStudio?: () => void;
}

interface QubitPinoutInfo {
  index: number;
  label: string;
  role: string;
  type: 'data' | 'control' | 'ancilla' | 'output';
}

interface CircuitArchInfo {
  name: string;
  badge: string;
  description: string;
  pinouts: QubitPinoutInfo[];
}

const ARCHITECTURE_PROFILES: Record<string, CircuitArchInfo> = {
  '1-bit-alu': {
    name: '1-Bit Fault-Tolerant Reversible QALU (Fig. 6 & 8)',
    badge: '7-Qubit Parity-Preserving Clifford+T ALU',
    description:
      'Integrated reversible ALU pairing a 5×5 FALFG function generator with a 4:1 Fredkin multiplexer control tree. ' +
      'Computes 28 arithmetic & logic operations via control lines (S0,S1,S2,S3,M). ' +
      'Quantum cost: 26, T-count: 22, T-depth: 11.',
    pinouts: [
      { index: 0, label: 'Q0: A → Result', role: 'Operand A input → Selected ALU Result Output', type: 'output' },
      { index: 1, label: 'Q1: B → Cout', role: 'Operand B input → Carry Out / Borrow Out (Cout)', type: 'output' },
      { index: 2, label: 'Q2: S0 (Cin)', role: 'Carry In (Cin) / Function Select Line S0', type: 'control' },
      { index: 3, label: 'Q3: S1', role: 'Function Select Line S1 (FALFG D input)', type: 'control' },
      { index: 4, label: 'Q4: M (Mode)', role: 'Mode Line M (M=0: Logic, M=1: Arithmetic)', type: 'control' },
      { index: 5, label: 'Q5: S2', role: 'Multiplexer Select Line S2 (S2=1 for Full Adder)', type: 'control' },
      { index: 6, label: 'Q6: S3', role: 'Multiplexer Select Line S3 (Passed through unaltered)', type: 'control' },
    ],
  },
  'falfg-gate': {
    name: '5×5 FALFG Reversible Gate (Fig. 3)',
    badge: 'Fault-Tolerant Arithmetic Logic Function Generator',
    description:
      'Parity-preserving reversible 5×5 FALFG gate. Inputs A,B,C,D,E → Outputs P,Q,R,S,T. ' +
      'Supports Full Adder (D=0,E=0), Subtractor and 24 arithmetic/logic operations. ' +
      'Zero ancilla garbage. Quantum cost: 11, T-count: 7, T-depth: 3.',
    pinouts: [
      {
        index: 0,
        label: 'A → P',
        role: 'Carry Out / Parity:  P = (A⊕B⊕C⊕D)·(A⊕B⊕D) ⊕ (A⊕B⊕D)',
        type: 'output',
      },
      {
        index: 1,
        label: 'B → Q',
        role: 'Sum Output:  Q = A⊕B⊕C',
        type: 'output',
      },
      {
        index: 2,
        label: 'C → R',
        role: 'Carry In / Parity R:  R = (A⊕B⊕C⊕D)·C ⊕ (A⊕B⊕D)·(A⊕C)',
        type: 'data',
      },
      {
        index: 3,
        label: 'D → S',
        role: 'Select Line / Parity S:  S = A⊕B⊕D   (D=0 → Full Adder, D=1 → Subtractor)',
        type: 'control',
      },
      {
        index: 4,
        label: 'E → T',
        role: 'Mode Line / Parity T:  T = B⊕C⊕D⊕E   (E=0 → Arithmetic, E=1 → Logic)',
        type: 'control',
      },
    ],
  },
  'bennett-adder': {
    name: 'Bennett Garbage-Free Full Adder (Fig. 9)',
    badge: '9-Qubit Uncomputed Parity-Preserving Adder',
    description:
      'Garbage-free Full Adder using Bennett uncomputation and dual Feynman parity registers. ' +
      'Restores all 4 ancillae to clean |0⟩ states to eliminate decoherence in cascaded circuits. ' +
      'Quantum cost: 14, T-count: 14, T-depth: 6.',
    pinouts: [
      { index: 0, label: 'Q0: A', role: 'Input Operand A (Preserved on output)', type: 'data' },
      { index: 1, label: 'Q1: B', role: 'Input Operand B (Preserved on output)', type: 'data' },
      { index: 2, label: 'Q2: Cin', role: 'Input Carry In (Cin) (Preserved on output)', type: 'data' },
      { index: 3, label: 'Q3: Sel', role: 'Select Line D (D=0 → Full Adder, D=1 → Subtractor)', type: 'control' },
      { index: 4, label: 'Q4: Mode', role: 'Mode Line E (E=0 → Arithmetic Mode)', type: 'control' },
      { index: 5, label: 'Q5: Cout', role: 'Carry Out Output:  Cout = (A·B) + (B·Cin) + (A·Cin)', type: 'output' },
      { index: 6, label: 'Q6: Sum', role: 'Sum Output:  Sum = A ⊕ B ⊕ Cin', type: 'output' },
      { index: 7, label: 'Q7: Cout\'', role: 'Feynman Parity Copy of Carry Out (Restored to |0⟩)', type: 'ancilla' },
      { index: 8, label: 'Q8: Sum\'', role: 'Feynman Parity Copy of Sum (Restored to |0⟩)', type: 'ancilla' },
    ],
  },
  'fredkin-gate': {
    name: '3×3 Fredkin (CSWAP) Reversible Gate (Fig. 2)',
    badge: '3-Qubit Conservative Reversible Gate',
    description:
      'Conservative 3-qubit reversible gate decomposed into Clifford+T basis. ' +
      'Performs controlled-SWAP: if Control A=1, swaps targets B and C. Preserves total Hamming weight. ' +
      'Quantum cost: 5, T-count: 7, T-depth: 3.',
    pinouts: [
      { index: 0, label: 'A → A\'', role: 'Control Signal A (Passes through unmodified: A\' = A)', type: 'control' },
      { index: 1, label: 'B → B\'', role: 'Target B → B\' = (~A·B) + (A·C)   (Swapped with C if A=1)', type: 'data' },
      { index: 2, label: 'C → C\'', role: 'Target C → C\' = (~A·C) + (A·B)   (Swapped with B if A=1)', type: 'data' },
    ],
  },
};

export const CrossVerifyPanel: React.FC<CrossVerifyPanelProps> = ({
  simulationData,
  architecture,
  inputBits = [1, 1, 1, 0, 1, 1, 0],
  onOpenInVerilogStudio,
}) => {
  const [researchNote, setResearchNote] = useState<string>('');
  const [selectedRef, setSelectedRef] = useState<string>('full_adder');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPinout, setShowPinout] = useState<boolean>(true);
  const [showFullTable, setShowFullTable] = useState<boolean>(true);

  // Normalize arch key
  const normArchKey = useMemo(() => {
    const a = architecture.toLowerCase();
    if (a.includes('falfg')) return 'falfg-gate';
    if (a.includes('bennett')) return 'bennett-adder';
    if (a.includes('fredkin')) return 'fredkin-gate';
    return '1-bit-alu';
  }, [architecture]);

  const activeArch = ARCHITECTURE_PROFILES[normArchKey] || ARCHITECTURE_PROFILES['1-bit-alu'];

  // Current operand values — labelled per arch
  const a = inputBits[0] ?? 0;
  const b = inputBits[1] ?? 0;
  const cin = inputBits[2] ?? 0;
  const c = cin; // Alias C to Cin for exact paper equation alignment
  const d = inputBits[3] ?? 0;
  const e = inputBits[4] ?? 0;
  const s2 = inputBits[5] ?? 0;
  const s3 = inputBits[6] ?? 0;

  // Live evaluated equations — arch-aware
  const liveEval = useMemo(() => {
    // ── 1-Bit ALU ────────────────────────────────────────────────────────────
    if (normArchKey === '1-bit-alu') {
      const modeBit = e; // M = Q4
      const isArithmetic = modeBit === 1;
      const sum = a ^ b ^ cin;
      const cout = (a & b) | (b & cin) | (a & cin);
      const logicOut = selectedRef === 'and_gate' ? (a & b) : selectedRef === 'or_gate' ? (a | b) : (a ^ b);
      const resultVal = isArithmetic ? sum : logicOut;

      return {
        equations: [
          `Mode M = ${modeBit} (${isArithmetic ? 'Arithmetic' : 'Logic'})`,
          isArithmetic
            ? 'Result = A ⊕ B ⊕ Cin  (Full Adder Sum)'
            : `Result = A ${selectedRef === 'and_gate' ? '·' : selectedRef === 'or_gate' ? '+' : '⊕'} B  (Logic)`,
          'Carry Out = (A·B) + (B·Cin) + (A·Cin)',
        ],
        evaluated: [
          `Result = ${resultVal}   (Mode M=${modeBit}, S2=${s2})`,
          `Carry Out = (${a}·${b}) + (${b}·${cin}) + (${a}·${cin}) = ${cout}`,
        ],
        inputLabel: `A=${a}, B=${b}, Cin=${cin}, M=${modeBit}, S2=${s2}`,
      };
    }

    // ── FALFG 5x5 Gate ───────────────────────────────────────────────────────
    if (normArchKey === 'falfg-gate') {
      const P = ((a ^ b ^ c ^ d) & (a ^ b ^ d)) ^ (a ^ b ^ d);
      const Q = a ^ b ^ c;                                // Q = A⊕B⊕C (Full Adder Sum)
      const R = ((a ^ b ^ c ^ d) & c) ^ ((a ^ b ^ d) & (a ^ c));
      const S = a ^ b ^ d;
      const T = b ^ c ^ d ^ e;                            // T = B⊕C⊕D⊕E (Paper Fig. 3)
      return {
        equations: [
          'P = (A⊕B⊕C⊕D)·(A⊕B⊕D) ⊕ (A⊕B⊕D)   [Carry Out]',
          'Q = A⊕B⊕C                              [Sum]',
          'R = (A⊕B⊕C⊕D)·C ⊕ (A⊕B⊕D)·(A⊕C)   [Parity R]',
          'S = A⊕B⊕D                              [Parity S]',
          'T = B⊕C⊕D⊕E                            [Parity T]',
        ],
        evaluated: [
          `P = (${a}⊕${b}⊕${c}⊕${d})·(${a}⊕${b}⊕${d}) ⊕ (${a}⊕${b}⊕${d}) = ${P}`,
          `Q = ${a}⊕${b}⊕${c} = ${Q}`,
          `R = (${a}⊕${b}⊕${c}⊕${d})·${c} ⊕ (${a}⊕${b}⊕${d})·(${a}⊕${c}) = ${R}`,
          `S = ${a}⊕${b}⊕${d} = ${S}`,
          `T = ${b}⊕${c}⊕${d}⊕${e} = ${T}`,
        ],
        inputLabel: `A=${a}, B=${b}, C=${cin}, D=${d}, E=${e}`,
      };
    }

    // ── Bennett Uncomputed Adder ──────────────────────────────────────────────
    if (normArchKey === 'bennett-adder') {
      const sum = a ^ b ^ cin;
      const cout = (a & b) | (b & cin) | (a & cin);
      return {
        equations: [
          'Sum = A ⊕ B ⊕ Cin',
          'Carry Out = (A·B) + (B·Cin) + (A·Cin)',
          'Ancillae (Q7, Q8) = Restored to clean |0⟩ via Feynman Uncomputation',
        ],
        evaluated: [
          `Sum (Q6) = ${a} ⊕ ${b} ⊕ ${cin} = ${sum}`,
          `Carry Out (Q5) = (${a}·${b}) + (${b}·${cin}) + (${a}·${cin}) = ${cout}`,
          'Ancilla Copies (Q7, Q8) = 0  [Garbage-Free Clean State]',
        ],
        inputLabel: `A=${a}, B=${b}, Cin=${cin}`,
      };
    }

    // ── Fredkin (CSWAP) Gate ──────────────────────────────────────────────────
    if (normArchKey === 'fredkin-gate') {
      const bOut = a === 1 ? cin : b; // Swapped with C if A=1
      const cOut = a === 1 ? b : cin; // Swapped with B if A=1
      return {
        equations: [
          "A' = A                      [Control Line Unchanged]",
          "B' = (~A · B) + (A · C)    [Swapped with C if A=1]",
          "C' = (~A · C) + (A · B)    [Swapped with B if A=1]",
        ],
        evaluated: [
          `A' = ${a}   (Control)`,
          `B' = (${a === 0 ? 1 : 0}·${b}) + (${a}·${cin}) = ${bOut}   ${a === 1 ? '[SWAPPED ← C]' : '[UNCHANGED]'}`,
          `C' = (${a === 0 ? 1 : 0}·${cin}) + (${a}·${b}) = ${cOut}   ${a === 1 ? '[SWAPPED ← B]' : '[UNCHANGED]'}`,
        ],
        inputLabel: `Control A=${a}, Target B=${b}, Target C=${cin}`,
      };
    }

    // ── Fallback Classical reference equations ───────────────────────────────
    if (selectedRef === 'half_adder') {
      const sum = a ^ b;
      const cout = a & b;
      return {
        equations: [
          'Sum = A ⊕ B',
          'Carry Out = A · B',
        ],
        evaluated: [
          `Sum = ${a} ⊕ ${b} = ${sum}`,
          `Carry Out = ${a} · ${b} = ${cout}`,
        ],
        inputLabel: `A=${a}, B=${b}`,
      };
    }
    const sum = a ^ b ^ cin;
    const cout = (a & b) | (b & cin) | (a & cin);
    return {
      equations: [
        'Sum = A ⊕ B ⊕ Cin',
        'Carry Out = (A · B) + (B · Cin) + (A · Cin)',
      ],
      evaluated: [
        `Sum = ${a} ⊕ ${b} ⊕ ${cin} = ${sum}`,
        `Carry Out = (${a}·${b}) + (${b}·${cin}) + (${a}·${cin}) = ${cout}`,
      ],
      inputLabel: `A=${a}, B=${b}, Cin=${cin}`,
    };
  }, [normArchKey, selectedRef, a, b, cin, d, e, s2, s3]);

  // Execute verification tailored to the specific active circuit
  const handleRunVerify = async () => {
    if (!simulationData) return;
    setIsVerifying(true);
    setErrorMsg(null);
    try {
      const archMap: Record<string, string> = {
        '1-bit-alu': '1_bit_alu_clifford_t',
        'bennett-adder': 'bennett_adder',
        'falfg-gate': 'falfg_5x5',
        'fredkin-gate': 'fredkin_cswap',
      };
      const resolvedCircuitId = archMap[normArchKey] || '1_bit_alu_clifford_t';

      let input_ports = [
        { name: 'a', direction: 'input' as const, bit_width: 1, qubit_indices: [0] },
        { name: 'b', direction: 'input' as const, bit_width: 1, qubit_indices: [1] },
        { name: 'cin', direction: 'input' as const, bit_width: 1, qubit_indices: [2] },
      ];
      let output_ports = [
        { name: 'sum', direction: 'output' as const, bit_width: 1, qubit_indices: [0] },
        { name: 'cout', direction: 'output' as const, bit_width: 1, qubit_indices: [1] },
      ];
      const ancillas: Array<{ qubit_index: number; expected_clean_state: number; name: string }> = [];

      if (resolvedCircuitId === 'falfg_5x5') {
        // FALFG 5x5: Q0 is Carry/P, Q1 is Sum/Q!
        output_ports = [
          { name: 'sum', direction: 'output' as const, bit_width: 1, qubit_indices: [1] },
          { name: 'cout', direction: 'output' as const, bit_width: 1, qubit_indices: [0] },
        ];
        ancillas.push({ qubit_index: 3, expected_clean_state: 0, name: 'Sel_D' });
        ancillas.push({ qubit_index: 4, expected_clean_state: 0, name: 'Mode_E' });
      } else if (resolvedCircuitId === '1_bit_alu_clifford_t') {
        // 1-Bit ALU: Q0 is Result, Q1 is Cout. Requires M=1 (Q4) and S2=1 (Q5) for Full Adder
        output_ports = [
          { name: 'sum', direction: 'output' as const, bit_width: 1, qubit_indices: [0] },
          { name: 'cout', direction: 'output' as const, bit_width: 1, qubit_indices: [1] },
        ];
        if (selectedRef === 'half_adder') {
          input_ports = [
            { name: 'a', direction: 'input' as const, bit_width: 1, qubit_indices: [0] },
            { name: 'b', direction: 'input' as const, bit_width: 1, qubit_indices: [1] },
          ];
          ancillas.push({ qubit_index: 2, expected_clean_state: 0, name: 'Cin' });
          ancillas.push({ qubit_index: 4, expected_clean_state: 1, name: 'M_Mode' });
          ancillas.push({ qubit_index: 5, expected_clean_state: 1, name: 'S2_Select' });
        } else {
          ancillas.push({ qubit_index: 4, expected_clean_state: 1, name: 'M_Mode' });
          ancillas.push({ qubit_index: 5, expected_clean_state: 1, name: 'S2_Select' });
        }
      } else if (resolvedCircuitId === 'bennett_adder') {
        // Bennett Adder: Q5 is Cout, Q6 is Sum
        output_ports = [
          { name: 'sum', direction: 'output' as const, bit_width: 1, qubit_indices: [6] },
          { name: 'cout', direction: 'output' as const, bit_width: 1, qubit_indices: [5] },
        ];
        ancillas.push({ qubit_index: 3, expected_clean_state: 0, name: 'Sel' });
        ancillas.push({ qubit_index: 4, expected_clean_state: 0, name: 'Mode' });
      }

      const res = await verifyCircuitAgainstVerilog({
        circuit_id: resolvedCircuitId,
        contract: {
          reference_source_type: 'template_reference',
          top_module_name: selectedRef,
          reference_name: `Expected: ${selectedRef}`,
          verilog_code: '',
          input_ports,
          output_ports,
          ancillas,
          mode: 'statevector_ideal',
          num_shots: 1024,
        },
      });
      setResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!simulationData) {
    return (
      <div style={{ padding: '14px', fontSize: '0.74rem', color: '#94a3b8', textAlign: 'center' }}>
        <p style={{ margin: 0 }}>⚡ Run a simulation first to enable classical cross-verification.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.75rem', color: '#e2e8f0' }}>
      {/* Active Circuit Header & Architecture Context */}
      <div style={{ background: '#040814', padding: '8px 10px', borderRadius: 6, border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Cpu size={14} />
            <span>{activeArch.name}</span>
          </span>
          <span style={{ fontSize: '0.66rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            Active Live Circuit
          </span>
        </div>
        <p style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '3px 0 0 0', lineHeight: 1.35 }}>
          {activeArch.description}
        </p>
      </div>

      {/* Qubit Signal Roles & Pinout Breakdown */}
      <div style={{ background: '#050b18', border: '1px solid #1e293b', borderRadius: 6, overflow: 'hidden' }}>
        <button
          onClick={() => setShowPinout(!showPinout)}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#cbd5e1',
            fontSize: '0.70rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sliders size={12} style={{ color: '#38bdf8' }} />
            <span>Qubit Signals &amp; Physical Pinout ({activeArch.pinouts.length} Qubits)</span>
          </span>
          {showPinout ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {showPinout && (
          <div style={{ padding: '0 8px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {activeArch.pinouts.map((pin) => {
              const currentVal = inputBits[pin.index] ?? 0;
              const typeColor =
                pin.type === 'control'
                  ? '#f59e0b'
                  : pin.type === 'output'
                  ? '#38bdf8'
                  : pin.type === 'ancilla'
                  ? '#a855f7'
                  : '#34d399';
              return (
                <div
                  key={pin.index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#091024',
                    padding: '3px 6px',
                    borderRadius: 4,
                    border: '1px solid #1e293b',
                    fontSize: '0.67rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: typeColor }}>
                      {pin.label}
                    </span>
                    <span style={{ color: '#94a3b8' }}>{pin.role}</span>
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      background: currentVal ? 'rgba(56, 189, 248, 0.2)' : '#0f172a',
                      color: currentVal ? '#38bdf8' : '#64748b',
                      border: '1px solid #1e293b',
                      borderRadius: 3,
                      padding: '1px 5px',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                    }}
                  >
                    Val: {currentVal}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Target Function Selector */}
      <div>
        <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 600, color: '#94a3b8', marginBottom: 4 }}>
          Target Classical Function:
        </label>
        <select
          value={selectedRef}
          onChange={(e) => {
            setSelectedRef(e.target.value);
            setResult(null);
          }}
          style={{
            width: '100%',
            background: '#040814',
            border: '1px solid #1e293b',
            borderRadius: 4,
            padding: '5px 8px',
            color: '#38bdf8',
            fontSize: '0.74rem',
            outline: 'none',
            fontWeight: 600,
          }}
        >
          <option value="full_adder">Full Adder (3→2): Sum &amp; Cout</option>
          <option value="half_adder">Half Adder (2→2): Sum &amp; Cout</option>
          <option value="xor_gate">Logic XOR (2→1)</option>
          <option value="and_gate">Logic AND (2→1)</option>
          <option value="or_gate">Logic OR (2→1)</option>
        </select>
      </div>

      {/* Live Classical Mathematical & Boolean Equations */}
      <div style={{
        background: '#081329',
        border: '1px solid #1d4ed8',
        borderRadius: 6,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#60a5fa', fontWeight: 700, fontSize: '0.72rem' }}>
          <Calculator size={13} />
          <span>Classical Specification Equations</span>
        </div>

        {/* Symbolic Formulas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 4, borderLeft: '2px solid #2563eb', margin: '2px 0' }}>
          {liveEval.equations.map((eq, i) => (
            <code key={i} style={{ color: '#93c5fd', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
              {eq}
            </code>
          ))}
        </div>

        {/* Evaluated on Current Inputs */}
        <div style={{ background: '#040814', borderRadius: 4, padding: '4px 6px', marginTop: 2 }}>
          <span style={{ fontSize: '0.64rem', color: '#64748b', display: 'block', textTransform: 'uppercase' }}>
            Current Input Evaluation (A={a}, B={b}, Cin={cin}):
          </span>
          {liveEval.evaluated.map((eq, i) => (
            <div key={i} style={{ color: '#34d399', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {eq}
            </div>
          ))}
        </div>
      </div>

      {/* Research Paper Notes */}
      <div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: '#94a3b8', marginBottom: 3 }}>
          <FileText size={11} />
          <span>Paper / Research Annotation:</span>
        </label>
        <textarea
          rows={2}
          value={researchNote}
          onChange={(e) => setResearchNote(e.target.value)}
          placeholder="e.g. Bennett 1973 / FALFG Full Adder cross-verification..."
          style={{
            width: '100%',
            background: '#040814',
            border: '1px solid #1e293b',
            borderRadius: 4,
            padding: '4px 6px',
            color: '#f1f5f9',
            fontSize: '0.70rem',
            fontFamily: 'var(--font-sans)',
            resize: 'none',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      </div>

      {/* Primary Verification Action */}
      <button
        onClick={handleRunVerify}
        disabled={isVerifying}
        style={{
          background: isVerifying ? '#1e293b' : 'linear-gradient(90deg, #059669, #10b981)',
          color: isVerifying ? '#94a3b8' : '#022c22',
          fontWeight: 700,
          border: 'none',
          borderRadius: 6,
          padding: '7px 12px',
          fontSize: '0.76rem',
          cursor: isVerifying ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)',
        }}
      >
        <ShieldCheck size={15} />
        <span>{isVerifying ? 'Simulating All 2^k States...' : 'Cross-Verify Across All Inputs'}</span>
      </button>

      {/* Error Display */}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', padding: '6px', borderRadius: 4, color: '#fca5a5', fontSize: '0.68rem' }}>
          <AlertTriangle size={11} style={{ display: 'inline', marginRight: 4 }} />
          {errorMsg}
        </div>
      )}

      {/* Full All-Input Differential Verification Matrix */}
      {result && (
        <div style={{ background: '#040814', border: '1px solid #1e293b', padding: '8px 10px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: result.error_rate === 0 ? '#34d399' : '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {result.error_rate === 0 ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
              {result.error_rate === 0 ? `100% MATCH (${result.total_states_tested}/${result.total_states_tested} States)` : `${result.total_errors} MISMATCHES`}
            </span>
            <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              Avg Fidelity: {(result.state_fidelity_avg * 100).toFixed(1)}%
            </span>
          </div>

          {/* Table Toggle */}
          <button
            onClick={() => setShowFullTable(!showFullTable)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#38bdf8',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.68rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <span>All {result.total_states_tested} Input Combinations Data Table</span>
            {showFullTable ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Compact Truth Table Matrix */}
          {showFullTable && (
            <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #1e293b', borderRadius: 4 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.68rem', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                <thead>
                  <tr style={{ background: '#0b1325', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>
                    <th style={{ padding: '3px 4px' }}>Input</th>
                    <th style={{ padding: '3px 4px' }}>Classical (Verilog)</th>
                    <th style={{ padding: '3px 4px' }}>Quantum (Aer)</th>
                    <th style={{ padding: '3px 4px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.truth_table.map((row: TruthTableRow) => (
                    <tr
                      key={row.state_index}
                      style={{
                        borderBottom: '1px solid #0f172a',
                        background: row.match ? 'transparent' : 'rgba(239, 68, 68, 0.1)',
                      }}
                    >
                      <td style={{ padding: '2px 4px', color: '#cbd5e1' }}>{row.input_bitstring}</td>
                      <td style={{ padding: '2px 4px', color: '#60a5fa' }}>{row.verilog_output_bitstring}</td>
                      <td style={{ padding: '2px 4px', color: '#34d399' }}>{row.quantum_output_bitstring}</td>
                      <td style={{ padding: '2px 4px', color: row.match ? '#34d399' : '#f87171', fontWeight: 700 }}>
                        {row.match ? 'PASS' : 'FAIL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {onOpenInVerilogStudio && (
            <button
              onClick={onOpenInVerilogStudio}
              style={{
                background: 'transparent',
                border: '1px solid #38bdf8',
                color: '#38bdf8',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: '0.68rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                marginTop: 2,
              }}
            >
              <span>Open Full Analytics Studio (K-Map &amp; Heatmap)</span>
              <ExternalLink size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
