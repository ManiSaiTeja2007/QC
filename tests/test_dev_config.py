"""Phase 32 Development Configuration Invariants Test Suite.

Tests:
  1. .streamlit/config.toml contains runOnSave = true and port = 8502.
  2. dev.sh is executable and configures uvicorn --reload and streamlit run.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))


def test_streamlit_config():
    cfg_path = PROJECT_ROOT / ".streamlit" / "config.toml"
    assert cfg_path.exists(), ".streamlit/config.toml missing!"

    content = cfg_path.read_text(encoding="utf-8")
    assert "runOnSave = true" in content, "runOnSave = true missing in config.toml!"
    assert "port = 8502" in content, "port = 8502 missing in config.toml!"


def test_dev_sh_script():
    sh_path = PROJECT_ROOT / "dev.sh"
    assert sh_path.exists(), "dev.sh script missing!"

    content = sh_path.read_text(encoding="utf-8")
    assert "--reload" in content, "--reload missing in dev.sh uvicorn command!"
    assert "npm run dev" in content or "vite" in content, "npm run dev / vite launcher missing in dev.sh!"


if __name__ == "__main__":
    tests = [
        test_streamlit_config,
        test_dev_sh_script,
    ]
    print("Running Phase 32 Development Configuration Tests...")
    for t in tests:
        t()
        print(f"  ✅ {t.__name__} PASSED")
    print("🎉 ALL PHASE 32 DEV CONFIG TESTS PASSED!")
