"""Gear drawn on the animals that wear it: 挽具, 犁, 動物披毯, 馱袋 (data/gear.js).

The animals' own models are not touched. Each animal that can wear something gets a second
geometry, `geometry.kaleidoscope_ranching.<id>.gear`, drawn over it by its own render
controller with its own texture:

  * it repeats the animal's skeleton down to the torso (same bone names, parents and pivots,
    no cubes), so the walk and sleep animations move the gear with the body;
  * each kind of gear is a bone `gear_<kind>` under the torso (`gear_<kind>_baby` under the
    young animal's torso), shown while the synced property `kaleidoscope_ranching:gear_<kind>`
    is true (core/gear.js sets it);
  * the plough stands on the ground behind the buffalo in a bone of its own with no parent, so
    it stays put when the buffalo lies down; the chains to it hide while the buffalo sleeps.

Every piece is fitted to the model as it is when this runs: cubes are measured from the torso
(and whatever sits on it: hump, wool, hair skirt) and stand clear of it by `inflate`, so gear
follows when an animal is reshaped. Run by `npm run generate` after tools/gen_sleep.mjs.

Writes, per animal with gear:
  packs/RP/models/entity/<id>.gear.geo.json
  packs/RP/textures/entity/ranching/gear/<id>.png
  packs/RP/render_controllers/<id>.gear.render_controllers.json
and adds the geometry, texture and render controller to packs/RP/entity/<id>.entity.json.
"""
import json
import math
import re
import subprocess

from autouv import fit
from boxuv import RP, Painter

ROOT = RP.parents[1]
NS = "kaleidoscope_ranching"
NOT_BODY = re.compile(r"head|leg|tail|udder|saddle|lids|horn|tusk|beard|ear|wing|beak|comb")

# How far each layer stands off the body. All different, so no two layers share a plane.
OFF_CLOTH, OFF_GIRTH, OFF_STRAP, OFF_TRACE, OFF_COLLAR = 0.45, 0.6, 0.7, 0.8, 1.0


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def gear_table():
    """data/gear.js as [{id, animals, babies}]."""
    script = "import(process.argv[1]).then(m => console.log(JSON.stringify(m.GEAR)))"
    url = (ROOT / "packs" / "BP" / "scripts" / "data" / "gear.js").as_uri()
    return json.loads(subprocess.run(["node", "-e", script, url], check=True, capture_output=True, text=True).stdout)


# --- Measuring the animal -------------------------------------------------------


