// 1.1 追加 草場與放牧 (docs/1.1_追加企劃書.md 一): a pasture post marks the grass
// around it as a pasture; on the ranch clock, grazing animals in range that have
// not eaten today eat its grass instead of a trough. Read by systems/pasture.js.
//
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

const NS = "kaleidoscope_ranching";

export const PASTURE = {
  /** Blocks around the post that count (same as a trough's reach). */
  RADIUS: 8,
  /** Layers above and below the post that are searched for grass. */
  HALF_HEIGHT: 2,
  /** A pasture nobody grazed for more than this many days is rested. */
  REST_DAYS: 2,
  /** Affection points for an animal fed on a rested pasture (the salt lick gives 5). */
  REST_BONUS: 5,
  /** Every this many blocks of grass eaten, one grass block turns to dirt. */
  GRASS_PER_DIRT: 2,
  /** Chance per clock pass that a fed grazer standing on grass is seen grazing again. */
  GRAZE_ANIM_CHANCE: 0.3,
};

/** Grass blocks a grown animal eats a day; young ones eat half, rounded up. No entry: it does not graze. */
export const GRAZE = {
  [`${NS}:cow`]: 3,
  [`${NS}:buffalo`]: 3,
  [`${NS}:yak`]: 3,
  [`${NS}:sheep`]: 2,
  [`${NS}:goat`]: 2,
  [`${NS}:rabbit`]: 1,
  [`${NS}:goose`]: 1,
};

/** register_animal `graze` (api/ranchingApi.js): another add-on's animal eats `n` grass a day. */
export function setGraze(typeId, n) {
  if (String(typeId).startsWith(`${NS}:`)) return; // built-in animals keep their own amount
  GRAZE[typeId] = n;
}

/** Grass a grazing animal eats today. */
export function grazeOf(typeId, baby = false) {
  const n = GRAZE[typeId];
  if (!n) return 0;
  return baby ? Math.ceil(n / 2) : n;
}

/** Other add-ons' grass-like blocks count when they carry this block tag. */
export const PASTURE_GRASS_TAG = `${NS}:pasture_grass`;

/** World setting (observation notebook): grazing on or off. */
export const CFG_PASTURE = "kr:cfg:pasture";

/** The day an animal last grazed, on the animal (shown in the notebook). */
export const GRAZED_DAY = "kr:grazed_day";
