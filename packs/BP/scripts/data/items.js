// Item registry for 1.0.0: the single source of truth for item identifiers and
// display names. Item JSON and language files are generated from this table.
//
// Every entry is [id, zh_TW name, en_US name, category, owner?]. Identifiers
// are written without the `kaleidoscope_ranching:` namespace.
//
// `owner` says which milestone generates the item's JSON, icon and name:
// "m2" items come from tools/m2/gen_content.py; every other item is generated
// by tools/gen_items.mjs. The registry still lists M2 items so every table can
// be checked against one list of identifiers.

import { DISHES, DISH_PREPS } from "./dishes.js";

export const NAMESPACE = "kaleidoscope_ranching";

/** Quality tiers. The plain tier has no suffix so recipes can name it directly. */
export const QUALITY_TIERS = [
  { id: "plain", suffix: "", zh: "", en: "" },
  { id: "fine", suffix: "_fine", zh: "優良", en: "Fine " },
  { id: "superb", suffix: "_superb", zh: "極品", en: "Superb " },
];

/** Expands one base item into its three quality tiers. */
function tiered(id, zh, en, category) {
  return QUALITY_TIERS.map((tier) => [id + tier.suffix, tier.zh + zh, tier.en + en, category]);
}

/** [id, zh_TW, en_US] for every animal; also used for entity names. */
export const ANIMAL_NAMES = [
  ["cow", "牛", "Cow"],
  ["sheep", "羊", "Sheep"],
  ["goat", "山羊", "Goat"],
  ["pig", "豬", "Pig"],
  ["chicken", "雞", "Chicken"],
  ["rabbit", "兔", "Rabbit"],
  ["duck", "鴨", "Duck"],
  ["goose", "鵝", "Goose"],
  ["buffalo", "水牛", "Buffalo"],
  ["yak", "氂牛", "Yak"],
];

const MILK = [
  ...tiered("cow_milk", "牛奶", "Cow Milk", "milk"),
  ...tiered("goat_milk", "山羊奶", "Goat Milk", "milk"),
  ...tiered("buffalo_milk", "水牛奶", "Buffalo Milk", "milk"),
  ...tiered("yak_milk", "氂牛奶", "Yak Milk", "milk"),
];

// ## The plain unfertilized chicken egg is the vanilla `minecraft:egg`, so every
// ## existing Cookery egg recipe keeps working. Only its two better tiers and
// ## the fertilized egg are Ranching items.
const EGGS = [
  ["egg_fine", "優良雞蛋", "Fine Egg", "egg"],
  ["egg_superb", "極品雞蛋", "Superb Egg", "egg"],
  ...tiered("duck_egg", "鴨蛋", "Duck Egg", "egg"),
  ...tiered("goose_egg", "鵝蛋", "Goose Egg", "egg"),
  ["fertilized_chicken_egg", "受精雞蛋", "Fertilized Chicken Egg", "fertilized_egg"],
  ["fertilized_duck_egg", "受精鴨蛋", "Fertilized Duck Egg", "fertilized_egg"],
  ["fertilized_goose_egg", "受精鵝蛋", "Fertilized Goose Egg", "fertilized_egg"],
];

const DAIRY = [
  ["butter", "奶油", "Butter", "dairy"],
  ["cream", "鮮奶油", "Cream", "dairy"],
  ["ghee", "酥油", "Ghee", "dairy"],
  ["yogurt", "優格", "Yogurt", "dairy"],
  ["fresh_cheese", "新鮮乳酪", "Fresh Cheese", "dairy"],
  ["aged_cheese_wheel", "熟成乳酪輪", "Aged Cheese Wheel", "dairy"],
  ["cheese_slice", "乳酪塊", "Cheese Slice", "dairy"],
  ["whey", "乳清", "Whey", "byproduct"],
  // From the food waste bin (systems/foodWasteBin.js); vegetable-kind feed.
  ["food_waste", "廚餘", "Food Scraps", "byproduct"],
];

const PRESERVED_EGGS = [
  ["salted_duck_egg", "鹹鴨蛋", "Salted Duck Egg", "preserved"],
  ["century_egg", "皮蛋", "Century Egg", "preserved"],
];

