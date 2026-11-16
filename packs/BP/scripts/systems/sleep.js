// 1.1 動物作息 (企劃書 1.1 十一、動物作息): animals lie down at night.
//
// - From SLEEP_START (13000) to WAKE (23000) an animal near a player that is
//   not on a lead (which also covers the hitching post and the milking rack)
//   falls asleep: the `fall_asleep` event stops it moving (entity group
//   `sleeping`) and sets the synced `sleeping` property the client poses on.
// - At dawn the animals wake one by one within WAKE_SPREAD ticks of the first
//   clock pass after WAKE (the rooster crows on that same pass).
// - Waking early: being hurt, a lead or lasso, a hostile within HOSTILE_RANGE
//   (a male goose keeps watch: GOOSE_WATCH_RANGE), being pushed by a player,
//   the cowbell or the herding horn. A woken animal lies down again after
//   RESLEEP_TICKS of quiet. Walking up, petting and bottle feeding do not wake.
// - Once a night, when it falls asleep: sheltered (a block overhead) and next
//   to a hay rack or a rug → 睡得好, +SLEPT_WELL_POINTS affection. Out in the
//   open where it snows (snow or ice by its feet) without a blanket → a cold
//   night, -COLD_NIGHT_POINTS. Yaks do not feel the cold.
// - `/scriptevent kaleidoscope_ranching:config sleep off` (or the notebook's
//   settings page) turns the routine off; sleeping animals wake up.
//
// ## The clock task decides who sleeps; a faster interval only looks at the
// ## animals that are asleep, so waking stays responsive without scanning.

import { system, world } from "@minecraft/server";
import { isRanchAnimal } from "../core/animal.js";
import { registerClockTask } from "../core/clock.js";
import { emitRanchEvent } from "../core/events.js";
import { dp, rid } from "../core/ids.js";
import { today } from "../core/time.js";
import { addAffection } from "../care/state.js";
import { sexOf } from "../core/animal.js";

export const SLEEP_START = 13000;
export const WAKE = 23000;
export const WAKE_SPREAD = 200;
export const RESLEEP_TICKS = 100;
export const HOSTILE_RANGE = 10;
export const GOOSE_WATCH_RANGE = 16;
export const SLEPT_WELL_POINTS = 4;
export const COLD_NIGHT_POINTS = 4;
const RANGE = 64;
const CHECK_INTERVAL = 20;

export const SLEEPING = "kaleidoscope_ranching:sleeping";
export const CFG_SLEEP = "kr:cfg:sleep";
const WOKE_AT = dp("woke_at");
const NIGHT_DONE = dp("sleep_night");
export const BLANKET = dp("blanket");

const COZY_BLOCKS = [rid("hay_rack"), rid("rug")];
const COLD_BLOCKS = ["minecraft:snow_layer", "minecraft:snow", "minecraft:powder_snow", "minecraft:ice", "minecraft:packed_ice", "minecraft:blue_ice"];
const HOSTILE_FAMILIES = ["monster"];

const sleepers = new Set();

export function sleepEnabled() {
  return world.getDynamicProperty(CFG_SLEEP) !== false;
}

export function isAsleep(animal) {
  try {
    return animal.getProperty(SLEEPING) === true;
  } catch {
    return false;
  }
}

const isNight = (time = world.getTimeOfDay()) => time >= SLEEP_START && time < WAKE;

/** The night an evening or early-morning tick belongs to (the day it began). */
const nightOf = () => (world.getTimeOfDay() < SLEEP_START ? today() - 1 : today());

function isLeashed(animal) {
  try {
    return animal.getComponent("minecraft:leashable")?.isLeashed === true;
  } catch {
    return false;
  }
}

function blockAt(dimension, x, y, z) {
  try {
    return dimension.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
  } catch {
    return undefined;
  }
}

/** A solid block somewhere in the 8 blocks above the animal. */
export function isSheltered(animal) {
  const { x, y, z } = animal.location;
  for (let dy = 2; dy <= 8; dy++) {
    const block = blockAt(animal.dimension, x, y + dy, z);
    if (block && !block.isAir && !block.isLiquid) return true;
  }
  return false;
}

function near(animal, typeIds, radius) {
  const { x, y, z } = animal.location;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (typeIds.includes(blockAt(animal.dimension, x + dx, y + dy, z + dz)?.typeId)) return true;
      }
    }
  }
  return false;
}

export const isCold = (animal) => near(animal, COLD_BLOCKS, 2);

