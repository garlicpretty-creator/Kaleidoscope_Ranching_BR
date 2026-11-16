"""Writes client entity, render controller and animations (walk, idle, eat) for an M4 animal.
The animations follow tools/gen_art.py animation_file(); keep the two in step.
Usage: python client.py duck"""
import json, sys
from pathlib import Path

RP = Path(r"D:\Kaleidoscope\KR\packs\RP")
NS = "kaleidoscope_ranching"
MALE = f"q.property('{NS}:sex') == 'male'"
RULES = [
    ("m_", f"!q.is_baby && {MALE}"),
    ("fa_", f"!q.is_baby && !({MALE})"),
    ("f_", f"q.is_baby || !({MALE})"),
    ("a_", "!q.is_baby"),
    ("b_", "q.is_baby"),
]
# Scaled by move speed, as in vanilla, so the legs return to rest when the animal stops.
SWING = "q.modified_move_speed * math.cos(q.modified_distance_moved * 38.17)"
EAT_DIP = {"duck": 60, "goose": 65}
IDLE_BLEND = "1.0 - math.clamp(q.modified_move_speed * 4, 0, 1)"

SPECIES = {
    "duck": {
        "egg": ("#8C6A46", "#246E3E"), "scale_male": 1.15, "scale_female": 0.95,
        "walk": {"leg_left": f"{SWING} * 80", "leg_right": f"-{SWING} * 80"},
        "wings": True,
    },
    "goose": {
        "egg": ("#EEEEE8", "#E08A2A"), "scale_male": 1.15,
        "walk": {"leg_left": f"{SWING} * 70", "leg_right": f"-{SWING} * 70"},
        "wings": True,
    },
    "buffalo": {
        "egg": ("#3C3A3A", "#8A8478"), "scale_male": 1.15, "baby_look": True,
        "walk": {"leg_fl": f"{SWING} * 60", "leg_br": f"{SWING} * 60", "leg_fr": f"-{SWING} * 60", "leg_bl": f"-{SWING} * 60"},
    },
    "yak": {
        "egg": ("#3A2E26", "#D8D0C0"), "scale_male": 1.15, "scale_female": 0.95, "baby_look": True,
        "walk": {"leg_fl": f"{SWING} * 60", "leg_br": f"{SWING} * 60", "leg_fr": f"-{SWING} * 60", "leg_bl": f"-{SWING} * 60"},
    },
}


def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf8")


def main(sid):
    s = SPECIES[sid]
    geo = json.loads((RP / "models" / "entity" / f"{sid}.geo.json").read_text(encoding="utf8"))
    bones = [b["name"] for b in geo["minecraft:geometry"][0]["bones"]]
    dump(RP / "entity" / f"{sid}.entity.json", {"format_version": "1.10.0", "minecraft:client_entity": {"description": {
        "identifier": f"{NS}:{sid}",
        "materials": {"default": "entity_alphatest"},
        "textures": {v: f"textures/entity/ranching/{sid}/{v}" for v in ("female", "male", "baby")},
        "geometry": {"default": f"geometry.{NS}.{sid}"},
        "animations": {"walk": f"animation.{NS}.{sid}.walk", "idle": f"animation.{NS}.{sid}.idle", "look_at_target": "animation.common.look_at_target"},
        "scripts": {"scale": f"q.is_baby ? 1.0 : ({MALE} ? {s['scale_male']} : {s.get('scale_female', 1.0)})", "animate": ["walk", "look_at_target", {"idle": IDLE_BLEND}]},
        "render_controllers": [f"controller.render.{NS}.{sid}"],
        "spawn_egg": {"base_color": s["egg"][0], "overlay_color": s["egg"][1]},
    }}})
    vis = [{"*": True}]
    for b in bones:
        for prefix, molang in RULES:
            if b.startswith(prefix):
                vis.append({b: molang})
                break
    dump(RP / "render_controllers" / f"{sid}.render_controllers.json", {"format_version": "1.8.0", "render_controllers": {
        f"controller.render.{NS}.{sid}": {
            "geometry": "Geometry.default",
            "materials": [{"*": "Material.default"}],
            "arrays": {"textures": {"Array.skins": ["Texture.female", "Texture.male", "Texture.baby"]}},
            "textures": [f"Array.skins[q.is_baby ? 2 : ({MALE})]"],
            "part_visibility": vis,
        }}})
    walk = dict(s["walk"])
    if s.get("wings"):
        flap = "math.sin(q.life_time * 1600) * 40"
        walk["wing_left"] = ("z", f"-(q.is_on_ground || q.is_in_water ? 0 : {flap})")
        walk["wing_right"] = ("z", f"q.is_on_ground || q.is_in_water ? 0 : {flap}")
    anim = {}
    for b, m in walk.items():
        axis, m = m if isinstance(m, tuple) else ("x", m)
        rot = [m, 0, 0] if axis == "x" else [0, 0, m]
        for name in (b, "a_" + b, "b_" + b):
            if name in bones:
                anim[name] = {"rotation": rot}
    if s.get("baby_look"):
        anim["b_head"] = {"rotation": ["q.target_x_rotation", "q.target_y_rotation", 0]}
    idle = {b: {"rotation": [0, "math.sin(q.life_time * 90) * 8", 0]} for b in ("a_tail", "b_tail") if b in bones}
    idle.update({b: {"rotation": ["math.sin(q.life_time * 60) * 2", 0, 0]} for b in ("a_head", "b_head") if b in bones})
    dip = EAT_DIP.get(sid, 45)
    ease = "math.clamp(q.anim_time * 3, 0, 1) * math.clamp((3 - q.anim_time) * 3, 0, 1)"
    eat = {b: {"rotation": [f"{ease} * ({dip} + math.sin(q.anim_time * 1080) * 6)", 0, 0]} for b in ("a_head", "b_head") if b in bones}
    dump(RP / "animations" / f"{sid}.animation.json", {"format_version": "1.8.0", "animations": {
        f"animation.{NS}.{sid}.walk": {"loop": True, "bones": anim},
        f"animation.{NS}.{sid}.idle": {"loop": True, "bones": idle},
        f"animation.{NS}.{sid}.eat": {"loop": False, "animation_length": 3.0, "bones": eat}}})
    print(sid, "bones:", bones)


if __name__ == "__main__":
    main(sys.argv[1])
