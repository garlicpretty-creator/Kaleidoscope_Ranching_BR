// 拴畜樁 (hitching post): tie leashed animals to a post so they cannot wander.
//
// Use the post while leading animals: every animal you lead within 12 blocks
// is tied to it. Use it again with nothing leashed to you: the tied animals
// are handed back to you on their leads. Breaking the post drops the leads.
//
// ## Bedrock only lets entities hold leads, so each post keeps one invisible
// ## "hitch knot" entity (kaleidoscope_ranching:hitch_knot) on top of it and
// ## the animals are leashed to that. The knot's id is stored in block data.

import { system, world } from "@minecraft/server";
import { getBlockData, setBlockData, takeBlockData } from "../core/blockStore.js";
import { isRanchAnimal } from "../core/animal.js";
import { rid } from "../core/ids.js";

export const KNOT = rid("hitch_knot");
const GATHER_RADIUS = 12;

function tell(player, key, values) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.hitching_post.${key}`, with: values });
}

const knotSpot = (location) => ({ x: location.x + 0.5, y: location.y + 0.9, z: location.z + 0.5 });

function findKnot(block) {
  const id = getBlockData(block, {}).knot;
  const known = id && world.getEntity(id);
  if (known?.isValid) return known;
  // The stored id can be stale after a reload; look for a knot right on the post.
  return block.dimension.getEntities({ type: KNOT, location: knotSpot(block.location), maxDistance: 0.6 })[0];
}

function ensureKnot(block) {
  let knot = findKnot(block);
  if (!knot) knot = block.dimension.spawnEntity(KNOT, knotSpot(block.location));
  setBlockData(block, { knot: knot.id });
  return knot;
}

const leash = (entity) => entity.getComponent("minecraft:leashable");

/** Ranch animals within reach whose lead is held by `holder`. */
function ledBy(holder, dimension, location) {
  return dimension
    .getEntities({ location, maxDistance: GATHER_RADIUS })
    .filter((entity) => isRanchAnimal(entity) && leash(entity)?.leashHolder?.id === holder.id);
}

function use(block, player) {
  const led = ledBy(player, block.dimension, block.location);
  if (led.length) {
    const knot = ensureKnot(block);
    for (const animal of led) leash(animal).leashTo(knot);
    block.dimension.playSound("leashknot.place", block.location);
    return tell(player, "tied", [`${led.length}`]);
  }
  const knot = findKnot(block);
  const tied = knot ? ledBy(knot, block.dimension, block.location) : [];
  if (!tied.length) return tell(player, "empty");
  for (const animal of tied) leash(animal).leashTo(player);
  tell(player, "untied", [`${tied.length}`]);
}

function free(dimension, location, typeId) {
  const data = takeBlockData(dimension, location, null, typeId);
  const knot = (data?.knot && world.getEntity(data.knot)) || dimension.getEntities({ type: KNOT, location: knotSpot(location), maxDistance: 0.6 })[0];
  if (!knot?.isValid) return;
  const tied = ledBy(knot, dimension, location);
  // ## unleash() drops the lead item the way a snapped lead does; no extra drop.
  for (const animal of tied) leash(animal).unleash();
  knot.remove();
}

const brokenType = (event) => event.brokenBlockPermutation?.type?.id;

export const hitchingPostComponent = {
  onPlayerInteract({ block, player }) {
    if (player) system.run(() => use(block, player));
  },
  onPlayerBreak(event) {
    free(event.dimension ?? event.block.dimension, event.block.location, brokenType(event));
  },
  onBreak(event) {
    free(event.dimension ?? event.block.dimension, event.block.location, brokenType(event));
  },
};
