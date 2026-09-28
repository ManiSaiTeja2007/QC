"""Verilog Hardware Description Generators and Curated Golden Reference Templates.

Provides independent, verified classical Verilog templates (AND, Half Adder, Full Adder,
FALFG gate, 1-bit ALU) and a separate inspection/export utility for converting quantum circuits.
"""

from typing import Dict, List, Any, Optional
from backend.app.schemas.verification_contract import (
    PortMapping,
    PortDirection,
    Endianness,
)


VERILOG_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "and_gate": {
        "id": "and_gate",
        "name": "AND Gate (Toffoli Target)",
        "description": "2-input classical AND gate verifying a Toffoli (CCX) gate with target qubit initialized to |0>.",
        "top_module": "and_gate",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: 2-Input AND Gate
// Used for verifying Quantum Toffoli (CCNOT) equivalence
// ==========================================================
module and_gate (
    input  wire a,
    input  wire b,
    output wire y
);
    assign y = a & b;
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
        ],
        "output_ports": [
            PortMapping(name="y", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[2]),
        ],
    },
    "half_adder": {
        "id": "half_adder",
        "name": "Half Adder",
        "description": "Classical Half Adder: sum = a ^ b, cout = a & b.",
        "top_module": "half_adder",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: Half Adder
// ==========================================================
module half_adder (
    input  wire a,
    input  wire b,
    output wire sum,
    output wire cout
);
    assign sum  = a ^ b;
    assign cout = a & b;
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
        ],
        "output_ports": [
            PortMapping(name="sum", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="cout", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
        ],
    },
    "full_adder": {
        "id": "full_adder",
        "name": "Full Adder (Bennett / Clifford+T)",
        "description": "Classical 1-bit Full Adder verifying quantum Full Adder circuits.",
        "top_module": "full_adder",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: 1-Bit Full Adder
// ==========================================================
module full_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire sum,
    output wire cout
);
    assign sum  = a ^ b ^ cin;
    assign cout = (a & b) | (cin & (a ^ b));
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="cin", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
        ],
        "output_ports": [
            PortMapping(name="sum", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="cout", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[4]),
        ],
    },
    "falfg_gate": {
        "id": "falfg_gate",
        "name": "FALFG Gate (5x5 Reversible Gate)",
        "description": "Fault-Tolerant ALU Logic & Full-Adder Generator 5x5 reversible gate.",
        "top_module": "falfg_gate",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: 5x5 FALFG Gate
// Parity-Preserving Fault-Tolerant ALU Logic / Full Adder Generator
// P = A
// Q = A ^ B
// R = (A & ~B) ^ Cin
// S = (A ^ B) ^ Cin (Full Adder Sum)
// T = (A & B) ^ Cin (Full Adder Carry when Cin is inverted/controlled)
// ==========================================================
module falfg_gate (
    input  wire a,
    input  wire b,
    input  wire cin,
    output wire p,
    output wire q,
    output wire r,
    output wire s,
    output wire t
);
    assign p = a;
    assign q = a ^ b;
    assign r = (a & ~b) ^ cin;
    assign s = a ^ b ^ cin;
    assign t = (a & b) ^ cin;
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="cin", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
        ],
        "output_ports": [
            PortMapping(name="p", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="q", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="r", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="s", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="t", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[4]),
        ],
    },
    "alu_1bit": {
        "id": "alu_1bit",
        "name": "1-Bit Quantum ALU Core (28 Ops)",
        "description": "Classical reference for the 1-bit ALU arithmetic/logic functions.",
        "top_module": "alu_1bit",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: 1-Bit ALU Specification
// Mode: M=0 Arithmetic, M=1 Logic
// ==========================================================
module alu_1bit (
    input  wire a,
    input  wire b,
    input  wire cin,
    input  wire [1:0] sel,
    input  wire m,
    output reg  out,
    output reg  cout
);
    always @(*) begin
        if (m == 1'b0) begin
            // Arithmetic Operations
            case (sel)
                2'b00: {cout, out} = a + cin;               // ADD without B
                2'b01: {cout, out} = a + b + cin;           // ADD with carry
                2'b10: {cout, out} = a + (~b) + cin;        // SUB with borrow
                2'b11: {cout, out} = a - 1'b1;              // DECREMENT
            endcase
        end else begin
            // Logic Operations
            cout = 1'b0;
            case (sel)
                2'b00: out = a & b;                         // AND
                2'b01: out = a | b;                         // OR
                2'b10: out = a ^ b;                         // XOR
                2'b11: out = ~a;                            // NOT
            endcase
        end
    end
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="cin", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="sel", direction=PortDirection.INPUT, bit_width=2, qubit_indices=[3, 4]),
            PortMapping(name="m", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[5]),
        ],
        "output_ports": [
            PortMapping(name="out", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[6]),
            PortMapping(name="cout", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[7]),
        ],
    },
}


def get_verilog_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a curated Verilog template by ID."""
    return VERILOG_TEMPLATES.get(template_id)


def list_verilog_templates() -> List[Dict[str, Any]]:
    """List all available curated Verilog golden templates."""
    results = []
    for t_id, data in VERILOG_TEMPLATES.items():
        results.append(
            {
                "id": data["id"],
                "name": data["name"],
                "description": data["description"],
                "top_module": data["top_module"],
                "verilog_code": data["verilog_code"],
                "input_ports": [p.model_dump() for p in data["input_ports"]],
                "output_ports": [p.model_dump() for p in data["output_ports"]],
            }
        )
    return results


def export_circuit_to_verilog(
    circuit_name: str,
    num_qubits: int,
    truth_table: Optional[List[Dict[str, Any]]] = None,
) -> str:
    """Generate a clean, synthesizable Verilog behavioral module from a circuit.
    
    NOTE: This is strictly an export / inspection utility for educational purposes,
    NOT the independent golden reference used for verification.
    """
    safe_name = "".join(c if c.isalnum() else "_" for c in circuit_name).strip("_").lower()
    if not safe_name or safe_name[0].isdigit():
        safe_name = f"circuit_{safe_name}"

    header = f"""// ====================================================================
// AUTO-DERIVED VERILOG EXPORT: {circuit_name}
// Note: This module is generated from the quantum circuit's measured truth table
// for hardware synthesis and inspection. It is NOT the independent golden model.
// Total Qubits: {num_qubits}
// ====================================================================

module {safe_name} (
    input  wire [{num_qubits - 1}:0] q_in,
    output reg  [{num_qubits - 1}:0] q_out
);

"""
    if not truth_table:
        body = """    // Identity passthrough default
    always @(*) begin
        q_out = q_in;
    end
endmodule
"""
        return header + body

    # Build case statement from truth table
    cases = []
    for row in truth_table:
        in_bits = row.get("input_bitstring", "")
        out_bits = row.get("quantum_output_bitstring", row.get("verilog_output_bitstring", ""))
        if in_bits and out_bits:
            cases.append(f"            {len(in_bits)}'b{in_bits}: q_out = {len(out_bits)}'b{out_bits};")

    cases_str = "\n".join(cases)
    body = f"""    always @(*) begin
        case (q_in)
{cases_str}
            default: q_out = {{{num_qubits}{{1'b0}}}};
        endcase
    end
endmodule
"""
    return header + body
