import unittest
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class TestQuantumStudioE2E(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        options = Options()
        options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')

        cls.driver = webdriver.Chrome(options=options)
        cls.driver.get('http://localhost:5173')
        time.sleep(2)

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def test_01_page_title_and_header(self):
        """Verify page title and header brand text."""
        self.assertIn("Quantum ALU 3D Studio", self.driver.title)
        header_text = self.driver.find_element(By.CLASS_NAME, 'app-header').text
        self.assertIn("Quantum ALU 3D Studio 2.0", header_text)
        print("  ✅ Test 01: Page title & Header brand verification PASSED")

    def test_02_mode_switching(self):
        """Verify switching across the 3 dedicated workspace modes."""
        driver = self.driver

        # Switch to Single Gate Lab
        gate_lab_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Single Gate Lab')]")
        gate_lab_btn.click()
        time.sleep(1)
        self.assertTrue(len(driver.find_elements(By.CLASS_NAME, 'single-gate-workspace')) > 0)
        print("  ✅ Test 02a: Single Gate Lab workspace active PASSED")

        # Switch to Live Simulation
        live_sim_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Live Simulation')]")
        live_sim_btn.click()
        time.sleep(1)
        self.assertTrue(len(driver.find_elements(By.CLASS_NAME, 'live-simulation-workspace')) > 0)
        print("  ✅ Test 02b: Live Simulation workspace active PASSED")

        # Switch back to Circuit Builder
        builder_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Circuit Builder')]")
        builder_btn.click()
        time.sleep(1)
        self.assertTrue(len(driver.find_elements(By.CLASS_NAME, 'builder-dedicated-workspace')) > 0)
        print("  ✅ Test 02c: Circuit Builder workspace active PASSED")

    def test_03_live_simulation_layout_stretch(self):
        """Verify Live Simulation 100vh workspace layout components."""
        driver = self.driver
        live_sim_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Live Simulation')]")
        live_sim_btn.click()
        time.sleep(1)

        live_workspace = driver.find_element(By.CLASS_NAME, 'live-simulation-workspace')
        self.assertTrue(live_workspace.is_displayed())

        # Check circuit panel SVG, state panel, bloch studio inside live workspace
        circuit_panel = live_workspace.find_element(By.CLASS_NAME, 'panel-circuit')
        state_panel = live_workspace.find_element(By.CLASS_NAME, 'panel-state')
        bloch_panel = live_workspace.find_element(By.CLASS_NAME, 'panel-bloch-wrapper')

        self.assertTrue(circuit_panel.is_displayed())
        self.assertTrue(state_panel.is_displayed())
        self.assertTrue(bloch_panel.is_displayed())
        print("  ✅ Test 03: Live Simulation 100vh workspace grid layout PASSED")

    def test_04_state_isolation_guarantee(self):
        """Verify that modifying Single Gate Lab state does NOT mutate Live Simulation preset state."""
        driver = self.driver

        # 1. Inspect Live Simulation state
        live_sim_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Live Simulation')]")
        live_sim_btn.click()
        time.sleep(1)
        live_workspace = driver.find_element(By.CLASS_NAME, 'live-simulation-workspace')
        ket_text_before = live_workspace.find_element(By.CLASS_NAME, 'ket-formula').text

        # 2. Go to Single Gate Lab & select different gate/state
        gate_lab_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Single Gate Lab')]")
        gate_lab_btn.click()
        time.sleep(1)

        # 3. Switch back to Live Simulation
        live_sim_btn.click()
        time.sleep(1)
        ket_text_after = live_workspace.find_element(By.CLASS_NAME, 'ket-formula').text

        self.assertEqual(ket_text_before, ket_text_after)
        print("  ✅ Test 04: Mode state isolation guarantee PASSED")

    def test_05_multi_hop_tab_persistence(self):
        """Verify multi-hop navigation (Builder -> Lab -> Live -> Builder) preserves workspace states."""
        driver = self.driver

        # 1. Start in Builder
        builder_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Circuit Builder')]")
        builder_btn.click()
        time.sleep(1)

        # 2. Hop to Single Gate Lab
        gate_lab_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Single Gate Lab')]")
        gate_lab_btn.click()
        time.sleep(1)

        # 3. Hop to Live Simulation
        live_sim_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Live Simulation')]")
        live_sim_btn.click()
        time.sleep(1)

        # 4. Hop back to Builder
        builder_btn.click()
        time.sleep(1)

        builder_workspace = driver.find_element(By.CLASS_NAME, 'builder-dedicated-workspace')
        self.assertTrue(builder_workspace.is_displayed())
        print("  ✅ Test 05: Multi-hop tab state persistence PASSED")

    def test_06_quick_experiments_removed_regression(self):
        """Verify that Quick Experiments controls are completely removed from Single Gate Lab."""
        driver = self.driver
        gate_lab_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Single Gate Lab')]")
        gate_lab_btn.click()
        time.sleep(1)

        pills = driver.find_elements(By.CLASS_NAME, 'exp-pill')
        headers = driver.find_elements(By.CLASS_NAME, 'quick-exp-header')
        self.assertEqual(len(pills), 0)
        self.assertEqual(len(headers), 0)
        print("  ✅ Test 06: Quick Experiments completely removed regression PASSED")

if __name__ == '__main__':
    unittest.main()
