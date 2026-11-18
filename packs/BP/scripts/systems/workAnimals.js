// 1.1 役用與牧場管理 (企劃書 1.1 九、役用與牧場管理), plus the harness and the
// animal blanket from the leather and cloth lines.
//
// - 挽具 (harness): use it on an adult buffalo with HARNESS_HEARTS or more.
//   Shears take the harness (and a plough) off again.
// - 犁 (plough): use it on a harnessed buffalo to hitch it, again to unhitch.
//   While a player leads the buffalo on a lead, the ground under it and on its
//   two sides becomes farmland as it walks (grass, dirt or path, with air above).
// - 動物披毯 (animal blanket): use it on a cow, sheep, goat, pig or buffalo; the
//   animal no longer feels the cold at night (systems/sleep.js).
// - 牧笛 (herding horn): use it on a hitching post to make that post your rally
//   point; use it on a tamed wolf of yours to make it a sheepdog; blow it to
//   send your sheepdogs out: Ranching animals within HERD_RADIUS of a dog are
//   driven toward the rally point until they are within RALLY_RADIUS. The horn
//   also wakes sleeping animals around you.
// - 畜欄門 (pen gate): two blocks tall; it opens while a player stands within
//   GATE_REACH and shuts behind them, so animals cannot follow out.
//
// ## Herding pushes animals with impulses from a script rather than using the
// ## vanilla AI, and touches at most HERD_LIMIT animals per pass.

import { BlockPermutation, system, world } from "@minecraft/server";
import { isBaby, isRanchAnimal } from "../core/animal.js";
import { emitRanchEvent } from "../core/events.js";
import { getAffection } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { registerEntityInteraction } from "../core/interact.js";
import { consumeMainHand, dropItems, give } from "../core/inventory.js";
import { BLANKET, wakeNear } from "./sleep.js";
import { animalByType } from "../core/content.js";
import { showGear, startGear } from "../core/gear.js";
import { GEAR } from "../data/gear.js";

/** The buffalo, or an animal another add-on registered with `harness: true`. */
const takesHarness = (entity) => entity.typeId === BUFFALO || animalByType(entity.typeId)?.harness === true;
import { cue, refuse } from "../core/feedback.js";

export const HARNESS_HEARTS = 3;
export const HERD_RADIUS = 24;
export const RALLY_RADIUS = 4;
export const HERD_LIMIT = 16;
export const HERD_TICKS = 600;
export const GATE_REACH = 2;
const PLOUGH_INTERVAL = 10;
const HERD_INTERVAL = 10;
const GATE_INTERVAL = 4;
const HERD_PUSH = 0.3;
const DOG_PUSH = 0.4;

export const HARNESSED = dp("harnessed");
export const PLOUGHING = dp("ploughing");
export const SHEEPDOG_OF = dp("sheepdog_of");
const RALLY = dp("rally");
const PLOUGH_LIST = "kaleidoscope_ranching:ploughing_buffalo";

const BUFFALO = rid("buffalo");
const BLANKETED = GEAR.find((gear) => gear.id === "blanket").animals.map(rid);
const TILLABLE = ["minecraft:grass_block", "minecraft:dirt", "minecraft:grass_path", "minecraft:dirt_path"];
const GATE = rid("pen_gate");
const GATE_TOP = rid("pen_gate_top");
const OPEN = "kaleidoscope_ranching:open";


const leashHolder = (entity) => {
  try {
    return entity.getComponent("minecraft:leashable")?.leashHolder;
  } catch {
    return undefined;
  }
};

// --- Harness and plough ---------------------------------------------------------

function ploughingIds() {
  try {
    return JSON.parse(world.getDynamicProperty(PLOUGH_LIST) ?? "[]");
  } catch {
    return [];
  }
}
function savePloughing(ids) {
  world.setDynamicProperty(PLOUGH_LIST, JSON.stringify(ids.slice(-64)));
}

