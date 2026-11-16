// M3: milking pail and nursing bottle.
//
// Milking pail: once per game day on an adult female whose daily product is
// milked (data/animals.js `dailyProduct.via === "milking_pail"`). Each milking
// fills one empty glass bottle from the player's inventory with milk of the
// quality M2 reports for today. The vanilla bucket still works as before.
//
// Nursing bottle: a reusable tool. Feeding a baby mammal uses one bottle of any
// milk from the inventory (lowest quality first) and gives the glass bottle
// back. Three feedings make the baby grow up.

import { ITEMS, tierIds } from "../data/items.js";
import { NURSING_FEEDS_TO_GROW } from "../data/animals.js";
import { isBaby, isFemale, speciesOf } from "../core/animal.js";
import { notifyCared, production } from "../core/husbandry.js";
import { dp, rid } from "../core/ids.js";
import { registerEntityInteraction } from "../core/interact.js";
import { damageMainHand, give, takeItems } from "../core/inventory.js";
import { today } from "../core/time.js";
import { emitRanchEvent } from "../core/events.js";

const PAIL = rid("milking_pail");
const BOTTLE = rid("nursing_bottle");
export const LAST_MILKED_DAY = dp("last_milked_day");
const NURSING_FEEDS = dp("nursing_feeds");

const TIER_INDEX = { plain: 0, fine: 1, superb: 2 };

const tierOf = (id) => (id.endsWith("_superb") ? 2 : id.endsWith("_fine") ? 1 : 0);

// Plain milk first, so feeding uses the cheapest milk the player carries.
// 1.1: skim milk from the cream separator feeds babies too, before whole milk.
const MILK_FOR_FEEDING = [rid("skim_milk"), ...ITEMS.filter((item) => item.category === "milk")
  .map((item) => item.id)
  .sort((a, b) => tierOf(a) - tierOf(b))
  .map(rid)];

function tell(player, key) {
  player.onScreenDisplay.setActionBar({ translate: `kaleidoscope_ranching.message.${key}` });
}

export function milkTiers(species) {
  const product = species.dailyProduct;
  return (product.tierItems ?? tierIds(product.item)).map(rid);
}

function milk(player, animal) {
  const species = speciesOf(animal);
  if (isBaby(animal) || !isFemale(animal)) return tell(player, "milking.not_female");
  const day = today();
  if (animal.getDynamicProperty(LAST_MILKED_DAY) === day) return tell(player, "milking.milked_today");
  const { produces, quality } = production(animal, day);
  if (!produces) return tell(player, "milking.no_milk");
  if (!takeItems(player, ["minecraft:glass_bottle"], 1)) return tell(player, "milking.need_bottle");

  animal.setDynamicProperty(LAST_MILKED_DAY, day);
  const bottle = milkTiers(species)[TIER_INDEX[quality]];
  give(player, bottle);
  emitRanchEvent("harvested", { animal: animal.typeId, entity: animal.id, product: "milk", items: { [bottle]: 1 } });
  damageMainHand(player);
  animal.dimension.playSound("mob.cow.milk", animal.location);
}

function nurse(player, baby) {
  if (!takeItems(player, MILK_FOR_FEEDING, 1)) return tell(player, "nursing.need_milk");
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
    tell(player, "nursing.grew");
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
