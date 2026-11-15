// Behaviour tests for Ranching's scripts, run against the mock API.
// Run with: node --import ./tools/test/register.mjs tools/test/run.mjs

import * as mc from "@minecraft/server";

const { world, system, ItemStack, __advance, __interact, __newPlayer, __skipTime, __place } = mc;
const overworld = world.getDimension("overworld");

const results = [];
function test(name, body) {
  try {
    body();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function equal(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const SEX = "kaleidoscope_ranching:sex";
const at = (x, z = 0) => ({ x, y: 64, z });
const isBaby = (entity) => entity.hasComponent("minecraft:is_baby");
function hold(player, typeId, amount = 1) {
  player.inventory.setItem(player.selectedSlotIndex, new ItemStack(typeId, amount));
}
function clearWorld() {
  for (const key of world.getDynamicPropertyIds()) world.setDynamicProperty(key, undefined);
  overworld.entities = [];
  overworld.items = [];
  overworld.blocks = new Map();
  overworld.containers = new Map();
}
function ranch(type, x, sex, z = 0) {
  const entity = overworld.spawnEntity(`kaleidoscope_ranching:${type}`, at(x, z));
  if (sex) entity.triggerEvent(`kaleidoscope_ranching:set_${sex}`);
  return entity;
}

await import("../../packs/BP/scripts/main.js");
const COMPONENTS = {};
system.beforeEvents.startup.fire({
  blockComponentRegistry: { registerCustomComponent: (name, component) => (COMPONENTS[name] = component) },
  itemComponentRegistry: { registerCustomComponent: (name, component) => (COMPONENTS[name] = component) },
});
const care = await import("../../packs/BP/scripts/care/state.js");
const husbandry = await import("../../packs/BP/scripts/core/husbandry.js");

/** Meets all four of M2's daily needs for today, with the given feed tier. */
function careFor(entity, feedTier = 1) {
  care.mark(entity, "fed", { fed_tier: feedTier });
  care.mark(entity, "water");
  care.mark(entity, "groom");
  care.mark(entity, "clean");
}
world.afterEvents.worldLoad.fire({});
__advance(2);

// --- M1: conversion -------------------------------------------------------

test("a vanilla cow becomes a Ranching cow with a sex", () => {
  clearWorld();
  overworld.__spawnVanilla("minecraft:cow", at(3), {});
  __advance(1);
  const cows = overworld.getEntities({ type: "kaleidoscope_ranching:cow" });
  equal(cows.length, 1, "Ranching cows");
  equal(overworld.getEntities({ type: "minecraft:cow" }).length, 0, "vanilla cows left");
  assert(["female", "male"].includes(cows[0].getProperty(SEX)), "sex set");
  assert(cows[0].hasComponent("minecraft:type_family"), "family from sex group");
  assert(!isBaby(cows[0]), "adult");
});

test("conversion keeps baby state, name, wool colour and shearing", () => {
  clearWorld();
  overworld.__spawnVanilla("minecraft:sheep", at(0), {
    "minecraft:is_baby": {},
    "minecraft:is_sheared": {},
    "minecraft:color": { value: 14 },
  }).nameTag = "Dolly";
  __advance(1);
  const [sheep] = overworld.getEntities({ type: "kaleidoscope_ranching:sheep" });
  assert(sheep, "converted");
  assert(isBaby(sheep), "still a lamb");
  equal(sheep.nameTag, "Dolly", "name");
  equal(sheep.getComponent("minecraft:color").value, 14, "colour");
  assert(sheep.hasComponent("minecraft:is_sheared"), "sheared");
  assert(sheep.hasComponent("minecraft:persistent"), "named animals become persistent");
});

test("conversion keeps the rabbit coat and the pig saddle", () => {
  clearWorld();
  overworld.__spawnVanilla("minecraft:rabbit", at(0), { "minecraft:variant": { value: 3 } });
  overworld.__spawnVanilla("minecraft:pig", at(2), { "minecraft:is_saddled": {} });
  __advance(1);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:rabbit" })[0].getComponent("minecraft:variant").value, 3, "rabbit coat");
  assert(overworld.getEntities({ type: "kaleidoscope_ranching:pig" })[0].hasComponent("minecraft:rideable"), "pig still rideable");
});

test("a chick hatched from a thrown egg is removed, not converted", () => {
  clearWorld();
  world.afterEvents.projectileHitBlock.fire({ projectile: { typeId: "minecraft:egg" }, location: at(5), dimension: overworld });
  overworld.__spawnVanilla("minecraft:chicken", at(5), { "minecraft:is_baby": {} });
  __advance(1);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:chicken" }).length, 0, "no Ranching chick");
  equal(overworld.getEntities({ type: "minecraft:chicken" }).length, 0, "vanilla chick removed");
});

test("about half of converted animals are male", () => {
  clearWorld();
  for (let i = 0; i < 200; i++) overworld.__spawnVanilla("minecraft:pig", at(i * 20), {});
  __advance(1);
  const males = overworld.getEntities({ type: "kaleidoscope_ranching:pig" }).filter((pig) => pig.getProperty(SEX) === "male").length;
  assert(males > 70 && males < 130, `males out of 200: ${males}`);
});

// --- M1: breeding ---------------------------------------------------------

test("a male and a female in love conceive; the female gives birth after three days", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  const bull = ranch("cow", 2, "male");
  careFor(cow);
  careFor(bull);
  hold(player, "minecraft:wheat", 2);
  assert(__interact(player, cow), "feeding is handled");
  assert(__interact(player, bull), "feeding is handled");
  equal(player.inventory.count("minecraft:wheat"), 0, "wheat used");
  assert(cow.getDynamicProperty("kaleidoscope_ranching:pregnant_due") > 0, "cow pregnant");
  equal(bull.getDynamicProperty("kaleidoscope_ranching:pregnant_due"), undefined, "bull not pregnant");

  __skipTime(24000 * 3 - 1000);
  __advance(700);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:cow" }).length, 2, "no calf before three days");
  __skipTime(1000);
  __advance(700);
  const calves = overworld.getEntities({ type: "kaleidoscope_ranching:cow" }).filter(isBaby);
  equal(calves.length, 1, "one calf after three days");
  equal(cow.getDynamicProperty("kaleidoscope_ranching:pregnant_due"), undefined, "pregnancy cleared");
  assert(calves[0].hasComponent("minecraft:persistent"), "bred animals do not despawn");
});

test("two animals of the same sex never conceive", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const a = ranch("sheep", 1, "female");
  const b = ranch("sheep", 2, "female");
  careFor(a);
  careFor(b);
  hold(player, "minecraft:wheat", 2);
  __interact(player, a);
  __interact(player, b);
  equal(a.getDynamicProperty("kaleidoscope_ranching:pregnant_due"), undefined, "a");
  equal(b.getDynamicProperty("kaleidoscope_ranching:pregnant_due"), undefined, "b");
  assert(player.actionBar.some((m) => m.translate.endsWith("same_sex")), "player is told why");
});

test("a pregnant female cannot be put in love again", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const sow = ranch("pig", 1, "female");
  const boar = ranch("pig", 2, "male");
  careFor(sow);
  careFor(boar);
  hold(player, "minecraft:carrot", 3);
  __interact(player, sow);
  __interact(player, boar);
  __interact(player, sow);
  equal(player.inventory.count("minecraft:carrot"), 1, "third carrot not used");
  assert(player.actionBar.some((m) => m.translate.endsWith("pregnant")), "player is told she is pregnant");
});

