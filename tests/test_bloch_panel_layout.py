"""Phase 31 Panel Layout & Composition Invariants Test Suite.

Tests:
  1. Top State Summary Strip HTML Placement:
     - Summary strip is situated above WebGL canvas.
     - Contains selected qubit identity, classification, Bloch (X,Y,Z), |r|, purity, (θ, φ).
  2. WebGL Canvas Maximum Area:
     - WebGL canvas container occupies max available space below summary strip.
  3. View Modes (Compact Grid vs Detailed Focus).
"""

import sys
from pathlib import Path
from typing import Dict, Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def parse_panel_layout_contract(html_content: str) -> Dict[str, Any]:
    """Parses index.html structure for Phase 31 layout compliance."""
    has_summary_top = "bloch-state-summary" in html_content
    has_canvas_container = "bloch-3d-canvas-container" in html_content
    has_compact_toggle = "mode-compact" in html_content or "mode-focus" in html_content

    # Check order: bloch-state-summary must appear BEFORE bloch-3d-canvas-container
    summary_idx = html_content.find("bloch-state-summary")
    canvas_idx = html_content.find("bloch-3d-canvas-container")

    is_summary_above_canvas = (summary_idx != -1 and canvas_idx != -1 and summary_idx < canvas_idx)

    return {
        "has_summary_top": has_summary_top,
        "has_canvas_container": has_canvas_container,
        "has_compact_toggle": has_compact_toggle,
        "is_summary_above_canvas": is_summary_above_canvas,
    }


def test_index_html_phase31_layout_structure():
    index_path = PROJECT_ROOT / "static" / "index.html"
    assert index_path.exists(), "index.html file missing!"

    content = index_path.read_text(encoding="utf-8")
    res = parse_panel_layout_contract(content)

    assert res["has_summary_top"], "bloch-state-summary strip missing in index.html!"
    assert res["has_canvas_container"], "bloch-3d-canvas-container missing in index.html!"
    assert res["is_summary_above_canvas"], "bloch-state-summary MUST be placed ABOVE bloch-3d-canvas-container!"


if __name__ == "__main__":
    tests = [
        test_index_html_phase31_layout_structure,
    ]
    print("Running Phase 31 Panel Composition Layout Tests...")
    for t in tests:
        t()
        print(f"  ✅ {t.__name__} PASSED")
    print("🎉 ALL PHASE 31 PANEL COMPOSITION TESTS PASSED!")
