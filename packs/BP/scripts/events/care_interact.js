// Player ↔ animal care actions: 撫摸 (sneak + empty hand), 毛刷, 動物零食,
// 牧場記事本, 耳標. Clicks arrive through the shared interaction router; item
// use + view raycast is the fallback for clicks the router never sees.

import { world, system } from "@minecraft/server";
import { CARE } from "../data/care_config.js";
import { SPECIES } from "../data/species.js";
import { FAMILY_LIVESTOCK, EVENT_ADD_EAR_TAG } from "../data/m1_contract.js";
import { mark, addAffection, isMarkedToday, ensureSettled } from "../care/state.js";
import { consumeMainhand, damageMainhand, dropAt, actionbar } from "../utils/world_util.js";
import { showAnimal, showRoster } from "../ui/notebook.js";
import { nextTagNumber, updateRoster, removeFromRoster } from "../ui/roster.js";
import { T } from "../ui/text.js";
import { registerEntityInteraction } from "../core/interact.js";

const BRUSH = "kaleidoscope_ranching:brush";
const NOTEBOOK = "kaleidoscope_ranching:ranch_notebook";
const EAR_TAG = "kaleidoscope_ranching:ear_tag";
const TREATS = new Set(Object.values(SPECIES).map((s) => s.treat));
const TOOL_IDS = new Set([BRUSH, NOTEBOOK, EAR_TAG, ...TREATS]);

const lastHandled = new Map(); // player.id → tick, so one click acts once

function hearts(e) {
  e.dimension.spawnParticle("minecraft:heart_particle", {
    x: e.location.x, y: e.location.y + 1.2, z: e.location.z,
  });
}

function pet(player, e) {
  if (mark(e, "groom")) {
    hearts(e);
    actionbar(player, T("care.petted"));
  } else actionbar(player, T("care.already_groomed"));
}

function brush(player, e) {
  const first = mark(e, "groom");
  damageMainhand(player);
  e.dimension.playSound("mob.sheep.shear", e.location, { volume: 0.4, pitch: 1.6 });
  if (first) {
    hearts(e);
    for (const [item, chance] of SPECIES[e.typeId].brushDrops ?? []) {
      if (Math.random() < chance) dropAt(e.dimension, e.location, item, 1);
    }
    actionbar(player, T("care.brushed"));
  } else actionbar(player, T("care.already_groomed"));
}

function treat(player, e, itemId) {
  if (SPECIES[e.typeId].treat !== itemId) return actionbar(player, T("care.treat_wrong"));
  ensureSettled(e);
  if (isMarkedToday(e, "treat")) return actionbar(player, T("care.treat_full"));
  mark(e, "treat");
  addAffection(e, CARE.TREAT_GAIN);
  consumeMainhand(player, 1);
  hearts(e);
  e.dimension.playSound("random.eat", e.location);
}

function earTag(player, e) {
  if (e.getDynamicProperty("kr:ear_tag") !== undefined) return actionbar(player, T("care.ear_tag_already"));
  const n = nextTagNumber();
  e.setDynamicProperty("kr:ear_tag", n);
  if (!e.nameTag) e.nameTag = `#${String(n).padStart(3, "0")}`; // named mobs never despawn
  try {
    e.triggerEvent(EVENT_ADD_EAR_TAG);
  } catch {}
  ensureSettled(e);
  updateRoster(e);
  consumeMainhand(player, 1);
  actionbar(player, T("care.ear_tagged", [`${String(n).padStart(3, "0")}`]));
}

function act(player, e, itemId) {
  lastHandled.set(player.id, system.currentTick);
  if (!e?.isValid || !SPECIES[e.typeId]) return;
  if (!itemId) return pet(player, e);
  if (itemId === BRUSH) return brush(player, e);
  if (itemId === NOTEBOOK) return showAnimal(player, e);
  if (itemId === EAR_TAG) return earTag(player, e);
  if (TREATS.has(itemId)) return treat(player, e, itemId);
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
      const ok = item ? TOOL_IDS.has(item.typeId) : player.isSneaking;
      if (ok) lastHandled.set(player.id, system.currentTick);
      return ok;
    },
    handle: ({ player, entity, item }) => act(player, entity, item?.typeId),
  });

  // Fallback / in-air use.
  world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
    if (!player || !itemStack || !TOOL_IDS.has(itemStack.typeId) || handledThisTick(player)) return;
    const hit = player
      .getEntitiesFromViewDirection({ maxDistance: 5, families: [FAMILY_LIVESTOCK] })
      .find((h) => SPECIES[h.entity.typeId]);
    if (hit) return act(player, hit.entity, itemStack.typeId);
    if (itemStack.typeId === NOTEBOOK) showRoster(player);
  });

  // Hurt lowers affection (rate-limited).
  world.afterEvents.entityHurt.subscribe(({ hurtEntity: e }) => {
    if (!SPECIES[e.typeId] || !e.isValid) return;
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
