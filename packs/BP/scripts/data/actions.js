// 1.1 動物動作: the everyday animations an animal plays (eating at a trough or
// hay rack, drinking, being petted or brushed). The behaviour pack only sets a
// synced entity property; the resource pack plays the animation for it
// (tools/gen_actions.mjs). Read by core/actions.js and the generators.
//
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

export const ACTION_PROPERTY = "kaleidoscope_ranching:action";

/** Values of the property; "none" is the resting state. */
export const ACTIONS = ["none", "eat", "drink", "petted", "graze", "display", "dust_bath", "spit"];

/** How long each action plays, in seconds. The client stops it after this too. */
export const ACTION_SECONDS = { eat: 10, drink: 6, petted: 2.5, graze: 8, display: 5, dust_bath: 6, spit: 1 };

// --- 1.1 追加 新動物的招牌動作 (企劃書 四、沉浸式動畫) ----------------------------
// systems/specialActions.js plays them; tools/gen_actions.mjs draws them.

/** The special action each new animal plays (short animal id → action). */
export const SPECIAL_ACTIONS = { turkey: "display", quail: "dust_bath", alpaca: "spit" };

/** 開屏: an adult tom fans out now and then (DISPLAY_CHANCE per clock pass) while a player is this close. */
export const DISPLAY_RANGE = 8;
export const DISPLAY_CHANCE = 0.25;

/** 沙浴: in the daytime a quail standing on one of these blocks dust-bathes now and then (per clock pass). */
export const DUST_BATH_CHANCE = 0.2;
/** The quails looked at: those within this many blocks of a player. */
export const DUST_BATH_RANGE = 32;
/** Bath block → the dust it throws up (vanilla particles). */
export const DUST_BATH_BLOCKS = {
  "minecraft:sand": "minecraft:falling_dust_sand_particle",
  "minecraft:red_sand": "minecraft:falling_dust_red_sand_particle",
  "minecraft:dirt": "minecraft:falling_dust_red_sand_particle",
  "minecraft:coarse_dirt": "minecraft:falling_dust_red_sand_particle",
  "minecraft:dirt_with_roots": "minecraft:falling_dust_red_sand_particle",
};
/** Seconds into the bath at which a puff of dust rises (the rolls of the animation). */
export const DUST_PUFFS = [0.6, 2.1, 3.6, 5.1];

/** 吐口水: an alpaca hit by a player spits at them (particles only), at most once per this many ticks. */
export const SPIT_COOLDOWN_TICKS = 40;
/** The spit flies this many steps (one per tick) from the alpaca's mouth to the player's face. */
export const SPIT_STEPS = 5;
export const SPIT_PARTICLE = "minecraft:llama_spit_smoke";
export const SPIT_SOUND = "mob.llama.spit";

/** Particles are spawned only while a player is this close to see them. */
export const PARTICLE_RANGE = 16;

/** How close (blocks, level distance) an animal must stand to a trough to be seen eating or drinking. */
export const ACTION_REACH = 2.5;

/** Chance per clock pass that an animal standing at a trough plays the animation, so a herd does not move as one. */
export const ACTION_CHANCE = 0.6;
