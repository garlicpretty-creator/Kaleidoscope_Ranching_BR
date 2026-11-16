// Generates the behaviour-pack entity files for Ranching animals from
// data/animals.js plus the per-species tuning below.
//
// Run with: node tools/gen_entities.mjs

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { ANIMALS } = await import(pathToFileURL(join(root, "packs/BP/scripts/data/animals.js")).href);

const NS = "kaleidoscope_ranching";
const SEX = `${NS}:sex`;
// Wool colour for the client: Molang cannot read minecraft:color, so the
// set_color events mirror it into this synced property.
const WOOL = `${NS}:wool`;
const rid = (id) => (id.includes(":") ? id : `${NS}:${id}`);
const g = (name) => `${NS}:${name}`;

// Species built in M1. M4 adds duck, goose, buffalo and yak here.
const TUNING = {
  cow: { family: "cow", health: 10, speed: 0.25, box: [0.9, 1.3], mass: 1.0, bucketMilk: true },
  sheep: { family: "sheep", health: 8, speed: 0.25, box: [0.9, 1.3], mass: 0.75, wool: true },
  goat: { family: "goat", health: 10, speed: 0.2, box: [0.9, 1.3], mass: 0.75, bucketMilk: true, goat: true },
  pig: { family: "pig", health: 10, speed: 0.25, box: [0.9, 0.9], mass: 0.75, saddle: true },
  chicken: { family: "chicken", health: 4, speed: 0.25, box: [0.6, 0.8], mass: 0.5, noFallDamage: true },
  rabbit: { family: "rabbit", health: 3, speed: 0.3, box: [0.4, 0.5], mass: 0.4, variants: 6 },
  // M4. No vanilla counterpart, so they also get spawn rules (SPAWN below).
  duck: { family: "duck", health: 4, speed: 0.25, box: [0.6, 0.8], mass: 0.5, noFallDamage: true, swims: true },
  goose: { family: "goose", health: 8, speed: 0.25, box: [0.7, 1.0], mass: 0.6, noFallDamage: true, swims: true, guard: true },
  buffalo: { family: "buffalo", health: 14, speed: 0.2, box: [1.1, 1.4], mass: 1.2 },
  yak: { family: "yak", health: 12, speed: 0.22, box: [1.0, 1.4], mass: 1.1 },
};

// Natural spawning for the M4 animals, modelled on vanilla cows. Biome tags are
// Bedrock's; an animal spawns where any of its tags is present.
const SPAWN = {
  duck: { tags: ["river", "swamp"], blocks: ["minecraft:grass_block", "minecraft:sand", "minecraft:mud"], weight: 8, herd: [2, 4] },
  goose: { tags: ["plains", "river"], blocks: ["minecraft:grass_block"], weight: 6, herd: [2, 3] },
  buffalo: { tags: ["swamp", "jungle"], blocks: ["minecraft:grass_block", "minecraft:mud", "minecraft:podzol"], weight: 6, herd: [2, 3] },
  yak: { tags: ["mountains", "meadow", "snowy_slopes", "frozen_peaks"], blocks: ["minecraft:grass_block", "minecraft:snow", "minecraft:stone"], weight: 6, herd: [2, 4] },
};

const range = (n) => Array.from({ length: n }, (_, i) => i);

// A gander drives hostile mobs off: adult males only (babies never pick a target).
/** A component group that walks the animal to the nearest of `blocks` and keeps it there. */
function seekGroup(blocks) {
  return {
    "minecraft:behavior.move_to_block": {
      priority: 5,
      tick_interval: 20,
      start_chance: 0.1,
      search_range: 16,
      search_height: 4,
      goal_radius: 1.5,
      // longer than one pass of the ranch clock (30 s), so the animal is still there when served
      stay_duration: 800,
      target_selection_method: "nearest",
      target_blocks: blocks.map(rid),
    },
  };
}

function guardComponents() {
  return {
    "minecraft:attack": { damage: 2 },
    "minecraft:behavior.melee_attack": { priority: 3, speed_multiplier: 1.3, track_target: true },
    "minecraft:behavior.nearest_attackable_target": {
      priority: 2,
      must_see: true,
      reselect_targets: true,
      entity_types: [
        {
          filters: {
            all_of: [
              { test: "is_family", subject: "other", value: "monster" },
              { test: "is_family", subject: "other", operator: "!=", value: "creeper" },
              { test: "is_baby", subject: "self", value: false },
            ],
          },
          max_dist: 8,
        },
      ],
    },
  };
}

