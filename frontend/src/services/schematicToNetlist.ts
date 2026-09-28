/**
 * Translation service from UI SchematicCircuitModel to Canonical ClassicalNetlist IR and Verilog.
 */

import {
  SchematicCircuitModel,
  CanonicalClassicalNetlist,
  CanonicalPortPin,
  CanonicalClassicalGate,
} from '../types/classical_schematic';

export function convertSchematicToCanonicalNetlist(
  model: SchematicCircuitModel
): CanonicalClassicalNetlist {
  // Mapping between pinId -> netId
  const pinToNet: Record<string, string> = {};

  // 1. Primary input nets
  const inputs: CanonicalPortPin[] = model.inputs.map((inp) => {
    const netId = `n_${inp.name}`;
    pinToNet[`${inp.id}.pin`] = netId;
    return {
      id: inp.id,
      name: inp.name,
      bit_width: inp.bitWidth || 1,
      net_ids: [netId],
    };
  });

  // 2. Gate outputs define internal nets
  for (const g of model.gates) {
    const outNetId = `n_${g.id}_out`;
    pinToNet[`${g.id}.out`] = outNetId;
  }

  // 3. Wires propagate net identities from source pins to target pins
  for (const w of model.wires) {
    const srcNet = pinToNet[w.fromPinId];
    if (srcNet) {
      pinToNet[w.toPinId] = srcNet;
    }
  }

  // 4. Construct Gate instances
  const gates: CanonicalClassicalGate[] = model.gates.map((g) => {
    const inNets: string[] = [];
    for (let i = 0; i < g.fanIn; i++) {
      const pinId = `${g.id}.in[${i}]`;
      const net = pinToNet[pinId] || `n_unconnected_${g.id}_in${i}`;
      inNets.push(net);
    }
    const outNet = pinToNet[`${g.id}.out`] || `n_${g.id}_out`;
    return {
      id: g.id,
      type: g.type,
      fan_in: g.fanIn,
      inputs: inNets,
      output: outNet,
      label: g.label,
    };
  });

  // 5. Primary outputs
  const outputs: CanonicalPortPin[] = model.outputs.map((outp) => {
    const netId = pinToNet[`${outp.id}.pin`] || `n_${outp.name}`;
    return {
      id: outp.id,
      name: outp.name,
      bit_width: outp.bitWidth || 1,
      net_ids: [netId],
    };
  });

  // 6. Deduplicate all net IDs
  const allNets = new Set<string>();
  inputs.forEach((p) => p.net_ids.forEach((n) => allNets.add(n)));
  outputs.forEach((p) => p.net_ids.forEach((n) => allNets.add(n)));
  gates.forEach((g) => {
    g.inputs.forEach((n) => allNets.add(n));
    allNets.add(g.output);
  });

  return {
    name: (model.name || 'classical_schematic').replace(/[^a-zA-Z0-9_]/g, '_'),
    inputs,
    outputs,
    gates,
    nets: Array.from(allNets),
  };
}

export function generateVerilogFromNetlist(netlist: CanonicalClassicalNetlist): string {
  const modName = netlist.name || 'classical_circuit';
  const lines: string[] = [
    '// ====================================================================',
    `// Independent Classical Golden Reference: ${modName}`,
    '// Synthesized from Logisim-Style Classical Schematic Netlist',
    '// ====================================================================',
    `module ${modName} (`,
  ];

  const portDecls: string[] = [];
  netlist.inputs.forEach((p) => {
    if (p.bit_width === 1) {
      portDecls.push(`    input  wire ${p.name}`);
    } else {
      portDecls.push(`    input  wire [${p.bit_width - 1}:0] ${p.name}`);
    }
  });

  netlist.outputs.forEach((p) => {
    if (p.bit_width === 1) {
      portDecls.push(`    output wire ${p.name}`);
    } else {
      portDecls.push(`    output wire [${p.bit_width - 1}:0] ${p.name}`);
    }
  });

  lines.push(portDecls.join(',\n'));
  lines.push(');');
  lines.push('');

  // Internal wire declarations
  const portNames = new Set([...netlist.inputs.map((p) => p.name), ...netlist.outputs.map((p) => p.name)]);
  const internalWires = netlist.nets.filter((n) => !portNames.has(n));

  if (internalWires.length > 0) {
    lines.push('    // Internal structural wires');
    internalWires.sort().forEach((w) => {
      lines.push(`    wire ${w};`);
    });
    lines.push('');
  }

  // Input bindings
  const inputMaps: string[] = [];
  netlist.inputs.forEach((p) => {
    if (p.bit_width === 1) {
      const nid = p.net_ids[0];
      if (nid !== p.name) {
        inputMaps.push(`    assign ${nid} = ${p.name};`);
      }
    }
  });
  if (inputMaps.length > 0) {
    lines.push('    // Primary Input Net Bindings');
    lines.push(...inputMaps);
    lines.push('');
  }

  // Gates logic assignments
  lines.push('    // Logic Gate Instantiations');
  netlist.gates.forEach((g) => {
    const lbl = g.label ? ` // ${g.label}` : '';
    let expr = "1'b0";
    if (g.type === 'AND') expr = g.inputs.join(' & ');
    else if (g.type === 'OR') expr = g.inputs.join(' | ');
    else if (g.type === 'NAND') expr = `~(${g.inputs.join(' & ')})`;
    else if (g.type === 'NOR') expr = `~(${g.inputs.join(' | ')})`;
    else if (g.type === 'XOR') expr = g.inputs.join(' ^ ');
    else if (g.type === 'XNOR') expr = `~(${g.inputs.join(' ^ ')})`;
    else if (g.type === 'NOT') expr = `~${g.inputs[0]}`;
    else if (g.type === 'BUFFER') expr = g.inputs[0];

    lines.push(`    assign ${g.output} = ${expr};${lbl}`);
  });

  // Output assignments
  lines.push('');
  lines.push('    // Primary Output Net Bindings');
  netlist.outputs.forEach((p) => {
    if (p.bit_width === 1) {
      const nid = p.net_ids[0];
      if (nid !== p.name) {
        lines.push(`    assign ${p.name} = ${nid};`);
      }
    }
  });

  lines.push('endmodule');
  lines.push('');
  return lines.join('\n');
}
