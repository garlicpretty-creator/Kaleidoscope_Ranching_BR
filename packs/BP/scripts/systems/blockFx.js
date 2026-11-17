// 1.1 追加 方塊動畫 (docs/1.1_追加企劃書.md 四): particles on blocks that are
// working where a player can see them.
//
// - smoke  an aging rack smoking cheese over a lit campfire: smoke rises through it.
// - steam  a pot, gratin or roast set down to share steams for five minutes.
//
// ## A 40-tick timer walks a short list of blocks a player recently started or
// ## set down (at most LIMIT; the oldest drop off). A block leaves the list when
// ## its time is up, it changed, or (smoke) its batch or fire is gone. Particles
// ## are sent only while a player is within RANGE blocks, and never when block
// ## animations are turned off in the settings. Nothing scans the world.

import { system, world } from "@minecraft/server";
import { blockFxEnabled, playFrames } from "../core/blockFrames.js";

const CHAFF_CUTTER = "kaleidoscope_ranching:chaff_cutter";

export const FX = {
  smoke: { particle: "minecraft:campfire_smoke_particle", y: 1.1 },
  steam: { particle: "minecraft:white_smoke_particle", y: 0.6 },
};
/** Seconds a set-down dish steams. */
export const STEAM_SECONDS = 300;
const RANGE = 16;
const LIMIT = 64;
const EVERY = 40; // ticks

const entries = new Map(); // block key → { dimensionId, location, typeId, kind, until, keep }

function keyOf(block) {
  const { x, y, z } = block.location;
  return `${block.dimension.id}|${x},${y},${z}`;
}

/**
 * Adds a block to the list. `seconds` limits how long it stays (undefined: until `keep(block)` says no).
 */
export function addFx(block, kind, { seconds, keep } = {}) {
  if (!FX[kind]) return;
  const key = keyOf(block);
  entries.delete(key);
  if (entries.size >= LIMIT) entries.delete(entries.keys().next().value);
  entries.set(key, {
    dimensionId: block.dimension.id,
    location: { ...block.location },
    typeId: block.typeId,
    kind,
    until: seconds === undefined ? Infinity : system.currentTick + seconds * 20,
    keep,
  });
}

/** Blocks on the list (tests). */
export const fxEntries = () => [...entries.values()];

function playerNear(dimension, location) {
  try {
    return dimension.getPlayers({ location, maxDistance: RANGE }).length > 0;
  } catch {
    return false;
  }
}

/** One pass of the timer. Returns how many particles were sent (tests). */
export function runBlockFx() {
  let sent = 0;
  for (const [key, entry] of entries) {
    if (system.currentTick > entry.until) {
      entries.delete(key);
      continue;
    }
    let dimension;
    let block;
    try {
      dimension = world.getDimension(entry.dimensionId);
      block = dimension.getBlock(entry.location);
    } catch {
      continue; // unloaded: keep it for later
    }
    if (!block) continue;
    if (block.typeId !== entry.typeId || (entry.keep && !entry.keep(block))) {
      entries.delete(key);
      continue;
    }
    if (!blockFxEnabled()) continue;
    const at = { x: entry.location.x + 0.5, y: entry.location.y + FX[entry.kind].y, z: entry.location.z + 0.5 };
    if (!playerNear(dimension, at)) continue;
    try {
      dimension.spawnParticle(FX[entry.kind].particle, at);
      sent++;
    } catch {
      // an unknown particle id in this game version: nothing to show
    }
  }
  return sent;
}

let started = false;
export function startBlockFx() {
  if (started) return;
  started = true;
  system.runInterval(runBlockFx, EVERY);
  // The chaff cutter is a crafting table: opening it is the only use it sees, so the blade comes down then.
  world.afterEvents.playerInteractWithBlock?.subscribe(({ block }) => {
    if (block?.typeId === CHAFF_CUTTER) playFrames(block);
  });
}