test("a lamb inherits its mother's wool colour", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const ewe = ranch("sheep", 1, "female");
  ewe.triggerEvent("kaleidoscope_ranching:set_color_11");
  const ram = ranch("sheep", 2, "male");
  careFor(ewe);
  careFor(ram);
  hold(player, "minecraft:wheat", 2);
  __interact(player, ewe);
  __interact(player, ram);
  __skipTime(24000 * 3);
  __advance(700);
  const lamb = overworld.getEntities({ type: "kaleidoscope_ranching:sheep" }).find(isBaby);
  equal(lamb?.getComponent("minecraft:color").value, 11, "lamb colour");
});

test("chickens do not breed by feeding", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const hen = ranch("chicken", 1, "female");
  hold(player, "minecraft:wheat_seeds", 1);
  assert(!__interact(player, hen), "seeds are not intercepted");
});

// --- M2 bridge ------------------------------------------------------------

test("animals that were not cared for today do not breed", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  const bull = ranch("cow", 2, "male");
  careFor(bull);
  hold(player, "minecraft:wheat", 2);
  __interact(player, cow);
  equal(player.inventory.count("minecraft:wheat"), 2, "wheat kept");
  assert(player.actionBar.some((m) => m.translate.endsWith("not_cared")), "player told why");
});

