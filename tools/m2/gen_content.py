#!/usr/bin/env python3
"""Generate every M2 block / item / recipe / loot / lang / texture file from one
definition table (企劃書 · 可維護性約定). Run from the repo root:

    python3 tools/m2/gen_content.py

Re-running overwrites generated files only.

Repo integration: pack files go to packs/BP and packs/RP. Files every
milestone shares (language files, texture atlases, blocks.json) are written
to tools/fragments/m2/ instead, and `node tools/gen_shared.mjs` merges all
fragments into the final files.
"""
import json, os, random
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent.parent
BP, RP = ROOT / "packs" / "BP", ROOT / "packs" / "RP"
SHARED = ROOT / "tools" / "fragments" / "m2"
NS = "kaleidoscope_ranching"
FMT = "1.21.90"

# --------------------------------------------------------------------------
# Names: (zh_TW, zh_CN, en_US)
# --------------------------------------------------------------------------
BLOCK_NAMES = {
    "trough": ("飼槽", "饲槽", "Feed Trough"),
    "water_trough": ("水槽", "水槽", "Water Trough"),
    "auto_feeder": ("自動餵食器", "自动喂食器", "Auto Feeder"),
    "auto_waterer": ("自動飲水器", "自动饮水器", "Auto Waterer"),
    "chaff_cutter": ("鍘草機", "铡草机", "Chaff Cutter"),
    "feed_mixer": ("飼料攪拌桶", "饲料搅拌桶", "Feed Mixer"),
    "salt_lick": ("鹽磚", "盐砖", "Salt Lick"),
    "compost_bin": ("堆肥槽", "堆肥槽", "Compost Bin"),
    "alfalfa_crop": ("苜蓿", "苜蓿", "Alfalfa"),
    "manure": ("糞便", "粪便", "Manure"),
}
ITEM_NAMES = {
    "alfalfa_seeds": ("苜蓿種子", "苜蓿种子", "Alfalfa Seeds"),
    "alfalfa": ("苜蓿", "苜蓿", "Alfalfa"),
    "forage": ("飼草", "饲草", "Chopped Forage"),
    "mixed_feed": ("混合飼料", "混合饲料", "Mixed Feed"),
    "concentrate_feed": ("精飼料", "精饲料", "Concentrate Feed"),
    "manure_item": ("糞便", "粪便", "Manure"),
    "fertilizer": ("肥料", "肥料", "Fertilizer"),
    "pig_bristle": ("豬鬃", "猪鬃", "Pig Bristle"),
    "brush": ("毛刷", "毛刷", "Grooming Brush"),
    "ranch_notebook": ("牧場記事本", "牧场记事本", "Ranch Notebook"),
    "ear_tag": ("耳標", "耳标", "Ear Tag"),
    "manure_fork": ("糞叉", "粪叉", "Manure Fork"),
    "feed_bag": ("飼料袋", "饲料袋", "Feed Bag"),
    "alfalfa_cake": ("苜蓿草餅", "苜蓿草饼", "Alfalfa Cake"),
    "grain_cake": ("穀物糕", "谷物糕", "Grain Cake"),
    "beet_sugar_cube": ("甜菜糖塊", "甜菜糖块", "Beet Sugar Cube"),
    "carrot_chips": ("胡蘿蔔脆片", "胡萝卜脆片", "Carrot Chips"),
}

