/**
 * Classical Schematic Data Types & Models for Logisim-Style Classical Schematic Editor.
 * Direct bridge to backend Canonical Classical Netlist Intermediate Representation (IR).
 */

export type ClassicalGateType =
  | 'AND'
  | 'OR'
  | 'NAND'
  | 'NOR'
  | 'XOR'
  | 'XNOR'
  | 'NOT'
  | 'BUFFER';

export interface PinAnchor {
  id: string; // e.g. "G_XOR1.in[0]" or "G_XOR1.out" or "port_a.pin"
  kind: 'input' | 'output';
  x: number; // canvas absolute x
  y: number; // canvas absolute y
  ownerId: string; // gate id or port id
  pinIndex?: number;
}

export interface GateVisualBlock {
  id: string; // e.g. "G_XOR1"
  type: ClassicalGateType;
  x: number;
  y: number;
  fanIn: number; // >= 1 for NOT/BUF, >= 2 for others (2, 3, 4, ...)
  label?: string;
}

export interface PortVisualBlock {
  id: string; // e.g. "p_a"
  name: string; // "a"
  direction: 'input' | 'output';
  x: number;
  y: number;
  bitWidth: number;
  currentValue?: number; // for live interactive manual toggling
}

export interface WireSegment {
  id: string;
  fromPinId: string; // e.g. "p_a.pin" or "G1.out"
  toPinId: string;   // e.g. "G2.in[0]"
  netId: string;     // shared net identifier, e.g. "n_a"
  points?: Array<{ x: number; y: number }>; // for orthogonal routing bends
  signalLevel?: 0 | 1 | null; // evaluated live signal level
}

export interface SchematicCircuitModel {
  name: string;
  inputs: PortVisualBlock[];
  outputs: PortVisualBlock[];
  gates: GateVisualBlock[];
  wires: WireSegment[];
}

export interface CanonicalPortPin {
  id: string;
  name: string;
  bit_width: number;
  net_ids: string[];
}

export interface CanonicalClassicalGate {
  id: string;
  type: ClassicalGateType;
  fan_in: number;
  inputs: string[];
  output: string;
  label?: string;
}

export interface CanonicalClassicalNetlist {
  name: string;
  inputs: CanonicalPortPin[];
  outputs: CanonicalPortPin[];
  gates: CanonicalClassicalGate[];
  nets: string[];
}
