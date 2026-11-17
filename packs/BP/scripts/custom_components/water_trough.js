// 水槽 (state water 0–3, one bucket fills it; one level is used per day in use)
// 自動飲水器 (never runs dry while touching a water source block).

import { CARE } from "../data/care_config.js";
import { SPECIES } from "../data/species.js";
import { ensureSettled, mark, isMarkedToday } from "../care/state.js";
import {
  today, getState, setStates, animalsNear, blockGet, blockSet, mainhand, setMainhand,
  isCreative,
} from "../utils/world_util.js";
import { ItemStack } from "@minecraft/server";
import { clockBlockEvents } from "../core/blockClock.js";
import { WASHING } from "../data/processing.js";
import { consumeMainHand, give } from "../core/inventory.js";
import { cue, refuse, levelPitch } from "../core/feedback.js";

const NS = "kaleidoscope_ranching";

/** 1.1 清洗: washes one held piece of offal for one level of water. Returns true if the held item was washable. */
function wash(block, player, held) {
  if (!held?.typeId.startsWith(`${NS}:`)) return false;
  const out = WASHING[held.typeId.slice(NS.length + 1)];
  if (!out) return false;
  const level = getState(block, "water");
  if (level <= 0) {
    refuse(player);
    return true;
  }
  consumeMainHand(player);
  give(player, `${NS}:${out}`, 1);
  setStates(block, { water: level - 1 });
  // The water left shows in the trough's model; the splash drops in pitch as it runs low.
  cue(block, "bucket.empty_water", { pitch: levelPitch(level - 1, CARE.WATER_LEVELS_PER_BUCKET), particle: "minecraft:water_splash_particle" });
  return true;
}

const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0], [0, 1, 0]];

export function touchesWaterSource(block) {
  const { x, y, z } = block.location;
  for (const [dx, dy, dz] of NEIGHBOURS) {
    try {
      const b = block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
      if (!b) continue;
      if (b.typeId === "minecraft:water" || b.typeId === "minecraft:flowing_water") {
        const depth = b.permutation.getState("liquid_depth");
        if (depth === undefined || depth === 0) return true;
      }
      if (b.isWaterlogged) return true;
    } catch {}
  }
  return false;
}

function waterAnimals(block, auto) {
  const animals = animalsNear(block);
  if (animals.length === 0) return;
  const day = today();
  const level = auto ? 1 : getState(block, "water");
  if (level <= 0) return;
  if (auto && !touchesWaterSource(block)) return;
  let used = false;
  for (const e of animals) {
    if (!SPECIES[e.typeId]) continue;
    ensureSettled(e, day);
    if (!isMarkedToday(e, "water")) {
      mark(e, "water");
      used = true;
    }
  }
  if (used && !auto && blockGet(block, "used_day") !== day) {
    blockSet(block, "used_day", day);
    setStates(block, { water: level - 1 });
  }
}

export const tickWaterTrough = (block) => waterAnimals(block, false);
export const tickAutoWaterer = (block) => waterAnimals(block, true);

export const waterTroughComponent = clockBlockEvents({
  onPlayerInteract({ block, player }) {
    if (!player) return;
    const held = mainhand(player);
    if (wash(block, player, held)) return;
    if (held?.typeId !== "minecraft:water_bucket") return;
    // ## The water level shows in the trough's model (water state); no read-out.
    setStates(block, { water: CARE.WATER_LEVELS_PER_BUCKET });
    if (!isCreative(player)) setMainhand(player, new ItemStack("minecraft:bucket", 1));
    cue(block, "bucket.empty_water", { particle: "minecraft:water_splash_particle" });
  },
});

export const autoWatererComponent = clockBlockEvents({
  // Touching water: it bubbles and gurgles. Dry: a "no" (and no bubbles).
  onPlayerInteract({ block, player }) {
    if (!player) return;
    if (touchesWaterSource(block)) cue(block, "bucket.fill_water", { particle: "minecraft:water_splash_particle", volume: 0.6 });
    else refuse(player);
  },
});