/** Once a night: the shelter bonus or the cold. Returns "slept_well", "cold" or null. */
export function settleNight(animal) {
  const night = nightOf();
  if (animal.getDynamicProperty(NIGHT_DONE) === night) return null;
  animal.setDynamicProperty(NIGHT_DONE, night);
  const sheltered = isSheltered(animal);
  if (sheltered && near(animal, COZY_BLOCKS, 4)) {
    addAffection(animal, SLEPT_WELL_POINTS);
    emitRanchEvent("slept_well", { animal: animal.typeId, entity: animal.id });
    return "slept_well";
  }
  if (!sheltered && animal.typeId !== rid("yak") && animal.getDynamicProperty(BLANKET) !== true && isCold(animal)) {
    addAffection(animal, -COLD_NIGHT_POINTS);
    return "cold";
  }
  return null;
}

export function fallAsleep(animal) {
  if (isAsleep(animal)) return false;
  try {
    animal.triggerEvent("kaleidoscope_ranching:fall_asleep");
  } catch {
    return false;
  }
  sleepers.add(animal.id);
  settleNight(animal);
  emitRanchEvent("fell_asleep", { animal: animal.typeId, entity: animal.id });
  return true;
}

export function wakeUp(animal, reason = "dawn") {
  sleepers.delete(animal.id);
  if (!isAsleep(animal)) return false;
  try {
    animal.triggerEvent("kaleidoscope_ranching:wake_up");
  } catch {
    return false;
  }
  if (reason !== "dawn") animal.setDynamicProperty(WOKE_AT, system.currentTick);
  emitRanchEvent("woke", { animal: animal.typeId, entity: animal.id, reason });
  return true;
}

/** Wakes every sleeping ranch animal within `radius` of a location (cowbell, horn). */
export function wakeNear(dimension, location, radius, reason) {
  let woken = 0;
  for (const entity of dimension.getEntities({ location, maxDistance: radius })) {
    if (isRanchAnimal(entity) && wakeUp(entity, reason)) woken++;
  }
  return woken;
}

function canSleepNow(animal) {
  if (isLeashed(animal)) return false;
  const woke = animal.getDynamicProperty(WOKE_AT);
  return typeof woke !== "number" || system.currentTick - woke >= RESLEEP_TICKS;
}

/** One clock pass: animals near players lie down at night and get up at dawn. */
export function settleSleep() {
  const night = isNight() && sleepEnabled();
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    let entities = [];
    try {
      entities = player.dimension.getEntities({ location: player.location, maxDistance: RANGE });
    } catch {}
    for (const animal of entities) {
      if (seen.has(animal.id) || !isRanchAnimal(animal)) continue;
      seen.add(animal.id);
      if (night) {
        if (!isAsleep(animal) && canSleepNow(animal)) fallAsleep(animal);
      } else if (isAsleep(animal)) {
        system.runTimeout(() => animal.isValid && wakeUp(animal), Math.floor(Math.random() * WAKE_SPREAD));
      }
    }
  }
}

function hostileNear(animal, range) {
  try {
    return animal.dimension.getEntities({ location: animal.location, maxDistance: range, families: HOSTILE_FAMILIES }).length > 0;
  } catch {
    return false;
  }
}

function pushedByPlayer(animal) {
  try {
    return animal.dimension.getEntities({ type: "minecraft:player", location: animal.location, maxDistance: 0.8 }).length > 0;
  } catch {
    return false;
  }
}

/** The fast check on sleeping animals only. */
export function checkSleepers() {
  for (const id of [...sleepers]) {
    const animal = world.getEntity(id);
    if (!animal?.isValid) {
      sleepers.delete(id);
      continue;
    }
    const watchful = animal.typeId === rid("goose") && sexOf(animal) === "male";
    if (isLeashed(animal)) wakeUp(animal, "lead");
    else if (hostileNear(animal, watchful ? GOOSE_WATCH_RANGE : HOSTILE_RANGE)) wakeUp(animal, "hostile");
    else if (pushedByPlayer(animal)) wakeUp(animal, "pushed");
  }
}

export function startSleep() {
  registerClockTask("sleep", settleSleep);
  system.runInterval(checkSleepers, CHECK_INTERVAL);
  world.afterEvents.entityHurt.subscribe(({ hurtEntity }) => {
    if (isRanchAnimal(hurtEntity)) wakeUp(hurtEntity, "hurt");
  });
  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "kaleidoscope_ranching:config") return;
    const [key, value] = message.trim().split(/\s+/);
    if (key !== "sleep") return;
    const on = !["off", "false", "0"].includes(value);
    world.setDynamicProperty(CFG_SLEEP, on);
    if (!on) for (const player of world.getAllPlayers()) wakeNear(player.dimension, player.location, RANGE, "config");
  });
}
