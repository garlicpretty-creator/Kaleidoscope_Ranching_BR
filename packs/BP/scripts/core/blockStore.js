// Per-block persistent data for custom blocks that need more than block states
// can hold (stored eggs, a station's running recipe).
//
// ## Custom blocks have no block entity in the stable API, so the data lives in
// ## a world dynamic property keyed by dimension and position. Owners must call
// ## `clearBlockData` when the block is removed.

import { world } from "@minecraft/server";
import { dp } from "./ids.js";

function key(dimensionId, location) {
  const { x, y, z } = location;
  return dp(`block:${dimensionId}:${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
}

export function blockKey(block) {
  return key(block.dimension.id, block.location);
}

/** Data stored for a block, or `fallback` when none is stored. */
export function getBlockData(block, fallback = null) {
  const raw = world.getDynamicProperty(blockKey(block));
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setBlockData(block, data) {
  world.setDynamicProperty(blockKey(block), JSON.stringify(data));
}

export function clearBlockData(dimension, location) {
  world.setDynamicProperty(key(dimension.id, location), undefined);
}

/** Reads and clears in one step, for break handlers that receive a location. */
export function takeBlockData(dimension, location, fallback = null) {
  const k = key(dimension.id, location);
  const raw = world.getDynamicProperty(k);
  world.setDynamicProperty(k, undefined);
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
