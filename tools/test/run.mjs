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

// --- M2: care core ---------------------------------------------------------

const { BlockPermutation, __setMaxStack } = mc;
const { runBlockClock, trackBlock } = await import("../../packs/BP/scripts/core/blockClock.js");
const { troughComponent } = await import("../../packs/BP/scripts/custom_components/trough.js");
const { waterTroughComponent } = await import("../../packs/BP/scripts/custom_components/water_trough.js");
const { compostBinComponent } = await import("../../packs/BP/scripts/custom_components/compost_bin.js");
const { manureForkComponent } = await import("../../packs/BP/scripts/events/tools.js");
const NS = "kaleidoscope_ranching";
const DAY = 24000;
__setMaxStack(`${NS}:brush`, 1);
__setMaxStack(`${NS}:manure_fork`, 1);

/** Places a block and, for clock blocks, registers it as placing would. */
function place(typeId, location, states = {}) {
  const block = overworld.getBlock(location);
  block.setPermutation(new BlockPermutation(`${NS}:${typeId}`, Object.fromEntries(Object.entries(states).map(([k, v]) => [`${NS}:${k}`, v]))));
  trackBlock(block);
  return block;
}
function ground() {
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) overworld.setBlockType({ x, y: 63, z }, "minecraft:grass_block");
}
const state = (block, name) => block.permutation.getState(`${NS}:${name}`);
const manureCount = () => [...overworld.blocks.values()].filter((p) => p.type.id === `${NS}:manure`).length;
/** Moves to `tick` of the current day (time only goes forward). */
function toTimeOfDay(tick) {
  const now = world.getAbsoluteTime();
  const target = Math.floor(now / DAY) * DAY + tick;
  __skipTime(target > now ? target - now : target + DAY - now);
}
function herdOf(n, type = "cow") {
  return Array.from({ length: n }, (_, i) => ranch(type, (i % 4) * 1.5 - 2, i % 2 ? "male" : "female", Math.floor(i / 4) * 2 + 1));
}

test("M2 acceptance: five days of full care take every cow to five hearts", () => {
  clearWorld();
  ground();
  const player = __newPlayer(at(0, -3));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  const water = place("water_trough", at(4), { water: 0 });
  const herd = herdOf(8);
  for (let day = 0; day < 6; day++) {
    __skipTime(DAY);
    toTimeOfDay(1000);
    runBlockClock(); // settles yesterday
    if (day === 5) break;
    hold(player, `${NS}:mixed_feed`, 16);
    player.isSneaking = true;
    troughComponent.onPlayerInteract({ block: trough, player });
    player.isSneaking = false;
    hold(player, "minecraft:water_bucket");
    waterTroughComponent.onPlayerInteract({ block: water, player });
    for (const [key, permutation] of [...overworld.blocks]) {
      if (permutation.type.id !== `${NS}:manure`) continue;
      hold(player, `${NS}:manure_fork`);
      manureForkComponent.onUseOn({ source: player, block: overworld.getBlock(Object.fromEntries(key.split(",").map((v, i) => ["xyz"[i], +v]))) });
    }
    hold(player, `${NS}:brush`);
    for (const cow of herd) assert(__interact(player, cow), "brushing goes through the router");
    for (let pass = 0; pass < 5; pass++) {
      __skipTime(2000);
      runBlockClock();
    }
  }
  equal(herd.map((cow) => care.getHearts(cow)).join(","), "5,5,5,5,5,5,5,5", "hearts");
});

test("M2 acceptance: an auto feeder under a hopper feeds eight cows for three days", () => {
  clearWorld();
  ground();
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  place("auto_feeder", { x: 0, y: 65, z: 0 });
  const hopperBlock = overworld.getBlock({ x: 0, y: 66, z: 0 });
  hopperBlock.setType("minecraft:hopper");
  hopperBlock.getComponent("minecraft:inventory").container.setItem(0, new ItemStack(`${NS}:mixed_feed`, 64));
  const herd = herdOf(8);
  toTimeOfDay(0);
  const start = Math.floor(world.getAbsoluteTime() / DAY);
  for (let day = 0; day < 3; day++) {
    // 40 clock passes a day; check before the last one crosses midnight.
    for (let pass = 0; pass < 39; pass++) {
      __skipTime(600);
      runBlockClock();
    }
    const fed = herd.filter((cow) => cow.getDynamicProperty("kr:fed_day") === start + day).length;
    equal(fed, 8, `cows fed on day ${day + 1}`);
    __skipTime(600);
    runBlockClock();
  }
  assert(state(trough, "fill") > 0, "trough still has feed");
});

