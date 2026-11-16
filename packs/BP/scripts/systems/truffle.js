// 1.1 松露 (企劃書 1.1 三、蛋奶線): a well-loved pig roots up truffles.
//
// ## On the ranch clock, each pig within TRUFFLE_RANGE of a player gets one try
// ## per game day: with TRUFFLE_MIN_HEARTS or more, standing on grass or podzol
// ## in a forest (a log within FOREST_RADIUS), it digs up a truffle with
// ## TRUFFLE_CHANCE. Only the players' surroundings are searched. A forest is
// ## told by its trees rather than the biome, so it also works in a planted wood.

import { world } from "@minecraft/server";
import { AFFECTION } from "../data/animals.js";
import { animalByType } from "../core/content.js";
import { isRanchAnimal } from "../core/animal.js";
import { isBaby } from "../core/animal.js";
import { registerClockTask } from "../core/clock.js";
import { emitRanchEvent } from "../core/events.js";
import { getAffection } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { dropItems } from "../core/inventory.js";
import { today } from "../core/time.js";

// Full hearts (企劃書: 好感度滿心的豬); M2 hearts run 0–5.
export const TRUFFLE_MIN_HEARTS = AFFECTION.max;
export const TRUFFLE_CHANCE = 0.25;
const TRUFFLE_RANGE = 64;
const FOREST_RADIUS = 4;
const LAST_TRY_DAY = dp("truffle_day");
const SOILS = ["minecraft:grass_block", "minecraft:podzol"];
const TREE = /^minecraft:(\w+_)?(log|wood|stem)$/;

/** Whether a log stands within FOREST_RADIUS blocks of the pig (same height or up to 4 above). */
function inForest(dimension, location) {
  const bx = Math.floor(location.x);
  const by = Math.floor(location.y);
  const bz = Math.floor(location.z);
  for (let dy = 0; dy <= 4; dy++) {
    for (let dx = -FOREST_RADIUS; dx <= FOREST_RADIUS; dx++) {
      for (let dz = -FOREST_RADIUS; dz <= FOREST_RADIUS; dz++) {
        try {
          if (TREE.test(dimension.getBlock({ x: bx + dx, y: by + dy, z: bz + dz })?.typeId ?? "")) return true;
        } catch {}
      }
    }
  }
  return false;
}

/** One pig's daily try. Returns true when it found a truffle. */
/** What a type digs up: the pig's truffle, or a registered `forage` (1.1 API). */
export const forageOf = (typeId) =>
  typeId === rid("pig") ? { item: rid("truffle"), chance: TRUFFLE_CHANCE, minHearts: TRUFFLE_MIN_HEARTS } : animalByType(typeId)?.forage;

export function rootForTruffle(pig, roll = Math.random()) {
  const day = today();
  const forage = forageOf(pig.typeId);
  if (!forage || pig.getDynamicProperty(LAST_TRY_DAY) === day) return false;
  pig.setDynamicProperty(LAST_TRY_DAY, day);
  if (isBaby(pig) || getAffection(pig) < forage.minHearts) return false;
  const { x, y, z } = pig.location;
  let soil;
  try {
    soil = pig.dimension.getBlock({ x: Math.floor(x), y: Math.floor(y) - 1, z: Math.floor(z) })?.typeId;
  } catch {}
  if (!SOILS.includes(soil) || !inForest(pig.dimension, pig.location)) return false;
  if (roll >= forage.chance) return false;
  dropItems(pig.dimension, forage.item, 1, { x, y: y + 0.3, z });
  emitRanchEvent("foraged", { animal: pig.typeId, entity: pig.id, items: { [forage.item]: 1 } });
  try {
    pig.dimension.playSound("mob.pig.say", pig.location, { pitch: 1.3 });
  } catch {}
  return true;
}

export function findTruffles() {
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    let pigs = [];
    try {
      pigs = player.dimension.getEntities({ location: player.location, maxDistance: TRUFFLE_RANGE });
    } catch {}
    for (const pig of pigs) {
      if (seen.has(pig.id) || !isRanchAnimal(pig) || !forageOf(pig.typeId)) continue;
      seen.add(pig.id);
      rootForTruffle(pig);
    }
  }
}

export function startTruffles() {
  registerClockTask("truffles", findTruffles);
}