class Body:
    """The boxes that make up an animal's trunk, adult or young: (x0, y0, z0, x1, y1, z1)."""

    def __init__(self, bones, baby, bare=False, saddle=False, male=False):
        """`bare`: leave out wool (bones named wool*), as on a sheared sheep. `saddle`: count
        the saddle as part of the trunk, so cloth goes over it. `male`: the adult male's trunk
        (his m_ bones, such as the bull buffalo's hump, in place of the female's fa_ ones); the
        default is the female's, so nothing of the male's makes gear float on a female."""
        by_name = {b["name"]: b for b in bones}

        def chain(name):
            while name:
                yield name
                name = by_name[name].get("parent")

        self.torso_bone = "b_torso" if baby else "a_torso"
        self.boxes = []
        main = []
        for bone in bones:
            names = list(chain(bone["name"]))
            if saddle and "saddle" in names:
                pass
            elif any(NOT_BODY.search(n) for n in names):
                continue
            if bare and any(n.startswith("wool") for n in names):
                continue
            if any(n.startswith("fa_" if male else "m_") for n in names):
                continue
            young = any(n.startswith("b_") for n in names)
            if young != baby:
                continue
            for cube in bone.get("cubes", []):
                grow = cube.get("inflate", 0)
                box = tuple(v - grow for v in cube["origin"]) + tuple(o + s + grow for o, s in zip(cube["origin"], cube["size"]))
                self.boxes.append(box)
                if bone["name"] == self.torso_bone:
                    main.append(box)
        if not main:
            raise SystemExit(f"gear: no cubes in {self.torso_bone}")
        # The trunk proper: the biggest cube of the torso bone, on whole pixels.
        x0, y0, z0, x1, y1, z1 = max(main, key=lambda b: (b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]))
        self.x0, self.y0, self.z0 = math.floor(x0), math.floor(y0), math.floor(z0)
        self.x1, self.y1, self.z1 = math.ceil(x1), math.ceil(y1), math.ceil(z1)

    def within(self, y=(-1e9, 1e9), z=(-1e9, 1e9)):
        """The trunk's boxes cut down to a slab of y and z, on whole pixels, biggest first;
        boxes lying wholly inside another are dropped."""
        out = []
        for x0, y0, z0, x1, y1, z1 in self.boxes:
            y0, y1, z0, z1 = max(y0, y[0]), min(y1, y[1]), max(z0, z[0]), min(z1, z[1])
            box = (math.floor(x0), math.floor(y0), math.floor(z0), math.ceil(x1), math.ceil(y1), math.ceil(z1))
            if y1 - y0 >= 0.5 and z1 - z0 >= 0.5 and box not in out:
                out.append(box)
        out.sort(key=lambda b: (-(b[3] - b[0]) * (b[4] - b[1]) * (b[5] - b[2]), b))
        inside = lambda a, b: all(a[k] >= b[k] for k in range(3)) and all(a[k] <= b[k] for k in range(3, 6))
        return [a for n, a in enumerate(out) if not any(inside(a, b) for b in out[:n])]

    def around(self, y=(-1e9, 1e9), z=(-1e9, 1e9)):
        """One box round everything in the slab."""
        boxes = self.within(y, z)
        return tuple(min(b[k] for b in boxes) for k in range(3)) + tuple(max(b[k] for b in boxes) for k in range(3, 6))


def cube(name, box, inflate=None):
    x0, y0, z0, x1, y1, z1 = box
    tidy = lambda v: int(round(v, 4)) if round(v, 4) == int(round(v, 4)) else round(v, 4)
    out = (name, [tidy(x0), tidy(y0), tidy(z0)], [tidy(x1 - x0), tidy(y1 - y0), tidy(z1 - z0)])
    return out + (inflate,) if inflate else out


def drape(body, name, y_from, z, inflate):
    """Cloth lying over the trunk from `y_from` up, between two z: one cube over each box of
    the trunk there, so humps and wool are covered too. Cubes reaching the lower edge are
    `<name>_hem`, the ones riding on top `<name>_top`."""
    return [cube(f"{name}_hem" if box[1] <= y_from else f"{name}_top", box, inflate) for box in body.within((y_from, 1e9), z)]


# --- The four kinds ---------------------------------------------------------------


def blanket(body, whole=False):
    """A cloth over the back, from behind the shoulders to the rump, hanging over the flanks.
    `whole`: one piece over everything there (the pig's saddle and its side straps), so
    nothing pokes through it."""
    height = body.y1 - body.y0
    y_from, z = body.y0 + round(height * 0.4), (body.z0 + 3, body.z1 - 1)
    if whole:
        return [cube("blanket_hem", body.around((y_from, 1e9), z), OFF_CLOTH)]
    return drape(body, "blanket", y_from, z, OFF_CLOTH)


def trace_height(body):
    return body.y0 + round((body.y1 - body.y0) * 0.45)


def harness(body):
    """A padded collar round the shoulders with a wooden yoke on it, a girth behind the front
    legs, and a trace along each flank."""
    front, rear = body.z0, body.z1
    cx0, cy0, _, cx1, cy1, _ = body.around(z=(front + 1, front + 3))
    gx0, gy0, _, gx1, gy1, _ = body.around(z=(front + 8, front + 9))
    y = trace_height(body)
    return [
        cube("collar", (cx0, cy0, front + 1, cx1, cy1, front + 3), OFF_COLLAR),
        cube("yoke", (cx0 - 2, cy1, front + 1, cx1 + 2, cy1 + 2, front + 3)),
        cube("girth", (gx0, gy0, front + 8, gx1, gy1, front + 9), OFF_GIRTH),
        cube("trace", (body.x1 - 1 + OFF_TRACE, y, front + 3, body.x1 + OFF_TRACE, y + 1, rear - 2)),
        cube("trace", (body.x0 - OFF_TRACE, y, front + 3, body.x0 + 1 - OFF_TRACE, y + 1, rear - 2)),
    ]


