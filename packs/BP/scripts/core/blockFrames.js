// 1.1 工作台互動動畫: plays a station's flip-book (data/stationFrames.js) by
// stepping its `frame` state, then puts it back to frame 0.
//
// ## Each step fetches the block again and stops if it is gone or changed type.
// ## A new use restarts the flip-book; the steps of the old one see a newer
// ## token and do nothing. A world closed half way through loads with the part
// ## in some other position, which is still a valid look; the next use resets it.

import { system } from "@minecraft/server";
import { FRAME_STATE, STATION_FRAMES } from "../data/stationFrames.js";

const tokens = new Map(); // block key → latest play

function key(block) {
  const { x, y, z } = block.location;
  return `${block.dimension.id}|${x},${y},${z}`;
}

function setFrame(dimension, location, typeId, frame) {
  try {
    const block = dimension.getBlock(location);
    if (!block || block.typeId !== typeId) return false;
    block.setPermutation(block.permutation.withState(FRAME_STATE, frame));
    return true;
  } catch {
    return false; // unloaded, or a block without the state
  }
}

/** Plays the flip-book of the station at `block`, if it has one. Returns false when it has none. */
export function playFrames(block) {
  const spec = STATION_FRAMES[block.typeId.replace(/^kaleidoscope_ranching:/, "")];
  if (!spec) return false;
  const { dimension, typeId } = block;
  const location = { ...block.location };
  const id = key(block);
  const token = (tokens.get(id) ?? 0) + 1;
  tokens.set(id, token);
  const steps = spec.frames * spec.cycles;
  for (let step = 1; step <= steps; step++) {
    system.runTimeout(() => {
      if (tokens.get(id) !== token) return;
      setFrame(dimension, location, typeId, step % spec.frames);
      if (step === steps) tokens.delete(id);
    }, step * spec.ticks);
  }
  return true;
}
