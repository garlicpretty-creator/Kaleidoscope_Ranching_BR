"""Model, paint and variant definitions for the six M1 animals.

Bone-name prefixes decide visibility (mirrored by each render controller):
  m_   adult males only          fa_  adult females only
  f_   females and babies        a_   adults only
  b_   babies only (own rig)     wool_ hidden once sheared
  saddle  shown when saddled

Hand-built models in art/animals/<id>/ (art_src/m4_scripts/m1_animals.py) replace the
procedural geometry and textures below; tools/gen_art.py then only writes the client files.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from model import Bone, Cube, Model, FACE_LIGHT, hash01, mix, noise3, shade

SEX_IS_MALE = "q.property('kaleidoscope_ranching:sex') == 'male'"

VISIBILITY_RULES = [
    ("m_", f"!q.is_baby && {SEX_IS_MALE}", lambda s: not s["baby"] and s["sex"] == "male"),
    ("fa_", f"!q.is_baby && !({SEX_IS_MALE})", lambda s: not s["baby"] and s["sex"] == "female"),
    ("f_", f"q.is_baby || !({SEX_IS_MALE})", lambda s: s["baby"] or s["sex"] == "female"),
    ("a_", "!q.is_baby", lambda s: not s["baby"]),
    ("b_", "q.is_baby", lambda s: s["baby"]),
    ("wool_", "!q.is_sheared", lambda s: not s.get("sheared", False)),
    ("saddle", "q.is_saddled", lambda s: s.get("saddled", False)),
]


def bone_rule(name):
    for prefix, molang, test in VISIBILITY_RULES:
        if name.startswith(prefix):
            return prefix, molang, test
    return None


def make_visible(model: Model, state):
    """Cube filter for a state, honouring rules on the cube's bone and its ancestors."""
    def bone_ok(name):
        while name:
            rule = bone_rule(name)
            if rule and not rule[2](state):
                return False
            name = model.bone(name).parent
        return True
    return lambda cube: bone_ok(cube.bone)


@dataclass
class Species:
    id: str
    model: Model
    painter: object  # painter(variant_params) -> (texel -> colour)
    textures: dict  # texture name -> variant params
    texture_index: str  # molang that picks an index into `texture_order`
    texture_order: list
    preview: list  # [(label, texture name, state)]
    walk: dict  # bone -> molang x-rotation
    egg_colors: tuple
    extra_animations: dict = field(default_factory=dict)


def light(t, base, factor=1.0):
    f = FACE_LIGHT[t.face]
    if t.face == "side":
        f *= 1.0 - 0.10 * (t.b / max(1, t.height - 1))
    f *= 0.97 + 0.06 * hash01("grain", t.part, t.point)
    return shade(base, f * factor)


def near(t, *points, radius=0.6):
    return any(sum((a - b) ** 2 for a, b in zip(t.point, p)) <= radius * radius for p in points)


def sexed(female, male, baby):
    return {"female": dict(female, sex="female"), "male": dict(male, sex="male"), "baby": dict(baby, sex="baby")}


STANDARD_PREVIEW = [
    ("female", "female", {"sex": "female", "baby": False}),
    ("male", "male", {"sex": "male", "baby": False}),
    ("baby", "baby", {"sex": "female", "baby": True}),
]
STANDARD_INDEX = f"q.is_baby ? 2 : ({SEX_IS_MALE})"


def quad_walk(fl, fr, bl, br, amplitude=70):
    swing = f"math.cos(q.modified_distance_moved * 38.17) * q.modified_move_speed * {amplitude}"
    return {fl: swing, br: swing, fr: f"-{swing}", bl: f"-{swing}"}


# --- Cow ------------------------------------------------------------------------

