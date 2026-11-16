// Generates behaviour-pack item files and crafting/furnace recipes for every
// registry item not owned by another milestone's generator (owner "m2").
// Icons come from tools/gen_art.py; names from tools/gen_shared.mjs.
//
// Run with: node tools/gen_items.mjs

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => import(pathToFileURL(join(root, "packs/BP/scripts/data", name)).href);
const { ITEMS, NAMESPACE } = await load("items.js");
const { ANIMALS } = await load("animals.js");
const { VANILLA_COOKING } = await load("processing.js");
const { DISHES, DISH_PREPS } = await load("dishes.js");
const DISH_BY_ID = new Map(DISHES.map((dish) => [dish.id, dish]));

const rid = (id) => (id.includes(":") ? id : `${NAMESPACE}:${id}`);
const FORMAT = "1.21.60";
const LARGE_CARCASSES = new Set(ANIMALS.filter((a) => a.largeCarcass).map((a) => a.carcass));

function food(nutrition, saturation, extra = {}) {
  return {
    "minecraft:food": { nutrition, saturation_modifier: saturation, can_always_eat: extra.always ?? false, ...(extra.converts ? { using_converts_to: extra.converts } : {}) },
    "minecraft:use_animation": extra.drink ? "drink" : "eat",
    "minecraft:use_modifiers": { use_duration: 1.6, movement_modifier: 0.33 },
  };
}

// Per-item components beyond the category defaults.
const OVERRIDES = {
  cream: { stack: 16, ...food(2, 0.4) },
  yogurt: { stack: 16, ...food(4, 0.6) },
  fresh_cheese: food(3, 0.6),
  cheese_slice: food(2, 0.6),
  // Places the cuttable wheel block (gen_blocks.mjs, systems/cheeseWheel.js).
  aged_cheese_wheel: { stack: 16, components: { "minecraft:block_placer": { block: "kaleidoscope_ranching:cheese_wheel" } } },
  ghee: { stack: 16 },
  whey: { stack: 16, ...food(1, 0.2, { drink: true, converts: "minecraft:glass_bottle", always: true }) },
  salted_duck_egg: food(4, 0.6),
  century_egg: food(5, 0.6),
  // Lard is a Cookery oil container (api/cookeryRecipes.js): its oil count is an
  // item dynamic property, so it cannot stack.
  lard: { stack: 1 },
  // Dried yak dung burns like a stick-and-a-half of coal: 30 s, three smelts.
  dried_yak_dung: { components: { "minecraft:fuel": { duration: 30 } } },
  // 1.1 肉類線與內臟線
  beef_jerky: food(4, 0.6, { always: true }),
  foie_gras_pate: { stack: 16, ...food(4, 0.8) },
  sausage_casing: {},
  // 1.1 蛋奶線與起司線
  skim_milk: { stack: 16, ...food(2, 0.3, { drink: true, converts: "minecraft:glass_bottle", always: true }) },
  vanilla_ice_cream: { stack: 16, ...food(4, 0.4, { always: true }) },
  berry_ice_cream: { stack: 16, ...food(5, 0.5, { always: true }) },
  chocolate_ice_cream: { stack: 16, ...food(5, 0.5, { always: true }) },
  custard: { stack: 16 },
  truffle: { stack: 16 },
  goat_cheese: food(3, 0.6),
  aged_goat_cheese: food(4, 0.7),
  mozzarella: food(3, 0.6),
  chhurpi: food(2, 0.5),
  chhurpi_block: food(3, 0.7),
  vintage_cheese_wheel: { stack: 16 },
  vintage_cheese_slice: food(3, 0.8),
  smoked_cheese_wheel: { stack: 16 },
  smoked_cheese_slice: food(3, 0.7),
  ricotta: food(2, 0.5),
  milk_tofu: food(3, 0.5),
  // 1.1 皮革線、絨毛線、布料線、孵化與飼料線
  leather_apron: { stack: 1, components: { "minecraft:wearable": { slot: "slot.armor.chest", protection: 2 }, "minecraft:durability": { max_durability: 120 } } },
  wool_hat: { stack: 1, components: { "minecraft:wearable": { slot: "slot.armor.head", protection: 1 }, "minecraft:durability": { max_durability: 80 } } },
  wool_scarf: { stack: 1, components: { "minecraft:wearable": { slot: "slot.armor.chest", protection: 1 }, "minecraft:durability": { max_durability: 80 } } },
  lasso: { stack: 1, format: "1.21.90", components: { "kaleidoscope_ranching:lasso": {}, "minecraft:durability": { max_durability: 64 }, "minecraft:cooldown": { category: "kr_lasso", duration: 1 } } },
  feather_duster: { stack: 1, format: "1.21.90", components: { "kaleidoscope_ranching:feather_duster": {}, "minecraft:durability": { max_durability: 64 } } },
  egg_candler: { stack: 1, format: "1.21.90", components: { "kaleidoscope_ranching:egg_candler": {} } },
  // Item custom components (systems/m4.js); they need item format 1.21.90.
  cowbell: { stack: 1, format: "1.21.90", components: { "kaleidoscope_ranching:cowbell": {}, "minecraft:cooldown": { category: "kr_cowbell", duration: 3 } } },
  animal_crate: { stack: 1, format: "1.21.90", components: { "kaleidoscope_ranching:animal_crate": {} } },
  milking_pail: { stack: 1, components: { "minecraft:durability": { max_durability: 128 }, "minecraft:hand_equipped": true } },
  nursing_bottle: { stack: 1, components: { "minecraft:durability": { max_durability: 32 } } },
};

