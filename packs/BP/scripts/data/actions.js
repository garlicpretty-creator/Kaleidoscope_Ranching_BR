// 1.1 動物動作: the everyday animations an animal plays (eating at a trough or
// hay rack, drinking, being petted or brushed). The behaviour pack only sets a
// synced entity property; the resource pack plays the animation for it
// (tools/gen_actions.mjs). Read by core/actions.js and the generators.
//
// Plain data: no @minecraft imports (scripts/ARCHITECTURE.md).

export const ACTION_PROPERTY = "kaleidoscope_ranching:action";

/** Values of the property; "none" is the resting state. */
export const ACTIONS = ["none", "eat", "drink", "petted", "graze"];

/** How long each action plays, in seconds. The client stops it after this too. */
export const ACTION_SECONDS = { eat: 10, drink: 6, petted: 2.5, graze: 8 };

/** How close (blocks, level distance) an animal must stand to a trough to be seen eating or drinking. */
export const ACTION_REACH = 2.5;

/** Chance per clock pass that an animal standing at a trough plays the animation, so a herd does not move as one. */
export const ACTION_CHANCE = 0.6;
