"""Goose (white Chinese goose): shaped body, two-part neck, bill knob (bigger on the gander),
feathered white plumage with grey flight feathers, and a fluffy gosling rig."""
from boxuv import RP, Painter, plain_eyes, geo, write_geo

SID, TW, TH = "goose", 64, 64

BONES = [
    ("body", None, [0, 0, 0], None),
    # --- adult -------------------------------------------------------------------
    ("a_torso", "body", [0, 7, 0], [
        ("torso", [-3.5, 4, -5], [7, 6, 10], [0, 0]),
        ("chest", [-3, 4, -6], [6, 5, 1], [34, 0]),
        ("belly", [-3, 3, -4], [6, 1, 8], [0, 16]),
    ]),
    ("a_tail", "body", [0, 8, 5], [
        ("tail", [-2.5, 7, 5], [5, 3, 2], [48, 0]),
        ("tail_tip", [-1.5, 8, 7], [3, 2, 1], [48, 5]),
    ]),
    ("head", "body", [0, 10, -5], None),
    ("a_head", "head", [0, 10, -5], [
        ("neck_lo", [-1.5, 9, -6], [3, 3, 2], [34, 6]),
        ("neck_hi", [-1, 12, -6], [2, 4, 2], [56, 5]),
        ("head", [-2, 15, -8], [4, 4, 4], [28, 16]),
        ("bill", [-1, 15, -11], [2, 2, 3], [44, 11]),
    ]),
    # the gander's knob is a big tall bump over the bill; the goose's a small one
    ("m_knob", "head", [0, 17, -9], [("m_knob", [-1, 17, -10], [2, 3, 2], [56, 16])]),
    ("fa_knob", "head", [0, 17, -9], [("fa_knob", [-0.5, 17, -9], [1, 1, 1], [60, 11])]),
    ("a_wing_left", "body", [3.5, 9, -2], [
        ("wing_l", [3.5, 5, -4], [1, 5, 9], [0, 25]),
        ("wingtip", [3.5, 6, 5], [1, 3, 3], [44, 16]),
    ]),
    ("a_wing_right", "body", [-3.5, 9, -2], [
        ("wing_r", [-4.5, 5, -4], [1, 5, 9], [20, 25]),
        ("wingtip", [-4.5, 6, 5], [1, 3, 3], [44, 16]),
    ]),
    ("a_leg_left", "body", [1.5, 3, 1], [("leg", [1, 0, 0], [1, 3, 1], [52, 16]), ("foot", [0, 0, -2], [3, 1, 3], [44, 22])]),
    ("a_leg_right", "body", [-1.5, 3, 1], [("leg", [-2, 0, 0], [1, 3, 1], [52, 16]), ("foot", [-3, 0, -2], [3, 1, 3], [44, 22])]),
    # --- gosling: an oval body, already a goose's long neck, a small head and a grey bill
    # (the duckling is a round yellow ball with a big head and a flat bill). b_head turns at
    # the base of the neck, so pecking and the roost (turned back over the body) bend it there.
    ("b_torso", "body", [0, 4, 0], [("b_torso", [-2.5, 2, -3.5], [5, 4, 7], [0, 40])]),
    ("b_head", "body", [0, 5.5, -3.5], [
        ("b_neck", [-1, 5, -4.5], [2, 5, 2], [24, 40]),
        ("b_head", [-1.5, 10, -6], [3, 3, 3], [32, 40]),
        ("b_bill", [-1, 10, -7.5], [2, 1, 1.5], [48, 40]),
    ]),
    ("b_wing_left", "body", [2.5, 6, 0], [("b_wing_l", [2.5, 2.5, -1.5], [1, 3, 4], [0, 51])]),
    ("b_wing_right", "body", [-2.5, 6, 0], [("b_wing_r", [-3.5, 2.5, -1.5], [1, 3, 4], [10, 51])]),
    ("b_leg_left", "body", [1.5, 2, 0.5], [("b_leg", [1, 0, 0], [1, 2, 1], [20, 51]), ("b_foot", [0, 0, -1], [3, 1, 1], [24, 51])]),
    ("b_leg_right", "body", [-1.5, 2, 0.5], [("b_leg", [-2, 0, 0], [1, 2, 1], [20, 51]), ("b_foot", [-3, 0, -1], [3, 1, 1], [24, 51])]),
]

ORANGE = (240, 146, 52)
WHITE, SHADE, EDGE = (246, 246, 240), (226, 226, 220), (255, 255, 252)


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def flat(c):
    return lambda f, i, j, w, h, fi: c


def plumage(f, i, j, w, h, fi):
    """Soft white feathers: faint grey shaft lines under a bright fringe, rows offset."""
    row = j // 2
    k = (i + row) % 3
    if j % 2 == 1:
        return EDGE if k != 1 else WHITE
    return SHADE if k == 1 else WHITE


def adult(p, sex):
    p.paint("torso", plumage)
    p.paint("chest", plumage)
    p.paint("belly", flat((236, 236, 230)))
    p.paint("tail", plumage)
    p.paint("tail_tip", flat((214, 214, 210)))
    p.paint("neck_lo", flat(WHITE))
    p.paint("neck_hi", flat(WHITE))
    p.paint("head", flat(WHITE))
    p.paint("bill", lambda f, i, j, w, h, fi: (214, 120, 40) if (f == "north" and j == 1) else ORANGE)
    knob = (196, 92, 30) if sex == "male" else (232, 132, 44)
    p.paint("m_knob", flat(knob))
    p.paint("fa_knob", flat(knob))
    plain_eyes(p, "head", 1)

    def wing_fn(f, i, j, w, h, fi):
        if f in ("east", "west"):
            if fi >= 6:
                return mix((170, 172, 176), (120, 122, 128), (fi - 6) / 3)  # grey flight feathers
            if j == 0:
                return EDGE
            return plumage(f, i, j, w, h, fi)
        return WHITE
    p.paint("wing_l", wing_fn)
    p.paint("wing_r", wing_fn)
    p.paint("wingtip", flat((132, 134, 140)))
    p.paint("leg", flat(ORANGE), light=False)
    p.paint("foot", lambda f, i, j, w, h, fi: mix(ORANGE, (190, 96, 30), 0.35) if (f == "top" and i == 1) else ORANGE)


def baby(p):
    """Grey-yellow down, an olive-grey cap and back, a dark grey bill and feet."""
    down, back = (214, 204, 136), (150, 148, 120)

    def body_fn(f, i, j, w, h, fi):
        if f == "top":
            return back
        if f in ("east", "west") and j == 0:
            return mix(down, back, 0.5)
        if f == "south":
            return mix(down, back, 0.35)
        return down
    p.paint("b_torso", body_fn)
    p.paint("b_neck", lambda f, i, j, w, h, fi: mix(down, back, 0.55) if f == "south" else down)
    p.paint("b_head", lambda f, i, j, w, h, fi: back if f == "top" else (mix(down, back, 0.4) if f == "south" else down))
    plain_eyes(p, "b_head", 1)
    p.paint("b_bill", lambda f, i, j, w, h, fi: (82, 84, 84) if f == "north" else (104, 106, 104))
    p.paint("b_wing_l", flat(mix(down, back, 0.6)))
    p.paint("b_wing_r", flat(mix(down, back, 0.6)))
    p.paint("b_leg", flat((112, 108, 96)), light=False)
    p.paint("b_foot", flat((104, 100, 90)))


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