UI = {
    "notebook.title": ("牧場記事本", "牧场记事本", "Ranch Notebook"),
    "notebook.rename": ("命名", "命名", "Rename"),
    "notebook.rename_label": ("名字", "名字", "Name"),
    "notebook.close": ("關閉", "关闭", "Close"),
    "info.name": ("名字：%s", "名字：%s", "Name: %s"),
    "info.unnamed": ("（未命名）", "（未命名）", "(unnamed)"),
    "info.species": ("種類：%s", "种类：%s", "Species: %s"),
    "info.gender": ("性別：%s", "性别：%s", "Sex: %s"),
    "gender.male": ("公", "公", "Male"),
    "gender.female": ("母", "母", "Female"),
    "info.hearts": ("好感度：%s", "好感度：%s", "Affection: %s"),
    "info.pregnant": ("懷孕中：約 %s 天後生產", "怀孕中：约 %s 天后生产", "Pregnant: due in about %s days"),
    "info.not_pregnant": ("未懷孕", "未怀孕", "Not pregnant"),
    "info.pregnant_na": ("懷孕：—", "怀孕：—", "Pregnancy: —"),
    "info.ear_tag": ("耳標：%s", "耳标：%s", "Ear tag: %s"),
    "info.none": ("無", "无", "None"),
    "info.needs": ("今日需求：", "今日需求：", "Today's needs:"),
    "need.fed": ("飼料", "饲料", "Feed"),
    "need.water": ("飲水", "饮水", "Water"),
    "need.groom": ("照料", "照料", "Care"),
    "need.clean": ("清潔", "清洁", "Clean"),
    "roster.title": ("耳標名冊", "耳标名册", "Ear Tag Roster"),
    "roster.count": ("共 %s 隻掛上耳標的動物", "共 %s 只挂上耳标的动物", "%s tagged animals"),
    "roster.empty": ("還沒有掛上耳標的動物。", "还没有挂上耳标的动物。", "No tagged animals yet."),
    "roster.last_seen": ("最後位置：%s, %s, %s", "最后位置：%s, %s, %s", "Last seen: %s, %s, %s"),
    "settings.title": ("牧場設定", "牧场设定", "Ranch Settings"),
    "settings.clean_need": ("啟用「清潔」需求（糞便）", "启用“清洁”需求（粪便）", "Enable the Clean need (manure)"),
    "trough.status": ("飼槽：%s %s/%s", "饲槽：%s %s/%s", "Trough: %s %s/%s"),
    "trough.other_kind": ("飼槽裡還有別種飼料", "饲槽里还有别种饲料", "The trough holds a different feed"),
    "trough.full": ("飼槽已滿", "饲槽已满", "The trough is full"),
    "kind.0": ("空", "空", "Empty"),
    "kind.1": ("乾草飼料", "干草饲料", "Hay feed"),
    "kind.2": ("穀粒飼料", "谷粒饲料", "Grain feed"),
    "kind.3": ("蔬菜飼料", "蔬菜饲料", "Vegetable feed"),
    "kind.4": ("混合飼料", "混合饲料", "Mixed feed"),
    "kind.5": ("精飼料", "精饲料", "Concentrate"),
    # 1.1 孵化與飼料線
    "kind.6": ("青貯料", "青贮料", "Silage"),
    "kind.7": ("鈣質飼料", "钙质饲料", "Calcium feed"),
    "water.status": ("水槽：%s/%s", "水槽：%s/%s", "Water: %s/%s"),
    "waterer.ok": ("已接上水源", "已接上水源", "Connected to water"),
    "waterer.dry": ("需要緊鄰水源方塊", "需要紧邻水源方块", "Needs an adjacent water source"),
    "compost.filling": ("堆肥槽：糞便 %s/%s，放滿後加一份小麥", "堆肥槽：粪便 %s/%s，放满后加一份小麦", "Compost: manure %s/%s, then add wheat"),
    "compost.started": ("開始發酵", "开始发酵", "Fermenting"),
    "compost.progress": ("發酵中 %s%%", "发酵中 %s%%", "Fermenting %s%%"),
    "bag.status": ("飼料袋：%s %s/%s", "饲料袋：%s %s/%s", "Feed bag: %s %s/%s"),
    "care.petted": ("牠看起來很開心", "它看起来很开心", "It looks happy"),
    "care.brushed": ("刷好了", "刷好了", "All brushed"),
    "care.already_groomed": ("今天已經照料過了", "今天已经照料过了", "Already cared for today"),
    "care.treat_wrong": ("牠不太愛吃這個", "它不太爱吃这个", "It isn't keen on that"),
    "care.treat_full": ("今天已經吃過零食了", "今天已经吃过零食了", "It already had a treat today"),
    "care.ear_tagged": ("已掛上耳標 #%s", "已挂上耳标 #%s", "Ear tag #%s attached"),
    "care.ear_tag_already": ("這隻已經有耳標了", "这只已经有耳标了", "Already tagged"),
}

# --------------------------------------------------------------------------
# Geometry helpers (block units: x/z −8..8, y 0..16)
# --------------------------------------------------------------------------
def cube(origin, size, mat=None, faces_mat=None):
    ox, oy, oz = origin
    w, h, d = size
    def uv(u, v, su, sv):
        return {"uv": [u % 16, v % 16], "uv_size": [su, sv]}
    faces = {
        "north": uv(ox + 8, 16 - oy - h, w, h),
        "south": uv(ox + 8, 16 - oy - h, w, h),
        "east": uv(oz + 8, 16 - oy - h, d, h),
        "west": uv(oz + 8, 16 - oy - h, d, h),
        "up": uv(ox + 8, oz + 8, w, d),
        "down": uv(ox + 8, oz + 8, w, d),
    }
    for k, f in faces.items():
        m = (faces_mat or {}).get(k, mat)
        if m:
            f["material_instance"] = m
    return {"origin": list(origin), "size": list(size), "uv": faces}

def geo(name, bones):
    return {
        "format_version": "1.12.0",
        "minecraft:geometry": [{
            "description": {"identifier": f"geometry.{NS}.{name}", "texture_width": 16, "texture_height": 16},
            "bones": bones,
        }],
    }

def trough_bones(inner_mat, inner_bone):
    walls = [
        cube([-8, 0, -8], [16, 7, 1]), cube([-8, 0, 7], [16, 7, 1]),
        cube([-8, 0, -7], [1, 7, 14]), cube([7, 0, -7], [1, 7, 14]),
        cube([-7, 0, -7], [14, 2, 14]),
    ]
    return [
        {"name": "frame", "pivot": [0, 0, 0], "cubes": walls},
        {"name": inner_bone, "parent": "frame", "pivot": [0, 0, 0],
         "cubes": [cube([-7, 2, -7], [14, 3, 14], mat=inner_mat)]},
    ]

GEOMETRY = {
    "trough": geo("trough", trough_bones("feed", "feed")),
    "water_trough": geo("water_trough", trough_bones("water", "water")),
    "salt_lick": geo("salt_lick", [{"name": "lick", "pivot": [0, 0, 0],
                                     "cubes": [cube([-5, 0, -5], [10, 6, 10])]}]),
    "manure": geo("manure", [{"name": "pile", "pivot": [0, 0, 0], "cubes": [
        cube([-4, 0, -3], [6, 1, 5]), cube([-3, 1, -2], [4, 1, 3]), cube([2, 0, 1], [3, 1, 3])]}]),
    "cross": geo("cross", [{"name": "cross", "pivot": [0, 0, 0], "cubes": [
        {"origin": [-8, 0, 0], "size": [16, 16, 0], "pivot": [0, 0, 0], "rotation": [0, 45, 0],
         "uv": {"north": {"uv": [0, 0], "uv_size": [16, 16]}, "south": {"uv": [16, 0], "uv_size": [-16, 16]}}},
        {"origin": [-8, 0, 0], "size": [16, 16, 0], "pivot": [0, 0, 0], "rotation": [0, -45, 0],
         "uv": {"north": {"uv": [0, 0], "uv_size": [16, 16]}, "south": {"uv": [16, 0], "uv_size": [-16, 16]}}},
    ]}]),
}

