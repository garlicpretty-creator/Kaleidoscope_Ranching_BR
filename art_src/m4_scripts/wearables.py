"""What the player sees when wearing Ranching's clothes: 毛帽, 圍巾, 皮圍裙.

Each worn item gets an attachable (packs/RP/attachables/<id>.json) with its own geometry and
texture. The geometry's bones are named after the player's (root > waist > body > head, with
the player's pivots), so the game moves each cube with the body part it sits on. Everything is
drawn a little clear of the skin and its outer layer (0.25 on the body, 0.5 on the head), so no
part of the player is hidden to make room.

  wool_hat       a knitted cap: ribbed pale cuff, red crown stepped in at the top, a pom-pom
  wool_scarf     a blue wrap under the chin, knotted in front, one end down the chest and one
                 down the back, striped and fringed at the ends
  leather_apron  a bib and a skirt of tan leather with a pocket, a waist tie knotted behind and
                 a strap round the neck

Run by `npm run generate` (tools/generate.mjs); writes straight into packs/RP:
  attachables/<id>.json, models/entity/wearable_<id>.geo.json,
  textures/entity/ranching/wearables/<id>.png, render_controllers/wearable.render_controllers.json
"""
import json

from autouv import fit
from boxuv import RP, Painter, geo

NS = "kaleidoscope_ranching"
CONTROLLER = f"controller.render.{NS}.wearable"

# The player's own bones (name, parent, pivot) down to the ones clothes sit on.
PLAYER = [("root", None, [0, 0, 0]), ("waist", "root", [0, 12, 0]), ("body", "waist", [0, 24, 0]), ("head", "body", [0, 24, 0])]


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


# --- 毛帽 -------------------------------------------------------------------------

HAT_RED, HAT_RED_DK = (198, 46, 44), (160, 30, 36)
CUFF, CUFF_DK = (236, 236, 230), (198, 202, 208)

HAT = {
    "head": [
        ("cuff", [-5.5, 29, -5.5], [11, 2, 11]),
        ("crown", [-5, 31, -5], [10, 3, 10]),
        ("cap", [-4, 34, -4], [8, 1, 8]),
        ("pom", [-1.5, 35, -1.5], [3, 2, 3]),
    ],
}


def paint_hat(p):
    # Ribbing: the cuff's sides alternate light and shadow column by column.
    p.paint("cuff", lambda f, i, j, w, h, fi: CUFF if f in ("top", "bottom") or i % 2 == 0 else CUFF_DK, amt=3)
    # Knit rows on the crown, a darker row where it meets the cuff.
    def knit(f, i, j, w, h, fi):
        if f in ("top", "bottom"):
            return HAT_RED if (i + j) % 2 else mix(HAT_RED, HAT_RED_DK, 0.35)
        return HAT_RED_DK if j == h - 1 else (HAT_RED if (i + j) % 2 else mix(HAT_RED, HAT_RED_DK, 0.3))
    p.paint("crown", knit, amt=4)
    p.paint("cap", lambda f, i, j, w, h, fi: HAT_RED if (i + j) % 2 else mix(HAT_RED, HAT_RED_DK, 0.3), amt=4)
    p.paint("pom", lambda f, i, j, w, h, fi: CUFF if (i + j) % 2 == 0 else CUFF_DK, amt=3)


# --- 圍巾 -------------------------------------------------------------------------

SCARF, SCARF_DK, SCARF_LT = (58, 108, 178), (40, 78, 140), (150, 190, 228)

SCARF_CUBES = {
    "body": [
        ("wrap", [-4.5, 21.75, -3], [9, 2, 6]),
        ("knot", [0.75, 21.25, -3.6], [3, 3, 1]),
        ("front_end", [1.25, 14.5, -3.4], [2, 7, 1]),
        ("back_end", [-3.25, 15.75, 2.4], [2, 6, 1]),
    ],
}


