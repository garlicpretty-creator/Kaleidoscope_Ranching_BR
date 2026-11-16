"""Duck (mallard): shaped adult body with feathered textures, and a separate duckling rig.

Bones keep the pack's conventions: a_* adult only, b_* baby only, m_* adult male only;
head / wing / leg bone names match the walk animation written by client.py.
"""
from boxuv import RP, Painter, plain_eyes, geo, write_geo

SID, TW, TH = "duck", 64, 64

BONES = [
    ("body", None, [0, 0, 0], None),
    # --- adult -------------------------------------------------------------------
    ("a_torso", "body", [0, 5, 0], [
        ("torso", [-3.5, 3, -4], [7, 5, 9], [0, 0]),
        ("chest", [-3, 3, -5], [6, 4, 1], [32, 0]),       # rounded breast
        ("belly", [-3, 2, -3], [6, 1, 7], [0, 14]),       # softens the underside
        ("rump", [-2.5, 4, 5], [5, 3, 2], [46, 0]),       # tapers toward the tail
    ]),
    # tail steps upward toward the tip
    ("a_tail", "body", [0, 6.5, 6], [("tail", [-2, 6, 6], [4, 1, 2], [32, 5]), ("tail_tip", [-1.5, 7, 7.5], [3, 1, 2], [32, 9])]),
    ("m_curl", "body", [0, 8, 8.5], [("curl", [-0.5, 8, 8], [1, 2, 1], [60, 0])]),
    ("head", "body", [0, 8, -4], None),
    ("a_head", "head", [0, 8, -4], [
        ("neck", [-1.5, 7, -5], [3, 3, 2], [46, 5]),
        ("head", [-2.5, 9, -7], [5, 4, 5], [26, 14]),
        ("bill_up", [-1.5, 10, -10], [3, 1, 3], [46, 10]),
        ("bill_lo", [-1, 9, -9], [2, 1, 2], [56, 5]),
    ]),
    ("a_wing_left", "body", [3.5, 7, -2], [
        ("wing_l", [3.5, 4, -3], [1, 4, 8], [0, 23]),
        ("wingtip", [3.5, 5, 5], [1, 2, 2], [46, 14]),
    ]),
    ("a_wing_right", "body", [-3.5, 7, -2], [
        ("wing_r", [-4.5, 4, -3], [1, 4, 8], [18, 23]),
        ("wingtip", [-4.5, 5, 5], [1, 2, 2], [46, 14]),
    ]),
    ("a_leg_left", "body", [1.5, 2, 0.5], [("leg", [1, 0, 0], [1, 2, 1], [54, 14]), ("foot", [0, 0, -2], [3, 1, 3], [46, 19])]),
    ("a_leg_right", "body", [-1.5, 2, 0.5], [("leg", [-2, 0, 0], [1, 2, 1], [54, 14]), ("foot", [-3, 0, -2], [3, 1, 3], [46, 19])]),
    # --- duckling: round, big head, stub wings, short legs, no tail ---------------
    ("b_torso", "body", [0, 4, 0], [("b_torso", [-3, 2, -3], [6, 5, 6], [0, 36])]),
    ("b_head", "head", [0, 8, -4], [
        ("b_head", [-2.5, 6, -6], [5, 5, 5], [24, 36]),
        ("b_bill", [-1.5, 7, -7], [3, 1, 1], [44, 36]),
    ]),
    ("b_wing_left", "body", [3, 6, 0], [("b_wing_l", [3, 3, -1], [1, 3, 4], [0, 47])]),
    ("b_wing_right", "body", [-3, 6, 0], [("b_wing_r", [-4, 3, -1], [1, 3, 4], [10, 47])]),
    ("b_leg_left", "body", [1.5, 2, 0.5], [("b_leg", [1, 0, 0], [1, 2, 1], [20, 47]), ("b_foot", [0, 0, -1], [3, 1, 1], [24, 47])]),
    ("b_leg_right", "body", [-1.5, 2, 0.5], [("b_leg", [-2, 0, 0], [1, 2, 1], [20, 47]), ("b_foot", [-3, 0, -1], [3, 1, 1], [24, 47])]),
]


def mix(a, b, t):
    return tuple(int(x + (y - x) * t) for x, y in zip(a, b))


def flat(c):
    return lambda f, i, j, w, h, fi: c


def scallop(base, dark, edge):
    """Overlapping feathers: each 3x2 cell has a dark shaft and a pale fringe, rows offset."""
    def fn(f, i, j, w, h, fi):
        row = j // 2
        k = (i + (row % 2) * 1) % 3
        if j % 2 == 1:
            return edge if k != 1 else base
        return dark if k == 1 else base
    return fn


