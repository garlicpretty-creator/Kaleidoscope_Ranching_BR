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

const tierOf = (id) => (id.endsWith("_superb") ? 2 : id.endsWith("_fine") ? 1 : 0);

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
  // Places the aged cheese wheel block (same id; the item replaces the block's own item).
  aged_cheese_wheel: {
    stack: 16,
    format: "1.21.90",
    components: { "minecraft:block_placer": { block: rid("aged_cheese_wheel"), replace_block_item: true } },
  },
  ghee: { stack: 16 },
  whey: { stack: 16, ...food(1, 0.2, { drink: true, converts: "minecraft:glass_bottle", always: true }) },
  salted_duck_egg: food(4, 0.6),
  century_egg: food(5, 0.6),
  // Lard is a Cookery oil container (api/cookeryRecipes.js): its oil count is an
  // item dynamic property, so it cannot stack.
  lard: { stack: 1 },
  // Dried yak dung burns like a stick-and-a-half of coal: 30 s, three smelts.
  dried_yak_dung: { components: { "minecraft:fuel": { duration: 30 } } },
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
      const t = tierOf(item.id);
      Object.assign(c, food([2, 3, 4][t], [0.4, 0.6, 0.8][t], { drink: true, converts: "minecraft:glass_bottle", always: true }));
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
  }
  const override = OVERRIDES[item.id] ?? {};
  const { stack: overrideStack, format: _format, components = {}, ...overrideComponents } = override;
  Object.assign(c, overrideComponents, components);
  if (overrideStack) stack = overrideStack;
  if (c["minecraft:food"] && !tags.includes("minecraft:is_food")) tags.push("minecraft:is_food");

  return {
    "minecraft:icon": `kr_${item.id}`,
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
      unlock: [{ item: rid(result) }],
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
  shapeless("milking_pail", [{ item: "minecraft:bucket" }, { item: "minecraft:stick" }], "milking_pail"),
  shapeless("nursing_bottle", [{ item: "minecraft:glass_bottle" }, { item: "minecraft:slime_ball" }], "nursing_bottle"),
  shapeless("cheese_slices", [{ item: rid("aged_cheese_wheel") }], "cheese_slice", 4),
];

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
          // Dishes sit with Cookery's foods in the creative inventory.
          menu_category:
            item.category === "dish"
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
