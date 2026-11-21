// 水槽 (state water 0–3, one bucket fills it; one level is used per day in use)
// A water bottle adds one level; an empty hand draws from a water cauldron beside it.
// 自動飲水器 (never runs dry while touching a water source block).

import { playAtBlock } from "../core/actions.js";
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

// A water bottle (minecraft:potion holding plain water) pours in one level and gives the bottle back.
/** Whether the item is a bottle of plain water. */
export function isWaterBottle(item) {
  if (item?.typeId !== "minecraft:potion") return false;
  try {
    const id = item.getComponent("minecraft:potion")?.potionEffectType?.id;
    return typeof id === "string" && id.replace(/^minecraft:/, "").toLowerCase() === "water";
  } catch {
    return false;
  }
}

function pourBottle(block, player) {
  const level = getState(block, "water") ?? 0;
  const max = CARE.WATER_LEVELS_PER_BUCKET;
  if (level >= max) return refuse(player); // already full
  const next = Math.min(max, level + CARE.WATER_LEVELS_PER_BOTTLE);
  setStates(block, { water: next });
  if (!isCreative(player)) {
    consumeMainHand(player);
    give(player, "minecraft:glass_bottle", 1);
  }
  cue(block, "bucket.empty_water", { volume: 0.6, pitch: levelPitch(next, max), particle: "minecraft:water_splash_particle" });
}

// Used with an empty hand next to a cauldron of water: the trough draws from it, one level
// per CAULDRON_FILL_PER_LEVEL of the cauldron, until the trough is full or the cauldron empty.
const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

/** The water cauldrons beside a block that hold at least one trough level. */
export function waterCauldronsBeside(block) {
  const { x, y, z } = block.location;
  const found = [];
  for (const [dx, dy, dz] of SIDES) {
    try {
      const b = block.dimension.getBlock({ x: x + dx, y: y + dy, z: z + dz });
      if (b?.typeId !== "minecraft:cauldron") continue;
      const liquid = b.permutation.getState("cauldron_liquid");
      if (liquid !== undefined && liquid !== "water") continue;
      if ((b.permutation.getState("fill_level") ?? 0) >= CARE.CAULDRON_FILL_PER_LEVEL) found.push(b);
    } catch {}
  }
  return found;
}

/** Fills the trough from the cauldrons beside it; false if there was nothing to draw. */
function drawFromCauldron(block, player) {
  const max = CARE.WATER_LEVELS_PER_BUCKET;
  let level = getState(block, "water") ?? 0;
  const cauldrons = waterCauldronsBeside(block);
  if (!cauldrons.length) return false;
  if (level >= max) {
    refuse(player); // already full
    return true;
  }
  for (const cauldron of cauldrons) {
    let fill = cauldron.permutation.getState("fill_level");
    while (level < max && fill >= CARE.CAULDRON_FILL_PER_LEVEL) {
      fill -= CARE.CAULDRON_FILL_PER_LEVEL;
      level++;
    }
    cauldron.setPermutation(cauldron.permutation.withState("fill_level", fill));
    if (level >= max) break;
  }
  setStates(block, { water: level });
  cue(block, "bucket.empty_water", { pitch: levelPitch(level, max), particle: "minecraft:water_splash_particle" });
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
  // 1.1 動物動作: animals at the trough are seen drinking.
  playAtBlock(block, animals, "drink", (e) => Boolean(SPECIES[e.typeId]));
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
    if (isWaterBottle(held)) return pourBottle(block, player);
    if (!held) return void drawFromCauldron(block, player);
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
