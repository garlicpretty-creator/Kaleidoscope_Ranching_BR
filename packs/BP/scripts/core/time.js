// Game time. Every timer in Ranching is stored as an absolute tick and compared
// lazily, so nothing has to run while players are away.

import { world } from "@minecraft/server";

export const TICKS_PER_DAY = 24000;

/** Ticks since the world was created. Keeps counting across restarts. */
export function nowTick() {
  return world.getAbsoluteTime();
}

/** Whole game days since the world was created. */
export function today() {
  return Math.floor(nowTick() / TICKS_PER_DAY);
}
