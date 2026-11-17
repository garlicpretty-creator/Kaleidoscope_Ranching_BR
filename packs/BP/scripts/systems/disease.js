// 1.1 疾病與獸醫 (企劃書 1.1 十、健康與系列整合).
//
// - Once a game day, for each Ranching animal near a player: if it has gone
//   two days without water, or (with M2's clean need on) its pen was not clean
//   yesterday or today, it falls ill with SICK_CHANCE. Soap used on it today
//   protects it from the dirt, not from thirst.
// - A sick animal gives no milk or eggs and does not breed (core/husbandry.js),
//   and its affection does not rise (care/state.js). It never dies of it.
// - 獸藥 (veterinary medicine) — or a remedy another add-on registered — cures it.
// - 肥皂 (soap): used on an animal it counts as groomed today and keeps the
//   dirt away for the day.
// - `/scriptevent kaleidoscope_ranching:config disease off` (or the notebook)
//   turns illness off and cures every sick animal it meets.

import { system, world } from "@minecraft/server";
import { isRanchAnimal } from "../core/animal.js";
import { registerClockTask } from "../core/clock.js";
import { emitRanchEvent } from "../core/events.js";
import { dp, rid } from "../core/ids.js";
import { registerEntityInteraction } from "../core/interact.js";
import { consumeMainHand } from "../core/inventory.js";
import { today } from "../core/time.js";
import { refuse } from "../core/feedback.js";
import { cleanNeedEnabled, mark, readRecord } from "../care/state.js";

export const SICK_CHANCE = 0.2;
export const SICK = dp("sick");
export const CFG_DISEASE = "kr:cfg:disease";
const CHECKED_DAY = dp("disease_day");
const SOAPED_DAY = dp("soaped_day");
const RANGE = 64;

/** Remedies: item id → true. Built-in medicine, plus register_remedy from other add-ons. */
const REMEDIES = new Set([rid("vet_medicine")]);

export function registerRemedy(itemId) {
  if (REMEDIES.has(itemId)) return false;
  REMEDIES.add(itemId);
  return true;
}

export const diseaseEnabled = () => world.getDynamicProperty(CFG_DISEASE) !== false;

export function isSick(animal) {
  try {
    return animal.getDynamicProperty(SICK) === true;
  } catch {
    return false;
  }
}


/** What puts this animal at risk today: "thirst", "dirt" or null. */
export function riskOf(animal, day = today()) {
  const rec = readRecord(animal);
  if (typeof rec.water_day === "number" && day - rec.water_day >= 2) return "thirst";
  if (cleanNeedEnabled() && animal.getDynamicProperty(SOAPED_DAY) !== day) {
    if (typeof rec.clean_day === "number" && day - rec.clean_day >= 2) return "dirt";
  }
  return null;
}

/** The animal's daily check. Returns true if it fell ill now. */
export function checkHealth(animal, roll = Math.random()) {
  const day = today();
  if (animal.getDynamicProperty(CHECKED_DAY) === day) return false;
  animal.setDynamicProperty(CHECKED_DAY, day);
  if (!diseaseEnabled()) {
    if (isSick(animal)) cure(animal, "config");
    return false;
  }
  if (isSick(animal) || !riskOf(animal, day) || roll >= SICK_CHANCE) return false;
  animal.setDynamicProperty(SICK, true);
  emitRanchEvent("fell_ill", { animal: animal.typeId, entity: animal.id, cause: riskOf(animal, day) });
  return true;
}

export function cure(animal, by = "remedy") {
  if (!isSick(animal)) return false;
  animal.setDynamicProperty(SICK, undefined);
  emitRanchEvent("cured", { animal: animal.typeId, entity: animal.id, by });
  return true;
}

export function checkHealthNearPlayers() {
  const seen = new Set();
  for (const player of world.getAllPlayers()) {
    let entities = [];
    try {
      entities = player.dimension.getEntities({ location: player.location, maxDistance: RANGE });
    } catch {}
    for (const animal of entities) {
      if (seen.has(animal.id) || !isRanchAnimal(animal)) continue;
      seen.add(animal.id);
      checkHealth(animal);
    }
  }
}

function treat(player, animal, item) {
  if (!isSick(animal)) return refuse(player, animal); // not sick
  cure(animal, item);
  consumeMainHand(player);
  try {
    animal.dimension.spawnParticle("minecraft:heart_particle", { ...animal.location, y: animal.location.y + 1 });
  } catch {}
}

export function soap(player, animal) {
  animal.setDynamicProperty(SOAPED_DAY, today());
  mark(animal, "groom");
  consumeMainHand(player);
  try {
    animal.dimension.playSound("bucket.empty_water", animal.location);
  } catch {}
}

export function startDisease() {
  registerClockTask("disease", checkHealthNearPlayers);
  // /scriptevent kaleidoscope_ranching:config disease off
  system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
    if (id !== "kaleidoscope_ranching:config") return;
    const [key, value] = message.trim().split(/\s+/);
    if (key === "disease") world.setDynamicProperty(CFG_DISEASE, !["off", "false", "0"].includes(value));
  });
  registerEntityInteraction({
    id: "m11:remedy",
    priority: 40,
    match: ({ entity, item }) => Boolean(item) && REMEDIES.has(item.typeId) && isRanchAnimal(entity),
    handle: ({ player, entity, item }) => treat(player, entity, item.typeId),
  });
  registerEntityInteraction({
    id: "m11:soap",
    priority: 40,
    match: ({ entity, item }) => item?.typeId === rid("soap") && isRanchAnimal(entity),
    handle: ({ player, entity }) => soap(player, entity),
  });
}