test("quality follows M2's hearts and today's feed tier", () => {
  clearWorld();
  const cow = ranch("cow", 1, "female");
  const day = Math.floor(world.getAbsoluteTime() / 24000);
  care.setAffection(cow, 100);
  careFor(cow, 3);
  equal(husbandry.production(cow, day).quality, "superb", "5 hearts + concentrate");
  care.setAffection(cow, 60);
  equal(husbandry.production(cow, day).quality, "fine", "3 hearts");
  care.setAffection(cow, 20);
  equal(husbandry.production(cow, day).quality, "plain", "1 heart");
  equal(husbandry.getAffection(cow), 1, "hearts, not points");
});

test("a newborn starts with half its parents' average hearts", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  const bull = ranch("cow", 2, "male");
  care.setAffection(cow, 100);
  care.setAffection(bull, 60);
  careFor(cow);
  careFor(bull);
  hold(player, "minecraft:wheat", 2);
  __interact(player, cow);
  __interact(player, bull);
  equal(cow.getDynamicProperty("kr:pregnant_until_day") > 0, true, "M2's notebook sees the due day");
  __skipTime(24000 * 3);
  __advance(700);
  const calf = overworld.getEntities({ type: "kaleidoscope_ranching:cow" }).find(isBaby);
  equal(care.getHearts(calf), 2, "floor(((5 + 3) / 2) * 0.5) hearts");
  equal(cow.getDynamicProperty("kr:pregnant_until_day"), undefined, "due day cleared");
});

test("M2's ear tag makes an animal persistent", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const pig = ranch("pig", 1);
  assert(pig.hasComponent("minecraft:despawn"), "wild pigs can despawn");
  hold(player, "kaleidoscope_ranching:ear_tag", 1);
  assert(__interact(player, pig), "ear tag handled by M2");
  assert(pig.hasComponent("minecraft:persistent") && !pig.hasComponent("minecraft:despawn"), "tagged pig stays");
});

// --- M3: carcasses and the butcher rack -----------------------------------

const RACK = COMPONENTS["kaleidoscope_ranching:butcher_rack"];
const NEST = COMPONENTS["kaleidoscope_ranching:nest_box"];
const INCUBATOR = COMPONENTS["kaleidoscope_ranching:incubator"];
const STATION = COMPONENTS["kaleidoscope_ranching:station"];
const DAY = 24000;
const rackAt = (x = 10) => __place(overworld, { x, y: 64, z: 0 }, "kaleidoscope_ranching:butcher_rack", {
  "kaleidoscope_ranching:carcass": "none", "kaleidoscope_ranching:cut": false,
});
/** Breaks a block the way the game does: both hooks fire, the block is air by then. */
function breakBlock(component, block) {
  const brokenBlockPermutation = block.permutation;
  block.setType("minecraft:air");
  component.onPlayerBreak({ block, dimension: block.dimension, brokenBlockPermutation });
  component.onBreak({ block, dimension: block.dimension, brokenBlockPermutation });
}
const use = (component, block, player) => component.onPlayerInteract({ block, player, dimension: block.dimension });
const dropsOf = (typeId) => overworld.items.filter((drop) => drop.item.typeId === typeId);

