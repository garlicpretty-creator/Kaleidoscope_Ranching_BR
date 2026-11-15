// 糞便: placed by the daily settlement next to an animal, cleared with the 糞叉.
//
// ## A pile a yak leaves remembers the day it was dropped (block data). Left on
// ## the ground past that day it has dried, and the manure fork collects it as
// ## dried yak dung (fuel) instead of manure.

import { setBlockData } from "../core/blockStore.js";
import { today } from "../core/time.js";

export const MANURE_BLOCK = "kaleidoscope_ranching:manure";
export const MANURE_ITEM = "kaleidoscope_ranching:manure_item";
export const DRIED_YAK_DUNG = "kaleidoscope_ranching:dried_yak_dung";
const YAK = "kaleidoscope_ranching:yak";

function canHold(dim, loc) {
  try {
    const b = dim.getBlock(loc);
    const below = dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
    return b?.isAir && below && !below.isAir && !below.isLiquid && below.typeId !== MANURE_BLOCK;
  } catch {
    return false;
  }
}

/** Drop one manure pile at or next to the animal's feet. */
export function placeManureNear(entity) {
  const dim = entity.dimension;
  const base = {
    x: Math.floor(entity.location.x),
    y: Math.floor(entity.location.y),
    z: Math.floor(entity.location.z),
  };
  const offsets = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [dx, dz] of offsets) {
    for (const dy of [0, 1, -1]) {
      const loc = { x: base.x + dx, y: base.y + dy, z: base.z + dz };
      if (canHold(dim, loc)) {
        try {
          dim.setBlockType(loc, MANURE_BLOCK);
          if (entity.typeId === YAK) setBlockData(dim.getBlock(loc), { yak_day: today() });
          return true;
        } catch {}
      }
    }
  }
  return false;
}
