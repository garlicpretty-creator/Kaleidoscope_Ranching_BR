// M3: milking pail and nursing bottle.
//
// Milking pail: once per game day on an adult female whose daily product is
// milked (data/animals.js `dailyProduct.via === "milking_pail"`). Each milking
// fills one empty glass bottle from the player's inventory with that animal's
// milk (no quality grades). The vanilla bucket still works as before.
// Sneaking milks every ready female close by in one use (milkAll).
//
// Nursing bottle: a reusable tool. Feeding a baby mammal uses one bottle of any
// milk from the inventory and gives the glass bottle
// back. Three feedings make the baby grow up.

import { ITEMS } from "../data/items.js";
import { NURSING_FEEDS_TO_GROW } from "../data/animals.js";
import { isBaby, isFemale, speciesOf } from "../core/animal.js";
import { notifyCared, production } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { registerEntityInteraction } from "../core/interact.js";
import { damageMainHand, give, mainHand, takeItems } from "../core/inventory.js";
import { system } from "@minecraft/server";
import { today } from "../core/time.js";
import { emitRanchEvent } from "../core/events.js";
import { AMBIENT, cue, refuse } from "../core/feedback.js";
import { isAsleep, wakeUp } from "./sleep.js";
import { wearing } from "./textiles.js";
import { isGrowthPaused } from "./growth.js";

const PAIL = rid("milking_pail");
const BOTTLE = rid("nursing_bottle");
export const LAST_MILKED_DAY = dp("last_milked_day");
export const NURSING_FEEDS = dp("nursing_feeds");

// 1.1: skim milk from the cream separator feeds babies too, before whole milk.
export const MILK_FOR_FEEDING = [rid("skim_milk"), ...ITEMS.filter((item) => item.category === "milk").map((item) => rid(item.id))];


/** The milk an animal gives (one item: products have no quality grades). */
export function milkOf(species) {
  return rid(species.dailyProduct.item);
}

/** Whether a pail would milk this animal now (the player's bottles aside). */
function ready(animal, day = today()) {
  if (!animal?.isValid || speciesOf(animal)?.dailyProduct?.via !== "milking_pail") return false;
  if (isBaby(animal) || !isFemale(animal)) return false;
  if (animal.getDynamicProperty(LAST_MILKED_DAY) === day) return false;
  return production(animal, day).produces; // no milk today otherwise (a sick animal)
}

/** Milks one animal that is ready: an empty bottle in, a bottle of her milk out. False with no bottle. */
function milkOne(player, animal, day = today()) {
  const species = speciesOf(animal);
  if (!takeItems(player, ["minecraft:glass_bottle"], 1)) return false; // no empty bottle

  animal.setDynamicProperty(LAST_MILKED_DAY, day);
  // 1.1 動物作息: milking a sleeping animal wakes her, unless the player wears
  // leather gloves (皮手套) in the off hand. (Milk has no quality grades.)
  if (isAsleep(animal) && !wearing(player, "Offhand", "leather_gloves")) wakeUp(animal, "milked");
  const bottle = rid(species.dailyProduct.item);
  give(player, bottle);
  emitRanchEvent("harvested", { animal: animal.typeId, entity: animal.id, product: "milk", items: { [bottle]: 1 } });
  damageMainHand(player);
  animal.dimension.playSound("mob.cow.milk", animal.location);
  return true;
}

// Sneaking with the pail milks every ready female within MILK_ALL_RADIUS blocks of the one used,
// nearest first, one bottle each, MILK_GAP ticks apart (one milking sound after another), while
// the player still holds the pail and has empty bottles.
export const MILK_ALL_RADIUS = 3;
export const MILK_GAP = 5;

function milkAll(player, first) {
  const day = today();
  const { x, y, z } = first.location;
  const near = first.dimension
    .getEntities({ location: first.location, maxDistance: MILK_ALL_RADIUS })
    .filter((entity) => entity !== first && ready(entity, day))
    .sort((a, b) => (a.location.x - x) ** 2 + (a.location.y - y) ** 2 + (a.location.z - z) ** 2 - ((b.location.x - x) ** 2 + (b.location.y - y) ** 2 + (b.location.z - z) ** 2));
  const herd = ready(first, day) ? [first, ...near] : near;
  if (!herd.length) return refuse(player, first);
  if (!milkOne(player, herd[0], day)) return refuse(player); // no empty bottle
  herd.slice(1).forEach((animal, i) => {
    system.runTimeout(() => {
      if (!player.isValid || mainHand(player)?.getItem()?.typeId !== PAIL) return;
      if (ready(animal)) milkOne(player, animal);
    }, MILK_GAP * (i + 1));
  });
}

function milk(player, animal) {
  if (player.isSneaking) return milkAll(player, animal);
  if (!ready(animal)) return refuse(player, animal); // a male, a baby, milked today or no milk today
  if (!milkOne(player, animal)) refuse(player); // no empty bottle
}

function nurse(player, baby) {
  if (isGrowthPaused(baby)) return refuse(player, baby); // a golden dandelion keeps it small
  if (!takeItems(player, MILK_FOR_FEEDING, 1)) return refuse(player); // no milk to give
  give(player, "minecraft:glass_bottle");
  damageMainHand(player);
  notifyCared(baby, player, "nursing_bottle");

  const feeds = (baby.getDynamicProperty(NURSING_FEEDS) ?? 0) + 1;
  const { x, y, z } = baby.location;
  try {
    baby.dimension.spawnParticle("minecraft:heart_particle", { x, y: y + 0.6, z });
  } catch {}
  if (feeds >= NURSING_FEEDS_TO_GROW) {
    baby.setDynamicProperty(NURSING_FEEDS, undefined);
    baby.triggerEvent("kaleidoscope_ranching:grow_up");
    cue(baby, AMBIENT[baby.typeId], { particle: "minecraft:villager_happy", y: 1.2 });
  } else {
    baby.setDynamicProperty(NURSING_FEEDS, feeds);
  }
}

export function startMilking() {
  registerEntityInteraction({
    id: "m3:milking",
    priority: 50,
    match: ({ entity, item }) => item?.typeId === PAIL && speciesOf(entity)?.dailyProduct?.via === "milking_pail",
    handle: ({ player, entity }) => milk(player, entity),
  });

  registerEntityInteraction({
    id: "m3:nursing",
    priority: 50,
    match: ({ entity, item }) => item?.typeId === BOTTLE && speciesOf(entity)?.reproduction === "gestation" && isBaby(entity),
    handle: ({ player, entity }) => nurse(player, entity),
  });
}
