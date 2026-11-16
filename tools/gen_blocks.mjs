// Generates the behaviour-pack block files for the M3 blocks. Geometry and
// textures come from tools/gen_m3_art.py; bone names follow the models in art/blocks/ (and tools/art/blocks.py for the tanning rack).
//
// Run with: node tools/gen_blocks.mjs

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => import(pathToFileURL(join(root, "packs/BP/scripts/data", name)).href);
const { ANIMALS } = await load("animals.js");
const { BLOCKS } = await load("blocks.js");
const { PLACED_FOODS } = await load("placedFoods.js");

const NS = "kaleidoscope_ranching";
const S = (name) => `${NS}:${name}`;
const state = (name) => `q.block_state('${S(name)}')`;

const CARCASSES = ANIMALS.map((animal) => animal.id);

const FULL = { origin: [-8, 0, -8], size: [16, 16, 16] };
const box = (x, y, z, w, h, d) => ({ origin: [x, y, z], size: [w, h, d] });

const STATIONS = ["butter_churn", "cheese_press", "aging_rack", "fermenting_jar", "pickling_vat", "tanning_rack", "meat_grinder", "ice_cream_churn"];
// 1.1: stations that also run on the ranch clock with containers above and below (data/processing.js AUTO_STATIONS).
const AUTO_STATIONS = ["cream_separator", "spinning_wheel", "weaving_loom", "silage_barrel"];
// 1.1 毛毯: one block, dyed by state (systems/textiles.js); each colour has its own texture kr_rug_<colour>.
const RUG_COLORS = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];

// Boxes per placed-food shape (data/placedFoods.js `shape`), and the map colours that differ from the default.
const both = (x, y, z, w, h, d) => ({ collision: box(x, y, z, w, h, d), selection: box(x, y, z, w, h, d) });
const PLACED_SHAPES = {
  wheel: both(-6, 0, -6, 12, 5, 12),
  pizza: both(-8, 0, -8, 16, 3, 16),
  pot: both(-6, 0, -6, 12, 9, 12),
  dish: both(-7, 0, -5, 14, 4, 10),
};
const PLACED_COLORS = {
  cheese_wheel: "#e2b45a", vintage_cheese_wheel: "#c98a3c", smoked_cheese_wheel: "#8a5a32",
  placed_pizza: "#d86a3c", placed_fondue: "#3c3c44",
};

