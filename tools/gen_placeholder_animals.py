"""Stand-in looks for animals whose real art is not made yet (M4).

Duck and goose borrow the chicken model, buffalo and yak the cow model, with
their textures recoloured and the whole animal scaled, so they can spawn,
breed and be tested in game before work package B delivers the real models.

A species is skipped as soon as tools/gen_art.py writes a real model for it
(packs/RP/models/entity/<id>.geo.json), so this script never overwrites art.
Its outputs are the client entity and the three recoloured textures.
"""

import colorsys
import json
import os
import sys

from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
RP = os.path.join(ROOT, "packs", "RP")


def recolor(hue=None, sat=1.0, val=1.0, keep_reds=False):
    """A per-pixel HSV transform. `keep_reds` leaves combs, wattles and beaks alone."""

    def apply(r, g, b):
        h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        is_red = s > 0.45 and (h < 0.06 or h > 0.94)
        if keep_reds and is_red:
            return r, g, b
        if hue is not None:
            h = hue
        s, v = min(1.0, s * sat if s > 0.08 else max(s, 0.25 * sat)), min(1.0, v * val)
        r, g, b = colorsys.hsv_to_rgb(h, s, v)
        return round(r * 255), round(g * 255), round(b * 255)

    return apply


PLACEHOLDERS = {
    # id: (model it borrows, per-texture recolour, adult scale, spawn egg colours)
    "duck": ("chicken", {"female": recolor(hue=0.08, sat=1.6, val=0.78), "male": recolor(hue=0.33, sat=1.8, val=0.62, keep_reds=True),
                         "baby": recolor(hue=0.14, sat=2.2, val=1.0)}, 1.0, ("#9C7A54", "#2F7A3C")),
    "goose": ("chicken", {"female": recolor(sat=0.15, val=0.98, keep_reds=True), "male": recolor(sat=0.15, val=0.92, keep_reds=True),
                          "baby": recolor(hue=0.15, sat=1.4, val=0.95)}, 1.3, ("#E8E4DA", "#E08A2C")),
    "buffalo": ("cow", {"female": recolor(sat=0.25, val=0.42), "male": recolor(sat=0.25, val=0.36), "baby": recolor(sat=0.3, val=0.55)},
                1.15, ("#3E3E44", "#9A8F80")),
    "yak": ("cow", {"female": recolor(hue=0.07, sat=1.2, val=0.5), "male": recolor(hue=0.07, sat=1.2, val=0.42),
                    "baby": recolor(hue=0.08, sat=1.0, val=0.62)}, 1.1, ("#4A3526", "#D8CFC0")),
}


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def main():
    written = []
    for animal, (base, colours, scale, egg) in PLACEHOLDERS.items():
        if os.path.exists(os.path.join(RP, "models", "entity", f"{animal}.geo.json")):
            continue  # real art exists
        for name, transform in colours.items():
            image = Image.open(os.path.join(RP, "textures", "entity", "ranching", base, f"{name}.png")).convert("RGBA")
            pixels = image.load()
            for y in range(image.height):
                for x in range(image.width):
                    r, g, b, a = pixels[x, y]
                    if a:
                        pixels[x, y] = (*transform(r, g, b), a)
            out = os.path.join(RP, "textures", "entity", "ranching", animal, f"{name}.png")
            os.makedirs(os.path.dirname(out), exist_ok=True)
            image.save(out)

        with open(os.path.join(RP, "entity", f"{base}.entity.json"), encoding="utf8") as f:
            client = json.load(f)
        desc = client["minecraft:client_entity"]["description"]
        desc["identifier"] = f"kaleidoscope_ranching:{animal}"
        desc["textures"] = {name: f"textures/entity/ranching/{animal}/{name}" for name in colours}
        male_scale = desc["scripts"]["scale"]  # the borrowed model's male size rule
        desc["scripts"]["scale"] = f"({male_scale}) * {scale}"
        desc["spawn_egg"] = {"base_color": egg[0], "overlay_color": egg[1]}
        write_json(os.path.join(RP, "entity", f"{animal}.entity.json"), client)
        written.append(animal)
    print(f"gen_placeholder_animals: {', '.join(written) or 'nothing (all animals have real art)'}")


if __name__ == "__main__":
    sys.exit(main())
