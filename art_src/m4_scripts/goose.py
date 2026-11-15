"""Goose: white domestic goose with a bill knob (bigger on the gander); fluffy gosling rig."""
from boxuv import RP, BLUSH, Painter, cute_eyes, geo, write_geo

SID, TW, TH = "goose", 64, 64

BONES = [
    ("body", None, [0, 0, 0], None),
    ("a_torso", "body", [0, 7, 0], [("torso", [-3.5, 4, -5], [7, 6, 10], [0, 0])]),
    ("a_tail", "body", [0, 9, 5], [("tail", [-2, 8, 5], [4, 2, 2], [36, 0])]),
    ("head", "body", [0, 10, -5], None),
    ("a_head", "head", [0, 10, -5], [
        ("neck", [-1, 9, -6], [2, 6, 2], [36, 4]),
        ("head", [-2, 14, -8], [4, 4, 4], [44, 20]),
        ("bill", [-1, 14, -10], [2, 2, 2], [48, 11]),
    ]),
    ("m_knob", "head", [0, 17, -9], [("m_knob", [-1, 16, -9], [2, 2, 1], [58, 0])]),
    ("fa_knob", "head", [0, 17, -9], [("fa_knob", [-0.5, 16, -9], [1, 1, 1], [58, 4])]),
    ("a_wing_left", "body", [3.5, 10, -1], [("wing_l", [3.5, 5, -4], [1, 5, 8], [0, 16])]),
    ("a_wing_right", "body", [-3.5, 10, -1], [("wing_r", [-4.5, 5, -4], [1, 5, 8], [18, 16])]),
    ("a_leg_left", "body", [1.5, 4, 1], [("leg", [1, 0, 0], [1, 4, 1], [36, 16]), ("foot", [0, 0, -1], [3, 1, 2], [40, 16])]),
    ("a_leg_right", "body", [-1.5, 4, 1], [("leg", [-2, 0, 0], [1, 4, 1], [36, 16]), ("foot", [-3, 0, -1], [3, 1, 2], [40, 16])]),
    # gosling: round fluffy body, short upright neck, big head
    ("b_torso", "body", [0, 4, 0], [("b_torso", [-3, 2, -3], [6, 5, 6], [0, 32])]),
    ("b_head", "head", [0, 10, -5], [
        ("b_neck", [-1, 6, -4], [2, 3, 2], [24, 32]),
        ("b_head", [-2, 8, -6], [4, 4, 4], [32, 32]),
        ("b_bill", [-1, 9, -7], [2, 1, 1], [48, 32]),
    ]),
    ("b_wing_left", "body", [3, 6, 0], [("b_wing_l", [3, 3, -1], [1, 3, 4], [0, 44])]),
    ("b_wing_right", "body", [-3, 6, 0], [("b_wing_r", [-4, 3, -1], [1, 3, 4], [10, 44])]),
    ("b_leg_left", "body", [1.5, 2, 0.5], [("b_leg", [1, 0, 0], [1, 2, 1], [20, 44]), ("b_foot", [0, 0, -1], [3, 1, 1], [24, 44])]),
    ("b_leg_right", "body", [-1.5, 2, 0.5], [("b_leg", [-2, 0, 0], [1, 2, 1], [20, 44]), ("b_foot", [-3, 0, -1], [3, 1, 1], [24, 44])]),
]

ORANGE = (236, 140, 44)


def eyes(p, cube, row, color=(20, 20, 24)):
    for f in ("east", "west"):
        x0, y0, w, h = p.face(cube, f)
        p.px(x0 + 1 if f == "east" else x0 + w - 2, y0 + row, color)


def adult(p, sex):
    white, shade = (242, 242, 236), (222, 222, 216)
    p.cube("torso", white, 5, shade, 0.2)
    p.cube("tail", (214, 214, 208), 5)
    p.cube("neck", white, 4)
    p.cube("head", white, 4)
    cute_eyes(p, "head", 1, blush=BLUSH if sex == "female" else None)
    p.cube("bill", ORANGE, 6)
    knob = (214, 110, 34) if sex == "male" else (226, 130, 40)
    p.cube("m_knob", knob, 6)
    p.cube("fa_knob", knob, 6)
    for w in ("wing_l", "wing_r"):
        p.cube(w, (232, 232, 226), 5, shade, 0.2)
        for f in ("east", "west"):  # grey flight-feather tips at the back of the wing
            x0, y0, ww, h = p.face(w, f)
            tip = x0 + ww - 3 if f == "east" else x0
            p.rect((tip, y0 + 1, 3, h - 1), (178, 180, 182), 6)
    p.cube("leg", ORANGE, 6)
    p.cube("foot", ORANGE, 6)


def baby(p):
    down, back = (244, 230, 124), (196, 186, 124)
    p.cube("b_torso", down, 10, (214, 204, 108), 0.3)
    p.rect(p.face("b_torso", "top"), back, 8)
    p.cube("b_neck", down, 8)
    p.cube("b_head", down, 8, (214, 204, 108), 0.3)
    p.rect(p.face("b_head", "top"), back, 8)
    cute_eyes(p, "b_head", 1, blush=BLUSH)
    p.cube("b_bill", (70, 66, 60), 4)
    for w in ("b_wing_l", "b_wing_r"):
        p.cube(w, back, 8)
    p.cube("b_leg", (110, 100, 80), 4)
    p.cube("b_foot", (110, 100, 80), 4)


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