function componentsFor(item) {
  const c = {};
  let stack = 64;
  const tags = [];
  switch (item.category) {
    case "milk": {
      Object.assign(c, food(2, 0.4, { drink: true, converts: "minecraft:glass_bottle", always: true }));
      stack = 16;
      tags.push(`${NAMESPACE}:milk`);
      break;
    }
    case "egg":
      stack = 16;
      tags.push(`${NAMESPACE}:egg`);
      break;
    case "fertilized_egg":
      stack = 16;
      tags.push(`${NAMESPACE}:fertilized_egg`);
      break;
    case "carcass":
      stack = LARGE_CARCASSES.has(item.id) ? 1 : 16;
      tags.push(`${NAMESPACE}:carcass`);
      break;
    case "meat":
      Object.assign(c, item.id.startsWith("cooked_") ? food(8, 0.8) : food(3, 0.3));
      tags.push("minecraft:is_meat");
      break;
    case "dish": {
      // M5 dishes stack like Cookery's own dishes; eating gives the carrier back.
      const dish = DISH_BY_ID.get(item.id);
      const converts = dish.carrier || undefined;
      Object.assign(c, food(dish.food[0], dish.food[1], { converts, drink: dish.look[0] === "bottle" }));
      break;
    }
    case "prep":
      stack = 16;
      break;
    case "cut":
      Object.assign(c, food(2, 0.3));
      tags.push("minecraft:is_meat");
      break;
    // 1.1: grinder mince and raw sausage (raw meat), cured meats, offal.
    case "mince":
      Object.assign(c, food(2, 0.3));
      tags.push("minecraft:is_meat");
      if (item.id.endsWith("_mince")) tags.push(`${NAMESPACE}:mince`);
      break;
    case "cured":
      Object.assign(c, food(5, 0.6));
      tags.push("minecraft:is_meat");
      break;
    case "offal":
      Object.assign(c, food(2, 0.2));
      tags.push("minecraft:is_meat", `${NAMESPACE}:offal`);
      break;
  }
  const override = OVERRIDES[item.id] ?? {};
  const { stack: overrideStack, format: _format, components = {}, ...overrideComponents } = override;
  Object.assign(c, overrideComponents, components);
  if (overrideStack) stack = overrideStack;
  if (c["minecraft:food"] && !tags.includes("minecraft:is_food")) tags.push("minecraft:is_food");

  return {
    "minecraft:icon": `kr_${item.id}`,
    // Name the language key outright: items in a creative catalog group are otherwise looked up
    // as item.<id> (no .name) and showed their raw key in game.
    "minecraft:display_name": { value: `item.${rid(item.id)}.name` },
    "minecraft:max_stack_size": stack,
    ...c,
    ...(tags.length ? { "minecraft:tags": { tags } } : {}),
  };
}

const MENU = { tool: "equipment", carcass: "items" };

