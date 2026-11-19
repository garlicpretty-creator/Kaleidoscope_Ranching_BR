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
const { AUTO_STATIONS, DRYING_LOOKS, DRYING_SLOTS, DRYING_STAGES, STATIONS } = await load("processing.js");
const { STATION_FRAMES } = await load("stationFrames.js");

const NS = "kaleidoscope_ranching";
const S = (name) => `${NS}:${name}`;
const state = (name) => `q.block_state('${S(name)}')`;

const CARCASSES = ANIMALS.map((animal) => animal.id);

const FULL = { origin: [-8, 0, -8], size: [16, 16, 16] };
const box = (x, y, z, w, h, d) => ({ origin: [x, y, z], size: [w, h, d] });

// Processing stations (data/processing.js): STATIONS are worked by hand, AUTO_STATIONS also run on the
// ranch clock with containers above and below.
//
// Stages (systems/stations.js): `busy` is true while a batch is in the station, `stage` 1..3 is the
// third of its time it has reached (1 again when idle). Bone `busy` holds the parts shown all through
// the job (a weight, the cords); busy_1..busy_3 hold the contents in each stage's colours
// (art_src/m4_scripts/station_stages.py), one shown at a time. A world saved before stages loads with
// stage 1, the state's first value.
const STAGES = [1, 2, 3];
// 1.1 工作台互動動畫 (data/stationFrames.js, core/blockFrames.js): a station with a moving part
// draws it in `frames` positions, bones <bone>_0.., and the `frame` state shows one of them.
const frameStates = (id) => {
  const spec = STATION_FRAMES[id];
  return spec ? { [S("frame")]: Array.from({ length: spec.frames }, (_, n) => n) } : {};
};
const frameBones = (id) => {
  const spec = STATION_FRAMES[id];
  return spec ? Object.fromEntries(Array.from({ length: spec.frames }, (_, n) => [`${spec.bone}_${n}`, `${state("frame")} == ${n}`])) : {};
};
const stationDef = (component, id) => ({
  component,
  states: { [S("busy")]: [false, true], [S("stage")]: STAGES, ...frameStates(id) },
  bones: {
    busy: state("busy"),
    ...Object.fromEntries(STAGES.map((n) => [`busy_${n}`, `${state("busy")} && ${state("stage")} == ${n}`])),
    ...frameBones(id),
  },
  collision: FULL,
  selection: FULL,
  seconds: 1.5,
});
// 1.1 地毯: one block, dyed by state (systems/textiles.js); each colour has its own texture kr_rug_<colour>.
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
  claypot: both(-6, 0, -6, 12, 5, 12),
  dish: both(-7, 0, -5, 14, 4, 10),
  roast: both(-6, 0, -5, 12, 5, 10),
  // The fondue's forks stand over the rim of its pot.
  fondue: both(-6, 0, -6, 12, 11, 12),
  // Placed drinks (art_src/m4_scripts/placed_drink.py), each as tall as its model (tools/validate.mjs checks).
  goblet: both(-3, 0, -3, 6, 9, 6),
  beaker: both(-3, 0, -3, 6, 11, 6),
  crock: both(-3, 0, -3, 6, 8, 6),
  mug: both(-3, 0, -3, 8, 9, 6),
  bottle: both(-3, 0, -3, 6, 14, 6),
  tumbler: both(-3, 0, -3, 6, 10, 6),
  saucer_bowl: both(-4, 0, -4, 8, 7, 8),
};
const PLACED_COLORS = {
  cheese_wheel: "#e2b45a", vintage_cheese_wheel: "#c98a3c", smoked_cheese_wheel: "#8a5a32",
  placed_pizza: "#d86a3c", placed_roast_turkey: "#c47838", placed_fondue: "#ac382c", placed_old_duck_soup: "#965c3e", placed_claypot_rice: "#965c3e",
  placed_milk_wine: "#c8a068", placed_yak_milk_wine: "#705038", placed_cream_cocoa: "#683c26", placed_yogurt_berry_drink: "#e27896",
  placed_yogurt: "#849cb6", placed_milk_tea: "#8c402c", placed_milk_skin_tea: "#f4f4ee",
};

