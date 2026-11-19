"""Alpaca (1.1 追加 新動物, docs/1.1_追加企劃書.md 二): Ranching's own alpaca, not vanilla's llama.

Shape, as the proposal asks ("較矮、毛較蓬", unlike the vanilla llama):
- a compact, rounded fleece blanket over a short body, a thick fleeced neck standing upright,
  and a fluffy topknot over a short face with a small muzzle; spear-shaped ears;
- slim legs with fleece "leg warmers" on their upper half, and a short fluffy tail;
- the male a little larger (client.py scale_male) with a longer neck ruff (m_ruff);
- the cria a separate rig: fluffy all over, a big-ish head on a short neck, long legs.

Bones keep the pack's conventions (client.py, tools/gen_sleep.mjs, tools/gen_actions.mjs,
tools/validate.mjs): body, head, a_head, b_head, a_torso, b_torso, a_/b_leg_fl..br, a_tail,
b_tail; the necks are bones of their own (1.3: head > a_neck > a_head, b_neck > b_head), so the
head bends at both ends of the neck; the ears are bones of their own (a_/b_ear_left, _right) for the head shake's ear
flick (tools/gen_actions.mjs). The fleece is in wool_* bones that the render controller hides once the alpaca is
sheared (wool_coat over the body, wool_neck round the neck, wool_leg_* the leg warmers); m_ruff
hangs from wool_neck so a sheared male loses it too. Under the fleece the body, neck and legs are
painted as short-cropped fleece, so a sheared alpaca looks clipped, not bare. The topknot and the
tail stay: they are not shorn.

The eyes are painted with boxuv.plain_eyes on cubes held directly by a_head / b_head, so
gen_sleep finds them and lays eyelids over them. The head bone pivots at the base of the neck,
a_head at its top: eating, drinking and grazing swing the neck forward and down from the chest
and tip the face back toward the feed (tools/gen_actions.mjs has an alpaca branch), the muzzle
just over the feed, the trough's rim and the grass (check with actions_preview.py).

Run with: python art_src/m4_scripts/new_animals.py alpaca   (new_animals.BUILD uses this file)
"""
from new_animals import mix, pack