def cow():
    bones = [
        Bone("body", None, (0, 17, 0)),
        Bone("head", "body", (0, 20, -8)),
        Bone("m_horns", "head", (0, 23, -11)),
        Bone("fa_udder", "body", (0, 12, 5)),
        Bone("tail", "body", (0, 21, 10)),
        Bone("leg_fl", "body", (3, 12, -5)),
        Bone("leg_fr", "body", (-3, 12, -5)),
        Bone("leg_bl", "body", (3, 12, 7)),
        Bone("leg_br", "body", (-3, 12, 7)),
    ]
    cubes = [
        Cube("body", "body", (-6, 12, -8), (12, 10, 18)),
        Cube("head", "head", (-4, 16, -14), (8, 8, 6)),
        Cube("head", "muzzle", (-3, 16, -15), (6, 4, 1)),
        Cube("head", "ear", (4, 21, -11), (2, 1, 1), name="ear_l"),
        Cube("head", "ear", (-6, 21, -11), (2, 1, 1), mirror_of="ear_l"),
        Cube("m_horns", "horn", (4, 22, -12), (2, 2, 2), name="horn_l"),
        Cube("m_horns", "horn", (-6, 22, -12), (2, 2, 2), mirror_of="horn_l"),
        Cube("m_horns", "horn", (5, 24, -12), (1, 3, 1), name="tip_l"),
        Cube("m_horns", "horn", (-6, 24, -12), (1, 3, 1), mirror_of="tip_l"),
        Cube("fa_udder", "udder", (-2, 10, 3), (4, 2, 5)),
        Cube("tail", "tail", (-1, 13, 10), (2, 8, 1)),
        Cube("tail", "tuft", (-1, 11, 10), (2, 2, 1)),
        Cube("leg_fl", "leg", (1, 0, -7), (4, 12, 4), name="leg"),
        Cube("leg_fr", "leg", (-5, 0, -7), (4, 12, 4), mirror_of="leg"),
        Cube("leg_bl", "leg", (1, 0, 5), (4, 12, 4), mirror_of="leg"),
        Cube("leg_br", "leg", (-5, 0, 5), (4, 12, 4), mirror_of="leg"),
    ]
    model = Model("geometry.kaleidoscope_ranching.cow", bones, cubes, 64, 64, (2.5, 2.5, 0.75))

    white = (238, 233, 224)
    textures = sexed(
        {"coat": (92, 60, 40)},
        {"coat": (58, 38, 28)},
        {"coat": (150, 106, 74)},
    )

    def painter(v):
        coat = v["coat"]

        def paint(t):
            p = t.part
            if p in ("body", "head", "leg", "tail", "ear"):
                if near(t, (4, 20.5, -12.5), (-4, 20.5, -12.5)):
                    return (22, 18, 16)
                if p == "head" and t.face == "front" and abs(t.point[0]) < 1.6:
                    return light(t, white)  # blaze
                if p == "leg" and t.point[1] < 2:
                    return light(t, (50, 40, 34))
                x, y, z = t.point
                spotted = noise3(x * 0.2, y * 0.2, z * 0.2, seed=7) > 0.56
                return light(t, white if spotted and p != "ear" else coat)
            if p == "muzzle":
                if near(t, (1.5, 17.5, -15), (-1.5, 17.5, -15), radius=0.55):
                    return (70, 52, 48)
                return light(t, (208, 184, 170) if v["sex"] != "male" else (182, 160, 148))
            if p == "horn":
                return light(t, (228, 216, 188) if t.point[1] < 25 else (176, 160, 130))
            if p == "udder":
                return light(t, (234, 166, 166))
            if p == "tuft":
                return light(t, (40, 30, 24))
            return light(t, coat)
        return paint

    return Species(
        "cow", model, painter, textures, STANDARD_INDEX, ["female", "male", "baby"], STANDARD_PREVIEW,
        quad_walk("leg_fl", "leg_fr", "leg_bl", "leg_br"), ("#5C3C28", "#EEE9E0"),
    )


# --- Sheep ----------------------------------------------------------------------

DYES = [
    ("white", (233, 236, 236)), ("orange", (240, 118, 19)), ("magenta", (189, 68, 179)),
    ("light_blue", (58, 175, 217)), ("yellow", (248, 197, 39)), ("lime", (112, 185, 25)),
    ("pink", (237, 141, 172)), ("gray", (62, 68, 71)), ("light_gray", (142, 142, 134)),
    ("cyan", (21, 137, 145)), ("purple", (121, 42, 172)), ("blue", (53, 57, 157)),
    ("brown", (114, 71, 40)), ("green", (84, 109, 27)), ("red", (160, 39, 34)), ("black", (28, 29, 33)),
]


