// 1.1 追加 草場與放牧 (docs/1.1_追加企劃書.md 一).
//
// A pasture post is a clock block (core/blockClock.js). On each clock pass it
// feeds the grazing animals in range that have not eaten today, as hay-tier
// feed, from "today's grass": the grass blocks in range, counted once a day.
// It is defined after the troughs and hay racks, so an animal with better feed
// in reach eats that first. Every GRASS_PER_DIRT blocks eaten, one grass block
// turns to dirt; vanilla grass spreads back over it. A pasture left alone for
// more than REST_DAYS days is rested: animals fed there that day gain extra
// affection. Pasture seed turns a 3×3 patch of dirt back into grass at once.
//
// ## Overlapping posts: an animal eats at the first post the clock visits that
// ## still has grass; it is marked fed, so a second post does not feed it again.
// ## The count and what was eaten live in the post's block data:
// ## { day, grass, eaten, trampled, lastGrazedDay, rested }.

import { BlockVolume, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ensureSettled, isMarkedToday, mark, addAffection } from "../care/state.js";
import { clockBlockEvents, defineClockBlock, startBlockClock } from "../core/blockClock.js";
import { getBlockData, setBlockData } from "../core/blockStore.js";
import { playAction } from "../core/actions.js";
import { emitRanchEvent } from "../core/events.js";
import { rid } from "../core/ids.js";
import { isBaby } from "../core/animal.js";
import { consumeMainHand, mainHand } from "../core/inventory.js";
import { today } from "../core/time.js";
import { KIND, KIND_TIER } from "../data/feeds.js";
import { CFG_PASTURE, GRAZED_DAY, PASTURE, PASTURE_GRASS_TAG, grazeOf } from "../data/pasture.js";
import { T, lines } from "../ui/text.js";
import { animalsNear } from "../utils/world_util.js";

export const PASTURE_POST = rid("pasture_post");
export const PASTURE_SEED = rid("pasture_seed");
const NOTEBOOK = rid("ranch_notebook");
const GRASS = "minecraft:grass_block";
const DIRT = "minecraft:dirt";

export const pastureEnabled = () => world.getDynamicProperty(CFG_PASTURE) !== false;

function volume(block) {
  const { x, y, z } = block.location;
  const r = PASTURE.RADIUS;
  const h = PASTURE.HALF_HEIGHT;
  return new BlockVolume({ x: x - r, y: y - h, z: z - r }, { x: x + r, y: y + h, z: z + r });
}

function locations(block, filter) {
  try {
    return [...block.dimension.getBlocks(volume(block), filter, false).getBlockLocationIterator()];
  } catch {
    return [];
  }
}

/** Grass blocks in range, and other add-ons' blocks tagged as pasture grass. */
function grassIn(block) {
  const grass = locations(block, { includeTypes: [GRASS] });
  // ## A tag filter is checked block by block as well: an API that ignores the
  // ## filter would otherwise count every block in range.
  const tagged = locations(block, { includeTags: [PASTURE_GRASS_TAG] }).filter((at) => {
    try {
      const found = block.dimension.getBlock(at);
      return found?.typeId !== GRASS && found?.hasTag?.(PASTURE_GRASS_TAG) === true;
    } catch {
      return false;
    }
  });
  return { grass, total: grass.length + tagged.length };
}

/** Today's record for the post, counting the grass on the first visit of a day. */
function dayRecord(block, day) {
  const data = getBlockData(block, {}) ?? {};
  if (data.day === day) return data;
  const rested = typeof data.lastGrazedDay === "number" && day - data.lastGrazedDay > PASTURE.REST_DAYS;
  return { day, grass: grassIn(block).total, eaten: 0, trampled: data.trampled ?? 0, lastGrazedDay: data.lastGrazedDay, rested };
}

/** Turns `count` grass blocks in range into dirt, picked at random. */
function trample(block, count) {
  const grass = grassIn(block).grass;
  for (let i = 0; i < count && grass.length; i++) {
    const at = grass.splice(Math.floor(Math.random() * grass.length), 1)[0];
    try {
      block.dimension.getBlock(at)?.setType(DIRT);
    } catch {
      // unloaded: the grass stays, which only favours the player
    }
  }
}