# --------------------------------------------------------------------------
# Block definitions
# --------------------------------------------------------------------------
# Model blocks render single-sided: plain alpha_test draws back faces too, so the
# faces inside a model and faces that touch fought each other and flickered.
# (The alfalfa crop keeps alpha_test: its crossed planes are seen from both sides.)
SOLID = "alpha_test_single_sided"

def mats(default, **named):
    m = {"*": {"texture": default, "render_method": SOLID}}
    for k, v in named.items():
        m[k] = {"texture": v, "render_method": SOLID}
    return m

def box(x, y, z, w, h, d):
    return {"origin": [x, y, z], "size": [w, h, d]}

# ## Troughs, water troughs, auto feeders and salt licks used to carry a
# ## minecraft:tick component. They now run on the shared ranch clock
# ## (scripts/core/blockClock.js), so the block files carry no tick.

def state(name, lo, hi):
    return {f"{NS}:{name}": {"values": {"min": lo, "max": hi}}}

def q(name):
    return f"q.block_state('{NS}:{name}')"

# 1.1: silage looks like mixed feed and calcium feed like grain until they get their own art.
FEED_TEX = {1: "kr_feed_grass", 2: "kr_feed_grain", 3: "kr_feed_veg", 4: "kr_feed_mixed", 5: "kr_feed_concentrate", 6: "kr_feed_mixed", 7: "kr_feed_grain"}

