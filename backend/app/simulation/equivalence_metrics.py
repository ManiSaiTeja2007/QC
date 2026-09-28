"""Differential Cross-Checking Comparator and Equivalence Analytics Core.

Cross-verifies quantum circuits against classical Verilog golden reference data,
computing functional equivalence, bitwise mismatch matrices, quantum state fidelities,
and full statistical distributions (five-number summary box plot, error heatmap, histograms).
"""

import time
from typing import Dict, List, Any, Optional
import numpy as np
from qiskit import QuantumCircuit

from backend.app.schemas.verification_contract import (
    VerificationContract,
    VerificationResult,
    TruthTableRow,
    BoxPlotStats,
    HeatmapData,
    HistogramEntry,
    ExecutionEngineStatus,
    ReferenceSourceType,
)
from backend.app.schemas.classical_netlist import ClassicalNetlist
from backend.app.simulation.verilog_engine import simulate_verilog
from backend.app.simulation.quantum_verifier import (
    run_quantum_verification_for_state,
    build_circuit_from_gates,
)


def compute_box_plot_statistics(data: List[float]) -> BoxPlotStats:
    """Calculate five-number summary and IQR for statistical box plots."""
    if not data:
        return BoxPlotStats(min=0.0, q1=0.0, median=0.0, q3=0.0, max=0.0, iqr=0.0)

    arr = np.sort(np.array(data, dtype=float))
    min_val = float(arr[0])
    max_val = float(arr[-1])
    q1 = float(np.percentile(arr, 25))
    median = float(np.percentile(arr, 50))
    q3 = float(np.percentile(arr, 75))
    iqr = float(q3 - q1)

    return BoxPlotStats(
        min=round(min_val, 4),
        q1=round(q1, 4),
        median=round(median, 4),
        q3=round(q3, 4),
        max=round(max_val, 4),
        iqr=round(iqr, 4),
    )


def compute_heatmap_and_bit_labels(
    truth_table: List[TruthTableRow],
    contract: VerificationContract,
) -> HeatmapData:
    """Construct 2D error heatmap matrix (inputs vs output bits)."""
    # Generate bit names: e.g. "sum[0]", "cout[0]"
    output_bit_names: List[str] = []
    for port in contract.output_ports:
        if port.bit_width == 1:
            output_bit_names.append(port.name)
        else:
            for b in range(port.bit_width):
                output_bit_names.append(f"{port.name}[{b}]")

    input_labels: List[str] = []
    matrix: List[List[int]] = []

    for row in truth_table:
        input_labels.append(f"State {row.state_index} ({row.input_bitstring})")

        row_errors: List[int] = []
        v_out = row.verilog_output_bitstring
        q_out = row.quantum_output_bitstring

        # Compare bit-by-bit
        max_len = max(len(v_out), len(q_out), len(output_bit_names))
        v_padded = v_out.rjust(max_len, "0")
        q_padded = q_out.rjust(max_len, "0")

        for bit_idx in range(len(output_bit_names)):
            char_idx = bit_idx if bit_idx < len(v_padded) else -1
            if char_idx >= 0 and v_padded[char_idx] != q_padded[char_idx]:
                row_errors.append(1)  # Mismatch
            else:
                row_errors.append(0)  # Match

        matrix.append(row_errors)

    return HeatmapData(
        input_labels=input_labels,
        output_bit_names=output_bit_names,
        matrix=matrix,
    )


