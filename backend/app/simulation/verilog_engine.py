"""Verilog Golden Reference Execution Engine using Icarus Verilog (iverilog + vvp).

Executes classical Verilog HDL modules in an isolated temporary directory,
driving all 2^k input combinations to generate golden reference truth tables.
Provides strict ExecutionEngineStatus reporting without silent fallbacks.
"""

import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any

from backend.app.schemas.verification_contract import (
    ExecutionEngineStatus,
    PortMapping,
    PortDirection,
    Endianness,
)

# Known paths for Icarus Verilog binaries in priority order
IVERILOG_SEARCH_PATHS = [
    "/home/mani/tools/oss-cad-suite/bin/iverilog",
    "/usr/bin/iverilog",
    "/usr/local/bin/iverilog",
]

VVP_SEARCH_PATHS = [
    "/home/mani/tools/oss-cad-suite/bin/vvp",
    "/usr/bin/vvp",
    "/usr/local/bin/vvp",
]


def find_binary(tool_name: str, candidate_paths: List[str]) -> Optional[str]:
    """Find the executable path for a tool."""
    for path in candidate_paths:
        if os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    which_path = shutil.which(tool_name)
    if which_path and os.access(which_path, os.X_OK):
        return which_path
    return None


def get_iverilog_path() -> Optional[str]:
    return find_binary("iverilog", IVERILOG_SEARCH_PATHS)


def get_vvp_path() -> Optional[str]:
    return find_binary("vvp", VVP_SEARCH_PATHS)


def extract_top_module_name(verilog_code: str) -> Optional[str]:
    """Extract the first module name declared in Verilog code."""
    match = re.search(r"module\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:#\s*\(|\()", verilog_code)
    if match:
        return match.group(1)
    # Fallback pattern for modules with params or old style
    match_fallback = re.search(r"module\s+([a-zA-Z_][a-zA-Z0-9_]*)", verilog_code)
    return match_fallback.group(1) if match_fallback else None


def generate_testbench(
    top_module: str,
    input_ports: List[PortMapping],
    output_ports: List[PortMapping],
) -> str:
    """Generate a self-contained Verilog testbench driving all 2^k input combinations.
    
    The testbench declares regs for inputs, wires for outputs, instantiates the DUT,
    cycles through integer index 0 to 2^k - 1, applies inputs with a 1-timeunit delay,
    and displays: <input_bitstring> <output_bitstring> using $display.
    """
    k = sum(p.bit_width for p in input_ports)
    total_states = 1 << k

    # DUT port declarations in TB
    reg_decls: List[str] = []
    wire_decls: List[str] = []
    dut_port_conns: List[str] = []

    for p in input_ports:
        if p.bit_width == 1:
            reg_decls.append(f"  reg tb_{p.name};")
        else:
            reg_decls.append(f"  reg [{p.bit_width - 1}:0] tb_{p.name};")
        dut_port_conns.append(f"    .{p.name}(tb_{p.name})")

    for p in output_ports:
        if p.bit_width == 1:
            wire_decls.append(f"  wire tb_{p.name};")
        else:
            wire_decls.append(f"  wire [{p.bit_width - 1}:0] tb_{p.name};")
        dut_port_conns.append(f"    .{p.name}(tb_{p.name})")

    dut_conns_str = ",\n".join(dut_port_conns)
    regs_str = "\n".join(reg_decls)
    wires_str = "\n".join(wire_decls)

    # Input concatenation format and Output concatenation format
    in_names = [f"tb_{p.name}" for p in input_ports]
    out_names = [f"tb_{p.name}" for p in output_ports]

    in_concat = f"{{{', '.join(in_names)}}}" if len(in_names) > 1 else in_names[0]
    out_concat = f"{{{', '.join(out_names)}}}" if len(out_names) > 1 else out_names[0]

    tb_code = f"""`timescale 1ns / 1ps

module tb_golden_verification;
{regs_str}
{wires_str}

  reg [{k - 1}:0] test_vec;

  // DUT instantiation
  {top_module} dut (
{dut_conns_str}
  );

  integer i;
  initial begin
    for (i = 0; i < {total_states}; i = i + 1) begin
      test_vec = i[{k - 1}:0];
      {in_concat} = test_vec;
      #1;
      $display("VOUT %0{k}b %b", test_vec, {out_concat});
    end
    $finish;
  end

endmodule
"""
    return tb_code


