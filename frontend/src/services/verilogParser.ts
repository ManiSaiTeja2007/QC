/**
 * Client-Side Verilog HDL & Logisim .circ Parser Utility.
 * 
 * Extracts module name, input ports, and output ports from Verilog code,
 * and parses port declarations from Logisim-evolution XML files.
 */

export interface ParsedPort {
  name: string;
  bitWidth: number;
  direction: 'input' | 'output';
}

export interface ParsedVerilog {
  topModuleName: string;
  inputs: ParsedPort[];
  outputs: ParsedPort[];
}

/**
 * Extracts top module name and I/O port declarations from Verilog source code.
 */
export function parseVerilogPorts(code: string): ParsedVerilog {
  let topModuleName = 'top_module';
  const inputs: ParsedPort[] = [];
  const outputs: ParsedPort[] = [];

  // Match module declaration: module <name> ... (ports);
  const moduleMatch = code.match(/module\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
  if (moduleMatch && moduleMatch[1]) {
    topModuleName = moduleMatch[1];
  }

  // Regex to match port declarations:
  // e.g., input wire [3:0] data_in, ...
  // e.g., output reg [1:0] result, ...
  // e.g., input a, b, c;
  const lines = code.split('\n');
  for (const rawLine of lines) {
    // Strip comments
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (!line) continue;

    // Check for input
    const inputMatch = line.match(/^input\s+(?:wire\s+|reg\s+)?(?:\[(\d+):(\d+)\]\s+)?([^;,\)]+)/i);
    if (inputMatch) {
      const msb = inputMatch[1] ? parseInt(inputMatch[1], 10) : 0;
      const lsb = inputMatch[2] ? parseInt(inputMatch[2], 10) : 0;
      const width = inputMatch[1] ? Math.abs(msb - lsb) + 1 : 1;
      const rawNames = inputMatch[3].split(',');
      for (const rawName of rawNames) {
        const name = rawName.trim();
        if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          if (!inputs.some((p) => p.name === name)) {
            inputs.push({ name, bitWidth: width, direction: 'input' });
          }
        }
      }
    }

    // Check for output
    const outputMatch = line.match(/^output\s+(?:wire\s+|reg\s+)?(?:\[(\d+):(\d+)\]\s+)?([^;,\)]+)/i);
    if (outputMatch) {
      const msb = outputMatch[1] ? parseInt(outputMatch[1], 10) : 0;
      const lsb = outputMatch[2] ? parseInt(outputMatch[2], 10) : 0;
      const width = outputMatch[1] ? Math.abs(msb - lsb) + 1 : 1;
      const rawNames = outputMatch[3].split(',');
      for (const rawName of rawNames) {
        const name = rawName.trim();
        if (name && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          if (!outputs.some((p) => p.name === name)) {
            outputs.push({ name, bitWidth: width, direction: 'output' });
          }
        }
      }
    }
  }

  return { topModuleName, inputs, outputs };
}

/**
 * Parses Logisim-evolution XML (.circ) file to extract pin labels and circuit name.
 */
export function parseLogisimCirc(xmlText: string): ParsedVerilog {
  let topModuleName = 'logisim_circuit';
  const inputs: ParsedPort[] = [];
  const outputs: ParsedPort[] = [];

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');
    
    // Find circuit element
    const circuit = doc.querySelector('circuit');
    if (circuit) {
      const nameAttr = circuit.getAttribute('name');
      if (nameAttr) topModuleName = nameAttr.replace(/[^a-zA-Z0-9_]/g, '_');

      // Find pins
      const compPins = circuit.querySelectorAll('comp[name="Pin"]');
      compPins.forEach((pin) => {
        let isOutput = false;
        let pinName = '';
        let width = 1;

        pin.querySelectorAll('a').forEach((attr) => {
          const name = attr.getAttribute('name');
          const val = attr.getAttribute('val');
          if (name === 'output' && val === 'true') isOutput = true;
          if (name === 'label' && val) pinName = val;
          if (name === 'width' && val) width = parseInt(val, 10) || 1;
        });

        if (pinName) {
          const cleanName = pinName.replace(/[^a-zA-Z0-9_]/g, '_');
          if (isOutput) {
            outputs.push({ name: cleanName, bitWidth: width, direction: 'output' });
          } else {
            inputs.push({ name: cleanName, bitWidth: width, direction: 'input' });
          }
        }
      });
    }
  } catch (err) {
    console.warn('Failed to parse .circ XML:', err);
  }

  return { topModuleName, inputs, outputs };
}