const CARCASSES = ANIMAL_NAMES.map(([id, zh, en]) => [`${id}_carcass`, `${zh}屠體`, `${en} Carcass`, "carcass"]);

// Meat from the four new animals. The six replaced animals drop vanilla raw meat.
const MEAT = [
  ["buffalo_meat", "生水牛肉", "Raw Buffalo Meat", "meat"],
  ["cooked_buffalo_meat", "熟水牛肉", "Cooked Buffalo Meat", "meat"],
  ["yak_meat", "生氂牛肉", "Raw Yak Meat", "meat"],
  ["cooked_yak_meat", "熟氂牛肉", "Cooked Yak Meat", "meat"],
  ["duck_meat", "生鴨肉", "Raw Duck", "meat"],
  ["cooked_duck_meat", "熟鴨肉", "Cooked Duck", "meat"],
  ["goose_meat", "生鵝肉", "Raw Goose", "meat"],
  ["cooked_goose_meat", "熟鵝肉", "Cooked Goose", "meat"],
];

const CUTS = [
  ["beef_brisket", "牛腩", "Beef Brisket", "cut"],
  ["beef_shank", "牛腱", "Beef Shank", "cut"],
  ["beef_sirloin", "牛排", "Beef Sirloin", "cut"],
  ["pork_belly", "五花肉", "Pork Belly", "cut"],
  ["pork_ribs", "排骨", "Pork Ribs", "cut"],
  ["pork_trotter", "豬蹄", "Pork Trotter", "cut"],
  ["lamb_chop", "羊排", "Lamb Chop", "cut"],
  ["lamb_leg", "羊腿", "Lamb Leg", "cut"],
  ["chicken_leg", "雞腿", "Chicken Leg", "cut"],
  ["chicken_wing", "雞翅", "Chicken Wing", "cut"],
  ["duck_leg", "鴨腿", "Duck Leg", "cut"],
  ["goose_leg", "鵝腿", "Goose Leg", "cut"],
  ["rabbit_leg", "兔腿", "Rabbit Leg", "cut"],
];

// 1.1 肉類線 (企劃書 1.1 一、肉類線): the meat grinder's mince and sausages, and
// what the butcher rack air-dries (data/processing.js DRYING).
const MEAT_LINE = [
  ["pork_mince", "豬絞肉", "Ground Pork", "mince"],
  ["beef_mince", "牛絞肉", "Ground Beef", "mince"],
  ["mutton_mince", "羊絞肉", "Ground Mutton", "mince"],
  ["raw_sausage", "生香腸", "Raw Sausage", "mince"],
  ["cured_sausage", "臘腸", "Cured Sausage", "cured"],
  ["cured_pork_belly", "臘肉", "Cured Pork Belly", "cured"],
  ["cured_duck_leg", "臘鴨腿", "Cured Duck Leg", "cured"],
  ["beef_jerky", "牛肉乾", "Beef Jerky", "cured"],
];

// 1.1 內臟線 (企劃書 1.1 二、內臟線): offal from the butcher rack's offal stroke
// (data/butcher.js), washed at the water trough (data/processing.js WASHING).
const OFFAL_LINE = [
  ["pork_liver", "豬肝", "Pork Liver", "offal"],
  ["pig_intestine", "豬腸", "Pig Intestine", "offal"],
  ["chicken_gizzard", "雞胗", "Chicken Gizzard", "offal"],
  ["duck_blood", "鴨血", "Duck Blood", "offal"],
  ["goose_liver", "鵝肝", "Goose Liver", "offal"],
  ["beef_tripe", "牛肚", "Beef Tripe", "offal"],
  ["cleaned_intestine", "洗淨的大腸", "Cleaned Intestine", "offal"],
  ["cleaned_tripe", "洗淨的牛肚", "Cleaned Tripe", "offal"],
  ["sausage_casing", "腸衣", "Sausage Casing", "byproduct"],
  ["foie_gras_pate", "鵝肝醬", "Goose Liver Pâté", "dairy"],
];