// 企劃書: goats keep the vanilla high jump and ram. The jump (jump_to_block) is for
// every goat; ramming is for adults, at players and other mobs, as in vanilla, but
// never at goats or Ranching's own livestock, so a goat does not batter the pen.
function goatJump() {
  return {
    "minecraft:behavior.jump_to_block": {
      priority: 8,
      search_width: 10,
      search_height: 10,
      minimum_path_length: 8,
      minimum_distance: 1,
      scale_factor: 0.6,
      max_velocity: 1,
      cooldown_range: [30, 60],
      preferred_blocks: ["minecraft:stone", "minecraft:snow", "minecraft:powder_snow"],
      preferred_blocks_chance: 0.5,
      forbidden_blocks: ["minecraft:water", "minecraft:lava", "minecraft:fire", "minecraft:magma"],
    },
  };
}

function goatRam() {
  return {
    "minecraft:attack": { damage: 2 },
    "minecraft:behavior.ram_attack": {
      priority: 5,
      run_speed: 0.7,
      ram_speed: 1.8,
      min_ram_distance: 4,
      ram_distance: 7,
      knockback_force: 2.5,
      knockback_height: 0.04,
      pre_ram_sound: "pre_ram",
      ram_impact_sound: "ram_impact",
      cooldown_range: [30, 300],
    },
    "minecraft:behavior.nearest_attackable_target": {
      priority: 6,
      must_see: true,
      reselect_targets: true,
      within_radius: 8,
      entity_types: [
        {
          filters: {
            all_of: [
              { test: "is_family", subject: "other", operator: "!=", value: "goat" },
              { test: "is_family", subject: "other", operator: "!=", value: "ranching_livestock" },
              { any_of: [{ test: "is_family", subject: "other", value: "player" }, { test: "is_family", subject: "other", value: "mob" }] },
            ],
          },
          max_dist: 8,
        },
      ],
    },
  };
}

