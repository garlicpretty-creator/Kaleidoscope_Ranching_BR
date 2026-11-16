// Animal definition table for 1.0.0.
//
// Field notes
// - replaces:      vanilla entity converted into this animal on spawn/load, or null for new animals.
// - reproduction:  "gestation" (female carries, then gives birth) or "egg" (female lays, fertilized eggs hatch).
// - days:          gestation length or incubation length, in game days.
// - dailyProduct:  what a female yields each day (no quality grades).
// - groomProduct:  occasional drop when brushed (M2's species.js decides the actual brush drops).
// - treat:         favourite treat, owned by M2 (data/species.js).
// - largeCarcass:  large carcasses do not stack and remember the animal's sex (males yield more).
// - biomes:        natural spawn biome tags for animals that have no vanilla counterpart.
// - breedItems:    fed to an adult to put it in love (gestation species only; birds breed through fertilized eggs).
// - temptItems:    items the animal follows.
//
// Identifiers without a namespace belong to `kaleidoscope_ranching:`.

export const SEXES = ["female", "male"];

/** Chance that a newborn or newly spawned animal is male. */
export const MALE_RATIO = 0.5;

export const GESTATION_DAYS = 3;
export const INCUBATION_DAYS = 2;

/** Suggested upper bound of females one male can service inside a trough's range. */
export const FEMALES_PER_MALE = 8;

export const ANIMALS = [
  {
    id: "cow",
    breedItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    temptItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    replaces: "minecraft:cow",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "cow_milk", via: "milking_pail" },
    groomProduct: null,
    treat: "alfalfa_cake",
    carcass: "cow_carcass",
    largeCarcass: true,
    maleTrait: "horns, larger body",
    biomes: null,
  },
  {
    id: "sheep",
    breedItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    temptItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    replaces: "minecraft:sheep",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: null,
    groomProduct: null,
    treat: "alfalfa_cake",
    carcass: "sheep_carcass",
    largeCarcass: true,
    maleTrait: "curled horns",
    biomes: null,
  },
  {
    id: "goat",
    breedItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    temptItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    replaces: "minecraft:goat",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "goat_milk", via: "milking_pail" },
    groomProduct: null,
    treat: "alfalfa_cake",
    carcass: "goat_carcass",
    largeCarcass: true,
    maleTrait: "longer horns, beard",
    biomes: null,
  },
  {
    id: "pig",
    breedItems: ["minecraft:carrot", "minecraft:potato", "minecraft:beetroot", "mixed_feed", "concentrate_feed"],
    temptItems: ["minecraft:carrot", "minecraft:potato", "minecraft:beetroot", "mixed_feed", "concentrate_feed"],
    replaces: "minecraft:pig",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: null,
    groomProduct: "pig_bristle",
    treat: "beet_sugar_cube",
    carcass: "pig_carcass",
    largeCarcass: true,
    maleTrait: "tusks, larger body",
    biomes: null,
  },
  {
    id: "chicken",
    breedItems: [],
    temptItems: ["minecraft:wheat_seeds", "minecraft:pumpkin_seeds", "minecraft:melon_seeds", "minecraft:beetroot_seeds", "mixed_feed", "concentrate_feed"],
    replaces: "minecraft:chicken",
    reproduction: "egg",
    days: INCUBATION_DAYS,
    // ## The vanilla egg; see items.js.
    dailyProduct: { item: "minecraft:egg", via: "nest_box" },
    fertilizedEgg: "fertilized_chicken_egg",
    groomProduct: "minecraft:feather",
    treat: "grain_cake",
    carcass: "chicken_carcass",
    largeCarcass: false,
    maleTrait: "large comb, long tail feathers",
    biomes: null,
  },
  {
    id: "rabbit",
    breedItems: ["minecraft:dandelion", "minecraft:carrot", "minecraft:golden_carrot", "forage", "mixed_feed", "concentrate_feed"],
    temptItems: ["minecraft:dandelion", "minecraft:carrot", "minecraft:golden_carrot", "forage", "mixed_feed", "concentrate_feed"],
    replaces: "minecraft:rabbit",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: null,
    groomProduct: null,
    treat: "carrot_chips",
    carcass: "rabbit_carcass",
    largeCarcass: false,
    maleTrait: "broader head",
    biomes: null,
  },
  {
    id: "duck",
    breedItems: [],
    temptItems: ["minecraft:wheat_seeds", "mixed_feed", "concentrate_feed"],
    replaces: null,
    reproduction: "egg",
    days: INCUBATION_DAYS,
    dailyProduct: { item: "duck_egg", via: "nest_box" },
    fertilizedEgg: "fertilized_duck_egg",
    groomProduct: "down",
    treat: "grain_cake",
    carcass: "duck_carcass",
    largeCarcass: false,
    maleTrait: "green head",
    biomes: ["river", "swamp"],
  },
  {
    id: "goose",
    breedItems: [],
    temptItems: ["minecraft:wheat_seeds", "mixed_feed", "concentrate_feed"],
    replaces: null,
    reproduction: "egg",
    days: INCUBATION_DAYS,
    dailyProduct: { item: "goose_egg", via: "nest_box" },
    fertilizedEgg: "fertilized_goose_egg",
    groomProduct: "down",
    treat: "grain_cake",
    carcass: "goose_carcass",
    largeCarcass: false,
    maleTrait: "larger forehead knob; drives hostile mobs away from the pen",
    biomes: ["plains", "river"],
  },
  {
    id: "buffalo",
    breedItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    temptItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    replaces: null,
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "buffalo_milk", via: "milking_pail" },
    groomProduct: null,
    treat: "alfalfa_cake",
    carcass: "buffalo_carcass",
    largeCarcass: true,
    maleTrait: "longer horns",
    biomes: ["swamp", "jungle"],
  },
  {
    id: "yak",
    breedItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    temptItems: ["minecraft:wheat", "forage", "mixed_feed", "concentrate_feed"],
    replaces: null,
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "yak_milk", via: "milking_pail" },
    groomProduct: "yak_hair",
    treat: "alfalfa_cake",
    carcass: "yak_carcass",
    largeCarcass: true,
    maleTrait: "thicker horns, longer coat",
    biomes: ["mountain"],
  },
];

// Daily needs. All four must be met for affection to rise that day.
export const NEEDS = ["feed", "water", "care", "cleanliness"];

export const AFFECTION = {
  min: 0,
  max: 5,
  // Affection gained on a day when every need is met; a fully cared-for animal
  // goes from 0 to 5 hearts in five days.
  gainPerGoodDay: 1,
  lossPerHungryDay: 1,
  lossOnHurt: 1,
  // Share of the parents' average affection a newborn starts with.
  inheritedShare: 0.5,
};

// Chance that a hen with a same-species male in trough range lays a fertilized
// egg, indexed by affection hearts 0..5.
export const FERTILIZED_CHANCE_BY_AFFECTION = [0.1, 0.2, 0.3, 0.45, 0.6, 0.75];

/** Ticks an animal stays in love after being fed (30 seconds). */
export const LOVE_TICKS = 600;

/** Ticks before a parent can breed again (5 minutes). */
export const BREED_COOLDOWN_TICKS = 6000;

/** Radius, in blocks, within which two animals in love find each other. */
export const MATE_RADIUS = 8;

/** Bottle feedings that make a baby grow up immediately. */
export const NURSING_FEEDS_TO_GROW = 3;