def vermiculated(base, line):
    """Fine wavy grey barring of a drake's flanks."""
    def fn(f, i, j, w, h, fi):
        return line if (j + (i // 2) % 2) % 2 == 0 else base
    return fn


FEET = (238, 142, 52)


def adult(p, sex):
    if sex == "female":
        base, dark, edge = (150, 110, 72), (98, 68, 44), (200, 164, 116)
        p.paint("torso", scallop(base, dark, edge))
        p.paint("chest", scallop((168, 128, 88), dark, edge))
        p.paint("belly", flat((186, 152, 110)))
        p.paint("rump", scallop(base, dark, edge))
        p.paint("tail", scallop((132, 96, 62), dark, edge))
        p.paint("tail_tip", flat(edge))
        head = (178, 142, 102)

        def head_fn(f, i, j, w, h, fi):
            if f == "top" or j == 0:
                return (96, 70, 46)  # dark crown
            if f in ("east", "west") and j == 2:
                return (110, 82, 56)  # eye stripe
            return head
        p.paint("head", head_fn)
        p.paint("neck", flat(head))
        p.paint("bill_up", lambda f, i, j, w, h, fi: (110, 84, 60) if (f == "top" and j == 1 and i == 1) else (214, 132, 62))
        p.paint("bill_lo", flat((196, 116, 54)))
        wing = (124, 90, 58)
    else:
        grey, line = (196, 196, 192), (170, 170, 166)
        p.paint("torso", lambda f, i, j, w, h, fi: (
            (124, 62, 42) if f == "north" or (f in ("east", "west") and fi < 2 and j < 3)   # chestnut breast
            else (150, 140, 126) if f == "top"                                            # brown-grey back
            else (34, 34, 38) if f == "south"
            else vermiculated(grey, line)(f, i, j, w, h, fi)))
        p.paint("chest", flat((124, 62, 42)))
        p.paint("belly", flat((212, 212, 206)))
        p.paint("rump", flat((34, 34, 38)))
        p.paint("tail", flat((40, 40, 46)))
        p.paint("tail_tip", lambda f, i, j, w, h, fi: (236, 236, 232) if f in ("top", "south") else (200, 200, 196))
        p.paint("curl", flat((24, 24, 28)))

        def head_fn(f, i, j, w, h, fi):
            green = mix((52, 140, 84), (22, 78, 50), j / max(1, h - 1))
            if f in ("east", "west") and j == 0 and 1 <= fi <= 3:
                return (96, 176, 120)  # iridescent sheen
            return green
        p.paint("head", head_fn)
        p.paint("neck", lambda f, i, j, w, h, fi: (240, 240, 236) if j == h - 2 else (30, 92, 58))  # white collar
        p.paint("bill_up", lambda f, i, j, w, h, fi: (40, 40, 40) if (f == "top" and j == 0) else (226, 206, 88))
        p.paint("bill_lo", flat((206, 184, 74)))
        wing = (146, 140, 132)
    plain_eyes(p, "head", 1)

    def wing_fn(f, i, j, w, h, fi):
        if f in ("east", "west"):
            # blue speculum framed in white, a third of the way back
            if 3 <= fi <= 5:
                if j == 1:
                    return (250, 250, 248)
                if j == 2:
                    return (64, 84, 196) if fi != 4 else (96, 120, 220)
                if j == 3:
                    return (250, 250, 248)
            if fi >= 6:
                return mix(wing, (40, 34, 30), 0.45)
            if j == 0:
                return mix(wing, (255, 255, 255), 0.15)
        return wing
    p.paint("wing_l", wing_fn)
    p.paint("wing_r", wing_fn)
    p.paint("wingtip", flat(mix(wing, (40, 34, 30), 0.5)))
    p.paint("leg", flat(FEET), light=False)
    p.paint("foot", lambda f, i, j, w, h, fi: mix(FEET, (180, 90, 30), 0.35) if (f == "top" and i == 1) else FEET)  # webbing seam


def baby(p):
    down, back = (250, 224, 112), (118, 90, 52)

    def body_fn(f, i, j, w, h, fi):
        if f == "top" or f == "south":
            # dark back with the duckling's yellow spots
            return down if (i, j) in ((1, 1), (4, 2), (2, 4)) else back
        if f in ("east", "west") and j == 0:
            return mix(down, back, 0.5)
        return down
    p.paint("b_torso", body_fn)

    def head_fn(f, i, j, w, h, fi):
        if f == "top":
            return mix(down, back, 0.7) if j < h - 2 else down  # dark crown toward the back only (top rows run back to front)
        if f == "south" and j < 2:
            return mix(down, back, 0.6)
        if f in ("east", "west") and j == 0 and fi >= 3:
            return mix(down, back, 0.5)
        return down
    p.paint("b_head", head_fn)
    plain_eyes(p, "b_head", 1)
    p.paint("b_bill", flat((84, 76, 66)))
    p.paint("b_wing_l", flat((226, 196, 92)))
    p.paint("b_wing_r", flat((226, 196, 92)))
    p.paint("b_leg", flat((210, 146, 72)), light=False)
    p.paint("b_foot", flat((210, 146, 72)))


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