// 1.1 掛架風乾: the rack packs its 35 mixes of strip stages into `drying` (row) and `drying_mix`
// (column) of data/processing.js DRYING_LOOKS. Molang that is true for the listed looks.
function whenLooks(test) {
  const terms = DRYING_LOOKS.flatMap((cols, row) => {
    const hit = cols.flatMap((look, col) => (test(look) ? [col] : []));
    if (!hit.length) return [];
    if (hit.length === cols.length) return [`${state("drying")} == ${row}`];
    return [`(${state("drying")} == ${row} && (${hit.map((col) => `${state("drying_mix")} == ${col}`).join(" || ")}))`];
  });
  return terms.length ? terms.join(" || ") : "false";
}
/** The stage shown in slot `n` (1-based) for a look [dried, half, fresh], or undefined. */
function stageInSlot(look, n) {
  let upTo = 0;
  for (let i = 0; i < DRYING_STAGES.length; i++) {
    upTo += look[i];
    if (n <= upTo) return DRYING_STAGES[i];
  }
  return undefined;
}

// 1.1 蛋的進度: the nest box's and incubator's eggs (systems/nest.js "How the eggs look",
// art_src/m4_scripts/blocks_m3.py). Slot n shows one of: egg_n (plain), egg_n_crack (small
// cracks), egg_n_hatch (big cracks, the cap lifting); or, while candled, egg_n_lit_<stage>: the egg
// glowing with the chick's shadow painted on it, small, medium or large (material instance `candled`,
// drawn alpha_test_single_sided like the rest: Bedrock wants one render method per block).
const EGG_SLOTS = 4;
const SLOT_COUNTS = Array.from({ length: EGG_SLOTS + 1 }, (_, n) => n);
const EGG_STATES = { [S("eggs")]: SLOT_COUNTS, [S("cracks")]: SLOT_COUNTS, [S("ready")]: SLOT_COUNTS };
function eggBones(lit) {
  return Object.fromEntries(
    Array.from({ length: EGG_SLOTS }, (_, i) => i + 1).flatMap((n) => {
      const on = lit(n);
      // Exclusive even for state combinations the script never sets (ready > cracks), so two
      // looks of one egg are never drawn in the same place.
      const stage = [
        `${state("cracks")} < ${n} && ${state("ready")} < ${n}`,
        `${state("cracks")} >= ${n} && ${state("ready")} < ${n}`,
        `${state("ready")} >= ${n}`,
      ];
      return [
        [`egg_${n}`, `${state("eggs")} >= ${n} && ${stage[0]} && !(${on})`],
        [`egg_${n}_crack`, `${stage[1]} && !(${on})`],
        [`egg_${n}_hatch`, `${stage[2]} && !(${on})`],
        ...stage.map((when, s) => [`egg_${n}_lit_${s}`, `${on} && ${when}`]),
      ];
    })
  );
}

