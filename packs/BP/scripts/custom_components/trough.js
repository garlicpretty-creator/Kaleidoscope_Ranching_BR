// 飼槽: holds one kind of feed (state kind 0–5, fill 0–15).
// Its clock pass (core/blockClock.js) is the "飼槽結算": settles animals in range, feeds them,
// and marks the 清潔 need from the pen's manure count.

import { playAtBlock } from "../core/actions.js";
import { CARE } from "../data/care_config.js";
import { FEEDS, KIND, KIND_TIER } from "../data/feeds.js";
import { SPECIES } from "../data/species.js";
import { ensureSettled, mark, isMarkedToday, cleanNeedEnabled } from "../care/state.js";
import {
  today, getState, setStates, animalsNear, countBlocksNear, blockGet, blockSet,
  mainhand, consumeMainhand,
} from "../utils/world_util.js";
import { MANURE_BLOCK } from "./manure.js";
import { FEED_BAG, bagToTrough } from "../events/feed_bag.js";
import { cue, refuse, levelPitch } from "../core/feedback.js";
import { clockBlockEvents } from "../core/blockClock.js";

export const TROUGH = "kaleidoscope_ranching:trough";

/** Put up to `units` units of `kind` in a trough. Returns units accepted. */
export function addToTrough(block, kind, units) {
  const curKind = getState(block, "kind");
  const fill = getState(block, "fill");
  if (curKind !== KIND.EMPTY && curKind !== kind && fill > 0) return 0;
  const take = Math.min(units, CARE.TROUGH_CAPACITY - fill);
  if (take <= 0) return 0;
  setStates(block, { kind, fill: fill + take });
  return take;
}

/** How many whole items of a feed fit right now. */
export function itemsThatFit(block, feed, have) {
  const curKind = getState(block, "kind");
  const fill = getState(block, "fill");
  if (curKind !== KIND.EMPTY && curKind !== feed.kind && fill > 0) return 0;
  return Math.min(have, Math.floor((CARE.TROUGH_CAPACITY - fill) / feed.units));
}

function penIsClean(block, day) {
  if (blockGet(block, "clean_day") === day) return blockGet(block, "clean_ok") === true;
  const ok = countBlocksNear(block, MANURE_BLOCK) <= CARE.MANURE_DIRTY_THRESHOLD;
  blockSet(block, "clean_day", day);
  blockSet(block, "clean_ok", ok);
  return ok;
}

export function tickTrough(block) {
  const animals = animalsNear(block);
  if (animals.length === 0) return;
  const day = today();
  let kind = getState(block, "kind");
  let fill = getState(block, "fill");
  // 1.1 動物動作: animals at the trough are seen eating what is in it.
  if (fill > 0) playAtBlock(block, animals, "eat", (e) => SPECIES[e.typeId]?.eats.includes(kind));
  const checkClean = cleanNeedEnabled();
  let clean = null;

  for (const e of animals) {
    const sp = SPECIES[e.typeId];
    if (!sp) continue;
    ensureSettled(e, day);
    if (checkClean && !isMarkedToday(e, "clean")) {
      if (clean === null) clean = penIsClean(block, day);
      if (clean) mark(e, "clean");
    }
    if (fill > 0 && sp.eats.includes(kind) && !isMarkedToday(e, "fed")) {
      // fed_kind: 1.1 calcium feed gives hens an extra egg (systems/nest.js).
      mark(e, "fed", { fed_tier: KIND_TIER[kind] ?? 1, fed_kind: kind });
      fill--;
    }
  }
  if (fill !== getState(block, "fill")) setStates(block, { fill, kind: fill > 0 ? kind : KIND.EMPTY });
}

// ## No read-out: the feed shows in the trough (its model's fill and colour come from the
// ## kind and fill states), and a filling sound rises in pitch as the trough fills.
function interact(block, player) {
  const held = mainhand(player);
  if (held?.typeId === FEED_BAG) return void bagToTrough(player, held, block);
  const feed = held && FEEDS[held.typeId];
  if (!feed) return;
  const n = itemsThatFit(block, feed, player.isSneaking ? held.amount : 1);
  if (n <= 0) return refuse(player); // full, or holding another kind of feed
  addToTrough(block, feed.kind, n * feed.units);
  consumeMainhand(player, n);
  cue(block, "block.composter.fill", { pitch: levelPitch(getState(block, "fill"), CARE.TROUGH_CAPACITY) });
}

export const troughComponent = clockBlockEvents({
  onPlayerInteract({ block, player }) {
    if (player) interact(block, player);
  },
});