def sheep():
    bones = [
        Bone("body", None, (0, 16, 0)),
        Bone("wool_body", "body", (0, 16, 0)),
        Bone("wool_tail", "body", (0, 14, 9)),
        Bone("head", "body", (0, 18, -8)),
        Bone("wool_head", "head", (0, 19, -10)),
        Bone("m_horns", "head", (0, 19, -9)),
        Bone("leg_fl", "body", (2.5, 12, -5.5)),
        Bone("wool_leg_fl", "leg_fl", (2.5, 12, -5.5)),
        Bone("leg_fr", "body", (-2.5, 12, -5.5)),
        Bone("wool_leg_fr", "leg_fr", (-2.5, 12, -5.5)),
        Bone("leg_bl", "body", (2.5, 12, 6.5)),
        Bone("wool_leg_bl", "leg_bl", (2.5, 12, 6.5)),
        Bone("leg_br", "body", (-2.5, 12, 6.5)),
        Bone("wool_leg_br", "leg_br", (-2.5, 12, 6.5)),
    ]
    cubes = [
        Cube("body", "skin", (-4, 12, -8), (8, 6, 16)),
        Cube("wool_body", "wool", (-5, 11, -9), (10, 8, 18)),
        Cube("wool_tail", "wool", (-1, 12, 9), (2, 3, 2)),
        Cube("head", "face", (-3, 15, -13), (6, 6, 6)),
        Cube("head", "ear", (3, 18, -11), (2, 1, 1), name="ear_l"),
        Cube("head", "ear", (-5, 18, -11), (2, 1, 1), mirror_of="ear_l"),
        Cube("wool_head", "wool", (-3.5, 17, -12), (7, 5, 5)),
        Cube("m_horns", "horn", (3.5, 16, -11), (2, 4, 3), name="horn_l"),
        Cube("m_horns", "horn", (-5.5, 16, -11), (2, 4, 3), mirror_of="horn_l"),
        Cube("leg_fl", "leg", (1, 0, -7), (3, 12, 3), name="leg"),
        Cube("leg_fr", "leg", (-4, 0, -7), (3, 12, 3), mirror_of="leg"),
        Cube("leg_bl", "leg", (1, 0, 5), (3, 12, 3), mirror_of="leg"),
        Cube("leg_br", "leg", (-4, 0, 5), (3, 12, 3), mirror_of="leg"),
        Cube("wool_leg_fl", "wool", (0.5, 6, -7.5), (4, 5, 4), name="wool_leg"),
        Cube("wool_leg_fr", "wool", (-4.5, 6, -7.5), (4, 5, 4), mirror_of="wool_leg"),
        Cube("wool_leg_bl", "wool", (0.5, 6, 4.5), (4, 5, 4), mirror_of="wool_leg"),
        Cube("wool_leg_br", "wool", (-4.5, 6, 4.5), (4, 5, 4), mirror_of="wool_leg"),
    ]
    model = Model("geometry.kaleidoscope_ranching.sheep", bones, cubes, 64, 64, (2.5, 2.5, 0.75))

    skins = {"female": (226, 206, 188), "male": (190, 168, 150), "baby": (238, 222, 206)}
    textures = {}
    order = []
    for sex in ("female", "male", "baby"):
        for index, (dye, rgb) in enumerate(DYES):
            name = f"{sex}_{dye}"
            textures[name] = {"sex": sex, "skin": skins[sex], "wool": rgb}
            order.append(name)

    def painter(v):
        def paint(t):
            p = t.part
            if p == "wool":
                x, y, z = t.point
                lump = noise3(x * 0.55, y * 0.55, z * 0.55, seed=3)
                tone = 0.86 + 0.2 * lump
                if hash01("tuft", t.point) < 0.12:
                    tone *= 0.9
                return light(t, v["wool"], tone)
            if p == "face":
                if near(t, (2.5, 18.5, -13), (-2.5, 18.5, -13)):
                    return (26, 22, 20)
                if near(t, (0.5, 16.5, -13), (-0.5, 16.5, -13), radius=0.55):
                    return light(t, (196, 140, 138))
                return light(t, v["skin"])
            if p == "horn":
                ridge = (t.a + t.b) % 2 == 0
                return light(t, (198, 184, 156) if ridge else (166, 150, 122))
            if p == "leg" and t.point[1] < 2:
                return light(t, (54, 44, 38))
            return light(t, v["skin"])
        return paint

    index = f"(q.is_baby ? 2 : ({SEX_IS_MALE})) * 16 + q.property('kaleidoscope_ranching:wool_color')"
    preview = [
        ("ewe", "female_white", {"sex": "female", "baby": False}),
        ("ram", "male_white", {"sex": "male", "baby": False}),
        ("lamb", "baby_white", {"sex": "female", "baby": True}),
    ]
    return Species(
        "sheep", model, painter, textures, index, order, preview,
        quad_walk("leg_fl", "leg_fr", "leg_bl", "leg_br"), ("#E9ECEC", "#E2CEBC"),
    )