const DEFS = {
  butcher_rack: {
    component: "butcher_rack",
    // carcass_X: the animal as it was, skinned_X: hide off, cut_X: partly cut
    // 1.1 掛架風乾: `drying` and `drying_mix` say how many strips hang and how dry each is, driest
    // first (whenLooks above). dry_<n> is slot n's twine, dry_<n>_<stage> its strip in that colour
    // (art_src/m4_scripts/rack_drying.py). Stages rather than a kind per slot: four slots of four
    // kinds would multiply the rack's permutations past what a block may have.
    states: {
      [S("carcass")]: ["none", ...CARCASSES],
      [S("skinned")]: [false, true],
      [S("cut")]: [false, true],
      [S("drying")]: DRYING_LOOKS.map((_, row) => row),
      [S("drying_mix")]: DRYING_LOOKS[0].map((_, col) => col),
    },
    bones: Object.fromEntries([
      ...CARCASSES.flatMap((id) => [
        [`carcass_${id}`, `${state("carcass")} == '${id}' && !${state("skinned")}`],
        [`skinned_${id}`, `${state("carcass")} == '${id}' && ${state("skinned")} && !${state("cut")}`],
        [`cut_${id}`, `${state("carcass")} == '${id}' && ${state("cut")}`],
      ]),
      ...Array.from({ length: DRYING_SLOTS }, (_, n) => [
        [`dry_${n + 1}`, whenLooks((look) => stageInSlot(look, n + 1) !== undefined)],
        ...DRYING_STAGES.map((stage) => [`dry_${n + 1}_${stage}`, whenLooks((look) => stageInSlot(look, n + 1) === stage)]),
      ]).flat(),
    ]),
    // Each animal has its own texture (art/blocks/butcher_rack_<id>.png, see tools/art/split_rack_texture.py).
    materials: CARCASSES,
    collision: FULL,
    selection: FULL,
    seconds: 1.5,
  },
  // 1.1 蛋的進度 (systems/nest.js, "How the eggs look"): eggs/cracks/ready count the eggs shown,
  // with cracks, with big cracks, most advanced first; `candled` is the candler's glow.
  nest_box: {
    component: "nest_box",
    states: { ...EGG_STATES, [S("candled")]: SLOT_COUNTS },
    bones: eggBones((n) => `${state("candled")} >= ${n}`),
    collision: box(-7, 0, -7, 14, 6, 14),
    selection: box(-7, 0, -7, 14, 6, 14),
    seconds: 1,
    glow: `${state("candled")} > 0`,
    materials: ["candled"],
  },
  incubator: {
    component: "incubator",
    states: { ...EGG_STATES, [S("busy")]: [false, true], [S("candled")]: [false, true] },
    bones: { ...eggBones((n) => `${state("candled")} && ${state("eggs")} >= ${n}`), busy: state("busy") },
    collision: box(-7, 0, -7, 14, 12, 14),
    selection: box(-7, 0, -7, 14, 12, 14),
    seconds: 1,
    light: true,
    glow: state("candled"),
    materials: ["candled"],
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
  // 1.3: horns on a wall plaque standing at the back of the block (art_src/m4_scripts/blocks_m7.py), 14 pixels tall.
  horn_decor: { states: {}, bones: {}, collision: box(-7, 0, 4, 14, 14, 4), selection: box(-7, 0, 4, 14, 14, 4), seconds: 0.5 },
  // Decoration only: no script component. 1.3: the puffed pillow is 5 pixels, the folded quilt 3 (blocks_m7.py).
  down_pillow: { states: {}, bones: {}, collision: box(-6, 0, -4, 12, 5, 8), selection: box(-6, 0, -4, 12, 5, 8), seconds: 0.2 },
  down_quilt: { states: {}, bones: {}, collision: box(-8, 0, -8, 16, 3, 16), selection: box(-8, 0, -8, 16, 3, 16), seconds: 0.2 },
  hitching_post: {
    component: "hitching_post",
    states: {},
    bones: {},
    collision: box(-3, 0, -3, 6, 16, 6),
    selection: box(-3, 0, -3, 6, 16, 6),
    seconds: 1,
  },
  // 1.1 追加 草場與放牧 (systems/pasture.js): a post with a small sign; a clock block.
  pasture_post: {
    component: "pasture_post",
    states: {},
    bones: {},
    collision: box(-2, 0, -2, 4, 16, 4),
    // the sign board is 8 wide and stands out in front (art_src/m4_scripts/blocks_m12.py): the
    // selection box takes it in, the collision box stays the post
    selection: box(-4, 0, -3, 8, 16, 6),
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
        // A drink (one portion) is drunk in one go, so it has no `cut` state and always shows piece_1.
        states: food.portions > 1 ? { [S("cut")]: Array.from({ length: food.portions }, (_, n) => n) } : {},
        bones: food.portions > 1 ? Object.fromEntries(
          Array.from({ length: food.portions }, (_, n) => [`piece_${n + 1}`, `${state("cut")} <= ${food.portions - 1 - n}`])
        ) : {},
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
  ...Object.fromEntries(AUTO_STATIONS.map((id) => [id, stationDef("auto_station", id)])),
  ...Object.fromEntries(STATIONS.map((id) => [id, stationDef("station", id)])),
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
        // The lamp's light, and the candler's glow (brighter; the two conditions never overlap).
        ...(def.light
          ? [{ condition: def.glow ? `${state("busy")} && !(${def.glow})` : state("busy"), components: { "minecraft:light_emission": 7 } }]
          : []),
        ...(def.glow ? [{ condition: def.glow, components: { "minecraft:light_emission": 10 } }] : []),
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
