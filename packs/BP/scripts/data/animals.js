// Animal definition table for 1.0.0.
//
// Field notes
// - replaces:      vanilla entity converted into this animal on spawn/load, or null for new animals.
// - reproduction:  "gestation" (female carries, then gives birth) or "egg" (female lays, fertilized eggs hatch).
// - days:          gestation length or incubation length, in game days.
// - dailyProduct:  what a female yields each day when her needs are met. `tiered` products come in three qualities.
// - groomProduct:  occasional drop when brushed.
// - feedGroup:     which rows of feeds.js this animal eats.
// - largeCarcass:  large carcasses do not stack and remember the animal's sex (males yield more).
// - biomes:        natural spawn biome tags for animals that have no vanilla counterpart.
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
    replaces: "minecraft:cow",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "cow_milk", tiered: true, via: "milking_pail" },
    groomProduct: null,
    feedGroup: "grazer",
    treat: "cow_treat",
    carcass: "cow_carcass",
    largeCarcass: true,
    maleTrait: "horns, larger body",
    biomes: null,
  },
  {
    id: "sheep",
    replaces: "minecraft:sheep",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: null,
    groomProduct: null,
    feedGroup: "grazer",
    treat: "sheep_treat",
    carcass: "sheep_carcass",
    largeCarcass: true,
    maleTrait: "curled horns",
    biomes: null,
  },
  {
    id: "goat",
    replaces: "minecraft:goat",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "goat_milk", tiered: true, via: "milking_pail" },
    groomProduct: null,
    feedGroup: "grazer",
    treat: "goat_treat",
    carcass: "goat_carcass",
    largeCarcass: true,
    maleTrait: "longer horns, beard",
    biomes: null,
  },
  {
    id: "pig",
    replaces: "minecraft:pig",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: null,
    groomProduct: "pig_bristle",
    feedGroup: "omnivore",
    treat: "pig_treat",
    carcass: "pig_carcass",
    largeCarcass: true,
    maleTrait: "tusks, larger body",
    biomes: null,
  },
  {
    id: "chicken",
    replaces: "minecraft:chicken",
    reproduction: "egg",
    days: INCUBATION_DAYS,
    // ## The plain tier is the vanilla egg; see items.js.
    dailyProduct: { item: "minecraft:egg", tiered: true, tierItems: ["minecraft:egg", "egg_fine", "egg_superb"], via: "nest_box" },
    fertilizedEgg: "fertilized_chicken_egg",
    groomProduct: "minecraft:feather",
    feedGroup: "poultry",
    treat: "chicken_treat",
    carcass: "chicken_carcass",
    largeCarcass: false,
    maleTrait: "large comb, long tail feathers",
    biomes: null,
  },
  {
    id: "rabbit",
    replaces: "minecraft:rabbit",
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: null,
    groomProduct: null,
    feedGroup: "grazer",
    treat: "rabbit_treat",
    carcass: "rabbit_carcass",
    largeCarcass: false,
    maleTrait: "broader head",
    biomes: null,
  },
  {
    id: "duck",
    replaces: null,
    reproduction: "egg",
    days: INCUBATION_DAYS,
    dailyProduct: { item: "duck_egg", tiered: true, via: "nest_box" },
    fertilizedEgg: "fertilized_duck_egg",
    groomProduct: "down",
    feedGroup: "poultry",
    treat: "duck_treat",
    carcass: "duck_carcass",
    largeCarcass: false,
    maleTrait: "green head",
    biomes: ["river", "swamp"],
  },
  {
    id: "goose",
    replaces: null,
    reproduction: "egg",
    days: INCUBATION_DAYS,
    dailyProduct: { item: "goose_egg", tiered: true, via: "nest_box" },
    fertilizedEgg: "fertilized_goose_egg",
    groomProduct: "down",
    feedGroup: "poultry",
    treat: "goose_treat",
    carcass: "goose_carcass",
    largeCarcass: false,
    maleTrait: "larger forehead knob; drives hostile mobs away from the pen",
    biomes: ["plains", "river"],
  },
  {
    id: "buffalo",
    replaces: null,
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "buffalo_milk", tiered: true, via: "milking_pail" },
    groomProduct: null,
    feedGroup: "grazer",
    treat: "buffalo_treat",
    carcass: "buffalo_carcass",
    largeCarcass: true,
    maleTrait: "longer horns",
    biomes: ["swamp", "jungle"],
  },
  {
    id: "yak",
    replaces: null,
    reproduction: "gestation",
    days: GESTATION_DAYS,
    dailyProduct: { item: "yak_milk", tiered: true, via: "milking_pail" },
    groomProduct: "yak_hair",
    feedGroup: "grazer",
    treat: "yak_treat",
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

// Product quality from affection and that day's feed tier (see feeds.js).
// The first matching row wins.
export const QUALITY_RULES = [
  { tier: "superb", minAffection: 5, minFeedTier: 3 },
  { tier: "fine", minAffection: 3, minFeedTier: 2 },
  { tier: "plain", minAffection: 0, minFeedTier: 1 },
];

// Chance that a hen with a same-species male in trough range lays a fertilized
// egg, indexed by affection hearts 0..5.
export const FERTILIZED_CHANCE_BY_AFFECTION = [0.1, 0.2, 0.3, 0.45, 0.6, 0.75];
