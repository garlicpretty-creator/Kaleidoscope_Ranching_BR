// M5 dishes: Ranching foods cooked on Cookery's stations, plus a few made with
// vanilla crafting or the furnace. One row per dish; the items, recipes,
// Cookery registrations (api/cookeryRecipes.js) and the guidebook chapter all
// come from this table.
//
// station:
//   stockpot  Cookery stockpot, exact recipe. `slots`: each slot lists the
//             items that may fill it (any one).
//   wok       Cookery wok. `slots` as above (Cookery 1.6.6 accepts alternatives).
//   steamer   Cookery steamer: one `input` item becomes the dish.
//   furnace   vanilla furnace and smoker: one `input` item becomes the dish.
//   crafting  shapeless crafting table recipe from `slots` (one item each).
// carrier: what the player holds to take the dish out of a Cookery station;
//   eating the dish gives it back. "" = taken by hand, nothing given back.
// look: placeholder icon until the RetroDiffusion icons are picked.

const NS = "kaleidoscope_ranching";
const r = (id) => (id.includes(":") ? id : `${NS}:${id}`);
const tiers = (base) => [r(base), r(`${base}_fine`), r(`${base}_superb`)];
const KC = (id) => `kaleidoscope_cookery:${id}`;

/** Any Ranching milk, any quality. */
export const ANY_MILK = ["cow_milk", "goat_milk", "buffalo_milk", "yak_milk"].flatMap(tiers);
/** Any duck egg, any quality. */
export const ANY_DUCK_EGG = tiers("duck_egg");

const BOWL = "minecraft:bowl";

