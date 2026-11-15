// Feed table for 1.0.0.
//
// A trough satisfies an animal's feed need when it holds an item whose `groups`
// include that animal's `feedGroup` (see animals.js). The highest tier present
// is the one used for that day's quality roll.
//
// Identifiers without a namespace belong to `kaleidoscope_ranching:`.

export const FEED_GROUPS = ["grazer", "poultry", "omnivore"];

export const FEED_TIERS = { hay: 1, mixed: 2, premium: 3 };

export const FEEDS = [
  { item: "minecraft:wheat", tier: FEED_TIERS.hay, groups: ["grazer", "omnivore"] },
  { item: "minecraft:hay_block", tier: FEED_TIERS.hay, groups: ["grazer"], servings: 9 },
  { item: "minecraft:wheat_seeds", tier: FEED_TIERS.hay, groups: ["poultry"] },
  { item: "forage", tier: FEED_TIERS.hay, groups: ["grazer", "omnivore"] },
  { item: "swill", tier: FEED_TIERS.mixed, groups: ["omnivore"] },
  { item: "mixed_feed", tier: FEED_TIERS.mixed, groups: ["grazer", "poultry", "omnivore"] },
  { item: "premium_feed", tier: FEED_TIERS.premium, groups: ["grazer", "poultry", "omnivore"] },
];

/** Radius, in blocks, within which a trough feeds or waters animals. */
export const TROUGH_RADIUS = 8;

/** Most animals one trough settles per day, to bound the cost of a settlement. */
export const TROUGH_MAX_ANIMALS = 24;

/** Manure piles within trough range above which the cleanliness need fails. */
export const MANURE_LIMIT = 6;