def block_defs():
    B = {}
    low = box(-8, 0, -8, 16, 8, 16)
    B["trough"] = dict(
        states={**state("fill", 0, 15), **state("kind", 0, 7)},
        components={
            "minecraft:geometry": {"identifier": f"geometry.{NS}.trough",
                                   "bone_visibility": {"feed": f"{q('fill')} > 0"}},
            "minecraft:material_instances": mats("kr_trough", feed=FEED_TEX[1]),
            "minecraft:collision_box": low, "minecraft:selection_box": low,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.0},
            "minecraft:map_color": "#8a5a32", "minecraft:light_dampening": 0,
            f"{NS}:trough": {},
        },
        permutations=[{"condition": f"{q('kind')} == {k}",
                       "components": {"minecraft:material_instances": mats("kr_trough", feed=t)}}
                      for k, t in FEED_TEX.items()],
    )
    B["water_trough"] = dict(
        states=state("water", 0, 3),
        components={
            "minecraft:geometry": {"identifier": f"geometry.{NS}.water_trough",
                                   "bone_visibility": {"water": f"{q('water')} > 0"}},
            "minecraft:material_instances": mats("kr_water_trough", water="kr_water"),
            "minecraft:collision_box": low, "minecraft:selection_box": low,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5},
            "minecraft:map_color": "#7d7d7d", "minecraft:light_dampening": 0,
            f"{NS}:water_trough": {},
        },
    )
    B["auto_waterer"] = dict(
        components={
            "minecraft:geometry": {"identifier": f"geometry.{NS}.water_trough"},
            "minecraft:material_instances": mats("kr_auto_waterer", water="kr_water"),
            "minecraft:collision_box": low, "minecraft:selection_box": low,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5},
            "minecraft:map_color": "#6d7f8a", "minecraft:light_dampening": 0,
            f"{NS}:auto_waterer": {},
        },
    )
    full = lambda top, side, bottom=None: {
        "minecraft:geometry": "minecraft:geometry.full_block",
        "minecraft:material_instances": {
            "*": {"texture": side}, "up": {"texture": top}, "down": {"texture": bottom or top},
        },
    }

    # A hand-made model in art/blocks/<id>.geo.json (art_src/m4_scripts/blocks_m2.py, installed by
    # tools/gen_m3_art.py with the terrain key kr_<id>) replaces the textured full cube. The model
    # fills the block, so collision stays the default full cube.
    def handmade(bid, bones=None):
        if not (ROOT / "art" / "blocks" / f"{bid}.geo.json").exists():
            return None
        geo = {"identifier": f"geometry.{NS}.{bid}"}
        if bones:
            geo["bone_visibility"] = bones
        return {"minecraft:geometry": geo, "minecraft:material_instances": mats(f"kr_{bid}"),
                "minecraft:light_dampening": 0}

    look = lambda bid, *textures: handmade(bid) or full(*textures)
    B["auto_feeder"] = dict(components={
        **look("auto_feeder", "kr_auto_feeder_top", "kr_auto_feeder_side"),
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0}, "minecraft:map_color": "#5b5b5b",
        f"{NS}:auto_feeder": {},
    })
    B["chaff_cutter"] = dict(components={
        **look("chaff_cutter", "kr_chaff_cutter_top", "kr_chaff_cutter_side", "kr_planks"),
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0}, "minecraft:map_color": "#8a5a32",
        "minecraft:crafting_table": {"table_name": f"tile.{NS}:chaff_cutter.name",
                                     "crafting_tags": [f"{NS}_chaff_cutter"]},
    })
    B["feed_mixer"] = dict(components={
        **look("feed_mixer", "kr_feed_mixer_top", "kr_feed_mixer_side", "kr_planks"),
        "minecraft:destructible_by_mining": {"seconds_to_destroy": 2.0}, "minecraft:map_color": "#9a6a3a",
        "minecraft:crafting_table": {"table_name": f"tile.{NS}:feed_mixer.name",
                                     "crafting_tags": [f"{NS}_feed_mixer"]},
    })
    lick = box(-5, 0, -5, 10, 6, 10)
    B["salt_lick"] = dict(
        states=state("bites", 0, 6),
        components={
            "minecraft:geometry": f"geometry.{NS}.salt_lick",
            "minecraft:material_instances": mats("kr_salt_lick"),
            "minecraft:collision_box": lick, "minecraft:selection_box": lick,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.0},
            "minecraft:map_color": "#e8d8d0", "minecraft:light_dampening": 0,
            "minecraft:loot": f"loot_tables/{NS}/empty.json",
            f"{NS}:salt_lick": {},
        },
    )
    comp = lambda top: full(top, "kr_compost_bin_side", "kr_planks")
    # Hand-made bin: the contents are bones (manure_1..4 by load, fermenting, ready) instead of
    # per-state top textures.
    bin_model = handmade("compost_bin", {
        **{f"manure_{n}": f"{q('stage')} == 0 && {q('manure')} == {n}" for n in (1, 2, 3, 4)},
        "fermenting": f"{q('stage')} == 1",
        "ready": f"{q('stage')} == 2",
    })
    B["compost_bin"] = dict(
        states={**state("stage", 0, 2), **state("manure", 0, 4)},
        components={
            **(bin_model or comp("kr_compost_bin_top_empty")),
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 1.5}, "minecraft:map_color": "#6b4a2a",
            f"{NS}:compost_bin": {},
        },
        permutations=[] if bin_model else [
            {"condition": f"{q('stage')} == 0 && {q('manure')} > 0",
             "components": {"minecraft:material_instances": comp("kr_compost_bin_top_manure")["minecraft:material_instances"]}},
            {"condition": f"{q('stage')} == 1",
             "components": {"minecraft:material_instances": comp("kr_compost_bin_top_fermenting")["minecraft:material_instances"]}},
            {"condition": f"{q('stage')} == 2",
             "components": {"minecraft:material_instances": comp("kr_compost_bin_top_ready")["minecraft:material_instances"]}},
        ],
    )
    crop_sel = box(-8, 0, -8, 16, 6, 16)
    B["alfalfa_crop"] = dict(
        menu=False,
        states=state("growth", 0, 3),
        components={
            "minecraft:geometry": f"geometry.{NS}.cross",
            "minecraft:material_instances": {"*": {"texture": "kr_alfalfa_stage0", "render_method": "alpha_test",
                                                   "face_dimming": False, "ambient_occlusion": False}},
            "minecraft:collision_box": False, "minecraft:selection_box": crop_sel,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 0},
            "minecraft:light_dampening": 0, "minecraft:map_color": "#5f9e3a",
            "minecraft:placement_filter": {"conditions": [
                {"allowed_faces": ["up"], "block_filter": ["minecraft:farmland"]}]},
            "minecraft:loot": f"loot_tables/{NS}/alfalfa_young.json",
            "minecraft:random_offset": None,
            f"{NS}:alfalfa_crop": {},
        },
        permutations=[
            {"condition": f"{q('growth')} == {g}",
             "components": {"minecraft:material_instances": {"*": {
                 "texture": f"kr_alfalfa_stage{g}", "render_method": "alpha_test",
                 "face_dimming": False, "ambient_occlusion": False}},
                 **({"minecraft:loot": f"loot_tables/{NS}/alfalfa_mature.json"} if g == 3 else {})}}
            for g in range(1, 4)
        ],
    )
    B["alfalfa_crop"]["components"].pop("minecraft:random_offset")
    pile = box(-5, 0, -5, 10, 2, 10)
    B["manure"] = dict(
        menu=False,
        components={
            "minecraft:geometry": f"geometry.{NS}.manure",
            "minecraft:material_instances": mats("kr_manure"),
            "minecraft:collision_box": False, "minecraft:selection_box": pile,
            "minecraft:destructible_by_mining": {"seconds_to_destroy": 0.2},
            "minecraft:light_dampening": 0, "minecraft:map_color": "#5a3e22",
            "minecraft:loot": f"loot_tables/{NS}/manure.json",
            "minecraft:placement_filter": {"conditions": [{"allowed_faces": ["up"]}]},
        },
    )
    return B

# --------------------------------------------------------------------------
# Item definitions
# --------------------------------------------------------------------------
TOOLS = {"brush", "ranch_notebook", "ear_tag", "feed_bag", "manure_fork"}


