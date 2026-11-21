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

    def test_06_falfg_operations_and_simulation(self):
        """Test Table V 5x5 FALFG operations and simulate-op endpoint."""
        resp = self.client.get("/api/alu/operations?architecture=falfg-gate")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_operations"], 10)
        self.assertEqual(len(data["logic_operations"]), 4)
        self.assertEqual(len(data["arithmetic_operations"]), 6)

        # Simulate FALFG Full Adder (1 + 1 + 0 = Sum 0, Cout 1)
        payload = {
            "architecture": "falfg-gate",
            "operation": "Full Adder",
            "a": 1,
            "b": 1,
            "cin": 0,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload)
        self.assertEqual(resp.status_code, 200)
        sim_data = resp.json()
        meta = sim_data["alu_metadata"]
        self.assertEqual(meta["operation"], "Full Adder")
        self.assertEqual(meta["expected_result"], 0)
        self.assertEqual(meta["expected_carry"], 1)
        self.assertEqual(meta["measured_result"], 0)
        self.assertEqual(meta["measured_carry"], 1)
        self.assertTrue(sim_data["parity_preserved"])

        # Simulate FALFG Logic AND & XOR (1, 1 -> P=1 (AND), Q=0 (XOR))
        logic_payload = {
            "architecture": "falfg-gate",
            "operation": "AND & XOR",
            "a": 1,
            "b": 1,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=logic_payload)
        self.assertEqual(resp.status_code, 200)
        l_data = resp.json()
        l_meta = l_data["alu_metadata"]
        self.assertEqual(l_meta["measured_result"], 0)  # Q = XOR
        self.assertEqual(l_meta["measured_carry"], 1)   # P = AND
        self.assertTrue(l_data["parity_preserved"])

    def test_07_fredkin_operations_and_simulation(self):
        """Test Fredkin CSWAP operations and mathematical truth of OR, AND, MUX."""
        resp = self.client.get("/api/alu/operations?architecture=fredkin-gate")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_operations"], 5)

        # Test Reversible OR: A=0, B=0 -> Result = 0
        payload_or_00 = {
            "architecture": "fredkin-gate",
            "operation": "Reversible OR",
            "a": 0,
            "b": 0,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload_or_00)
        self.assertEqual(resp.status_code, 200)
        data_or = resp.json()
        self.assertEqual(data_or["alu_metadata"]["measured_result"], 0)
        self.assertTrue(data_or["alu_metadata"]["result_match"])

        # Test Reversible OR: A=1, B=0 -> Result = 1
        payload_or_10 = {
            "architecture": "fredkin-gate",
            "operation": "Reversible OR",
            "a": 1,
            "b": 0,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload_or_10)
        self.assertEqual(resp.status_code, 200)
        data_or10 = resp.json()
        self.assertEqual(data_or10["alu_metadata"]["measured_result"], 1)
        self.assertTrue(data_or10["alu_metadata"]["result_match"])

        # Test Reversible AND: A=1, B=1 -> Result = 1
        payload_and_11 = {
            "architecture": "fredkin-gate",
            "operation": "Reversible AND",
            "a": 1,
            "b": 1,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload_and_11)
        self.assertEqual(resp.status_code, 200)
        data_and = resp.json()
        self.assertEqual(data_and["alu_metadata"]["measured_result"], 1)
        self.assertTrue(data_and["alu_metadata"]["result_match"])

        # Test Controlled SWAP: Ctrl=1, In1=1, In2=0 -> Out1=0, Out2=1
        payload_swap = {
            "architecture": "fredkin-gate",
            "operation": "Controlled SWAP (Ctrl=1)",
            "a": 1,
            "b": 1,
            "cin": 0,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload_swap)
        self.assertEqual(resp.status_code, 200)
        data_swap = resp.json()
        self.assertEqual(data_swap["alu_metadata"]["measured_result"], 0)
        self.assertEqual(data_swap["alu_metadata"]["measured_carry"], 1)
        self.assertTrue(data_swap["alu_metadata"]["result_match"])

    def test_08_bennett_operations_and_simulation(self):
        """Test Bennett Uncomputed Adder operations and dynamic Cin input."""
        resp = self.client.get("/api/alu/operations?architecture=bennett-adder")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["total_operations"], 4)

        # Full Addition with dynamic Cin=1: 1 + 0 + 1 = Sum 0, Cout 1
        payload = {
            "architecture": "bennett-adder",
            "operation": "Full Addition (Cin=0)",
            "a": 1,
            "b": 0,
            "cin": 1,
            "synthesis": "clifford_t"
        }
        resp = self.client.post("/api/alu/simulate-op", json=payload)
        self.assertEqual(resp.status_code, 200)
        sim_data = resp.json()
        meta = sim_data["alu_metadata"]
        self.assertEqual(meta["measured_result"], 0)
        self.assertEqual(meta["measured_carry"], 1)
        self.assertTrue(meta["result_match"])




if __name__ == "__main__":
    unittest.main()
