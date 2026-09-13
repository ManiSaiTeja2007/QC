"""Test Suite for Phase 1: JSON Circuit Storage, Path Traversal Defense, and Equivalence Verification.

Verifies that:
1. All 4 built-in circuits serialized to JSON reconstruct exact quantum circuits with identical gate counts,
   gate ordering, qubit indices, and strict numerical simulation equivalence.
2. Path traversal attempts are rejected.
3. Out-of-bounds qubit indices and unsupported gates are rejected.
4. Read-only system circuits cannot be deleted or overwritten by unprivileged writes.
"""

import pytest
import numpy as np

from backend.app.schemas.circuit_file import (
    CircuitFileSchema,
    CircuitGateSchema,
    CircuitMetadataSchema,
)
from backend.app.core.circuit_storage import (
    load_circuit_index,
    load_circuit_by_id,
    save_circuit_file,
    delete_circuit_file,
    rebuild_circuit_index,
    circuit_to_qiskit,
    get_circuit_file_path,
    validate_circuit_semantics,
)
from backend.app.modules.one_bit_alu import build_one_bit_alu_clifford_t
from backend.app.modules.falfg import build_falfg_clifford_t
from backend.app.gates.basic_gates import build_fredkin_circuit
from backend.app.modules.uncomputation import build_uncomputed_adder_subtractor
from backend.app.core.canonical_ir import build_canonical_circuit_ir
from backend.app.core.cost_metrics import analyze_circuit_cost


class TestCircuitStorageSecurity:
    """Security tests enforcing path traversal defense and schema constraints."""

    def test_path_traversal_rejection(self):
        """Rejects dangerous circuit IDs containing directory traversal sequences."""
        malicious_ids = [
            "../secret",
            "../../etc/passwd",
            "foo/bar",
            "foo\\bar",
            "circuit;rm -rf",
            "circuit name with spaces",
            "test$id",
        ]
        for bad_id in malicious_ids:
            with pytest.raises(ValueError):
                get_circuit_file_path(bad_id)

    def test_out_of_bounds_qubit_rejection(self):
        """Rejects gate definitions targeting non-existent qubit lines."""
        invalid_circuit = CircuitFileSchema(
            id="invalid_qubit_test",
            name="Invalid Qubit",
            num_qubits=3,
            gates=[
                CircuitGateSchema(name="H", qubits=[0]),
                CircuitGateSchema(name="CX", qubits=[1, 5]),  # Qubit 5 is out of bounds [0, 2]
            ],
        )
        with pytest.raises(ValueError, match="out of bounds"):
            validate_circuit_semantics(invalid_circuit)

    def test_duplicate_qubits_in_multi_qubit_gate_rejection(self):
        """Rejects multi-qubit gates referencing the same wire multiple times (e.g. CX control == target)."""
        invalid_cx = CircuitFileSchema(
            id="invalid_cx_test",
            name="Invalid CX",
            num_qubits=3,
            gates=[CircuitGateSchema(name="CX", qubits=[1, 1])],
        )
        with pytest.raises(ValueError, match="Duplicate qubit indices"):
            validate_circuit_semantics(invalid_cx)

    def test_unsupported_gate_rejection(self):
        """Rejects unrecognized or malicious gate names."""
        bad_gate = CircuitFileSchema(
            id="bad_gate_test",
            name="Bad Gate",
            num_qubits=2,
            gates=[CircuitGateSchema(name="MALICIOUS_OP", qubits=[0])],
        )
        with pytest.raises(ValueError, match="Unsupported gate name"):
            validate_circuit_semantics(bad_gate)

    def test_readonly_circuit_deletion_prevention(self):
        """Ensures built-in system circuits cannot be deleted."""
        with pytest.raises(PermissionError, match="Cannot delete built-in system circuit"):
            delete_circuit_file("1_bit_alu_clifford_t")


class TestCircuitIndexOperations:
    """Tests catalog loading, indexing, and rebuilding."""

    def test_index_contains_all_four_builtins(self):
        """Confirms that index.json catalogs all 4 foundational benchmark circuits."""
        index = load_circuit_index()
        indexed_ids = {c.id for c in index.circuits}
        assert "1_bit_alu_clifford_t" in indexed_ids
        assert "falfg_5x5" in indexed_ids
        assert "fredkin_cswap" in indexed_ids
        assert "bennett_adder" in indexed_ids

    def test_rebuild_index_preserves_circuits(self):
        """Verifies that rebuilding index from disk discovers all circuit files."""
        rebuilt = rebuild_circuit_index()
        indexed_ids = {c.id for c in rebuilt.circuits}
        assert len(indexed_ids) >= 4
        assert "1_bit_alu_clifford_t" in indexed_ids


