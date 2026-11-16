// Processing recipes for Ranching's own stations in 1.0.0.
//
// - station: block id from blocks.js.
// - inputs:  each entry is { item, count } or { anyOf: [...items], count }.
// - outputs: each entry is { item, count }.
// - ticks:   processing time in game ticks (24000 = one game day). Stations
//            record the start time and compare on collection; nothing ticks
//            while the player is away.
//
// Identifiers without a namespace belong to `kaleidoscope_ranching:`.

const DAY = 24000;

const ANY_COW_LIKE_MILK = ["cow_milk", "goat_milk", "buffalo_milk"];
const ANY_YAK_MILK = ["yak_milk"];
const ANY_MILK = [...ANY_COW_LIKE_MILK, ...ANY_YAK_MILK];
const ANY_DUCK_EGG = ["duck_egg"];

export const PROCESSING_RECIPES = [
  // Butter churn
  { id: "churn/butter", station: "butter_churn", inputs: [{ anyOf: ANY_COW_LIKE_MILK, count: 2 }], outputs: [{ item: "butter", count: 1 }], ticks: 600 },
  { id: "churn/cream", station: "butter_churn", inputs: [{ anyOf: ANY_COW_LIKE_MILK, count: 1 }], outputs: [{ item: "cream", count: 1 }], ticks: 300 },
  { id: "churn/ghee", station: "butter_churn", inputs: [{ anyOf: ANY_YAK_MILK, count: 2 }], outputs: [{ item: "ghee", count: 1 }], ticks: 600 },

  // Cheese press, then aging rack
  // 1.1 起司線: the press makes a cheese per milk (1.0 made fresh cheese from any milk).
  { id: "press/fresh_cheese", station: "cheese_press", inputs: [{ anyOf: ["cow_milk"], count: 3 }], outputs: [{ item: "fresh_cheese", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/goat_cheese", station: "cheese_press", inputs: [{ anyOf: ["goat_milk"], count: 3 }], outputs: [{ item: "goat_cheese", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/mozzarella", station: "cheese_press", inputs: [{ anyOf: ["buffalo_milk"], count: 3 }], outputs: [{ item: "mozzarella", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/chhurpi", station: "cheese_press", inputs: [{ anyOf: ANY_YAK_MILK, count: 3 }], outputs: [{ item: "chhurpi", count: 1 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  { id: "press/ricotta", station: "cheese_press", inputs: [{ item: "whey", count: 3 }], outputs: [{ item: "ricotta", count: 1 }], ticks: DAY / 4 },
  { id: "press/milk_tofu", station: "cheese_press", inputs: [{ item: "skim_milk", count: 3 }], outputs: [{ item: "milk_tofu", count: 2 }, { item: "whey", count: 1 }], ticks: DAY / 2 },
  // 1.1: left 7 days the wheel comes out vintage; over a lit campfire, smoked (SMOKING).
  { id: "aging/cheese_wheel", station: "aging_rack", inputs: [{ item: "fresh_cheese", count: 4 }], outputs: [{ item: "aged_cheese_wheel", count: 1 }], ticks: DAY * 3, aged: { ticks: DAY * 7, outputs: [{ item: "vintage_cheese_wheel", count: 1 }] } },
  { id: "aging/goat_cheese", station: "aging_rack", inputs: [{ item: "goat_cheese", count: 2 }], outputs: [{ item: "aged_goat_cheese", count: 1 }], ticks: DAY * 3 },
  { id: "aging/chhurpi", station: "aging_rack", inputs: [{ item: "chhurpi", count: 2 }], outputs: [{ item: "chhurpi_block", count: 2 }], ticks: DAY * 2 },

  // Tanning rack (企劃書 1.1, moved into 1.0): hides from the butcher rack become leather.
  // Raw hide and pig skin, plus other add-ons' hides (tag kaleidoscope_ranching:hide, data/tags.js).
  { id: "tan/hide", station: "tanning_rack", inputs: [{ tag: "hide", count: 1 }], outputs: [{ item: "minecraft:leather", count: 1 }], ticks: DAY },
  // Sheepskin keeps its fleece: leather plus a little wool.
  { id: "tan/sheep_skin", station: "tanning_rack", inputs: [{ item: "sheep_skin", count: 1 }], outputs: [{ item: "minecraft:leather", count: 1 }, { item: "minecraft:white_wool", count: 1 }], ticks: DAY },

  // Fermenting jar
  { id: "ferment/yogurt", station: "fermenting_jar", inputs: [{ anyOf: ANY_MILK, count: 1 }], outputs: [{ item: "yogurt", count: 1 }], ticks: DAY },

  // Pickling vat
  { id: "pickle/salted_duck_egg", station: "pickling_vat", inputs: [{ anyOf: ANY_DUCK_EGG, count: 4 }, { item: "minecraft:clay_ball", count: 1 }], outputs: [{ item: "salted_duck_egg", count: 4 }], ticks: DAY * 2 },
  { id: "pickle/century_egg", station: "pickling_vat", inputs: [{ anyOf: ANY_DUCK_EGG, count: 4 }, { item: "minecraft:charcoal", count: 1 }, { item: "minecraft:clay_ball", count: 1 }], outputs: [{ item: "century_egg", count: 4 }], ticks: DAY * 3 },

];

// --- 1.1 肉類線與內臟線 -----------------------------------------------------


// The meat grinder is cranked: every use turns the held meat into one mince at
// once (ticks 0), like one stroke on the butcher rack.
PROCESSING_RECIPES.push(
  { id: "grind/pork", station: "meat_grinder", inputs: [{ anyOf: ["minecraft:porkchop"], count: 1 }], outputs: [{ item: "pork_mince", count: 1 }], ticks: 0 },
  { id: "grind/beef", station: "meat_grinder", inputs: [{ anyOf: ["minecraft:beef", "buffalo_meat", "yak_meat"], count: 1 }], outputs: [{ item: "beef_mince", count: 1 }], ticks: 0 },
  { id: "grind/mutton", station: "meat_grinder", inputs: [{ anyOf: ["minecraft:mutton"], count: 1 }], outputs: [{ item: "mutton_mince", count: 1 }], ticks: 0 },
  // { tag } inputs: Ranching's items plus other add-ons' (data/tags.js 標籤契約).
  { id: "grind/sausage", station: "meat_grinder", inputs: [{ tag: "mince", count: 2 }, { item: "sausage_casing", count: 1 }], outputs: [{ item: "raw_sausage", count: 2 }], ticks: 0 },
  { id: "churn/foie_gras_pate", station: "butter_churn", inputs: [{ item: "goose_liver", count: 1 }, { item: "butter", count: 1 }], outputs: [{ item: "foie_gras_pate", count: 1 }], ticks: 600 },
);

// --- 1.1 蛋奶線 -----------------------------------------------------------------

const ANY_CHICKEN_EGG = ["minecraft:egg"];

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

// --- 1.1 皮革線、絨毛線、布料線、孵化與飼料線 ---------------------------------

const WOOL_COLORS = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];
const ANY_WOOL = WOOL_COLORS.map((color) => `minecraft:${color}_wool`);

PROCESSING_RECIPES.push(
  // Tanning rack: rabbit hide without waiting for four, and oiled leather from tallow.
  { id: "tan/rabbit_hide", station: "tanning_rack", inputs: [{ item: "minecraft:rabbit_hide", count: 4 }], outputs: [{ item: "minecraft:leather", count: 1 }], ticks: DAY },
  { id: "tan/oiled_leather", station: "tanning_rack", inputs: [{ item: "minecraft:leather", count: 1 }, { tag: "tallow", count: 1 }], outputs: [{ item: "oiled_leather", count: 1 }], ticks: DAY },
  // Spinning wheel (automated): fleece into yarn, fine fleece into fine yarn.
  { id: "spin/wool", station: "spinning_wheel", inputs: [{ anyOf: ANY_WOOL, count: 1 }], outputs: [{ item: "yarn", count: 2 }], ticks: DAY / 2 },
  { id: "spin/fleece", station: "spinning_wheel", inputs: [{ tag: "fleece", count: 2 }], outputs: [{ item: "yarn", count: 2 }], ticks: DAY / 2 },
  { id: "spin/fine_fleece", station: "spinning_wheel", inputs: [{ tag: "fine_fleece", count: 2 }], outputs: [{ item: "fine_yarn", count: 2 }], ticks: DAY / 2 },
  // Weaving loom (automated).
  { id: "weave/wool_cloth", station: "weaving_loom", inputs: [{ item: "yarn", count: 2 }], outputs: [{ item: "wool_cloth", count: 1 }], ticks: DAY / 2 },
  { id: "weave/plush_cloth", station: "weaving_loom", inputs: [{ item: "fine_yarn", count: 2 }], outputs: [{ item: "plush_cloth", count: 1 }], ticks: DAY / 2 },
  // Silage barrel (automated): forage sealed for three days.
  { id: "silage/forage", station: "silage_barrel", inputs: [{ item: "forage", count: 4 }], outputs: [{ item: "silage", count: 4 }], ticks: DAY * 3 },
);

/** Hand-worked stations (systems/stations.js): used while holding an ingredient. */
export const STATIONS = ["butter_churn", "cheese_press", "aging_rack", "fermenting_jar", "pickling_vat", "tanning_rack", "meat_grinder", "ice_cream_churn"];
/** Stations that also run on the ranch clock with containers above and below (systems/stations.js). */
export const AUTO_STATIONS = ["cream_separator", "spinning_wheel", "weaving_loom", "silage_barrel"];

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

// ## No text says how far a piece has got: each strip on the rack changes colour by its own age.
// ## A piece is "fresh" (red) when hung, "half" (dark red) once DRYING_HALF of its drying time
// ## has passed, and "dried" (deep brown) when it is done and ready to take.
export const DRYING_HALF = 0.5;
/** The looks, in the order the strips show them from slot 1: driest first. */
export const DRYING_STAGES = ["dried", "half", "fresh"];

// ## What a rack can show is how many strips are at each stage (driest in the first slots):
// ## 35 mixes of up to four strips. A block state may hold at most 16 values and every state
// ## multiplies the rack's permutations, so the mixes are packed into two states, `drying`
// ## (the row, 0..4) and `drying_mix` (the column, 0..6): DRYING_LOOKS[row][col] is
// ## [dried, half, fresh]. Column 0 of row n is n fresh strips, which is what racks saved
// ## when `drying` alone counted the pieces still show until their stages are set.
const MIX_COLUMNS = 7;
export const DRYING_LOOKS = (() => {
  const mixed = [];
  for (let count = 1; count <= DRYING_SLOTS; count++) {
    for (let dried = count; dried >= 0; dried--) {
      for (let half = count - dried; half >= 0; half--) if (dried + half > 0) mixed.push([dried, half, count - dried - half]);
    }
  }
  const rows = Array.from({ length: DRYING_SLOTS + 1 }, (_, n) => [[0, 0, n], ...mixed.splice(0, MIX_COLUMNS - 1)]);
  if (mixed.length) throw new Error("DRYING_LOOKS: the mixes do not fit the rack's states");
  return rows;
})();

/** The rack's [drying, drying_mix] states for so many dried, half-dry and fresh strips. */
export function dryingLook(dried, half, fresh) {
  for (let row = 0; row < DRYING_LOOKS.length; row++) {
    const col = DRYING_LOOKS[row].findIndex(([d, h, f]) => d === dried && h === half && f === fresh);
    if (col >= 0) return [row, col];
  }
  return [0, 0];
}

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
