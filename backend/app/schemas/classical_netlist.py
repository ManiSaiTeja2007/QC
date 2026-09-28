"""Canonical Classical Netlist Intermediate Representation (IR).

Provides an independent structural layer between the visual schematic editor,
the deterministic frontend Boolean evaluator, and the synthesizable Verilog generator.
Enforces combinational loop detection, structural fan-in, and pin connectivity.
"""

from enum import Enum
from typing import List, Dict, Set, Tuple, Optional, Any
from pydantic import BaseModel, Field, model_validator


class ClassicalGateType(str, Enum):
    AND = "AND"
    OR = "OR"
    NAND = "NAND"
    NOR = "NOR"
    XOR = "XOR"
    XNOR = "XNOR"
    NOT = "NOT"
    BUFFER = "BUFFER"


class ClassicalGateInstance(BaseModel):
    """A logic gate block with structural fan-in and explicit net connections."""
    id: str = Field(..., description="Unique gate identifier, e.g. 'G_XOR1'")
    type: ClassicalGateType = Field(..., description="Gate function type")
    fan_in: int = Field(2, ge=1, le=16, description="Number of input pins")
    inputs: List[str] = Field(..., description="Ordered list of input net IDs (length must match fan_in)")
    output: str = Field(..., description="Output net ID driven by this gate")
    label: Optional[str] = Field(None, description="Optional user-facing label")

    @model_validator(mode="after")
    def validate_fan_in(self) -> "ClassicalGateInstance":
        if self.type in (ClassicalGateType.NOT, ClassicalGateType.BUFFER):
            if self.fan_in != 1:
                self.fan_in = 1
            if len(self.inputs) != 1:
                raise ValueError(f"Gate {self.id} of type {self.type.value} must have exactly 1 input.")
        else:
            if self.fan_in < 2:
                raise ValueError(f"Gate {self.id} of type {self.type.value} must have fan_in >= 2, got {self.fan_in}.")
            if len(self.inputs) != self.fan_in:
                raise ValueError(
                    f"Gate {self.id} declared fan_in={self.fan_in} but received {len(self.inputs)} input nets."
                )
        return self


class PortPin(BaseModel):
    """External circuit boundary port (input pin or output probe)."""
    id: str = Field(..., description="Unique port ID, e.g. 'port_a'")
    name: str = Field(..., description="Signal name, e.g. 'a', 'sum'")
    bit_width: int = Field(1, ge=1, le=16, description="Bit width of the port")
    net_ids: List[str] = Field(..., description="Nets corresponding to bit 0, bit 1... bit N-1")

    @model_validator(mode="after")
    def validate_width(self) -> "PortPin":
        if len(self.net_ids) != self.bit_width:
            raise ValueError(f"Port '{self.name}' bit_width={self.bit_width} does not match {len(self.net_ids)} net IDs.")
        return self