const BYPRODUCTS = [
  ["large_bone", "大骨", "Large Bone", "byproduct"],
  ["chicken_frame", "雞骨架", "Chicken Frame", "byproduct"],
  ["raw_hide", "生皮", "Raw Hide", "byproduct"],
  ["sheep_skin", "羊皮", "Sheepskin", "byproduct"],
  ["pig_skin", "豬皮", "Pig Skin", "byproduct"],
  ["beef_tallow", "牛脂", "Beef Tallow", "byproduct"],
  ["mutton_tallow", "羊脂", "Mutton Tallow", "byproduct"],
  ["pork_fat", "豬板油", "Pork Fat", "byproduct"],
  ["lard", "豬油", "Lard", "byproduct"],
  ["cattle_horn", "牛角", "Cattle Horn", "byproduct"],
  ["billy_goat_horn", "羊角", "Billy Goat Horn", "byproduct"],
  ["down", "羽絨", "Down", "byproduct"],
  ["yak_hair", "氂牛毛", "Yak Hair", "byproduct"],
  ["pig_bristle", "豬鬃", "Pig Bristle", "byproduct", "m2"],
  ["manure_item", "糞便", "Manure", "byproduct", "m2"],
  ["dried_yak_dung", "乾氂牛糞", "Dried Yak Dung", "byproduct"],
  ["fertilizer", "肥料", "Fertilizer", "byproduct", "m2"],
];

const FEED = [
  ["alfalfa", "苜蓿", "Alfalfa", "feed", "m2"],
  ["alfalfa_seeds", "苜蓿種子", "Alfalfa Seeds", "feed", "m2"],
  ["forage", "飼草", "Forage", "feed", "m2"],
  ["mixed_feed", "混合飼料", "Mixed Feed", "feed", "m2"],
  ["concentrate_feed", "精飼料", "Concentrate Feed", "feed", "m2"],
];

const TREATS = [
  ["alfalfa_cake", "苜蓿草餅", "Alfalfa Cake", "treat", "m2"],
  ["grain_cake", "穀物糕", "Grain Cake", "treat", "m2"],
  ["beet_sugar_cube", "甜菜糖塊", "Beet Sugar Cube", "treat", "m2"],
  ["carrot_chips", "胡蘿蔔脆片", "Carrot Chips", "treat", "m2"],
];

const TOOLS = [
  ["milking_pail", "擠奶桶", "Milking Pail", "tool"],
  ["nursing_bottle", "奶瓶", "Nursing Bottle", "tool"],
  ["cowbell", "牧鈴", "Cowbell", "tool"],
  // A hand-held item, not a block: it carries one animal (systems/crate.js).
  ["animal_crate", "運畜籠", "Animal Crate", "tool"],
  ["brush", "毛刷", "Brush", "tool", "m2"],
  ["ranch_notebook", "牧場記事本", "Ranch Notebook", "tool", "m2"],
  ["ear_tag", "耳標", "Ear Tag", "tool", "m2"],
  ["feed_bag", "飼料袋", "Feed Bag", "tool", "m2"],
  ["manure_fork", "糞叉", "Manure Fork", "tool", "m2"],
];

export const ITEMS = [
  ...MILK,
  ...EGGS,
  ...DAIRY,
  ...PRESERVED_EGGS,
  ...CARCASSES,
  ...MEAT,
  ...CUTS,
  ...MEAT_LINE,
  ...OFFAL_LINE,
  ...BYPRODUCTS,
  ...FEED,
  ...TREATS,
  ...TOOLS,
  // M5 dishes and their uncooked steps (data/dishes.js).
  ...DISHES.map((dish) => [dish.id, dish.zh, dish.en, "dish", "m5"]),
  ...DISH_PREPS.map((prep) => [prep.id, prep.zh, prep.en, "prep", "m5"]),
].map(([id, zh, en, category, owner = "ranching"]) => ({ id, zh, en, category, owner }));

/** All three tier identifiers for a tiered base item, plain tier first. */
export function tierIds(baseId) {
  return QUALITY_TIERS.map((tier) => baseId + tier.suffix);
}