def run_full_verification(
    contract: VerificationContract,
    quantum_circuit: QuantumCircuit,
    schematic_netlist: Optional[ClassicalNetlist] = None,
    timeout_verilog_sec: float = 5.0,
) -> VerificationResult:
    """Execute complete end-to-end differential verification across all 2^k states.
    
    1. If a schematic_netlist is provided, validates connectivity and combinational loops.
    2. Compiles and executes Verilog golden model using Icarus Verilog.
    3. Validates classical self-consistency (Schematic Netlist Evaluator == Icarus Verilog).
    4. Simulates quantum circuit across each basis state on Qiskit Aer.
    5. Performs bitwise comparison, fidelity analysis, and statistical aggregation.
    """
    t_start = time.perf_counter()
    diagnostics: List[str] = []
    classical_self_consistency: Optional[bool] = None

    # Step 0: Classical Schematic Pre-flight Validation & Loop Detection
    if schematic_netlist is not None:
        is_valid, netlist_errs = schematic_netlist.validate_netlist()
        if not is_valid:
            return VerificationResult(
                status=ExecutionEngineStatus.SYNTAX_ERROR,
                message=f"Classical Schematic validation failed: {'; '.join(netlist_errs)}",
                stderr="\n".join(netlist_errs),
                total_states_tested=0,
                total_errors=0,
                error_rate=1.0,
                state_fidelity_avg=0.0,
                state_fidelity_curve=[],
                box_plot=BoxPlotStats(min=0.0, q1=0.0, median=0.0, q3=0.0, max=0.0, iqr=0.0),
                heatmap=HeatmapData(input_labels=[], output_bit_names=[], matrix=[]),
                histograms=[],
                truth_table=[],
                ancilla_clean_all=False,
                execution_time_ms=(time.perf_counter() - t_start) * 1000.0,
                verilog_source=contract.verilog_code,
                top_module=contract.top_module_name,
                reference_name=contract.reference_name,
                reference_source_type=contract.reference_source_type,
                quantum_circuit_name=quantum_circuit.name or "Quantum Circuit",
                is_golden_eligible=(contract.reference_source_type != ReferenceSourceType.QUANTUM_DERIVED),
                classical_self_consistency=False,
                diagnostics=netlist_errs,
            )

    # Step 1: Classical Verilog Golden Reference Simulation
    status, golden_table, v_msg, stderr, v_time = simulate_verilog(
        verilog_code=contract.verilog_code,
        input_ports=contract.input_ports,
        output_ports=contract.output_ports,
        top_module_name=contract.top_module_name,
        timeout_sec=timeout_verilog_sec,
    )

    if status != ExecutionEngineStatus.IVERILOG_SUCCESS:
        return VerificationResult(
            status=status,
            message=f"Verilog golden reference execution failed: {v_msg}",
            stderr=stderr,
            total_states_tested=0,
            total_errors=0,
            error_rate=1.0,
            state_fidelity_avg=0.0,
            state_fidelity_curve=[],
            box_plot=BoxPlotStats(min=0.0, q1=0.0, median=0.0, q3=0.0, max=0.0, iqr=0.0),
            heatmap=HeatmapData(input_labels=[], output_bit_names=[], matrix=[]),
            histograms=[],
            truth_table=[],
            ancilla_clean_all=False,
            execution_time_ms=(time.perf_counter() - t_start) * 1000.0,
            verilog_source=contract.verilog_code,
            top_module=contract.top_module_name,
            reference_name=contract.reference_name,
            reference_source_type=contract.reference_source_type,
            quantum_circuit_name=quantum_circuit.name or "Quantum Circuit",
            is_golden_eligible=(contract.reference_source_type != ReferenceSourceType.QUANTUM_DERIVED),
            classical_self_consistency=False,
            diagnostics=[f"Verilog compilation/simulation error: {v_msg}"],
        )

    # Step 1b: Classical Self-Consistency Check (Schematic Netlist vs Verilog)
    if schematic_netlist is not None:
        self_consistent = True
        for row in golden_table:
            schem_out = schematic_netlist.evaluate_state(row["input_values"])
            for out_port_name, expected_val in row["output_values"].items():
                if schem_out.get(out_port_name) != expected_val:
                    self_consistent = False
                    diagnostics.append(
                        f"Self-Consistency Mismatch at state {row['input_bitstring']} for '{out_port_name}': "
                        f"Schematic Evaluator={schem_out.get(out_port_name)} vs Verilog={expected_val}"
                    )
                    break
        classical_self_consistency = self_consistent

    # Step 2: Cross-Check Against Quantum Circuit
    truth_table: List[TruthTableRow] = []
    fidelities: List[float] = []
    histograms: List[HistogramEntry] = []
    total_errors = 0
    all_ancillas_clean = True

    for row in golden_table:
        in_str = row["input_bitstring"]
        v_out_str = row["output_bitstring"]
        state_idx = row["state_index"]

        q_res = run_quantum_verification_for_state(
            base_circuit=quantum_circuit,
            input_bitstring=in_str,
            expected_golden_output=v_out_str,
            contract=contract,
        )

        q_out_str = q_res["quantum_output_bitstring"]
        is_match = (v_out_str == q_out_str)
        is_anc_clean = q_res["ancilla_clean"]
        fidelity = q_res["state_fidelity"]

        if not is_match:
            total_errors += 1
        if not is_anc_clean:
            all_ancillas_clean = False

        fidelities.append(fidelity)

        truth_table.append(
            TruthTableRow(
                state_index=state_idx,
                input_bitstring=in_str,
                input_values=row["input_values"],
                verilog_output_bitstring=v_out_str,
                verilog_output_values=row["output_values"],
                quantum_output_bitstring=q_out_str,
                quantum_output_values=q_res["quantum_output_values"],
                match=is_match,
                ancilla_clean=is_anc_clean,
                state_fidelity=round(fidelity, 4),
                probabilities=q_res["probabilities"],
            )
        )

        histograms.append(
            HistogramEntry(
                state_label=f"|{in_str}⟩",
                verilog_prob=1.0,
                quantum_prob=round(fidelity, 4),
            )
        )

    total_states = len(truth_table)
    error_rate = (total_errors / total_states) if total_states > 0 else 0.0
    avg_fidelity = float(np.mean(fidelities)) if fidelities else 0.0

    box_plot = compute_box_plot_statistics(fidelities)
    heatmap = compute_heatmap_and_bit_labels(truth_table, contract)
    total_elapsed_ms = (time.perf_counter() - t_start) * 1000.0

    if error_rate == 0.0 and avg_fidelity >= 0.999 and all_ancillas_clean:
        status_msg = f"100% Equivalence Verified across {total_states} states (Fidelity: 1.0, Ancilla Clean)."
    elif error_rate == 0.0:
        status_msg = f"Functional outputs match for all {total_states} states, but fidelity ({avg_fidelity:.3f}) or ancilla clean issues detected."
    else:
        status_msg = f"Verification Discrepancy: {total_errors}/{total_states} states mismatched (Error Rate: {error_rate * 100:.1f}%)."

    return VerificationResult(
        status=ExecutionEngineStatus.IVERILOG_SUCCESS,
        message=status_msg,
        stderr=None,
        total_states_tested=total_states,
        total_errors=total_errors,
        error_rate=round(error_rate, 4),
        state_fidelity_avg=round(avg_fidelity, 4),
        state_fidelity_curve=fidelities,
        box_plot=box_plot,
        heatmap=heatmap,
        histograms=histograms,
        truth_table=truth_table,
        ancilla_clean_all=all_ancillas_clean,
        execution_time_ms=round(total_elapsed_ms, 2),
        verilog_source=contract.verilog_code,
        top_module=contract.top_module_name,
        reference_name=contract.reference_name,
        reference_source_type=contract.reference_source_type,
        quantum_circuit_name=quantum_circuit.name or "Quantum Circuit",
        is_golden_eligible=(contract.reference_source_type != ReferenceSourceType.QUANTUM_DERIVED),
        classical_self_consistency=classical_self_consistency,
        diagnostics=diagnostics,
    )
