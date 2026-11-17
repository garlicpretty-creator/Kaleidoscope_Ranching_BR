// 飼料袋: holds up to 64 units of one feed kind.
//   sneak + use in the air → gather that kind of feed from your inventory
//   use on a trough        → pour it in (handled by the trough's interact)

import { CARE } from "../data/care_config.js";
import { FEEDS, KIND } from "../data/feeds.js";
import { addToTrough } from "../custom_components/trough.js";
import { setMainhand, getState } from "../utils/world_util.js";
import { cue, refuse, levelPitch } from "../core/feedback.js";

export const FEED_BAG = "kaleidoscope_ranching:feed_bag";

function read(bag) {
  return {
    kind: bag.getDynamicProperty("kr:bag_kind") ?? KIND.EMPTY,
    units: bag.getDynamicProperty("kr:bag_units") ?? 0,
  };
}
function write(player, bag, kind, units) {
  bag.setDynamicProperty("kr:bag_kind", units > 0 ? kind : KIND.EMPTY);
  bag.setDynamicProperty("kr:bag_units", units);
  bag.setLore([`§7${units} / ${CARE.FEED_BAG_CAPACITY}`]);
  setMainhand(player, bag);
}
/** The bag rustles, higher the fuller it is (its lore holds the count); an empty bag says no. */
function rustle(player, units) {
  if (units <= 0) return refuse(player);
  try {
    player.playSound("block.composter.fill", { pitch: levelPitch(units, CARE.FEED_BAG_CAPACITY), volume: 0.6 });
  } catch {}
}

/** Pours the bag into a trough; returns false when nothing went in (empty bag, full trough, other feed). */
export function bagToTrough(player, bag, trough) {
  const { kind, units } = read(bag);
  const accepted = units > 0 ? addToTrough(trough, kind, units) : 0;
  if (accepted <= 0) {
    refuse(player);
    return false;
  }
  write(player, bag, kind, units - accepted);
  cue(trough, "block.composter.fill", { pitch: levelPitch(getState(trough, "fill"), CARE.TROUGH_CAPACITY) });
  return true;
}

export function gatherIntoBag(player, bag) {
  let { kind, units } = read(bag);
  const before = units;
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  for (let i = 0; i < inv.size && units < CARE.FEED_BAG_CAPACITY; i++) {
    if (i === player.selectedSlotIndex) continue;
    const s = inv.getItem(i);
    const feed = s && FEEDS[s.typeId];
    if (!feed) continue;
    if (kind !== KIND.EMPTY && feed.kind !== kind) continue;
    const n = Math.min(s.amount, Math.floor((CARE.FEED_BAG_CAPACITY - units) / feed.units));
    if (n <= 0) continue;
    kind = feed.kind;
    units += n * feed.units;
    if (s.amount > n) {
      s.amount -= n;
      inv.setItem(i, s);
    } else inv.setItem(i, undefined);
  }
  write(player, bag, kind, units);
  if (units > before) rustle(player, units);
  else refuse(player);
}

export const feedBagComponent = {
  onUse({ source, itemStack }) {
    if (!source || !itemStack) return;
    if (source.isSneaking) gatherIntoBag(source, itemStack);
    else rustle(source, read(itemStack).units);
  },
};
