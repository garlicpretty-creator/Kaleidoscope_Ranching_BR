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
  { id: "press/fresh_cheese", station: "cheese_press", inputs: [{ anyOf: ANY_MILK, count: 3 }], outputs: [{ item: "fresh_cheese", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "aging/cheese_wheel", station: "aging_rack", inputs: [{ item: "fresh_cheese", count: 4 }], outputs: [{ item: "aged_cheese_wheel", count: 1 }], ticks: DAY * 3 },

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