function carcassFrom(type, sex, setup = () => {}) {
  const animal = ranch(type, 1, sex);
  setup(animal);
  animal.kill();
  const drop = overworld.items.find((d) => d.item.typeId === `kaleidoscope_ranching:${type}_carcass`);
  overworld.items = [];
  return drop?.item;
}

function cutAll(player, rack, limit = 20) {
  hold(player, "minecraft:iron_sword");
  for (let i = 0; i < limit && rack.permutation.getState("kaleidoscope_ranching:carcass") !== "none"; i++) {
    hold(player, "minecraft:iron_sword");
    use(RACK, rack, player);
  }
}

test("an adult dies into one carcass that remembers its sex; a baby drops nothing", () => {
  clearWorld();
  const carcass = carcassFrom("cow", "male");
  assert(carcass, "carcass dropped");
  equal(carcass.amount, 1, "one carcass");
  equal(carcass.getDynamicProperty("kaleidoscope_ranching:carcass_male"), true, "male recorded");
  const calf = ranch("cow", 1, "female");
  calf.triggerEvent("kaleidoscope_ranching:become_baby");
  calf.kill();
  equal(overworld.items.length, 0, "no drop from a calf");
});

test("a bull carcass is cut stroke by stroke into vanilla beef, cuts and horns", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  player.inventory.setItem(0, carcassFrom("cow", "male"));
  use(RACK, rack, player);
  equal(rack.permutation.getState("kaleidoscope_ranching:carcass"), "cow", "carcass hanging");
  cutAll(player, rack);
  equal(rack.permutation.getState("kaleidoscope_ranching:carcass"), "none", "rack emptied");
  for (const id of ["minecraft:beef", "kaleidoscope_ranching:beef_brisket", "kaleidoscope_ranching:large_bone", "kaleidoscope_ranching:cattle_horn"]) {
    assert(player.inventory.count(id) > 0, `got ${id}`);
  }
  assert(player.inventory.count("minecraft:beef") >= 3, "males give the bonus beef");
});

test("a cow carcass has no horns, and needs a blade", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  player.inventory.setItem(0, carcassFrom("cow", "female"));
  use(RACK, rack, player);
  use(RACK, rack, player); // empty hand
  assert(player.actionBar.some((m) => m.translate.endsWith("rack.need_blade")), "asks for a blade");
  hold(player, "kaleidoscope_cookery:iron_kitchen_knife");
  use(RACK, rack, player);
  assert(player.inventory.count("kaleidoscope_ranching:raw_hide") > 0, "Cookery knife cuts");
  hold(player, "minecraft:iron_axe");
  use(RACK, rack, player);
  cutAll(player, rack);
  equal(player.inventory.count("kaleidoscope_ranching:cattle_horn"), 0, "no horns from a cow");
});

test("the rack shows the partly cut carcass after half the strokes", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  player.inventory.setItem(0, carcassFrom("pig", "female"));
  use(RACK, rack, player);
  equal(rack.permutation.getState("kaleidoscope_ranching:cut"), false, "whole at first");
  for (let i = 0; i < 4; i++) {
    hold(player, "minecraft:iron_sword");
    use(RACK, rack, player);
  }
  equal(rack.permutation.getState("kaleidoscope_ranching:cut"), true, "partly cut after 4 of 7");
});

test("an unshorn sheep gives wool of its colour; a sheared one does not", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  player.inventory.setItem(0, carcassFrom("sheep", "female", (s) => s.triggerEvent("kaleidoscope_ranching:set_color_14")));
  use(RACK, rack, player);
  cutAll(player, rack);
  assert(player.inventory.count("minecraft:red_wool") > 0, "red wool");
  const other = __newPlayer(at(0));
  player.inventory.setItem(0, undefined);
  other.inventory.setItem(0, carcassFrom("sheep", "female", (s) => s.triggerEvent("kaleidoscope_ranching:shear")));
  use(RACK, rack, other);
  cutAll(other, rack);
  const wool = other.inventory.slots.filter((slot) => slot?.typeId.endsWith("_wool"));
  equal(wool.length, 0, "no wool from a sheared sheep");
});

