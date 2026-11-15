"""Duck: adult rig (a_*) and a separate duckling rig (b_*), sharing the head bone."""
from boxuv import RP, BLUSH, Painter, cute_eyes, geo, write_geo

SID, TW, TH = "duck", 64, 64

BONES = [
    ("body", None, [0, 0, 0], None),
    # adult
    ("a_torso", "body", [0, 6, 0], [("torso", [-3, 3, -4], [6, 5, 9], [0, 0])]),
    ("a_tail", "body", [0, 7, 5], [("tail", [-2, 6, 5], [4, 2, 2], [48, 4])]),
    ("m_curl", "body", [0, 8, 6], [("curl", [-0.5, 8, 6], [1, 2, 1], [60, 4])]),
    ("head", "body", [0, 8, -4], None),
    ("a_head", "head", [0, 8, -4], [
        ("neck", [-1, 7, -5], [2, 4, 2], [32, 8]),
        ("head", [-2.5, 10, -8], [5, 5, 5], [32, 16]),
        ("bill", [-1.5, 11, -10], [3, 1, 2], [48, 0]),
    ]),
    ("a_wing_left", "body", [3, 8, -1], [("wing_l", [3, 4, -3], [1, 4, 7], [0, 14])]),
    ("a_wing_right", "body", [-3, 8, -1], [("wing_r", [-4, 4, -3], [1, 4, 7], [16, 14])]),
    ("a_leg_left", "body", [1.5, 3, 1], [("leg", [1, 0, 0], [1, 3, 1], [40, 8]), ("foot", [0, 0, -1], [3, 1, 2], [44, 8])]),
    ("a_leg_right", "body", [-1.5, 3, 1], [("leg", [-2, 0, 0], [1, 3, 1], [40, 8]), ("foot", [-3, 0, -1], [3, 1, 2], [44, 8])]),
    # duckling: round body, oversized head, stub wings, short legs, no tail
    ("b_torso", "body", [0, 4, 0], [("b_torso", [-3, 2, -3], [6, 5, 6], [0, 32])]),
    ("b_head", "head", [0, 8, -4], [
        ("b_head", [-2.5, 6, -6], [5, 5, 5], [24, 32]),
        ("b_bill", [-1.5, 7, -7], [3, 1, 1], [44, 32]),
    ]),
    ("b_wing_left", "body", [3, 6, 0], [("b_wing_l", [3, 3, -1], [1, 3, 4], [0, 44])]),
    ("b_wing_right", "body", [-3, 6, 0], [("b_wing_r", [-4, 3, -1], [1, 3, 4], [10, 44])]),
    ("b_leg_left", "body", [1.5, 2, 0.5], [("b_leg", [1, 0, 0], [1, 2, 1], [20, 44]), ("b_foot", [0, 0, -1], [3, 1, 1], [24, 44])]),
    ("b_leg_right", "body", [-1.5, 2, 0.5], [("b_leg", [-2, 0, 0], [1, 2, 1], [20, 44]), ("b_foot", [-3, 0, -1], [3, 1, 1], [24, 44])]),
]

FEET = (232, 132, 40)


def eyes(p, cube, row, color=(16, 16, 16)):
    for f in ("east", "west"):
        x0, y0, w, h = p.face(cube, f)
        p.px(x0 + 1 if f == "east" else x0 + w - 2, y0 + row, color)


def adult(p, sex):
    if sex == "female":
        body, speck, head, wing, bill, tail = (150, 112, 74), (96, 66, 40), (140, 104, 70), (128, 92, 60), (196, 120, 50), (110, 80, 52)
    else:
        body, speck, head, wing, bill, tail = (176, 176, 170), (156, 156, 150), (36, 110, 62), (150, 146, 140), (222, 196, 70), (40, 40, 44)
    p.cube("torso", body, 8, speck, 0.25 if sex == "female" else 0.12)
    if sex == "male":
        p.rect(p.face("torso", "north"), (128, 62, 40), 8)
        p.rect(p.face("torso", "top"), (120, 118, 112), 8)
    p.cube("neck", head, 6)
    p.cube("head", head, 6)
    if sex == "male":
        for f in ("north", "south", "east", "west"):
            x0, y0, w, h = p.face("neck", f)
            p.rect((x0, y0 + h - 2, w, 1), (236, 236, 230), 4)
    else:
        for f in ("east", "west"):
            x0, y0, w, h = p.face("head", f)
            p.rect((x0, y0 + 3, w, 1), (120, 88, 58), 4)
    cute_eyes(p, "head", 1, blush=BLUSH if sex == "female" else None)
    p.cube("bill", bill, 6)
    p.cube("tail", tail, 6)
    p.cube("curl", (30, 30, 34), 4)
    for w in ("wing_l", "wing_r"):
        p.cube(w, wing, 8, speck, 0.2)
        for f in ("east", "west"):
            x0, y0, ww, h = p.face(w, f)
            p.rect((x0 + 3, y0 + 1, 2, 1), (70, 80, 170), 6)
            p.rect((x0 + 3, y0 + 2, 2, 1), (236, 236, 230), 3)
    p.cube("leg", FEET, 6)
    p.cube("foot", FEET, 6)


def baby(p):
    down, back = (252, 230, 112), (150, 122, 62)
    p.cube("b_torso", down, 10, (246, 218, 96), 0.3)
    p.rect(p.face("b_torso", "top"), back, 8)
    p.rect(p.face("b_torso", "south"), back, 8)
    p.cube("b_head", down, 10, (246, 218, 96), 0.3)
    x0, y0, w, h = p.face("b_head", "top")
    p.rect((x0, y0 + 1, w, h - 1), back, 8)  # dark cap, leaves the brow yellow
    for f in ("east", "west"):
        x0, y0, w, h = p.face("b_head", f)
    cute_eyes(p, "b_head", 1, blush=BLUSH)
    p.cube("b_bill", (96, 80, 52), 4)
    for w in ("b_wing_l", "b_wing_r"):
        p.cube(w, (240, 206, 88), 8)
    p.cube("b_leg", (220, 140, 60), 4)
    p.cube("b_foot", (220, 140, 60), 4)


def main():
    write_geo(SID, geo(SID, TW, TH, BONES))
    d = RP / "textures" / "entity" / "ranching" / SID
    for v in ("female", "male", "baby"):
        p = Painter(TW, TH, BONES, f"{SID}-{v}")
        adult(p, "female" if v == "baby" else v)
        baby(p)
        p.save(d / f"{v}.png")
    print("ok")


if __name__ == "__main__":
    main()
