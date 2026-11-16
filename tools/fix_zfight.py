#!/usr/bin/env python3
"""Removes z-fighting (flickering) from every model in the resource pack.

Two cubes flicker where faces that point the same way lie in the same plane and
overlap, and both cubes can be shown at the same time. This pass finds every
such pair in packs/RP/models/**.geo.json and moves one face a hair:

  * a smaller cube that sits wholly inside the bigger one is a patch meant to
    show on the surface, so its face moves out by EPS;
  * otherwise the smaller cube only pokes into the bigger one (a leg into a
    torso), so its face moves in by EPS and the bigger cube's face shows.

Cubes are visible together when some combination of the conditions that hide
bones lets both show: the entity's render controller (`part_visibility`), or
the block's `bone_visibility` evaluated over every block state. A cube that is
moved is first rewritten with per-face UVs that sample exactly the same pixels
as its box UV, so the texture does not shift.

Runs as part of `npm run generate`; `python3 tools/fix_zfight.py --check` only
reports and exits non-zero when anything would change.
"""

import itertools
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "packs" / "RP"
BP = ROOT / "packs" / "BP"
EPS = 0.05  # model pixels; 1/320 of a block, too small to see, enough for the depth buffer
TOL = 1e-4

AXES = {"x": 0, "y": 1, "z": 2}
FACE_OF = {("x", 1): "east", ("x", -1): "west", ("y", 1): "up", ("y", -1): "down", ("z", 1): "south", ("z", -1): "north"}


# --- Molang conditions ----------------------------------------------------------

def compile_condition(text):
    """Turns the small subset of Molang the packs use into a Python predicate over env."""
    if isinstance(text, bool):
        return lambda env: text
    src = str(text)
    src = re.sub(r"q(?:uery)?\.block_state\('([^']*)'\)", lambda m: f"env['state'][{m.group(1)!r}]", src)
    src = re.sub(r"q(?:uery)?\.property\('([^']*)'\)", lambda m: f"env['prop'][{m.group(1)!r}]", src)
    src = re.sub(r"q(?:uery)?\.(is_\w+)", lambda m: f"env[{m.group(1)!r}]", src)
    src = src.replace("&&", " and ").replace("||", " or ")
    src = re.sub(r"!(?!=)", " not ", src)
    src = src.replace("true", "True").replace("false", "False")
    code = compile(src.strip(), "<molang>", "eval")
    return lambda env: bool(eval(code, {}, {"env": env}))


class Props(dict):
    """Entity properties; any other bool property (the gear an animal wears) counts as on, so
    the bones it shows are checked against each other."""

    def __missing__(self, key):
        return 1


def entity_envs():
    for baby, sex, sheared, saddled, asleep in itertools.product((0, 1), ("female", "male"), (0, 1), (0, 1), (0, 1)):
        yield {"is_baby": baby, "is_sheared": sheared, "is_saddled": saddled,
               "prop": Props({"kaleidoscope_ranching:sex": sex, "kaleidoscope_ranching:sleeping": asleep}), "state": {}}


def state_values(spec):
    if isinstance(spec, list):
        return spec
    values = spec.get("values", spec)
    return list(range(values["min"], values["max"] + 1))


def block_envs(states):
    names = list(states)
    for combo in itertools.product(*(state_values(states[n]) for n in names)):
        yield {"state": dict(zip(names, combo)), "prop": {}, "is_baby": 0, "is_sheared": 0, "is_saddled": 0}


def entity_rules(geo_path):
    rc = RP / "render_controllers" / geo_path.name.replace(".geo.json", ".render_controllers.json")
    rules = {}
    if rc.exists():
        for controller in json.loads(rc.read_text(encoding="utf8"))["render_controllers"].values():
            for entry in controller.get("part_visibility", []):
                for bone, cond in entry.items():
                    if bone != "*":
                        rules[bone] = compile_condition(cond)
    return rules, list(entity_envs())


def block_rules(identifier):
    for path in sorted((BP / "blocks").glob("*.json")):
        block = json.loads(path.read_text(encoding="utf8"))["minecraft:block"]
        geometries = [block["components"].get("minecraft:geometry")]
        geometries += [p["components"].get("minecraft:geometry") for p in block.get("permutations", [])]
        rules = {}
        found = False
        for geometry in geometries:
            if isinstance(geometry, dict) and geometry.get("identifier") == identifier:
                found = True
                for bone, cond in geometry.get("bone_visibility", {}).items():
                    rules[bone] = compile_condition(cond)
            elif geometry == identifier:
                found = True
        if found:
            return rules, list(block_envs(block["description"].get("states", {})))
    return {}, [{"state": {}, "prop": {}, "is_baby": 0, "is_sheared": 0, "is_saddled": 0}]


# --- Geometry -------------------------------------------------------------------

def box_to_faces(cube):
    """Per-face UVs equal to the cube's box UV (integer sizes, as all the packs' box-UV cubes have)."""
    u, v = cube["uv"]
    w, h, d = (round(s) for s in cube["size"])
    faces = {
        "north": ([u + d, v + d], [w, h]),
        "east": ([u, v + d], [d, h]),
        "south": ([u + 2 * d + w, v + d], [w, h]),
        "west": ([u + d + w, v + d], [d, h]),
        "up": ([u + d, v], [w, d]),
        "down": ([u + d + w, v + d], [w, -d]),
    }
    if cube.get("mirror"):
        # A mirrored box swaps east and west and flips every face horizontally.
        faces["east"], faces["west"] = faces["west"], faces["east"]
        faces = {k: ([uv[0] + size[0], uv[1]], [-size[0], size[1]]) for k, (uv, size) in faces.items()}
    return {k: {"uv": uv, "uv_size": size} for k, (uv, size) in faces.items()}


