// Player ↔ animal care actions: 撫摸 (sneak + empty hand), 毛刷, 動物零食,
// 牧場記事本, 耳標. Clicks arrive through the shared interaction router; item
// use + view raycast is the fallback for clicks the router never sees.

import { world, system } from "@minecraft/server";
import { CARE } from "../data/care_config.js";
import { SPECIES, isTreat } from "../data/species.js";
import { FAMILY_LIVESTOCK, EVENT_ADD_EAR_TAG } from "../data/m1_contract.js";
import { mark, addAffection, isMarkedToday, ensureSettled } from "../care/state.js";
import { consumeMainhand, damageMainhand, dropAt } from "../utils/world_util.js";
import { showAnimal, showRoster } from "../ui/notebook.js";
import { nextTagNumber, updateRoster, removeFromRoster } from "../ui/roster.js";
import { AMBIENT, cue, refuse } from "../core/feedback.js";
import { registerEntityInteraction } from "../core/interact.js";
import { notifyCared } from "../core/husbandry.js";

const BRUSH = "kaleidoscope_ranching:brush";
const NOTEBOOK = "kaleidoscope_ranching:ranch_notebook";
const EAR_TAG = "kaleidoscope_ranching:ear_tag";
const TOOLS = new Set([BRUSH, NOTEBOOK, EAR_TAG]);
// ## Treats are looked up each time: animals registered through the public
// ## API bring their own.
const isTool = (id) => TOOLS.has(id) || isTreat(id);

const lastHandled = new Map(); // player.id → tick, so one click acts once

function hearts(e) {
  e.dimension.spawnParticle("minecraft:heart_particle", {
    x: e.location.x, y: e.location.y + 1.2, z: e.location.z,
  });
}

function pet(player, e) {
  if (mark(e, "groom")) {
    hearts(e);
    notifyCared(e, player, "pet");
    cue(e, AMBIENT[e.typeId], { pitch: 1.2, volume: 0.6 });
  } else refuse(player, e); // already groomed today
}

function brush(player, e) {
  const first = mark(e, "groom");
  damageMainhand(player);
  e.dimension.playSound("mob.sheep.shear", e.location, { volume: 0.4, pitch: 1.6 });
  if (first) {
    hearts(e);
    notifyCared(e, player, "brush");
    for (const [item, chance] of SPECIES[e.typeId].brushDrops ?? []) {
      if (Math.random() < chance) dropAt(e.dimension, e.location, item, 1);
    }
  } else refuse(player, e); // already groomed today
}

function treat(player, e, itemId) {
  if (SPECIES[e.typeId].treat !== itemId) return refuse(player, e); // not this animal's treat
  ensureSettled(e);
  if (isMarkedToday(e, "treat")) return refuse(player, e); // had its treat today
  mark(e, "treat");
  addAffection(e, CARE.TREAT_GAIN);
  consumeMainhand(player, 1);
  hearts(e);
  notifyCared(e, player, "treat");
  e.dimension.playSound("random.eat", e.location);
}

function earTag(player, e) {
  if (e.getDynamicProperty("kr:ear_tag") !== undefined) return refuse(player, e); // already tagged
  const n = nextTagNumber();
  e.setDynamicProperty("kr:ear_tag", n);
  if (!e.nameTag) e.nameTag = `#${String(n).padStart(3, "0")}`; // named mobs never despawn
  try {
    e.triggerEvent(EVENT_ADD_EAR_TAG);
  } catch {}
  ensureSettled(e);
  updateRoster(e);
  consumeMainhand(player, 1);
  notifyCared(e, player, "ear_tag");
  // The tag shows on the ear (EVENT_ADD_EAR_TAG) and its number in the name tag.
  cue(e, "block.itemframe.add_item", { particle: "minecraft:villager_happy", y: 1.2 });
}

function act(player, e, itemId) {
  lastHandled.set(player.id, system.currentTick);
  if (!e?.isValid || !SPECIES[e.typeId]) return;
  if (!itemId) return pet(player, e);
  if (itemId === BRUSH) return brush(player, e);
  if (itemId === NOTEBOOK) return showAnimal(player, e);
  if (itemId === EAR_TAG) return earTag(player, e);
  if (isTreat(itemId)) return treat(player, e, itemId);
}

function handledThisTick(player) {
  return system.currentTick - (lastHandled.get(player.id) ?? -10) < 2;
}

export function registerCareInteractions() {
  // ## Through the shared router (core/interact.js) so one click never
  // ## triggers both an M2 action and M1 breeding or M3 milking. The router
  // ## runs `handle` one tick later; marking the player in `match` keeps the
  // ## item-use fallback below from acting on the same click.
  registerEntityInteraction({
    id: "m2:care",
    priority: 100,
    match: ({ player, entity, item }) => {
      if (!SPECIES[entity.typeId]) return false;
      const ok = item ? isTool(item.typeId) : player.isSneaking;
      if (ok) lastHandled.set(player.id, system.currentTick);
      return ok;
    },
    handle: ({ player, entity, item }) => act(player, entity, item?.typeId),
  });

  // Fallback / in-air use.
  world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
    if (!player || !itemStack || !isTool(itemStack.typeId) || handledThisTick(player)) return;
    const hit = player
      .getEntitiesFromViewDirection({ maxDistance: 5, families: [FAMILY_LIVESTOCK] })
      .find((h) => SPECIES[h.entity.typeId]);
    if (hit) return act(player, hit.entity, itemStack.typeId);
    if (itemStack.typeId === NOTEBOOK) showRoster(player);
  });

  // Hurt lowers affection (rate-limited).
  world.afterEvents.entityHurt.subscribe(({ hurtEntity: e }) => {
    if (!e?.isValid || !SPECIES[e.typeId]) return;
    const now = system.currentTick;
    const last = e.getDynamicProperty("kr:hurt_t") ?? -Infinity;
    if (now - last < CARE.HURT_COOLDOWN_TICKS && now >= last) return;
    e.setDynamicProperty("kr:hurt_t", now);
    addAffection(e, -CARE.HURT_LOSS);
  });

  // Tagged animal died → drop it from the roster.
  world.afterEvents.entityDie.subscribe(({ deadEntity: e }) => {
    try {
      const tag = e.getDynamicProperty("kr:ear_tag");
      if (tag !== undefined) removeFromRoster(tag);
    } catch {}
  });
}