# --- Goat -----------------------------------------------------------------------

def goat():
    bones = [
        Bone("body", None, (0, 15, 0)),
        Bone("head", "body", (0, 17, -8)),
        Bone("fa_horns", "head", (0, 21, -11)),
        Bone("m_horns", "head", (0, 21, -10)),
        Bone("m_beard", "head", (0, 15, -14)),
        Bone("tail", "body", (0, 18, 8)),
        Bone("leg_fl", "body", (2.5, 11, -5.5)),
        Bone("leg_fr", "body", (-2.5, 11, -5.5)),
        Bone("leg_bl", "body", (2.5, 11, 5.5)),
        Bone("leg_br", "body", (-2.5, 11, 5.5)),
    ]
    cubes = [
        Cube("body", "body", (-4, 11, -8), (8, 8, 16)),
        Cube("head", "head", (-3, 15, -14), (6, 6, 7)),
        Cube("head", "muzzle", (-2, 15, -15), (4, 3, 1)),
        Cube("head", "ear", (3, 19, -12), (3, 1, 2), name="ear_l"),
        Cube("head", "ear", (-6, 19, -12), (3, 1, 2), mirror_of="ear_l"),
        Cube("fa_horns", "horn", (1, 21, -12), (1, 2, 1), name="fhorn_l"),
        Cube("fa_horns", "horn", (-2, 21, -12), (1, 2, 1), mirror_of="fhorn_l"),
        Cube("m_horns", "horn", (1, 21, -11), (1, 4, 2), name="mhorn_l"),
        Cube("m_horns", "horn", (-2, 21, -11), (1, 4, 2), mirror_of="mhorn_l"),
        Cube("m_horns", "horn", (1, 24, -9), (1, 1, 2), name="mtip_l"),
        Cube("m_horns", "horn", (-2, 24, -9), (1, 1, 2), mirror_of="mtip_l"),
        Cube("m_beard", "beard", (-1, 12, -15), (2, 3, 1)),
        Cube("tail", "tail", (-1, 17, 8), (2, 2, 1)),
        Cube("leg_fl", "leg", (1, 0, -7), (3, 11, 3), name="leg"),
        Cube("leg_fr", "leg", (-4, 0, -7), (3, 11, 3), mirror_of="leg"),
        Cube("leg_bl", "leg", (1, 0, 4), (3, 11, 3), mirror_of="leg"),
        Cube("leg_br", "leg", (-4, 0, 4), (3, 11, 3), mirror_of="leg"),
    ]
    model = Model("geometry.kaleidoscope_ranching.goat", bones, cubes, 64, 64, (2.0, 2.5, 0.75))
    textures = sexed({"coat": (236, 230, 218)}, {"coat": (204, 196, 184)}, {"coat": (244, 240, 230)})

    def painter(v):
        def paint(t):
            p = t.part
            if p == "head" and near(t, (3, 18.5, -12.5), (-3, 18.5, -12.5)):
                return (60, 48, 30)
            if p == "head" and near(t, (3, 18.5, -11.5), (-3, 18.5, -11.5)):
                return (204, 170, 70)
            if p == "muzzle":
                if near(t, (1.5, 16.5, -15), (-1.5, 16.5, -15), radius=0.55):
                    return (70, 56, 52)
                return light(t, (222, 206, 196))
            if p == "horn":
                return light(t, (180, 168, 142) if (t.b % 2) else (152, 140, 116))
            if p == "beard":
                return light(t, mix(v["coat"], (150, 140, 128), 0.4))
            if p == "leg" and t.point[1] < 2:
                return light(t, (64, 54, 46))
            tone = 0.96 + 0.06 * noise3(*(c * 0.4 for c in t.point), seed=11)
            return light(t, v["coat"], tone)
        return paint

    return Species(
        "goat", model, painter, textures, STANDARD_INDEX, ["female", "male", "baby"], STANDARD_PREVIEW,
        quad_walk("leg_fl", "leg_fr", "leg_bl", "leg_br"), ("#ECE6DA", "#B4A88E"),
    )


# --- Pig ------------------------------------------------------------------------

