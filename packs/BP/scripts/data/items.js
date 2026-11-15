// Item registry for 1.0.0: the single source of truth for item identifiers and
// display names. Item JSON and language files are generated from this table.
//
// Every entry is [id, zh_TW name, en_US name, category]. Identifiers are
// written without the `kaleidoscope_ranching:` namespace.

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

const ANIMAL_NAMES = [
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
  ["pig_bristle", "豬鬃", "Pig Bristle", "byproduct"],
  ["manure", "糞便", "Manure", "byproduct"],
  ["dried_yak_dung", "乾氂牛糞", "Dried Yak Dung", "byproduct"],
  ["fertilizer", "肥料", "Fertilizer", "byproduct"],
];

const FEED = [
  ["alfalfa", "苜蓿", "Alfalfa", "feed"],
  ["alfalfa_seeds", "苜蓿種子", "Alfalfa Seeds", "feed"],
  ["forage", "飼草", "Forage", "feed"],
  ["mixed_feed", "混合飼料", "Mixed Feed", "feed"],
  ["premium_feed", "精飼料", "Premium Feed", "feed"],
  ["swill", "廚餘飼料", "Swill", "feed"],
];

const TREATS = ANIMAL_NAMES.map(([id, zh, en]) => [`${id}_treat`, `${zh}零食`, `${en} Treat`, "treat"]);

const TOOLS = [
  ["milking_pail", "擠奶桶", "Milking Pail", "tool"],
  ["brush", "毛刷", "Brush", "tool"],
  ["cowbell", "牧鈴", "Cowbell", "tool"],
  ["ranch_notebook", "牧場記事本", "Ranch Notebook", "tool"],
  ["ear_tag", "耳標", "Ear Tag", "tool"],
  ["nursing_bottle", "奶瓶", "Nursing Bottle", "tool"],
  ["feed_bag", "飼料袋", "Feed Bag", "tool"],
  ["pitchfork", "糞叉", "Pitchfork", "tool"],
];

export const ITEMS = [
  ...MILK,
  ...EGGS,
  ...DAIRY,
  ...PRESERVED_EGGS,
  ...CARCASSES,
  ...MEAT,
  ...CUTS,
  ...BYPRODUCTS,
  ...FEED,
  ...TREATS,
  ...TOOLS,
].map(([id, zh, en, category]) => ({ id, zh, en, category }));

/** All three tier identifiers for a tiered base item, plain tier first. */
export function tierIds(baseId) {
  return QUALITY_TIERS.map((tier) => baseId + tier.suffix);
}