function buildEntity(animal, t) {
  const sexFamily = (sex) => ({
    "minecraft:type_family": { family: [t.family, "mob", "ranching_livestock", `ranching_${sex}`] },
  });

  const adult = {
    "minecraft:experience_reward": { on_death: "q.last_hit_by_player ? Math.Random(1, 3) : 0" },
  };
  if (t.bucketMilk) {
    // Vanilla bucket milking stays available for adult females so cake and
    // other vanilla recipes keep working. The Ranching milking pail is handled
    // by script and gives graded bottled milk instead.
    adult["minecraft:interact"] = {
      interactions: [
        {
          on_interact: {
            filters: {
              all_of: [
                { test: "is_family", subject: "other", value: "player" },
                { test: "has_equipment", domain: "hand", subject: "other", value: "bucket:0" },
                { test: "enum_property", subject: "self", domain: SEX, value: "female" },
              ],
            },
          },
          use_item: true,
          transform_to_item: "milk_bucket:0",
          play_sounds: "milk",
          interact_text: "action.interact.milk",
        },
      ],
    };
  }

  const groups = {
    [g("baby")]: {
      "minecraft:is_baby": {},
      "minecraft:scale": { value: 0.5 },
      "minecraft:ageable": { duration: 1200, grow_up: { event: g("grow_up"), target: "self" } },
      "minecraft:behavior.follow_parent": { priority: 5, speed_multiplier: 1.1 },
    },
    [g("adult")]: { ...adult, ...(t.goat ? goatRam() : {}) },
    [g("sex_female")]: sexFamily("female"),
    [g("sex_male")]: { ...sexFamily("male"), ...(t.guard ? guardComponents() : {}) },
    [g("wild")]: { "minecraft:despawn": { despawn_from_distance: {} } },
    // Rung for by the cowbell (systems/cowbell.js): follow a player holding it
    // from far away for one minute.
    [g("called")]: {
      "minecraft:behavior.tempt": {
        priority: 3,
        speed_multiplier: 1.3,
        within_radius: 32,
        can_tempt_vertically: true,
        items: [rid("cowbell"), ...animal.temptItems.map(rid)],
      },
      "minecraft:timer": { looping: false, time: 60, time_down_event: { event: g("uncalled"), target: "self" } },
    },
    [g("persistent")]: { "minecraft:persistent": {} },
    // 企劃書: 動物會主動走向飼槽與水槽. Present until the animal has eaten and
    // drunk today (care/state.js triggers `sated`), added back when the next
    // day is settled (`hungry`), so a fed herd does not crowd its troughs all day.
    // Hungry and thirsty: walk to the nearest trough of either kind and wait beside it. The
    // care scripts serve an animal once it stands there (care/state.js readyAt), then move it
    // on to seeking_water or seeking_feed for whichever it still lacks. Only one of the three
    // groups is present at a time, because they hold the same component.
    [g("seeking")]: seekGroup(["trough", "hay_rack", "water_trough", "auto_waterer"]),
    [g("seeking_feed")]: seekGroup(["trough", "hay_rack"]),
    [g("seeking_water")]: seekGroup(["water_trough", "auto_waterer"]),
  };

  const adultGroups = [g("adult")];
  const spawnDefaults = [g("wild"), g("seeking")];

  if (t.wool) {
    for (const i of range(16)) groups[g(`color_${i}`)] = { "minecraft:color": { value: i } };
    groups[g("sheared")] = { "minecraft:is_sheared": {} };
    spawnDefaults.push(g("color_0"));
  }
  if (t.variants) {
    for (const i of range(t.variants)) groups[g(`variant_${i}`)] = { "minecraft:variant": { value: i } };
    spawnDefaults.push(g("variant_0"));
  }
  if (t.saddle) {
    groups[g("unsaddled")] = {
      "minecraft:interact": {
        interactions: [
          {
            on_interact: {
              filters: {
                all_of: [
                  { test: "is_family", subject: "other", value: "player" },
                  { test: "has_equipment", domain: "hand", subject: "other", value: "saddle" },
                ],
              },
              event: g("on_saddled"),
            },
            use_item: true,
            play_sounds: "saddle",
            interact_text: "action.interact.saddle",
          },
        ],
      },
    };
    groups[g("saddled")] = {
      "minecraft:is_saddled": {},
      "minecraft:rideable": {
        seat_count: 1,
        family_types: ["player"],
        interact_text: "action.interact.mount",
        seats: { position: [0.0, 0.63, 0.0] },
      },
      "minecraft:item_controllable": { control_items: "carrot_on_a_stick" },
      "minecraft:behavior.controlled_by_player": { priority: 0 },
      "minecraft:boostable": {
        speed_multiplier: 2.0,
        duration: 3.0,
        boost_items: [{ item: "carrot_on_a_stick", damage: 2, replace_item: "fishing_rod" }],
      },
    };
    adultGroups.push(g("unsaddled"));
  }

  const components = {
    "minecraft:is_hidden_when_invisible": {},
    "minecraft:breathable": { total_supply: 15, suffocate_time: 0 },
    "minecraft:collision_box": { width: t.box[0], height: t.box[1] },
    "minecraft:nameable": {},
    "minecraft:health": { value: t.health, max: t.health },
    "minecraft:hurt_on_condition": {
      damage_conditions: [
        { filters: { test: "in_lava", subject: "self", operator: "==", value: true }, cause: "lava", damage_per_tick: 4 },
      ],
    },
    // Death drops are handled by script (the carcass); see systems/carcass.js.
    "minecraft:loot": { table: `loot_tables/${NS}/empty.json` },
    "minecraft:movement": { value: t.speed },
    "minecraft:navigation.walk": t.swims
      ? { can_path_over_water: true, can_swim: true, avoid_water: false, avoid_damage_blocks: true }
      : { can_path_over_water: true, avoid_water: true, avoid_damage_blocks: true },
    "minecraft:movement.basic": {},
    "minecraft:jump.static": {},
    "minecraft:can_climb": {},
    "minecraft:leashable": { soft_distance: 4.0, hard_distance: 6.0, max_distance: 10.0 },
    "minecraft:balloonable": { mass: t.mass },
    "minecraft:behavior.float": { priority: 0 },
    "minecraft:behavior.panic": { priority: 1, speed_multiplier: 1.25 },
    "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 0.8 },
    "minecraft:behavior.look_at_player": { priority: 7, look_distance: 6.0, probability: 0.02 },
    "minecraft:behavior.random_look_around": { priority: 8 },
    "minecraft:physics": {},
    "minecraft:pushable": { is_pushable: true, is_pushable_by_piston: true },
    "minecraft:conditional_bandwidth_optimization": {},
    // Plays the "ambient" sound event every 8–24 s, like vanilla farm animals; the
    // sounds themselves are mapped per animal in RP sounds.json (SOUNDS below).
    "minecraft:ambient_sound_interval": { value: 8.0, range: 16.0, event_name: "ambient" },
    ...(t.goat ? goatJump() : {}),
  };
  if (animal.temptItems.length) {
    components["minecraft:behavior.tempt"] = {
      priority: 4,
      speed_multiplier: 1.25,
      items: animal.temptItems.map(rid),
    };
  }
  if (t.noFallDamage) {
    components["minecraft:damage_sensor"] = { triggers: { cause: "fall", deals_damage: "no" } };
  }
  if (t.wool) {
    components["minecraft:behavior.eat_block"] = {
      priority: 6,
      success_chance: "q.is_baby ? 0.02 : 0.001",
      time_until_eat: 1.8,
      eat_and_replace_block_pairs: [
        { eat_block: "minecraft:grass_block", replace_block: "minecraft:dirt" },
        { eat_block: "minecraft:short_grass", replace_block: "minecraft:air" },
      ],
      on_eat: { event: g("regrow_wool"), target: "self" },
    };
  }

  const setSex = (sex) => ({
    sequence: [
      { set_property: { [SEX]: sex } },
      { remove: { component_groups: [g("sex_female"), g("sex_male")] } },
      { add: { component_groups: [g(`sex_${sex}`)] } },
    ],
  });

  const events = {
    "minecraft:entity_spawned": {
      sequence: [
        {
          randomize: [
            // ## Inlined rather than `trigger`ing set_female/set_male, which keeps
            // ## the spawn event to the most widely supported response types.
            { weight: 1, set_property: { [SEX]: "female" }, add: { component_groups: [g("sex_female")] } },
            { weight: 1, set_property: { [SEX]: "male" }, add: { component_groups: [g("sex_male")] } },
          ],
        },
        { add: { component_groups: [...adultGroups, ...spawnDefaults] } },
      ],
    },
    [g("set_female")]: setSex("female"),
    [g("set_male")]: setSex("male"),
    [g("become_baby")]: {
      sequence: [
        { remove: { component_groups: adultGroups } },
        { add: { component_groups: [g("baby")] } },
      ],
    },
    [g("grow_up")]: {
      sequence: [
        { remove: { component_groups: [g("baby")] } },
        { add: { component_groups: adultGroups } },
      ],
    },
    [g("make_persistent")]: {
      sequence: [{ remove: { component_groups: [g("wild")] } }, { add: { component_groups: [g("persistent")] } }],
    },
    [g("called")]: { sequence: [{ remove: { component_groups: [g("called")] } }, { add: { component_groups: [g("called")] } }] },
    [g("uncalled")]: { remove: { component_groups: [g("called")] } },
    [g("sated")]: { remove: { component_groups: [g("seeking"), g("seeking_feed"), g("seeking_water")] } },
    [g("hungry")]: { sequence: [{ remove: { component_groups: [g("seeking_feed"), g("seeking_water")] } }, { add: { component_groups: [g("seeking")] } }] },
    [g("seek_feed")]: { sequence: [{ remove: { component_groups: [g("seeking"), g("seeking_water")] } }, { add: { component_groups: [g("seeking_feed")] } }] },
    [g("seek_water")]: { sequence: [{ remove: { component_groups: [g("seeking"), g("seeking_feed")] } }, { add: { component_groups: [g("seeking_water")] } }] },
    // M2's ear tag triggers this (data/m1_contract.js EVENT_ADD_EAR_TAG).
    [g("add_ear_tag")]: {
      sequence: [{ remove: { component_groups: [g("wild")] } }, { add: { component_groups: [g("persistent")] } }],
    },
  };
  if (t.wool) {
    const all = range(16).map((i) => g(`color_${i}`));
    for (const i of range(16)) {
      events[g(`set_color_${i}`)] = { sequence: [{ remove: { component_groups: all } }, { add: { component_groups: [g(`color_${i}`)] } }, { set_property: { [WOOL]: i } }] };
    }
    events[g("shear")] = { add: { component_groups: [g("sheared")] } };
    events[g("regrow_wool")] = { remove: { component_groups: [g("sheared")] } };
  }
  if (t.variants) {
    const all = range(t.variants).map((i) => g(`variant_${i}`));
    for (const i of range(t.variants)) {
      events[g(`set_variant_${i}`)] = { sequence: [{ remove: { component_groups: all } }, { add: { component_groups: [g(`variant_${i}`)] } }] };
    }
  }
  if (t.saddle) {
    events[g("on_saddled")] = {
      sequence: [{ remove: { component_groups: [g("unsaddled")] } }, { add: { component_groups: [g("saddled")] } }],
    };
  }

  return {
    format_version: "1.21.0",
    "minecraft:entity": {
      description: {
        identifier: rid(animal.id),
        is_spawnable: true,
        is_summonable: true,
        is_experimental: false,
        properties: {
          [SEX]: { type: "enum", values: ["female", "male"], default: "female", client_sync: true },
          ...(t.wool ? { [WOOL]: { type: "int", range: [0, 15], default: 0, client_sync: true } } : {}),
        },
      },
      component_groups: groups,
      components,
      events,
    },
  };
}

