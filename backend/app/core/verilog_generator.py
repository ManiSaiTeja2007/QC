"""Verilog Hardware Description Generators and Curated Golden Reference Templates.

Provides independent, verified classical Verilog templates (AND, Half Adder, Full Adder,
FALFG gate, 1-bit ALU) and a separate inspection/export utility for converting quantum circuits.
"""

from typing import Dict, List, Any, Optional
from backend.app.schemas.verification_contract import (
    PortMapping,
    PortDirection,
    Endianness,
    AncillaContract,
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
        "name": "5x5 FALFG Gate (Table IV - 32 States)",
        "description": "Fault-Tolerant ALU Logic & Arithmetic Generator 5x5 reversible gate (IEEE TETC 2026 Table IV).",
        "top_module": "falfg_gate",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: 5x5 FALFG Gate
// Parity-Preserving Fault-Tolerant ALU Logic & Arithmetic Generator
// Source: IEEE TETC 2026 Table IV (All 32 States Verified)
// ==========================================================
module falfg_gate (
    input  wire a,
    input  wire b,
    input  wire c,
    input  wire d,
    input  wire e,
    output wire p,
    output wire q,
    output wire r,
    output wire s,
    output wire t
);
    // P: Carry Out (D=0) or Borrow Out (D=1)
    assign p = (b & c) | (a & b & ~d) | (a & c & ~d) | (b & d & ~a) | (c & d & ~a);

    // Q: Sum / Difference = A ^ B ^ C
    assign q = a ^ b ^ c;

    // R: Garbage 1 / Logic Function Selector
    assign r = (c & ~b) | (a & c & ~d) | (c & d & ~a) | (a & ~b & ~d) | (d & ~a & ~b);

    // S: Garbage 2 / Mode Flag = A ^ B ^ D
    assign s = a ^ b ^ d;

    // T: Garbage 3 / Parity Preserving Bit = B ^ C ^ D ^ E
    assign t = b ^ c ^ d ^ e;
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="c", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="d", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="e", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[4]),
        ],
        "output_ports": [
            PortMapping(name="p", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="q", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="r", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="s", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="t", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[4]),
        ],
    },
    "fredkin_cswap": {
        "id": "fredkin_cswap",
        "name": "Fredkin CSWAP Gate (3 Qubits - 8 States)",
        "description": "Conservative reversible Fredkin CSWAP gate decomposed into fault-tolerant Clifford+T basis.",
        "top_module": "fredkin_cswap",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: 3-Qubit Fredkin (CSWAP) Gate
// Source: IEEE TETC 2026 Fig. 2(b) (All 8 States Verified)
// Q0 = ctrl, Q1 = in1, Q2 = in2
// ==========================================================
module fredkin_cswap (
    input  wire ctrl,
    input  wire in1,
    input  wire in2,
    output wire ctrl_out,
    output wire out1,
    output wire out2
);
    assign ctrl_out = ctrl;
    assign out1     = ctrl ? in2 : in1;
    assign out2     = ctrl ? in1 : in2;
endmodule
""",
        "input_ports": [
            PortMapping(name="ctrl", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="in1", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="in2", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
        ],
        "output_ports": [
            PortMapping(name="ctrl_out", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="out1", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="out2", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[2]),
        ],
    },
    "alu_1bit": {
        "id": "alu_1bit",
        "name": "1-Bit Quantum ALU (7 Qubits - 128 States)",
        "description": "Fault-tolerant reversible ALU based on 5x5 FALFG and 3 Fredkin multiplexers (IEEE TETC 2026).",
        "top_module": "alu_1bit",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: 1-Bit Fault-Tolerant ALU
// Architecture: 5x5 FALFG Gate + 3 Fredkin Multiplexers (FRG1, FRG2, FRG3)
// Source: IEEE TETC 2026 Section IV.C, Figs. 6-8, Table VI (128 States Verified)
// ==========================================================
module alu_1bit (
    input  wire a,
    input  wire b,
    input  wire s0,
    input  wire s1,
    input  wire m,
    input  wire s2,
    input  wire s3,
    output wire result,
    output wire cout,
    output wire g1,
    output wire g3,
    output wire g2,
    output wire s2_out,
    output wire s3_out
);
    // 1. FALFG Core on (a, b, s0, s1, m)
    wire p = (b & s0) | (a & b & ~s1) | (a & s0 & ~s1) | (b & s1 & ~a) | (s0 & s1 & ~a);
    wire q = a ^ b ^ s0;
    wire r = (s0 & ~b) | (a & s0 & ~s1) | (s0 & s1 & ~a) | (a & ~b & ~s1) | (s1 & ~a & ~b);
    wire s = a ^ b ^ s1;
    wire t = b ^ s0 ^ s1 ^ m;

    // 2. FRG1: controlled by S2, switches P (wire 0) and Q (wire 1)
    wire frg1_w0 = s2 ? q : p;
    wire frg1_w1 = s2 ? p : q;

    // 3. FRG2: controlled by S2, switches R (wire 2) and T (wire 4)
    wire frg2_w2 = s2 ? t : r;
    wire frg2_w4 = s2 ? r : t;

    // 4. FRG3: controlled by S3, switches wire 0 and wire 2
    assign result = s3 ? frg2_w2 : frg1_w0;
    assign cout   = frg1_w1;
    assign g1     = s3 ? frg1_w0 : frg2_w2;
    assign g3     = s;
    assign g2     = frg2_w4;
    assign s2_out = s2;
    assign s3_out = s3;
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="s0", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="s1", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="m", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[4]),
            PortMapping(name="s2", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[5]),
            PortMapping(name="s3", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[6]),
        ],
        "output_ports": [
            PortMapping(name="result", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="cout", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="g1", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="g3", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="g2", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[4]),
            PortMapping(name="s2_out", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[5]),
            PortMapping(name="s3_out", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[6]),
        ],
    },
    "bennett_adder": {
        "id": "bennett_adder",
        "name": "Bennett Uncomputed Adder (9 Qubits - 32 States)",
        "description": "Garbage-free uncomputed Full Adder/Subtractor with dual Feynman copy registers (IEEE TETC 2026 Fig. 9).",
        "top_module": "bennett_adder",
        "verilog_code": """// ==========================================================
// Independent Golden Reference: Bennett Uncomputed Adder/Subtractor
// Garbage-free uncomputation with dual Feynman parity copy registers
// Source: IEEE TETC 2026 Fig. 9 (All 32 Primary States Verified)
// ==========================================================
module bennett_adder (
    input  wire a,
    input  wire b,
    input  wire cin,
    input  wire sel,
    input  wire mode,
    output wire a_res,
    output wire b_res,
    output wire cin_res,
    output wire sel_res,
    output wire mode_res,
    output wire cout,
    output wire sum,
    output wire cout_copy,
    output wire sum_copy
);
    // 1. Forward FALFG logic
    wire p = (b & cin) | (a & b & ~sel) | (a & cin & ~sel) | (b & sel & ~a) | (cin & sel & ~a);
    wire q = a ^ b ^ cin;

    // Bennett Uncomputation guarantees input lines are fully restored (garbage-free)
    assign a_res    = a;
    assign b_res    = b;
    assign cin_res  = cin;
    assign sel_res  = sel;
    assign mode_res = mode;

    // Dual Feynman copy registers (Q5, Q6, Q7, Q8)
    assign cout      = p;
    assign sum       = q;
    assign cout_copy = p;
    assign sum_copy  = q;
endmodule
""",
        "input_ports": [
            PortMapping(name="a", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="cin", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="sel", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="mode", direction=PortDirection.INPUT, bit_width=1, qubit_indices=[4]),
        ],
        "output_ports": [
            PortMapping(name="a_res", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[0]),
            PortMapping(name="b_res", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[1]),
            PortMapping(name="cin_res", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[2]),
            PortMapping(name="sel_res", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[3]),
            PortMapping(name="mode_res", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[4]),
            PortMapping(name="cout", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[5]),
            PortMapping(name="sum", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[6]),
            PortMapping(name="cout_copy", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[7]),
            PortMapping(name="sum_copy", direction=PortDirection.OUTPUT, bit_width=1, qubit_indices=[8]),
        ],
    },
}

TEMPLATE_ALIASES: Dict[str, str] = {
    "falfg_5x5": "falfg_gate",
    "1_bit_alu_clifford_t": "alu_1bit",
    "1_bit_alu": "alu_1bit",
    "bennett_adder": "bennett_adder",
    "fredkin_cswap": "fredkin_cswap",
}


def get_verilog_template(template_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve a curated Verilog template by ID or circuit alias."""
    resolved_id = TEMPLATE_ALIASES.get(template_id, template_id)
    return VERILOG_TEMPLATES.get(resolved_id)


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
                "ancillas": [a.model_dump() for a in data.get("ancillas", [])],
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