PLOUGH_REACH = 6  # how far behind the rump the swingletree hangs


def plough_chains(body):
    """Chains from the ends of the traces back to the plough's swingletree."""
    rear, y = body.z1, trace_height(body)
    return [
        cube("chain", (body.x1 - 1 + OFF_TRACE, y, rear - 2, body.x1 + OFF_TRACE, y + 1, rear + PLOUGH_REACH)),
        cube("chain", (body.x0 - OFF_TRACE, y, rear - 2, body.x0 + 1 - OFF_TRACE, y + 1, rear + PLOUGH_REACH)),
    ]


def plough(body):
    """A wooden plough on the ground behind the animal: swingletree, beam, an upright into the
    iron share, and a handle."""
    z, y = body.z1 + PLOUGH_REACH, trace_height(body)
    return [
        cube("swingletree", (body.x0 - 1, y, z, body.x1 + 1, y + 1, z + 1)),
        cube("beam", (-1, y - 1, z + 1, 1, y + 1, z + 10)),
        cube("upright", (-1, 2, z + 7, 1, y - 1, z + 9)),
        cube("share", (-1.5, 0, z + 4, 1.5, 2, z + 10)),
        cube("share_tip", (-0.5, 0, z + 2, 0.5, 1, z + 4)),
        cube("mouldboard", (1.5, 1, z + 6, 2.5, 4, z + 10)),
        cube("handle", (-0.5, y + 1, z + 9, 0.5, y + 7, z + 10)),
        cube("grip", (-2.5, y + 7, z + 9, 2.5, y + 8, z + 10)),
    ]


def pack_bag(body):
    """A felt pad over the back, a leather bag on each flank held by two straps, and a rolled
    felt tied on top."""
    top = body.y1
    mid = round(body.z0 + (body.z1 - body.z0) * 0.58)
    low, high = top - 9, top - 2
    out = drape(body, "pad", top - 5, (mid - 6, mid + 6), OFF_CLOTH)
    side = body.around(y=(low, high), z=(mid - 4, mid + 4))
    out += [
        cube("bag", (side[3], low, mid - 4, side[3] + 3, high, mid + 4)),
        cube("bag", (side[0] - 3, low, mid - 4, side[0], high, mid + 4)),
    ]
    for z in (mid - 3, mid + 2):
        x0, _, _, x1, y1, _ = body.around(y=(low, 1e9), z=(z, z + 1))
        out.append(cube("strap", (x0, low, z, x1, y1, z + 1), OFF_STRAP))
    roll_y = body.around(y=(low, 1e9), z=(mid - 2, mid + 2))[4] + OFF_CLOTH
    out.append(cube("roll", (body.x0 + 1, roll_y, mid - 2, body.x1 - 1, roll_y + 2, mid + 2)))
    return out


# --- Painting ----------------------------------------------------------------------

RED, RED_DK, GOLD, GOLD_DK = (182, 50, 44), (140, 32, 36), (222, 178, 78), (176, 128, 48)
LEATHER, LEATHER_DK, LEATHER_LT = (126, 82, 48), (88, 54, 32), (166, 118, 74)
WOOD, WOOD_DK, WOOD_LT = (158, 114, 66), (118, 82, 46), (188, 146, 92)
IRON, IRON_DK, IRON_LT = (150, 150, 158), (92, 92, 100), (204, 204, 212)
FELT, FELT_DK = (216, 204, 178), (176, 162, 134)
SIDES = ("north", "south", "east", "west")


