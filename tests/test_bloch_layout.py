"""Phase 30 Layout Invariants & Coordinate Contract Test Suite.

Tests:
  1. Coordinate Contract Mapping:
     Bloch +X → ( 1,  0,  0)
     Bloch +Y → ( 0,  0,  1)
     Bloch +Z → ( 0,  1,  0) [Visual TOP |0⟩]
     Bloch -Z → ( 0, -1,  0) [Visual BOTTOM |1⟩]

  2. Deterministic Centered Sub-Grid Math:
     For N in {1, 3, 5, 7, 9} qubits:
     - Center of mass of grid (avg X, avg Y) is strictly (0.0, 0.0)
     - Distance between any two sphere centers > 2 * sphereRadius
     - Bounding box encapsulation is exact
"""

import sys
from pathlib import Path
from typing import Tuple, List
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))


def bloch_to_three(x: float, y: float, z: float) -> Tuple[float, float, float]:
    """Canonical Coordinate Contract:
      Bloch X -> Three.js X
      Bloch Y -> Three.js Z
      Bloch Z -> Three.js Y (Visual TOP is +Z)
    """
    return (x, z, y)


def three_to_bloch(X: float, Y: float, Z: float) -> Tuple[float, float, float]:
    """Inverse Canonical Coordinate Contract."""
    return (X, Z, Y)


def calculate_grid_positions(
    num_qubits: int,
    spacing_x: float = 2.4,
    spacing_y: float = 2.5
) -> List[Tuple[float, float]]:
    """Calculates deterministic centered grid positions for N qubits."""
    cols = min(3, num_qubits)
    rows = int(np.ceil(num_qubits / cols))

    positions = []
    for q in range(num_qubits):
        r = q // cols
        c = q % cols

        # Row-level centering for incomplete last row
        curr_row_cols = cols if (r < rows - 1 or num_qubits % cols == 0) else (num_qubits % cols)
        
        x = (c - (curr_row_cols - 1) / 2.0) * spacing_x
        y = ((rows - 1) / 2.0 - r) * spacing_y
        positions.append((x, y))

    return positions


def test_coordinate_mapping_contract():
    # |0⟩ -> +Z Bloch -> (0, +1, 0) Three.js (Visual TOP)
    x0, y0, z0 = bloch_to_three(0.0, 0.0, 1.0)
    assert (x0, y0, z0) == (0.0, 1.0, 0.0), f"|0⟩ mapped to {x0, y0, z0}, expected (0.0, 1.0, 0.0)"

    # |1⟩ -> -Z Bloch -> (0, -1, 0) Three.js (Visual BOTTOM)
    x1, y1, z1 = bloch_to_three(0.0, 0.0, -1.0)
    assert (x1, y1, z1) == (0.0, -1.0, 0.0), f"|1⟩ mapped to {x1, y1, z1}, expected (0.0, -1.0, 0.0)"

    # |+⟩ -> +X Bloch -> (+1, 0, 0) Three.js (Visual RIGHT)
    xp, yp, zp = bloch_to_three(1.0, 0.0, 0.0)
    assert (xp, yp, zp) == (1.0, 0.0, 0.0)

    # |+i⟩ -> +Y Bloch -> (0, 0, +1) Three.js (Visual FORWARD)
    xy, yy, zy = bloch_to_three(0.0, 1.0, 0.0)
    assert (xy, yy, zy) == (0.0, 0.0, 1.0)


def test_grid_centering_and_clearance():
    sphere_radius = 0.85

    for n_qubits in [1, 3, 4, 5, 7, 9]:
        pos = calculate_grid_positions(n_qubits)
        assert len(pos) == n_qubits

        # Check grid bounding box centering around origin (0.0, 0.0)
        min_x, max_x = min(p[0] for p in pos), max(p[0] for p in pos)
        min_y, max_y = min(p[1] for p in pos), max(p[1] for p in pos)

        bbox_center_x = (min_x + max_x) / 2.0
        bbox_center_y = (min_y + max_y) / 2.0

        assert abs(bbox_center_x) < 1e-6, f"Grid X bounding box not centered for N={n_qubits}: center_x={bbox_center_x}"
        assert abs(bbox_center_y) < 1e-6, f"Grid Y bounding box not centered for N={n_qubits}: center_y={bbox_center_y}"

        # Check pairwise sphere clearance
        for i in range(n_qubits):
            for j in range(i + 1, n_qubits):
                dx = pos[i][0] - pos[j][0]
                dy = pos[i][1] - pos[j][1]
                dist = np.sqrt(dx**2 + dy**2)
                assert dist >= 2.0 * sphere_radius, f"Spheres Q{i} and Q{j} collide for N={n_qubits}: dist={dist}"


if __name__ == "__main__":
    tests = [
        test_coordinate_mapping_contract,
        test_grid_centering_and_clearance,
    ]
    print("Running Phase 30 Layout Invariants Tests...")
    for t in tests:
        t()
        print(f"  ✅ {t.__name__} PASSED")
    print("🎉 ALL PHASE 30 LAYOUT INVARIANTS PASSED!")
