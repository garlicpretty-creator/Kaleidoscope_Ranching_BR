// Species table for the care core. Adding an animal = adding a row.
// `eats`: trough kinds the animal accepts. `treat`: its favourite snack.
// `brushDrops`: occasional drop when brushed [itemId, chance].

import { KIND } from "./feeds.js";
import { TEST_WITH_VANILLA } from "./care_config.js";

const RUMINANT = [KIND.GRASS, KIND.MIXED, KIND.CONCENTRATE];
const POULTRY = [KIND.GRAIN, KIND.MIXED, KIND.CONCENTRATE];

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
    brushDrops: [["minecraft:string", 0.08]],
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
    brushDrops: [["minecraft:rabbit_hide", 0.03]],
  },
  // M4 animals — rows ready so they work the day M4 lands.
  "kaleidoscope_ranching:duck": {
    key: "duck",
    eats: POULTRY,
    treat: "kaleidoscope_ranching:grain_cake",
    brushDrops: [["minecraft:feather", 0.2]],
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