def woven(a, b):
    return lambda f, i, j, w, h, fi: a if (i + j) % 2 else mix(a, b, 0.3)


def blanket_hem(f, i, j, w, h, fi):
    if f == "bottom":
        return RED_DK
    if f in SIDES:
        if j == h - 1:
            return GOLD
        if j == h - 2:
            return RED_DK
        if h >= 6 and j == h - 4:
            return GOLD if i % 2 == 0 else RED
        if f in ("east", "west") and i in (1, w - 2):
            return GOLD_DK
    elif j in (1, h - 2):  # the same two bands crossing the back
        return GOLD_DK
    return RED if (i + j) % 2 else mix(RED, RED_DK, 0.3)


def pad_hem(f, i, j, w, h, fi):
    if f in SIDES and j == h - 1:
        return RED_DK
    return FELT if (i + j) % 2 else FELT_DK


def leather(f, i, j, w, h, fi):
    return LEATHER_DK if (i + j) % 3 == 0 else LEATHER


def collar(f, i, j, w, h, fi):
    if f in ("north", "south"):  # the padded faces: a stitched edge
        edge = min(i, j, w - 1 - i, h - 1 - j)
        return LEATHER_LT if edge == 0 and (i + j) % 2 == 0 else LEATHER
    return LEATHER_LT if (f in ("east", "west") and j % 3 == 1 and i == 0) else (LEATHER_DK if (i + j) % 4 == 0 else LEATHER)


