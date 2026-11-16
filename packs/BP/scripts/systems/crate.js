// 運畜籠 (animal crate): carry one animal as an item.
//
// Use an empty crate on a Ranching animal to pack it; use the full crate on a
// block to let it out on top of that block. The animal keeps its sex, name,
// age, wool colour, shearing, rabbit coat, saddle and every dynamic property
// (M2 affection, ear tag, pregnancy, M1 cooldowns), so packing and unpacking
// changes nothing but where it stands.
//
// ## Bedrock cannot store an entity in an item, so the crate records a
// ## snapshot in an item dynamic property (crates do not stack) and spawns a
// ## new entity on release. The new entity has a new id: pregnancy tracking and
// ## the M2 roster are moved to it.

import { ItemStack, system } from "@minecraft/server";
import { isBaby, isRanchAnimal, sexOf } from "../core/animal.js";
import { registerEntityInteraction } from "../core/interact.js";
import { mainHand } from "../core/inventory.js";
import { rid, shortId } from "../core/ids.js";
import { ANIMAL_NAMES } from "../data/items.js";
import { updateRoster } from "../ui/roster.js";
import { adoptPregnancy } from "./breeding.js";

export const CRATE = rid("animal_crate");
const SNAPSHOT = "kaleidoscope_ranching:crate";
const NAMES = new Map(ANIMAL_NAMES.map(([id, zh, en]) => [rid(id), `${zh} ${en}`]));

function tell(player, key, values) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.crate.${key}`, with: values });
}

const snapshotOf = (item) => {
  const raw = item?.typeId === CRATE ? item.getDynamicProperty(SNAPSHOT) : undefined;
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function busy(entity) {
  if (entity.getComponent("minecraft:leashable")?.isLeashed) return "leashed";
  if (entity.getComponent("minecraft:rideable")?.getRiders?.().length) return "ridden";
  return null;
}

/** Everything needed to bring the animal back. */
export function snapshot(entity) {
  const props = {};
  for (const id of entity.getDynamicPropertyIds()) props[id] = entity.getDynamicProperty(id);
  return {
    id: entity.id,
    type: entity.typeId,
    sex: sexOf(entity),
    baby: isBaby(entity),
    name: entity.nameTag || undefined,
    color: entity.getComponent("minecraft:color")?.value,
    sheared: entity.hasComponent("minecraft:is_sheared") || undefined,
    variant: entity.getComponent("minecraft:variant")?.value,
    saddled: entity.hasComponent("minecraft:is_saddled") || undefined,
    props,
  };
}

function pack(player, entity) {
  const reason = busy(entity);
  if (reason) return tell(player, reason);
  const data = snapshot(entity);
  const crate = new ItemStack(CRATE, 1);
  crate.setDynamicProperty(SNAPSHOT, JSON.stringify(data));
  crate.setLore([`§r§7${data.sex === "male" ? "♂" : "♀"} ${data.name ?? NAMES.get(data.type) ?? data.type}`]);
  mainHand(player).setItem(crate);
  entity.remove();
  player.dimension.playSound("block.barrel.close", player.location);
}

function tryEvent(entity, event) {
  try {
    entity.triggerEvent(event);
  } catch {}
}

/** Spawns the crated animal at `location`; returns the new entity. */
export function release(dimension, location, data) {
  const entity = dimension.spawnEntity(data.type, location);
  const ns = data.type.split(":")[0] === "kaleidoscope_ranching" ? "kaleidoscope_ranching" : null;
  tryEvent(entity, `kaleidoscope_ranching:set_${data.sex}`);
  if (data.baby) tryEvent(entity, "kaleidoscope_ranching:become_baby");
  if (ns && Number.isInteger(data.color)) tryEvent(entity, `${ns}:set_color_${data.color & 15}`);
  if (ns && data.sheared) tryEvent(entity, `${ns}:shear`);
  if (ns && Number.isInteger(data.variant)) tryEvent(entity, `${ns}:set_variant_${data.variant}`);
  if (ns && data.saddled) tryEvent(entity, `${ns}:on_saddled`);
  tryEvent(entity, "kaleidoscope_ranching:make_persistent");
  if (data.name) entity.nameTag = data.name;
  for (const [key, value] of Object.entries(data.props ?? {})) {
    try {
      entity.setDynamicProperty(key, value);
    } catch {}
  }
  adoptPregnancy(data.id, entity);
  try {
    updateRoster(entity);
  } catch {}
  return entity;
}

function unpack(player, block, face) {
  const item = mainHand(player)?.getItem();
  const data = snapshotOf(item);
  if (!data) return;
  const target = face === "Up" || !face ? block.above() : block;
  const spot = target && (target.isAir || target.isLiquid) ? target : block.above();
  if (!spot?.isAir && !spot?.isLiquid) return tell(player, "no_room");
  try {
    release(block.dimension, { x: spot.location.x + 0.5, y: spot.location.y, z: spot.location.z + 0.5 }, data);
  } catch {
    return tell(player, "missing", [shortId(data.type) ?? data.type]);
  }
  mainHand(player).setItem(new ItemStack(CRATE, 1));
  block.dimension.playSound("block.barrel.open", spot.location);
}

export const crateItemComponent = {
  onUseOn({ source, block, blockFace }) {
    if (source?.typeId === "minecraft:player" && block) system.run(() => unpack(source, block, blockFace));
  },
};

export function startCrates() {
  registerEntityInteraction({
    id: "m4:crate",
    priority: 10,
    match: ({ entity, item }) => item?.typeId === CRATE && !snapshotOf(item) && isRanchAnimal(entity),
    handle: ({ player, entity }) => pack(player, entity),
  });
}