const DEFS = {
  butcher_rack: {
    component: "butcher_rack",
    // carcass_X: the animal as it was, skinned_X: hide off, cut_X: partly cut
    states: { [S("carcass")]: ["none", ...CARCASSES], [S("skinned")]: [false, true], [S("cut")]: [false, true] },
    bones: Object.fromEntries(
      CARCASSES.flatMap((id) => [
        [`carcass_${id}`, `${state("carcass")} == '${id}' && !${state("skinned")}`],
        [`skinned_${id}`, `${state("carcass")} == '${id}' && ${state("skinned")} && !${state("cut")}`],
        [`cut_${id}`, `${state("carcass")} == '${id}' && ${state("cut")}`],
      ])
    ),
    // Each animal has its own texture (art/blocks/butcher_rack_<id>.png, see tools/art/split_rack_texture.py).
    materials: CARCASSES,
    collision: FULL,
    selection: FULL,
    seconds: 1.5,
  },
  nest_box: {
    component: "nest_box",
    states: { [S("eggs")]: [0, 1, 2, 3, 4] },
    bones: Object.fromEntries([1, 2, 3, 4].map((n) => [`egg_${n}`, `${state("eggs")} >= ${n}`])),
    collision: box(-7, 0, -7, 14, 6, 14),
    selection: box(-7, 0, -7, 14, 6, 14),
    seconds: 1,
  },
  incubator: {
    component: "incubator",
    states: { [S("eggs")]: [0, 1, 2, 3, 4], [S("busy")]: [false, true] },
    bones: { ...Object.fromEntries([1, 2, 3, 4].map((n) => [`egg_${n}`, `${state("eggs")} >= ${n}`])), busy: state("busy") },
    collision: box(-7, 0, -7, 14, 12, 14),
    selection: box(-7, 0, -7, 14, 12, 14),
    seconds: 1,
    light: true,
  },
  // 1.1 擠奶架 (systems/milkingRack.js): one animal tied to it, milked once a day.
  milking_rack: {
    component: "milking_rack",
    states: {},
    bones: {},
    collision: box(-8, 0, -8, 16, 12, 16),
    selection: box(-8, 0, -8, 16, 12, 16),
    seconds: 1.5,
  },
  rug: {
    component: "rug",
    states: { [S("color")]: RUG_COLORS },
    bones: {},
    collision: box(-8, 0, -8, 16, 1, 16),
    selection: box(-8, 0, -8, 16, 1, 16),
    seconds: 0.2,
    textureByState: { state: "color", values: RUG_COLORS, texture: (color) => `kr_rug_${color}` },
  },
  // 1.1 畜欄門 (systems/workAnimals.js): the lower half carries the gate, the upper half
  // raises its collision to fence height; both open together.
  pen_gate: {
    component: "pen_gate",
    states: { [S("open")]: [false, true] },
    bones: { closed: `!${state("open")}`, open: state("open") },
    collision: FULL,
    selection: FULL,
    seconds: 1,
    openable: true,
  },
  pen_gate_top: {
    component: "pen_gate_top",
    states: { [S("open")]: [false, true] },
    bones: { closed: `!${state("open")}`, open: state("open") },
    collision: box(-8, 0, -8, 16, 8, 16),
    selection: box(-8, 0, -8, 16, 4, 16),
    seconds: 1,
    hidden: true,
    loot: "loot_tables/kaleidoscope_ranching/empty.json",
    openable: true,
  },
  horn_decor: { states: {}, bones: {}, collision: box(-4, 0, -4, 8, 6, 8), selection: box(-4, 0, -4, 8, 6, 8), seconds: 0.5 },
  // Decoration only: no script component.
  down_pillow: { states: {}, bones: {}, collision: box(-6, 0, -4, 12, 4, 8), selection: box(-6, 0, -4, 12, 4, 8), seconds: 0.2 },
  down_quilt: { states: {}, bones: {}, collision: box(-8, 0, -8, 16, 2, 16), selection: box(-8, 0, -8, 16, 2, 16), seconds: 0.2 },
  hitching_post: {
    component: "hitching_post",
    states: {},
    bones: {},
    collision: box(-3, 0, -3, 6, 16, 6),
    selection: box(-3, 0, -3, 6, 16, 6),
    seconds: 1,
  },
  hay_rack: {
    component: "hay_rack",
    states: { [S("hay")]: [0, 1, 2, 3] },
    bones: Object.fromEntries([1, 2, 3].map((n) => [`hay_${n}`, `${state("hay")} >= ${n}`])),
    collision: box(-8, 0, -6, 16, 16, 12),
    selection: box(-8, 0, -6, 16, 16, 12),
    seconds: 1,
  },
  // Placed food (data/placedFoods.js): the item's block_placer puts the block down. Wheels are cut
  // like a cake (systems/cheeseWheel.js), dishes are eaten a portion at a time (systems/placedFood.js);
  // the scripts drop what is left, so the blocks themselves drop nothing.
  ...Object.fromEntries(
    PLACED_FOODS.map((food) => [
      food.block,
      {
        component: food.cut ? "cheese_wheel" : "placed_food",
        states: { [S("cut")]: Array.from({ length: food.portions }, (_, n) => n) },
        bones: Object.fromEntries(
          Array.from({ length: food.portions }, (_, n) => [`piece_${n + 1}`, `${state("cut")} <= ${food.portions - 1 - n}`])
        ),
        ...PLACED_SHAPES[food.shape],
        mapColor: PLACED_COLORS[food.block],
        seconds: 0.5,
        hidden: true,
        loot: "loot_tables/kaleidoscope_ranching/empty.json",
      },
    ])
  ),
  // Food goes in, 廚餘 comes out (systems/foodWasteBin.js); `fill` shows the level, the
  // contents live in block data and drop when it breaks.
  food_waste_bin: {
    component: "food_waste_bin",
    states: { [S("fill")]: [0, 1, 2, 3, 4] },
    bones: Object.fromEntries([1, 2, 3, 4].map((n) => [`fill_${n}`, `${state("fill")} == ${n}`])),
    collision: box(-6, 0, -6, 12, 14, 12),
    selection: box(-6, 0, -6, 12, 14, 12),
    seconds: 1,
    mapColor: "#6f7a5a",
  },
  ...Object.fromEntries(
    AUTO_STATIONS.map((id) => [
      id,
      {
        component: "auto_station",
        states: { [S("busy")]: [false, true] },
        bones: { busy: state("busy") },
        collision: FULL,
        selection: FULL,
        seconds: 1.5,
      },
    ])
  ),
  ...Object.fromEntries(
    STATIONS.map((id) => [
      id,
      {
        component: "station",
        states: { [S("busy")]: [false, true] },
        bones: { busy: state("busy") },
        collision: FULL,
        selection: FULL,
        seconds: 1.5,
      },
    ])
  ),
};

