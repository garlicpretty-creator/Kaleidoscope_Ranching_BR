// Custom blocks that act on their own (M2 troughs, water troughs, auto
// feeders, salt licks; M3 nest boxes and incubators) run on the ranch clock
// instead of block ticks.
//
// ## Each block type keeps a bounded registry of placed blocks (core/clock.js).
// ## A block joins when it is placed or used and leaves when it is broken; the
// ## clock also drops entries whose block has changed. Blocks in unloaded
// ## chunks are skipped until they load again, so nothing scans the world.

import { world } from "@minecraft/server";
import { createRegistry, registerClockTask } from "../core/clock.js";

const TYPES = new Map(); // typeId → { registry, tick }

/** Declares a block type whose `tick(block)` runs on every clock pass. */
export function defineClockBlock(typeId, registryName, tick) {
  TYPES.set(typeId, { registry: createRegistry(registryName), tick });
}

function encode(dimensionId, location) {
  const { x, y, z } = location;
  return `${dimensionId}|${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`;
}
function decode(key) {
  const [dimensionId, coords] = key.split("|");
  const [x, y, z] = coords.split(",").map(Number);
  return { dimensionId, location: { x, y, z } };
}

export function trackBlock(block) {
  TYPES.get(block.typeId)?.registry.add(encode(block.dimension.id, block.location));
}

export function untrackBlock(typeId, dimension, location) {
  TYPES.get(typeId)?.registry.remove(encode(dimension.id, location));
}

/** Runs one clock pass now (the clock calls this; tests may too). */
export function runBlockClock() {
  for (const [typeId, { registry, tick }] of TYPES) {
    for (const key of registry.all()) {
      const { dimensionId, location } = decode(key);
      let block;
      try {
        block = world.getDimension(dimensionId).getBlock(location);
      } catch {
        continue; // unloaded chunk
      }
      if (!block) continue;
      if (block.typeId !== typeId) {
        registry.remove(key);
        continue;
      }
      try {
        tick(block);
      } catch (error) {
        console.warn(`[kaleidoscope_ranching] ${typeId} at ${key} failed: ${error}`);
      }
    }
  }
}

/** Starts the clock task once; any milestone may call it. */
let started = false;
export function startBlockClock() {
  if (started) return;
  started = true;
  registerClockTask("blocks", runBlockClock);
}

/** Component events shared by every clock block: join on place/use, leave on break. */
export function clockBlockEvents(extra = {}) {
  return {
    ...extra,
    onPlace(event) {
      trackBlock(event.block);
      extra.onPlace?.(event);
    },
    onPlayerInteract(event) {
      trackBlock(event.block);
      extra.onPlayerInteract?.(event);
    },
    onPlayerBreak(event) {
      const typeId = event.brokenBlockPermutation?.type?.id ?? event.block.typeId;
      untrackBlock(typeId, event.block.dimension, event.block.location);
      extra.onPlayerBreak?.(event);
    },
  };
}
