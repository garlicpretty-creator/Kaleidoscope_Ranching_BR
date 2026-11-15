// 鹽磚: animals in range get the salt bonus each day; wears away (state bites 0–6).

import { CARE } from "../data/care_config.js";
import { SPECIES } from "../data/species.js";
import { ensureSettled, mark } from "../care/state.js";
import { clockBlockEvents, untrackBlock } from "../core/blockClock.js";
import { today, getState, setStates, animalsNear, blockGet, blockSet, blockClear } from "../utils/world_util.js";

export function tickSaltLick(block) {
  const animals = animalsNear(block);
  if (animals.length === 0) return;
  const day = today();
  let used = false;
  for (const e of animals) {
    if (!SPECIES[e.typeId]) continue;
    ensureSettled(e, day);
    if (mark(e, "salt")) used = true;
  }
  if (!used || blockGet(block, "used_day") === day) return;
  blockSet(block, "used_day", day);
  const bites = getState(block, "bites") + 1;
  if (bites >= CARE.SALT_LICK_DAYS) {
    blockClear(block, "used_day");
    untrackBlock(block.typeId, block.dimension, block.location);
    block.setType("minecraft:air");
    block.dimension.playSound("dig.stone", block.location);
  } else setStates(block, { bites });
}

export const saltLickComponent = clockBlockEvents({
  onPlayerBreak({ block }) {
    blockClear(block, "used_day");
  },
});