export const DISHES = [
  // --- Stockpot ---------------------------------------------------------------
  {
    id: "cream_stew", zh: "奶油燉菜", en: "Cream Stew", food: [8, 0.75], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[r("cream")], ["minecraft:potato"], ["minecraft:carrot"], ["minecraft:beef", r("beef_brisket"), "minecraft:chicken", r("chicken_leg"), "minecraft:mutton"]],
    look: ["bowl", [240, 232, 210]],
  },
  {
    id: "bone_broth", zh: "大骨高湯", en: "Bone Broth", food: [6, 0.6], station: "stockpot", carrier: BOWL, time: 600,
    slots: [[r("large_bone"), r("chicken_frame")], [r("large_bone"), r("chicken_frame")], ["minecraft:carrot", "minecraft:potato"]],
    look: ["bowl", [226, 206, 160]],
  },
  {
    id: "old_duck_soup", zh: "老鴨湯", en: "Old Duck Soup", food: [10, 0.8], station: "stockpot", carrier: BOWL, time: 600,
    slots: [[r("duck_meat"), r("duck_leg")], [r("duck_meat"), r("duck_leg")], ["minecraft:bamboo"]],
    look: ["bowl", [214, 186, 120]],
  },
  {
    id: "braised_brisket", zh: "燉牛腩", en: "Braised Beef Brisket", food: [12, 0.8], station: "stockpot", carrier: BOWL, time: 600,
    slots: [[r("beef_brisket")], [r("beef_brisket")], ["minecraft:potato"], ["minecraft:carrot"]],
    look: ["bowl", [150, 80, 50]],
  },
  {
    id: "yak_stew", zh: "氂牛肉燉菜", en: "Yak Meat Stew", food: [11, 0.8], station: "stockpot", carrier: BOWL, time: 600,
    slots: [[r("yak_meat")], [r("yak_meat")], ["minecraft:potato"], ["minecraft:beetroot", "minecraft:carrot"]],
    look: ["bowl", [130, 70, 50]],
  },
  {
    id: "goose_stew", zh: "鐵鍋燉大鵝", en: "Iron Pot Goose Stew", food: [12, 0.8], station: "stockpot", carrier: BOWL, time: 600,
    slots: [[r("goose_meat"), r("goose_leg")], [r("goose_meat"), r("goose_leg")], ["minecraft:potato"], [KC("red_chili"), KC("green_chili")]],
    look: ["bowl", [170, 110, 60]],
  },
  {
    id: "trotter_soup", zh: "豬蹄湯", en: "Pork Trotter Soup", food: [9, 0.7], station: "stockpot", carrier: BOWL, time: 600,
    slots: [[r("pork_trotter")], [r("pork_trotter")], [r("large_bone")]],
    look: ["bowl", [236, 224, 200]],
  },
  {
    id: "century_egg_congee", zh: "皮蛋瘦肉粥", en: "Century Egg and Pork Congee", food: [9, 0.7], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[KC("rice")], [r("century_egg")], ["minecraft:porkchop", r("pork_belly")]],
    look: ["bowl", [236, 232, 220]],
  },
  {
    id: "milk_tea", zh: "奶茶", en: "Milk Tea", food: [4, 0.5], station: "stockpot", carrier: "minecraft:glass_bottle", time: 300,
    slots: [[KC("dried_tea_leaves")], ANY_MILK, ["minecraft:sugar"]],
    look: ["bottle", [200, 160, 110]],
  },

  // --- Wok ---------------------------------------------------------------------
  {
    id: "salted_egg_yolk_greens", zh: "鹹蛋黃炒菜", en: "Salted Egg Yolk Greens", food: [6, 0.6], station: "wok", carrier: BOWL, time: 200,
    slots: [[r("salted_duck_egg")], [KC("lettuce")]],
    look: ["bowl", [120, 170, 70]],
  },
  {
    id: "braised_pork_belly", zh: "紅燒五花肉", en: "Braised Pork Belly", food: [10, 0.8], station: "wok", carrier: BOWL, time: 300,
    slots: [[r("pork_belly")], [r("pork_belly")], ["minecraft:sugar"]],
    look: ["bowl", [150, 60, 40]],
  },
  {
    id: "tomato_duck_egg", zh: "番茄炒鴨蛋", en: "Tomato and Duck Egg Stir-fry", food: [6, 0.6], station: "wok", carrier: BOWL, time: 200,
    slots: [ANY_DUCK_EGG, [KC("tomato")]],
    look: ["bowl", [230, 110, 70]],
  },
  {
    id: "butter_steak", zh: "奶油煎牛排", en: "Butter-seared Steak", food: [10, 0.85], station: "wok", carrier: "", time: 200,
    slots: [[r("beef_sirloin")], [r("butter")]],
    look: ["plate", [120, 64, 40]],
  },
  {
    id: "cumin_lamb_chops", zh: "孜然羊排", en: "Spiced Lamb Chops", food: [10, 0.8], station: "wok", carrier: "", time: 200,
    slots: [[r("lamb_chop")], [r("lamb_chop")], [KC("red_chili")]],
    look: ["plate", [160, 80, 40]],
  },
  {
    id: "spicy_chicken_legs", zh: "辣子雞腿", en: "Spicy Chicken Legs", food: [9, 0.75], station: "wok", carrier: BOWL, time: 200,
    slots: [[r("chicken_leg")], [r("chicken_leg")], [KC("red_chili")], [KC("green_chili")]],
    look: ["bowl", [200, 60, 40]],
  },
  {
    id: "ghee_rice", zh: "酥油飯", en: "Ghee Rice", food: [8, 0.7], station: "wok", carrier: BOWL, time: 200,
    slots: [[KC("cooked_rice")], [r("ghee")]],
    look: ["bowl", [244, 222, 140]],
  },

  // --- Steamer, furnace, crafting ---------------------------------------------------
  {
    id: "steamed_egg", zh: "蒸蛋", en: "Steamed Egg Custard", food: [6, 0.6], station: "steamer", carrier: BOWL, time: 300,
    input: r("egg_custard"),
    look: ["bowl", [250, 220, 110]],
  },
  {
    id: "cheese_gratin", zh: "乳酪焗烤", en: "Cheese Gratin", food: [10, 0.8], station: "furnace", carrier: BOWL,
    input: r("raw_cheese_gratin"),
    look: ["bowl", [240, 180, 70]],
  },
  {
    id: "cheese_toast", zh: "乳酪吐司", en: "Cheese Toast", food: [7, 0.7], station: "crafting", carrier: "",
    slots: [["minecraft:bread"], [r("cheese_slice")]],
    look: ["plate", [236, 196, 100]],
  },
  {
    id: "berry_yogurt", zh: "莓果優格", en: "Berry Yogurt", food: [5, 0.6], station: "crafting", carrier: BOWL,
    slots: [[r("yogurt")], ["minecraft:sweet_berries"], [BOWL]],
    look: ["bowl", [230, 150, 180]],
  },

  // --- 1.1 肉類線 ----------------------------------------------------------------
  {
    id: "claypot_rice", zh: "臘味煲仔飯", en: "Cured Meat Claypot Rice", food: [12, 0.85], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[KC("rice")], [r("cured_sausage")], [r("cured_pork_belly")]],
    look: ["bowl", [180, 80, 60]],
  },
  {
    id: "cured_pork_peppers", zh: "臘肉炒青椒", en: "Cured Pork with Peppers", food: [9, 0.75], station: "wok", carrier: BOWL, time: 200,
    slots: [[r("cured_pork_belly")], [KC("green_chili")]],
    look: ["bowl", [150, 120, 60]],
  },
  {
    id: "pan_fried_sausage", zh: "香煎香腸", en: "Pan-fried Sausages", food: [8, 0.7], station: "wok", carrier: "", time: 200,
    slots: [[r("raw_sausage")], [r("raw_sausage")]],
    look: ["plate", [170, 70, 50]],
  },
  {
    id: "cured_duck_leg_rice", zh: "臘鴨腿飯", en: "Cured Duck Leg Rice", food: [11, 0.8], station: "wok", carrier: BOWL, time: 200,
    slots: [[KC("cooked_rice")], [r("cured_duck_leg")]],
    look: ["bowl", [160, 90, 50]],
  },
  {
    id: "lion_head_meatballs", zh: "紅燒獅子頭", en: "Braised Lion's Head Meatballs", food: [11, 0.8], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[r("pork_mince")], [r("pork_mince")], ["minecraft:egg", r("egg_fine"), r("egg_superb")]],
    look: ["bowl", [150, 80, 50]],
  },
  {
    id: "hamburg_steak", zh: "漢堡排", en: "Hamburg Steak", food: [10, 0.8], station: "wok", carrier: "", time: 200,
    slots: [[r("beef_mince")], [r("beef_mince")], ["minecraft:bread"]],
    look: ["plate", [120, 70, 45]],
  },
  {
    id: "lamb_meatball_soup", zh: "羊肉丸湯", en: "Lamb Meatball Soup", food: [9, 0.7], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[r("mutton_mince")], [r("mutton_mince")], ["minecraft:carrot"]],
    look: ["bowl", [220, 200, 160]],
  },

  // --- 1.1 內臟線 ----------------------------------------------------------------
  {
    id: "pork_liver_soup", zh: "豬肝湯", en: "Pork Liver Soup", food: [7, 0.7], station: "stockpot", carrier: BOWL, time: 300,
    slots: [[r("pork_liver")], [KC("lettuce")]],
    look: ["bowl", [170, 110, 80]],
  },
  {
    id: "sesame_oil_pork_liver", zh: "麻油豬肝", en: "Sesame Oil Pork Liver", food: [8, 0.75], station: "wok", carrier: BOWL, time: 200,
    slots: [[r("pork_liver")], [r("pork_liver")]],
    look: ["bowl", [120, 60, 40]],
  },
  {
    id: "braised_intestine", zh: "滷大腸", en: "Braised Pork Intestine", food: [8, 0.7], station: "stockpot", carrier: BOWL, time: 600,
    slots: [[r("cleaned_intestine")], [r("cleaned_intestine")], ["minecraft:sugar"]],
    look: ["bowl", [150, 90, 50]],
  },
  {
    id: "duck_blood_noodle_soup", zh: "鴨血粉絲湯", en: "Duck Blood Vermicelli Soup", food: [9, 0.7], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[r("duck_blood")], [KC("raw_noodles")], [r("large_bone"), r("chicken_frame")]],
    look: ["bowl", [200, 170, 130]],
  },
  {
    id: "spicy_tripe", zh: "麻辣牛肚", en: "Spicy Beef Tripe", food: [8, 0.7], station: "wok", carrier: BOWL, time: 200,
    slots: [[r("cleaned_tripe")], [KC("red_chili")], [KC("green_chili")]],
    look: ["bowl", [200, 70, 40]],
  },
  {
    id: "braised_gizzard", zh: "滷雞胗", en: "Braised Chicken Gizzards", food: [7, 0.7], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[r("chicken_gizzard")], [r("chicken_gizzard")], ["minecraft:sugar"]],
    look: ["bowl", [130, 80, 50]],
  },
  {
    id: "pate_toast", zh: "鵝肝醬吐司", en: "Pâté Toast", food: [8, 0.8], station: "crafting", carrier: "",
    slots: [["minecraft:bread"], [r("foie_gras_pate")]],
    look: ["plate", [214, 170, 120]],
  },

  // --- 1.1 蛋奶線 ----------------------------------------------------------------
  // Condensed milk and milk skin are simmered in Cookery's stockpot; they are
  // ingredients first, but can be eaten as they are.
  {
    id: "condensed_milk", zh: "煉乳", en: "Condensed Milk", food: [4, 0.5], station: "stockpot", carrier: "minecraft:glass_bottle", time: 600,
    slots: [ANY_MILK, ANY_MILK, ["minecraft:sugar"]],
    look: ["bottle", [244, 226, 180]],
  },
  {
    id: "milk_skin", zh: "奶皮", en: "Milk Skin", food: [3, 0.5], station: "stockpot", carrier: "", time: 600,
    slots: [ANY_MILK, ANY_MILK],
    look: ["plate", [246, 236, 200]],
  },
  {
    id: "condensed_milk_toast", zh: "煉乳吐司", en: "Condensed Milk Toast", food: [7, 0.7], station: "crafting", carrier: "",
    slots: [["minecraft:bread"], [r("condensed_milk")]],
    look: ["plate", [236, 206, 150]],
  },
  {
    id: "milk_skin_tea", zh: "奶皮子奶茶", en: "Milk Skin Tea", food: [5, 0.6], station: "stockpot", carrier: "minecraft:glass_bottle", time: 300,
    slots: [[KC("dried_tea_leaves")], [r("milk_skin")], ANY_MILK],
    look: ["bottle", [210, 176, 130]],
  },
  {
    id: "double_skin_milk", zh: "雙皮奶", en: "Double-skin Milk Pudding", food: [6, 0.6], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[r("milk_skin")], ANY_MILK, ["minecraft:sugar"]],
    look: ["bowl", [250, 246, 230]],
  },
  {
    id: "egg_pudding", zh: "雞蛋布丁", en: "Egg Pudding", food: [6, 0.6], station: "steamer", carrier: BOWL, time: 300,
    input: r("custard"),
    look: ["bowl", [246, 214, 120]],
  },
  {
    id: "egg_tart", zh: "蛋塔", en: "Egg Tart", food: [6, 0.7], station: "furnace", carrier: "",
    input: r("raw_egg_tart"),
    look: ["plate", [240, 190, 80]],
  },
  {
    id: "truffle_eggs", zh: "松露炒蛋", en: "Truffle Scrambled Eggs", food: [9, 0.85], station: "wok", carrier: "", time: 200,
    slots: [[r("truffle")], ["minecraft:egg", r("egg_fine"), r("egg_superb")]],
    look: ["plate", [240, 210, 110]],
  },

  // --- 1.1 起司線 ----------------------------------------------------------------
  {
    id: "cheese_fondue", zh: "起司火鍋", en: "Cheese Fondue", food: [11, 0.85], station: "stockpot", carrier: BOWL, time: 400,
    slots: [[r("vintage_cheese_slice")], [r("vintage_cheese_slice")], ["minecraft:bread"]],
    look: ["bowl", [244, 206, 100]],
  },
  {
    id: "margherita_pizza", zh: "瑪格麗特披薩", en: "Margherita Pizza", food: [12, 0.85], station: "furnace", carrier: "",
    input: r("raw_pizza"),
    look: ["plate", [220, 110, 70]],
  },
  {
    id: "ricotta_pancakes", zh: "瑞可塔鬆餅", en: "Ricotta Pancakes", food: [8, 0.75], station: "wok", carrier: "", time: 200,
    slots: [[r("ricotta")], [KC("flour")], ["minecraft:egg", r("egg_fine"), r("egg_superb")]],
    look: ["plate", [232, 196, 130]],
  },
  {
    id: "smoked_cheese_sandwich", zh: "煙燻起司三明治", en: "Smoked Cheese Sandwich", food: [8, 0.75], station: "crafting", carrier: "",
    slots: [["minecraft:bread"], [r("smoked_cheese_slice")]],
    look: ["plate", [200, 150, 80]],
  },
  {
    id: "goat_cheese_salad", zh: "山羊乳酪沙拉", en: "Goat Cheese Salad", food: [7, 0.7], station: "crafting", carrier: BOWL,
    slots: [[r("aged_goat_cheese")], [KC("lettuce")], [KC("tomato")], [BOWL]],
    look: ["bowl", [150, 190, 90]],
  },
  {
    id: "truffle_gratin", zh: "松露乳酪焗烤", en: "Truffle Cheese Gratin", food: [12, 0.85], station: "furnace", carrier: BOWL,
    input: r("raw_truffle_gratin"),
    look: ["bowl", [210, 170, 80]],
  },
  {
    id: "chhurpi_butter_tea", zh: "曲拉酥油茶", en: "Chhurpi Butter Tea", food: [6, 0.7], station: "stockpot", carrier: "minecraft:glass_bottle", time: 300,
    slots: [[r("chhurpi_block")], [r("ghee")], [KC("dried_tea_leaves")]],
    look: ["bottle", [214, 180, 120]],
  },
];