const outDir = join(root, "packs/BP/entities");
mkdirSync(outDir, { recursive: true });
let written = 0;
for (const animal of ANIMALS) {
  const tuning = TUNING[animal.id];
  if (!tuning) continue;
  writeFileSync(join(outDir, `${animal.id}.json`), JSON.stringify(buildEntity(animal, tuning), null, 2) + "\n");
  written++;
}

// --- Spawn rules (M4) -----------------------------------------------------------

const spawnDir = join(root, "packs/BP/spawn_rules");
mkdirSync(spawnDir, { recursive: true });
for (const [id, rule] of Object.entries(SPAWN)) {
  if (!TUNING[id]) continue;
  writeFileSync(
    join(spawnDir, `${id}.json`),
    JSON.stringify(
      {
        format_version: "1.8.0",
        "minecraft:spawn_rules": {
          description: { identifier: rid(id), population_control: "animal" },
          conditions: [
            {
              "minecraft:spawns_on_surface": {},
              "minecraft:spawns_on_block_filter": rule.blocks,
              "minecraft:brightness_filter": { min: 7, max: 15, adjust_for_weather: false },
              "minecraft:weight": { default: rule.weight },
              "minecraft:herd": { min_size: rule.herd[0], max_size: rule.herd[1] },
              "minecraft:density_limit": { surface: 4 },
              "minecraft:biome_filter": { any_of: rule.tags.map((tag) => ({ test: "has_biome_tag", value: tag })) },
            },
          ],
        },
      },
      null,
      2
    ) + "\n"
  );
}