def paint_scarf(p):
    # The wrap: soft folds running round the neck.
    p.paint("wrap", lambda f, i, j, w, h, fi: SCARF_DK if f == "bottom" else (SCARF if (j + (i // 3)) % 2 == 0 else mix(SCARF, SCARF_DK, 0.45)), amt=4)
    p.paint("knot", lambda f, i, j, w, h, fi: mix(SCARF, SCARF_DK, 0.25 if (i + j) % 2 else 0.6) if 0 < i < w - 1 or f not in ("north", "south") else SCARF_DK, amt=4)

    def end(f, i, j, w, h, fi):
        if f == "top":
            return SCARF
        if f == "bottom":
            return SCARF_DK
        if j == h - 1:  # fringe: every other thread
            return SCARF_LT if (i + (f in ("east", "west"))) % 2 == 0 else None
        if j in (h - 3, h - 5):
            return SCARF_LT
        return SCARF if i % 2 == 0 else mix(SCARF, SCARF_DK, 0.35)
    p.paint("front_end", end, amt=4)
    p.paint("back_end", end, amt=4)


# --- 皮圍裙 ------------------------------------------------------------------------

LEATHER, LEATHER_DK, LEATHER_LT = (164, 116, 72), (112, 74, 44), (198, 152, 104)
STITCH, STRAP, STRAP_DK = (196, 156, 108), (96, 62, 38), (70, 44, 28)

APRON = {
    "body": [
        ("skirt", [-4.5, 9, -3.5], [9, 8, 1]),
        ("bib", [-3, 17, -3.3], [6, 5, 1]),
        ("pocket", [-2, 11, -3.8], [4, 3, 1]),
        ("tie", [-4.5, 15, -3], [9, 1, 6]),
        ("bow", [-1.5, 14.5, 2.6], [3, 2, 1]),
        ("strap", [-3, 22, -3.3], [1, 2, 1]),
        ("strap", [2, 22, -3.3], [1, 2, 1]),
        ("neck", [-3, 22, 2.3], [6, 2, 1]),
    ],
}


def paint_apron(p):
    def hide(f, i, j, w, h, fi):
        """Worn leather: lighter where it bulges, creases lower down, a stitched hem."""
        if f in ("east", "west", "top", "bottom"):
            return LEATHER_DK
        if f == "south":
            return mix(LEATHER_DK, LEATHER, 0.3)
        edge = i in (0, w - 1) or j == h - 1
        if edge:
            return LEATHER_DK
        if (i in (1, w - 2) and j % 2 == 0) or (j == h - 2 and i % 2 == 1):
            return STITCH
        c = mix(LEATHER, LEATHER_LT, 0.5 if abs(i - (w - 1) / 2) < w / 4 and j < h * 0.6 else 0.0)
        return mix(c, LEATHER_DK, 0.25) if (i * 3 + j * 5) % 7 == 0 else c
    p.paint("skirt", hide, amt=5)

    def bib(f, i, j, w, h, fi):
        if f != "north":
            return LEATHER_DK
        if i in (0, w - 1) or j == 0:
            return LEATHER_DK
        if j == 1 and i % 2 == 1:
            return STITCH
        return mix(LEATHER, LEATHER_LT, 0.35 if 1 < i < w - 2 else 0.0)
    p.paint("bib", bib, amt=5)

    def pocket(f, i, j, w, h, fi):
        if f != "north":
            return LEATHER_DK
        if j == 0:
            return LEATHER_LT
        return LEATHER_DK if i in (0, w - 1) or j == h - 1 else mix(LEATHER, LEATHER_DK, 0.35)
    p.paint("pocket", pocket, amt=4)
    p.paint("tie", lambda f, i, j, w, h, fi: STRAP_DK if f in ("top", "bottom") else (STRAP if i % 3 else STRAP_DK), amt=4)
    p.paint("bow", lambda f, i, j, w, h, fi: STRAP_DK if i == w // 2 else mix(STRAP, LEATHER, 0.3), amt=4)
    p.paint("strap", lambda f, i, j, w, h, fi: STRAP if j % 2 == 0 else STRAP_DK, amt=4)
    p.paint("neck", lambda f, i, j, w, h, fi: STRAP_DK if f in ("top", "bottom") else STRAP, amt=4)


WEARABLES = {
    "wool_hat": (HAT, paint_hat),
    "wool_scarf": (SCARF_CUBES, paint_scarf),
    "leather_apron": (APRON, paint_apron),
}


def bones_of(parts):
    """The player's bone chain down to the deepest bone used, with the cubes laid out."""
    flat = [cube for cubes in parts.values() for cube in cubes]
    placed, size = fit(flat)
    it = iter(placed)
    by_bone = {bone: [next(it) for _ in cubes] for bone, cubes in parts.items()}
    deepest = max(i for i, (name, _, _) in enumerate(PLAYER) if name in parts)
    return [(name, parent, pivot, by_bone.get(name, [])) for name, parent, pivot in PLAYER[: deepest + 1]], size


def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8", newline="\n")


def build(item):
    """(bones, texture size, painter) for one worn item; the preview uses this too."""
    parts, paint = WEARABLES[item]
    bones, size = bones_of(parts)
    painter = Painter(size, size, bones, f"wearable_{item}")
    paint(painter)
    return bones, size, painter


# --- In the hand ------------------------------------------------------------------
#
# An attachable replaces the item everywhere it is equipped, the hands included, so the
# clothes are drawn only in their own armour slot. In a hand the item shows its icon as a
# flat sprite one texel thick (like a vanilla held item): one row of cubes per run of opaque
# icon pixels, each face sampling the icon, in a bone bound to whichever bone holds it.

SLOT = {"wool_hat": "head", "wool_scarf": "chest", "leather_apron": "chest"}
HELD = f"controller.render.{NS}.wearable_held"
PIXEL = 0.5  # model units per icon pixel: 16 pixels make an 8-unit sprite


def icon_image(item):
    """The icon the game will show: the picked RetroDiffusion art (tools/art/rd_icons.py
    applies it later in `npm run generate`), else the one already in the pack."""
    from PIL import Image
    picked = RP.parents[1] / "art" / "icons" / f"{item}.png"
    path = picked if picked.exists() else RP / "textures" / "items" / "ranching" / f"{item}.png"
    return Image.open(path).convert("RGBA").resize((16, 16), Image.NEAREST)


def held_geometry(item):
    icon = icon_image(item)
    w, h = icon.size
    cubes = []
    for y in range(h):
        x = 0
        while x < w:
            if icon.getpixel((x, y))[3] < 128:
                x += 1
                continue
            start = x
            while x < w and icon.getpixel((x, y))[3] >= 128:
                x += 1
            n = x - start
            # The sprite stands upright facing -z; icon row 0 is its top. As in box UV, the
            # first texel column of north, up and down lies at the smallest x, so icon column c
            # sits at x = c - 8 and north shows the icon as drawn; south shows its mirror. The
            # smallest-x side face ("east" in Bedrock's naming) takes the run's first pixel.
            cubes.append({
                "origin": [(start - w / 2) * PIXEL, (h - 1 - y) * PIXEL, -PIXEL / 2],
                "size": [n * PIXEL, PIXEL, PIXEL],
                "uv": {
                    "north": {"uv": [start, y], "uv_size": [n, 1]},
                    "south": {"uv": [x, y], "uv_size": [-n, 1]},
                    "up": {"uv": [start, y], "uv_size": [n, 1]},
                    "down": {"uv": [start, y + 1], "uv_size": [n, -1]},
                    "east": {"uv": [start, y], "uv_size": [1, 1]},
                    "west": {"uv": [x - 1, y], "uv_size": [1, 1]},
                },
            })
    return {"format_version": "1.16.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.{NS}.wearable.{item}.held", "texture_width": w, "texture_height": h,
                        "visible_bounds_width": 1, "visible_bounds_height": 1, "visible_bounds_offset": [0, 0.25, 0]},
        "bones": [{"name": "held", "binding": HELD_BINDING, "pivot": [0, 0, 0], "cubes": cubes}]}]}


# In a hand the item shows its icon, anywhere else (an armor slot) the worn model. The game's
# name for an armor slot is not documented and the chest slot did not match 'chest', so only
# the two hand slots are named. The held geometry is bound even while worn, and
# q.item_slot_to_bone_name of an armor slot names a bone a persona skin lacks, so bind to the
# hand bones every player rig has.
IN_HAND = "c.item_slot == 'main_hand' || c.item_slot == 'off_hand'"
HELD_BINDING = "c.item_slot == 'off_hand' ? 'leftitem' : 'rightitem'"

def main():
    for item in WEARABLES:
        bones, size, painter = build(item)
        dump(RP / "models" / "entity" / f"wearable_{item}.geo.json", geo(f"wearable.{item}", size, size, bones, bounds=(2, 3)))
        dump(RP / "models" / "entity" / f"wearable_{item}_held.geo.json", held_geometry(item))
        painter.save(RP / "textures" / "entity" / "ranching" / "wearables" / f"{item}.png")
        slot = SLOT[item]
        dump(RP / "attachables" / f"{item}.json", {"format_version": "1.10.0", "minecraft:attachable": {"description": {
            "identifier": f"{NS}:{item}",
            "materials": {"default": "armor", "held": "entity_alphatest"},
            "textures": {"default": f"textures/entity/ranching/wearables/{item}", "held": f"textures/items/ranching/{item}"},
            "geometry": {"default": f"geometry.{NS}.wearable.{item}", "held": f"geometry.{NS}.wearable.{item}.held"},
            "render_controllers": [{CONTROLLER: f"!({IN_HAND})"}, {HELD: IN_HAND}],
        }}})
    dump(RP / "render_controllers" / "wearable.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        CONTROLLER: {"geometry": "Geometry.default", "materials": [{"*": "Material.default"}], "textures": ["Texture.default"]},
        HELD: {"geometry": "Geometry.held", "materials": [{"*": "Material.held"}], "textures": ["Texture.held"]}}})
    print("wearables:", ", ".join(WEARABLES))


if __name__ == "__main__":
    main()
