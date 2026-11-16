"""Placeable aged cheese wheel (proposal: 熟成架 → 熟成乳酪輪, 可放置、可切塊).

A round wheel (a stepped disc, radius 6, with a bevelled shoulder) made of four quarter pieces,
piece_1..piece_4, so the block can hide one piece per slice cut (piece_4 first). Faces on the
planes the quarters meet on are painted as cut paste under a rind, so every partly eaten state
shows a clean cheese interior.

Writes art/blocks/<id>.{geo.json,png} for the three wheel blocks (aged, vintage, smoked): the
same model in three colourings (tools/gen_blocks.mjs, packs/BP/scripts/systems/cheeseWheel.js).

Run with: python art_src/m4_scripts/cheese_wheel.py
"""
import math

from foodkit import QUARTERS, R5, R6, SIDES, Model, is_cut, mix, qbox, rnd

H = 5  # wheel height in pixels: a body of 4 and a shoulder of 1

# block id -> (rind, rind dark, rind light, paste, paste dark, hole), how far the rind colours the paste
WHEELS = {
    "cheese_wheel": (((198, 140, 58), (150, 98, 40), (222, 170, 84), (248, 218, 126), (230, 194, 100), (204, 162, 72)), 0.25),
    # vintage: a darker, drier rind and a deep amber paste with crystals
    "vintage_cheese_wheel": (((168, 104, 44), (118, 70, 30), (196, 134, 66), (236, 186, 92), (212, 158, 70), (250, 232, 180)), 0.35),
    # smoked: a brown smoke-stained rind over an ordinary paste, the smoke reaching into it
    "smoked_cheese_wheel": (((122, 78, 44), (82, 50, 28), (154, 104, 62), (240, 206, 128), (220, 182, 104), (190, 148, 80)), 0.6),
}


def wheel_mat(colours, smoke, salt):
    RIND, RIND_DK, RIND_LT, PASTE, PASTE_DK, HOLE = colours

    def mat(f, x, y, z):
        if is_cut(f, x, z):
            along = abs(z) if f in ("east", "west") else abs(x)
            edge = 4 if y > H - 1 else 5  # the shoulder is one pixel narrower
            if y > H - 1 or along > edge:
                return RIND
            if y < 1:
                return RIND_DK
            if along > edge - 1 or y > H - 2 or y < 2:
                return mix(PASTE, RIND, smoke)
            r = rnd(along, y, 0, salt)
            return HOLE if r < 8 else PASTE_DK if r < 26 else PASTE
        if f == "top":
            if y < H:  # the shoulder ring around the top
                return mix(RIND, RIND_LT, 0.5)
            r = math.hypot(x, z)
            if 2.1 < r < 3.1:  # the maker's brand, pressed in a ring
                return mix(RIND, RIND_DK, 0.6)
            return RIND_LT if rnd(x, 0, z, salt) < 10 else RIND
        if f == "bottom":
            return RIND_DK
        if y > H - 1:
            return RIND_LT
        if y < 1:
            return RIND_DK
        return mix(RIND, RIND_DK, 0.3) if rnd(x, y, z, salt) < 14 else RIND
    return mat


def build(bid):
    colours, smoke = WHEELS[bid]
    m = Model(bid)
    m.bone("wheel")
    for n, sx, sz in QUARTERS:
        m.bone(f"piece_{n}", "wheel")
        mat = wheel_mat(colours, smoke, n)
        for rect in R6:
            m.box(f"piece_{n}", *qbox(sx, sz, rect, 0, H - 1), mat)
        for rect in R5:
            m.box(f"piece_{n}", *qbox(sx, sz, rect, H - 1, H), mat)
    m.save()


def main():
    for bid in WHEELS:
        build(bid)


if __name__ == "__main__":
    main()
