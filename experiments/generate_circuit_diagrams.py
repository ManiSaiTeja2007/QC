"""Generate and Export Circuit Diagrams for all Paper Architectures.

Exports circuit diagrams for:
  - Figure 4: FALFG NCV Gate
  - Figure 5: FALFG Clifford+T Gate
  - Figure 7: 1-Bit ALU NCV
  - Figure 8: 1-Bit ALU Clifford+T
  - Figure 9: Bennett's Uncomputed Adder/Subtractor
  - Figure 10: 4-Bit Scalable ALU Architecture
"""

import os
import sys
from pathlib import Path
import matplotlib.pyplot as plt

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.modules.falfg import build_falfg_ncv, build_falfg_clifford_t
from src.modules.one_bit_alu import build_one_bit_alu_ncv, build_one_bit_alu_clifford_t
from src.modules.uncomputation import build_uncomputed_adder_subtractor
from src.modules.n_bit_alu import build_4bit_alu


def generate_all_diagrams():
    circuits_dir = PROJECT_ROOT / "results" / "circuits"
    circuits_dir.mkdir(parents=True, exist_ok=True)

    circuits = {
        "fig4_falfg_ncv": build_falfg_ncv(),
        "fig5_falfg_clifford_t": build_falfg_clifford_t(),
        "fig7_1bit_alu_ncv": build_one_bit_alu_ncv(),
        "fig8_1bit_alu_clifford_t": build_one_bit_alu_clifford_t(),
        "fig9_uncomputed_adder_subtractor": build_uncomputed_adder_subtractor(),
        "fig10_4bit_alu": build_4bit_alu(),
    }

    print("Generating and exporting circuit diagrams...")
    for name, qc in circuits.items():
        # 1. Text format
        text_path = circuits_dir / f"{name}.txt"
        with open(text_path, "w") as f:
            f.write(qc.draw(output="text").__str__())
        print(f"  [SAVED TEXT]    {text_path.name}")

        # 2. Matplotlib PNG format
        png_path = circuits_dir / f"{name}.png"
        try:
            fig = qc.draw(output="mpl", style="iqp")
            fig.savefig(png_path, dpi=300, bbox_inches="tight")
            plt.close(fig)
            print(f"  [SAVED PNG]     {png_path.name}")
        except Exception as e:
            print(f"  [PNG FALLBACK]  Could not generate PNG for {name}: {e}")

    print("\nAll circuit diagrams exported successfully to results/circuits/")


if __name__ == "__main__":
    generate_all_diagrams()
