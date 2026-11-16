// 堆肥槽: 4 manure + 1 wheat (稻草) → ferments one game day → 4 fertilizer.
// Timed by "record on insert, compare on take" — no running timer.

import { CARE } from "../data/care_config.js";
import { MANURE_ITEM } from "./manure.js";
import {
  getState, setStates, mainhand, consumeMainhand, give, absTime, blockGet, blockSet, blockClear, actionbar, dropAt, center,
} from "../utils/world_util.js";
import { T } from "../ui/text.js";

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
      const pct = Math.floor((elapsed / CARE.COMPOST_TICKS) * 100);
      return actionbar(player, T("compost.progress", [`${pct}`]));
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
  // FILLING
  if (held?.typeId === MANURE_ITEM && manure < CARE.COMPOST_MANURE) {
    consumeMainhand(player, 1);
    setStates(block, { manure: manure + 1 });
    block.dimension.playSound("block.composter.fill", block.location);
  } else if (held && STRAW.includes(held.typeId) && manure >= CARE.COMPOST_MANURE) {
    consumeMainhand(player, 1);
    setStates(block, { stage: FERMENTING });
    blockSet(block, "start", absTime());
    block.dimension.playSound("block.composter.fill_success", block.location);
    return actionbar(player, T("compost.started"));
  }
  actionbar(player, T("compost.filling", [`${getState(block, "manure")}`, `${CARE.COMPOST_MANURE}`]));
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