export function harness(player, buffalo) {
  if (isBaby(buffalo)) return refuse(player, buffalo);
  if (buffalo.getDynamicProperty(HARNESSED)) return refuse(player, buffalo);
  if (getAffection(buffalo) < HARNESS_HEARTS) return refuse(player, buffalo); // not close enough yet
  buffalo.setDynamicProperty(HARNESSED, true);
  showGear(buffalo, "harness", true);
  consumeMainHand(player);
  buffalo.dimension.playSound("mob.horse.armor", buffalo.location);
}

export function hitchPlough(player, buffalo) {
  if (!buffalo.getDynamicProperty(HARNESSED)) return refuse(player, buffalo); // harness first
  const ids = ploughingIds();
  if (buffalo.getDynamicProperty(PLOUGHING)) {
    buffalo.setDynamicProperty(PLOUGHING, undefined);
    showGear(buffalo, "plough", false);
    savePloughing(ids.filter((id) => id !== buffalo.id));
    give(player, rid("plough"));
    return cue(buffalo, "mob.horse.armor", { pitch: 0.8 });
  }
  buffalo.setDynamicProperty(PLOUGHING, true);
  showGear(buffalo, "plough", true);
  savePloughing([...ids.filter((id) => id !== buffalo.id), buffalo.id]);
  consumeMainHand(player);
  cue(buffalo, "mob.horse.armor");
}

/** An animal let out of a crate (systems/crate.js) is a new entity: put it back on the
 *  ploughing list in place of the one that went into the crate. */
export function resumePloughing(animal, oldId) {
  const ids = ploughingIds().filter((id) => id !== oldId && id !== animal.id);
  if (animal.getDynamicProperty(PLOUGHING) === true) ids.push(animal.id);
  savePloughing(ids);
}

function unharness(player, buffalo) {
  if (buffalo.getDynamicProperty(PLOUGHING)) hitchPlough(player, buffalo);
  buffalo.setDynamicProperty(HARNESSED, undefined);
  showGear(buffalo, "harness", false);
  give(player, rid("harness"));
  cue(buffalo, "mob.horse.leather", { pitch: 0.8 });
}

/** Tills the ground under a led, ploughing buffalo and on its two sides. Returns the blocks tilled. */
export function plough(buffalo) {
  const holder = leashHolder(buffalo);
  if (holder?.typeId !== "minecraft:player") return 0;
  const view = buffalo.getViewDirection();
  const length = Math.hypot(view.x, view.z) || 1;
  const side = { x: -view.z / length, z: view.x / length };
  const { x, y, z } = buffalo.location;
  let tilled = 0;
  for (const offset of [-1, 0, 1]) {
    const at = { x: Math.floor(x + side.x * offset), y: Math.floor(y) - 1, z: Math.floor(z + side.z * offset) };
    try {
      const ground = buffalo.dimension.getBlock(at);
      const above = buffalo.dimension.getBlock({ ...at, y: at.y + 1 });
      if (!ground || !TILLABLE.includes(ground.typeId) || (above && !above.isAir)) continue;
      ground.setType("minecraft:farmland");
      tilled++;
    } catch {}
  }
  return tilled;
}

const lastSpot = new Map();

function ploughAll() {
  for (const id of ploughingIds()) {
    const buffalo = world.getEntity(id);
    if (!buffalo?.isValid) continue;
    const spot = `${Math.floor(buffalo.location.x)},${Math.floor(buffalo.location.z)}`;
    if (lastSpot.get(id) === spot) continue;
    lastSpot.set(id, spot);
    plough(buffalo);
  }
}

// --- Blanket --------------------------------------------------------------------

export function putBlanket(player, animal) {
  if (animal.getDynamicProperty(BLANKET)) return refuse(player, animal);
  animal.setDynamicProperty(BLANKET, true);
  showGear(animal, "blanket", true);
  consumeMainHand(player);
  cue(animal, "armor.equip_leather");
}

// --- Herding horn and sheepdogs -----------------------------------------------------

const herds = new Map(); // player id → { rally, until, herded:Set }

const isTamedBy = (wolf, player) => {
  try {
    const tame = wolf.getComponent("minecraft:tameable");
    return tame?.isTamed === true && tame.tamedToPlayerId === player.id;
  } catch {
    return false;
  }
};

