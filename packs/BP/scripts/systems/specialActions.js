// 1.1 追加 新動物的招牌動作 (docs/1.1_追加企劃書.md 四、沉浸式動畫): the turkey's display, the
// quail's dust bath and the alpaca's spit. Each only sets the synced `action` property
// (core/actions.js); the resource pack draws it (tools/gen_actions.mjs). The alpaca's head
// shake is client only and needs nothing here.
//
// - 開屏 display: on each ranch-clock pass, every adult tom within DISPLAY_RANGE of a player
//   fans out with DISPLAY_CHANCE.
// - 沙浴 dust bath: on each pass in the daytime, every quail (chicks too) within DUST_BATH_RANGE
//   of a player that stands on sand or dirt bathes with DUST_BATH_CHANCE; a little dust rises at
//   each roll while a player is near enough to see it.
// - 吐口水 spit: an alpaca hit by a player spits at that player: a sound and a line of spit
//   particles from its mouth to the player's face. No damage.
//
// ## Only the players' surroundings are searched, by type, once per clock pass (30 s); the
// ## spit rides the entityHurt event. An animal asleep or already playing an action is left alone.

import { system, world } from "@minecraft/server";
import { playAction } from "../core/actions.js";
import { isBaby, sexOf } from "../core/animal.js";
import { registerClockTask } from "../core/clock.js";
import { cue, seenBy } from "../core/feedback.js";
import { rid } from "../core/ids.js";
import {
  ACTION_PROPERTY, DISPLAY_CHANCE, DISPLAY_RANGE, DUST_BATH_BLOCKS, DUST_BATH_CHANCE, DUST_BATH_RANGE, DUST_PUFFS,
  PARTICLE_RANGE, SPIT_COOLDOWN_TICKS, SPIT_PARTICLE, SPIT_SOUND, SPIT_STEPS,
} from "../data/actions.js";

const TURKEY = rid("turkey");
const QUAIL = rid("quail");
const ALPACA = rid("alpaca");
/** Below this horizontal speed (blocks per tick) an animal counts as standing still. */
const STILL = 0.02;
const lastSpit = new Map(); // alpaca id → tick of its last spit

const isDay = () => world.getTimeOfDay() < 12000;

function idle(entity) {
  try {
    if (entity.getProperty(ACTION_PROPERTY) !== "none") return false;
    const v = entity.getVelocity?.();
    return !v || Math.hypot(v.x, v.z) < STILL;
  } catch {
    return false;
  }
}

/** Animals of `type` within `range` of any player, each once. */
function nearPlayers(type, range) {
  const seen = new Map();
  for (const player of world.getAllPlayers()) {
    let found = [];
    try {
      found = player.dimension.getEntities({ type, location: player.location, maxDistance: range });
    } catch {}
    for (const entity of found) seen.set(entity.id, entity);
  }
  return [...seen.values()];
}

/** The bath block under an animal, or undefined. */
export function bathBlock(entity) {
  try {
    const { x, y, z } = entity.location;
    const id = entity.dimension.getBlock({ x: Math.floor(x), y: Math.floor(y) - 1, z: Math.floor(z) })?.typeId;
    return DUST_BATH_BLOCKS[id] ? id : undefined;
  } catch {
    return undefined;
  }
}

/** 開屏: adult toms near a player now and then fan out. Returns how many did. */
export function displayNearPlayers(random = Math.random) {
  let shown = 0;
  for (const tom of nearPlayers(TURKEY, DISPLAY_RANGE)) {
    if (isBaby(tom) || sexOf(tom) !== "male" || !idle(tom) || random() >= DISPLAY_CHANCE) continue;
    if (playAction(tom, "display")) shown++;
  }
  return shown;
}

/** A puff of dust at the bather's feet, if a player is near enough to see it. */
function puff(quail, particle) {
  if (!quail.isValid || quail.getProperty(ACTION_PROPERTY) !== "dust_bath") return;
  const { x, y, z } = quail.location;
  if (!seenBy(quail.dimension, quail.location, PARTICLE_RANGE)) return;
  for (const [dx, dz] of [[0.2, 0], [-0.2, 0.1], [0, -0.2]]) {
    try {
      quail.dimension.spawnParticle(particle, { x: x + dx, y: y + 0.25, z: z + dz });
    } catch {}
  }
}

/** Starts a dust bath with its dust. Returns false when the quail cannot bathe now. */
export function dustBath(quail) {
  const block = bathBlock(quail);
  if (!block || !playAction(quail, "dust_bath")) return false;
  for (const at of DUST_PUFFS) {
    system.runTimeout(() => {
      try {
        puff(quail, DUST_BATH_BLOCKS[block]);
      } catch {}
    }, Math.round(at * 20));
  }
  return true;
}

/** 沙浴: in the daytime, quails on sand or dirt near a player now and then bathe. Returns how many did. */
export function dustBathNearPlayers(random = Math.random) {
  if (!isDay()) return 0;
  let bathed = 0;
  for (const quail of nearPlayers(QUAIL, DUST_BATH_RANGE)) {
    if (!idle(quail) || !bathBlock(quail) || random() >= DUST_BATH_CHANCE) continue;
    if (dustBath(quail)) bathed++;
  }
  return bathed;
}

const mouthOf = (alpaca) => ({ x: alpaca.location.x, y: alpaca.location.y + (isBaby(alpaca) ? 0.9 : 1.4), z: alpaca.location.z });
const faceOf = (player) => ({ x: player.location.x, y: player.location.y + 1.5, z: player.location.z });

/** 吐口水: the alpaca turns to the player and spits (sound and particles only). Returns true when it spat. */
export function spitAt(alpaca, player) {
  if (!alpaca?.isValid || !player?.isValid) return false;
  const now = system.currentTick;
  const last = lastSpit.get(alpaca.id);
  if (last !== undefined && now - last >= 0 && now - last < SPIT_COOLDOWN_TICKS) return false;
  const from = mouthOf(alpaca);
  const to = faceOf(player);
  if (Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) > PARTICLE_RANGE) return false;
  if (!playAction(alpaca, "spit")) return false;
  lastSpit.set(alpaca.id, now);
  try {
    // Face the player (yaw 0 looks along +z).
    alpaca.setRotation({ x: 0, y: (Math.atan2(-(to.x - from.x), to.z - from.z) * 180) / Math.PI });
  } catch {}
  cue(alpaca, SPIT_SOUND, { y: 1.2 });
  // The spit leaves as the head thrusts forward (0.45 s into the animation) and flies one step a tick.
  const LEAVE = 9;
  for (let i = 1; i <= SPIT_STEPS; i++) {
    const k = i / SPIT_STEPS;
    system.runTimeout(() => {
      try {
        alpaca.dimension.spawnParticle(SPIT_PARTICLE, { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, z: from.z + (to.z - from.z) * k });
      } catch {}
    }, LEAVE + i);
  }
  return true;
}

export function startSpecialActions() {
  registerClockTask("special_actions", () => {
    displayNearPlayers();
    dustBathNearPlayers();
  });
  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
    if (hurtEntity?.typeId !== ALPACA) return;
    const attacker = damageSource?.damagingEntity;
    if (attacker?.typeId !== "minecraft:player") return;
    // A tick later: a sleeping alpaca has been woken by then (its property is set by an event).
    system.run(() => spitAt(hurtEntity, attacker));
  });
  world.afterEvents.entityRemove?.subscribe(({ removedEntityId }) => lastSpit.delete(removedEntityId));
}
