// Per-block persistent data for custom blocks that need more than block states
// can hold (stored eggs, a station's running recipe).
//
// ## Custom blocks have no block entity in the stable API, so the data lives in
// ## a world dynamic property keyed by dimension and position. Owners must call
// ## `clearBlockData` when the block is removed. Each record also stores the
// ## block type that wrote it: if a block is replaced without its break hook
// ## running (commands, structures), the new block ignores the old record.

import { world } from "@minecraft/server";
import { dp } from "./ids.js";

function key(dimensionId, location) {
  const { x, y, z } = location;
  return dp(`block:${dimensionId}:${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
}

export function blockKey(block) {
  return key(block.dimension.id, block.location);
}

function parse(raw) {
  if (typeof raw !== "string") return null;
  try {
    const record = JSON.parse(raw);
    return record && typeof record === "object" && "data" in record ? record : null;
  } catch {
    return null;
  }
}

/** Data stored for a block, or `fallback` when none is stored for this block type. */
export function getBlockData(block, fallback = null) {
  const record = parse(world.getDynamicProperty(blockKey(block)));
  return record && record.type === block.typeId ? record.data : fallback;
}

export function setBlockData(block, data) {
  world.setDynamicProperty(blockKey(block), JSON.stringify({ type: block.typeId, data }));
}

export function clearBlockData(dimension, location) {
  world.setDynamicProperty(key(dimension.id, location), undefined);
}

/**
 * Reads and clears in one step, for break handlers (the block is already gone,
 * so pass the type that was broken). A second call finds nothing, which is
 * what keeps two break hooks from dropping items twice.
 */
export function takeBlockData(dimension, location, fallback = null, typeId = undefined) {
  const k = key(dimension.id, location);
  const record = parse(world.getDynamicProperty(k));
  world.setDynamicProperty(k, undefined);
  if (!record || (typeId && record.type !== typeId)) return fallback;
  return record.data;
}
