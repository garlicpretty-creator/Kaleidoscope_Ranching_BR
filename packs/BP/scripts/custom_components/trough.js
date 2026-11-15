// 飼槽: holds one kind of feed (state kind 0–5, fill 0–15).
// Its clock pass (core/blockClock.js) is the "飼槽結算": settles animals in range, feeds them,
// and marks the 清潔 need from the pen's manure count.

import { CARE } from "../data/care_config.js";
import { FEEDS, KIND, KIND_TIER } from "../data/feeds.js";
import { SPECIES } from "../data/species.js";
import { ensureSettled, mark, isMarkedToday, cleanNeedEnabled } from "../care/state.js";
import {
  today, getState, setStates, animalsNear, countBlocksNear, blockGet, blockSet,
  mainhand, consumeMainhand, actionbar,
} from "../utils/world_util.js";
import { MANURE_BLOCK } from "./manure.js";
import { FEED_BAG, bagToTrough } from "../events/feed_bag.js";
import { T } from "../ui/text.js";
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
      mark(e, "fed", { fed_tier: KIND_TIER[kind] ?? 1 });
      fill--;
    }
  }
  if (fill !== getState(block, "fill")) setStates(block, { fill, kind: fill > 0 ? kind : KIND.EMPTY });
}

function showStatus(player, block) {
  const kind = getState(block, "kind");
  const fill = getState(block, "fill");
  actionbar(player, T("trough.status", [T(`kind.${kind}`), `${fill}`, `${CARE.TROUGH_CAPACITY}`]));
}

function interact(block, player) {
  const held = mainhand(player);
  if (held?.typeId === FEED_BAG) {
    bagToTrough(player, held, block);
    showStatus(player, block);
    return;
  }
  const feed = held && FEEDS[held.typeId];
  if (!feed) return showStatus(player, block);
  const n = itemsThatFit(block, feed, player.isSneaking ? held.amount : 1);
  if (n <= 0) {
    const kind = getState(block, "kind");
    actionbar(player, kind !== KIND.EMPTY && kind !== feed.kind ? T("trough.other_kind") : T("trough.full"));
    return;
  }
  addToTrough(block, feed.kind, n * feed.units);
  consumeMainhand(player, n);
  block.dimension.playSound("block.composter.fill", block.location);
  showStatus(player, block);
}

export const troughComponent = clockBlockEvents({
  onPlayerInteract({ block, player }) {
    if (player) interact(block, player);
  },
});
