/**
 * Shared I/O Contract — bidirectional bridge between the Quantum Circuit Builder
 * and the Classical Schematic / Verilog Verification Studio.
 *
 * Either workspace can write this contract. The other side receives it and
 * shows a "Sync?" banner before accepting.
 */

export interface IOPort {
  name: string;       // e.g. 'a', 'b', 'sum', 'cout'
  bitWidth: 1;
  qubitIndex: number; // which qubit lane this maps to
}

export interface IOContract {
  inputs: IOPort[];
  outputs: IOPort[];
  /** Who last wrote this contract — used to prevent circular syncs */
  source: 'builder' | 'verilog-studio';
}

/** Build a default IOContract for N inputs + M outputs */
export function makeDefaultIOContract(
  numInputs: number,
  numOutputs: number,
  source: IOContract['source'] = 'verilog-studio'
): IOContract {
  const INPUT_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const OUTPUT_NAMES = ['y', 'z', 'out0', 'out1', 'out2', 'out3'];

  const inputs: IOPort[] = Array.from({ length: numInputs }, (_, i) => ({
    name: INPUT_NAMES[i] ?? `in${i}`,
    bitWidth: 1,
    qubitIndex: i,
  }));

  const outputs: IOPort[] = Array.from({ length: numOutputs }, (_, i) => ({
    name: OUTPUT_NAMES[i] ?? `out${i}`,
    bitWidth: 1,
    qubitIndex: numInputs + i,
  }));

  return { inputs, outputs, source };
}