def pig():
    bones = [
        Bone("body", None, (0, 10, 0)),
        Bone("head", "body", (0, 12, -8)),
        Bone("m_tusks", "head", (0, 9, -15)),
        Bone("saddle", "body", (0, 14, 0)),
        Bone("tail", "body", (0, 12, 8)),
        Bone("leg_fl", "body", (3, 6, -5)),
        Bone("leg_fr", "body", (-3, 6, -5)),
        Bone("leg_bl", "body", (3, 6, 6)),
        Bone("leg_br", "body", (-3, 6, 6)),
    ]
    cubes = [
        Cube("body", "body", (-5, 6, -8), (10, 8, 16)),
        Cube("head", "head", (-4, 7, -15), (8, 8, 7)),
        Cube("head", "snout", (-2, 8, -16), (4, 3, 1)),
        Cube("head", "ear", (2, 15, -11), (2, 2, 1), name="ear_l"),
        Cube("head", "ear", (-4, 15, -11), (2, 2, 1), mirror_of="ear_l"),
        Cube("m_tusks", "tusk", (2, 8, -16), (1, 2, 1), name="tusk_l"),
        Cube("m_tusks", "tusk", (-3, 8, -16), (1, 2, 1), mirror_of="tusk_l"),
        Cube("saddle", "saddle", (-5.5, 14, -4), (11, 1, 8)),
        Cube("saddle", "strap", (5, 9, -1), (1, 5, 1), name="strap_l"),
        Cube("saddle", "strap", (-6, 9, -1), (1, 5, 1), mirror_of="strap_l"),
        Cube("tail", "tail", (-0.5, 11, 8), (1, 2, 1)),
        Cube("leg_fl", "leg", (1, 0, -7), (4, 6, 4), name="leg"),
        Cube("leg_fr", "leg", (-5, 0, -7), (4, 6, 4), mirror_of="leg"),
        Cube("leg_bl", "leg", (1, 0, 4), (4, 6, 4), mirror_of="leg"),
        Cube("leg_br", "leg", (-5, 0, 4), (4, 6, 4), mirror_of="leg"),
    ]
    model = Model("geometry.kaleidoscope_ranching.pig", bones, cubes, 64, 64, (2.0, 2.0, 0.5))
    textures = sexed({"skin": (240, 168, 164)}, {"skin": (212, 144, 138)}, {"skin": (248, 190, 186)})

    def painter(v):
        def paint(t):
            p = t.part
            if p == "head" and near(t, (2.5, 11.5, -15), (-2.5, 11.5, -15)):
                return (30, 24, 24)
            if p == "head" and near(t, (3.5, 11.5, -15), (-3.5, 11.5, -15)):
                return (246, 240, 236)
            if p == "snout":
                if near(t, (1, 9.5, -16), (-1, 9.5, -16), radius=0.55):
                    return (140, 72, 72)
                return light(t, shade(v["skin"], 0.9))
            if p == "tusk":
                return light(t, (240, 232, 212))
            if p == "saddle":
                return light(t, (112, 64, 34) if t.face != "top" or t.a % 3 else (92, 52, 28))
            if p == "strap":
                return light(t, (58, 40, 26))
            if p == "leg" and t.point[1] < 1:
                return light(t, shade(v["skin"], 0.72))
            color = v["skin"]
            if v["sex"] == "male" and p in ("body", "head") and hash01("bristle", t.point) < 0.14:
                color = shade(color, 0.82)
            return light(t, color)
        return paint

    return Species(
        "pig", model, painter, textures, STANDARD_INDEX, ["female", "male", "baby"], STANDARD_PREVIEW,
        quad_walk("leg_fl", "leg_fr", "leg_bl", "leg_br", 60), ("#F0A8A4", "#D49088"),
    )


# --- Chicken --------------------------------------------------------------------