const ROTATION = { north: 0, east: 270, south: 180, west: 90 };

function blockJson(id, def) {
  const components = {
    "minecraft:geometry": { identifier: `geometry.${NS}.${id}`, bone_visibility: def.bones },
    // Explicit name key, as for the items (gen_items.mjs).
    "minecraft:display_name": `tile.${S(id)}.name`,
    "minecraft:material_instances": {
      // Single-sided: plain alpha_test also draws back faces, which flickered against touching faces.
      "*": { texture: `kr_${id}`, render_method: "alpha_test_single_sided" },
      // Faces tagged with a material instance in the model use their own texture (the rack's carcasses).
      ...Object.fromEntries(
        (def.materials ?? []).map((m) => [m, { texture: `kr_${id}_${m}`, render_method: "alpha_test_single_sided" }])
      ),
    },
    "minecraft:collision_box": def.collision,
    "minecraft:selection_box": def.selection,
    "minecraft:destructible_by_mining": { seconds_to_destroy: def.seconds },
    "minecraft:destructible_by_explosion": { explosion_resistance: 3 },
    "minecraft:light_dampening": 0,
    "minecraft:map_color": def.mapColor ?? "#8a6a44",
    ...(def.loot ? { "minecraft:loot": def.loot } : {}),
    ...(def.component ? { [S(def.component)]: {} } : {}),
  };
  return {
    format_version: "1.21.90",
    "minecraft:block": {
      description: {
        identifier: S(id),
        menu_category: { category: def.hidden ? "none" : "items" },
        traits: {
          "minecraft:placement_direction": { enabled_states: ["minecraft:cardinal_direction"], y_rotation_offset: 180 },
        },
        states: def.states,
      },
      components,
      permutations: [
        ...Object.entries(ROTATION).map(([direction, degrees]) => ({
          condition: `q.block_state('minecraft:cardinal_direction') == '${direction}'`,
          components: { "minecraft:transformation": { rotation: [0, degrees, 0] } },
        })),
        ...(def.light ? [{ condition: state("busy"), components: { "minecraft:light_emission": 7 } }] : []),
        ...(def.openable ? [{ condition: state("open"), components: { "minecraft:collision_box": false } }] : []),
        ...(def.textureByState
          ? def.textureByState.values.map((value) => ({
              condition: `${state(def.textureByState.state)} == '${value}'`,
              components: { "minecraft:material_instances": { "*": { texture: def.textureByState.texture(value), render_method: "alpha_test_single_sided" } } },
            }))
          : []),
      ],
    },
  };
}

const registered = new Set(BLOCKS.map((block) => block.id));
const dir = join(root, "packs/BP/blocks");
mkdirSync(dir, { recursive: true });
for (const name of readdirSync(dir)) if (name.startsWith("r_")) rmSync(join(dir, name));
for (const [id, def] of Object.entries(DEFS)) {
  if (!registered.has(id)) throw new Error(`${id} is not in blocks.js`);
  writeFileSync(join(dir, `r_${id}.json`), JSON.stringify(blockJson(id, def), null, 2) + "\n");
}
console.log(`gen_blocks: wrote ${Object.keys(DEFS).length} blocks`);
