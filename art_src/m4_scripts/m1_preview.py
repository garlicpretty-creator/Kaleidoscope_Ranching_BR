"""Preview sheets of the animals as the pack ships them, drawn from packs/RP with the renderer
of sleep_preview.py: female, male (at his in-game scale), baby and one variant per species.

Run after `npm run generate` (or tools/gen_art.py + tools/gen_sleep.mjs):
    python art_src/m4_scripts/m1_preview.py                 docs/art/m1_animals_preview.png and
                                                            docs/art/m1_variants_preview.png
    python art_src/m4_scripts/m1_preview.py out.png cow     only these species
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

import sleep_preview as sp

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "art"
TILE = 380
# species: (pixels per model pixel, [(label, render options)])
SHEET = {
    "cow": (9, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
    "sheep": (10, [("female", {}), ("male", {"male": True, "texture": "male_white"}), ("baby", {"baby": True}),
                     ("sheared", {"sheared": True})]),
    "goat": (10, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
    "pig": (11, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
    "chicken": (17, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
    "rabbit": (20, [("brown", {"texture": "brown"}), ("male (brown)", {"male": True, "texture": "brown"}),
                    ("baby", {"baby": True, "texture": "brown"}), ("white", {"texture": "white"})]),
    "buffalo": (9, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
    "yak": (9, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
    "duck": (20, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
    "goose": (16, [("female", {}), ("male", {"male": True, "texture": "male"}), ("baby", {"baby": True})]),
}
M1 = ["cow", "sheep", "goat", "pig", "chicken", "rabbit"]
BG = (232, 238, 226)


def male_scale(animal):
    """The scale the client entity gives an adult male (packs/RP/entity/<id>.entity.json)."""
    rig = ROOT / "art" / "animals" / animal / "rig.json"
    if rig.exists():
        return json.loads(rig.read_text(encoding="utf8"))["scale_male"]
    return 1.15


def tile(animal, label, scale, opts):
    o = dict(opts)
    baby = o.pop("baby", False)
    k = male_scale(animal) if o.get("male") else 1.0
    img = sp.render(animal, baby, False, tile=TILE, scale=scale, model_scale=k, ground=0.8, **o)
    ImageDraw.Draw(img).text((8, 6), f"{animal} / {label}", fill=(60, 70, 56))
    return img


def sheet(animals):
    out = Image.new("RGB", (TILE * 4, TILE * len(animals)), BG)
    for row, animal in enumerate(animals):
        scale, cols = SHEET[animal]
        for col, (label, opts) in enumerate(cols):
            out.paste(tile(animal, label, scale, opts), (col * TILE, row * TILE))
    return out


def variants():
    """Every sheep wool colour (ewes) and every rabbit coat, smaller."""
    entity = lambda a: json.loads((sp.RP / "entity" / f"{a}.entity.json").read_text())["minecraft:client_entity"]["description"]["textures"]
    wool = [k for k in entity("sheep") if k.startswith("female_")]
    coats = list(entity("rabbit"))
    t, per = 240, 8
    rows = -(-len(wool) // per) + -(-len(coats) // per)
    out = Image.new("RGB", (t * per, t * rows), BG)
    n = 0
    for animal, keys, scale in (("sheep", wool, 7.0), ("rabbit", coats, 13.0)):
        n = -(-n // per) * per
        for key in keys:
            img = sp.render(animal, False, False, tile=t, scale=scale, texture=key)
            ImageDraw.Draw(img).text((6, 4), f"{animal} / {key}", fill=(60, 70, 56))
            out.paste(img, ((n % per) * t, (n // per) * t))
            n += 1
    return out


def main():
    if len(sys.argv) > 1:
        sheet(sys.argv[2:] or M1).save(sys.argv[1])
        print("wrote", sys.argv[1])
        return
    sheet(M1).save(DOCS / "m1_animals_preview.png")
    variants().save(DOCS / "m1_variants_preview.png")
    print("wrote m1_animals_preview.png, m1_variants_preview.png")


if __name__ == "__main__":
    main()