def chicken():
    bones = [
        Bone("body", None, (0, 7, 0)),
        Bone("head", "body", (0, 10, -4)),
        Bone("fa_wattle", "head", (0, 10, -7)),
        Bone("fa_comb", "head", (0, 15, -5)),
        Bone("m_comb", "head", (0, 15, -5)),
        Bone("m_wattle", "head", (0, 10, -7)),
        Bone("wing_left", "body", (3, 10, 0)),
        Bone("wing_right", "body", (-3, 10, 0)),
        Bone("leg_left", "body", (1.5, 4, 0)),
        Bone("leg_right", "body", (-1.5, 4, 0)),
        Bone("f_tail", "body", (0, 9, 4)),
        Bone("m_tail", "body", (0, 9, 4)),
    ]
    cubes = [
        Cube("body", "body", (-3, 4, -4), (6, 6, 8)),
        Cube("head", "head", (-2, 9, -7), (4, 6, 3)),
        Cube("head", "beak", (-1, 11, -9), (2, 2, 2)),
        Cube("fa_wattle", "wattle", (-1, 9, -8), (2, 2, 1)),
        Cube("fa_comb", "comb", (-1, 15, -6), (2, 1, 2)),
        Cube("m_comb", "comb", (-0.5, 15, -7), (1, 3, 4)),
        Cube("m_wattle", "wattle", (-1, 8, -8), (2, 3, 1)),
        Cube("wing_left", "wing", (3, 6, -3), (1, 4, 6), name="wing"),
        Cube("wing_right", "wing", (-4, 6, -3), (1, 4, 6), mirror_of="wing"),
        Cube("leg_left", "leg", (1, 0, -1), (1, 4, 1), name="leg"),
        Cube("leg_left", "toes", (0, 0, -3), (3, 1, 2), name="toes"),
        Cube("leg_right", "leg", (-2, 0, -1), (1, 4, 1), mirror_of="leg"),
        Cube("leg_right", "toes", (-3, 0, -3), (3, 1, 2), mirror_of="toes"),
        Cube("f_tail", "tail", (-2, 8, 4), (4, 3, 2)),
        Cube("m_tail", "tail", (-1, 8, 4), (2, 6, 3)),
        Cube("m_tail", "tail_tip", (-1, 11, 7), (2, 5, 2)),
    ]
    model = Model("geometry.kaleidoscope_ranching.chicken", bones, cubes, 64, 32, (1.5, 1.5, 0.5))
    palettes = {
        "female": {"body": (238, 228, 206), "head": (242, 234, 214), "wing": (214, 196, 160),
                   "tail": (196, 172, 130), "tail_tip": (196, 172, 130), "speckle": (176, 140, 96)},
        "male": {"body": (150, 70, 38), "head": (214, 138, 46), "wing": (58, 78, 70),
                 "tail": (34, 62, 56), "tail_tip": (26, 48, 46), "speckle": (108, 46, 26)},
        "baby": {"body": (244, 214, 92), "head": (248, 224, 112), "wing": (236, 198, 76),
                 "tail": (236, 198, 76), "tail_tip": (236, 198, 76), "speckle": (226, 188, 70)},
    }
    textures = {sex: dict(palette, sex=sex) for sex, palette in palettes.items()}

    def painter(v):
        def paint(t):
            p = t.part
            if p == "head" and near(t, (2, 12.5, -5.5), (-2, 12.5, -5.5), (1.5, 12.5, -7), (-1.5, 12.5, -7), radius=0.55):
                return (30, 24, 22)
            if p in ("comb", "wattle"):
                return light(t, (204, 50, 40) if v["sex"] != "baby" else v["head"])
            if p == "beak":
                return light(t, (234, 170, 60), 0.86 if t.b == t.height - 1 and t.face != "top" else 1.0)
            if p in ("leg", "toes"):
                return light(t, (228, 178, 70) if v["sex"] != "baby" else (236, 158, 60))
            color = v.get(p, v["body"])
            if p in ("body", "wing", "tail", "tail_tip") and t.face != "bottom" and hash01(v["sex"], p, t.point) < 0.16:
                color = v["speckle"]
            if v["sex"] == "male" and p in ("tail", "tail_tip") and t.face == "side" and (t.a + 2 * t.b) % 4 == 0:
                color = (52, 110, 96)
            if v["sex"] == "male" and p == "body" and t.point[1] > 8.5 and t.point[2] < 0:
                color = v["head"]  # golden hackles over the shoulders
            return light(t, color)
        return paint

    swing = "math.cos(q.modified_distance_moved * 38.17) * q.modified_move_speed * 80"
    flap = "q.is_on_ground ? 0 : math.sin(q.life_time * 1600) * 40"
    return Species(
        "chicken", model, painter, textures, STANDARD_INDEX, ["female", "male", "baby"], STANDARD_PREVIEW,
        {"leg_left": swing, "leg_right": f"-{swing}"}, ("#EEE4CE", "#C83A2C"),
        extra_animations={"wing_left": ("z", f"-({flap})"), "wing_right": ("z", flap)},
    )


