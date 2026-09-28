/**
 * Deterministic Client-Side Classical Logic Evaluator.
 * 
 * Evaluates combinational logic immediately in the browser on user toggle or wire edit,
 * detects loops using DFS cycle detection, and computes wire signal levels (0 / 1 / floating)
 * without waiting for or calling Icarus Verilog subprocesses.
 */

import {
  SchematicCircuitModel,
  ClassicalGateType,
  CanonicalClassicalNetlist,
} from '../types/classical_schematic';

export interface EvaluationResult {
  isValid: boolean;
  errors: string[];
  netLevels: Record<string, 0 | 1>; // net_id -> level
  outputValues: Record<string, number>; // port_name -> integer value
}

export function evaluateSchematic(
  model: SchematicCircuitModel,
  overrideInputs?: Record<string, number>
): EvaluationResult {
  const errors: string[] = [];
  const netLevels: Record<string, 0 | 1> = {};
  const outputValues: Record<string, number> = {};

  // 1. Establish driven nets from primary inputs
  for (const inp of model.inputs) {
    const val = overrideInputs && overrideInputs[inp.name] !== undefined
      ? overrideInputs[inp.name]
      : (inp.currentValue ?? 0);
    
    // Default net name for input pin
    const netId = `net_${inp.id}`;
    netLevels[netId] = (val & 1) ? 1 : 0;
  }

  // Map wire connections: pinId -> netId
  const pinToNet: Record<string, string> = {};
  for (const inp of model.inputs) {
    pinToNet[`${inp.id}.pin`] = `net_${inp.id}`;
  }
  for (const g of model.gates) {
    pinToNet[`${g.id}.out`] = `net_${g.id}_out`;
  }

  // Wires connect source pins to destination pins
  // Create an adjacency list of gate dependencies for loop detection
  const gateDrivers: Record<string, string> = {}; // gateId.in[i] -> sourcePinId
  for (const w of model.wires) {
    gateDrivers[w.toPinId] = w.fromPinId;
  }

  // Dependency graph between gates: gateA -> gateB if gateA's output drives gateB's input
  const adj: Record<string, string[]> = {};
  for (const g of model.gates) {
    adj[g.id] = [];
  }

  for (const g of model.gates) {
    for (let i = 0; i < g.fanIn; i++) {
      const inPinId = `${g.id}.in[${i}]`;
      const srcPin = gateDrivers[inPinId];
      if (srcPin) {
        // e.g. "G1.out" -> driver is "G1"
        const dotIdx = srcPin.indexOf('.');
        const driverGateId = dotIdx > 0 ? srcPin.substring(0, dotIdx) : '';
        if (model.gates.some((item) => item.id === driverGateId)) {
          if (driverGateId === g.id) {
            errors.push(`Combinational self-loop detected on gate '${g.id}' driving its own input pin.`);
          } else {
            adj[driverGateId].push(g.id);
          }
        }
      }
    }
  }

  // DFS Cycle Detection
  const visited: Record<string, number> = {}; // 0: unvisited, 1: visiting, 2: visited
  const cyclePath: string[] = [];

  function dfs(u: string): string[] | null {
    visited[u] = 1;
    cyclePath.push(u);
    for (const v of adj[u] || []) {
      if (visited[v] === 1) {
        const startIdx = cyclePath.indexOf(v);
        return cyclePath.slice(startIdx).concat(v);
      }
      if (!visited[v]) {
        const c = dfs(v);
        if (c) return c;
      }
    }
    cyclePath.pop();
    visited[u] = 2;
    return null;
  }

  for (const g of model.gates) {
    if (!visited[g.id]) {
      const cycle = dfs(g.id);
      if (cycle) {
        errors.push(`Combinational loop detected: ${cycle.join(' → ')}`);
        break;
      }
    }
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      netLevels,
      outputValues,
    };
  }

  // 2. Iterative signal propagation until steady state
  let remainingGates = [...model.gates];
  let progress = true;
  let iterations = 0;
  const maxIterations = model.gates.length + 2;

  while (remainingGates.length > 0 && progress && iterations < maxIterations) {
    progress = false;
    iterations++;
    const nextRemaining: typeof remainingGates = [];

    for (const g of remainingGates) {
      // Gather inputs
      const inputVals: Array<0 | 1> = [];
      let allInputsKnown = true;

      for (let i = 0; i < g.fanIn; i++) {
        const inPinId = `${g.id}.in[${i}]`;
        const srcPin = gateDrivers[inPinId];
        if (!srcPin) {
          allInputsKnown = false;
          break;
        }
        const srcNet = pinToNet[srcPin];
        if (srcNet && netLevels[srcNet] !== undefined) {
          inputVals.push(netLevels[srcNet]);
        } else {
          allInputsKnown = false;
          break;
        }
      }

      if (allInputsKnown && inputVals.length === g.fanIn) {
        // Evaluate gate function
        const outLevel = evaluateGateFunction(g.type, inputVals);
        const outNet = `net_${g.id}_out`;
        netLevels[outNet] = outLevel;
        progress = true;
      } else {
        nextRemaining.push(g);
      }
    }

    remainingGates = nextRemaining;
  }

  // 3. Resolve primary outputs
  for (const outPort of model.outputs) {
    const srcPin = gateDrivers[`${outPort.id}.pin`];
    if (srcPin) {
      const srcNet = pinToNet[srcPin];
      if (srcNet && netLevels[srcNet] !== undefined) {
        outputValues[outPort.name] = netLevels[srcNet];
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    netLevels,
    outputValues,
  };
}

export function evaluateGateFunction(type: ClassicalGateType, inVals: Array<0 | 1>): 0 | 1 {
  switch (type) {
    case 'AND':
      return inVals.every((v) => v === 1) ? 1 : 0;
    case 'OR':
      return inVals.some((v) => v === 1) ? 1 : 0;
    case 'NAND':
      return inVals.every((v) => v === 1) ? 0 : 1;
    case 'NOR':
      return inVals.some((v) => v === 1) ? 0 : 1;
    case 'XOR': {
      const parity = inVals.reduce((acc, v) => ((acc ^ v) as 0 | 1), 0 as 0 | 1);
      return parity;
    }
    case 'XNOR': {
      const parity = inVals.reduce((acc, v) => ((acc ^ v) as 0 | 1), 0 as 0 | 1);
      return (1 - parity) as 0 | 1;
    }
    case 'NOT':
      return inVals[0] === 1 ? 0 : 1;
    case 'BUFFER':
      return inVals[0] ?? 0;
    default:
      return 0;
  }
}