test("M2: an unfed animal loses a heart every second day", () => {
  clearWorld();
  const cow = ranch("cow", 1, "female");
  care.setAffection(cow, 100);
  care.ensureSettled(cow);
  for (let day = 0; day < 5; day++) {
    __skipTime(DAY);
    care.ensureSettled(cow);
  }
  equal(care.getHearts(cow), 3, "hearts after five unfed days");
});

test("M2: a salt lick wears away after seven days of use", () => {
  clearWorld();
  const lick = place("salt_lick", at(0), { bites: 0 });
  ranch("cow", 1, "female");
  for (let day = 0; day < 7; day++) {
    __skipTime(DAY);
    runBlockClock();
  }
  equal(lick.typeId, "minecraft:air", "salt lick gone");
});

test("M2: a chicken does not eat hay feed", () => {
  clearWorld();
  const trough = place("trough", at(0), { fill: 5, kind: 1 });
  const hen = ranch("chicken", 1, "female");
  runBlockClock();
  equal(hen.getDynamicProperty("kr:fed_day"), undefined, "hen unfed");
  equal(state(trough, "fill"), 5, "hay untouched");
});

test("M2: a broken trough leaves the clock", () => {
  clearWorld();
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  trough.setType("minecraft:air");
  runBlockClock();
  const registry = JSON.parse(world.getDynamicProperty(`${NS}:registry:m2_troughs`) ?? "[]");
  equal(registry.length, 0, "registry entries");
});

test("M2: compost bin turns four manure and wheat into fertilizer after a day", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const bin = place("compost_bin", at(0), { stage: 0, manure: 0 });
  for (let i = 0; i < 4; i++) {
    hold(player, `${NS}:manure_item`);
    compostBinComponent.onPlayerInteract({ block: bin, player });
  }
  hold(player, "minecraft:wheat");
  compostBinComponent.onPlayerInteract({ block: bin, player });
  equal(state(bin, "stage"), 1, "fermenting");
  __skipTime(DAY);
  player.inventory.setItem(0, undefined);
  compostBinComponent.onPlayerInteract({ block: bin, player });
  equal(player.inventory.count(`${NS}:fertilizer`), 4, "fertilizer");
  equal(state(bin, "stage"), 0, "bin reset");
});

test("M2: one click with a brush is handled once, by M2 only", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  hold(player, `${NS}:brush`);
  assert(__interact(player, cow), "handled");
  world.afterEvents.itemUse.fire({ source: player, itemStack: new ItemStack(`${NS}:brush`) });
  __advance(1);
  assert(care.isMarkedToday(cow, "groom"), "groomed");
  equal(cow.getDynamicProperty("kaleidoscope_ranching:love_until"), undefined, "breeding untouched");
});

// --- M3: carcasses and the butcher rack -----------------------------------

const RACK = COMPONENTS["kaleidoscope_ranching:butcher_rack"];
const NEST = COMPONENTS["kaleidoscope_ranching:nest_box"];
const INCUBATOR = COMPONENTS["kaleidoscope_ranching:incubator"];
const STATION = COMPONENTS["kaleidoscope_ranching:station"];
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