// --- Recipes (owned by M3) -------------------------------------------------

const planks = { tag: "minecraft:planks" };
const shaped = (id, pattern, key, result, count = 1) => [
  id,
  {
    format_version: "1.20.10",
    "minecraft:recipe_shaped": {
      description: { identifier: rid(`m3_${id}`) },
      tags: ["crafting_table"],
      pattern,
      key,
      result: { item: rid(result), count },
      unlock: [{ item: rid(result) }],
    },
  },
];
const shapeless = (id, ingredients, result, count = 1) => [
  id,
  {
    format_version: "1.20.10",
    "minecraft:recipe_shapeless": {
      description: { identifier: rid(`m3_${id}`) },
      tags: ["crafting_table"],
      ingredients,
      result: { item: rid(result), count },
      // A vanilla result (egg, candle, wool…) unlocks with the Ranching item that makes it.
      unlock: [{ item: result.startsWith("minecraft:") ? ingredients[0].item : rid(result) }],
    },
  },
];

const RECIPES = [
  shaped("butcher_rack", ["SIS", "P P", "P P"], { S: { item: "minecraft:stick" }, I: { item: "minecraft:iron_ingot" }, P: planks }, "butcher_rack"),
  shaped("animal_crate", ["PBP", "B B", "PBP"], { P: planks, B: { item: "minecraft:iron_bars" } }, "animal_crate"),
  shaped("cowbell", [" L ", "C C", "CCC"], { L: { item: "minecraft:leather" }, C: { item: "minecraft:copper_ingot" } }, "cowbell"),
  shaped("hitching_post", ["N", "F", "F"], { N: { item: "minecraft:iron_nugget" }, F: { item: "minecraft:oak_fence" } }, "hitching_post"),
  shaped("nest_box", ["P P", "PHP"], { P: planks, H: { item: "minecraft:hay_block" } }, "nest_box"),
  shaped("incubator", ["GGG", "P P", "PIP"], { G: { item: "minecraft:glass" }, P: planks, I: { item: "minecraft:iron_ingot" } }, "incubator"),
  shaped("butter_churn", [" S ", "P P", "PPP"], { S: { item: "minecraft:stick" }, P: planks }, "butter_churn"),
  shaped("cheese_press", ["PIP", "P P", "PPP"], { I: { item: "minecraft:iron_ingot" }, P: planks }, "cheese_press"),
  shaped("aging_rack", ["PPP", "S S", "PPP"], { S: { item: "minecraft:stick" }, P: planks }, "aging_rack"),
  shaped("fermenting_jar", [" P ", "G G", "GGG"], { G: { item: "minecraft:glass" }, P: planks }, "fermenting_jar"),
  shaped("hay_rack", ["S S", "SHS", "PPP"], { S: { item: "minecraft:stick" }, H: { item: "minecraft:hay_block" }, P: planks }, "hay_rack"),
  shaped("pickling_vat", ["T T", "TTT"], { T: { item: "minecraft:hardened_clay" } }, "pickling_vat"),
  shaped("food_waste_bin", ["N N", "P P", "PPP"], { N: { item: "minecraft:iron_nugget" }, P: planks }, "food_waste_bin"),
  shapeless("milking_pail", [{ item: "minecraft:bucket" }, { item: "minecraft:stick" }], "milking_pail"),
  shapeless("nursing_bottle", [{ item: "minecraft:glass_bottle" }, { item: "minecraft:slime_ball" }], "nursing_bottle"),
  shapeless("cheese_slices", [{ item: rid("aged_cheese_wheel") }], "cheese_slice", 4),
  shaped("tanning_rack", ["S S", "TTT", "P P"], { S: { item: "minecraft:stick" }, T: { item: "minecraft:string" }, P: planks }, "tanning_rack"),
  // 1.1 肉類線與內臟線
  shaped("meat_grinder", ["III", "SIS", "PPP"], { I: { item: "minecraft:iron_ingot" }, S: { item: "minecraft:stick" }, P: planks }, "meat_grinder"),
  shapeless("sausage_casing", [{ item: rid("cleaned_intestine") }], "sausage_casing", 2),
  // 1.1 蛋奶線與起司線
  shaped("milking_rack", ["F F", "PBP", "P P"], { F: { item: "minecraft:oak_fence" }, P: planks, B: { item: "minecraft:bucket" } }, "milking_rack"),
  shaped("cream_separator", ["III", " B ", "IPI"], { I: { item: "minecraft:iron_ingot" }, B: { item: "minecraft:bucket" }, P: planks }, "cream_separator"),
  shaped("ice_cream_churn", [" S ", "PIP", "PPP"], { S: { item: "minecraft:stick" }, I: { item: "minecraft:ice" }, P: planks }, "ice_cream_churn"),
  shapeless("vintage_cheese_slices", [{ item: rid("vintage_cheese_wheel") }], "vintage_cheese_slice", 5),
  shapeless("smoked_cheese_slices", [{ item: rid("smoked_cheese_wheel") }], "smoked_cheese_slice", 4),
  // 1.1 皮革線、絨毛線、布料線、孵化與飼料線
  shaped("spinning_wheel", ["SSS", "PTP", "P P"], { S: { item: "minecraft:stick" }, T: { item: "minecraft:string" }, P: planks }, "spinning_wheel"),
  shaped("weaving_loom", ["TTT", "PSP", "P P"], { T: { item: "minecraft:string" }, S: { item: "minecraft:stick" }, P: planks }, "weaving_loom"),
  shaped("silage_barrel", ["NNN", " B "], { N: { item: "minecraft:iron_nugget" }, B: { item: "minecraft:barrel" } }, "silage_barrel"),
  shaped("rug", ["CC"], { C: { item: rid("plush_cloth") } }, "rug", 2),
  shaped("leather_apron", ["L L", "LLL", " L "], { L: { item: rid("oiled_leather") } }, "leather_apron"),
  shaped("wool_hat", ["CCC", "C C"], { C: { item: rid("wool_cloth") } }, "wool_hat"),
  shaped("wool_scarf", ["CCC"], { C: { item: rid("wool_cloth") } }, "wool_scarf"),
  shaped("egg_candler", ["G", "T", "I"], { G: { item: "minecraft:glass" }, T: { item: "minecraft:torch" }, I: { item: "minecraft:iron_ingot" } }, "egg_candler"),
  shapeless("down_pillow", [{ item: rid("down"), count: 3 }, { item: rid("felt") }], "down_pillow"),
  shapeless("down_quilt", [{ item: rid("down"), count: 4 }, { item: rid("plush_cloth"), count: 2 }], "down_quilt"),
  shapeless("lasso", [{ item: rid("oiled_leather"), count: 2 }, { item: "minecraft:string" }], "lasso"),
  shapeless("feather_duster", [{ item: "minecraft:feather", count: 3 }, { item: "minecraft:stick" }], "feather_duster"),
  shapeless("felt", [{ item: rid("yarn"), count: 4 }], "felt", 2),
  shapeless("string_from_yarn", [{ item: rid("yarn") }], "minecraft:string"),
  shapeless("calcium_powder", [{ item: rid("eggshell"), count: 4 }], "calcium_powder"),

  // ## Every by-product has somewhere to go in 1.0. Where the proposal plans a
  // ## richer use later (1.1 spinning wheel, 1.2 candles, horns, down pillows),
  // ## these simple outlets keep the items useful until then.
  // Goose eggs work wherever a vanilla egg does
  // (Cookery's egg dishes and the vanilla cake take only minecraft:egg).
  shapeless("egg_from_goose_egg", [{ item: rid("goose_egg") }], "minecraft:egg", 2),
  // Restores the vanilla goat horn, which Ranching's goats no longer drop by ramming.
  shapeless("goat_horn", [{ item: rid("billy_goat_horn") }], "minecraft:goat_horn"),
  shapeless("bone_meal_from_cattle_horn", [{ item: rid("cattle_horn") }], "minecraft:bone_meal", 3),
  shapeless("bone_meal_from_chicken_frame", [{ item: rid("chicken_frame") }], "minecraft:bone_meal", 2),
  // Tallow candles (企劃書 1.2 牛脂、羊脂製品：蠟燭), in their simplest form.
  shapeless("candle_from_beef_tallow", [{ item: rid("beef_tallow") }, { item: "minecraft:string" }], "minecraft:candle"),
  shapeless("candle_from_mutton_tallow", [{ item: rid("mutton_tallow") }, { item: "minecraft:string" }], "minecraft:candle"),
  // Down and yak hair felted into wool until the 1.1 spinning wheel.
  shapeless("wool_from_down", [{ item: rid("down"), count: 4 }], "minecraft:white_wool"),
  shapeless("wool_from_yak_hair", [{ item: rid("yak_hair"), count: 4 }], "minecraft:brown_wool"),
];