def hsh(*a):
    """A small deterministic hash for painted noise."""
    v = 2166136261
    for x in a:
        for ch in str(x):
            v = ((v ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return v


# --- Rig ----------------------------------------------------------------------------

def quad(prefix, cube, warm, size, x, zf, zb, top, warm_h):
    """Four slim legs; each leg's upper part wears a fleece leg warmer (wool_, shorn off)."""
    w, _, d = size
    out = []
    for tag, sx, z in (("fl", 1, zf), ("fr", -1, zf), ("bl", 1, zb), ("br", -1, zb)):
        ox = x if sx > 0 else -(x + w)
        pivot = [ox + w / 2, top, z + d / 2]
        out.append((f"{prefix}leg_{tag}", "body", pivot, [(cube, [ox, 0, z], size)]))
        if warm:
            out.append((f"wool_leg_{tag}", f"{prefix}leg_{tag}", pivot,
                        [(warm, [ox - 0.5, top - warm_h, z - 0.5], [w + 1, warm_h, d + 1])]))
    return out


def ears(prefix, parent, name, x, y, z, size, tilt, pivot_y):
    """A pair of spear-shaped ears, leaning out a little (the point is painted, see ear_fn). Each
    ear is its own bone (<prefix>ear_left / _right, pivot at the ear's base) so the head shake
    (tools/gen_actions.mjs) can twitch it; the cubes are the same as when the head held them."""
    w = size[0]
    out = []
    for side, ox, sign in (("left", x, 1), ("right", -(x + w), -1)):
        pivot = [sign * (x + w / 2), pivot_y, z + size[2] / 2]
        out.append((f"{prefix}ear_{side}", parent, pivot,
                    [(name, [ox, y, z], size, {"rotation": [0, 0, -sign * tilt], "pivot": pivot})]))
    return out


# Heights: the hitbox is 0.9 x 1.7 blocks (27.2 px, tools/gen_entities.mjs) and the male is
# drawn 1.05 times larger (client.py), so the top of the head (the topknot) stays at 26 px:
# 27.3 px for the male. Only the ear tips reach past it, as the vanilla llama's do. Vanilla leg
# length (12 px); the neck carries the head forward of the chest, above the back.
BONES = [
    ("body", None, [0, 0, 0], None),
    # --- adult ---------------------------------------------------------------------
    # The shorn body: short and deep, painted as clipped fleece.
    ("a_torso", "body", [0, 14.5, 0], [("torso", [-4, 12, -5], [8, 5, 11])]),
    # The fleece blanket, rounded off on the back by a narrower top layer.
    ("wool_coat", "a_torso", [0, 14.5, 0], [
        ("fleece", [-5, 10.5, -6.5], [10, 7, 14]),
        ("fleece_top", [-4, 17.5, -5.5], [8, 1, 12]),
    ]),
    # A short fluffy tail, carried low; it stays after shearing.
    ("a_tail", "body", [0, 16, 6.5], [("tail", [-1.5, 13, 6], [3, 3.5, 3])]),
    # The head bone turns at the base of the neck, low in the chest, and carries the neck
    # (a_neck); the skull (a_head) turns again at the top of the neck, so eating and grazing
    # bend the neck down and tip the face to the feed (tools/gen_actions.mjs alpaca branch).
    ("head", "body", [0, 14, -6], None),
    ("a_neck", "head", [0, 14, -6], [("neck", [-2, 13, -9], [4, 9, 4])]),
    ("a_head", "a_neck", [0, 21, -7], [
        ("skull", [-3, 20, -11.5], [6, 4, 5]),
        ("muzzle", [-1.5, 20, -13.5], [3, 2, 2]),
        # the topknot: a pom of fleece over the crown, its fringe just above the eyes
        ("topknot", [-3.5, 23, -12], [7, 3, 6]),
    ]),
    *ears("a_", "a_head", "ear", 1.5, 23.5, -8.5, [2, 4, 1], 12, 23.5),
    # The fleece round the neck, from the chest to the jaw.
    ("wool_neck", "a_neck", [0, 14, -6], [("ruff", [-3, 12.5, -10], [6, 9, 6])]),
    # The male's longer neck fleece: a bib hanging down the front of the neck. It is also hidden
    # once sheared (client.py adds !q.is_sheared to its m_ rule).
    ("m_ruff", "wool_neck", [0, 14, -6], [("mane", [-2, 11, -11], [4, 8, 1.5])]),
    *quad("a_", "leg", "warmer", [2, 12, 2], 1, -4.5, 3, 12, 5),
    # --- cria: fluffy all over, a big head on a short neck, long legs ------------------
    ("b_torso", "body", [0, 11, 0], [("b_torso", [-3, 8, -4.5], [6, 6, 10])]),
    ("b_tail", "body", [0, 12.5, 5.5], [("b_tail", [-1, 10.5, 5], [2, 2.5, 2])]),
    # the neck (b_neck) turns at its base, the head (b_head) again at the top of the neck
    ("b_neck", "body", [0, 13, -5], [("b_neck", [-1.5, 12, -6.5], [3, 6, 3])]),
    ("b_head", "b_neck", [0, 17.5, -5.5], [
        ("b_skull", [-2.5, 17, -8.5], [5, 4, 4]),
        ("b_muzzle", [-1.5, 17, -10], [3, 2, 1.5]),
        ("b_topknot", [-3, 20, -9], [6, 2.5, 5]),
    ]),
    *ears("b_", "b_head", "b_ear", 1.5, 21.5, -6, [1, 2.5, 1], 14, 21.5),
    *quad("b_", "b_leg", None, [2, 8, 2], 1, -4, 2.5, 8, 0),
]


# --- Painting -----------------------------------------------------------------------

LOOKS = {
    # coat, crimp light, crimp shadow, face, muzzle, nose, lower legs, toes, inner ear
    "female": dict(coat=(234, 222, 196), light=(247, 240, 222), dark=(200, 184, 154), face=(232, 220, 196),
                   muzzle=(212, 194, 170), nose=(104, 86, 82), shank=(224, 210, 184), toe=(78, 64, 56),
                   inner=(196, 168, 150)),
    "male": dict(coat=(184, 134, 88), light=(212, 168, 120), dark=(142, 98, 62), face=(170, 120, 78),
                 muzzle=(132, 94, 66), nose=(70, 52, 46), shank=(124, 86, 58), toe=(58, 44, 38),
                 inner=(150, 104, 76)),
    "baby": dict(coat=(242, 232, 212), light=(252, 247, 234), dark=(212, 198, 172), face=(240, 230, 210),
                 muzzle=(220, 204, 182), nose=(112, 92, 86), shank=(232, 220, 198), toe=(86, 70, 62),
                 inner=(206, 178, 160)),
}


def crimp(L, seed, big=2):
    """Dense fleece: staggered locks `big` px across, each lit on its upper left and shadowed on
    its lower right, a little lighter or darker lock by lock."""
    coat, light, dark = L["coat"], L["light"], L["dark"]

    def fn(f, i, j, w, h, fi):
        row = j // big
        ii = i + (big // 2 if row % 2 else 0)
        cell = hsh(seed, f, ii // big, row)
        tone = mix(coat, light if cell % 3 == 0 else dark, 0.14 if cell % 3 else 0.2) if cell % 5 < 3 else coat
        li, lj = ii % big, j % big
        if lj == 0 and li == 0:
            return mix(tone, light, 0.45)
        if lj == big - 1 and li == big - 1:
            return mix(tone, dark, 0.45)
        return tone
    return fn


def clipped(L, seed):
    """Short-cropped fleece after shearing: a velvety, slightly darker coat with fine tufts."""
    base = mix(L["coat"], L["dark"], 0.35)

    def fn(f, i, j, w, h, fi):
        r = hsh(seed, f, i, j) % 9
        if r == 0:
            return mix(base, L["light"], 0.35)
        if r == 1:
            return mix(base, L["dark"], 0.5)
        return base
    return fn


def legs_fn(L, seed, warm_rows):
    """Slim legs: clipped fleece above (under the leg warmer), short hair below, and the two
    toes of the padded foot."""
    clip = clipped(L, seed)

    def fn(f, i, j, w, h, fi):
        if f == "bottom" or j == h - 1:
            return L["toe"]
        if f == "top":
            return clip(f, i, j, w, h, fi)
        if j < warm_rows:
            return clip(f, i, j, w, h, fi)
        r = hsh(seed, "shank", f, i, j) % 7
        return mix(L["shank"], L["dark"], 0.3) if r == 0 else L["shank"]
    return fn


def warmer_fn(L, seed):
    """The leg warmer: fluffy locks that thin out to a ragged lower edge."""
    fluff = crimp(L, seed)

    def fn(f, i, j, w, h, fi):
        if f == "bottom":
            return mix(L["coat"], L["dark"], 0.4)
        if j == h - 1 and hsh(seed, f, i) % 2:
            return mix(L["coat"], L["dark"], 0.3)
        return fluff(f, i, j, w, h, fi)
    return fn


def face_fn(L, seed):
    """The skull: short hair, a soft muzzle-coloured blush low on the cheeks."""
    def fn(f, i, j, w, h, fi):
        if f == "north" and j >= h - 2:
            return mix(L["face"], L["muzzle"], 0.45)
        if f == "north":
            # plain on the front: a speckle beside an eye can match the eye white and grow a lid
            return L["face"]
        r = hsh(seed, f, i, j) % 11
        if r == 0:
            return mix(L["face"], L["light"], 0.5)
        if r == 1:
            return mix(L["face"], L["dark"], 0.35)
        return L["face"]
    return fn


def muzzle_fn(L):
    """The small muzzle: nostrils and the split upper lip on the front, a darker chin."""
    def fn(f, i, j, w, h, fi):
        if f == "north":
            if j == 0 and i in (0, w - 1):
                return L["nose"]
            if j == 1 and i == w // 2:
                return mix(L["nose"], L["muzzle"], 0.3)
            if j == h - 1:
                return mix(L["muzzle"], L["nose"], 0.35)
        if f == "bottom":
            return mix(L["muzzle"], L["nose"], 0.25)
        return L["muzzle"]
    return fn


def ear_fn(L):
    """Spear-shaped ears: the top corners cut away (transparent) to a point, the inside darker."""
    def fn(f, i, j, w, h, fi):
        if f in ("north", "south") and j == 0 and w >= 2 and i != (w - 1 if f == "north" else 0):
            return None
        if f in ("east", "west") and j == 0:
            return None
        if f == "top":
            return None
        if f == "north" and 0 < j < h - 1:
            return L["inner"]
        return mix(L["face"], L["dark"], 0.15)
    return fn


def neck_fn(L, seed):
    """The shorn neck: clipped fleece, the throat a shade paler."""
    clip = clipped(L, seed)

    def fn(f, i, j, w, h, fi):
        c = clip(f, i, j, w, h, fi)
        return mix(c, L["light"], 0.2) if f == "north" else c
    return fn


def tail_fn(L, seed):
    fluff = crimp(L, seed)
    return lambda f, i, j, w, h, fi: mix(L["coat"], L["dark"], 0.3) if f == "bottom" else fluff(f, i, j, w, h, fi)


def adult(p, sex, plain_eyes):
    L = LOOKS[sex]
    p.paint("torso", clipped(L, "torso"))
    p.paint("neck", neck_fn(L, "neck"))
    p.paint("fleece", crimp(L, "fleece"))
    p.paint("fleece_top", crimp(L, "fleece_top"))
    p.paint("ruff", crimp(L, "ruff"))
    p.paint("mane", crimp(L, "mane"))
    p.paint("tail", tail_fn(L, "tail"))
    p.paint("topknot", crimp(L, "topknot"))
    p.paint("skull", face_fn(L, "skull"))
    p.paint("muzzle", muzzle_fn(L))
    p.paint("ear", ear_fn(L), light=False)
    p.paint("leg", legs_fn(L, "leg", 5))
    p.paint("warmer", warmer_fn(L, "warmer"))
    plain_eyes(p, "skull", 1)


def cria(p, plain_eyes):
    L = LOOKS["baby"]
    p.paint("b_torso", crimp(L, "b_torso"))
    p.paint("b_tail", tail_fn(L, "b_tail"))
    p.paint("b_neck", crimp(L, "b_neck"))
    p.paint("b_topknot", crimp(L, "b_topknot"))
    p.paint("b_skull", face_fn(L, "b_skull"))
    p.paint("b_muzzle", muzzle_fn(L))
    p.paint("b_ear", ear_fn(L), light=False)
    p.paint("b_leg", legs_fn(L, "b_leg", 3))
    plain_eyes(p, "b_skull", 1)


def build():
    """(bones, texture width, texture height, adult painter, young painter) for new_animals.main."""
    from boxuv import plain_eyes
    bones, tw, th = pack(BONES, 128)
    return bones, tw, th, lambda p, sex: adult(p, sex, plain_eyes), lambda p: cria(p, plain_eyes)