test("nest boxes and incubators join the shared block clock and leave it when broken", () => {
  clearWorld();
  const registry = (name) => JSON.parse(world.getDynamicProperty(`${NS}:registry:${name}`) ?? "[]");
  const nest = nestAt(0);
  NEST.onPlace({ block: nest, dimension: overworld });
  const incubator = __place(overworld, { x: 3, y: 64, z: 0 }, "kaleidoscope_ranching:incubator", {
    "kaleidoscope_ranching:eggs": 0, "kaleidoscope_ranching:busy": false,
  });
  INCUBATOR.onPlace({ block: incubator, dimension: overworld });
  equal(registry("nest_boxes").length, 1, "nest box tracked");
  equal(registry("incubators").length, 1, "incubator tracked");
  breakBlock(NEST, nest);
  breakBlock(INCUBATOR, incubator);
  equal(registry("nest_boxes").length + registry("incubators").length, 0, "both left the clock");
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

// --- M5: Ranching's public API --------------------------------------------

const API = "kaleidoscope_ranching";
const { speciesOf } = await import("../../packs/BP/scripts/core/animal.js");
const { FEEDS: LIVE_FEEDS } = await import("../../packs/BP/scripts/data/feeds.js");
const sent = (name) => system.__scriptEvents.filter((e) => e.id === `${API}:${name}`).map((e) => JSON.parse(e.message));
const lastResult = () => sent("api_result").at(-1);
function call(name, payload) {
  system.sendScriptEvent(`${API}:${name}`, typeof payload === "string" ? payload : JSON.stringify(payload));
  return lastResult();
}
/** An animal from another add-on: no sex property, sex and livestock come from families. */
function outsider(type, x, sex, z = 0) {
  return overworld.__spawnVanilla(type, at(x, z), {
    "minecraft:type_family": { family: ["mob", "ranching_livestock", `ranching_${sex}`] },
  });
}

__setMaxStack("kr_example:alpaca_carcass", 1);

// The example add-on registers through the same events a real one would.
await import("../../examples/api-example/BP/scripts/main.js");
world.afterEvents.worldLoad.fire({});
__advance(60);

test("M5: a ping is answered with api_ready and the v1 capabilities", () => {
  system.__scriptEvents.length = 0;
  system.sendScriptEvent(`${API}:api_ping`, "");
  const ready = sent("api_ready").at(-1);
  equal(ready?.api, 1, "api version");
  for (const capability of ["register_animal", "register_feed", "register_recipe", "register_butcher", "animal_event"]) {
    assert(ready.capabilities.includes(capability), capability);
  }
});

test("M5 acceptance: the example add-on registers its alpaca, feed, cuts and recipe", () => {
  const alpaca = speciesOf({ typeId: "kr_example:alpaca" });
  assert(alpaca, "alpaca known to Ranching");
  equal(alpaca.dailyProduct.via, "milking_pail", "milked");
  equal(LIVE_FEEDS["kr_example:hay_cube"]?.units, 2, "hay cube is feed");
});

test("M5: a registered animal is fed at the trough, milked by quality, and drops its carcass", () => {
  clearWorld();
  const player = __newPlayer(at(0, -3));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  const female = outsider("kr_example:alpaca", 1, "female");
  hold(player, "kr_example:hay_cube", 4);
  troughComponent.onPlayerInteract({ block: trough, player });
  runBlockClock();
  equal(female.getDynamicProperty("kr:fed_day"), Math.floor(world.getAbsoluteTime() / DAY), "ate from the trough");

  // Five hearts, but today's feed was hay (tier 1): plain milk.
  care.setAffection(female, 100);
  careFor(female);
  hold(player, `${API}:milking_pail`);
  player.inventory.setItem(5, new ItemStack("minecraft:glass_bottle", 1));
  system.__scriptEvents.length = 0;
  assert(__interact(player, female), "pail handled");
  equal(player.inventory.count("kr_example:alpaca_milk"), 1, "alpaca milk at the quality hay earns");
  const harvest = sent("animal_event").find((e) => e.type === "harvested");
  equal(harvest?.items?.["kr_example:alpaca_milk"], 1, "harvest broadcast");

  female.kill();
  equal(overworld.items.filter((d) => d.item.typeId === "kr_example:alpaca_carcass").length, 1, "carcass dropped");
});

test("M5: a registered carcass is cut on the butcher rack", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const male = outsider("kr_example:alpaca", 1, "male");
  male.kill();
  const carcass = overworld.items.pop().item;
  equal(carcass.getDynamicProperty(`${API}:carcass_male`), true, "remembers the male");
  const rack = rackAt();
  player.inventory.setItem(0, carcass);
  use(RACK, rack, player);
  equal(rack.permutation.getState(`${API}:carcass`), "sheep", "borrowed look");
  system.__scriptEvents.length = 0;
  cutAll(player, rack);
  equal(rack.permutation.getState(`${API}:carcass`), "none", "rack emptied");
  assert(player.inventory.count("minecraft:mutton") >= 3, "male bonus mutton");
  assert(player.inventory.count(`${API}:large_bone`) >= 1, "Ranching items allowed as cuts");
  assert(sent("animal_event").some((e) => e.type === "butchered" && e.carcass === "kr_example:alpaca_carcass"), "butchered broadcast");
});

test("M5: a registered recipe runs in the fermenting jar", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const jar = stationAt("fermenting_jar");
  player.inventory.setItem(0, new ItemStack("kr_example:alpaca_milk_fine", 1));
  use(STATION, jar, player);
  __skipTime(DAY);
  use(STATION, jar, player);
  equal(player.inventory.count("kr_example:alpaca_yogurt"), 1, "yogurt (fine ×1.5 rounds down)");
});

