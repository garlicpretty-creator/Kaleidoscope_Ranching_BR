// Processing recipes for Ranching's own stations in 1.0.0.
//
// - station: block id from blocks.js.
// - inputs:  each entry is { item, count } or { anyOf: [...items], count }.
// - outputs: each entry is { item, count }.
// - ticks:   processing time in game ticks (24000 = one game day). Stations
//            record the start time and compare on collection; nothing ticks
//            while the player is away.
//
// No 1.0.0 processed good is tiered. The quality of the milk or eggs that went
// in scales the output `count` through QUALITY_YIELD instead.
//
// Identifiers without a namespace belong to `kaleidoscope_ranching:`.

import { tierIds } from "./items.js";

const DAY = 24000;

const ANY_COW_LIKE_MILK = [...tierIds("cow_milk"), ...tierIds("goat_milk"), ...tierIds("buffalo_milk")];
const ANY_YAK_MILK = tierIds("yak_milk");
const ANY_MILK = [...ANY_COW_LIKE_MILK, ...ANY_YAK_MILK];
const ANY_DUCK_EGG = tierIds("duck_egg");

/** Output multiplier by the quality tier of the milk or egg that went in. */
export const QUALITY_YIELD = { plain: 1, fine: 1.5, superb: 2 };

export const PROCESSING_RECIPES = [
  // Butter churn
  { id: "churn/butter", station: "butter_churn", inputs: [{ anyOf: ANY_COW_LIKE_MILK, count: 2 }], outputs: [{ item: "butter", count: 1 }], ticks: 600 },
  { id: "churn/cream", station: "butter_churn", inputs: [{ anyOf: ANY_COW_LIKE_MILK, count: 1 }], outputs: [{ item: "cream", count: 1 }], ticks: 300 },
  { id: "churn/ghee", station: "butter_churn", inputs: [{ anyOf: ANY_YAK_MILK, count: 2 }], outputs: [{ item: "ghee", count: 1 }], ticks: 600 },

  // Cheese press, then aging rack
  // 1.1 起司線: the press makes a cheese per milk (1.0 made fresh cheese from any milk).
  { id: "press/fresh_cheese", station: "cheese_press", inputs: [{ anyOf: tierIds("cow_milk"), count: 3 }], outputs: [{ item: "fresh_cheese", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/goat_cheese", station: "cheese_press", inputs: [{ anyOf: tierIds("goat_milk"), count: 3 }], outputs: [{ item: "goat_cheese", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/mozzarella", station: "cheese_press", inputs: [{ anyOf: tierIds("buffalo_milk"), count: 3 }], outputs: [{ item: "mozzarella", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/chhurpi", station: "cheese_press", inputs: [{ anyOf: ANY_YAK_MILK, count: 3 }], outputs: [{ item: "chhurpi", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/ricotta", station: "cheese_press", inputs: [{ item: "whey", count: 3 }], outputs: [{ item: "ricotta", count: 1 }], ticks: DAY / 4 },
  { id: "press/milk_tofu", station: "cheese_press", inputs: [{ item: "skim_milk", count: 3 }], outputs: [{ item: "milk_tofu", count: 2 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  // 1.1: left 7 days the wheel comes out vintage; over a lit campfire, smoked (SMOKING).
  { id: "aging/cheese_wheel", station: "aging_rack", inputs: [{ item: "fresh_cheese", count: 4 }], outputs: [{ item: "aged_cheese_wheel", count: 1 }], ticks: DAY * 3, aged: { ticks: DAY * 7, outputs: [{ item: "vintage_cheese_wheel", count: 1 }] } },
  { id: "aging/goat_cheese", station: "aging_rack", inputs: [{ item: "goat_cheese", count: 2 }], outputs: [{ item: "aged_goat_cheese", count: 1 }], ticks: DAY * 3 },
  { id: "aging/chhurpi", station: "aging_rack", inputs: [{ item: "chhurpi", count: 2 }], outputs: [{ item: "chhurpi_block", count: 2 }], ticks: DAY * 2 },

  // Tanning rack (企劃書 1.1, moved into 1.0): hides from the butcher rack become leather.
  { id: "tan/raw_hide", station: "tanning_rack", inputs: [{ item: "raw_hide", count: 1 }], outputs: [{ item: "minecraft:leather", count: 1 }], ticks: DAY },
  { id: "tan/pig_skin", station: "tanning_rack", inputs: [{ item: "pig_skin", count: 1 }], outputs: [{ item: "minecraft:leather", count: 1 }], ticks: DAY },
  // Sheepskin keeps its fleece: leather plus a little wool.
  { id: "tan/sheep_skin", station: "tanning_rack", inputs: [{ item: "sheep_skin", count: 1 }], outputs: [{ item: "minecraft:leather", count: 1 }, { item: "minecraft:white_wool", count: 1 }], ticks: DAY },

  // Fermenting jar
  { id: "ferment/yogurt", station: "fermenting_jar", inputs: [{ anyOf: ANY_MILK, count: 1 }], outputs: [{ item: "yogurt", count: 1 }], ticks: DAY },

  // Pickling vat
  { id: "pickle/salted_duck_egg", station: "pickling_vat", inputs: [{ anyOf: ANY_DUCK_EGG, count: 4 }, { item: "minecraft:clay_ball", count: 1 }], outputs: [{ item: "salted_duck_egg", count: 4 }], ticks: DAY * 2 },
  { id: "pickle/century_egg", station: "pickling_vat", inputs: [{ anyOf: ANY_DUCK_EGG, count: 4 }, { item: "minecraft:charcoal", count: 1 }, { item: "minecraft:clay_ball", count: 1 }], outputs: [{ item: "century_egg", count: 4 }], ticks: DAY * 3 },

];

// --- 1.1 肉類線與內臟線 -----------------------------------------------------

const ANY_MINCE = ["pork_mince", "beef_mince", "mutton_mince"];

// The meat grinder is cranked: every use turns the held meat into one mince at
// once (ticks 0), like one stroke on the butcher rack.
PROCESSING_RECIPES.push(
  { id: "grind/pork", station: "meat_grinder", inputs: [{ anyOf: ["minecraft:porkchop"], count: 1 }], outputs: [{ item: "pork_mince", count: 1 }], ticks: 0 },
  { id: "grind/beef", station: "meat_grinder", inputs: [{ anyOf: ["minecraft:beef", "buffalo_meat", "yak_meat"], count: 1 }], outputs: [{ item: "beef_mince", count: 1 }], ticks: 0 },
  { id: "grind/mutton", station: "meat_grinder", inputs: [{ anyOf: ["minecraft:mutton"], count: 1 }], outputs: [{ item: "mutton_mince", count: 1 }], ticks: 0 },
  { id: "grind/sausage", station: "meat_grinder", inputs: [{ anyOf: ANY_MINCE, count: 2 }, { item: "sausage_casing", count: 1 }], outputs: [{ item: "raw_sausage", count: 2 }], ticks: 0 },
  { id: "churn/foie_gras_pate", station: "butter_churn", inputs: [{ item: "goose_liver", count: 1 }, { item: "butter", count: 1 }], outputs: [{ item: "foie_gras_pate", count: 1 }], ticks: 600 },
);

// --- 1.1 蛋奶線 -----------------------------------------------------------------

const ANY_CHICKEN_EGG = ["minecraft:egg", "egg_fine", "egg_superb"];

PROCESSING_RECIPES.push(
  // The separator is automated (AUTO_STATIONS): milk from the container above, cream and skim milk below.
  { id: "separate/cow_like", station: "cream_separator", inputs: [{ anyOf: ANY_COW_LIKE_MILK, count: 1 }], outputs: [{ item: "cream", count: 1 }, { item: "skim_milk", count: 1 }], ticks: DAY / 2 },
  { id: "separate/yak", station: "cream_separator", inputs: [{ anyOf: ANY_YAK_MILK, count: 1 }], outputs: [{ item: "cream", count: 1 }, { item: "skim_milk", count: 1 }], ticks: DAY / 2 },
  // Ice cream is cranked (ticks 0). Flavoured recipes have more inputs, so they are tried first.
  { id: "ice_cream/vanilla", station: "ice_cream_churn", inputs: [{ item: "cream", count: 1 }, { item: "minecraft:sugar", count: 1 }, { item: "minecraft:ice", count: 1 }], outputs: [{ item: "vanilla_ice_cream", count: 2 }], ticks: 0 },
  { id: "ice_cream/berry", station: "ice_cream_churn", inputs: [{ item: "cream", count: 1 }, { item: "minecraft:sugar", count: 1 }, { item: "minecraft:ice", count: 1 }, { item: "minecraft:sweet_berries", count: 1 }], outputs: [{ item: "berry_ice_cream", count: 2 }], ticks: 0 },
  { id: "ice_cream/chocolate", station: "ice_cream_churn", inputs: [{ item: "cream", count: 1 }, { item: "minecraft:sugar", count: 1 }, { item: "minecraft:ice", count: 1 }, { item: "minecraft:cocoa_beans", count: 1 }], outputs: [{ item: "chocolate_ice_cream", count: 2 }], ticks: 0 },
  { id: "churn/custard", station: "butter_churn", inputs: [{ anyOf: ANY_CHICKEN_EGG, count: 2 }, { anyOf: ANY_MILK, count: 1 }, { item: "minecraft:sugar", count: 1 }], outputs: [{ item: "custard", count: 2 }], ticks: 300 },
);

/** Stations that also run on the ranch clock with containers above and below (systems/stations.js). */
export const AUTO_STATIONS = ["cream_separator"];

/** Aging-rack outputs that come out smoked over a lit campfire (企劃書 1.1 煙燻乳酪). */
export const SMOKING = {
  aged_cheese_wheel: "smoked_cheese_wheel",
  vintage_cheese_wheel: "smoked_cheese_wheel",
};

/** Air-drying on an empty butcher rack (企劃書 1.1 掛架風乾): input → output. */
export const DRYING = {
  raw_sausage: "cured_sausage",
  pork_belly: "cured_pork_belly",
  duck_leg: "cured_duck_leg",
  beef_shank: "beef_jerky",
};
/** Pieces one rack holds, and how long they hang. */
export const DRYING_SLOTS = 4;
export const DRYING_TICKS = DAY * 3;

/** Washed at the water trough for one level of water (企劃書 1.1 清洗): input → output. */
export const WASHING = {
  pig_intestine: "cleaned_intestine",
  beef_tripe: "cleaned_tripe",
};

// Recipes that use vanilla workstations rather than a Ranching block.
export const VANILLA_COOKING = [
  { id: "furnace/lard", kind: "furnace", input: "pork_fat", output: "lard" },
  { id: "furnace/cooked_buffalo_meat", kind: "furnace", input: "buffalo_meat", output: "cooked_buffalo_meat" },
  { id: "furnace/cooked_yak_meat", kind: "furnace", input: "yak_meat", output: "cooked_yak_meat" },
  { id: "furnace/cooked_duck_meat", kind: "furnace", input: "duck_meat", output: "cooked_duck_meat" },
  { id: "furnace/cooked_goose_meat", kind: "furnace", input: "goose_meat", output: "cooked_goose_meat" },
];

// Raw/cooked pairs sent to Cookery through `kaleidoscope_cookery:register_wok_meat`.
export const WOK_MEATS = [
  { raw: "buffalo_meat", cooked: "cooked_buffalo_meat" },
  { raw: "yak_meat", cooked: "cooked_yak_meat" },
  { raw: "duck_meat", cooked: "cooked_duck_meat" },
  { raw: "goose_meat", cooked: "cooked_goose_meat" },
];
