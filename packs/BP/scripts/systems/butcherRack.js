// M3: the butcher rack. A carcass is hung on the rack and cut one stroke at a
// time with a kitchen knife (Cookery's tag), a sword or an axe. Each stroke
// gives the next entry of data/butcher.js; the last one empties the rack.
//
// 1.1 掛架風乾: an empty rack also air-dries up to DRYING_SLOTS pieces
// (data/processing.js DRYING). Each piece keeps its own start time; using the
// rack takes down every piece that is done. A drying rack takes no carcass.

import { ItemStack } from "@minecraft/server";
import { DURABILITY_PER_STROKE, KNIFE_TAG, VANILLA_BLADE_TAGS } from "../data/butcher.js";
import { DRYING, DRYING_SLOTS, DRYING_TICKS } from "../data/processing.js";
import { animalByCarcass, butcherEntry } from "../core/content.js";
import { clearBlockData, getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { rid, shortId } from "../core/ids.js";
import { nowTick } from "../core/time.js";
import { emitRanchEvent } from "../core/events.js";
import { consumeMainHand, damageMainHand, dropItems, give, mainHand } from "../core/inventory.js";
import { CARCASS_MALE, CARCASS_WOOL } from "./carcass.js";
import { showActionBar } from "../core/actionBar.js";
import { APRON_SAVE_CHANCE, wearing } from "./textiles.js";

const STATE_CARCASS = "kaleidoscope_ranching:carcass";
const STATE_SKINNED = "kaleidoscope_ranching:skinned";
const STATE_CUT = "kaleidoscope_ranching:cut";

const WOOL_COLORS = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];

// ## The rack's carcass state lists the built-in animals. A carcass from
// ## another add-on (api/ranchingApi.js) borrows one of those looks: the
// ## `look` it registered, else a cow for large carcasses and a chicken for small.
const LOOKS = new Set(["cow", "sheep", "goat", "pig", "chicken", "rabbit", "duck", "goose", "buffalo", "yak"]);

/** Cuts for a carcass (full item id); data saved by older builds used short ids. */
function cutsOf(carcass) {
  return butcherEntry(rid(carcass))?.cuts ?? [];
}

function lookOf(carcass) {
  const animal = animalByCarcass(rid(carcass));
  if (animal && LOOKS.has(animal.id)) return animal.id;
  const look = butcherEntry(rid(carcass))?.look;
  if (LOOKS.has(look)) return look;
  return animal?.largeCarcass === false ? "chicken" : "cow";
}

function tell(player, key, values) {
  showActionBar(player, { translate: `kaleidoscope_ranching.message.rack.${key}`, with: values });
}

// --- 1.1 掛架風乾 ---------------------------------------------------------------

const TICKS_PER_MINUTE = 1200;

/** The dried result for a held item, or undefined if it cannot be dried. */
export function dryingResult(typeId) {
  if (!typeId?.startsWith("kaleidoscope_ranching:")) return undefined;
  const out = DRYING[shortId(typeId)];
  return out ? rid(out) : undefined;
}

function hangToDry(block, player, item, data) {
  const pieces = data?.drying ?? [];
  if (pieces.length >= DRYING_SLOTS) return tell(player, "drying_full", [String(DRYING_SLOTS)]);
  pieces.push({ item: item.typeId, start: nowTick() });
  consumeMainHand(player);
  setBlockData(block, { drying: pieces });
  block.dimension.playSound("block.itemframe.add_item", block.location);
  tell(player, "drying_hung", [String(pieces.length), String(DRYING_SLOTS)]);
}

/** Takes down every finished piece; reports the time left on the rest. */
function takeDown(block, player, data) {
  const now = nowTick();
  const left = [];
  let taken = 0;
  for (const piece of data.drying) {
    if (now >= piece.start + DRYING_TICKS) {
      const out = dryingResult(piece.item);
      if (out) give(player, out, 1);
      taken++;
    } else left.push(piece);
  }
  if (left.length) setBlockData(block, { drying: left });
  else clearBlockData(block.dimension, block.location);
  if (taken) block.dimension.playSound("random.pop", block.location);
  if (!left.length) return;
  const soonest = Math.min(...left.map((piece) => piece.start + DRYING_TICKS - now));
  tell(player, "drying_left", [String(left.length), String(Math.ceil(soonest / TICKS_PER_MINUTE))]);
}

export function isBlade(item) {
  if (!item) return false;
  return item.hasTag(KNIFE_TAG) || VANILLA_BLADE_TAGS.some((tag) => item.hasTag(tag));
}

/** Whether a cut applies to this carcass at all. */
function applies(cut, data) {
  if (cut.maleOnly && !data.male) return false;
  if (cut.ifUnshorn && data.wool === undefined) return false;
  return true;
}

/** Index of the next applicable cut at or after `from`, or -1. */
function nextCut(cuts, data, from) {
  for (let i = from; i < cuts.length; i++) if (applies(cuts[i], data)) return i;
  return -1;
}

/** Rolls the items one cut yields: [{ typeId, amount }]. */
export function rollCut(cut, data) {
  if (cut.chance !== undefined && Math.random() >= cut.chance) return [];
  const [min, max] = cut.count;
  let amount = min + Math.floor(Math.random() * (max - min + 1));
  if (data.male && cut.maleBonus) amount += cut.maleBonus;
  let typeId = rid(cut.item);
  if (cut.ifUnshorn) typeId = `minecraft:${WOOL_COLORS[(data.wool ?? 0) & 15]}_wool`;
  return amount > 0 ? [{ typeId, amount }] : [];
}