def item_defs():
    feed_tag = {"minecraft:tags": {"tags": [f"{NS}:feed"]}}
    I = {
        "alfalfa_seeds": {"minecraft:block_placer": {"block": f"{NS}:alfalfa_crop",
                                                     "use_on": ["minecraft:farmland"]}},
        "alfalfa": dict(feed_tag),
        "forage": dict(feed_tag),
        "mixed_feed": dict(feed_tag),
        "concentrate_feed": dict(feed_tag),
        "manure_item": {},
        "fertilizer": {f"{NS}:fertilizer": {}},
        "pig_bristle": {},
        "brush": {"minecraft:max_stack_size": 1, "minecraft:hand_equipped": True,
                  "minecraft:durability": {"max_durability": 64},
                  "minecraft:tags": {"tags": [f"{NS}:brush"]}},
        "ranch_notebook": {"minecraft:max_stack_size": 1},
        "ear_tag": {},
        "manure_fork": {"minecraft:max_stack_size": 1, "minecraft:hand_equipped": True,
                        "minecraft:durability": {"max_durability": 128}, f"{NS}:manure_fork": {}},
        "feed_bag": {"minecraft:max_stack_size": 1, f"{NS}:feed_bag": {}},
        "alfalfa_cake": {}, "grain_cake": {}, "beet_sugar_cube": {}, "carrot_chips": {},
    }
    return I

# --------------------------------------------------------------------------
# Recipes
# --------------------------------------------------------------------------
R = []
def it(i):
    return {"tag": i[4:]} if i.startswith("tag:") else {"item": i}
def unlock(ingredients):
    """1.20+ recipes need unlock data: shown once the player holds any ingredient (tags cannot unlock)."""
    items = []
    for ingredient in ingredients:
        if "item" in ingredient and {"item": ingredient["item"]} not in items:
            items.append({"item": ingredient["item"]})
    return items or [{"context": "AlwaysUnlocked"}]

def shaped(name, pattern, key, result, count=1, tag="crafting_table"):
    R.append((name, {"format_version": "1.20.10", "minecraft:recipe_shaped": {
        "description": {"identifier": f"{NS}:{name}"}, "tags": [tag], "pattern": pattern,
        "key": {k: it(v) for k, v in key.items()},
        "result": {"item": result if ":" in result else f"{NS}:{result}", "count": count},
        "unlock": unlock([it(v) for v in key.values()])}}))
def shapeless(name, ingredients, result, count=1, tag="crafting_table"):
    ing = []
    for x in ingredients:
        i, n = (x if isinstance(x, tuple) else (x, 1))
        ing.append({**it(i if ":" in i else f"{NS}:{i}"), "count": n})
    R.append((name, {"format_version": "1.20.10", "minecraft:recipe_shapeless": {
        "description": {"identifier": f"{NS}:{name}"}, "tags": [tag], "ingredients": ing,
        "result": {"item": result if ":" in result else f"{NS}:{result}", "count": count},
        "unlock": unlock(ing)}}))

def recipes():
    P, I = "tag:minecraft:planks", "minecraft:iron_ingot"
    shaped("trough", ["P P", "PPP"], {"P": P}, "trough")
    shaped("water_trough", ["C C", "CIC"], {"C": "minecraft:cobblestone", "I": I}, "water_trough")
    shaped("auto_feeder", ["I I", "IHI"], {"I": I, "H": "minecraft:hopper"}, "auto_feeder")
    shapeless("auto_waterer", ["water_trough", "minecraft:bucket", "minecraft:iron_ingot"], "auto_waterer")
    shaped("chaff_cutter", ["III", "PSP", "P P"], {"I": I, "P": P, "S": "minecraft:shears"}, "chaff_cutter")
    shapeless("feed_mixer", ["minecraft:barrel", "minecraft:iron_ingot", "minecraft:stick"], "feed_mixer")
    shapeless("salt_lick", [("minecraft:clay_ball", 2), ("minecraft:bone_meal", 2)], "salt_lick")
    shaped("compost_bin", ["P P", "P P", "PPP"], {"P": P}, "compost_bin")
    shaped("brush_bristle", ["B", "S"], {"B": f"{NS}:pig_bristle", "S": "minecraft:stick"}, "brush")
    shaped("brush_wool", ["W", "S"], {"W": "minecraft:white_wool", "S": "minecraft:stick"}, "brush")
    shapeless("ranch_notebook", ["minecraft:book", "minecraft:wheat"], "ranch_notebook")
    shapeless("ear_tag", ["minecraft:iron_nugget", "minecraft:paper"], "ear_tag", 4)
    shaped("manure_fork", ["I I", " S ", " S "], {"I": I, "S": "minecraft:stick"}, "manure_fork")
    shaped("feed_bag", ["L L", "LWL", "LLL"], {"L": "minecraft:leather", "W": "minecraft:wheat"}, "feed_bag")
    # forage: hand crafting vs chaff cutter (cutter yields more, 企劃書)
    shapeless("forage_hand", [("minecraft:wheat", 3)], "forage", 2)
    cut = f"{NS}_chaff_cutter"
    shapeless("forage_wheat", ["minecraft:wheat"], "forage", 2, tag=cut)
    shapeless("forage_grass", [("minecraft:short_grass", 2)], "forage", 1, tag=cut)
    shapeless("forage_alfalfa", ["alfalfa"], "forage", 3, tag=cut)
    shapeless("forage_hay", ["minecraft:hay_block"], "forage", 12, tag=cut)
    mix = f"{NS}_feed_mixer"
    # food_waste: scraps from Ranching's food waste bin (systems/foodWasteBin.js)
    for extra in ["minecraft:wheat_seeds", "minecraft:carrot", "minecraft:potato", "minecraft:beetroot", f"{NS}:food_waste"]:
        shapeless(f"mixed_feed_{extra.split(':')[1]}", [("forage", 2), "alfalfa", extra], "mixed_feed", 4, tag=mix)
    shapeless("concentrate_feed", [("mixed_feed", 2), ("minecraft:wheat", 2), "minecraft:bone_meal"],
              "concentrate_feed", 4, tag=mix)
    # treats
    shapeless("alfalfa_cake", [("alfalfa", 2), "minecraft:sugar"], "alfalfa_cake", 2)
    shapeless("grain_cake", [("minecraft:wheat_seeds", 2), "minecraft:wheat"], "grain_cake", 2)
    shapeless("beet_sugar_cube", ["minecraft:beetroot", "minecraft:sugar"], "beet_sugar_cube", 2)
    shapeless("carrot_chips", ["minecraft:carrot", "minecraft:sugar"], "carrot_chips", 2)