test("M5: registered animals breed, and the birth is broadcast", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const female = outsider("kr_example:alpaca", 1, "female");
  const male = outsider("kr_example:alpaca", 2, "male");
  careFor(female);
  careFor(male);
  hold(player, "kr_example:hay_cube", 2);
  __interact(player, female);
  __interact(player, male);
  assert(female.getDynamicProperty(`${API}:pregnant_due`) > 0, "pregnant");
  system.__scriptEvents.length = 0;
  __skipTime(DAY * 3);
  __advance(700);
  equal(overworld.getEntities({ type: "kr_example:alpaca" }).length, 3, "a young alpaca");
  assert(sent("animal_event").some((e) => e.type === "born" && e.animal === "kr_example:alpaca"), "born broadcast");
});

test("M5: a registered bird lays into the nest box and its fertilized egg hatches in the incubator", () => {
  const result = call("register_animal", {
    id: "kr_test:quail",
    reproduction: "egg",
    carcass: "kr_test:quail_carcass",
    dailyProduct: { via: "nest_box", items: ["kr_test:quail_egg", "kr_test:quail_egg_fine", "kr_test:quail_egg_superb"] },
    fertilizedEgg: "kr_test:fertilized_quail_egg",
    care: { eats: ["grain"] },
  });
  equal(result.ok, true, `registered (${result.error})`);
  clearWorld();
  const player = __newPlayer(at(0));
  const nest = nestAt();
  outsider("kr_test:quail", 2, "female");
  use(NEST, nest, player);
  equal(player.inventory.count("kr_test:quail_egg"), 1, "quail egg collected");

  const incubator = __place(overworld, { x: 5, y: 64, z: 0 }, `${API}:incubator`, { [`${API}:eggs`]: 0, [`${API}:busy`]: false });
  __place(overworld, { x: 5, y: 63, z: 0 }, "minecraft:campfire");
  hold(player, "kr_test:fertilized_quail_egg");
  use(INCUBATOR, incubator, player);
  system.__scriptEvents.length = 0;
  __skipTime(DAY * 2);
  runBlockClock();
  equal(overworld.getEntities({ type: "kr_test:quail" }).length, 2, "a quail hatched");
  assert(sent("animal_event").some((e) => e.type === "hatched" && e.animal === "kr_test:quail"), "hatched broadcast");
});

test("M5: built-in and foreign-namespace registrations are refused; bad input gets a reason", () => {
  let r = call("register_animal", { id: `${API}:cow`, reproduction: "gestation", breedItems: ["minecraft:wheat"] });
  equal(r.ok, false, "cannot replace a Ranching animal");
  assert(/own namespace/.test(r.error), r.error);
  r = call("register_feed", { item: "minecraft:wheat", kind: "veg" });
  equal(r.ok, false, "cannot re-register vanilla wheat");
  equal(LIVE_FEEDS["minecraft:wheat"].kind, 1, "wheat unchanged");
  r = call("register_recipe", { id: "kr_test:bad", station: "furnace", inputs: [{ item: "minecraft:egg" }], outputs: [{ item: "minecraft:cake" }] });
  equal(r.ok, false, "unknown station");
  r = call("register_butcher", "{not json");
  equal(r.ok, false, "invalid JSON");
  r = call("register_feed", { item: "kr_test:oats", kind: "grain" });
  equal(r.ok, true, "a valid feed");
  r = call("register_feed", { item: "kr_test:oats", kind: "grain", units: 3 });
  equal(r.ok, true, "registering again is safe");
  equal(LIVE_FEEDS["kr_test:oats"].units, 3, "and updates it");
});

test("M5: a registered animal without a carcass dies quietly, and its own gestation days count", () => {
  const result = call("register_animal", { id: "kr_test:llama", reproduction: "gestation", days: 5, breedItems: ["minecraft:wheat"] });
  equal(result.ok, true, `registered (${result.error})`);
  clearWorld();
  const player = __newPlayer(at(0));
  const female = outsider("kr_test:llama", 1, "female");
  const male = outsider("kr_test:llama", 2, "male");
  careFor(female);
  careFor(male);
  hold(player, "minecraft:wheat", 2);
  system.__scriptEvents.length = 0;
  __interact(player, female);
  __interact(player, male);
  const due = female.getDynamicProperty(`${API}:pregnant_due`);
  assert(due > 0, "pregnant");
  equal(Math.round((due - world.getAbsoluteTime()) / DAY), 5, "five days, not the default three");
  assert(sent("animal_event").some((e) => e.type === "mated" && e.mother === female.id && e.father === male.id), "mated broadcast");
  male.kill();
  equal(overworld.items.length, 0, "no carcass, no drop");
  // The rack still recognises carcasses listed after the carcass-less animal.
  const quail = outsider("kr_test:quail", 3, "female");
  quail.kill();
  const rack = rackAt();
  player.inventory.setItem(player.selectedSlotIndex, overworld.items.pop().item);
  use(RACK, rack, player);
  equal(rack.permutation.getState(`${API}:carcass`), "none", "a carcass without cuts is not hung");
  hold(player, "kr_example:alpaca_carcass");
  use(RACK, rack, player);
  equal(rack.permutation.getState(`${API}:carcass`), "sheep", "an alpaca carcass still hangs");
});

