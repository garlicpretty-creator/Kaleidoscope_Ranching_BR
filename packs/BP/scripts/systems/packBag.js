// 1.1 馱袋 (企劃書 1.1 五、皮革線): a pack bag of oiled leather and felt that an
// adult yak carries, with 15 slots of storage.
//
// - Use the pack bag on an adult yak to put it on.
// - Sneak and use any item on a yak wearing it: the whole stack goes into the bag.
// - Use an empty hand on it (without sneaking, which pets): a menu lists what is
//   in the bag; pick a stack to take it out, or take the bag off (only when empty).
// - When the yak dies its bag drops as an item; the contents drop with the yak
//   (the yak's minecraft:inventory is not private).
//
// ## Bedrock gives no script call to open an entity's inventory screen, so the
// ## bag is reached through a form. Its storage is the yak's own inventory
// ## component (added by the `put_on_pack_bag` event), so items keep their
// ## names, enchantments and durability.
//
// Other add-ons' animals take the bag when registered with `packBag: true`
// (api/ranchingApi.js) and give themselves a `minecraft:inventory`, either
// always or from an event named `kaleidoscope_ranching:put_on_pack_bag`.

import { ItemStack, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { isBaby } from "../core/animal.js";
import { animalByType } from "../core/content.js";
import { dp, rid } from "../core/ids.js";
import { registerEntityInteraction } from "../core/interact.js";
import { consumeMainHand, give, giveStack, mainHand } from "../core/inventory.js";
import { showActionBar } from "../core/actionBar.js";

export const PACK_BAG = rid("pack_bag");
export const PACKED = dp("pack_bag");
const PUT_ON = rid("put_on_pack_bag");
const TAKE_OFF = rid("take_off_pack_bag");
const YAK = rid("yak");

function tell(player, key) {
  showActionBar(player, { translate: `kaleidoscope_ranching.message.pack_bag.${key}` });
}

/** The yak, or an animal another add-on registered with `packBag: true`. */
export const takesPackBag = (entity) => entity.typeId === YAK || animalByType(entity.typeId)?.packBag === true;
export const wearsPackBag = (entity) => entity.getDynamicProperty(PACKED) === true;

/** The bag's container, or undefined while the animal has no inventory. */
export function bagOf(animal) {
  try {
    return animal.getComponent("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}

export function putOnPackBag(player, animal) {
  if (isBaby(animal)) return tell(player, "baby");
  if (wearsPackBag(animal)) return tell(player, "already");
  try {
    animal.triggerEvent(PUT_ON);
  } catch {
    // Another add-on's animal without the event: it must have an inventory already.
  }
  if (!bagOf(animal)) return tell(player, "cannot");
  animal.setDynamicProperty(PACKED, true);
  consumeMainHand(player);
  animal.dimension.playSound("mob.horse.armor", animal.location);
  tell(player, "on");
}

/** Puts the player's whole main-hand stack into the bag; what does not fit stays in hand. */
export function storeHeld(player, animal) {
  const slot = mainHand(player);
  const held = slot?.getItem();
  const bag = bagOf(animal);
  if (!held || !bag) return;
  const rest = bag.addItem(held);
  if (rest && rest.amount === held.amount) return tell(player, "full");
  slot.setItem(rest);
  animal.dimension.playSound("armor.equip_leather", animal.location);
  tell(player, rest ? "full" : "stored");
}

/** [{ slot, item }] for every stack in the bag. */
export function bagContents(animal) {
  const bag = bagOf(animal);
  const out = [];
  for (let slot = 0; slot < (bag?.size ?? 0); slot++) {
    const item = bag.getItem(slot);
    if (item) out.push({ slot, item });
  }
  return out;
}

/** Moves one stack from the bag to the player. */
export function takeOut(player, animal, slot) {
  const bag = bagOf(animal);
  const item = bag?.getItem(slot);
  if (!item) return false;
  bag.setItem(slot, undefined);
  giveStack(player, item);
  return true;
}

/** Takes the bag off an empty bag's animal and gives it back. */
export function takeOffPackBag(player, animal) {
  if (!wearsPackBag(animal)) return false;
  if (bagContents(animal).length) {
    tell(player, "not_empty");
    return false;
  }
  try {
    animal.triggerEvent(TAKE_OFF);
  } catch {}
  animal.setDynamicProperty(PACKED, undefined);
  give(player, PACK_BAG);
  tell(player, "off");
  return true;
}

function openBag(player, animal) {
  const contents = bagContents(animal);
  const form = new ActionFormData()
    .title({ translate: "kaleidoscope_ranching.ui.pack_bag.title" })
    .body({ translate: contents.length ? "kaleidoscope_ranching.ui.pack_bag.body" : "kaleidoscope_ranching.ui.pack_bag.empty" });
  for (const { item } of contents) form.button({ rawtext: [{ translate: item.localizationKey }, { text: ` ×${item.amount}` }] });
  form.button({ translate: "kaleidoscope_ranching.ui.pack_bag.take_off" });
  form
    .show(player)
    .then((response) => {
      if (response.canceled || response.selection === undefined || !animal.isValid) return;
      if (response.selection === contents.length) return takeOffPackBag(player, animal);
      takeOut(player, animal, contents[response.selection].slot);
    })
    .catch(() => {});
}

export function startPackBag() {
  registerEntityInteraction({
    id: "m11:pack_bag_on",
    priority: 40,
    match: ({ entity, item }) => item?.typeId === PACK_BAG && takesPackBag(entity),
    handle: ({ player, entity }) => putOnPackBag(player, entity),
  });
  // Ahead of feeding and care: on a bagged animal, sneaking with an item means "store it".
  registerEntityInteraction({
    id: "m11:pack_bag_store",
    priority: 30,
    match: ({ player, entity, item }) => Boolean(item) && player.isSneaking && wearsPackBag(entity),
    handle: ({ player, entity }) => storeHeld(player, entity),
  });
  registerEntityInteraction({
    id: "m11:pack_bag_open",
    priority: 30,
    match: ({ player, entity, item }) => !item && !player.isSneaking && wearsPackBag(entity),
    handle: ({ player, entity }) => openBag(player, entity),
  });
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    try {
      if (deadEntity.getDynamicProperty(PACKED) !== true) return;
      deadEntity.dimension.spawnItem(new ItemStack(PACK_BAG, 1), deadEntity.location);
    } catch {}
  });
}