// 1.1 鈣質飼料 is mixed in M2's feed mixer (a crafting table with its own tag).
RECIPES.push([
  "calcium_feed",
  {
    format_version: "1.20.10",
    "minecraft:recipe_shapeless": {
      description: { identifier: rid("m9_calcium_feed") },
      tags: [`${NAMESPACE}_feed_mixer`],
      ingredients: [{ item: rid("concentrate_feed") }, { item: rid("calcium_powder") }],
      result: { item: rid("calcium_feed"), count: 2 },
      unlock: [{ item: rid("calcium_powder") }],
    },
  },
]);

// --- M5 dish recipes made outside Cookery ---------------------------------------

const ingredient = (slot) => (typeof slot === "string" ? { item: rid(slot) } : { tag: slot.tag });
const m5 = (recipe) => {
  const [id, data] = recipe;
  const key = Object.keys(data).find((k) => k.startsWith("minecraft:recipe_"));
  data[key].description.identifier = rid(`m5_${id}`);
  return [`m5_${id}`, data];
};
for (const dish of DISHES.filter((d) => d.station === "crafting")) {
  RECIPES.push(m5(shapeless(dish.id, dish.slots.map((slot) => ingredient(slot[0])), dish.id)));
}
for (const prep of DISH_PREPS) {
  prep.makes.forEach((slots, i) => RECIPES.push(m5(shapeless(`${prep.id}_${i}`, slots.map(ingredient), prep.id))));
}
for (const dish of DISHES.filter((d) => d.station === "furnace")) {
  RECIPES.push([
    `m5_furnace_${dish.id}`,
    {
      format_version: "1.20.10",
      "minecraft:recipe_furnace": {
        description: { identifier: rid(`m5_furnace_${dish.id}`) },
        tags: ["furnace", "smoker"],
        input: rid(dish.input),
        output: rid(dish.id),
      },
    },
  ]);
}

