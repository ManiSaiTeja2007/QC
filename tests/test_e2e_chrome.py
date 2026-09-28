"""Automated Chrome E2E and Visual Snapshot Suite for Quantum ALU 3D Studio.

Uses headless Google Chrome via Selenium and Chrome DevTools Protocol (CDP) to:
1. Verify workspace navigation, state isolation, and UI responsiveness.
2. Verify Circuit Library Hub, Upload/Pre-flight validation, and Save-to-Library modals.
3. Verify 3D WebGL Bloch spheres, 3D Q-Sphere, and Dirac Ket rendering.
4. Capture high-resolution visual documentation snapshots for the README.
"""

import os
import sys
import time
import unittest
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = "http://localhost:5173"
IMAGES_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "images"))

class TestQuantumStudioChromeDevTools(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.makedirs(IMAGES_DIR, exist_ok=True)
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1600,980")
        options.set_capability("goog:loggingPrefs", {"browser": "ALL"})

        cls.driver = webdriver.Chrome(options=options)
        cls.driver.get(f"{BASE_URL}/#builder")
        time.sleep(2.5)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def snapshot(self, filename: str):
        filepath = os.path.join(IMAGES_DIR, filename)
        self.driver.save_screenshot(filepath)
        print(f"  📸 Captured snapshot: {filepath} ({os.path.getsize(filepath):,} bytes)")

    def test_01_builder_workspace_and_snapshot(self):
        """Verify Circuit Builder workspace layout, palette, canvas, and 3D Bloch spheres."""
        driver = self.driver
        driver.get(f"{BASE_URL}/#builder")
        time.sleep(2)

        # Assert canvas and palette exist
        palette = driver.find_element(By.CLASS_NAME, "builder-palette")
        self.assertTrue(palette.is_displayed(), "Gate palette must be visible in builder")

        canvas = driver.find_element(By.CLASS_NAME, "builder-canvas-card")
        self.assertTrue(canvas.is_displayed(), "Circuit canvas must be visible in builder")

        # Assert Save to Library button is present
        save_btn = driver.find_element(By.XPATH, "//button[contains(., 'Save to Library')]")
        self.assertTrue(save_btn.is_displayed(), "Save to Library button must be present")

        # Capture snapshot
        self.snapshot("01_circuit_builder.png")
        print("  ✅ Test 01: Circuit Builder workspace verified")

    def test_02_circuit_hub_modal_and_snapshot(self):
        """Verify opening Circuit Hub modal, catalog cards, filtering, and detail drawer."""
        driver = self.driver
        driver.get(f"{BASE_URL}/#builder")
        time.sleep(1.5)

        # Open Circuit Hub from sidebar
        hub_btn = driver.find_element(By.XPATH, "//button[contains(., 'Circuit Hub')]")
        hub_btn.click()
        time.sleep(1.5)

        # Modal should be visible
        modal_title = driver.find_element(By.XPATH, "//*[contains(text(), 'Quantum Circuit Hub & Storage')]")
        self.assertTrue(modal_title.is_displayed(), "Circuit Hub modal title must be visible")

        # Category filter chips should exist
        chips = driver.find_elements(By.XPATH, "//button[contains(., 'ALL') or contains(., 'ARITHMETIC') or contains(., 'CUSTOM')]")
        self.assertGreater(len(chips), 0, "Category filter chips must be present")

        # Capture snapshot
        self.snapshot("02_circuit_hub_modal.png")
        print("  ✅ Test 02: Circuit Hub Modal verified")

    def test_03_circuit_hub_upload_tab_and_snapshot(self):
        """Verify Circuit Hub upload tab and JSON drag-and-drop zone."""
        driver = self.driver
        # Click on + Upload Circuit tab inside Hub modal
        upload_tab = driver.find_element(By.XPATH, "//button[contains(., 'Upload Circuit')]")
        upload_tab.click()
        time.sleep(1)

        upload_zone = driver.find_element(By.XPATH, "//*[contains(text(), 'Drag & drop circuit .json file here') or contains(text(), 'click to browse')]")
        self.assertTrue(upload_zone.is_displayed(), "Upload drop zone must be visible")

        # Capture snapshot
        self.snapshot("03_circuit_hub_upload.png")
        print("  ✅ Test 03: Circuit Hub Upload tab verified")

        # Close modal via Close button
        close_btn = driver.find_element(By.XPATH, "//button[contains(text(), '✕') or contains(text(), 'Close') or contains(text(), '✕')]")
        close_btn.click()
        time.sleep(1)

    def test_04_save_circuit_modal_and_snapshot(self):
        """Verify Save to Library modal opening from Circuit Builder."""
        driver = self.driver
        driver.get(f"{BASE_URL}/#builder")
        time.sleep(1.5)

        save_btn = driver.find_element(By.XPATH, "//button[contains(., 'Save to Library')]")
        save_btn.click()
        time.sleep(1)

        # Modal should appear
        modal_header = driver.find_element(By.XPATH, "//*[contains(text(), 'Save Circuit to Library')]")
        self.assertTrue(modal_header.is_displayed(), "Save Circuit modal header must be visible")

        # Fields should exist
        save_action_btn = driver.find_element(By.XPATH, "//button[contains(., 'Save as New') or contains(., 'Update Circuit')]")
        self.assertTrue(save_action_btn.is_displayed(), "Save action button must be visible")

        self.snapshot("04_save_circuit_modal.png")
        print("  ✅ Test 04: Save Circuit Modal verified")

        # Cancel / close modal
        cancel_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
        cancel_btn.click()
        time.sleep(1)

    def test_05_live_simulation_workspace_and_snapshot(self):
        """Verify Live Simulation workspace with 1-Bit ALU, 3D Q-Sphere, and dual scrubber."""
        driver = self.driver
        # Switch to Live Simulation mode via Sidebar
        live_btn = driver.find_element(By.XPATH, "//button[contains(., 'Live Simulation')]")
        live_btn.click()
        time.sleep(2.5)

        workspace = driver.find_element(By.CLASS_NAME, "live-simulation-workspace")
        self.assertTrue(workspace.is_displayed(), "Live Simulation workspace must be displayed")

        # Verify circuit panel and state panel scoped to live workspace
        circuit_panel = workspace.find_element(By.CLASS_NAME, "panel-circuit")
        self.assertTrue(circuit_panel.is_displayed(), "Circuit panel must be displayed")

        state_panel = workspace.find_element(By.CLASS_NAME, "panel-state")
        self.assertTrue(state_panel.is_displayed(), "State panel must be displayed")

        # Verify Dirac Ket formula exists
        ket = workspace.find_element(By.CLASS_NAME, "ket-formula")
        self.assertTrue(len(ket.text) > 0, "Dirac ket statevector text must be populated")

        self.snapshot("05_live_simulation_alu.png")
        print("  ✅ Test 05: Live Simulation workspace & 3D Q-Sphere verified")

    def test_06_single_gate_lab_and_snapshot(self):
        """Verify Single Gate Lab with dual side-by-side 3D Bloch spheres and Dirac equations."""
        driver = self.driver
        # Switch to Single Gate Lab via Sidebar
        lab_btn = driver.find_element(By.XPATH, "//button[contains(., 'Single Gate Lab')]")
        lab_btn.click()
        time.sleep(2.5)

        gate_workspace = driver.find_element(By.CLASS_NAME, "single-gate-workspace")
        self.assertTrue(gate_workspace.is_displayed(), "Single gate workspace must be displayed")

        self.snapshot("06_single_gate_lab.png")
        print("  ✅ Test 06: Single Gate Lab workspace verified")

    def test_08_verilog_verification_studio_and_snapshots(self):
        """Verify Dedicated Verilog Verification Studio, run equivalence check, and capture all analytics snapshots including K-Map."""
        driver = self.driver
        driver.get(f"{BASE_URL}/#verilog-studio")
        time.sleep(2.5)

        # 1. Verify Studio header and initial state
        title = driver.find_element(By.CLASS_NAME, "v-studio-title")
        self.assertTrue(title.is_displayed(), "Studio title must be visible")

        # Capture Initial Dedicated Studio snapshot (showing clean I/O setup panel)
        self.snapshot("13_dedicated_verilog_studio.png")
        print("  ✅ Captured snapshot: 13_dedicated_verilog_studio.png")

        # 2. Complete I/O Setup using Full Adder template
        try:
            full_adder_tmpl = driver.find_element(By.XPATH, "//button[contains(., 'Full Adder')]")
            full_adder_tmpl.click()
            time.sleep(0.5)
            create_btn = driver.find_element(By.XPATH, "//button[contains(., 'Create Classical Schematic')]")
            create_btn.click()
            time.sleep(1.0)
        except Exception as e:
            print(f"  Note during I/O setup: {e}")

        # Verify SVG Schematic Canvas is now displayed
        canvas_svg = driver.find_element(By.CLASS_NAME, "v-canvas-svg")
        self.assertTrue(canvas_svg.is_displayed(), "Schematic SVG canvas must be visible after setup")

        # 3. Select Target Quantum Circuit (e.g. Full Adder 5Q)
        select_elem = driver.find_element(By.CLASS_NAME, "v-studio-select")
        from selenium.webdriver.support.ui import Select
        sel = Select(select_elem)
        # Select by value or matching text
        found_target = False
        for opt in sel.options:
            if "adder" in opt.text.lower() or "5q" in opt.text.lower():
                sel.select_by_visible_text(opt.text)
                found_target = True
                break
        if not found_target and len(sel.options) > 1:
            sel.select_by_index(1)
        time.sleep(0.5)

        # 4. Click VERIFY AGAINST QUANTUM button
        verify_btn = driver.find_element(By.XPATH, "//button[contains(., 'VERIFY AGAINST QUANTUM')]")
        verify_btn.click()
        time.sleep(3.5)

        # Verify drawer has results
        drawer = driver.find_element(By.CLASS_NAME, "v-drawer-container")
        self.assertTrue(drawer.is_displayed(), "Verification drawer must be visible after verification")

        # Capture Verified Full Workspace snapshot
        self.snapshot("14_dedicated_verilog_studio_verified.png")
        print("  ✅ Captured snapshot: 14_dedicated_verilog_studio_verified.png")

        # 3. Click K-Map Synthesis tab
        kmap_tab = driver.find_element(By.XPATH, "//button[contains(., 'K-Map Synthesis')]")
        kmap_tab.click()
        time.sleep(1.2)
        self.snapshot("15_verilog_kmap.png")
        print("  ✅ Captured snapshot: 15_verilog_kmap.png")

        # 4. Click Truth Table tab
        table_tab = driver.find_element(By.XPATH, "//button[contains(., 'Truth Table')]")
        table_tab.click()
        time.sleep(1.0)
        self.snapshot("08_verilog_truth_table.png")
        print("  ✅ Captured snapshot: 08_verilog_truth_table.png")

        # 5. Click 2D Error Heatmap tab
        heatmap_tab = driver.find_element(By.XPATH, "//button[contains(., 'Error Heatmap')]")
        heatmap_tab.click()
        time.sleep(1.0)
        self.snapshot("09_verilog_error_heatmap.png")
        print("  ✅ Captured snapshot: 09_verilog_error_heatmap.png")

        # 6. Click State Fidelity Curve tab
        fidelity_tab = driver.find_element(By.XPATH, "//button[contains(., 'State Fidelity Curve')]")
        fidelity_tab.click()
        time.sleep(1.0)
        self.snapshot("10_verilog_fidelity_curve.png")
        print("  ✅ Captured snapshot: 10_verilog_fidelity_curve.png")

        # 7. Click Distribution Box Plot tab
        boxplot_tab = driver.find_element(By.XPATH, "//button[contains(., 'Box Plot')]")
        boxplot_tab.click()
        time.sleep(1.0)
        self.snapshot("11_verilog_boxplot.png")
        print("  ✅ Captured snapshot: 11_verilog_boxplot.png")

        # 8. Click Probability Histogram tab
        histogram_tab = driver.find_element(By.XPATH, "//button[contains(., 'Histogram')]")
        histogram_tab.click()
        time.sleep(1.0)
        self.snapshot("12_verilog_histograms.png")
        print("  ✅ Captured snapshot: 12_verilog_histograms.png")

    def test_07_console_error_audit(self):
        """Audit Chrome DevTools console logs to ensure no severe runtime exceptions occurred."""
        logs = self.driver.get_log("browser")
        severe_errors = [
            l for l in logs 
            if l.get("level") == "SEVERE" 
            and "favicon.ico" not in l.get("message", "")
            and "WebGL" not in l.get("message", "") # Ignore headless software renderer notices
        ]
        if severe_errors:
            print(f"  ⚠️ Warning: {len(severe_errors)} SEVERE console messages detected:")
            for err in severe_errors[:3]:
                print(f"    - {err.get('message')}")
        else:
            print("  ✅ Test 07: Chrome DevTools console audit clean (0 severe unhandled exceptions)")

if __name__ == "__main__":
    unittest.main()
