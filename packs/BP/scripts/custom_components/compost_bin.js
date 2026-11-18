// 堆肥槽: 4 manure + 1 wheat (稻草) → ferments one game day → 4 fertilizer.
// Timed by "record on insert, compare on take" — no running timer.

import { CARE } from "../data/care_config.js";
import { MANURE_ITEM } from "./manure.js";
import {
  getState, setStates, mainhand, consumeMainhand, give, absTime, blockGet, blockSet, blockClear, dropAt, center,
} from "../utils/world_util.js";
import { cue, refuse, levelPitch } from "../core/feedback.js";

export const FERTILIZER = "kaleidoscope_ranching:fertilizer";
const STRAW = ["minecraft:wheat", "kaleidoscope_cookery:straw"];
const FILLING = 0, FERMENTING = 1, READY = 2;

function interact(block, player) {
  const held = mainhand(player);
  let stage = getState(block, "stage");
  const manure = getState(block, "manure");

  if (stage === FERMENTING) {
    const start = blockGet(block, "start") ?? absTime();
    const elapsed = absTime() - start;
    if (elapsed < CARE.COMPOST_TICKS) {
      // Still working: a soft churn, higher the closer it is to done.
      return cue(block, "block.composter.fill", { pitch: levelPitch(elapsed, CARE.COMPOST_TICKS), volume: 0.5 });
    }
    stage = READY;
  }
  if (stage === READY) {
    give(player, FERTILIZER, CARE.COMPOST_OUTPUT);
    setStates(block, { stage: FILLING, manure: 0 });
    blockClear(block, "start");
    block.dimension.playSound("block.composter.ready", block.location);
    return;
  }
  // FILLING: the manure level shows in the bin's model; each scoop sounds higher.
  if (held?.typeId === MANURE_ITEM && manure < CARE.COMPOST_MANURE) {
    consumeMainhand(player, 1);
    setStates(block, { manure: manure + 1 });
    cue(block, "block.composter.fill", { pitch: levelPitch(manure + 1, CARE.COMPOST_MANURE) });
  } else if (held && STRAW.includes(held.typeId) && manure >= CARE.COMPOST_MANURE) {
    consumeMainhand(player, 1);
    setStates(block, { stage: FERMENTING });
    blockSet(block, "start", absTime());
    cue(block, "block.composter.fill_success", { particle: "minecraft:crop_growth_emitter" });
  } else if (held) refuse(player); // full of manure without straw, straw too early, or the wrong item
}

export const compostBinComponent = {
  onPlayerInteract({ block, player }) {
    if (player) interact(block, player);
  },
  onPlayerBreak({ block, brokenBlockPermutation }) {
    blockClear(block, "start");
    // Whatever was put in comes back out: the manure, or the fertilizer it became.
    const stage = brokenBlockPermutation?.getState("kaleidoscope_ranching:stage") ?? FILLING;
    const manure = brokenBlockPermutation?.getState("kaleidoscope_ranching:manure") ?? 0;
    if (stage === FILLING) dropAt(block.dimension, center(block), MANURE_ITEM, manure);
    else dropAt(block.dimension, center(block), stage === READY ? FERTILIZER : MANURE_ITEM, stage === READY ? CARE.COMPOST_OUTPUT : CARE.COMPOST_MANURE);
  },
};