def simulate_verilog(
    verilog_code: str,
    input_ports: List[PortMapping],
    output_ports: List[PortMapping],
    top_module_name: Optional[str] = None,
    timeout_sec: float = 5.0,
) -> Tuple[ExecutionEngineStatus, List[Dict[str, Any]], str, Optional[str], float]:
    """Compile and simulate Verilog code against all 2^k input vectors.
    
    Returns:
        (status, golden_table, message, stderr, execution_time_ms)
        golden_table is a list of dicts:
        [
            {
                "state_index": int,
                "input_bitstring": str,
                "input_values": {port_name: int, ...},
                "output_bitstring": str,
                "output_values": {port_name: int, ...}
            }, ...
        ]
    """
    t0 = time.perf_counter()

    if not verilog_code.strip():
        return (
            ExecutionEngineStatus.SYNTAX_ERROR,
            [],
            "Empty Verilog code provided.",
            None,
            0.0,
        )

    module_name = top_module_name or extract_top_module_name(verilog_code)
    if not module_name:
        return (
            ExecutionEngineStatus.SYNTAX_ERROR,
            [],
            "No Verilog module definition found in code.",
            None,
            0.0,
        )

    iverilog_bin = get_iverilog_path()
    vvp_bin = get_vvp_path()

    if not iverilog_bin or not vvp_bin:
        return (
            ExecutionEngineStatus.RUNTIME_ERROR,
            [],
            f"Icarus Verilog tools not found (iverilog={iverilog_bin}, vvp={vvp_bin}).",
            None,
            0.0,
        )

    tb_code = generate_testbench(module_name, input_ports, output_ports)
    k = sum(p.bit_width for p in input_ports)
    out_width = sum(p.bit_width for p in output_ports)

    with tempfile.TemporaryDirectory(prefix="verilog_verify_") as tmp_dir:
        tmp_path = Path(tmp_dir)
        design_path = tmp_path / "design.v"
        tb_path = tmp_path / "tb.v"
        out_vvp = tmp_path / "sim.vvp"

        design_path.write_text(verilog_code, encoding="utf-8")
        tb_path.write_text(tb_code, encoding="utf-8")

        # 1. Compilation step
        compile_cmd = [iverilog_bin, "-o", str(out_vvp), str(design_path), str(tb_path)]
        try:
            compile_res = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=timeout_sec,
                cwd=tmp_dir,
            )
        except subprocess.TimeoutExpired:
            return (
                ExecutionEngineStatus.SIMULATION_TIMEOUT,
                [],
                f"Icarus Verilog compilation timed out after {timeout_sec}s.",
                None,
                (time.perf_counter() - t0) * 1000.0,
            )

        if compile_res.returncode != 0:
            return (
                ExecutionEngineStatus.COMPILATION_ERROR,
                [],
                f"Verilog compilation failed (exit code {compile_res.returncode}).",
                compile_res.stderr.strip() or compile_res.stdout.strip(),
                (time.perf_counter() - t0) * 1000.0,
            )

        # 2. Simulation step
        sim_cmd = [vvp_bin, str(out_vvp)]
        try:
            sim_res = subprocess.run(
                sim_cmd,
                capture_output=True,
                text=True,
                timeout=timeout_sec,
                cwd=tmp_dir,
            )
        except subprocess.TimeoutExpired:
            return (
                ExecutionEngineStatus.SIMULATION_TIMEOUT,
                [],
                f"VVP simulation timed out after {timeout_sec}s.",
                None,
                (time.perf_counter() - t0) * 1000.0,
            )

        if sim_res.returncode != 0:
            return (
                ExecutionEngineStatus.RUNTIME_ERROR,
                [],
                f"VVP simulation failed (exit code {sim_res.returncode}).",
                sim_res.stderr.strip() or sim_res.stdout.strip(),
                (time.perf_counter() - t0) * 1000.0,
            )

        # 3. Parse output lines
        raw_output = sim_res.stdout.strip()
        lines = [ln.strip() for ln in raw_output.splitlines() if ln.strip()]

        golden_table: List[Dict[str, Any]] = []
        parsed_idx = 0
        for line in lines:
            if not line.startswith("VOUT "):
                continue
            parts = line[5:].split()
            if len(parts) < 2:
                continue
            in_str = parts[0]
            out_str = parts[1]

            # Parse port values from the concatenated bitstrings
            in_vals: Dict[str, int] = {}
            offset = 0
            for p in input_ports:
                slice_bits = in_str[offset : offset + p.bit_width]
                in_vals[p.name] = int(slice_bits, 2) if slice_bits else 0
                offset += p.bit_width

            out_vals: Dict[str, int] = {}
            offset = 0
            for p in output_ports:
                slice_bits = out_str[offset : offset + p.bit_width]
                # Replace 'x' or 'z' with 0 if uninitialized
                sanitized_bits = "".join(b if b in ("0", "1") else "0" for b in slice_bits)
                out_vals[p.name] = int(sanitized_bits, 2) if sanitized_bits else 0
                offset += p.bit_width

            golden_table.append(
                {
                    "state_index": parsed_idx,
                    "input_bitstring": in_str,
                    "input_values": in_vals,
                    "output_bitstring": out_str,
                    "output_values": out_vals,
                }
            )
            parsed_idx += 1

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return (
            ExecutionEngineStatus.IVERILOG_SUCCESS,
            golden_table,
            f"Successfully simulated {len(golden_table)} states in {elapsed_ms:.2f} ms via Icarus Verilog.",
            None,
            elapsed_ms,
        )
