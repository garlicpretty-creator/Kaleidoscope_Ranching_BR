// 苜蓿: 4-stage crop on farmland (state growth 0–3). Drops come from loot tables.

import { getState, setStates } from "../utils/world_util.js";

const GROW_CHANCE = 0.35;

export const alfalfaCropComponent = {
  onRandomTick({ block }) {
    const g = getState(block, "growth");
    if (g >= 3 || Math.random() > GROW_CHANCE) return;
    if (block.below()?.typeId !== "minecraft:farmland") return;
    setStates(block, { growth: g + 1 });
  },
};
