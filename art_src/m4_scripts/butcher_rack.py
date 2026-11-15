"""Hand-made butcher rack built from the animals' own models.

The carcass is the animal itself, hung head down by the hind legs from the hook, so the
player sees what they put up. Butchering starts with the skin. The block shows three bones
per species (packs/BP/blocks/r_butcher_rack.json, written by tools/gen_blocks.mjs):

  carcass_<x>  the adult animal, own geometry and own texture (hide, wool or feathers on)
  skinned_<x>  same body once every `skin: true` cut is taken: headless, dressed meat
               (plucked skin for birds, pink rind for the pig); birds keep their feet
  cut_<x>      the rear half that is left after half the strokes, with a cut face of
               fat rim, marbled meat and bone where the body was cut through

Geometry comes straight from packs/RP/models/entity/<x>.geo.json (adult and female bones),
scaled to fit under the hook and turned by the carcass bone. All the animal textures plus
their dressed copies are packed into one block texture, so faces use per-face UVs.

Writes art/blocks/butcher_rack.{geo.json,png}; tools/gen_m3_art.py installs them.
"""
import json
from pathlib import Path
from PIL import Image
from boxuv import Painter, faces
from blocks_m4 import wood, mix, WOOD, WOOD_DK

ROOT = Path(__file__).resolve().parents[2]
RP = ROOT / "packs" / "RP"
NS = "kaleidoscope_ranching"
TW, TH = 512, 512
HANG = 25  # where the hind legs meet the gambrel
TURN = 90  # bone rotation about x that swings the lying animal head down
MAX_DROP = 23  # longest a carcass may hang (pixels), so big ones clear the floor

# species: (texture, kind, flesh)
SPECIES = {
    "cow": ("cow/female", "red", (176, 64, 58)),
    "buffalo": ("buffalo/female", "red", (150, 50, 48)),
    "yak": ("yak/female", "red", (158, 56, 52)),
    "pig": ("pig/female", "pork", (240, 170, 160)),
    "sheep": ("sheep/female_white", "red", (184, 82, 76)),
    "goat": ("goat/female", "red", (172, 74, 68)),
    "chicken": ("chicken/female", "bird", (246, 214, 184)),
    "duck": ("duck/female", "bird", (240, 202, 170)),
    "goose": ("goose/female", "bird", (246, 220, 190)),
    "rabbit": ("rabbit/brown", "red", (204, 108, 100)),
}
SKIP_PREFIX = ("m_", "b_", "wool_")  # males' extras, baby rigs, sheep wool (taken as its own cut)
SKIP = {"saddle"}

FAT, BONE = (248, 236, 214), (240, 234, 220)
IRON, IRON_DK, IRON_LT = (150, 150, 158), (92, 92, 100), (200, 200, 208)

FRAME = [
    ("post", [-8, 0, -1], [2, 30, 2], [0, 0]),
    ("post", [6, 0, -1], [2, 30, 2], [0, 0]),
    ("beam", [-8, 28, -1.5], [16, 2, 3], [8, 0]),
    ("foot", [-8, 0, -4], [2, 1, 8], [8, 6]),
    ("foot", [6, 0, -4], [2, 1, 8], [8, 6]),
    ("hook", [-0.5, 26, -0.5], [1, 2, 1], [28, 6]),
    ("gambrel", [-4, 25, -0.5], [8, 1, 1], [8, 16]),
]


def h32(*a):
    h = 2166136261
    for v in a:
        for ch in str(v):
            h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h


# --- textures -------------------------------------------------------------------


