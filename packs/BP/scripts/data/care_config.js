// Tunable numbers for the care core (M2). Pure data, no logic.

export const CARE = {
  /** Affection is stored as points; 20 points = 1 heart, 0–5 hearts. */
  POINTS_PER_HEART: 20,
  MAX_POINTS: 100,
  START_POINTS: 0,

  /** A day with all four needs met: +1 heart → 5 cared days reach full. */
  FULL_CARE_GAIN: 20,
  /** Salt lick in range that day: extra. */
  SALT_LICK_GAIN: 5,
  /** Treat: once per animal per day. */
  TREAT_GAIN: 10,
  /** Consecutive unfed days before affection drops, and how much. */
  HUNGRY_STREAK_LIMIT: 2,
  HUNGRY_LOSS: 20,
  /** Hurt by anything: loss, at most once per HURT_COOLDOWN_TICKS. */
  HURT_LOSS: 10,
  HURT_COOLDOWN_TICKS: 1200,

  /** Radius (blocks) of trough / water trough / salt lick. */
  RADIUS: 8,
  /** Vertical half-height of the pen volume scanned for manure. */
  PEN_HALF_HEIGHT: 3,
  /** Max animals one block processes per tick (server-cost cap, 企劃書 風險表). */
  MAX_ANIMALS_PER_TICK: 32,

  /** Manure: chance per animal per settled day, and pen limit for "clean". */
  MANURE_CHANCE: 0.5,
  MANURE_DIRTY_THRESHOLD: 6,

  /** Trough capacity in feed units (state 0–15). */
  TROUGH_CAPACITY: 15,
  /** Water trough: one bucket = 3 levels, one level used per day in use. */
  WATER_LEVELS_PER_BUCKET: 3,
  /** Water trough: a water bottle pours in this many levels (up to full). */
  WATER_LEVELS_PER_BOTTLE: 1,
  /** Water trough: cauldron fill levels (0–6; a bottle is 2) one trough level takes from a cauldron beside it. */
  CAULDRON_FILL_PER_LEVEL: 2,
  /** Salt lick: number of days it lasts. */
  SALT_LICK_DAYS: 7,
  /** Compost bin: manure needed and fermentation time (ticks). */
  COMPOST_MANURE: 4,
  COMPOST_TICKS: 24000,
  COMPOST_OUTPUT: 4,
  /** Feed bag capacity in feed units. */
  FEED_BAG_CAPACITY: 64,
  /** Alfalfa seeds from breaking grass. */
  GRASS_SEED_CHANCE: 0.125,
  /** Fertilizer adds this many growth stages. */
  FERTILIZER_STAGES: 2,
};

/**
 * Test switch: before M1 is merged, let vanilla cow/sheep/goat/pig/chicken/rabbit
 * use the care system so M2 can be verified in-game on its own. Keep false in releases.
 */
export const TEST_WITH_VANILLA = false;

/** World dynamic property for the 清潔 need toggle (企劃書: 可在設定中關閉). */
export const CFG_CLEAN_NEED = "kr:cfg:clean_need";