class ClassicalNetlist(BaseModel):
    """Canonical structural netlist for classical digital circuits."""
    name: str = Field("classical_circuit", description="Top-level module name")
    inputs: List[PortPin] = Field(default_factory=list, description="Primary circuit inputs")
    outputs: List[PortPin] = Field(default_factory=list, description="Primary circuit outputs")
    gates: List[ClassicalGateInstance] = Field(default_factory=list, description="Logic gate instances")
    nets: List[str] = Field(default_factory=list, description="All declared net IDs")

    def get_all_input_net_ids(self) -> Set[str]:
        res = set()
        for p in self.inputs:
            res.update(p.net_ids)
        return res

    def get_all_output_net_ids(self) -> Set[str]:
        res = set()
        for p in self.outputs:
            res.update(p.net_ids)
        return res

    def validate_netlist(self) -> Tuple[bool, List[str]]:
        """Validates schematic completeness, undefined nets, and combinational loops.
        
        Returns:
            (is_valid, list_of_error_messages)
        """
        errors: List[str] = []
        input_nets = self.get_all_input_net_ids()
        output_nets = self.get_all_output_net_ids()

        if not self.inputs:
            errors.append("Schematic has no input ports defined.")
        if not self.outputs:
            errors.append("Schematic has no output ports defined.")

        # Check net drivers
        driven_nets: Dict[str, str] = {}  # net_id -> driver_id
        for net in input_nets:
            driven_nets[net] = "primary_input"

        for g in self.gates:
            if g.output in driven_nets:
                errors.append(f"Multiple drivers on net '{g.output}': driven by '{driven_nets[g.output]}' and '{g.id}'.")
            else:
                driven_nets[g.output] = g.id

        # Check for floating gate inputs
        for g in self.gates:
            for in_net in g.inputs:
                if in_net not in driven_nets:
                    errors.append(f"Gate '{g.id}' input net '{in_net}' is floating / has no driver.")

        # Check for undriven outputs
        for out_net in output_nets:
            if out_net not in driven_nets:
                errors.append(f"Primary output net '{out_net}' is not driven by any gate or input.")

        # Combinational Loop Detection (Tarjan / DFS cycle check on gate graph)
        adj: Dict[str, List[str]] = {g.id: [] for g in self.gates}
        for g in self.gates:
            for in_net in g.inputs:
                driver = driven_nets.get(in_net)
                if driver and driver != "primary_input" and driver != g.id:
                    adj[driver].append(g.id)
                elif driver == g.id:
                    errors.append(f"Combinational self-loop detected on gate '{g.id}' driving its own input '{in_net}'.")

        # DFS cycle detector
        visited: Dict[str, int] = {}  # 0: unvisited, 1: visiting, 2: visited
        path: List[str] = []

        def dfs(u: str) -> Optional[List[str]]:
            visited[u] = 1
            path.append(u)
            for v in adj.get(u, []):
                if visited.get(v, 0) == 1:
                    cycle_start = path.index(v)
                    return path[cycle_start:] + [v]
                if visited.get(v, 0) == 0:
                    found_cycle = dfs(v)
                    if found_cycle:
                        return found_cycle
            path.pop()
            visited[u] = 2
            return None

        for g in self.gates:
            if visited.get(g.id, 0) == 0:
                cycle = dfs(g.id)
                if cycle:
                    cycle_str = " → ".join(cycle)
                    errors.append(f"Combinational loop detected: {cycle_str}")
                    break

        return (len(errors) == 0, errors)

    def evaluate_state(self, input_values: Dict[str, int]) -> Dict[str, int]:
        """Deterministically evaluates the netlist for given input pin values.
        
        Args:
            input_values: dict mapping input port name (or net_id) to 0 or 1.
        Returns:
            dict mapping output port name to integer value.
        """
        net_values: Dict[str, int] = {}

        # Set input net values
        for port in self.inputs:
            val = input_values.get(port.name, 0)
            if port.bit_width == 1:
                net_values[port.net_ids[0]] = val & 1
            else:
                for b, nid in enumerate(port.net_ids):
                    net_values[nid] = (val >> b) & 1

        # Evaluate gates in topological order (iterative forward propagation)
        remaining = list(self.gates)
        max_passes = len(self.gates) * 2 + 1
        passes = 0

        while remaining and passes < max_passes:
            passes += 1
            progress = False
            next_remaining = []
            for g in remaining:
                # Check if all inputs are ready
                if all(in_net in net_values for in_net in g.inputs):
                    in_vals = [net_values[in_net] for in_net in g.inputs]
                    out_val = 0
                    if g.type == ClassicalGateType.AND:
                        out_val = 1 if all(v == 1 for v in in_vals) else 0
                    elif g.type == ClassicalGateType.OR:
                        out_val = 1 if any(v == 1 for v in in_vals) else 0
                    elif g.type == ClassicalGateType.NAND:
                        out_val = 0 if all(v == 1 for v in in_vals) else 1
                    elif g.type == ClassicalGateType.NOR:
                        out_val = 0 if any(v == 1 for v in in_vals) else 1
                    elif g.type == ClassicalGateType.XOR:
                        parity = sum(in_vals) % 2
                        out_val = parity
                    elif g.type == ClassicalGateType.XNOR:
                        parity = sum(in_vals) % 2
                        out_val = 1 - parity
                    elif g.type == ClassicalGateType.NOT:
                        out_val = 1 - in_vals[0]
                    elif g.type == ClassicalGateType.BUFFER:
                        out_val = in_vals[0]

                    net_values[g.output] = out_val
                    progress = True
                else:
                    next_remaining.append(g)
            remaining = next_remaining
            if not progress and remaining:
                # Loop or unresolvable floating inputs
                break

        # Compute output port values
        out_results: Dict[str, int] = {}
        for port in self.outputs:
            if port.bit_width == 1:
                out_results[port.name] = net_values.get(port.net_ids[0], 0)
            else:
                acc = 0
                for b, nid in enumerate(port.net_ids):
                    bit = net_values.get(nid, 0)
                    acc |= (bit << b)
                out_results[port.name] = acc

        return out_results

    def generate_verilog(self) -> str:
        """Synthesizes an independent, human-readable Verilog HDL module from the netlist."""
        mod_name = self.name or "classical_circuit"
        lines: List[str] = [
            "// ====================================================================",
            f"// Independent Classical Golden Reference: {mod_name}",
            "// Synthesized from Canonical Classical Netlist IR",
            "// ====================================================================",
            f"module {mod_name} (",
        ]

        port_decls: List[str] = []
        for p in self.inputs:
            if p.bit_width == 1:
                port_decls.append(f"    input  wire {p.name}")
            else:
                port_decls.append(f"    input  wire [{p.bit_width - 1}:0] {p.name}")

        for p in self.outputs:
            if p.bit_width == 1:
                port_decls.append(f"    output wire {p.name}")
            else:
                port_decls.append(f"    output wire [{p.bit_width - 1}:0] {p.name}")

        lines.append(",\n".join(port_decls))
        lines.append(");")
        lines.append("")

        # Internal wire declarations
        input_nets = self.get_all_input_net_ids()
        output_nets = self.get_all_output_net_ids()
        port_names = {p.name for p in self.inputs + self.outputs}
        internal_nets = set(self.nets) | input_nets | output_nets
        for g in self.gates:
            internal_nets.add(g.output)
            internal_nets.update(g.inputs)
        # Anything that isn't a declared top-level port name needs a wire declaration
        internal_wires = internal_nets - port_names

        if internal_wires:
            lines.append("    // Internal structural wires")
            for net in sorted(internal_wires):
                lines.append(f"    wire {net};")
            lines.append("")

        # Map input ports to their respective net IDs if names differ
        input_maps = []
        for p in self.inputs:
            if p.bit_width == 1:
                nid = p.net_ids[0]
                if nid != p.name:
                    input_maps.append(f"    assign {nid} = {p.name};")
            else:
                for b, nid in enumerate(p.net_ids):
                    if nid != f"{p.name}[{b}]":
                        input_maps.append(f"    assign {nid} = {p.name}[{b}];")
        if input_maps:
            lines.append("    // Input Port Net Mappings")
            lines.extend(input_maps)
            lines.append("")

        # Logic Gate assigns
        lines.append("    // Logic Gate Instantiations / Continuous Assignments")
        for g in self.gates:
            lbl = f" // {g.label}" if g.label else ""
            in_terms = g.inputs
            if g.type == ClassicalGateType.AND:
                expr = " & ".join(in_terms)
            elif g.type == ClassicalGateType.OR:
                expr = " | ".join(in_terms)
            elif g.type == ClassicalGateType.NAND:
                expr = f"~({' & '.join(in_terms)})"
            elif g.type == ClassicalGateType.NOR:
                expr = f"~({' | '.join(in_terms)})"
            elif g.type == ClassicalGateType.XOR:
                expr = " ^ ".join(in_terms)
            elif g.type == ClassicalGateType.XNOR:
                expr = f"~({' ^ '.join(in_terms)})"
            elif g.type == ClassicalGateType.NOT:
                expr = f"~{in_terms[0]}"
            elif g.type == ClassicalGateType.BUFFER:
                expr = in_terms[0]
            else:
                expr = "1'b0"

            lines.append(f"    assign {g.output} = {expr};{lbl}")

        # Connect internal nets to output ports if named differently
        lines.append("")
        for p in self.outputs:
            if p.bit_width == 1:
                nid = p.net_ids[0]
                if nid != p.name:
                    lines.append(f"    assign {p.name} = {nid};")
            else:
                concat_nets = ", ".join(reversed(p.net_ids))
                lines.append(f"    assign {p.name} = {{{concat_nets}}};")

        lines.append("endmodule")
        lines.append("")
        return "\n".join(lines)
