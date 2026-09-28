"""Quantum Circuit Execution Engine for Differential Cross-Checking against Classical Verilog.

Executes quantum circuits across all 2^k input basis states on Qiskit Aer,
measuring target output qubits, validating ancilla cleanliness, and computing
quantum state fidelity against ideal golden reference targets.
"""

from typing import Dict, List, Tuple, Any, Optional
import numpy as np

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator

from backend.app.schemas.verification_contract import (
    VerificationContract,
    VerificationMode,
    PortMapping,
    Endianness,
)


def build_circuit_from_gates(
    num_qubits: int,
    gates_data: List[Dict[str, Any]],
    circuit_name: str = "Quantum Under Test",
) -> QuantumCircuit:
    """Instantiate a Qiskit QuantumCircuit from a list of gate specifications."""
    qc = QuantumCircuit(num_qubits, name=circuit_name)
    for g in gates_data:
        name = g.get("name", "").upper()
        q = g.get("qubits", [])
        params = g.get("params", []) or []

        if name == "H" and len(q) >= 1:
            qc.h(q[0])
        elif name == "X" and len(q) >= 1:
            qc.x(q[0])
        elif name == "Y" and len(q) >= 1:
            qc.y(q[0])
        elif name == "Z" and len(q) >= 1:
            qc.z(q[0])
        elif name == "S" and len(q) >= 1:
            qc.s(q[0])
        elif name == "SDG" and len(q) >= 1:
            qc.sdg(q[0])
        elif name == "T" and len(q) >= 1:
            qc.t(q[0])
        elif name == "TDG" and len(q) >= 1:
            qc.tdg(q[0])
        elif name in ("CX", "CNOT") and len(q) >= 2:
            qc.cx(q[0], q[1])
        elif name == "CZ" and len(q) >= 2:
            qc.cz(q[0], q[1])
        elif name == "SWAP" and len(q) >= 2:
            qc.swap(q[0], q[1])
        elif name in ("CCX", "TOFFOLI") and len(q) >= 3:
            qc.ccx(q[0], q[1], q[2])
        elif name == "CSWAP" and len(q) >= 3:
            qc.cswap(q[0], q[1], q[2])
        elif name == "RX" and len(q) >= 1 and params:
            qc.rx(params[0], q[0])
        elif name == "RY" and len(q) >= 1 and params:
            qc.ry(params[0], q[0])
        elif name == "RZ" and len(q) >= 1 and params:
            qc.rz(params[0], q[0])
    return qc


def map_input_vector_to_qubits(
    input_bitstring: str,
    input_ports: List[PortMapping],
    total_qubits: int,
    ancillas: Optional[List[Any]] = None,
) -> List[int]:
    """Map the concatenated input bitstring to physical qubit initial states (0 or 1).
    
    Returns a list of length total_qubits with initial computational values.
    """
    qubit_init = [0] * total_qubits

    # Set ancillas to their expected initial state (default 0)
    if ancillas:
        for anc in ancillas:
            idx = anc.qubit_index if hasattr(anc, "qubit_index") else anc.get("qubit_index", 0)
            clean_val = anc.expected_clean_state if hasattr(anc, "expected_clean_state") else anc.get("expected_clean_state", 0)
            if idx < total_qubits:
                qubit_init[idx] = clean_val

    # Map input port bits to assigned qubits
    offset = 0
    for port in input_ports:
        port_bits = input_bitstring[offset : offset + port.bit_width]
        offset += port.bit_width

        # port_bits is MSB-first as string (e.g. "10" means bit1=1, bit0=0)
        # port.qubit_indices order:
        # If LITTLE_ENDIAN: qubit_indices[0] is bit 0 (LSB), qubit_indices[-1] is MSB.
        # String port_bits has LSB at port_bits[-1].
        if port.endianness == Endianness.LITTLE_ENDIAN:
            # bit 0 is port_bits[-1], bit 1 is port_bits[-2], etc.
            rev_bits = port_bits[::-1]
            for bit_i, q_idx in enumerate(port.qubit_indices):
                if q_idx < total_qubits and bit_i < len(rev_bits):
                    qubit_init[q_idx] = int(rev_bits[bit_i])
        else:
            # BIG_ENDIAN: qubit_indices[0] is bit N-1 (MSB), matching port_bits[0]
            for bit_i, q_idx in enumerate(port.qubit_indices):
                if q_idx < total_qubits and bit_i < len(port_bits):
                    qubit_init[q_idx] = int(port_bits[bit_i])

    return qubit_init


def extract_output_bitstring(
    measured_qubit_states: Dict[int, int],
    output_ports: List[PortMapping],
) -> Tuple[str, Dict[str, int]]:
    """Extract concatenated output bitstring and per-port integer values from measured qubits."""
    out_chars: List[str] = []
    port_values: Dict[str, int] = {}

    for port in output_ports:
        port_chars: List[str] = []
        if port.endianness == Endianness.LITTLE_ENDIAN:
            # qubit_indices[0] is LSB, so reverse to form MSB-first string
            for q_idx in port.qubit_indices:
                bit_val = measured_qubit_states.get(q_idx, 0)
                port_chars.append(str(bit_val))
            # port_chars is [bit0, bit1, ...]; MSB-first string is reversed
            port_str = "".join(port_chars[::-1])
        else:
            for q_idx in port.qubit_indices:
                bit_val = measured_qubit_states.get(q_idx, 0)
                port_chars.append(str(bit_val))
            port_str = "".join(port_chars)

        out_chars.append(port_str)
        port_values[port.name] = int(port_str, 2) if port_str else 0

    return "".join(out_chars), port_values


