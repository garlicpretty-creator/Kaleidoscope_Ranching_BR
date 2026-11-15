// Feed table. Each feed item gives `units` of a trough "kind".
// Trough state `kaleidoscope_ranching:kind`: 0 empty, then the ids below.
// Tier (乾草 1 / 混合 2 / 精飼料 3) is used by M3 for milk & egg quality.

export const KIND = {
  EMPTY: 0,
  GRASS: 1, // 乾草·飼草 (ruminants, rabbits)
  GRAIN: 2, // 穀粒 (poultry)
  VEG: 3, // 蔬菜·廚餘 (pigs, rabbits)
  MIXED: 4, // 混合飼料 (everyone)
  CONCENTRATE: 5, // 精飼料 (everyone)
};

export const KIND_TIER = {
  [KIND.GRASS]: 1,
  [KIND.GRAIN]: 1,
  [KIND.VEG]: 1,
  [KIND.MIXED]: 2,
  [KIND.CONCENTRATE]: 3,
};

/** itemId → { kind, units } */
export const FEEDS = {
  "kaleidoscope_ranching:forage": { kind: KIND.GRASS, units: 1 },
  "kaleidoscope_ranching:alfalfa": { kind: KIND.GRASS, units: 1 },
  "minecraft:wheat": { kind: KIND.GRASS, units: 1 },
  "minecraft:hay_block": { kind: KIND.GRASS, units: 9 },

  "minecraft:wheat_seeds": { kind: KIND.GRAIN, units: 1 },
  "minecraft:beetroot_seeds": { kind: KIND.GRAIN, units: 1 },
  "minecraft:pumpkin_seeds": { kind: KIND.GRAIN, units: 1 },
  "minecraft:melon_seeds": { kind: KIND.GRAIN, units: 1 },
  "minecraft:torchflower_seeds": { kind: KIND.GRAIN, units: 1 },

  "minecraft:carrot": { kind: KIND.VEG, units: 1 },
  "minecraft:potato": { kind: KIND.VEG, units: 1 },
  "minecraft:beetroot": { kind: KIND.VEG, units: 1 },
  "minecraft:apple": { kind: KIND.VEG, units: 1 },

  "kaleidoscope_ranching:mixed_feed": { kind: KIND.MIXED, units: 1 },
  "kaleidoscope_ranching:concentrate_feed": { kind: KIND.CONCENTRATE, units: 1 },
};

/** External feeds registered at runtime (M5 API will call this). */
const BUILTIN_FEEDS = new Set(Object.keys(FEEDS));

/** External feeds (the public API's register_feed). Built-ins win (企劃書 API 規則); re-registering an external feed updates it. */
export function registerFeed(itemId, kind, units = 1) {
  if (BUILTIN_FEEDS.has(itemId)) return false;
  FEEDS[itemId] = { kind, units };
  return true;
}