export function makeSheepdog(player, wolf) {
  if (!isTamedBy(wolf, player)) return refuse(player, wolf); // not your dog
  wolf.setDynamicProperty(SHEEPDOG_OF, player.id);
  cue(wolf, "mob.wolf.bark", { particle: "minecraft:heart_particle" });
}

export function setRally(player, block) {
  const { x, y, z } = block.location;
  player.setDynamicProperty(RALLY, JSON.stringify({ x: x + 0.5, y, z: z + 0.5, d: block.dimension.id }));
  cue(block, "random.orb", { particle: "minecraft:villager_happy", y: 0.6 });
}

function rallyOf(player) {
  try {
    const rally = JSON.parse(player.getDynamicProperty(RALLY) ?? "null");
    return rally && rally.d === player.dimension.id ? rally : null;
  } catch {
    return null;
  }
}

export function blowHorn(player) {
  player.dimension.playSound("horn.call.0", player.location);
  wakeNear(player.dimension, player.location, 32, "horn");
  const rally = rallyOf(player);
  if (!rally) return refuse(player); // no rally point set
  herds.set(player.id, { rally, until: system.currentTick + HERD_TICKS, herded: new Set() });
}

const flat = (from, to) => {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dz);
  return { dx, dz, d };
};

/** One herding pass for one player. Returns the number of animals still out, or -1 when the herd ended. */
export function herdStep(player) {
  const herd = herds.get(player.id);
  if (!herd) return -1;
  const dogs = player.dimension
    .getEntities({ type: "minecraft:wolf", location: player.location, maxDistance: 48 })
    .filter((wolf) => wolf.getDynamicProperty(SHEEPDOG_OF) === player.id);
  if (!dogs.length) {
    herds.delete(player.id);
    refuse(player); // no sheepdog of yours near
    return -1;
  }
  const out = [];
  const seen = new Set();
  for (const dog of dogs) {
    for (const animal of dog.dimension.getEntities({ location: dog.location, maxDistance: HERD_RADIUS })) {
      if (out.length >= HERD_LIMIT || seen.has(animal.id) || !isRanchAnimal(animal) || leashHolder(animal)) continue;
      seen.add(animal.id);
      if (flat(animal.location, herd.rally).d > RALLY_RADIUS) out.push(animal);
    }
  }
  if (!out.length || system.currentTick > herd.until) {
    herds.delete(player.id);
    cue(dogs[0], "mob.wolf.bark"); // the herd is in
    return -1;
  }
  let farthest = out[0];
  for (const animal of out) {
    const { dx, dz, d } = flat(animal.location, herd.rally);
    animal.applyImpulse({ x: (dx / d) * HERD_PUSH, y: 0, z: (dz / d) * HERD_PUSH });
    if (!herd.herded.has(animal.id)) {
      herd.herded.add(animal.id);
      emitRanchEvent("herded", { animal: animal.typeId, entity: animal.id, player: player.id });
    }
    if (d > flat(farthest.location, herd.rally).d) farthest = animal;
  }
  for (const dog of dogs) {
    const { dx, dz, d } = flat(dog.location, farthest.location);
    if (d > 1.5) dog.applyImpulse({ x: (dx / d) * DOG_PUSH, y: 0, z: (dz / d) * DOG_PUSH });
  }
  return out.length;
}

function herdAll() {
  for (const id of [...herds.keys()]) {
    const player = world.getEntity(id);
    if (!player?.isValid) herds.delete(id);
    else herdStep(player);
  }
}

let rallyTick = -1;

export const hornItemComponent = {
  onUseOn({ source, block }) {
    if (source?.typeId !== "minecraft:player" || block?.typeId !== rid("hitching_post")) return;
    rallyTick = system.currentTick;
    system.run(() => setRally(source, block));
  },
  onUse({ source }) {
    if (source?.typeId !== "minecraft:player") return;
    system.run(() => {
      if (rallyTick !== system.currentTick && rallyTick !== system.currentTick - 1) blowHorn(source);
    });
  },
};