LOOT = {
    "empty": {"pools": []},
    "manure": {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"{NS}:manure_item", "weight": 1}]}]},
    "alfalfa_young": {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": f"{NS}:alfalfa_seeds", "weight": 1}]}]},
    "alfalfa_mature": {"pools": [
        {"rolls": 1, "entries": [{"type": "item", "name": f"{NS}:alfalfa", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 1, "max": 2}}]}]},
        {"rolls": 1, "entries": [{"type": "item", "name": f"{NS}:alfalfa_seeds", "weight": 1,
                                  "functions": [{"function": "set_count", "count": {"min": 1, "max": 2}}]}]},
    ]},
}

# --------------------------------------------------------------------------
# Placeholder pixel art (M0 art pass replaces these)
# --------------------------------------------------------------------------
PAL = {
    "wood": [(122, 80, 44), (146, 98, 56), (170, 118, 70), (96, 62, 34)],
    "stone": [(110, 110, 112), (132, 132, 134), (150, 150, 152), (90, 90, 92)],
    "iron": [(170, 172, 178), (200, 202, 208), (225, 228, 232), (130, 132, 138)],
}
rnd = random.Random(7)

def noise(base, var=10):
    return tuple(max(0, min(255, c + rnd.randint(-var, var))) for c in base)

def tex_planks():
    im = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            c = PAL["wood"][1] if (y // 4) % 2 == 0 else PAL["wood"][2]
            if y % 4 == 3: c = PAL["wood"][3]
            if (x + (y // 4) * 5) % 16 == 0: c = PAL["wood"][3]
            im.putpixel((x, y), noise(c, 6) + (255,))
    return im

def tex_fill(base, var=12, border=None):
    im = Image.new("RGBA", (16, 16))
    for y in range(16):
        for x in range(16):
            c = noise(base, var)
            if border and (x in (0, 15) or y in (0, 15)): c = border
            im.putpixel((x, y), c + (255,))
    return im

def tex_speckle(base, dots, density=0.25):
    im = tex_fill(base, 8)
    for y in range(16):
        for x in range(16):
            if rnd.random() < density:
                im.putpixel((x, y), noise(rnd.choice(dots), 8) + (255,))
    return im

def tex_top_with_inner(inner, rim=PAL["wood"][3], var=10):
    im = tex_planks()
    for y in range(2, 14):
        for x in range(2, 14):
            im.putpixel((x, y), noise(inner, var) + (255,))
    for i in range(16):
        for p in [(i, 0), (i, 15), (0, i), (15, i)]:
            im.putpixel(p, rim + (255,))
    return im

def sprite(rows, colors):
    """rows: 16 strings; '.' transparent; other chars map to colors."""
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        for x, ch in enumerate(row.ljust(16, ".")):
            if ch != ".":
                im.putpixel((x, y), colors[ch] + (255,))
    return im

def crop(stage):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    h = [4, 7, 11, 14][stage]
    for stem in (3, 6, 9, 12):
        top = 16 - h + rnd.randint(0, 2)
        for y in range(top, 16):
            im.putpixel((stem, y), noise((70, 140, 50), 10) + (255,))
            if y % 3 == 0 and stem + 1 < 16:
                im.putpixel((stem + 1, y), noise((95, 170, 60), 10) + (255,))
        if stage == 3:
            for dx, dy in [(0, 0), (1, 0), (0, 1)]:
                im.putpixel((min(15, stem + dx), top + dy), (150, 110, 200, 255))
    return im

def blocks_textures():
    T = {}
    T["kr_planks"] = tex_planks()
    T["kr_trough"] = tex_planks()
    for k, c in {"grass": (196, 178, 92), "grain": (214, 184, 112), "veg": (200, 120, 60),
                 "mixed": (170, 150, 90), "concentrate": (150, 110, 70)}.items():
        T[f"kr_feed_{k}"] = tex_speckle(c, [(120, 160, 60), (230, 210, 140)], 0.2)
    T["kr_water_trough"] = tex_fill(PAL["stone"][1], 10)
    T["kr_auto_waterer"] = tex_fill(PAL["iron"][0], 8)
    T["kr_water"] = tex_fill((60, 110, 200), 8)
    T["kr_auto_feeder_side"] = tex_fill(PAL["iron"][3], 8, border=(70, 70, 74))
    T["kr_auto_feeder_top"] = tex_top_with_inner((50, 50, 54), rim=(70, 70, 74))
    T["kr_chaff_cutter_side"] = tex_planks()
    cc = tex_planks()
    for x in range(1, 15):
        cc.putpixel((x, 7), PAL["iron"][2] + (255,)); cc.putpixel((x, 8), PAL["iron"][3] + (255,))
    T["kr_chaff_cutter_top"] = cc
    T["kr_feed_mixer_side"] = tex_planks()
    T["kr_feed_mixer_top"] = tex_top_with_inner((170, 150, 90))
    T["kr_salt_lick"] = tex_speckle((228, 214, 206), [(240, 200, 196), (250, 245, 240)], 0.3)
    T["kr_compost_bin_side"] = tex_planks()
    T["kr_compost_bin_top_empty"] = tex_top_with_inner((60, 40, 24))
    T["kr_compost_bin_top_manure"] = tex_top_with_inner((96, 66, 36))
    T["kr_compost_bin_top_fermenting"] = tex_top_with_inner((80, 64, 40))
    T["kr_compost_bin_top_ready"] = tex_top_with_inner((52, 36, 26))
    T["kr_manure"] = tex_speckle((96, 66, 36), [(70, 48, 26), (120, 86, 50)], 0.35)
    for g in range(4):
        T[f"kr_alfalfa_stage{g}"] = crop(g)
    return T

def item_textures():
    C = {"w": (146, 98, 56), "W": (96, 62, 34), "g": (95, 170, 60), "G": (60, 120, 40),
         "p": (150, 110, 200), "y": (214, 184, 112), "Y": (180, 150, 80), "b": (96, 66, 36),
         "B": (70, 48, 26), "i": (200, 202, 208), "I": (130, 132, 138), "r": (190, 60, 50),
         "k": (60, 50, 40), "o": (230, 140, 60), "s": (240, 236, 228), "S": (200, 190, 180),
         "c": (230, 210, 140), "m": (170, 150, 90), "n": (110, 80, 50), "R": (140, 30, 40),
         "l": (150, 100, 60), "L": (110, 70, 40)}
    S = {}
    S["alfalfa_seeds"] = sprite(["", "", "", "", "", "......y.........", "....y...y.......", ".......Y..y.....",
                                 "...y..........", ".....Y..y.Y.....", "...y.......y....", ".....y..Y.......",
                                 "........y.......", "", "", ""], C)
    S["alfalfa"] = sprite(["", "......p.p.......", ".....ppgp.......", "......gpg.......", ".....g.g.g......",
                           "....gg.g.gg.....", "......ggg.......", ".....g.g.g......", "....g..g..g.....",
                           ".......g........", "......Gg........", ".......G........", ".......G........",
                           ".......G........", "", ""], C)
    S["forage"] = sprite(["", "", "....y.Y.y.......", "...yYyyYyy......", "..yyYyYyyYy.....", "..YyyyYyyyy.....",
                          "...yYyyyYy......", "....yyYyy.......", "", "", "", "", "", "", "", ""], C)
    def sack(fill):
        rows = ["", ".....ww.........", "....wWWw........", "....wkkw........", "...wwwwww.......",
                "..wwFFFFww......", "..wFFFFFFw......", "..wFFFFFFw......", "..wFFFFFFw......",
                "..wwFFFFww......", "...wwwwww.......", "", "", "", "", ""]
        return sprite([r.replace("F", "f") for r in rows], {**C, "f": fill})
    S["mixed_feed"] = sack(C["m"])
    S["concentrate_feed"] = sack(C["n"])
    S["manure_item"] = sprite(["", "", "", "", "", "", "......bb........", ".....bBbb.......", "....bbbBbb......",
                               "...bBbbbbBb.....", "...bbbBbbbb.....", "", "", "", "", ""], C)
    S["fertilizer"] = sprite(["", "", "....wwwww.......", "....wkkkw.......", "...wwwwwww......", "...wgGgGgw......",
                              "...wGgGgGw......", "...wgGgGgw......", "...wGgGgGw......", "...wwwwwww......",
                              "", "", "", "", "", ""], C)
    S["pig_bristle"] = sprite(["", "", "......S.S.......", ".....S.S.S......", "......SSS.......", ".....S.S.S......",
                               "......SSS.......", ".......S........", "", "", "", "", "", "", "", ""], C)
    S["brush"] = sprite(["", "", "...SSSSSS.......", "...SSSSSS.......", "...wwwwww.......", "...wWWWWw.......",
                         "......ww........", "......wW........", ".......wW.......", "........wW......",
                         ".........wW.....", "..........W.....", "", "", "", ""], C)
    S["ranch_notebook"] = sprite(["", "...LLLLLLLLL....", "...LlllllllL....", "...LlssssslL....", "...LlsyyyslL....",
                                  "...LlssssslL....", "...LlllllllL....", "...LlgggggL.....", "...LlllllllL....",
                                  "...LlllllllL....", "...LLLLLLLLL....", "", "", "", "", ""], C)
    S["ear_tag"] = sprite(["", "", "......I.........", ".....oIo........", "....ooooo.......", "....okkko.......",
                           "....ooooo.......", "....ooooo.......", ".....ooo........", "", "", "", "", "", "", ""], C)
    S["manure_fork"] = sprite(["", "...i.i.i........", "...i.i.i........", "...i.i.i........", "...iiiii........",
                               ".....w..........", ".....w..........", ".....W..........", ".....w..........",
                               ".....W..........", ".....w..........", ".....W..........", "", "", "", ""], C)
    S["feed_bag"] = sprite(["", "......kk........", ".....l..l.......", "....LLLLLL......", "...LllllllL.....",
                            "...LlyyyylL.....", "...LllllllL.....", "...LllllllL.....", "...LllllllL.....",
                            "....LLLLLL......", "", "", "", "", "", ""], C)
    S["alfalfa_cake"] = sprite(["", "", "", "", "....gggggg......", "...gGgGgGgg.....", "...gggggggg.....",
                                "...GgGgGgGG.....", "....GGGGGG......", "", "", "", "", "", "", ""], C)
    S["grain_cake"] = sprite(["", "", "", "", "....cccccc......", "...cYcYcYcc.....", "...cccccccc.....",
                              "...YcYcYcYY.....", "....YYYYYY......", "", "", "", "", "", "", ""], C)
    S["beet_sugar_cube"] = sprite(["", "", "", "", ".....RRRR.......", "....RrrrRR......", "....RrsrRR......",
                                   "....RrrrRR......", ".....RRRR.......", "", "", "", "", "", "", ""], C)
    S["carrot_chips"] = sprite(["", "", "", "", "...oo...........", "..oOOo..oo......", "...oo..oOOo.....",
                                "........oo......", "....oo..........", "...oOOo.........", "....oo..........",
                                "", "", "", "", ""], {**C, "O": (250, 180, 90)})
    return S

# --------------------------------------------------------------------------
# Writers
# --------------------------------------------------------------------------
def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def main():
    blocks = block_defs()
    for name, d in blocks.items():
        desc = {"identifier": f"{NS}:{name}"}
        if d.get("menu", True):
            desc["menu_category"] = {"category": "items"}
        else:
            desc["menu_category"] = {"category": "none"}
        if d.get("states"):
            desc["states"] = d["states"]
        comps = {"minecraft:display_name": f"tile.{NS}:{name}.name", **d["components"]}
        body = {"description": desc, "components": comps}
        if d.get("permutations"):
            body["permutations"] = d["permutations"]
        write_json(BP / "blocks" / f"{name}.json", {"format_version": FMT, "minecraft:block": body})

    for name, comps in item_defs().items():
        # Tools go in the Equipment tab, like the other Ranching tools.
        category = "equipment" if name in TOOLS else "items"
        write_json(BP / "items" / f"{name}.json", {"format_version": FMT, "minecraft:item": {
            "description": {"identifier": f"{NS}:{name}", "menu_category": {"category": category}},
            # The explicit key keeps the name working inside a creative catalog group (gen_catalog.mjs).
            "components": {"minecraft:icon": f"kr_{name}",
                           "minecraft:display_name": {"value": f"item.{NS}:{name}.name"}, **comps}}})

    recipes()
    for name, data in R:
        write_json(BP / "recipes" / f"{name}.json", data)
    for name, data in LOOT.items():
        write_json(BP / "loot_tables" / NS / f"{name}.json", data)

    for name, g in GEOMETRY.items():
        write_json(RP / "models" / "blocks" / f"{NS}.{name}.geo.json", g)

    def save_png(im, path):
        # Keep the committed bytes when the pixels match, so another machine's PNG encoder
        # does not rewrite every texture on a rerun.
        if path.exists():
            with Image.open(path) as old:
                if old.mode == im.mode and old.size == im.size and old.tobytes() == im.tobytes():
                    return
        im.save(path)

    tex_dir = RP / "textures" / "blocks" / NS
    tex_dir.mkdir(parents=True, exist_ok=True)
    terrain = {}
    for key, im in blocks_textures().items():
        save_png(im, tex_dir / f"{key}.png")
        terrain[key] = {"textures": f"textures/blocks/{NS}/{key}"}
    write_json(SHARED / "terrain_texture.json", {
        "resource_pack_name": NS, "texture_name": "atlas.terrain", "padding": 8, "num_mip_levels": 4,
        "texture_data": terrain})

    itex_dir = RP / "textures" / "items" / NS
    itex_dir.mkdir(parents=True, exist_ok=True)
    itemtex = {}
    for key, im in item_textures().items():
        save_png(im, itex_dir / f"{key}.png")
        itemtex[f"kr_{key}"] = {"textures": f"textures/items/{NS}/{key}"}
    write_json(SHARED / "item_texture.json", {
        "resource_pack_name": NS, "texture_name": "atlas.items", "texture_data": itemtex})

    # blocks.json: sounds
    sounds = {"trough": "wood", "water_trough": "stone", "auto_waterer": "metal", "auto_feeder": "metal",
              "chaff_cutter": "wood", "feed_mixer": "wood", "salt_lick": "stone", "compost_bin": "wood",
              "alfalfa_crop": "grass", "manure": "gravel"}
    write_json(SHARED / "blocks.json", {"format_version": "1.21.40",
                                    **{f"{NS}:{k}": {"sound": v} for k, v in sounds.items()}})

    for li, lang in enumerate(["zh_TW", "zh_CN", "en_US"]):
        out = [f"## 森羅物語：樂牧 · M2 照顧核心 ({lang})"]
        for k, v in BLOCK_NAMES.items():
            out.append(f"tile.{NS}:{k}.name={v[li]}")
        for k, v in ITEM_NAMES.items():
            out.append(f"item.{NS}:{k}.name={v[li]}")
        for k, v in UI.items():
            out.append(f"{NS}.ui.{k}={v[li]}")
        p = SHARED / "texts" / f"{lang}.lang"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("\n".join(out) + "\n", encoding="utf-8")

    print(f"blocks {len(blocks)}, items {len(item_defs())}, recipes {len(R)}, "
          f"block textures {len(terrain)}, item textures {len(itemtex)}")

if __name__ == "__main__":
    main()
