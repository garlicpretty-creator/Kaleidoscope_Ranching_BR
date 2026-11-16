// 企劃書 適用動物: 公雞清晨啼叫 — roosters crow at dawn.
//
// ## Once a game day, on the first ranch-clock pass of the dawn window
// ## (time of day 23000–24000, the vanilla sunrise), every adult rooster
// ## within ROOSTER_HEARING of a player crows once, each after its own short
// ## random delay. Only the players' surroundings are searched, never the
// ## whole world. The crow is the vanilla chicken call pitched down three
// ## times; a dedicated sound can replace it in crow() without other changes.

import { system, world } from "@minecraft/server";
import { isBaby, sexOf } from "../core/animal.js";
import { registerClockTask } from "../core/clock.js";
import { dp, rid } from "../core/ids.js";

const DAWN_START = 23000;
const ROOSTER_HEARING = 64;
const MAX_DELAY_TICKS = 200;
const LAST_CROW_DAY = dp("rooster_crow_day");
/** [delay in ticks, pitch]: "cock-a-doodle-doo" from three pitched chicken calls. */
const CALL = [[0, 0.8], [5, 1.05], [11, 0.62]];

export function crow(rooster) {
  for (const [delay, pitch] of CALL) {
    system.runTimeout(() => {
      try {
        if (rooster.isValid) rooster.dimension.playSound("mob.chicken.say", rooster.location, { pitch, volume: 1.6 });
      } catch {}
    }, delay);
  }
}

/** The morning a dawn-window tick belongs to (23000–23999 is the eve of the next day). */
function morningOf(absoluteTime) {
  return Math.floor((absoluteTime + (24000 - DAWN_START)) / 24000);
}

/** One clock pass: crows at most once per morning. Returns how many roosters crowed. */
export function crowAtDawn() {
  if (world.getTimeOfDay() < DAWN_START) return 0;
  const morning = morningOf(world.getAbsoluteTime());
  if (world.getDynamicProperty(LAST_CROW_DAY) === morning) return 0;
  world.setDynamicProperty(LAST_CROW_DAY, morning);
  const heard = new Set();
  for (const player of world.getAllPlayers()) {
    let nearby = [];
    try {
      nearby = player.dimension.getEntities({ type: rid("chicken"), location: player.location, maxDistance: ROOSTER_HEARING });
    } catch {}
    for (const rooster of nearby) {
      if (heard.has(rooster.id) || isBaby(rooster) || sexOf(rooster) !== "male") continue;
      heard.add(rooster.id);
      system.runTimeout(() => crow(rooster), Math.floor(Math.random() * MAX_DELAY_TICKS));
    }
  }
  return heard.size;
}

export function startRoosters() {
  registerClockTask("rooster_crow", crowAtDawn);
}
