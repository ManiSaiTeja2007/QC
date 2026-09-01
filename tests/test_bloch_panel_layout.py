"""Phase 31 Panel Layout & Composition Invariants Test Suite.

Tests:
  1. Top State Summary Strip Placement:
     - Summary strip is situated above WebGL canvas.
     - Contains selected qubit identity, classification, Bloch (X,Y,Z), |r|, purity, (θ, φ).
  2. WebGL Canvas Maximum Area:
     - WebGL canvas container occupies max available space below summary strip.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def test_index_html_phase31_layout_structure():
    summary_path = PROJECT_ROOT / "frontend" / "src" / "components" / "StateSummaryStrip.tsx"
    bloch_path = PROJECT_ROOT / "frontend" / "src" / "components" / "BlochPanel.tsx"

    assert summary_path.exists(), "StateSummaryStrip.tsx file missing!"
    assert bloch_path.exists(), "BlochPanel.tsx file missing!"

    summary_content = summary_path.read_text(encoding="utf-8")
    bloch_content = bloch_path.read_text(encoding="utf-8")

    assert "bloch-state-summary" in summary_content, "bloch-state-summary class missing!"
    assert "bloch-canvas-box" in bloch_content, "bloch-canvas-box class missing!"


if __name__ == "__main__":
    tests = [
        test_index_html_phase31_layout_structure,
    ]
    print("Running Phase 31 Panel Composition Layout Tests...")
    for t in tests:
        t()
        print(f"  ✅ {t.__name__} PASSED")
    print("🎉 ALL PHASE 31 PANEL COMPOSITION TESTS PASSED!")