test("M5: a registered egg hatches after its own incubation days", () => {
  const result = call("register_animal", {
    id: "kr_test:emu", reproduction: "egg", days: 4, fertilizedEgg: "kr_test:fertilized_emu_egg",
  });
  equal(result.ok, true, `registered (${result.error})`);
  clearWorld();
  const player = __newPlayer(at(0));
  const incubator = __place(overworld, { x: 20, y: 64, z: 0 }, `${API}:incubator`, { [`${API}:eggs`]: 0, [`${API}:busy`]: false });
  __place(overworld, { x: 20, y: 63, z: 0 }, "minecraft:campfire");
  hold(player, "kr_test:fertilized_emu_egg");
  use(INCUBATOR, incubator, player);
  __skipTime(DAY * 3);
  runBlockClock();
  equal(overworld.getEntities({ type: "kr_test:emu" }).length, 0, "not yet after three days");
  __skipTime(DAY + 10);
  runBlockClock();
  equal(overworld.getEntities({ type: "kr_test:emu" }).length, 1, "hatched after four");
});

const blockStore = await import("../../packs/BP/scripts/core/blockStore.js");
test("M5: a running batch of a registered recipe keeps its duration when the recipe is unknown", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const jar = stationAt("fermenting_jar");
  player.inventory.setItem(0, new ItemStack("kr_example:alpaca_milk", 1));
  use(STATION, jar, player);
  // After a world reload the block data survives but the registration does not.
  blockStore.setBlockData(jar, { ...blockStore.getBlockData(jar), recipe: "kr_gone:recipe" });
  use(STATION, jar, player);
  equal(player.inventory.count("kr_example:alpaca_yogurt"), 0, "not handed out early");
  __skipTime(DAY);
  use(STATION, jar, player);
  equal(player.inventory.count("kr_example:alpaca_yogurt"), 1, "collected when the time is up");
});

test("M5: query_animal answers with sex, hearts, needs and pregnancy", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  const bull = ranch("cow", 2, "male");
  careFor(cow);
  careFor(bull);
  care.setAffection(cow, 60);
  hold(player, "minecraft:wheat", 2);
  __interact(player, cow);
  __interact(player, bull);
  system.sendScriptEvent(`${API}:query_animal`, JSON.stringify({ entity: cow.id, ref: "q1" }));
  const info = sent("animal_info").at(-1);
  equal(info.found, true, "found");
  equal(info.ref, "q1", "ref echoed");
  equal(info.animal, `${API}:cow`, "type");
  equal(info.sex, "female", "sex");
  equal(info.baby, false, "adult");
  equal(info.hearts, 3, "hearts");
  equal(info.needs.all, true, "needs met");
  equal(info.pregnant, true, "pregnant");
  equal(info.dueInDays, 3, "due in three days");
  system.sendScriptEvent(`${API}:query_animal`, JSON.stringify({ entity: bull.id }));
  equal(sent("animal_info").at(-1).pregnant, false, "the bull is not");
  system.sendScriptEvent(`${API}:query_animal`, JSON.stringify({ entity: player.id }));
  equal(sent("animal_info").at(-1).found, false, "a player is not a Ranching animal");
  system.sendScriptEvent(`${API}:query_animal`, "not json");
  assert(sent("animal_info").at(-1).error, "bad input gets a reason");
});

test("M5: petting, brushing and treats are broadcast as cared events", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  system.__scriptEvents.length = 0;
  hold(player, `${NS}:brush`);
  __interact(player, cow);
  hold(player, `${NS}:brush`);
  __interact(player, cow);
  hold(player, `${NS}:alfalfa_cake`);
  __interact(player, cow);
  const cared = sent("animal_event").filter((e) => e.type === "cared" && e.entity === cow.id);
  equal(cared.map((e) => e.kind).join(","), "brush,treat", "one brush (the second does nothing) and one treat");
  equal(cared[0].player, player.id, "who did it");
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