# --- Rabbit ---------------------------------------------------------------------

RABBIT_COATS = [
    ("brown", {"coat": (128, 94, 66), "belly": (196, 170, 140)}),
    ("white", {"coat": (236, 232, 226), "belly": (246, 244, 240)}),
    ("black", {"coat": (44, 40, 38), "belly": (70, 64, 60)}),
    ("splotched", {"coat": (238, 234, 228), "belly": (246, 244, 240), "patch": (40, 36, 34)}),
    ("gold", {"coat": (214, 178, 116), "belly": (236, 214, 170)}),
    ("salt", {"coat": (148, 138, 126), "belly": (196, 188, 176), "speckle": (70, 62, 56)}),
]


def rabbit():
    bones = [
        Bone("body", None, (0, 5, 0)),
        Bone("head", "body", (0, 7, -4)),
        Bone("m_cheeks", "head", (0, 6, -6)),
        Bone("ears", "head", (0, 9, -5)),
        Bone("tail", "body", (0, 5, 4)),
        Bone("leg_fl", "body", (1.5, 2, -3)),
        Bone("leg_fr", "body", (-1.5, 2, -3)),
        Bone("leg_bl", "body", (3, 4, 1)),
        Bone("leg_br", "body", (-3, 4, 1)),
    ]
    cubes = [
        Cube("body", "body", (-3, 2, -4), (6, 5, 8)),
        Cube("head", "head", (-2.5, 5, -8), (5, 4, 5)),
        Cube("m_cheeks", "head", (-3.5, 5, -7), (7, 2, 3)),
        Cube("ears", "ear", (0.5, 9, -5), (2, 5, 1), name="ear_l"),
        Cube("ears", "ear", (-2.5, 9, -5), (2, 5, 1), mirror_of="ear_l"),
        Cube("tail", "tail", (-1, 4, 4), (2, 2, 2)),
        Cube("leg_fl", "leg", (1, 0, -4), (1, 2, 1), name="fleg"),
        Cube("leg_fr", "leg", (-2, 0, -4), (1, 2, 1), mirror_of="fleg"),
        Cube("leg_bl", "leg", (2, 0, -1), (2, 4, 5), name="hleg"),
        Cube("leg_br", "leg", (-4, 0, -1), (2, 4, 5), mirror_of="hleg"),
    ]
    model = Model("geometry.kaleidoscope_ranching.rabbit", bones, cubes, 64, 32, (1.0, 1.0, 0.3))
    textures = {name: dict(coat, sex="any", variant=name) for name, coat in RABBIT_COATS}

    def painter(v):
        def paint(t):
            p = t.part
            if p == "head" and near(t, (2.5, 7.5, -6.5), (-2.5, 7.5, -6.5), radius=0.55):
                return (24, 20, 20) if v["variant"] != "white" else (170, 40, 52)
            if p == "head" and t.face == "front" and near(t, (0, 6.5, -8), radius=0.55):
                return (226, 150, 160)
            if p == "ear" and t.face == "front" and t.b > 0 and v["variant"] != "black":
                return light(t, (232, 170, 176))
            if p == "tail":
                return light(t, (242, 240, 236))
            color = v["coat"]
            if t.face == "bottom" or (p == "body" and t.point[1] < 3):
                color = v["belly"]
            if "patch" in v and noise3(*(c * 0.3 for c in t.point), seed=5) > 0.55:
                color = v["patch"]
            if "speckle" in v and hash01("salt", t.point) < 0.3:
                color = v["speckle"]
            return light(t, color)
        return paint

    preview = [
        ("doe", "brown", {"sex": "female", "baby": False}),
        ("buck", "brown", {"sex": "male", "baby": False}),
        ("kit", "brown", {"sex": "female", "baby": True}),
    ]
    hop = "math.cos(q.modified_distance_moved * 30) * q.modified_move_speed * 40"
    return Species(
        "rabbit", model, painter, textures, "math.clamp(q.variant, 0, 5)", [name for name, _ in RABBIT_COATS], preview,
        {"leg_fl": f"-{hop}", "leg_fr": f"-{hop}", "leg_bl": hop, "leg_br": hop}, ("#806042", "#C4AA8C"),
    )


ALL = [cow, sheep, goat, pig, chicken, rabbit]
