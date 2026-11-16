// M3: the butcher rack. A carcass is hung on the rack and cut one stroke at a
// time with a kitchen knife (Cookery's tag), a sword or an axe. Each stroke
// gives the next entry of data/butcher.js; the last one empties the rack.

import { ItemStack } from "@minecraft/server";
import { DURABILITY_PER_STROKE, KNIFE_TAG, VANILLA_BLADE_TAGS } from "../data/butcher.js";
import { animalByCarcass, butcherEntry } from "../core/content.js";
import { clearBlockData, getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { rid } from "../core/ids.js";
import { emitRanchEvent } from "../core/events.js";
import { consumeMainHand, damageMainHand, dropItems, give, mainHand } from "../core/inventory.js";
import { CARCASS_MALE, CARCASS_WOOL } from "./carcass.js";

const STATE_CARCASS = "kaleidoscope_ranching:carcass";
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

function tell(player, key) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.rack.${key}` });
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

function setVisual(block, data) {
  let permutation = block.permutation;
  if (!data) {
    permutation = permutation.withState(STATE_CARCASS, "none").withState(STATE_CUT, false);
  } else {
    const cuts = cutsOf(data.carcass);
    permutation = permutation
      .withState(STATE_CARCASS, lookOf(data.carcass))
      .withState(STATE_CUT, data.stroke >= Math.ceil(cuts.length / 2));
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
  damageMainHand(player, DURABILITY_PER_STROKE);
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
    if (!data) {
      if (item && butcherEntry(item.typeId)) hang(block, player, item);
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