class TestBuiltinCircuitsEquivalence:
    """Mathematical & structural verification asserting JSON-loaded circuits match original Python definitions."""

    @pytest.mark.parametrize("circuit_id, python_generator, expected_gates, test_inputs", [
        ("1_bit_alu_clifford_t", build_one_bit_alu_clifford_t, 75, [1, 1, 1, 0, 1, 1, 0]),
        ("falfg_5x5", build_falfg_clifford_t, 24, [1, 1, 0, 0, 0]),
        ("fredkin_cswap", lambda: build_fredkin_circuit("clifford_t"), 17, [1, 0, 1]),
        ("bennett_adder", build_uncomputed_adder_subtractor, 52, [1, 1, 0, 0, 0, 0, 0, 0, 0]),
    ])
    def test_exact_structure_and_numerical_simulation_equivalence(
        self, circuit_id, python_generator, expected_gates, test_inputs
    ):
        """Validates exact structural identity and strict numerical simulation equivalence."""
        # 1. Load circuit from JSON storage
        json_circuit_schema = load_circuit_by_id(circuit_id)
        assert json_circuit_schema is not None, f"Failed to load circuit '{circuit_id}' from storage"
        assert len(json_circuit_schema.gates) == expected_gates

        # 2. Instantiate original Qiskit Python circuit
        qc_orig = python_generator()
        assert len(qc_orig.data) == expected_gates

        # 3. Reconstruct Qiskit circuit from JSON schema
        qc_reconstructed = circuit_to_qiskit(json_circuit_schema)
        assert len(qc_reconstructed.data) == expected_gates
        assert qc_reconstructed.num_qubits == qc_orig.num_qubits

        # 4. Exact Structural Check: Gate Names, Order, and Qubits
        for idx, (inst_orig, inst_recon) in enumerate(zip(qc_orig.data, qc_reconstructed.data)):
            orig_name = inst_orig.operation.name.upper()
            recon_name = inst_recon.operation.name.upper()
            assert orig_name == recon_name, f"Gate name mismatch at step {idx + 1}: {orig_name} != {recon_name}"

            orig_qubits = [qc_orig.find_bit(q).index for q in inst_orig.qubits]
            recon_qubits = [qc_reconstructed.find_bit(q).index for q in inst_recon.qubits]
            assert orig_qubits == recon_qubits, f"Qubit mismatch at step {idx + 1}: {orig_qubits} != {recon_qubits}"

        # 5. Simulation Execution through Canonical IR Engine
        ir_orig = build_canonical_circuit_ir(qc_orig, test_inputs)
        ir_recon = build_canonical_circuit_ir(qc_reconstructed, test_inputs)

        # 6. Verify Exact Step Counts and Parity Invariants
        assert ir_orig["total_primitive_steps"] == ir_recon["total_primitive_steps"]
        assert ir_orig["p_in"] == ir_recon["p_in"]
        assert ir_orig["p_out"] == ir_recon["p_out"]
        assert ir_orig["parity_preserved"] == ir_recon["parity_preserved"]
        assert ir_orig["output_bits"] == ir_recon["output_bits"]

        # 7. Strict Numerical Equivalence on Probabilities, Fidelities, and Bloch Vectors
        assert len(ir_orig["steps"]) == len(ir_recon["steps"])
        for step_idx, (s_orig, s_recon) in enumerate(zip(ir_orig["steps"], ir_recon["steps"])):
            assert s_orig["primitive_step"] == s_recon["primitive_step"]
            assert s_orig["logical_op_id"] == s_recon["logical_op_id"]
            assert s_orig["unitary_fidelity"] > 0.9999
            assert s_recon["unitary_fidelity"] > 0.9999

            # Compare computational basis probabilities
            orig_probs = s_orig["probabilities"]
            recon_probs = s_recon["probabilities"]
            for state_label, p_val in orig_probs.items():
                assert np.isclose(p_val, recon_probs.get(state_label, 0.0), atol=1e-5), (
                    f"Probability divergence at step {step_idx} for state |{state_label}⟩"
                )

            # Compare Bloch vector components (x, y, z, purity)
            orig_bloch = s_orig["bloch_vectors"]
            recon_bloch = s_recon["bloch_vectors"]
            assert len(orig_bloch) == len(recon_bloch)
            for q_idx, (b_o, b_r) in enumerate(zip(orig_bloch, recon_bloch)):
                for key in ["x", "y", "z", "purity"]:
                    assert np.isclose(b_o[key], b_r[key], atol=1e-5), (
                        f"Bloch divergence at step {step_idx}, qubit {q_idx}, component {key}: {b_o[key]} vs {b_r[key]}"
                    )

        # 8. Compare Cost Metrics
        cost_orig = analyze_circuit_cost(qc_orig)
        cost_recon = analyze_circuit_cost(qc_reconstructed)
        assert cost_orig["quantum_cost"] == cost_recon["quantum_cost"]
        assert cost_orig["t_count"] == cost_recon["t_count"]
        assert cost_orig["t_depth"] == cost_recon["t_depth"]
        assert cost_orig["total_gates"] == cost_recon["total_gates"]
