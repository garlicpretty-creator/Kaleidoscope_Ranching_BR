// Grass → alfalfa seeds, and the /scriptevent config switch.

import { world, system } from "@minecraft/server";
import { CARE, CFG_CLEAN_NEED } from "../data/care_config.js";
import { dropAt, center } from "../utils/world_util.js";

const GRASS = new Set(["minecraft:short_grass", "minecraft:tall_grass", "minecraft:fern", "minecraft:large_fern"]);
export const ALFALFA_SEEDS = "kaleidoscope_ranching:alfalfa_seeds";

export function registerWorldHooks() {
  world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
    if (!GRASS.has(brokenBlockPermutation.type.id)) return;
    if (Math.random() < CARE.GRASS_SEED_CHANCE) dropAt(block.dimension, center(block), ALFALFA_SEEDS, 1);
  });

  // /scriptevent kaleidoscope_ranching:config clean_need off
  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "kaleidoscope_ranching:config") return;
    const [key, value] = message.trim().split(/\s+/);
    if (key === "clean_need") world.setDynamicProperty(CFG_CLEAN_NEED, !["off", "false", "0"].includes(value));
  });
}