// --- Hitch knot (M4) -------------------------------------------------------------
// An invisible, motionless entity the hitching post leashes animals to
// (systems/hitchingPost.js). Bedrock only lets entities hold leads.

writeFileSync(
  join(outDir, "hitch_knot.json"),
  JSON.stringify(
    {
      format_version: "1.21.0",
      "minecraft:entity": {
        description: { identifier: rid("hitch_knot"), is_spawnable: false, is_summonable: true, is_experimental: false },
        components: {
          "minecraft:type_family": { family: ["ranching_hitch_knot", "inanimate"] },
          "minecraft:collision_box": { width: 0.25, height: 0.25 },
          "minecraft:health": { value: 1, max: 1 },
          "minecraft:damage_sensor": { triggers: { cause: "all", deals_damage: "no" } },
          "minecraft:physics": { has_gravity: false, has_collision: false },
          "minecraft:pushable": { is_pushable: false, is_pushable_by_piston: false },
          "minecraft:persistent": {},
          "minecraft:knockback_resistance": { value: 1 },
          "minecraft:loot": { table: `loot_tables/${NS}/empty.json` },
          "minecraft:is_hidden_when_invisible": {},
        },
      },
    },
    null,
    2
  ) + "\n"
);
const rpRoot = join(root, "packs/RP");
for (const [path, data] of [
  [
    "entity/hitch_knot.entity.json",
    {
      format_version: "1.10.0",
      "minecraft:client_entity": {
        description: {
          identifier: rid("hitch_knot"),
          materials: { default: "entity_alphatest" },
          textures: { default: "textures/entity/ranching/hitch_knot" },
          geometry: { default: "geometry.kaleidoscope_ranching.hitch_knot" },
          render_controllers: ["controller.render.kaleidoscope_ranching.hitch_knot"],
        },
      },
    },
  ],
  [
    "models/entity/hitch_knot.geo.json",
    {
      format_version: "1.12.0",
      "minecraft:geometry": [
        {
          description: { identifier: "geometry.kaleidoscope_ranching.hitch_knot", texture_width: 16, texture_height: 16 },
          bones: [{ name: "knot", pivot: [0, 0, 0] }],
        },
      ],
    },
  ],
  [
    "render_controllers/hitch_knot.render_controllers.json",
    {
      format_version: "1.8.0",
      render_controllers: {
        "controller.render.kaleidoscope_ranching.hitch_knot": {
          geometry: "Geometry.default",
          materials: [{ "*": "Material.default" }],
          textures: ["Texture.default"],
        },
      },
    },
  ],
]) {
  mkdirSync(dirname(join(rpRoot, path)), { recursive: true });
  writeFileSync(join(rpRoot, path), JSON.stringify(data, null, 2) + "\n");
}
// A fully transparent 16x16 PNG: the knot draws nothing, only the lead does.
const KNOT_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEklEQVR4nGNgGAWjYBSMAggAAAQQAAGFP6pyAAAAAElFTkSuQmCC";
mkdirSync(join(rpRoot, "textures/entity/ranching"), { recursive: true });
writeFileSync(join(rpRoot, "textures/entity/ranching/hitch_knot.png"), Buffer.from(KNOT_PNG, "base64"));