def run_quantum_verification_for_state(
    base_circuit: QuantumCircuit,
    input_bitstring: str,
    expected_golden_output: str,
    contract: VerificationContract,
) -> Dict[str, Any]:
    """Execute quantum simulation for a single input vector.
    
    Returns:
        {
            "quantum_output_bitstring": str,
            "quantum_output_values": Dict[str, int],
            "ancilla_clean": bool,
            "state_fidelity": float,
            "probabilities": Dict[str, float]
        }
    """
    n_qubits = base_circuit.num_qubits
    init_bits = map_input_vector_to_qubits(
        input_bitstring,
        contract.input_ports,
        n_qubits,
        contract.ancillas,
    )

    # Construct execution circuit with initial X gates
    qc_exec = QuantumCircuit(n_qubits)
    for q_idx, bit in enumerate(init_bits):
        if bit == 1:
            qc_exec.x(q_idx)

    # Append core gates from base circuit
    qc_exec.compose(base_circuit, inplace=True)

    if contract.mode == VerificationMode.STATEVECTOR_IDEAL:
        # Ideal statevector simulation
        sv = Statevector.from_instruction(qc_exec)
        probs_dict = sv.probabilities_dict()

        # In Qiskit probs_dict, keys are binary strings q_{N-1}...q_0
        # Determine the most probable computational basis state
        most_probable_key = max(probs_dict.items(), key=lambda item: item[1])[0]
        # Map key string to qubit dict (key is little-endian: index 0 is at the end)
        measured_qubits: Dict[int, int] = {}
        for q_idx in range(n_qubits):
            char_idx = len(most_probable_key) - 1 - q_idx
            measured_qubits[q_idx] = int(most_probable_key[char_idx])

        quant_out_str, quant_out_vals = extract_output_bitstring(measured_qubits, contract.output_ports)

        # Check ancilla cleanliness
        anc_clean = True
        for anc in contract.ancillas:
            if measured_qubits.get(anc.qubit_index, 0) != anc.expected_clean_state:
                anc_clean = False
                break

        # Compute State Fidelity against ideal expected target
        # Sum probabilities of all computational basis states where:
        # - Target output qubits match expected_golden_output
        # - Ancillae match expected_clean_state
        fidelity = 0.0
        for state_key, p in probs_dict.items():
            state_bits = {
                q_idx: int(state_key[len(state_key) - 1 - q_idx])
                for q_idx in range(n_qubits)
            }
            cand_out, _ = extract_output_bitstring(state_bits, contract.output_ports)
            cand_anc_clean = all(
                state_bits.get(anc.qubit_index, 0) == anc.expected_clean_state
                for anc in contract.ancillas
            )
            if cand_out == expected_golden_output and cand_anc_clean:
                fidelity += p

        return {
            "quantum_output_bitstring": quant_out_str,
            "quantum_output_values": quant_out_vals,
            "ancilla_clean": anc_clean,
            "state_fidelity": float(np.clip(fidelity, 0.0, 1.0)),
            "probabilities": {k: float(v) for k, v in probs_dict.items() if v >= 0.005},
        }

    else:
        # Shot measurement simulation on Qiskit Aer
        shots = contract.num_shots
        qc_meas = qc_exec.copy()
        qc_meas.measure_all()

        simulator = AerSimulator()
        job = simulator.run(qc_meas, shots=shots)
        counts = job.result().get_counts()

        # Find most frequent measurement outcome
        top_outcome = max(counts.items(), key=lambda item: item[1])[0]
        # In Qiskit, measure_all formats bitstrings space-separated or single string q_{N-1}...q_0
        clean_outcome = top_outcome.replace(" ", "")
        measured_qubits = {}
        for q_idx in range(n_qubits):
            char_idx = len(clean_outcome) - 1 - q_idx
            measured_qubits[q_idx] = int(clean_outcome[char_idx])

        quant_out_str, quant_out_vals = extract_output_bitstring(measured_qubits, contract.output_ports)

        anc_clean = True
        for anc in contract.ancillas:
            if measured_qubits.get(anc.qubit_index, 0) != anc.expected_clean_state:
                anc_clean = False
                break

        # Calculate empirical fidelity from counts matching expected golden output + clean ancilla
        matching_shots = 0
        for outcome_key, cnt in counts.items():
            s_bits = {
                q_idx: int(outcome_key.replace(" ", "")[len(outcome_key.replace(" ", "")) - 1 - q_idx])
                for q_idx in range(n_qubits)
            }
            cand_out, _ = extract_output_bitstring(s_bits, contract.output_ports)
            cand_anc = all(
                s_bits.get(anc.qubit_index, 0) == anc.expected_clean_state
                for anc in contract.ancillas
            )
            if cand_out == expected_golden_output and cand_anc:
                matching_shots += cnt

        fidelity = matching_shots / shots

        probs = {k.replace(" ", ""): v / shots for k, v in counts.items()}
        return {
            "quantum_output_bitstring": quant_out_str,
            "quantum_output_values": quant_out_vals,
            "ancilla_clean": anc_clean,
            "state_fidelity": float(np.clip(fidelity, 0.0, 1.0)),
            "probabilities": probs,
        }