// --- Pen gate -------------------------------------------------------------------

const openGates = new Map(); // key → { dimension, location }
const keyOf = (dimension, { x, y, z }) => `${dimension.id}|${x},${y},${z}`;

function setGate(block, open) {
  try {
    block.setPermutation(block.permutation.withState(OPEN, open));
    const top = block.above();
    if (top?.typeId === GATE_TOP) top.setPermutation(top.permutation.withState(OPEN, open));
  } catch {}
}

/** Opens gates within GATE_REACH of each player and shuts the rest. */
export function tendGates() {
  const near = new Set();
  for (const player of world.getAllPlayers()) {
    const { x, y, z } = player.location;
    for (let dx = -GATE_REACH; dx <= GATE_REACH; dx++) {
      for (let dz = -GATE_REACH; dz <= GATE_REACH; dz++) {
        for (let dy = -1; dy <= 0; dy++) {
          let block;
          try {
            block = player.dimension.getBlock({ x: Math.floor(x) + dx, y: Math.floor(y) + dy, z: Math.floor(z) + dz });
          } catch {}
          if (block?.typeId !== GATE) continue;
          const key = keyOf(block.dimension, block.location);
          near.add(key);
          if (!openGates.has(key)) {
            setGate(block, true);
            openGates.set(key, { dimension: block.dimension, location: block.location });
          }
        }
      }
    }
  }
  for (const [key, gate] of openGates) {
    if (near.has(key)) continue;
    openGates.delete(key);
    try {
      const block = gate.dimension.getBlock(gate.location);
      if (block?.typeId === GATE) setGate(block, false);
    } catch {}
  }
}

export const penGateComponent = {
  beforeOnPlayerPlace(event) {
    const above = event.block.above();
    if (above && !above.isAir) event.cancel = true;
  },
  onPlace({ block }) {
    try {
      block.above()?.setPermutation(BlockPermutation.resolve(GATE_TOP, { [OPEN]: false }));
    } catch {}
  },
  onPlayerBreak({ block }) {
    const top = block.above();
    if (top?.typeId === GATE_TOP) top.setType("minecraft:air");
  },
};

// The top half drops nothing itself; breaking it takes the gate with it and drops the gate once.
export const penGateTopComponent = {
  onPlayerBreak({ block }) {
    const bottom = block.below();
    if (bottom?.typeId !== GATE) return;
    bottom.setType("minecraft:air");
    const { x, y, z } = bottom.location;
    dropItems(block.dimension, GATE, 1, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  },
};

// --- Wiring ---------------------------------------------------------------------

export function startWorkAnimals() {
  const held = (id) => (ctx) => ctx.item?.typeId === rid(id);
  registerEntityInteraction({ id: "m10:harness", priority: 40, match: (c) => held("harness")(c) && takesHarness(c.entity), handle: ({ player, entity }) => harness(player, entity) });
  registerEntityInteraction({ id: "m10:plough", priority: 40, match: (c) => held("plough")(c) && takesHarness(c.entity), handle: ({ player, entity }) => hitchPlough(player, entity) });
  registerEntityInteraction({
    id: "m10:unharness",
    priority: 40,
    match: (c) => c.item?.typeId === "minecraft:shears" && takesHarness(c.entity) && c.entity.getDynamicProperty(HARNESSED) === true,
    handle: ({ player, entity }) => unharness(player, entity),
  });
  registerEntityInteraction({ id: "m10:blanket", priority: 40, match: (c) => held("animal_blanket")(c) && BLANKETED.includes(c.entity.typeId), handle: ({ player, entity }) => putBlanket(player, entity) });
  registerEntityInteraction({ id: "m10:sheepdog", priority: 40, match: (c) => held("herding_horn")(c) && c.entity.typeId === "minecraft:wolf", handle: ({ player, entity }) => makeSheepdog(player, entity) });
  startGear();
  system.runInterval(ploughAll, PLOUGH_INTERVAL);
  system.runInterval(herdAll, HERD_INTERVAL);
  system.runInterval(tendGates, GATE_INTERVAL);
}