function standsOnGrass(e) {
  try {
    const { x, y, z } = e.location;
    return e.dimension.getBlock({ x: Math.floor(x), y: Math.floor(y) - 1, z: Math.floor(z) })?.typeId === GRASS;
  } catch {
    return false;
  }
}

const isDay = () => world.getTimeOfDay() < 12000;

/** One clock pass. Returns how many animals it fed (tests). */
export function tickPasture(block, random = Math.random) {
  if (!pastureEnabled()) return 0;
  const animals = animalsNear(block, PASTURE.RADIUS);
  if (!animals.length) return 0;
  const day = today();
  const data = dayRecord(block, day);
  let left = data.grass - data.eaten;
  let ate = 0;
  let fed = 0;
  for (const e of animals) {
    const need = grazeOf(e.typeId, isBaby(e));
    if (!need) continue;
    ensureSettled(e, day);
    if (isMarkedToday(e, "fed")) {
      // Already fed: now and then it is seen grazing where it stands.
      if (e.getDynamicProperty(GRAZED_DAY) === day && isDay() && random() < PASTURE.GRAZE_ANIM_CHANCE && standsOnGrass(e)) playAction(e, "graze");
      continue;
    }
    if (left < need) continue;
    mark(e, "fed", { fed_tier: KIND_TIER[KIND.GRASS] ?? 1, fed_kind: KIND.GRASS });
    e.setDynamicProperty(GRAZED_DAY, day);
    if (data.rested) addAffection(e, PASTURE.REST_BONUS);
    playAction(e, "graze");
    emitRanchEvent("grazed", { animal: e.typeId, entity: e.id, post: { ...block.location }, grass: need });
    left -= need;
    ate += need;
    fed++;
  }
  if (ate > 0) {
    const trampled = (data.trampled ?? 0) + ate;
    trample(block, Math.floor(trampled / PASTURE.GRASS_PER_DIRT));
    data.trampled = trampled % PASTURE.GRASS_PER_DIRT;
    data.eaten += ate;
    data.lastGrazedDay = day;
  }
  setBlockData(block, data);
  return fed;
}

function showStatus(player, block) {
  const day = today();
  const data = getBlockData(block, {}) ?? {};
  const counted = data.day === day;
  const grass = counted ? data.grass : grassIn(block).total;
  const eaten = counted ? data.eaten : 0;
  const rested = counted ? data.rested : typeof data.lastGrazedDay === "number" && day - data.lastGrazedDay > PASTURE.REST_DAYS;
  const body = pastureEnabled()
    ? lines(T("pasture.grass", [`${grass}`, `${eaten}`]), T(rested ? "pasture.rested" : "pasture.not_rested"))
    : lines(T("pasture.off"));
  new ActionFormData().title(T("pasture.title")).body(body).button(T("notebook.close")).show(player).catch(() => {});
}

export const pasturePostComponent = clockBlockEvents({
  onPlayerInteract({ block, player }) {
    if (player && mainHand(player)?.getItem()?.typeId === NOTEBOOK) showStatus(player, block);
  },
});

/** Pasture seed: a 3×3 patch of dirt around the block used on turns back into grass. */
export function sowPasture(player, block) {
  if (block?.typeId !== DIRT) return 0;
  let sown = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      try {
        const target = block.dimension.getBlock({ x: block.location.x + dx, y: block.location.y, z: block.location.z + dz });
        if (target?.typeId !== DIRT) continue;
        target.setType(GRASS);
        sown++;
      } catch {
        // unloaded
      }
    }
  }
  if (!sown) return 0;
  consumeMainHand(player, 1); // not in creative
  block.dimension.playSound("item.bone_meal.use", block.location);
  return sown;
}

export const pastureSeedItemComponent = {
  onUseOn({ source, block }) {
    if (source?.typeId === "minecraft:player") system.run(() => sowPasture(source, block));
  },
};

export function startPastures() {
  defineClockBlock(PASTURE_POST, "pasture_posts", tickPasture);
  startBlockClock();
}