test("breaking a rack drops the carcass, or the remaining cuts, exactly once", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  let rack = rackAt();
  player.inventory.setItem(0, carcassFrom("goat", "male"));
  use(RACK, rack, player);
  breakBlock(RACK, rack);
  const carcasses = dropsOf("kaleidoscope_ranching:goat_carcass");
  equal(carcasses.length, 1, "one carcass back");
  equal(carcasses[0].item.getDynamicProperty("kaleidoscope_ranching:carcass_male"), true, "still male");

  overworld.items = [];
  rack = rackAt(12);
  player.inventory.setItem(0, carcasses[0].item);
  use(RACK, rack, player);
  hold(player, "minecraft:iron_sword");
  use(RACK, rack, player);
  breakBlock(RACK, rack);
  equal(dropsOf("kaleidoscope_ranching:goat_carcass").length, 0, "no carcass once cut");
  equal(dropsOf("kaleidoscope_ranching:billy_goat_horn").length, 1, "remaining cuts dropped once");
});

test("the rack cannot be placed without room above it", () => {
  clearWorld();
  const below = __place(overworld, { x: 0, y: 64, z: 0 }, "minecraft:air");
  __place(overworld, { x: 0, y: 65, z: 0 }, "minecraft:stone");
  const event = { block: below, cancel: false };
  RACK.beforeOnPlayerPlace(event);
  assert(event.cancel, "cancelled");
});

// --- M3: milking and nursing ----------------------------------------------

test("milking gives one graded bottle per cow per day and needs an empty bottle", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  care.setAffection(cow, 100);
  careFor(cow, 3);
  hold(player, "kaleidoscope_ranching:milking_pail");
  __interact(player, cow);
  assert(player.actionBar.at(-1).translate.endsWith("need_bottle"), "needs a bottle");
  player.inventory.setItem(1, new ItemStack("minecraft:glass_bottle", 2));
  __interact(player, cow);
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk_superb"), 1, "superb milk from a 5-heart cow on concentrate");
  __interact(player, cow);
  equal(player.inventory.count("minecraft:glass_bottle"), 1, "only once a day");
  assert(player.actionBar.at(-1).translate.endsWith("milked_today"), "told it was milked");
  __skipTime(DAY);
  __interact(player, cow);
  equal(player.inventory.count("minecraft:glass_bottle"), 0, "milked again the next day");
});

test("bulls and calves cannot be milked", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  player.inventory.setItem(1, new ItemStack("minecraft:glass_bottle", 2));
  hold(player, "kaleidoscope_ranching:milking_pail");
  __interact(player, ranch("cow", 1, "male"));
  const calf = ranch("goat", 2, "female");
  calf.triggerEvent("kaleidoscope_ranching:become_baby");
  __interact(player, calf);
  equal(player.inventory.count("minecraft:glass_bottle"), 2, "no bottle used");
  assert(player.actionBar.every((m) => m.translate.endsWith("not_female")), "told why");
});

test("three bottle feedings make a calf grow up and return the bottles", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const calf = ranch("cow", 1, "female");
  calf.triggerEvent("kaleidoscope_ranching:become_baby");
  player.inventory.setItem(1, new ItemStack("kaleidoscope_ranching:cow_milk_fine", 1));
  player.inventory.setItem(2, new ItemStack("kaleidoscope_ranching:cow_milk", 3));
  hold(player, "kaleidoscope_ranching:nursing_bottle");
  __interact(player, calf);
  __interact(player, calf);
  assert(isBaby(calf), "still a calf after two");
  __interact(player, calf);
  assert(!isBaby(calf), "grown after three");
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk_fine"), 1, "plain milk used first");
  equal(player.inventory.count("minecraft:glass_bottle"), 3, "bottles returned");
});

// --- M3: nest box, hopper, hatching, incubator ----------------------------

