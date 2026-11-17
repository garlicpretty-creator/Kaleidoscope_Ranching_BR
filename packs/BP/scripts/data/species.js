// Species table for the care core. Adding an animal = adding a row.
// `eats`: trough kinds the animal accepts. `treat`: its favourite snack.
// `brushDrops`: occasional drop when brushed [itemId, chance].

import { KIND } from "./feeds.js";
import { TEST_WITH_VANILLA } from "./care_config.js";

const RUMINANT = [KIND.GRASS, KIND.MIXED, KIND.CONCENTRATE, KIND.SILAGE];
const POULTRY = [KIND.GRAIN, KIND.MIXED, KIND.CONCENTRATE, KIND.CALCIUM];

export const SPECIES = {
  "kaleidoscope_ranching:cow": {
    key: "cow",
    eats: RUMINANT,
    treat: "kaleidoscope_ranching:alfalfa_cake",
    brushDrops: [["minecraft:leather", 0.02]],
  },
  "kaleidoscope_ranching:sheep": {
    key: "sheep",
    eats: RUMINANT,
    treat: "kaleidoscope_ranching:alfalfa_cake",
    brushDrops: [["minecraft:string", 0.15]],
  },
  "kaleidoscope_ranching:goat": {
    key: "goat",
    eats: RUMINANT,
    treat: "kaleidoscope_ranching:alfalfa_cake",
    // 1.1 絨毛線: brushing a goat combs out cashmere.
    brushDrops: [["minecraft:string", 0.08], ["kaleidoscope_ranching:goat_cashmere", 0.3]],
  },
  "kaleidoscope_ranching:pig": {
    key: "pig",
    eats: [KIND.VEG, KIND.MIXED, KIND.CONCENTRATE],
    treat: "kaleidoscope_ranching:beet_sugar_cube",
    brushDrops: [["kaleidoscope_ranching:pig_bristle", 0.35]],
  },
  "kaleidoscope_ranching:chicken": {
    key: "chicken",
    eats: POULTRY,
    treat: "kaleidoscope_ranching:grain_cake",
    brushDrops: [["minecraft:feather", 0.2]],
  },
  "kaleidoscope_ranching:rabbit": {
    key: "rabbit",
    eats: [KIND.GRASS, KIND.VEG, KIND.MIXED, KIND.CONCENTRATE],
    treat: "kaleidoscope_ranching:carrot_chips",
    // 1.1 絨毛線: rabbit fur for the spinning wheel.
    brushDrops: [["minecraft:rabbit_hide", 0.03], ["kaleidoscope_ranching:rabbit_fur", 0.3]],
  },
  // M4 animals — rows ready so they work the day M4 lands.
  "kaleidoscope_ranching:duck": {
    key: "duck",
    eats: POULTRY,
    treat: "kaleidoscope_ranching:grain_cake",
    brushDrops: [["minecraft:feather", 0.2]],
  },
  // 1.1 追加 新動物 (docs/1.1_追加企劃書.md 二)
  "kaleidoscope_ranching:quail": {
    key: "quail",
    eats: POULTRY,
    treat: "kaleidoscope_ranching:grain_cake",
    brushDrops: [],
  },
  "kaleidoscope_ranching:turkey": {
    key: "turkey",
    eats: [KIND.GRASS, ...POULTRY],
    treat: "kaleidoscope_ranching:grain_cake",
    brushDrops: [["minecraft:feather", 0.1]],
  },
  "kaleidoscope_ranching:alpaca": {
    key: "alpaca",
    eats: RUMINANT,
    treat: "kaleidoscope_ranching:alfalfa_cake",
    brushDrops: [["kaleidoscope_ranching:alpaca_wool", 0.3]],
  },
  "kaleidoscope_ranching:goose": {
    key: "goose",
    eats: POULTRY,
    treat: "kaleidoscope_ranching:grain_cake",
    brushDrops: [["minecraft:feather", 0.2]],
  },
  "kaleidoscope_ranching:buffalo": {
    key: "buffalo",
    eats: RUMINANT,
    treat: "kaleidoscope_ranching:alfalfa_cake",
    brushDrops: [["minecraft:leather", 0.02]],
  },
  "kaleidoscope_ranching:yak": {
    key: "yak",
    eats: RUMINANT,
    treat: "kaleidoscope_ranching:alfalfa_cake",
    brushDrops: [["minecraft:string", 0.1]],
  },
};

// Test mode: vanilla animals borrow the matching Ranching row.
if (TEST_WITH_VANILLA) {
  for (const k of ["cow", "sheep", "goat", "pig", "chicken", "rabbit"]) {
    SPECIES[`minecraft:${k}`] = SPECIES[`kaleidoscope_ranching:${k}`];
  }
}

export function speciesOf(entity) {
  return SPECIES[entity.typeId];
}

/** External animals (M5 register_animal will call this). */
const BUILTIN_SPECIES = new Set(Object.keys(SPECIES));

/** External animals (the public API's register_animal). Built-in rows cannot be replaced; re-registering an external one updates it. */
export function registerSpecies(typeId, row) {
  if (BUILTIN_SPECIES.has(typeId)) return false;
  SPECIES[typeId] = row;
  return true;
}

/** Whether an item is some animal's favourite treat. */
export function isTreat(itemId) {
  return Object.values(SPECIES).some((row) => row.treat === itemId);
}