/** Strokes that take the hide, wool or feathers: the carcass shows skinned from this stroke on.
 *  Carcasses from other add-ons that mark no skin cut count their first stroke as the skin. */
export function skinStrokes(cuts) {
  let last = -1;
  cuts.forEach((cut, i) => { if (cut.skin) last = i; });
  return last + 1 || 1;
}

/** Visual stage of a hanging carcass: whole with its skin, skinned, or partly cut. */
export function stageOf(cuts, stroke) {
  const skinned = stroke >= skinStrokes(cuts);
  const cut = stroke >= Math.max(skinStrokes(cuts) + 1, Math.ceil(cuts.length / 2));
  return { skinned: skinned || cut, cut };
}

function setVisual(block, data) {
  let permutation = block.permutation;
  if (!data) {
    permutation = permutation.withState(STATE_CARCASS, "none").withState(STATE_SKINNED, false).withState(STATE_CUT, false);
  } else {
    const { skinned, cut } = stageOf(cutsOf(data.carcass), data.stroke);
    permutation = permutation
      .withState(STATE_CARCASS, lookOf(data.carcass))
      .withState(STATE_SKINNED, skinned)
      .withState(STATE_CUT, cut);
  }
  block.setPermutation(permutation);
}

function hang(block, player, item) {
  const carcass = item.typeId;
  const data = { carcass, stroke: 0, male: false };
  try {
    data.male = item.getDynamicProperty(CARCASS_MALE) === true;
    const wool = item.getDynamicProperty(CARCASS_WOOL);
    if (typeof wool === "number") data.wool = wool;
  } catch {}
  data.stroke = Math.max(0, nextCut(cutsOf(carcass), data, 0));
  consumeMainHand(player);
  setBlockData(block, data);
  setVisual(block, data);
  block.dimension.playSound("block.itemframe.add_item", block.location);
}

function cut(block, player, data) {
  const cuts = cutsOf(data.carcass);
  for (const { typeId, amount } of rollCut(cuts[data.stroke], data)) give(player, typeId, amount);
  // 1.1 皮圍裙: a leather apron sometimes spares the blade.
  if (!(wearing(player, "Chest", "leather_apron") && Math.random() < APRON_SAVE_CHANCE)) damageMainHand(player, DURABILITY_PER_STROKE);
  block.dimension.playSound("dig.cloth", block.location);

  const next = nextCut(cuts, data, data.stroke + 1);
  if (next < 0) {
    clearBlockData(block.dimension, block.location);
    setVisual(block, null);
    emitRanchEvent("butchered", { carcass: rid(data.carcass) });
    return;
  }
  data.stroke = next;
  setBlockData(block, data);
  setVisual(block, data);
}

/** Drops what is still on a broken rack: the whole carcass, or the remaining cuts. */
function spill(dimension, location, typeId) {
  const data = takeBlockData(dimension, location, null, typeId);
  if (!data) return;
  const at = { x: location.x + 0.5, y: location.y + 0.5, z: location.z + 0.5 };
  if (data.drying) {
    // Finished pieces drop dried; the rest drop as they went up.
    const now = nowTick();
    for (const piece of data.drying) {
      const done = now >= piece.start + DRYING_TICKS;
      dropItems(dimension, done ? dryingResult(piece.item) ?? piece.item : piece.item, 1, at);
    }
    return;
  }
  if (data.stroke === nextCut(cutsOf(data.carcass), data, 0)) {
    const carcass = new ItemStack(rid(data.carcass), 1);
    try {
      carcass.setDynamicProperty(CARCASS_MALE, data.male);
      if (data.wool !== undefined) carcass.setDynamicProperty(CARCASS_WOOL, data.wool);
    } catch {}
    dimension.spawnItem(carcass, at);
    return;
  }
  const cuts = cutsOf(data.carcass);
  for (let i = data.stroke; i >= 0 && i < cuts.length; i = nextCut(cuts, data, i + 1)) {
    for (const { typeId, amount } of rollCut(cuts[i], data)) dropItems(dimension, typeId, amount, at);
  }
}

export const butcherRackComponent = {
  beforeOnPlayerPlace(event) {
    // The rack is two blocks tall; it needs free space above.
    const above = event.block.above();
    if (above && !above.isAir) event.cancel = true;
  },

  onPlayerInteract({ block, player }) {
    if (!player) return;
    const item = mainHand(player)?.getItem();
    const data = getBlockData(block);
    if (data?.drying) {
      if (item && dryingResult(item.typeId)) {
        // Take down whatever is done first, so a full rack makes room by itself.
        if (data.drying.some((piece) => nowTick() >= piece.start + DRYING_TICKS)) return takeDown(block, player, data);
        return hangToDry(block, player, item, data);
      }
      if (item && butcherEntry(item.typeId)) return tell(player, "drying_busy");
      return takeDown(block, player, data);
    }
    if (!data) {
      if (item && butcherEntry(item.typeId)) hang(block, player, item);
      else if (item && dryingResult(item.typeId)) hangToDry(block, player, item, null);
      else tell(player, "empty");
      return;
    }
    if (item && butcherEntry(item.typeId)) return tell(player, "occupied");
    if (!isBlade(item)) return tell(player, "need_blade");
    cut(block, player, data);
  },

  onPlayerBreak({ block, dimension, brokenBlockPermutation }) {
    spill(dimension ?? block.dimension, block.location, brokenBlockPermutation?.type?.id);
  },

  onBreak({ block, dimension, brokenBlockPermutation }) {
    spill(dimension ?? block.dimension, block.location, brokenBlockPermutation?.type?.id);
  },
};