const nestAt = (x = 0, z = 0) => __place(overworld, { x, y: 64, z }, "kaleidoscope_ranching:nest_box", { "kaleidoscope_ranching:eggs": 0 });

test("hens lay one egg a day into the nest box, at most three days at once", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const nest = nestAt();
  ranch("chicken", 2, "female");
  use(NEST, nest, player);
  equal(player.inventory.count("minecraft:egg"), 1, "one egg on the first day");
  __skipTime(DAY * 5);
  use(NEST, nest, player);
  equal(player.inventory.count("minecraft:egg"), 4, "three more, not five");
  use(NEST, nest, player);
  equal(player.inventory.count("minecraft:egg"), 4, "nothing more the same day");
});

test("without a rooster no egg is fertilized; with one some are", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const nest = nestAt();
  for (let i = 0; i < 10; i++) care.setAffection(ranch("chicken", 1 + (i % 4), "female", i % 3), 100);
  for (let day = 0; day < 3; day++) {
    use(NEST, nest, player);
    __skipTime(DAY);
  }
  equal(player.inventory.count("kaleidoscope_ranching:fertilized_chicken_egg"), 0, "no rooster, no chicks");
  ranch("chicken", 2, "male");
  for (let day = 0; day < 3; day++) {
    use(NEST, nest, player);
    __skipTime(DAY);
  }
  assert(player.inventory.count("kaleidoscope_ranching:fertilized_chicken_egg") > 5, "fertilized eggs with a rooster at 5 hearts");
});

test("a hopper under the nest box collects the eggs", () => {
  clearWorld();
  const nest = nestAt(0, 0);
  const hopper = __place(overworld, { x: 0, y: 63, z: 0 }, "minecraft:hopper");
  NEST.onPlace({ block: nest, dimension: overworld });
  ranch("chicken", 1, "female");
  ranch("chicken", 2, "female");
  __advance(700);
  equal(hopper.getComponent("minecraft:inventory").container.count("minecraft:egg"), 2, "two eggs in the hopper");
});

test("a fertilized egg in the nest hatches after two days only while a hen broods it", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const nest = nestAt();
  NEST.onPlace({ block: nest, dimension: overworld });
  hold(player, "kaleidoscope_ranching:fertilized_chicken_egg", 1);
  use(NEST, nest, player);
  __skipTime(DAY * 2);
  __advance(700);
  const chicks = () => overworld.getEntities({ type: "kaleidoscope_ranching:chicken" }).filter(isBaby);
  equal(chicks().length, 0, "no hen, no hatching");
  ranch("chicken", 1, "female");
  __advance(700);
  equal(chicks().length, 1, "hatched once a hen is near");
  assert(chicks()[0].hasComponent("minecraft:persistent"), "hatched chicks stay");
});

test("the incubator hatches only while heated; the countdown pauses when cold", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const incubator = __place(overworld, { x: 0, y: 64, z: 0 }, "kaleidoscope_ranching:incubator", {
    "kaleidoscope_ranching:eggs": 0, "kaleidoscope_ranching:busy": false,
  });
  INCUBATOR.onPlace({ block: incubator, dimension: overworld });
  hold(player, "kaleidoscope_ranching:fertilized_chicken_egg", 1);
  use(INCUBATOR, incubator, player);
  assert(player.actionBar.at(-1).translate.endsWith("incubator.cold"), "warned it is cold");
  __advance(24000 * 2);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:chicken" }).length, 0, "cold: nothing hatched");
  __place(overworld, { x: 0, y: 63, z: 0 }, "minecraft:campfire");
  __advance(24000 * 2 + 1200);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:chicken" }).filter(isBaby).length, 1, "hatched after two heated days");
});

// --- M3: processing stations ----------------------------------------------

const stationAt = (id, x = 0) => __place(overworld, { x, y: 64, z: 0 }, `kaleidoscope_ranching:${id}`, { "kaleidoscope_ranching:busy": false });