// --- Animal sounds (RP sounds.json) --------------------------------------------
// Custom entities are silent unless sounds.json maps their sound events. The six
// replaced animals use their vanilla sounds; the four new ones borrow the closest
// vanilla voice at another pitch (no dedicated recordings yet). `milk` and
// `saddle` are the events the entities' interact components play.
const voice = (prefix, { death = `${prefix}.hurt`, hurt = `${prefix}.hurt`, ambient = `${prefix}.say`, step = `${prefix}.step` } = {}) =>
  ({ ambient, hurt, death, step });
const SOUNDS = {
  cow: { pitch: [0.9, 1.1], events: { ...voice("mob.cow"), milk: "mob.cow.milk" } },
  sheep: { pitch: [0.9, 1.1], events: voice("mob.sheep", { hurt: "mob.sheep.say", death: "mob.sheep.say" }) },
  goat: {
    pitch: [0.9, 1.1],
    events: {
      ...voice("mob.goat", { ambient: "mob.goat.ambient", death: "mob.goat.death" }),
      milk: "mob.cow.milk",
      pre_ram: "mob.goat.prepare_ram",
      ram_impact: "mob.goat.ram_impact",
    },
  },
  pig: { pitch: [0.9, 1.1], events: { ...voice("mob.pig", { hurt: "mob.pig.say", death: "mob.pig.death" }), saddle: "mob.horse.leather" } },
  chicken: { pitch: [0.9, 1.1], events: { ...voice("mob.chicken"), plop: "mob.chicken.plop" } },
  rabbit: { pitch: [0.9, 1.1], events: { ...voice("mob.rabbit", { ambient: "mob.rabbit.idle", death: "mob.rabbit.death", step: "mob.rabbit.hop" }), jump: "mob.rabbit.hop" } },
  // New animals: duck and goose a lower, rougher chicken; buffalo and yak a deeper cow.
  duck: { pitch: [0.7, 0.8], events: voice("mob.chicken") },
  goose: { pitch: [0.55, 0.65], events: voice("mob.chicken") },
  buffalo: { pitch: [0.75, 0.85], events: { ...voice("mob.cow"), milk: "mob.cow.milk" } },
  yak: { pitch: [0.65, 0.75], events: { ...voice("mob.cow"), milk: "mob.cow.milk" } },
};
for (const animal of ANIMALS) if (!SOUNDS[animal.id]) throw new Error(`gen_entities: no sounds for ${animal.id}`);
writeFileSync(
  join(rpRoot, "sounds.json"),
  JSON.stringify(
    {
      entity_sounds: {
        entities: Object.fromEntries(
          Object.entries(SOUNDS).map(([id, { pitch, events }]) => [`${NS}:${id}`, { volume: 1.0, pitch, events }])
        ),
      },
    },
    null,
    2
  ) + "\n"
);

const lootDir = join(root, `packs/BP/loot_tables/${NS}`);
mkdirSync(lootDir, { recursive: true });
writeFileSync(join(lootDir, "empty.json"), JSON.stringify({ pools: [] }, null, 2) + "\n");

console.log(`gen_entities: wrote ${written} entities`);