/**
 * Uncooked steps some dishes need first (crafting recipes), each made with any
 * quality of milk or egg. `with` lists one slot per ingredient; a slot that is
 * a tag string accepts every item carrying that tag.
 */
export const DISH_PREPS = [
  {
    id: "egg_custard", zh: "生蛋液", en: "Egg Custard Mix",
    makes: [
      ["minecraft:egg", { tag: `${NS}:milk` }, BOWL],
      [{ tag: `${NS}:egg` }, { tag: `${NS}:milk` }, BOWL],
    ],
  },
  {
    id: "raw_cheese_gratin", zh: "焗烤生料", en: "Unbaked Cheese Gratin",
    makes: [["minecraft:potato", r("cheese_slice"), r("cream"), BOWL]],
  },
  // 1.1
  {
    id: "raw_egg_tart", zh: "蛋塔生料", en: "Unbaked Egg Tart",
    makes: [[r("custard"), KC("raw_dough")]],
  },
  {
    id: "raw_pizza", zh: "披薩生料", en: "Unbaked Pizza",
    makes: [[KC("raw_dough"), KC("tomato"), r("mozzarella")]],
  },
  {
    id: "raw_truffle_gratin", zh: "松露焗烤生料", en: "Unbaked Truffle Gratin",
    makes: [[r("truffle"), r("cheese_slice"), "minecraft:potato", BOWL]],
  },
];

/** Dairy and egg products shown in the guidebook's dairy chapter. */
export const DAIRY_PRODUCTS = [
  "butter", "cream", "ghee", "yogurt", "fresh_cheese", "aged_cheese_wheel", "cheese_slice", "whey", "salted_duck_egg", "century_egg",
  // 1.1 蛋奶線與起司線
  "skim_milk", "vanilla_ice_cream", "berry_ice_cream", "chocolate_ice_cream", "custard", "truffle",
  "goat_cheese", "aged_goat_cheese", "mozzarella", "chhurpi", "chhurpi_block", "vintage_cheese_wheel", "vintage_cheese_slice",
  "smoked_cheese_wheel", "smoked_cheese_slice", "ricotta", "milk_tofu",
];

/** 1.1 meat and offal products shown in the guidebook's butchery chapter. */
export const MEAT_PRODUCTS = [
  "pork_mince", "beef_mince", "mutton_mince", "raw_sausage", "cured_sausage", "cured_pork_belly", "cured_duck_leg", "beef_jerky",
  "pork_liver", "pig_intestine", "chicken_gizzard", "duck_blood", "goose_liver", "beef_tripe", "cleaned_intestine", "cleaned_tripe",
  "sausage_casing", "foie_gras_pate",
];
