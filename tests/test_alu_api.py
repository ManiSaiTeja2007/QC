"""Unit tests for the dedicated Quantum ALU & Code Export API Router."""

import unittest
from fastapi.testclient import TestClient
from backend.app.main import app


class TestAluAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_get_operations(self):
        """Test retrieving all 28 ALU operations with metadata."""
        resp = self.client.get("/api/alu/operations")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("total_operations", data)
        self.assertEqual(data["total_operations"], 28)
        self.assertEqual(len(data["logic_operations"]), 12)
        self.assertEqual(len(data["arithmetic_operations"]), 16)
        self.assertIn("qubit_mapping", data)
        self.assertEqual(len(data["qubit_mapping"]), 7)

    def test_02_simulate_full_adder_op(self):
        """Test simulating Full Adder (1 + 1 + 0 = Sum 0, Cout 1)."""
        payload = {
            "operation": "Full Adder",
            "a": 1,
            "b": 1,
            "cin": 0,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        meta = data["alu_metadata"]
        self.assertEqual(meta["operation"], "Full Adder")
        self.assertEqual(meta["expected_result"], 0)
        self.assertEqual(meta["expected_carry"], 1)
        self.assertEqual(meta["measured_result"], 0)
        self.assertEqual(meta["measured_carry"], 1)
        self.assertTrue(meta["result_match"])
        self.assertTrue(data["parity_preserved"])

    def test_03_simulate_xor_op(self):
        """Test simulating bitwise XOR (1 ^ 0 = 1)."""
        payload = {
            "operation": "XOR (A!=B)",
            "a": 1,
            "b": 0,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        meta = data["alu_metadata"]
        self.assertEqual(meta["expected_result"], 1)
        self.assertEqual(meta["measured_result"], 1)
        self.assertTrue(meta["result_match"])
        self.assertTrue(data["parity_preserved"])

    def test_04_simulate_noise(self):
        """Test open-system physical noise simulation."""
        payload = {
            "architecture": "1-bit-alu",
            "synthesis": "clifford_t",
            "input_bits": [1, 0, 0, 0, 1, 0, 0],
            "depolarizing_p": 0.001,
            "t1_us": 100.0,
            "t2_us": 80.0
        }
        resp = self.client.post("/api/alu/simulate-noise", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("state_fidelity", data)
        self.assertGreater(data["state_fidelity"], 0.85)
        self.assertIn("purity", data)
        self.assertIn("probabilities", data)

    def test_05_export_code_formats(self):
        """Test exporting circuits to QASM2, QASM3, Qiskit, and Verilog."""
        payload = {
            "architecture": "1-bit-alu",
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/export-code", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("qasm2", data)
        self.assertIn("OPENQASM 2.0;", data["qasm2"])
        self.assertIn("qasm3", data)
        self.assertIn("OPENQASM 3.0;", data["qasm3"])
        self.assertIn("python_qiskit", data)
        self.assertIn("import QuantumCircuit", data["python_qiskit"])
        self.assertIn("verilog_rtl", data)
        self.assertIn("module", data["verilog_rtl"])


if __name__ == "__main__":
    unittest.main()
