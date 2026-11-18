// 1.1 動物動作: plays an everyday animation on an animal by setting its synced
// `action` property, and sets it back to "none" when the time is up
// (data/actions.js). The resource pack does the rest; nothing here runs per tick.
//
// ## An animal asleep, or one without the property (another add-on's animal
// ## registered through the API), is left alone. If the world closes before the
// ## timer fires, the property stays set; the client's animation controller still
// ## stops the animation after its time, and the next action resets it.

import { system } from "@minecraft/server";
import { ACTION_CHANCE, ACTION_PROPERTY, ACTION_REACH, ACTION_SECONDS } from "../data/actions.js";

const SLEEPING = "kaleidoscope_ranching:sleeping";
const timers = new Map(); // entity id → run handle

/** Plays `action` on the animal now. Returns false when it cannot play. */
export function playAction(entity, action) {
  const seconds = ACTION_SECONDS[action];
  if (!seconds) return false;
  try {
    if (!entity?.isValid) return false;
    if (entity.getProperty(ACTION_PROPERTY) === undefined) return false;
    if (entity.getProperty(SLEEPING) === true) return false;
    entity.setProperty(ACTION_PROPERTY, action);
  } catch {
    return false;
  }
  const previous = timers.get(entity.id);
  if (previous !== undefined) system.clearRun(previous);
  timers.set(
    entity.id,
    system.runTimeout(() => {
      timers.delete(entity.id);
      try {
        if (entity.isValid && entity.getProperty(ACTION_PROPERTY) === action) entity.setProperty(ACTION_PROPERTY, "none");
      } catch {
        // the entity unloaded; the client controller has already stopped the animation
      }
    }, Math.round(seconds * 20))
  );
  return true;
}

/**
 * Animals standing at a feeding block play `action` (each with ACTION_CHANCE).
 * `wants(entity)` says whether this animal would eat or drink what the block holds.
 */
export function playAtBlock(block, animals, action, wants = () => true, random = Math.random) {
  const cx = block.location.x + 0.5;
  const cz = block.location.z + 0.5;
  let played = 0;
  for (const entity of animals) {
    const { x, z } = entity.location;
    if (Math.hypot(x - cx, z - cz) > ACTION_REACH) continue;
    if (!wants(entity) || random() >= ACTION_CHANCE) continue;
    if (playAction(entity, action)) played++;
  }
  return played;
}