def girth(f, i, j, w, h, fi):
    if f in ("east", "west") and abs(j - h // 2) <= 1:
        return IRON_LT if j == h // 2 else IRON  # buckle
    return LEATHER_DK


def trace(f, i, j, w, h, fi):
    along = i if f in ("east", "west") else j
    length = w if f in ("east", "west") else h
    if f in ("north", "south"):
        return IRON
    return IRON if along in (0, length - 1) else (LEATHER_DK if along % 4 == 2 else LEATHER)


def chain(f, i, j, w, h, fi):
    along = i if f in ("east", "west") else j
    return IRON if along % 2 == 0 else IRON_DK


def grain(f, i, j, w, h, fi):
    """Wood with the grain along the longer side of each face."""
    k = j if w >= h else i
    end = (i in (0, w - 1)) if w >= h else (j in (0, h - 1))
    return WOOD_DK if end else (WOOD_LT if k % 3 == 0 and (i + j) % 5 == 0 else (WOOD if k % 2 == 0 else mix(WOOD, WOOD_DK, 0.4)))


def iron(f, i, j, w, h, fi):
    if f == "top":
        return IRON_LT if j == 0 or i == 0 else IRON
    return IRON_DK if j == h - 1 else (IRON_LT if j == 0 and i % 2 == 0 else IRON)


BAG, BAG_DK, BAG_LT = (190, 142, 88), (126, 84, 48), (220, 178, 122)


def bag(f, i, j, w, h, fi):
    if f in ("top", "bottom"):
        return BAG_DK
    if j < 3:  # the flap
        if f in ("east", "west") and j == 2 and abs(i - (w - 1) / 2) < 1:
            return GOLD  # buckle
        return BAG_DK if j == 2 else mix(BAG, BAG_DK, 0.6)
    if i in (0, w - 1) or j == h - 1:
        return BAG_DK
    if f in ("east", "west") and abs(i - (w - 1) / 2) < 1 and j < 5:
        return BAG_DK  # the buckle's strap
    return BAG_LT if (i + 2 * j) % 7 == 0 else BAG


def roll(f, i, j, w, h, fi):
    if f in ("east", "west"):  # the rolled ends: a spiral
        return FELT_DK if (i + j) % 2 == 0 else FELT
    return LEATHER_DK if i in (2, w - 3) else (FELT if j % 2 == 0 else FELT_DK)


PAINT = {
    "blanket_hem": blanket_hem, "blanket_top": woven(RED, RED_DK),
    "pad_hem": pad_hem, "pad_top": woven(FELT, FELT_DK),
    "collar": collar, "yoke": grain, "girth": girth, "trace": trace, "chain": chain,
    "swingletree": grain, "beam": grain, "upright": grain, "handle": grain, "grip": grain,
    "share": iron, "share_tip": iron, "mouldboard": iron,
    "bag": bag, "strap": leather, "roll": roll,
}

# What each piece is made of, for the Vibrant Visuals materials (tools/gen_pbr.py reads the
# face rectangles from tools/fragments/gear/<animal>.materials.json). Iron and brass fittings
# painted on leather (buckles, trace ends) are told apart there by colour.
MATERIAL = {
    "blanket_hem": "cloth", "blanket_top": "cloth", "pad_hem": "cloth", "pad_top": "cloth", "roll": "cloth",
    "collar": "skin", "girth": "skin", "trace": "skin", "bag": "skin", "strap": "skin",
    "yoke": "wood", "swingletree": "wood", "beam": "wood", "upright": "wood", "handle": "wood", "grip": "wood",
    "chain": "metal", "share": "metal", "share_tip": "metal", "mouldboard": "metal",
}

BUILD = {"blanket": blanket, "harness": harness, "plough": plough, "pack_bag": pack_bag}


# --- Assembly ----------------------------------------------------------------------


MALE = f"q.property('{NS}:sex') == 'male'"


def sexed(bones, baby):
    """[(body, extra visibility rule, bone name suffix)]: one fitting for both sexes, or, where
    the adult male's trunk differs (the bull buffalo's hump), one for the female and one for the
    male, each shown only on its own sex."""
    female = Body(bones, baby)
    if baby:
        return [(female, "", "")]
    male = Body(bones, baby, male=True)
    if male.boxes == female.boxes:
        return [(female, "", "")]
    return [(female, f" && !({MALE})", ""), (male, f" && {MALE}", "_male")]


def build(animal, kinds, bones):
    """(geometry bones as dicts, part visibility, painter, texture size) for one animal.
    `kinds` are the animal's rows of data/gear.js."""
    by_name = {b["name"]: b for b in bones}
    prop = lambda kind: f"q.property('{NS}:gear_{kind}')"
    groups = []  # (bone name, parent, pivot, cubes, visibility)
    for gear in kinds:
        kind = gear["id"]
        for baby in ([False, True] if gear["babies"] else [False]):
            body = Body(bones, baby)
            name = f"gear_{kind}" + ("_baby" if baby else "")
            age = "q.is_baby" if baby else "!q.is_baby"
            if kind == "plough":
                groups.append((name, None, [0, 0, body.z1 + PLOUGH_REACH], plough(body), f"{prop(kind)} && {age}"))
                groups.append((f"{name}_chains", body.torso_bone, by_name[body.torso_bone]["pivot"], plough_chains(body),
                               f"{prop(kind)} && {age} && !q.property('{NS}:sleeping')"))
            elif kind == "blanket":
                # Variants for what else the animal has on its back: the main controller hides
                # the wool when sheared and shows the saddle when saddled; the blanket follows.
                pivot = by_name[body.torso_bone]["pivot"]
                woolly = any(b["name"].startswith("wool") for b in bones)
                saddled = not baby and "saddle" in by_name
                plain = [f"{prop(kind)} && {age}"]
                if woolly:
                    plain.append("!q.is_sheared")
                    groups.append((f"{name}_sheared", body.torso_bone, pivot, blanket(Body(bones, baby, bare=True)),
                                   f"{prop(kind)} && {age} && q.is_sheared"))
                if saddled:
                    plain.append("!q.is_saddled")
                    groups.append((f"{name}_saddled", body.torso_bone, pivot, blanket(Body(bones, baby, saddle=True), whole=True),
                                   f"{prop(kind)} && {age} && q.is_saddled"))
                for fit_body, rule, suffix in sexed(bones, baby):
                    groups.append((name + suffix, body.torso_bone, pivot, blanket(fit_body), " && ".join(plain) + rule))
            else:
                for fit_body, rule, suffix in sexed(bones, baby):
                    groups.append((name + suffix, body.torso_bone, by_name[body.torso_bone]["pivot"], BUILD[kind](fit_body),
                                   f"{prop(kind)} && {age}{rule}"))

    placed, size = fit([c for _, _, _, cubes, _ in groups for c in cubes])
    it = iter(placed)
    groups = [(name, parent, pivot, [next(it) for _ in cubes], rule) for name, parent, pivot, cubes, rule in groups]

    # The animal's own bones from each gear bone up to the root, as they are in its model.
    needed = []
    for _, parent, _, _, _ in groups:
        line = []
        while parent:
            line.append(parent)
            parent = by_name[parent].get("parent")
        needed += [n for n in reversed(line) if n not in needed]
    out = []
    for bone in bones:
        if bone["name"] in needed:
            out.append({k: bone[k] for k in ("name", "parent", "pivot", "rotation") if k in bone})
    for name, parent, pivot, cubes, _ in groups:
        out.append({"name": name, **({"parent": parent} if parent else {}), "pivot": pivot,
                    "cubes": [{"origin": c[1], "size": c[2], "uv": c[3], **({"inflate": c[4]} if len(c) > 4 else {})} for c in cubes]})

    painter = Painter(size, size, [(name, parent, pivot, cubes) for name, parent, pivot, cubes, _ in groups], f"gear_{animal}")
    for name in painter.cubes:
        painter.paint(name, PAINT[name], amt=5)
    return out, [{name: rule} for name, _, _, _, rule in groups], painter, size


def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8", newline="\n")


def main():
    table = gear_table()
    animals = sorted({a for gear in table for a in gear["animals"]})
    for animal in animals:
        kinds = [gear for gear in table if animal in gear["animals"]]
        model = json.loads((RP / "models" / "entity" / f"{animal}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
        bones, visibility, painter, size = build(animal, kinds, model["bones"])
        dump(RP / "models" / "entity" / f"{animal}.gear.geo.json", {"format_version": "1.12.0", "minecraft:geometry": [{
            "description": {"identifier": f"geometry.{NS}.{animal}.gear", "texture_width": size, "texture_height": size,
                            "visible_bounds_width": 5, "visible_bounds_height": 3, "visible_bounds_offset": [0, 1, 0]},
            "bones": bones}]})
        painter.save(RP / "textures" / "entity" / "ranching" / "gear" / f"{animal}.png")
        rects = {}
        for name, cubes in sorted(painter.cubes.items()):
            for faces in cubes:
                rects.setdefault(MATERIAL[name], []).extend(list(r) for _, r in sorted(faces.items()))
        dump(ROOT / "tools" / "fragments" / "gear" / f"{animal}.materials.json",
             {"texture": f"entity/ranching/gear/{animal}", "size": [size, size], "materials": rects})
        controller = f"controller.render.{NS}.{animal}.gear"
        dump(RP / "render_controllers" / f"{animal}.gear.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
            controller: {"geometry": "Geometry.gear", "materials": [{"*": "Material.default"}], "textures": ["Texture.gear"],
                         "part_visibility": [{"*": True}, *visibility]}}})

        # The client entity draws the gear layer only while the animal wears something.
        path = RP / "entity" / f"{animal}.entity.json"
        entity = json.loads(path.read_text(encoding="utf8"))
        description = entity["minecraft:client_entity"]["description"]
        description["geometry"]["gear"] = f"geometry.{NS}.{animal}.gear"
        description["textures"]["gear"] = f"textures/entity/ranching/gear/{animal}"
        key = lambda entry: entry if isinstance(entry, str) else next(iter(entry))
        worn = " || ".join(f"q.property('{NS}:gear_{gear['id']}')" for gear in kinds)
        description["render_controllers"] = [e for e in description["render_controllers"] if key(e) != controller] + [{controller: worn}]
        dump(path, entity)
    print("gear:", ", ".join(animals))


if __name__ == "__main__":
    main()