def dressed(src, kind, flesh):
    """The animal's texture recoloured as a dressed carcass, keeping its shading."""
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    sp, op = src.load(), out.load()
    lums = [sum(sp[x, y][:3]) / 765 for y in range(src.height) for x in range(src.width) if sp[x, y][3]]
    mean = sum(lums) / max(1, len(lums))
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = sp[x, y]
            if not a:
                continue
            k = max(0.82, min(1.14, 1.0 + 0.5 * ((r + g + b) / 765 - mean)))
            c = flesh
            if kind == "red" and (y + h32("row", x // 4) % 2) % 5 == 0 and h32(x // 3, y) % 3:
                c = mix(flesh, FAT, 0.7)  # fat seams
            elif kind == "bird" and h32(x, y) % 7 == 0:
                c = mix(flesh, (200, 140, 110), 0.3)  # goosebumps
            elif kind == "pork" and h32(x, y) % 11 == 0:
                c = mix(flesh, (200, 120, 116), 0.4)  # pores
            op[x, y] = tuple(min(255, int(v * k)) for v in c) + (255,)
    return out


def cut_face(flesh, n=16):
    """Cross-section of the body: fat rim, marbled lean, bone in the middle."""
    img = Image.new("RGBA", (n, n))
    for y in range(n):
        for x in range(n):
            if x in (0, n - 1) or y in (0, n - 1):
                c = FAT
            elif abs(x - (n - 1) / 2) <= 1.5 and abs(y - (n - 1) / 2) <= 1.5:
                c = BONE
            elif h32("m", x, y) % 6 == 0:
                c = mix(flesh, FAT, 0.6)
            else:
                c = mix(flesh, (60, 10, 14), 0.08 * (h32("d", x, y) % 3))
            img.putpixel((x, y), c + (255,))
    return img


class Atlas:
    def __init__(self):
        self.img = Image.new("RGBA", (TW, TH), (0, 0, 0, 0))
        self.x = self.y = self.row = 0

    def add(self, im):
        if self.x + im.width > TW:
            self.x, self.y, self.row = 0, self.y + self.row, 0
        if self.y + im.height > TH:
            raise SystemExit("butcher_rack: atlas full")
        at = (self.x, self.y)
        self.img.alpha_composite(im, at)
        self.x += im.width
        self.row = max(self.row, im.height)
        return at


# --- geometry -------------------------------------------------------------------


def adult_cubes(sp):
    """Cubes of the adult (female) model, each tagged with whether it belongs to the head
    or a leg, from packs/RP/models/entity/<sp>.geo.json."""
    g = json.loads((RP / "models" / "entity" / f"{sp}.geo.json").read_text(encoding="utf8"))["minecraft:geometry"][0]
    bones = {b["name"]: b for b in g["bones"]}

    def chain(name):
        while name:
            yield name
            name = bones[name].get("parent")

    out = []
    for b in g["bones"]:
        names = list(chain(b["name"]))
        if any(n.startswith(SKIP_PREFIX) or n in SKIP for n in names):
            continue
        for c in b.get("cubes", []):
            out.append(dict(c, head="head" in names, leg=any("leg" in n for n in names),
                            mirror=c.get("mirror", b.get("mirror", False))))
    return out, (g["description"]["texture_width"], g["description"]["texture_height"])


def face_uvs(c, at, tex_scale):
    """Per-face UVs equal to the cube's box UV, moved to the cube's place in the atlas."""
    ox, oy = at
    sx, sy = tex_scale
    rects = faces(c["uv"], c["size"])
    if c["mirror"]:
        rects["east"], rects["west"] = rects["west"], rects["east"]
    uv = {}
    for f, (x, y, w, h) in rects.items():
        u, v, us, vs = ox + x * sx, oy + y * sy, w * sx, h * sy
        if c["mirror"]:
            u, us = u + us, -us
        if f == "bottom":
            v, vs = v + vs, -vs
        uv[f] = {"uv": [round(u, 4), round(v, 4)], "uv_size": [round(us, 4), round(vs, 4)]}
    return uv


def bedrock(uv):
    """Per-face UV keys as Bedrock names them (up/down for top/bottom)."""
    return {{"top": "up", "bottom": "down"}.get(f, f): v for f, v in uv.items()}


def clip_rear(c, uv, zcut, cut_uv):
    """Keeps the part of a lying cube behind zcut (toward the tail), with a cut face in front."""
    z0, d = c["origin"][2], c["size"][2]
    f = (z0 + d - zcut) / d
    o, s = list(c["origin"]), list(c["size"])
    o[2], s[2] = zcut, z0 + d - zcut
    uv = json.loads(json.dumps(uv))
    for name, k in (("east", 0), ("west", 0), ("top", 1), ("bottom", 1)):
        (u, v), (us, vs) = uv[name]["uv"], uv[name]["uv_size"]
        if k == 0:  # horizontal axis runs along z: the head end is at high u on east, low u on west
            keep = us * f
            if (name == "east") == (us > 0):
                uv[name] = {"uv": [u, v], "uv_size": [keep, vs]}
            else:
                uv[name] = {"uv": [u + us - keep, v], "uv_size": [keep, vs]}
        else:  # rows run from the tail to the head
            if vs > 0:
                uv[name] = {"uv": [u, v], "uv_size": [us, vs * f]}
            else:
                uv[name] = {"uv": [u, v + vs * (1 - f)], "uv_size": [us, vs * f]}
    uv["north"] = cut_uv
    return dict(c, origin=o, size=s), uv


def place(c, s, yc, zmax):
    """Lying model space -> the space under the carcass bone (scaled, tail at the pivot)."""
    o, sz = c["origin"], c["size"]
    return {
        "origin": [round(o[0] * s, 4), round(HANG + (o[1] - yc) * s, 4), round((o[2] - zmax) * s, 4)],
        "size": [round(v * s, 4) for v in sz],
        **({"inflate": round(c["inflate"] * s, 4)} if c.get("inflate") else {}),
    }


def build():
    atlas = Atlas()
    frame_p = Painter(64, 32, [("frame", None, [0, 0, 0], FRAME)], "rack_frame")
    frame_p.paint("post", wood(WOOD_DK, rings=WOOD))
    frame_p.paint("beam", wood(WOOD))
    frame_p.paint("foot", wood(WOOD_DK))
    for n in ("hook", "gambrel"):
        frame_p.paint(n, lambda f, i, j, w, h, fi: IRON_LT if f == "top" else IRON if i == 0 else IRON_DK)
    fx, fy = atlas.add(frame_p.img)
    bones = [{"name": "frame", "pivot": [0, 0, 0],
              "cubes": [{"origin": o, "size": s, "uv": bedrock({f: {"uv": [fx + x, fy + y + (h if f == "bottom" else 0)],
                                                           "uv_size": [w, -h if f == "bottom" else h]}
                                                       for f, (x, y, w, h) in faces(uv, s).items()})}
                        for _, o, s, uv in FRAME]}]

    for sp, (tex, kind, flesh) in SPECIES.items():
        cubes, (tw, th) = adult_cubes(sp)
        src = Image.open(RP / "textures" / "entity" / "ranching" / f"{tex}.png").convert("RGBA")
        scale = (src.width / tw, src.height / th)
        at_skin = atlas.add(src)
        at_meat = atlas.add(dressed(src, kind, flesh))
        cx, cy = atlas.add(cut_face(flesh))
        cut_uv = {"uv": [cx, cy], "uv_size": [16, 16]}

        zs = [v for c in cubes for v in (c["origin"][2], c["origin"][2] + c["size"][2])]
        ys = [v for c in cubes for v in (c["origin"][1], c["origin"][1] + c["size"][1])]
        zmin, zmax = min(zs), max(zs)
        s = min(1.0, MAX_DROP / (zmax - zmin))
        body = [c for c in cubes if not c["head"] and not c["leg"]] or cubes
        yc = (min(c["origin"][1] for c in body) + max(c["origin"][1] + c["size"][1] for c in body)) / 2
        zcut = zmax - (zmax - min(c["origin"][2] for c in cubes if not c["head"])) / 2

        def cube_json(c, at, uv=None):
            return {**place(c, s, yc, zmax), "uv": bedrock(uv or face_uvs(c, at, scale))}

        whole = [cube_json(c, at_skin) for c in cubes]
        skinned, cut = [], []
        for c in cubes:
            if c["head"]:
                continue
            at = at_skin if kind == "bird" and c["leg"] else at_meat  # birds keep their feet
            skinned.append(cube_json(c, at))
            z0, z1 = c["origin"][2], c["origin"][2] + c["size"][2]
            if z0 >= zcut:
                cut.append(cube_json(c, at))
            elif z1 > zcut:
                cc, uv = clip_rear(c, face_uvs(c, at, scale), zcut, cut_uv)
                cut.append(cube_json(cc, at, uv))
        for name, cs in (("carcass", whole), ("skinned", skinned), ("cut", cut)):
            bones.append({"name": f"{name}_{sp}", "parent": "frame", "pivot": [0, HANG, 0],
                          "rotation": [TURN, 0, 0], "cubes": cs})
    return bones, atlas.img


def main():
    bones, img = build()
    geo = {"format_version": "1.12.0", "minecraft:geometry": [{
        "description": {"identifier": f"geometry.{NS}.butcher_rack", "texture_width": TW, "texture_height": TH,
                        "visible_bounds_width": 2.0, "visible_bounds_height": 2.5, "visible_bounds_offset": [0, 1.0, 0]},
        "bones": bones}]}
    out = ROOT / "art" / "blocks"
    out.mkdir(parents=True, exist_ok=True)
    (out / "butcher_rack.geo.json").write_text(json.dumps(geo, indent=1) + "\n", encoding="utf8")
    img.save(out / "butcher_rack.png")
    print("butcher_rack:", len(bones), "bones")


if __name__ == "__main__":
    main()
