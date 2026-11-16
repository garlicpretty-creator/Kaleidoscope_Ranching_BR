// Item custom components: 肥料 and 糞叉.

import { BlockStates } from "@minecraft/server";
import { CARE } from "../data/care_config.js";
import { DRIED_YAK_DUNG, MANURE_BLOCK, MANURE_ITEM } from "../custom_components/manure.js";
import { takeBlockData } from "../core/blockStore.js";
import { today } from "../core/time.js";
import { consumeMainhand, damageMainhand, dropAt, center } from "../utils/world_util.js";

/** Find an integer growth-like state on any crop (vanilla, Cookery, Ranching). */
function growthState(permutation) {
  const states = permutation.getAllStates();
  for (const name of Object.keys(states)) {
    const short = name.includes(":") ? name.split(":")[1] : name;
    if (!["growth", "age", "growth_stage", "stage"].includes(short)) continue;
    if (typeof states[name] !== "number") continue;
    const values = BlockStates.get(name)?.validValues ?? [];
    const max = Math.max(...values.filter((v) => typeof v === "number"));
    if (Number.isFinite(max)) return { name, value: states[name], max };
  }
  return null;
}

export const fertilizerComponent = {
  onUseOn({ source, block }) {
    if (!source || !block) return;
    const g = growthState(block.permutation);
    if (!g || g.value >= g.max) return;
    try {
      block.setPermutation(block.permutation.withState(g.name, Math.min(g.max, g.value + CARE.FERTILIZER_STAGES)));
    } catch {
      return;
    }
    consumeMainhand(source, 1);
    block.dimension.spawnParticle("minecraft:crop_growth_emitter", center(block));
    block.dimension.playSound("item.bone_meal.use", block.location);
  },
};

export const manureForkComponent = {
  onUseOn({ source, block }) {
    if (!source || !block) return;
    const dim = block.dimension;
    const { x, y, z } = block.location;
    let n = 0;
    let dried = 0;
    const day = today();
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = -1; dy <= 1; dy++) {
          const loc = { x: x + dx, y: y + dy, z: z + dz };
          try {
            if (dim.getBlock(loc)?.typeId === MANURE_BLOCK) {
              const yakDay = takeBlockData(dim, loc, null, MANURE_BLOCK)?.yak_day;
              dim.setBlockType(loc, "minecraft:air");
              if (yakDay !== undefined && day > yakDay) dried++;
              else n++;
            }
          } catch {}
        }
    if (n + dried === 0) return;
    if (n) dropAt(dim, center(block), MANURE_ITEM, n);
    if (dried) dropAt(dim, center(block), DRIED_YAK_DUNG, dried);
    dim.playSound("dig.gravel", block.location);
    damageMainhand(source);
  },
};