for (const cook of VANILLA_COOKING) {
  if (cook.note) continue; // needs a source tag on manure first; see processing.js
  const isMeat = cook.output.startsWith("cooked_");
  RECIPES.push([
    cook.id.replace("/", "_"),
    {
      format_version: "1.20.10",
      "minecraft:recipe_furnace": {
        description: { identifier: rid(`m3_${cook.id.replace("/", "_")}`) },
        tags: isMeat ? ["furnace", "smoker", "campfire", "soul_campfire"] : ["furnace"],
        input: rid(cook.input),
        output: rid(cook.output),
      },
    },
  ]);
}

// --- Write -----------------------------------------------------------------

function writeFresh(dir, prefix, entries) {
  mkdirSync(dir, { recursive: true });
  for (const name of readdirSync(dir)) if (name.startsWith(prefix)) rmSync(join(dir, name));
  for (const [name, data] of entries) writeFileSync(join(dir, `${prefix}${name}.json`), JSON.stringify(data, null, 2) + "\n");
}

const items = ITEMS.filter((item) => item.owner !== "m2");
writeFresh(
  join(root, "packs/BP/items"),
  "r_",
  items.map((item) => [
    item.id,
    {
      format_version: OVERRIDES[item.id]?.format ?? FORMAT,
      "minecraft:item": {
        description: {
          identifier: rid(item.id),
          // Dishes and their uncooked steps sit with Cookery's foods in the creative inventory.
          menu_category:
            item.category === "dish" || item.category === "prep"
              ? { category: "equipment", group: "kaleidoscope_cookery:itemGroup.name.foods" }
              : { category: MENU[item.category] ?? "items" },
        },
        components: componentsFor(item),
      },
    },
  ])
);
writeFresh(join(root, "packs/BP/recipes"), "r_", RECIPES);
console.log(`gen_items: wrote ${items.length} items, ${RECIPES.length} recipes`);