test("the cheese press takes three milk, works half a day, and yields by the lowest quality", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const press = stationAt("cheese_press");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:cow_milk_superb", 3));
  use(STATION, press, player);
  equal(press.permutation.getState("kaleidoscope_ranching:busy"), true, "working");
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk_superb"), 0, "milk taken");
  use(STATION, press, player);
  assert(player.actionBar.at(-1).translate.endsWith("station.working"), "still working");
  __skipTime(12000);
  use(STATION, press, player);
  equal(player.inventory.count("kaleidoscope_ranching:fresh_cheese"), 2, "superb milk doubles the cheese");
  equal(player.inventory.count("kaleidoscope_ranching:whey"), 2, "and the whey");
  equal(press.permutation.getState("kaleidoscope_ranching:busy"), false, "idle again");
});

test("mixed quality uses the lowest tier, and plain milk is spent before better milk", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const churn = stationAt("butter_churn");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:goat_milk_fine", 1));
  player.inventory.setItem(1, new ItemStack("kaleidoscope_ranching:cow_milk", 2));
  player.inventory.setItem(2, new ItemStack("kaleidoscope_ranching:cow_milk_superb", 1));
  player.selectedSlotIndex = 1;
  use(STATION, churn, player); // holding plain cow milk: butter needs 2
  __skipTime(600);
  use(STATION, churn, player);
  equal(player.inventory.count("kaleidoscope_ranching:butter"), 1, "one butter");
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk_superb"), 1, "superb milk kept");
  equal(player.inventory.count("kaleidoscope_ranching:goat_milk_fine"), 1, "fine milk kept");
});

test("a block replaced without its break hook ignores the old block's data", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const nest = nestAt();
  ranch("chicken", 2, "female");
  use(NEST, nest, player); // nest data now stored at this position
  const press = stationAt("cheese_press"); // same position, no break hook (like /setblock)
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:cow_milk", 3));
  use(STATION, press, player);
  equal(press.permutation.getState("kaleidoscope_ranching:busy"), true, "press starts normally");
});

test("the pickling vat needs every ingredient and refunds them if broken early", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const vat = stationAt("pickling_vat");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:duck_egg", 4));
  use(STATION, vat, player);
  assert(player.actionBar.at(-1).translate.endsWith("station.missing"), "missing clay");
  player.inventory.setItem(1, new ItemStack("minecraft:clay_ball", 1));
  use(STATION, vat, player);
  equal(player.inventory.count("kaleidoscope_ranching:duck_egg"), 0, "eggs in the vat");
  breakBlock(STATION, vat);
  equal(dropsOf("kaleidoscope_ranching:duck_egg").reduce((n, d) => n + d.item.amount, 0), 4, "eggs back once");
  equal(dropsOf("minecraft:clay_ball").length, 1, "clay back once");
});

// --- M1: vanilla parity ---------------------------------------------------

test("shearing drops wool of the sheep's colour and marks it sheared", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const sheep = ranch("sheep", 1, "female");
  sheep.triggerEvent("kaleidoscope_ranching:set_color_4");
  hold(player, "minecraft:shears");
  assert(__interact(player, sheep), "handled");
  assert(sheep.hasComponent("minecraft:is_sheared"), "sheared");
  const wool = overworld.items.filter((drop) => drop.item.typeId === "minecraft:yellow_wool");
  assert(wool.length === 1 && wool[0].item.amount >= 1, "yellow wool dropped");
  assert(!__interact(player, sheep), "cannot shear twice");
});

test("dye recolours a sheep and is used up", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const sheep = ranch("sheep", 1);
  hold(player, "minecraft:lime_dye", 1);
  __interact(player, sheep);
  equal(sheep.getComponent("minecraft:color").value, 5, "lime");
  equal(player.inventory.count("minecraft:lime_dye"), 0, "dye used");
});

// --- Report ---------------------------------------------------------------

const failed = results.filter((result) => !result.ok);
for (const result of results) console.log(`${result.ok ? "ok  " : "FAIL"} ${result.name}${result.ok ? "" : `\n     ${result.error.message}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