def planes(cube):
    (x, y, z), (w, h, d) = cube["origin"], cube["size"]
    inf = cube.get("inflate", 0)
    lo = (x - inf, y - inf, z - inf)
    hi = (x + w + inf, y + h + inf, z + d + inf)
    return lo, hi


def face_rect(lo, hi, axis, sign):
    i = AXES[axis]
    others = [j for j in range(3) if j != i]
    plane = hi[i] if sign > 0 else lo[i]
    return plane, [(lo[j], hi[j]) for j in others]


def overlap(a, b):
    return min(a[1], b[1]) - max(a[0], b[0])


def contains(big, small):
    (blo, bhi), (slo, shi) = big, small
    return all(blo[i] - TOL <= slo[i] and shi[i] <= bhi[i] + TOL for i in range(3))


def volume(lo, hi):
    return (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2])


def transform_key(bones, bone, cube):
    chain = []
    while bone:
        if any(bone.get("rotation", [0, 0, 0])):
            chain.append((bone["name"], tuple(bone["pivot"]), tuple(bone["rotation"])))
        bone = bones.get(bone.get("parent"))
    if any(cube.get("rotation", [0, 0, 0])):
        chain.append(("cube", tuple(cube.get("pivot", [])), tuple(cube["rotation"])))
    return tuple(chain)


def visibility(bones, rules, envs):
    """{bone name: frozenset of env indexes in which it is shown} (hidden parents hide children)."""
    shown = {}

    def of(name):
        if name in shown:
            return shown[name]
        bone = bones[name]
        own = {i for i, env in enumerate(envs) if rules.get(name, lambda e: True)(env)}
        parent = bone.get("parent")
        if parent in bones:
            own &= of(parent)
        shown[name] = frozenset(own)
        return shown[name]

    for name in bones:
        of(name)
    return shown


def move_face(cube, axis, sign, delta):
    """Moves one face of the cube along its normal by delta (positive: outward)."""
    if not isinstance(cube.get("uv"), dict):
        cube["uv"] = box_to_faces(cube)
        cube.pop("mirror", None)
    i = AXES[axis]
    origin, size = list(cube["origin"]), list(cube["size"])
    if sign > 0:
        size[i] += delta
    else:
        origin[i] -= delta
        size[i] += delta
    cube["origin"] = [round(c, 4) for c in origin]
    cube["size"] = [round(c, 4) for c in size]


def conflicts(geo, shown):
    bones = {b["name"]: b for b in geo["bones"]}
    cubes = []
    for bone in geo["bones"]:
        for cube in bone.get("cubes", []):
            cubes.append((bone["name"], cube, transform_key(bones, bone, cube), planes(cube)))
    found = []
    for (b1, c1, k1, p1), (b2, c2, k2, p2) in itertools.combinations(cubes, 2):
        if k1 != k2 or not (shown[b1] & shown[b2]):
            continue
        for axis, sign in FACE_OF:
            plane1, rect1 = face_rect(*p1, axis, sign)
            plane2, rect2 = face_rect(*p2, axis, sign)
            if abs(plane1 - plane2) < TOL and all(overlap(a, b) > TOL for a, b in zip(rect1, rect2)):
                found.append(((b1, c1, p1), (b2, c2, p2), axis, sign))
    return found


def fix_file(path, check):
    data = json.loads(path.read_text(encoding="utf8"))
    geo = data["minecraft:geometry"][0]
    bones = {b["name"]: b for b in geo["bones"]}
    if path.parent.name == "entity":
        rules, envs = entity_rules(path)
    else:
        rules, envs = block_rules(geo["description"]["identifier"])
    shown = visibility(bones, rules, envs)

    moved = 0
    for _ in range(4):  # a moved face can rarely meet another; a few passes settle it
        found = conflicts(geo, shown)
        if not found:
            break
        done = set()
        for (b1, c1, p1), (b2, c2, p2), axis, sign in found:
            small, big = ((c1, p1), (c2, p2)) if volume(*p1) <= volume(*p2) else ((c2, p2), (c1, p1))
            key = (id(small[0]), axis, sign)
            if key in done:
                continue
            done.add(key)
            outward = contains(big[1], small[1])
            move_face(small[0], axis, sign, EPS if outward else -EPS)
            moved += 1
        if check:
            break
    if moved and not check:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")
    return moved


def main():
    check = "--check" in sys.argv
    total = 0
    for path in sorted(RP.glob("models/**/*.geo.json")):
        moved = fix_file(path, check)
        if moved:
            total += moved
            print(f"fix_zfight: {path.relative_to(ROOT)}: {moved} face(s) {'would move' if check else 'moved'}")
    print(f"fix_zfight: {total} face(s) {'to fix' if check else 'fixed'}")
    if check and total:
        sys.exit(1)


if __name__ == "__main__":
    main()
