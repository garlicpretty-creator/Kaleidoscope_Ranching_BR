// 公雞清晨啼叫 (proposal, animal table): adult roosters crow once at dawn.
//
// ## Rides the ranch clock (core/clock.js, every 30 s) instead of its own
// ## interval. During the dawn window the first clock run of the day finds the
// ## adult males near each player and has each crow, a few ticks apart so a
// ## flock does not crow in unison. The day it crowed is stored on the world,
// ## so later runs in the same window, or a reload, do not crow again.

import { system, world } from "@minecraft/server";
import { registerClockTask } from "../core/clock.js";
import { dp, rid } from "../core/ids.js";
import { isBaby, sexOf } from "../core/animal.js";
import { TICKS_PER_DAY } from "../core/time.js";

export const CROW_SOUND = "kaleidoscope_ranching.rooster.crow";
const CHICKEN = rid("chicken");
const LAST_DAWN = dp("rooster:last_dawn");

/** Dawn runs from 5:00 (tick 23000) to 7:30 (tick 1500) of the next day. */
const DAWN_START = 23000;
const DAWN_END = 1500;
/** Roosters this far from a player crow; more than this many per player stay quiet. */
const RADIUS = 64;
const MAX_PER_PLAYER = 4;

export function isDawn(timeOfDay) {
  return timeOfDay >= DAWN_START || timeOfDay < DAWN_END;
}

/** The day a dawn belongs to: 5:00 already counts toward the morning it opens. */
export function dawnDay(absoluteTime) {
  return Math.floor((absoluteTime + (TICKS_PER_DAY - DAWN_START)) / TICKS_PER_DAY);
}

const isRooster = (entity) => entity.isValid && !isBaby(entity) && sexOf(entity) === "male";

export function crowAtDawn() {
  if (!isDawn(world.getTimeOfDay())) return 0;
  const day = dawnDay(world.getAbsoluteTime());
  if (world.getDynamicProperty(LAST_DAWN) === day) return 0;
  world.setDynamicProperty(LAST_DAWN, day);

  const crowed = new Set();
  for (const player of world.getAllPlayers()) {
    const roosters = player.dimension
      .getEntities({ type: CHICKEN, location: player.location, maxDistance: RADIUS })
      .filter((entity) => !crowed.has(entity.id) && isRooster(entity))
      .slice(0, MAX_PER_PLAYER);
    roosters.forEach((rooster, i) => {
      crowed.add(rooster.id);
      system.runTimeout(() => {
        if (rooster.isValid) rooster.dimension.playSound(CROW_SOUND, rooster.location, { volume: 1.6, pitch: 0.95 + Math.random() * 0.1 });
      }, i * 30 + Math.floor(Math.random() * 20));
    });
  }
  return crowed.size;
}

export function startRoosters() {
  registerClockTask("roosters", crowAtDawn);
}
