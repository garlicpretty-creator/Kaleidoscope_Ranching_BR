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

// ## Milk and eggs have no quality grades (the player's call, replacing the
// ## proposal's three tiers).
const MILK = [
  ["cow_milk", "牛奶", "Cow Milk", "milk"],
  ["goat_milk", "山羊奶", "Goat Milk", "milk"],
  ["buffalo_milk", "水牛奶", "Buffalo Milk", "milk"],
  ["yak_milk", "氂牛奶", "Yak Milk", "milk"],
];

// ## The unfertilized chicken egg is the vanilla `minecraft:egg`, so every
// ## existing Cookery egg recipe keeps working. Only the fertilized egg is a
// ## Ranching item.
const EGGS = [
  ["duck_egg", "鴨蛋", "Duck Egg", "egg"],
  ["goose_egg", "鵝蛋", "Goose Egg", "egg"],
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

// 1.1 蛋奶線 (企劃書 1.1 三、蛋奶線).
const DAIRY_LINE = [
  ["skim_milk", "脫脂奶", "Skim Milk", "dairy"],
  ["vanilla_ice_cream", "香草冰淇淋", "Vanilla Ice Cream", "dairy"],
  ["berry_ice_cream", "莓果冰淇淋", "Berry Ice Cream", "dairy"],
  ["chocolate_ice_cream", "可可冰淇淋", "Chocolate Ice Cream", "dairy"],
  ["custard", "卡士達醬", "Custard", "dairy"],
  // Rooted up by well-loved pigs in forests (systems/truffle.js).
  ["truffle", "松露", "Truffle", "byproduct"],
];

// 1.1 起司線 (企劃書 1.1 四、起司線): a cheese per milk, aged and smoked wheels, whey and skim-milk curds.
const CHEESE_LINE = [
  ["goat_cheese", "山羊乳酪", "Goat Cheese", "dairy"],
  ["aged_goat_cheese", "熟成山羊乳酪", "Aged Goat Cheese", "dairy"],
  ["mozzarella", "莫札瑞拉", "Mozzarella", "dairy"],
  ["chhurpi", "曲拉", "Chhurpi", "dairy"],
  ["chhurpi_block", "曲拉塊", "Dried Chhurpi", "dairy"],
  ["vintage_cheese_wheel", "陳年乳酪輪", "Vintage Cheese Wheel", "dairy"],
  ["vintage_cheese_slice", "陳年乳酪片", "Vintage Cheese Slice", "dairy"],
  ["smoked_cheese_wheel", "煙燻乳酪輪", "Smoked Cheese Wheel", "dairy"],
  ["smoked_cheese_slice", "煙燻乳酪片", "Smoked Cheese Slice", "dairy"],
  ["ricotta", "瑞可塔", "Ricotta", "dairy"],
  ["milk_tofu", "奶豆腐", "Milk Tofu", "dairy"],
];

// 1.1 皮革線、絨毛線、布料線 (企劃書 1.1 五～七). The harness, pack bag, gloves
// and animal blanket belong to M10 (they work with the plough, the yak's
// storage, sleeping and the cold rule).
const LEATHER_LINE = [
  ["oiled_leather", "油鞣皮革", "Oiled Leather", "material"],
  ["leather_apron", "皮圍裙", "Leather Apron", "tool"],
  ["lasso", "套索", "Lasso", "tool"],
  // Worn by an adult yak (systems/packBag.js): 15 slots carried on the animal.
  ["pack_bag", "馱袋", "Pack Bag", "tool"],
];
const FLUFF_LINE = [
  ["goat_cashmere", "山羊絨", "Goat Cashmere", "byproduct"],
  ["rabbit_fur", "兔毛", "Rabbit Fur", "byproduct"],
  ["yarn", "毛線", "Yarn", "material"],
  ["fine_yarn", "絨線", "Fine Yarn", "material"],
  ["feather_duster", "羽毛撣", "Feather Duster", "tool"],
];
const CLOTH_LINE = [
  ["felt", "毛氈", "Felt", "material"],
  ["wool_cloth", "毛呢布", "Wool Cloth", "material"],
  ["plush_cloth", "絨布", "Plush Cloth", "material"],
  ["wool_hat", "毛帽", "Wool Hat", "tool"],
  ["wool_scarf", "圍巾", "Wool Scarf", "tool"],
];
// 1.1 役用與牧場管理 (企劃書 1.1 九): systems/workAnimals.js. The gloves and the
// blanket come from the leather and cloth lines; they act on sleep and the cold.
const WORK_LINE = [
  ["harness", "挽具", "Harness", "tool"],
  ["plough", "犁", "Plow", "tool"],
  ["animal_blanket", "動物披毯", "Animal Blanket", "tool"],
  ["leather_gloves", "皮手套", "Leather Gloves", "tool"],
  ["herding_horn", "牧笛", "Herding Horn", "tool"],
];

// 1.1 健康與系列整合 (企劃書 1.1 十): systems/disease.js, api/tavern.js. The two
// drinks are made in the Tavern's shaker, so they exist only when it is installed.
const HEALTH_LINE = [
  ["vet_medicine", "獸藥", "Veterinary Medicine", "tool"],
  ["soap", "肥皂", "Soap", "tool"],
  ["cream_cocoa", "鮮奶油可可飲", "Cream Cocoa", "drink"],
  ["yogurt_berry_drink", "優格莓果飲", "Yogurt Berry Drink", "drink"],
  // Milk wine ferments in the Tavern's barrel: the buckets are its fluids, the
  // horn cup carries the wine out and comes back when the wine is drunk.
  ["fresh_milk_bucket", "桶裝鮮奶", "Bucket of Fresh Milk", "drink"],
  ["yak_milk_bucket", "桶裝氂牛奶", "Bucket of Yak Milk", "drink"],
  ["horn_cup", "角杯", "Horn Cup", "tool"],
  ["milk_wine", "奶酒", "Milk Wine", "drink"],
  ["yak_milk_wine", "氂牛奶酒", "Yak Milk Wine", "drink"],
];

// 1.1 孵化與飼料線 (企劃書 1.1 八).
const HATCH_FEED_LINE = [
  ["egg_candler", "照蛋燈", "Egg Candler", "tool"],
  ["eggshell", "蛋殼", "Eggshell", "byproduct"],
  ["calcium_powder", "鈣粉", "Calcium Powder", "byproduct"],
  ["calcium_feed", "鈣質飼料", "Calcium Feed", "feed"],
  ["silage", "青貯料", "Silage", "feed"],
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
  ["forage", "飼草", "Chopped Forage", "feed", "m2"],
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
  ["brush", "毛刷", "Grooming Brush", "tool", "m2"],
  // 觀察手冊 (formerly 牧場記事本; the id stays so existing worlds keep their copies).
  ["ranch_notebook", "觀察手冊", "Observation Journal", "tool", "m2"],
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
  ...DAIRY_LINE,
  ...CHEESE_LINE,
  ...LEATHER_LINE,
  ...FLUFF_LINE,
  ...CLOTH_LINE,
  ...HATCH_FEED_LINE,
  ...WORK_LINE,
  ...HEALTH_LINE,
  ...BYPRODUCTS,
  ...FEED,
  ...TREATS,
  ...TOOLS,
  // M5 dishes and their uncooked steps (data/dishes.js).
  ...DISHES.map((dish) => [dish.id, dish.zh, dish.en, "dish", "m5"]),
  ...DISH_PREPS.map((prep) => [prep.id, prep.zh, prep.en, "prep", "m5"]),
].map(([id, zh, en, category, owner = "ranching"]) => ({ id, zh, en, category, owner }));
