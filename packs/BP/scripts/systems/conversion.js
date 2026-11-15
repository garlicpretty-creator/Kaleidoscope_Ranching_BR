// M1: replaces vanilla cows, sheep, goats, pigs, chickens and rabbits with
// their Ranching counterparts, keeping what the player would notice.
//
// ## Vanilla spawn rules keep spawning vanilla animals; each one is swapped the
// ## moment it appears (spawn) or is read from disk (load). Existing worlds are
// ## converted chunk by chunk as they load. Sex is decided by the Ranching
// ## entity's own spawn event (50/50).

import { system, world } from "@minecraft/server";
import { ANIMALS } from "../data/animals.js";
import { rid } from "../core/ids.js";

const VANILLA_TO_RANCH = new Map(ANIMALS.filter((animal) => animal.replaces).map((animal) => [animal.replaces, rid(animal.id)]));

const EVENT = (name) => `kaleidoscope_ranching:${name}`;

// ## A thrown vanilla egg can hatch a chick. Ranching chicks only come from
// ## fertilized eggs, so chicks that appear where an egg just broke are removed
// ## instead of converted. Egg impacts are remembered for a few ticks.
const EGG_MEMORY_TICKS = 10;
const EGG_RADIUS = 3;
const recentEggHits = [];

function rememberEgg(event) {
  try {
    if (event.projectile?.typeId !== "minecraft:egg") return;
  } catch {
    return;
  }
  recentEggHits.push({ dimension: event.dimension.id, location: event.location, tick: system.currentTick });
  while (recentEggHits.length > 32) recentEggHits.shift();
}

function hatchedFromThrownEgg(entity) {
  const now = system.currentTick;
  const { x, y, z } = entity.location;
  return recentEggHits.some(
    (hit) =>
      now - hit.tick <= EGG_MEMORY_TICKS &&
      hit.dimension === entity.dimension.id &&
      (hit.location.x - x) ** 2 + (hit.location.y - y) ** 2 + (hit.location.z - z) ** 2 <= EGG_RADIUS ** 2
  );
}

function readSnapshot(entity) {
  const snapshot = {
    dimension: entity.dimension,
    location: entity.location,
    rotation: entity.getRotation(),
    nameTag: entity.nameTag,
    baby: entity.hasComponent("minecraft:is_baby"),
    sheared: entity.hasComponent("minecraft:is_sheared"),
    saddled: entity.hasComponent("minecraft:is_saddled"),
    color: undefined,
    variant: undefined,
    leashHolder: undefined,
  };
  try {
    snapshot.color = entity.getComponent("minecraft:color")?.value;
  } catch {}
  try {
    snapshot.variant = entity.getComponent("minecraft:variant")?.value;
  } catch {}
  try {
    snapshot.leashHolder = entity.getComponent("minecraft:leashable")?.leashHolder;
  } catch {}
  return snapshot;
}

function convert(vanilla, cause) {
  if (!vanilla?.isValid) return;
  const target = VANILLA_TO_RANCH.get(vanilla.typeId);
  if (!target) return;

  const snapshot = readSnapshot(vanilla);
  if (vanilla.typeId === "minecraft:chicken" && snapshot.baby && cause !== "Loaded" && hatchedFromThrownEgg(vanilla)) {
    vanilla.remove();
    return;
  }

  let ranch;
  try {
    ranch = snapshot.dimension.spawnEntity(target, snapshot.location);
  } catch (error) {
    // Spawning can fail at the edge of a loading chunk; try again on next load.
    console.warn(`[kaleidoscope_ranching] could not convert ${vanilla.typeId}: ${error}`);
    return;
  }
  vanilla.remove();

  ranch.setRotation(snapshot.rotation);
  if (snapshot.nameTag) ranch.nameTag = snapshot.nameTag;
  if (snapshot.baby) ranch.triggerEvent(EVENT("become_baby"));
  if (Number.isInteger(snapshot.color) && target === rid("sheep")) ranch.triggerEvent(EVENT(`set_color_${snapshot.color & 15}`));
  if (snapshot.sheared && target === rid("sheep")) ranch.triggerEvent(EVENT("shear"));
  if (Number.isInteger(snapshot.variant) && target === rid("rabbit")) {
    ranch.triggerEvent(EVENT(`set_variant_${Math.max(0, Math.min(5, snapshot.variant))}`));
  }
  if (snapshot.saddled && target === rid("pig")) ranch.triggerEvent(EVENT("on_saddled"));
  if (snapshot.leashHolder?.isValid) {
    try {
      ranch.getComponent("minecraft:leashable")?.leashTo(snapshot.leashHolder);
    } catch {}
  }
  // ## Animals the player clearly cared about must not despawn after conversion.
  if (snapshot.nameTag || snapshot.leashHolder || snapshot.baby || snapshot.saddled) {
    ranch.triggerEvent(EVENT("make_persistent"));
  }
}

function convertLater(entity, cause) {
  let typeId;
  try {
    typeId = entity.typeId;
  } catch {
    return;
  }
  if (!VANILLA_TO_RANCH.has(typeId)) return;
  system.run(() => convert(entity, cause));
}

export function startConversion() {
  world.afterEvents.projectileHitBlock.subscribe(rememberEgg);
  world.afterEvents.projectileHitEntity.subscribe(rememberEgg);
  world.afterEvents.entitySpawn.subscribe((event) => convertLater(event.entity, String(event.cause)));
  world.afterEvents.entityLoad.subscribe((event) => convertLater(event.entity, "Loaded"));
  world.afterEvents.worldLoad.subscribe(() => {
    for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
      const dimension = world.getDimension(dimensionId);
      for (const typeId of VANILLA_TO_RANCH.keys()) {
        for (const entity of dimension.getEntities({ type: typeId })) convertLater(entity, "Loaded");
      }
    }
  });
}
