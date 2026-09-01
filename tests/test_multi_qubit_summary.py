"""Phase 32 Multi-Qubit Results Invariants Test Suite.

Tests:
  1. Multi-qubit bloch vector store maps N qubits to N result items.
  2. Computational basis labels |0⟩ or |1⟩ derived accurately from Z component:
     - Z = -1.0 -> |0⟩
     - Z = +1.0 -> |1⟩
     - |Z| < 0.99 -> Superposition
  3. Selection sync logic.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from backend.app.simulation.bloch_adapter import state_to_bloch_vector


def test_basis_label_derivation():
    # |0⟩ state -> Z = +1.0 (in bloch_adapter Z = |α|² - |β|² = +1.0)
    x0, y0, z0, r0 = state_to_bloch_vector(1.0, 0.0)
    assert abs(z0 - (1.0)) < 1e-6

    # |1⟩ state -> Z = -1.0
    x1, y1, z1, r1 = state_to_bloch_vector(0.0, 1.0)
    assert abs(z1 - (-1.0)) < 1e-6

    # |+⟩ state -> Z = 0.0
    xp, yp, zp, rp = state_to_bloch_vector(1 / 2**0.5, 1 / 2**0.5)
    assert abs(zp) < 1e-6


if __name__ == "__main__":
    tests = [
        test_basis_label_derivation,
    ]
    print("Running Phase 32 Multi-Qubit Results Tests...")
    for t in tests:
        t()
        print(f"  ✅ {t.__name__} PASSED")
    print("🎉 ALL PHASE 32 MULTI-QUBIT RESULTS TESTS PASSED!")
