"""Close-up preview of the eggs' looks in the nest box and incubator (1.1 蛋的進度).

Renders the models in art/blocks/ with preview.py at a larger scale, one tile per case:
  the nest box with eggs at each stage, the same eggs candled, and the incubator cold (lamp
  off), warm (lamp on) and candled. Slot 1 is the most advanced egg (tools/gen_blocks.mjs).

Run with: python art_src/m4_scripts/egg_preview.py [out.png]   (default docs/art/egg_stages_preview.png)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

import preview

ROOT = Path(__file__).resolve().parents[2]
STAGES = ["egg_1_hatch", "egg_2_crack", "egg_3"]  # big cracks, small cracks, plain
CANDLED = ["egg_1_lit", "egg_1_embryo_2", "egg_2_lit", "egg_2_embryo_1", "egg_3_lit", "egg_3_embryo_0"]
CASES = [
    ("nest box: big cracks, small cracks, plain, stored", "nest_box", STAGES + ["egg_4"]),
    ("nest box candled: three brooded eggs lit", "nest_box", CANDLED + ["egg_4"]),
    ("incubator cold: lamp off, paused", "incubator", STAGES),
    ("incubator warm: lamp on", "incubator", ["busy"] + STAGES),
    ("incubator candled", "incubator", ["busy"] + CANDLED),
]
SCALE, TILE = 26, 620
CROP = {"nest_box": (110, 150, 510, 470), "incubator": (110, 90, 510, 410)}


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs" / "art" / "egg_stages_preview.png"
    preview.SCALE, preview.TILE = SCALE, TILE
    w, h = 400, 320
    cols = 3
    sheet = Image.new("RGB", (cols * w, ((len(CASES) + cols - 1) // cols) * (h + 20)), (232, 238, 226))
    draw = ImageDraw.Draw(sheet)
    for n, (label, block, bones) in enumerate(CASES):
        x, y = (n % cols) * w, (n // cols) * (h + 20)
        sheet.paste(preview.render(block, bones).crop(CROP[block]), (x, y + 20))
        draw.text((x + 6, y + 4), label, fill=(50, 60, 50))
    sheet.save(out)
    print("egg_preview:", out)


if __name__ == "__main__":
    main()
