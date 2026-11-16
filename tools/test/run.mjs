import { readdirSync, readFileSync } from "node:fs";
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
  // 1.1 illness is random; tests switch it on where they test it (M11).
  world.setDynamicProperty("kr:cfg:disease", false);
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
const manureModule = await import("../../packs/BP/scripts/custom_components/manure.js");

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

test("production has no quality grades and does not depend on care", () => {
  clearWorld();
  const cow = ranch("cow", 1, "female");
  const day = Math.floor(world.getAbsoluteTime() / 24000);
  care.setAffection(cow, 100);
  careFor(cow, 3);
  equal(JSON.stringify(husbandry.production(cow, day)), JSON.stringify({ produces: true }), "5 hearts + concentrate");
  care.setAffection(cow, 20);
  equal(JSON.stringify(husbandry.production(cow, day)), JSON.stringify({ produces: true }), "1 heart, unfed");
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

const butcherData = await import("../../packs/BP/scripts/data/butcher.js");
const animalsData = await import("../../packs/BP/scripts/data/animals.js");
const await_species = await import("../../packs/BP/scripts/data/species.js");
const RACK = COMPONENTS["kaleidoscope_ranching:butcher_rack"];
const NEST = COMPONENTS["kaleidoscope_ranching:nest_box"];
const INCUBATOR = COMPONENTS["kaleidoscope_ranching:incubator"];
const STATION = COMPONENTS["kaleidoscope_ranching:station"];
const rackAt = (x = 10) => __place(overworld, { x, y: 64, z: 0 }, "kaleidoscope_ranching:butcher_rack", {
  "kaleidoscope_ranching:carcass": "none", "kaleidoscope_ranching:skinned": false, "kaleidoscope_ranching:cut": false,
  "kaleidoscope_ranching:drying": 0, "kaleidoscope_ranching:drying_mix": 0,
});
/** Breaks a block the way the game does: both hooks fire, the block is air by then. */
function breakBlock(component, block) {
  const brokenBlockPermutation = block.permutation;
  block.setType("minecraft:air");
  component.onPlayerBreak?.({ block, dimension: block.dimension, brokenBlockPermutation });
  component.onBreak?.({ block, dimension: block.dimension, brokenBlockPermutation });
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
  const stage = () => [rack.permutation.getState("kaleidoscope_ranching:skinned"), rack.permutation.getState("kaleidoscope_ranching:cut")];
  const stroke = () => { hold(player, "minecraft:iron_sword"); use(RACK, rack, player); };
  equal(stage().join(), "false,false", "whole, skin on, at first");
  stroke();
  equal(stage().join(), "true,false", "skinned after the pig skin comes off");
  // Half the strokes, rounded up (1.1 adds the offal strokes to the pig's cuts).
  const half = Math.ceil(butcherData.BUTCHER_TABLE.pig_carcass.cuts.length / 2);
  for (let i = 1; i < half - 1; i++) stroke();
  equal(stage().join(), "true,false", "still whole one stroke before half");
  stroke();
  equal(stage().join(), "true,true", `partly cut after ${half} strokes`);
});

test("feathered birds stay feathered until the down and feathers are both taken", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  player.inventory.setItem(0, carcassFrom("goose", "female"));
  use(RACK, rack, player);
  const skinned = () => rack.permutation.getState("kaleidoscope_ranching:skinned");
  hold(player, "minecraft:iron_sword");
  use(RACK, rack, player);
  equal(skinned(), false, "down off, feathers still on");
  hold(player, "minecraft:iron_sword");
  use(RACK, rack, player);
  equal(skinned(), true, "plucked");
  equal(rack.permutation.getState("kaleidoscope_ranching:cut"), false, "not yet cut");
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

const WHEEL = COMPONENTS["kaleidoscope_ranching:cheese_wheel"];
const wheelAt = (x = 10) => __place(overworld, { x, y: 64, z: 0 }, "kaleidoscope_ranching:cheese_wheel", { "kaleidoscope_ranching:cut": 0 });
const slicesHeld = (player) => {
  let n = 0;
  for (let i = 0; i < player.inventory.size; i++) {
    const item = player.inventory.getItem(i);
    if (item?.typeId === "kaleidoscope_ranching:cheese_slice") n += item.amount;
  }
  return n;
};

test("a placed cheese wheel is cut with a blade into four slices, then is gone", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const wheel = wheelAt();
  use(WHEEL, wheel, player);
  equal(slicesHeld(player), 0, "no slice without a blade");
  for (let n = 1; n <= 4; n++) {
    hold(player, "minecraft:iron_sword");
    use(WHEEL, wheel, player);
    equal(slicesHeld(player), n, `slice ${n}`);
    if (n < 4) equal(state(wheel, "cut"), n, `cut state ${n}`);
  }
  equal(wheel.permutation.type.id, "minecraft:air", "the last cut takes the wheel");
});

test("breaking a cheese wheel gives back the whole wheel, or the slices left", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  let wheel = wheelAt();
  breakBlock(WHEEL, wheel);
  equal(dropsOf("kaleidoscope_ranching:aged_cheese_wheel").length, 1, "uncut wheel back");

  overworld.items = [];
  wheel = wheelAt(12);
  hold(player, "minecraft:iron_sword");
  use(WHEEL, wheel, player);
  breakBlock(WHEEL, wheel);
  equal(dropsOf("kaleidoscope_ranching:aged_cheese_wheel").length, 0, "no wheel once cut");
  const atWheel = dropsOf("kaleidoscope_ranching:cheese_slice").filter((d) => Math.floor(d.location.x) === 12);
  equal(atWheel.reduce((n, d) => n + d.item.amount, 0), 3, "three slices left");
});

test("vintage and smoked wheels are placed and cut into their own slices", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  for (const [kind, x] of [["vintage", 20], ["smoked", 22]]) {
    const block = `kaleidoscope_ranching:${kind}_cheese_wheel`;
    equal(new ItemStack(block).typeId, block, "the wheel item exists");
    let wheel = __place(overworld, { x, y: 64, z: 0 }, block, { "kaleidoscope_ranching:cut": 0 });
    hold(player, "minecraft:iron_sword");
    use(WHEEL, wheel, player);
    equal(player.inventory.count(`kaleidoscope_ranching:${kind}_cheese_slice`), 1, `${kind} slice`);
    equal(player.inventory.count("kaleidoscope_ranching:cheese_slice"), 0, "not the aged slice");
    overworld.items = [];
    breakBlock(WHEEL, wheel);
    equal(dropsOf(`kaleidoscope_ranching:${kind}_cheese_slice`).reduce((n, d) => n + d.item.amount, 0), 3, "three slices left");
    overworld.items = [];
    wheel = __place(overworld, { x, y: 64, z: 2 }, block, { "kaleidoscope_ranching:cut": 0 });
    breakBlock(WHEEL, wheel);
    equal(dropsOf(block).length, 1, `uncut ${kind} wheel back`);
  }
});

const PLACED = COMPONENTS["kaleidoscope_ranching:placed_food"];

test("a placed pizza is eaten in four slices of three hunger, and not when full", () => {
  clearWorld();
  overworld.items = [];
  const player = __newPlayer(at(0));
  player.hunger = 4;
  const pizza = __place(overworld, { x: 30, y: 64, z: 0 }, "kaleidoscope_ranching:placed_pizza", { "kaleidoscope_ranching:cut": 0 });
  for (let n = 1; n <= 4; n++) {
    use(PLACED, pizza, player);
    equal(player.hunger, 4 + 3 * n, `slice ${n} feeds`);
    if (n < 4) equal(state(pizza, "cut"), n, `eaten state ${n}`);
  }
  equal(pizza.permutation.type.id, "minecraft:air", "the last slice takes the pizza");

  const second = __place(overworld, { x: 32, y: 64, z: 0 }, "kaleidoscope_ranching:placed_pizza", { "kaleidoscope_ranching:cut": 0 });
  player.hunger = 20;
  use(PLACED, second, player);
  equal(state(second, "cut"), 0, "nothing eaten when full");
  assert(player.actionBar.at(-1).translate.endsWith("food.full"), "told they are full");
  breakBlock(PLACED, second);
  equal(dropsOf("kaleidoscope_ranching:margherita_pizza").length, 1, "an untouched pizza is picked up whole");

  overworld.items = [];
  const third = __place(overworld, { x: 34, y: 64, z: 0 }, "kaleidoscope_ranching:placed_pizza", { "kaleidoscope_ranching:cut": 0 });
  player.hunger = 4;
  use(PLACED, third, player);
  breakBlock(PLACED, third);
  equal(overworld.items.length, 0, "a started pizza gives nothing back");
});

test("a placed fondue hands the bowl back with the last dip, or when broken once started", () => {
  clearWorld();
  overworld.items = [];
  const player = __newPlayer(at(0));
  player.hunger = 0;
  const pot = __place(overworld, { x: 40, y: 64, z: 0 }, "kaleidoscope_ranching:placed_fondue", { "kaleidoscope_ranching:cut": 0 });
  for (let n = 1; n <= 4; n++) use(PLACED, pot, player);
  equal(player.hunger, 12, "four dips of three");
  equal(player.inventory.count("minecraft:bowl"), 1, "the bowl comes back");
  equal(overworld.items.length, 0, "and only once: nothing is dropped as well");
  equal(pot.permutation.type.id, "minecraft:air", "the pot is gone");

  const second = __place(overworld, { x: 42, y: 64, z: 0 }, "kaleidoscope_ranching:placed_fondue", { "kaleidoscope_ranching:cut": 0 });
  player.hunger = 0;
  use(PLACED, second, player);
  breakBlock(PLACED, second);
  equal(dropsOf("minecraft:bowl").length, 1, "a started fondue drops its bowl");
  equal(dropsOf("kaleidoscope_ranching:cheese_fondue").length, 0, "but not the dish");
});

const { PLACED_FOODS } = await import("../../packs/BP/scripts/data/placedFoods.js");
const { DISHES: DISH_ROWS } = await import("../../packs/BP/scripts/data/dishes.js");

test("every shared dish is eaten in four portions worth at least the dish, and hands its bowl back", () => {
  const shared = PLACED_FOODS.filter((food) => food.eat && food.gives);
  assert(shared.length >= 9, "the fondue, six stews and two gratins");
  for (const [n, food] of shared.entries()) {
    clearWorld();
    overworld.items = [];
    const player = __newPlayer(at(0));
    player.hunger = 0;
    const block = `kaleidoscope_ranching:${food.block}`;
    const placed = __place(overworld, { x: 50 + n * 2, y: 64, z: 0 }, block, { "kaleidoscope_ranching:cut": 0 });
    for (let k = 0; k < food.portions; k++) use(PLACED, placed, player);
    equal(placed.permutation.type.id, "minecraft:air", `${food.block} is gone after the last portion`);
    equal(player.hunger, food.portions * food.eat, `${food.block} feeds portions x eat`);
    equal(player.inventory.count(food.gives), 1, `${food.block} hands back its bowl`);
    const dish = DISH_ROWS.find((d) => d.id === food.item);
    assert(dish && food.portions * food.eat >= dish.food[0], `${food.item}: sharing is worth at least eating it from the hand`);
    equal(dish.carrier, food.gives, `${food.item}: the bowl handed back is the dish's own carrier`);
    const item = JSON.parse(readFileSync(new URL(`../../packs/BP/items/r_${food.item}.json`, import.meta.url), "utf8"))["minecraft:item"].components;
    equal(item["minecraft:block_placer"]?.block, block, `${food.item} places ${food.block}`);
  }
});

test("the placeable foods carry a block placer and keep their own food value", () => {
  const item = (id) => JSON.parse(readFileSync(new URL(`../../packs/BP/items/r_${id}.json`, import.meta.url), "utf8"))["minecraft:item"].components;
  for (const [id, block] of [["aged_cheese_wheel", "cheese_wheel"], ["vintage_cheese_wheel", "vintage_cheese_wheel"], ["smoked_cheese_wheel", "smoked_cheese_wheel"], ["margherita_pizza", "placed_pizza"], ["cheese_fondue", "placed_fondue"]]) {
    equal(item(id)["minecraft:block_placer"]?.block, `kaleidoscope_ranching:${block}`, `${id} places ${block}`);
  }
  equal(item("margherita_pizza")["minecraft:food"].nutrition, 12, "the pizza can still be eaten from the hand");
});

// --- M3: milking and nursing ----------------------------------------------

test("milking gives one bottle per cow per day and needs an empty bottle", () => {
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
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk"), 1, "a bottle of cow milk");
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
  player.inventory.setItem(1, new ItemStack("kaleidoscope_ranching:goat_milk", 1));
  player.inventory.setItem(2, new ItemStack("kaleidoscope_ranching:cow_milk", 3));
  hold(player, "kaleidoscope_ranching:nursing_bottle");
  __interact(player, calf);
  __interact(player, calf);
  assert(isBaby(calf), "still a calf after two");
  __interact(player, calf);
  assert(!isBaby(calf), "grown after three");
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk") + player.inventory.count("kaleidoscope_ranching:goat_milk"), 1, "three bottles of milk used");
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

test("the cheese press takes three milk and works half a day", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const press = stationAt("cheese_press");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:cow_milk", 3));
  use(STATION, press, player);
  equal(press.permutation.getState("kaleidoscope_ranching:busy"), true, "working");
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk"), 0, "milk taken");
  use(STATION, press, player);
  assert(!player.actionBar.some((m) => m?.translate?.endsWith("station.working")), "no progress read-out (core/actionBar.js)");
  __skipTime(12000);
  use(STATION, press, player);
  equal(player.inventory.count("kaleidoscope_ranching:fresh_cheese"), 1, "one cheese");
  equal(player.inventory.count("kaleidoscope_ranching:whey"), 1, "and the whey");
  equal(press.permutation.getState("kaleidoscope_ranching:busy"), false, "idle again");
});

test("a station takes the milk in hand before other milk", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const churn = stationAt("butter_churn");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:goat_milk", 1));
  player.inventory.setItem(1, new ItemStack("kaleidoscope_ranching:cow_milk", 2));
  player.selectedSlotIndex = 1;
  use(STATION, churn, player); // holding cow milk: butter needs 2
  __skipTime(600);
  use(STATION, churn, player);
  equal(player.inventory.count("kaleidoscope_ranching:butter"), 1, "one butter");
  equal(player.inventory.count("kaleidoscope_ranching:goat_milk"), 1, "goat milk kept");
});

test("the tanning rack turns hides into leather in a day; sheepskin also gives wool", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = stationAt("tanning_rack");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:raw_hide", 1));
  use(STATION, rack, player);
  use(STATION, rack, player);
  equal(player.inventory.count("minecraft:leather"), 0, "not cured yet");
  __skipTime(24000);
  use(STATION, rack, player);
  equal(player.inventory.count("minecraft:leather"), 1, "leather from a cow's hide");
  player.inventory.setItem(8, new ItemStack("kaleidoscope_ranching:sheep_skin", 1));
  player.selectedSlotIndex = 8;
  use(STATION, rack, player);
  __skipTime(24000);
  use(STATION, rack, player);
  equal(player.inventory.count("minecraft:leather"), 2, "leather from sheepskin");
  equal(player.inventory.count("minecraft:white_wool"), 1, "and its fleece");
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

test("M5: a registered animal is fed at the trough, milked, and drops its carcass", () => {
  clearWorld();
  const player = __newPlayer(at(0, -3));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  const female = outsider("kr_example:alpaca", 1, "female");
  hold(player, "kr_example:hay_cube", 4);
  troughComponent.onPlayerInteract({ block: trough, player });
  runBlockClock();
  equal(female.getDynamicProperty("kr:fed_day"), Math.floor(world.getAbsoluteTime() / DAY), "ate from the trough");

  care.setAffection(female, 100);
  careFor(female);
  hold(player, `${API}:milking_pail`);
  player.inventory.setItem(5, new ItemStack("minecraft:glass_bottle", 1));
  system.__scriptEvents.length = 0;
  assert(__interact(player, female), "pail handled");
  equal(player.inventory.count("kr_example:alpaca_milk"), 1, "alpaca milk");
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
  player.inventory.setItem(0, new ItemStack("kr_example:alpaca_milk", 1));
  use(STATION, jar, player);
  __skipTime(DAY);
  use(STATION, jar, player);
  equal(player.inventory.count("kr_example:alpaca_yogurt"), 1, "yogurt");
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
    dailyProduct: { via: "nest_box", items: ["kr_test:quail_egg"] },
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

test("M5: malformed registrations get a readable reason, never a script error", () => {
  const bad = [
    ["register_animal", { id: "kr_test:x", reproduction: "gestation", breedItems: ["minecraft:wheat"], dailyProduct: null }, "dailyProduct"],
    ["register_animal", { id: "kr_test:x", reproduction: "gestation", breedItems: ["minecraft:wheat"], care: { brushDrops: ["minecraft:string"] } }, "brushDrops"],
    ["register_butcher", { carcass: "kr_test:x_carcass", cuts: [null] }, "cuts[0]"],
    ["register_recipe", { id: "kr_test:r", station: "butter_churn", inputs: [null], outputs: [{ item: "kr_test:o" }] }, "inputs[0]"],
    ["register_recipe", { id: "kr_test:r", station: "butter_churn", inputs: [{ item: "kr_test:i" }], outputs: ["kr_test:o"] }, "outputs[0]"],
  ];
  for (const [event, payload, field] of bad) {
    const r = call(event, payload);
    equal(r.ok, false, `${field} refused`);
    assert(r.error.includes(field) && !r.error.includes("TypeError"), `${field}: ${r.error}`);
  }
  system.sendScriptEvent(`${API}:query_animal`, "[]");
  assert(sent("animal_info").at(-1).error, "query needs an object");
});

test("items beyond one stack are split, not lost", () => {
  clearWorld();
  __setMaxStack("kr_test:big_egg", 1);
  const nest = nestAt();
  blockStore.setBlockData(nest, { eggs: { "kr_test:big_egg": 5 }, hatching: [] });
  breakBlock(NEST, nest);
  equal(dropsOf("kr_test:big_egg").reduce((sum, drop) => sum + drop.item.amount, 0), 5, "all five eggs dropped");
  // A compost bin gives back the manure put into it.
  const bin = __place(overworld, { x: 30, y: 64, z: 0 }, `${NS}:compost_bin`, { [`${NS}:stage`]: 0, [`${NS}:manure`]: 3 });
  const brokenBlockPermutation = bin.permutation;
  bin.setType("minecraft:air");
  compostBinComponent.onPlayerBreak({ block: bin, dimension: overworld, brokenBlockPermutation });
  equal(dropsOf(`${NS}:manure_item`).reduce((sum, drop) => sum + drop.item.amount, 0), 3, "manure returned");
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
  equal(sheep.getProperty("kaleidoscope_ranching:wool_color"), 5, "the client sees lime through wool_color");
});

test("a sheep saved before wool_color existed gets its colour on load", () => {
  clearWorld();
  const sheep = ranch("sheep", 1);
  sheep.triggerEvent("kaleidoscope_ranching:set_color_14");
  sheep.setProperty("kaleidoscope_ranching:wool_color", 0); // as an old save loads it
  world.afterEvents.entityLoad.fire({ entity: sheep });
  equal(sheep.getProperty("kaleidoscope_ranching:wool_color"), 14, "red again");
});

// --- Hay rack ------------------------------------------------------------------

const HAY_RACK = COMPONENTS["kaleidoscope_ranching:hay_rack"];
const { getBlockData: blockData } = await import("../../packs/BP/scripts/core/blockStore.js");
const hayUnits = (rack) => blockData(rack, {}).units ?? 0;

test("a hay rack takes only grass feed and holds four hay bales", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = place("hay_rack", at(0), { hay: 0 });
  hold(player, "minecraft:wheat_seeds", 1);
  use(HAY_RACK, rack, player);
  assert(player.actionBar.at(-1).translate.endsWith("hay_rack.only_grass"), "seeds refused");
  hold(player, "minecraft:hay_block", 1);
  use(HAY_RACK, rack, player);
  equal(hayUnits(rack), 9, "one bale is nine units");
  equal(state(rack, "hay"), 1, "low hay shown");
  hold(player, "minecraft:hay_block", 5);
  player.isSneaking = true;
  use(HAY_RACK, rack, player);
  player.isSneaking = false;
  equal(hayUnits(rack), 36, "filled to four bales");
  equal(player.inventory.count("minecraft:hay_block"), 2, "the rest stays in hand");
  equal(state(rack, "hay"), 3, "full hay shown");
  use(HAY_RACK, rack, player);
  assert(player.actionBar.at(-1).translate.endsWith("hay_rack.full"), "told it is full");
});

test("the hay rack feeds grass eaters once a day at tier 1, not chickens", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = place("hay_rack", at(0), { hay: 0 });
  hold(player, "minecraft:wheat", 3);
  player.isSneaking = true;
  use(HAY_RACK, rack, player);
  player.isSneaking = false;
  const cow = ranch("cow", 1, "female");
  const hen = ranch("chicken", 2, "female");
  runBlockClock();
  equal(care.feedTierToday(cow), 1, "cow fed at tier 1");
  assert(!care.isMarkedToday(hen, "fed"), "hen not fed hay");
  equal(hayUnits(rack), 2, "one unit eaten");
  runBlockClock();
  equal(hayUnits(rack), 2, "nothing more the same day");
  __skipTime(DAY);
  runBlockClock();
  equal(hayUnits(rack), 1, "eats again the next day");
});

test("a trough in reach feeds first; the hay rack keeps its hay", () => {
  clearWorld();
  const rack = place("hay_rack", at(0), { hay: 0 });
  const player = __newPlayer(at(0));
  hold(player, "minecraft:hay_block", 1);
  use(HAY_RACK, rack, player);
  place("trough", at(3), { fill: 5, kind: 5 });
  const cow = ranch("cow", 1, "female");
  runBlockClock();
  equal(care.feedTierToday(cow), 3, "concentrate from the trough");
  equal(hayUnits(rack), 9, "hay untouched");
});

test("breaking a hay rack gives the hay back once, as bales and wheat", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = place("hay_rack", at(0), { hay: 0 });
  hold(player, "minecraft:hay_block", 1);
  use(HAY_RACK, rack, player);
  hold(player, "minecraft:wheat", 4);
  player.isSneaking = true;
  use(HAY_RACK, rack, player);
  player.isSneaking = false;
  breakBlock(HAY_RACK, rack);
  equal(dropsOf("minecraft:hay_block").reduce((n, d) => n + d.item.amount, 0), 1, "one bale");
  equal(dropsOf("minecraft:wheat").reduce((n, d) => n + d.item.amount, 0), 4, "four wheat");
});

// --- M4: new animals -------------------------------------------------------------

test("ducks, geese, buffalo and yaks spawn with both sexes and Ranching families", () => {
  for (const type of ["duck", "goose", "buffalo", "yak"]) {
    clearWorld();
    const animals = Array.from({ length: 20 }, (_, i) => ranch(type, i));
    const sexes = new Set(animals.map((entity) => entity.getProperty(SEX)));
    assert(sexes.has("female") && sexes.has("male"), `${type}: both sexes`);
    const female = animals.find((entity) => entity.getProperty(SEX) === "female");
    assert(female.matches({ families: ["ranching_livestock", "ranching_female", type] }), `${type}: families`);
  }
});

test("only an adult gander picks fights with monsters", () => {
  clearWorld();
  const gander = ranch("goose", 1, "male");
  const goose = ranch("goose", 2, "female");
  assert(gander.hasComponent("minecraft:behavior.nearest_attackable_target"), "gander guards");
  assert(!goose.hasComponent("minecraft:behavior.nearest_attackable_target"), "goose does not");
});

test("ducks lay duck eggs in a nest box and a fertilized duck egg hatches a duckling", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const nest = nestAt();
  ranch("duck", 2, "female");
  use(NEST, nest, player);
  equal(player.inventory.count("kaleidoscope_ranching:duck_egg"), 1, "a duck egg");
  const incubator = __place(overworld, { x: 5, y: 64, z: 0 }, "kaleidoscope_ranching:incubator", {
    "kaleidoscope_ranching:eggs": 0, "kaleidoscope_ranching:busy": false,
  });
  INCUBATOR.onPlace({ block: incubator, dimension: overworld });
  __place(overworld, { x: 5, y: 63, z: 0 }, "minecraft:campfire");
  hold(player, "kaleidoscope_ranching:fertilized_duck_egg", 1);
  use(INCUBATOR, incubator, player);
  __advance(24000 * 2 + 1200);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:duck" }).filter(isBaby).length, 1, "duckling hatched");
});

test("a buffalo pair breeds, the cow gives buffalo milk, and its carcass cuts into buffalo meat", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("buffalo", 1, "female");
  const bull = ranch("buffalo", 2, "male");
  careFor(cow);
  careFor(bull);
  hold(player, "minecraft:wheat", 2);
  __interact(player, cow);
  hold(player, "minecraft:wheat", 1);
  __interact(player, bull);
  __skipTime(DAY * 3);
  __advance(700);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:buffalo" }).filter(isBaby).length, 1, "a calf");

  hold(player, "kaleidoscope_ranching:milking_pail");
  player.inventory.setItem(1, new ItemStack("minecraft:glass_bottle", 1));
  __interact(player, cow);
  equal(player.inventory.count("kaleidoscope_ranching:buffalo_milk"), 1, "buffalo milk");

  overworld.items = [];
  bull.kill();
  const rack = rackAt();
  player.inventory.setItem(0, dropsOf("kaleidoscope_ranching:buffalo_carcass")[0].item);
  use(RACK, rack, player);
  cutAll(player, rack);
  assert(player.inventory.count("kaleidoscope_ranching:buffalo_meat") >= 1, "buffalo meat");
});

test("yak manure left a day dries; the fork collects it as dried yak dung", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const { placeManureNear } = manureModule;
  __place(overworld, { x: 0, y: 63, z: 0 }, "minecraft:grass_block");
  __place(overworld, { x: 4, y: 63, z: 0 }, "minecraft:grass_block");
  const yak = ranch("yak", 0, "female");
  const cow = ranch("cow", 4, "female");
  placeManureNear(yak);
  placeManureNear(cow);
  hold(player, "kaleidoscope_ranching:manure_fork");
  COMPONENTS["kaleidoscope_ranching:manure_fork"].onUseOn({ source: player, block: overworld.getBlock(at(4)) });
  equal(dropsOf("kaleidoscope_ranching:manure_item").length, 1, "cow manure is manure");
  __skipTime(DAY);
  COMPONENTS["kaleidoscope_ranching:manure_fork"].onUseOn({ source: player, block: overworld.getBlock(at(0)) });
  equal(dropsOf("kaleidoscope_ranching:dried_yak_dung").length, 1, "yak manure dried");
});

// --- M4: crate, hitching post, cowbell ------------------------------------------

const CRATE_ITEM = COMPONENTS["kaleidoscope_ranching:animal_crate"];
const POST = COMPONENTS["kaleidoscope_ranching:hitching_post"];
const COWBELL = COMPONENTS["kaleidoscope_ranching:cowbell"];

test("a crated animal comes back with its sex, name, wool, affection and pregnancy", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const ewe = ranch("sheep", 1, "female");
  const ram = ranch("sheep", 2, "male");
  ewe.triggerEvent("kaleidoscope_ranching:set_color_14");
  ewe.nameTag = "Mimi";
  careFor(ewe);
  careFor(ram);
  care.setAffection(ewe, 70);
  hold(player, "minecraft:wheat", 2);
  __interact(player, ewe);
  hold(player, "minecraft:wheat", 1);
  __interact(player, ram);
  assert(ewe.getDynamicProperty("kaleidoscope_ranching:pregnant_due") > 0, "pregnant before crating");

  hold(player, "kaleidoscope_ranching:animal_crate");
  __interact(player, ewe);
  __advance(1);
  assert(!ewe.isValid, "the ewe went into the crate");
  const crate = player.inventory.getItem(player.selectedSlotIndex);
  assert(crate.getDynamicProperty("kaleidoscope_ranching:crate"), "crate holds a snapshot");
  assert(crate.getLore()[0].includes("Mimi"), "lore names the animal");

  const ground = __place(overworld, { x: 6, y: 63, z: 0 }, "minecraft:grass_block");
  CRATE_ITEM.onUseOn({ source: player, block: ground, blockFace: "Up" });
  __advance(1);
  const back = overworld.getEntities({ type: "kaleidoscope_ranching:sheep" }).find((e) => e.nameTag === "Mimi");
  assert(back, "released");
  equal(back.getProperty(SEX), "female", "sex kept");
  equal(back.getComponent("minecraft:color").value, 14, "wool colour kept");
  equal(care.getAffection(back), 70, "affection kept");
  assert(back.hasComponent("minecraft:persistent"), "stays in the world");
  equal(player.inventory.getItem(player.selectedSlotIndex).getDynamicProperty("kaleidoscope_ranching:crate"), undefined, "crate is empty again");

  __skipTime(DAY * 3);
  __advance(700);
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:sheep" }).filter(isBaby).length, 1, "the pregnancy carried over");
});

test("a leashed animal cannot be crated", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 1, "female");
  cow.getComponent("minecraft:leashable").leashTo(player);
  hold(player, "kaleidoscope_ranching:animal_crate");
  __interact(player, cow);
  __advance(1);
  assert(cow.isValid, "still here");
  assert(player.actionBar.at(-1).translate.endsWith("crate.leashed"), "told why");
});

test("the hitching post ties led animals and hands them back", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const post = place("hitching_post", at(0), {});
  const cow = ranch("cow", 2, "female");
  const goat = ranch("goat", 3, "male");
  for (const animal of [cow, goat]) animal.getComponent("minecraft:leashable").leashTo(player);
  POST.onPlayerInteract({ block: post, player });
  __advance(1);
  const knot = overworld.getEntities({ type: "kaleidoscope_ranching:hitch_knot" })[0];
  assert(knot, "a knot on the post");
  equal(cow.getComponent("minecraft:leashable").leashHolder, knot, "cow tied");
  equal(goat.getComponent("minecraft:leashable").leashHolder, knot, "goat tied");
  POST.onPlayerInteract({ block: post, player });
  __advance(1);
  equal(cow.getComponent("minecraft:leashable").leashHolder, player, "handed back");
  for (const animal of [cow, goat]) animal.getComponent("minecraft:leashable").leashTo(player);
  POST.onPlayerInteract({ block: post, player });
  __advance(1);
  breakBlock(POST, post);
  assert(!cow.getComponent("minecraft:leashable").isLeashed, "freed when the post breaks");
  equal(dropsOf("minecraft:lead").length, 2, "one lead back per animal, not more");
  equal(overworld.getEntities({ type: "kaleidoscope_ranching:hitch_knot" }).length, 0, "knot removed");
});

test("the cowbell calls only animals with three hearts or more", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const friend = ranch("cow", 5, "female");
  const stranger = ranch("cow", 6, "female");
  care.setAffection(friend, 3 * 20);
  care.setAffection(stranger, 20);
  COWBELL.onUse({ source: player });
  __advance(1);
  assert(friend.hasComponent("minecraft:timer"), "friend follows the bell");
  assert(!stranger.hasComponent("minecraft:timer"), "stranger ignores it");
  assert(friend.getComponent("minecraft:behavior.tempt").items.includes("kaleidoscope_ranching:cowbell"), "tempted by the bell");
});

// --- M5: Cookery dishes and guidebook ---------------------------------------------

const { DISHES } = await import("../../packs/BP/scripts/data/dishes.js");
const COOKERY_CAPS = ["wok", "stockpot_exact", "steamer", "chopping_board", "wok_meat_conversions", "guidebook_extensions", "oil_containers"];

test("when Cookery is ready every Cookery dish, the cheese board and the wok meats are registered", () => {
  system.__scriptEvents.length = 0;
  system.sendScriptEvent("kaleidoscope_cookery:api_ready", JSON.stringify({ api: 1, capabilities: COOKERY_CAPS }));
  const recipes = system.__scriptEvents.filter((e) => e.id === "kaleidoscope_cookery:register_recipe").map((e) => JSON.parse(e.message));
  const cookeryDishes = DISHES.filter((dish) => ["stockpot", "wok", "steamer"].includes(dish.station));
  for (const dish of cookeryDishes) {
    const sent = recipes.find((r) => r.recipe.result === `kaleidoscope_ranching:${dish.id}`);
    assert(sent, `${dish.id} registered`);
    assert(sent.api === 1 && sent.source === "kaleidoscope_ranching", `${dish.id} envelope`);
    if (sent.kind !== "steamer") {
      assert(sent.recipe.ingredients.length >= 1 && sent.recipe.ingredients.length <= 9, `${dish.id}: 1-9 slots`);
      for (const slot of sent.recipe.ingredients) for (const id of slot) assert(/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id), `${dish.id}: namespaced ${id}`);
    }
  }
  assert(recipes.some((r) => r.kind === "chopping_board" && r.recipe.input === "kaleidoscope_ranching:aged_cheese_wheel"), "cheese wheel on the board");
  const meats = system.__scriptEvents.filter((e) => e.id === "kaleidoscope_cookery:register_wok_meat").map((e) => JSON.parse(e.message));
  assert(meats.some((m) => m.raw === "kaleidoscope_ranching:duck_meat"), "duck meat converts in the wok");
  // Cookery's wok-meat check: source and raw are namespaced ids sharing a namespace.
  const ID = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;
  assert(meats.every((m) => ID.test(m.source) && ID.test(m.raw) && m.source.split(":")[0] === m.raw.split(":")[0]), "wok meats pass Cookery's checks");
  const oil = system.__scriptEvents.find((e) => e.id === "kaleidoscope_cookery:register_oil_container");
  assert(oil && JSON.parse(oil.message).container.id === "kaleidoscope_ranching:lard", "lard registered as wok oil");
  equal(new ItemStack("kaleidoscope_ranching:lard").maxAmount, 1, "lard does not stack, so it can hold its oil count");
  assert(cookeryDishes.length + DISHES.filter((d) => !["stockpot", "wok", "steamer"].includes(d.station)).length >= 20, "about twenty dishes");
});

test("every milk and the duck egg are accepted in the dishes that use them", () => {
  const recipes = system.__scriptEvents.filter((e) => e.id === "kaleidoscope_cookery:register_recipe").map((e) => JSON.parse(e.message));
  const tea = recipes.find((r) => r.recipe.result === "kaleidoscope_ranching:milk_tea");
  assert(tea.recipe.ingredients.some((slot) => slot.includes("kaleidoscope_ranching:yak_milk") && slot.includes("kaleidoscope_ranching:cow_milk")), "milk tea takes any milk");
  const eggs = recipes.find((r) => r.recipe.result === "kaleidoscope_ranching:tomato_duck_egg");
  assert(eggs.recipe.ingredients.some((slot) => slot.includes("kaleidoscope_ranching:duck_egg")), "the duck egg");
});

test("the guidebook chapter arrives in chunks under 2048 characters and parses back", () => {
  system.__scriptEvents.length = 0;
  system.sendScriptEvent("kaleidoscope_cookery:guidebook_ready", JSON.stringify({ api: 1 }));
  const events = system.__scriptEvents.filter((e) => e.id.startsWith("kaleidoscope_cookery:guidebook_") && e.id !== "kaleidoscope_cookery:guidebook_ready");
  equal(events[0].id, "kaleidoscope_cookery:guidebook_begin", "begins");
  equal(events.at(-1).id, "kaleidoscope_cookery:guidebook_end", "ends");
  const begin = JSON.parse(events[0].message);
  const chunks = events.filter((e) => e.id === "kaleidoscope_cookery:guidebook_chunk");
  equal(chunks.length, begin.chunks, "chunk count");
  assert(events.every((e) => e.message.length <= 2048), "every message fits a script event");
  const payload = JSON.parse(chunks.map((e) => e.message.split("\n").slice(4).join("\n")).join(""));
  for (const locale of ["en_US", "zh_TW", "zh_CN"]) {
    for (const entry of payload.entries) assert(payload.names[locale][entry.id], `${locale} name for ${entry.id}`);
    assert(payload.text[locale].intro.length < 4096, `${locale} intro fits`);
  }
  assert(payload.text.zh_TW.intro.startsWith("先從屠宰開始"), "butchering explained first");
  system.__scriptEvents.length = 0;
  system.sendScriptEvent("kaleidoscope_cookery:guidebook_ready", JSON.stringify({ api: 1 }));
  equal(system.__scriptEvents.filter((e) => e.id === "kaleidoscope_cookery:guidebook_begin").length, 0, "sent once per session");
});

test("whey from the cheese press fills a trough as mixed feed that pigs eat", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  hold(player, "kaleidoscope_ranching:whey", 1);
  troughComponent.onPlayerInteract({ block: trough, player, dimension: overworld });
  equal(state(trough, "kind"), 4, "mixed feed");
  const pig = ranch("pig", 1, "female");
  runBlockClock();
  equal(care.feedTierToday(pig), 2, "pig fed at tier 2");
});

// --- Walking to troughs ---------------------------------------------------

const { readFileSync: readJson } = await import("node:fs");
const SEEK = "minecraft:behavior.move_to_block";

test("animals look for troughs until they have eaten and drunk, and again the next day", () => {
  const cow = JSON.parse(readJson("packs/BP/entities/cow.json", "utf8"))["minecraft:entity"];
  const seek = cow.component_groups["kaleidoscope_ranching:seeking"]?.[SEEK];
  for (const block of ["trough", "hay_rack", "water_trough", "auto_waterer"]) {
    assert(seek?.target_blocks.includes(`kaleidoscope_ranching:${block}`), `walks to ${block}`);
  }
  clearWorld();
  const player = __newPlayer(at(0, -3));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  const water = place("water_trough", at(4), { water: 0 });
  const heifer = ranch("cow", 2, "female");
  assert(heifer.hasComponent(SEEK), "a new animal looks for feed");
  hold(player, `${NS}:mixed_feed`, 4);
  troughComponent.onPlayerInteract({ block: trough, player, dimension: overworld });
  runBlockClock();
  assert(heifer.hasComponent(SEEK), "fed but not yet watered: still looking");
  hold(player, "minecraft:water_bucket");
  waterTroughComponent.onPlayerInteract({ block: water, player, dimension: overworld });
  runBlockClock();
  assert(!heifer.hasComponent(SEEK), "fed and watered: stops looking");
  __skipTime(DAY);
  care.ensureSettled(heifer);
  assert(heifer.hasComponent(SEEK), "the next day it looks again");
});

// --- Optional integration: Fishing Voyage ------------------------------------

const { pingFishing } = await import("../../packs/BP/scripts/api/fishing.js");

test("Fishing Voyage: Ranching pings it, and its fish offal and bones become poultry feed only once it answers", () => {
  equal(LIVE_FEEDS["kaleidoscope_fishing:fish_offal"], undefined, "without Fishing, no Fishing items are feed");
  system.__scriptEvents.length = 0;
  pingFishing();
  assert(system.__scriptEvents.some((e) => e.id === "kaleidoscope_fishing:api_ping" && e.message === "kaleidoscope_ranching"), "Ranching pings Fishing with its namespace");
  system.sendScriptEvent("kaleidoscope_fishing:api_ready", "not json");
  equal(LIVE_FEEDS["kaleidoscope_fishing:fish_offal"], undefined, "a broken answer is ignored");
  system.sendScriptEvent("kaleidoscope_fishing:api_ready", JSON.stringify({ api: 1, source: "kaleidoscope_fishing", version: "1.4.0", capabilities: ["bait", "catch"] }));
  equal(LIVE_FEEDS["kaleidoscope_fishing:fish_offal"]?.units, 2, "fish offal is feed");
  equal(LIVE_FEEDS["kaleidoscope_fishing:fish_bones"]?.units, 1, "fish bones are feed");

  clearWorld();
  const player = __newPlayer(at(0, -3));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  hold(player, "kaleidoscope_fishing:fish_offal", 2);
  troughComponent.onPlayerInteract({ block: trough, player, dimension: overworld });
  equal(state(trough, "fill"), 2, "one offal fills two units");
  const cow = ranch("cow", 1, "female");
  const hen = ranch("chicken", 2, "female");
  runBlockClock();
  assert(care.isMarkedToday(hen, "fed"), "the hen ate it");
  assert(!care.isMarkedToday(cow, "fed"), "the cow did not");
});

// --- Roosters crow at dawn ----------------------------------------------------

const { crowAtDawn } = await import("../../packs/BP/scripts/systems/rooster.js");

test("roosters near a player crow once at dawn; hens and chicks do not", () => {
  clearWorld();
  __newPlayer(at(0));
  const rooster = ranch("chicken", 3, "male");
  ranch("chicken", 4, "female");
  const chick = ranch("chicken", 5, "male");
  chick.triggerEvent(`${NS}:become_baby`);
  ranch("chicken", 200, "male"); // too far from any player
  toTimeOfDay(12000);
  equal(crowAtDawn(), 0, "no crowing at noon");
  toTimeOfDay(23100);
  overworld.sounds.length = 0;
  equal(crowAtDawn(), 1, "one adult rooster in earshot");
  __advance(260);
  const calls = overworld.sounds.filter((s) => s.id === "mob.chicken.say");
  equal(calls.length, 3, "a three-note crow");
  assert(calls.every((s) => Math.abs(s.location.x - rooster.location.x) < 1), "from the rooster");
  equal(crowAtDawn(), 0, "only once per morning");
  toTimeOfDay(23100);
  equal(crowAtDawn(), 1, "and again the next dawn");
});

// --- Food waste bin ---------------------------------------------------------------

const { foodWasteBinComponent: BIN, CAPACITY: BIN_CAPACITY } = await import("../../packs/BP/scripts/systems/foodWasteBin.js");
const binAt = (x = 10) => __place(overworld, { x, y: 64, z: 0 }, "kaleidoscope_ranching:food_waste_bin", { "kaleidoscope_ranching:fill": 0 });
const held = (player, typeId) => {
  let n = 0;
  for (let i = 0; i < player.inventory.size; i++) {
    const item = player.inventory.getItem(i);
    if (item?.typeId === typeId) n += item.amount;
  }
  return n;
};

test("food goes into the waste bin one at a time, or a stack when sneaking, and comes out as scraps", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const bin = binAt();
  hold(player, "minecraft:bread", 3);
  use(BIN, bin, player);
  equal(held(player, "minecraft:bread"), 2, "one bread taken");
  equal(state(bin, "fill"), 1, "the bin shows scraps");
  player.isSneaking = true;
  use(BIN, bin, player);
  player.isSneaking = false;
  equal(held(player, "minecraft:bread"), 0, "sneaking tips in the rest");
  hold(player, "kaleidoscope_ranching:cream");
  use(BIN, bin, player);
  equal(held(player, "kaleidoscope_ranching:cream"), 0, "Ranching's own food goes in too");

  hold(player, "minecraft:stick");
  use(BIN, bin, player);
  equal(held(player, "kaleidoscope_ranching:food_waste"), 4, "four foods, four scraps");
  equal(held(player, "minecraft:stick"), 1, "a non-food is not taken");
  equal(state(bin, "fill"), 0, "empty again");
});

test("the waste bin refuses scraps and non-food, stops when full, and spills its contents when broken", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  let bin = binAt();
  hold(player, "kaleidoscope_ranching:food_waste", 5);
  use(BIN, bin, player);
  equal(held(player, "kaleidoscope_ranching:food_waste"), 5, "scraps do not go back in");

  player.isSneaking = true;
  hold(player, "minecraft:apple", 40);
  use(BIN, bin, player);
  equal(held(player, "minecraft:apple"), 40 - BIN_CAPACITY, "only up to capacity");
  equal(state(bin, "fill"), 4, "full");
  use(BIN, bin, player);
  equal(held(player, "minecraft:apple"), 40 - BIN_CAPACITY, "a full bin takes nothing");
  player.isSneaking = false;

  breakBlock(BIN, bin);
  equal(dropsOf("kaleidoscope_ranching:food_waste").reduce((n, d) => n + d.item.amount, 0), BIN_CAPACITY, "everything spills once");
});

test("scraps are vegetable feed: pigs eat them from a trough, cows do not", () => {
  clearWorld();
  const player = __newPlayer(at(0, -3));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  hold(player, "kaleidoscope_ranching:food_waste", 2);
  troughComponent.onPlayerInteract({ block: trough, player, dimension: overworld });
  equal(state(trough, "fill"), 1, "one portion of scraps is one unit");
  const pig = ranch("pig", 1, "female");
  const cow = ranch("cow", 2, "female");
  runBlockClock();
  assert(care.isMarkedToday(pig, "fed"), "the pig ate");
  assert(!care.isMarkedToday(cow, "fed"), "the cow did not");
});

// --- 1.1 M7: meat line and offal line -------------------------------------------

test("M7: a pig is cut for liver and intestine right after its skin", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  player.inventory.setItem(0, carcassFrom("pig", "female"));
  use(RACK, rack, player);
  hold(player, "minecraft:iron_sword");
  use(RACK, rack, player); // skin
  equal(rack.permutation.getState("kaleidoscope_ranching:skinned"), true, "skinned after the skin stroke");
  hold(player, "minecraft:iron_sword");
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:pork_liver"), 1, "liver is the next stroke");
  cutAll(player, rack);
  assert(player.inventory.count("kaleidoscope_ranching:pig_intestine") >= 1, "and the intestine");
});

test("M7: each animal gives its offal; sheep, goats and rabbits give none", () => {
  const { BUTCHER_TABLE } = butcherData;
  const offalOf = (carcass) => BUTCHER_TABLE[carcass].cuts.filter((cut) => cut.offal).map((cut) => cut.item);
  equal(offalOf("chicken_carcass").join(), "chicken_gizzard", "chicken");
  equal(offalOf("duck_carcass").join(), "duck_blood", "duck");
  equal(offalOf("goose_carcass").join(), "goose_liver", "goose");
  for (const c of ["cow_carcass", "buffalo_carcass", "yak_carcass"]) equal(offalOf(c).join(), "beef_tripe", c);
  for (const c of ["sheep_carcass", "goat_carcass", "rabbit_carcass"]) equal(offalOf(c).length, 0, c);
});

test("M7: intestine and tripe are washed at the water trough for one level of water", () => {
  clearWorld();
  const player = __newPlayer(at(0, -3));
  const water = place("water_trough", at(0), { water: 1 });
  hold(player, "kaleidoscope_ranching:pig_intestine", 2);
  waterTroughComponent.onPlayerInteract({ block: water, player, dimension: overworld });
  equal(player.inventory.count("kaleidoscope_ranching:cleaned_intestine"), 1, "one washed");
  equal(player.inventory.count("kaleidoscope_ranching:pig_intestine"), 1, "one left");
  equal(state(water, "water"), 0, "used one level");
  waterTroughComponent.onPlayerInteract({ block: water, player, dimension: overworld });
  equal(player.inventory.count("kaleidoscope_ranching:cleaned_intestine"), 1, "no water, no wash");
  assert(player.actionBar.at(-1).translate.endsWith("wash.no_water"), "says it is dry");
});

test("M7: the meat grinder gives one mince per use and makes sausages from mince and casing", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const grinder = stationAt("meat_grinder");
  hold(player, "minecraft:porkchop", 2);
  use(STATION, grinder, player);
  equal(player.inventory.count("kaleidoscope_ranching:pork_mince"), 1, "one mince at once");
  equal(player.inventory.count("minecraft:porkchop"), 1, "one chop used");
  equal(grinder.permutation.getState("kaleidoscope_ranching:busy"), false, "never busy");
  player.inventory.setItem(8, new ItemStack("kaleidoscope_ranching:beef_mince", 1));
  player.inventory.setItem(7, new ItemStack("kaleidoscope_ranching:sausage_casing", 1));
  player.selectedSlotIndex = 7;
  use(STATION, grinder, player);
  equal(player.inventory.count("kaleidoscope_ranching:raw_sausage"), 2, "two sausages");
  equal(player.inventory.count("kaleidoscope_ranching:sausage_casing"), 0, "casing used");
  equal(player.inventory.count("kaleidoscope_ranching:pork_mince") + player.inventory.count("kaleidoscope_ranching:beef_mince"), 0, "any two minces");
});

test("M7: an empty butcher rack air-dries up to four pieces for three days", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  hold(player, "kaleidoscope_ranching:raw_sausage", 5);
  for (let i = 0; i < 5; i++) use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:raw_sausage"), 1, "only four hang");
  assert(player.actionBar.at(-1).translate.endsWith("rack.drying_full"), "says it is full");
  player.inventory.setItem(8, carcassFrom("chicken", "female"));
  player.selectedSlotIndex = 8;
  use(RACK, rack, player);
  assert(player.actionBar.at(-1).translate.endsWith("rack.drying_busy"), "no carcass while drying");
  equal(rack.permutation.getState("kaleidoscope_ranching:carcass"), "none", "carcass not hung");
  __skipTime(24000 * 2);
  player.selectedSlotIndex = 6;
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:cured_sausage"), 0, "not done after two days");
  __skipTime(24000);
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:cured_sausage"), 4, "four cured sausages");
  player.selectedSlotIndex = 8;
  use(RACK, rack, player);
  equal(rack.permutation.getState("kaleidoscope_ranching:carcass"), "chicken", "empty again: a carcass hangs");
});

test("M7: breaking a drying rack drops dried pieces dried and the rest raw", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  hold(player, "kaleidoscope_ranching:pork_belly", 1);
  use(RACK, rack, player);
  __skipTime(24000 * 2);
  hold(player, "kaleidoscope_ranching:beef_shank", 1);
  use(RACK, rack, player);
  __skipTime(24000);
  breakBlock(RACK, rack);
  equal(dropsOf("kaleidoscope_ranching:cured_pork_belly").length, 1, "dried belly");
  equal(dropsOf("kaleidoscope_ranching:beef_shank").length, 1, "raw shank back");
  equal(dropsOf("kaleidoscope_ranching:beef_jerky").length, 0, "not jerky yet");
});

test("M7: goose liver and butter churn into pâté; raw offal is pig feed", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const churn = stationAt("butter_churn");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:goose_liver", 1));
  player.inventory.setItem(1, new ItemStack("kaleidoscope_ranching:butter", 1));
  use(STATION, churn, player);
  __skipTime(600);
  use(STATION, churn, player);
  equal(player.inventory.count("kaleidoscope_ranching:foie_gras_pate"), 1, "pâté");
  const trough = place("trough", at(0, 3), { fill: 0, kind: 0 });
  hold(player, "kaleidoscope_ranching:pork_liver", 1);
  troughComponent.onPlayerInteract({ block: trough, player, dimension: overworld });
  equal(state(trough, "fill"), 1, "offal fills the trough");
});

// --- 1.1 M8: egg & dairy line and cheese line ------------------------------------

const MILKING_RACK = COMPONENTS["kaleidoscope_ranching:milking_rack"];
const AUTO_STATION = COMPONENTS["kaleidoscope_ranching:auto_station"];
const { tickAutoStation } = await import("../../packs/BP/scripts/systems/stations.js");
const { tickMilkingRack } = await import("../../packs/BP/scripts/systems/milkingRack.js");
const { rootForTruffle } = await import("../../packs/BP/scripts/systems/truffle.js");
const hopperAt = (location) => __place(overworld, location, "minecraft:hopper");
const hopperItems = (hopper) => hopper.getComponent("minecraft:inventory").container;

test("M8: the cheese press makes a cheese per milk", () => {
  for (const [milk, cheese] of [["goat_milk", "goat_cheese"], ["buffalo_milk", "mozzarella"], ["yak_milk", "chhurpi"], ["cow_milk", "fresh_cheese"]]) {
    clearWorld();
    const player = __newPlayer(at(0));
    const press = stationAt("cheese_press");
    hold(player, `kaleidoscope_ranching:${milk}`, 3);
    use(STATION, press, player);
    __skipTime(12000);
    use(STATION, press, player);
    equal(player.inventory.count(`kaleidoscope_ranching:${cheese}`), 1, `${milk} → ${cheese}`);
  }
});

test("M8: whey presses into ricotta, skim milk into milk tofu", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const press = stationAt("cheese_press");
  hold(player, "kaleidoscope_ranching:whey", 3);
  use(STATION, press, player);
  __skipTime(6000);
  use(STATION, press, player);
  equal(player.inventory.count("kaleidoscope_ranching:ricotta"), 1, "ricotta");
  hold(player, "kaleidoscope_ranching:skim_milk", 3);
  use(STATION, press, player);
  __skipTime(12000);
  use(STATION, press, player);
  equal(player.inventory.count("kaleidoscope_ranching:milk_tofu"), 2, "milk tofu");
});

test("M8: a wheel left seven days is vintage; over a lit campfire it comes out smoked", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = stationAt("aging_rack");
  hold(player, "kaleidoscope_ranching:fresh_cheese", 4);
  use(STATION, rack, player);
  __skipTime(24000 * 7);
  use(STATION, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:vintage_cheese_wheel"), 1, "vintage after 7 days");
  equal(player.inventory.count("kaleidoscope_ranching:aged_cheese_wheel"), 0, "not the 3-day wheel");
  hold(player, "kaleidoscope_ranching:fresh_cheese", 4);
  use(STATION, rack, player);
  __skipTime(24000 * 3);
  use(STATION, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:aged_cheese_wheel"), 1, "3 days: the 1.0 wheel");
  __place(overworld, { x: 0, y: 63, z: 0 }, "minecraft:campfire");
  hold(player, "kaleidoscope_ranching:fresh_cheese", 4);
  use(STATION, rack, player);
  __skipTime(24000 * 3);
  use(STATION, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:smoked_cheese_wheel"), 1, "smoked over the fire");
});

test("M8: the cream separator takes milk from above and puts cream and skim milk below", () => {
  clearWorld();
  const separator = __place(overworld, { x: 0, y: 64, z: 0 }, "kaleidoscope_ranching:cream_separator", { "kaleidoscope_ranching:busy": false });
  const above = hopperAt({ x: 0, y: 65, z: 0 });
  const below = hopperAt({ x: 0, y: 63, z: 0 });
  hopperItems(above).addItem(new ItemStack("kaleidoscope_ranching:goat_milk", 2));
  tickAutoStation(separator);
  equal(separator.permutation.getState("kaleidoscope_ranching:busy"), true, "started on its own");
  equal(hopperItems(above).count("kaleidoscope_ranching:goat_milk"), 1, "one bottle taken");
  __skipTime(12000);
  tickAutoStation(separator);
  equal(hopperItems(below).count("kaleidoscope_ranching:cream"), 1, "cream");
  equal(hopperItems(below).count("kaleidoscope_ranching:skim_milk"), 1, "and the skim milk");
  equal(separator.permutation.getState("kaleidoscope_ranching:busy"), true, "and took the next bottle");
  const player = __newPlayer(at(3));
  hold(player, "kaleidoscope_ranching:cow_milk", 1);
  breakBlock(AUTO_STATION, separator);
  equal(dropsOf("kaleidoscope_ranching:goat_milk").length, 1, "breaking it mid-batch gives the milk back");
});

test("M8: the ice cream churn is instant and uses the flavour you carry", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const churn = stationAt("ice_cream_churn");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:cream", 2));
  player.inventory.setItem(1, new ItemStack("minecraft:sugar", 2));
  player.inventory.setItem(2, new ItemStack("minecraft:ice", 2));
  player.inventory.setItem(3, new ItemStack("minecraft:sweet_berries", 1));
  use(STATION, churn, player);
  equal(player.inventory.count("kaleidoscope_ranching:berry_ice_cream"), 2, "berries carried: berry");
  use(STATION, churn, player);
  equal(player.inventory.count("kaleidoscope_ranching:vanilla_ice_cream"), 2, "no berries left: vanilla");
});

test("M8: custard needs eggs in hand; milk in hand still makes butter", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const churn = stationAt("butter_churn");
  player.inventory.setItem(0, new ItemStack("kaleidoscope_ranching:cow_milk", 3));
  player.inventory.setItem(1, new ItemStack("minecraft:egg", 2));
  player.inventory.setItem(2, new ItemStack("minecraft:sugar", 1));
  use(STATION, churn, player);
  __skipTime(600);
  use(STATION, churn, player);
  equal(player.inventory.count("kaleidoscope_ranching:butter"), 1, "butter");
  equal(player.inventory.count("minecraft:egg"), 2, "eggs untouched");
  player.selectedSlotIndex = 1;
  use(STATION, churn, player);
  __skipTime(300);
  use(STATION, churn, player);
  equal(player.inventory.count("kaleidoscope_ranching:custard"), 2, "custard");
});

test("M8: the milking rack milks its cow once a day into the container below", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = place("milking_rack", at(0), {});
  const above = hopperAt({ x: 0, y: 65, z: 0 });
  const below = hopperAt({ x: 0, y: 63, z: 0 });
  hopperItems(above).addItem(new ItemStack("minecraft:glass_bottle", 3));
  const bull = ranch("cow", 2, "male");
  bull.getComponent("minecraft:leashable").leashTo(player);
  MILKING_RACK.onPlayerInteract({ block: rack, player });
  __advance(1);
  assert(player.actionBar.at(-1).translate.endsWith("milking_rack.not_milkable"), "no bulls");
  bull.getComponent("minecraft:leashable").unleash();
  const cow = ranch("cow", 2, "female");
  cow.getComponent("minecraft:leashable").leashTo(player);
  MILKING_RACK.onPlayerInteract({ block: rack, player });
  __advance(1);
  assert(!player.actionBar.some((m) => m?.translate?.endsWith("milking_rack.tied")), "tying shows no hint (core/actionBar.js)");
  tickMilkingRack(rack);
  equal(hopperItems(below).count("kaleidoscope_ranching:cow_milk"), 1, "one bottle of milk below");
  equal(hopperItems(above).count("minecraft:glass_bottle"), 2, "one empty bottle used");
  tickMilkingRack(rack);
  equal(hopperItems(below).count("kaleidoscope_ranching:cow_milk"), 1, "once a day");
  __skipTime(24000);
  tickMilkingRack(rack);
  equal(hopperItems(below).count("kaleidoscope_ranching:cow_milk"), 2, "again the next day");
  MILKING_RACK.onPlayerInteract({ block: rack, player });
  __advance(1);
  equal(cow.getComponent("minecraft:leashable").leashHolder, player, "handed back");
});

test("M8: a full-hearted pig in a forest roots up truffles; others do not", () => {
  clearWorld();
  __place(overworld, { x: 1, y: 63, z: 0 }, "minecraft:podzol");
  __place(overworld, { x: 3, y: 64, z: 0 }, "minecraft:oak_log");
  const pig = ranch("pig", 1, "female");
  care.setAffection(pig, 100);
  assert(rootForTruffle(pig, 0), "found one");
  equal(dropsOf("kaleidoscope_ranching:truffle").length, 1, "truffle on the ground");
  assert(!rootForTruffle(pig, 0), "once a day");
  const shy = ranch("pig", 1, "male", 0);
  care.setAffection(shy, 60);
  assert(!rootForTruffle(shy, 0), "not without full hearts");
});

test("M8: the nursing bottle uses skim milk before whole milk", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const calf = ranch("cow", 1, "female");
  calf.triggerEvent("kaleidoscope_ranching:become_baby");
  player.inventory.setItem(1, new ItemStack("kaleidoscope_ranching:cow_milk", 1));
  player.inventory.setItem(2, new ItemStack("kaleidoscope_ranching:skim_milk", 1));
  hold(player, "kaleidoscope_ranching:nursing_bottle");
  __interact(player, calf);
  __advance(1);
  equal(player.inventory.count("kaleidoscope_ranching:skim_milk"), 0, "skim milk used");
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk"), 1, "whole milk kept");
});

// --- 1.1 M9: leather, fluff, cloth, hatching and feed -------------------------------

const textiles = await import("../../packs/BP/scripts/systems/textiles.js");
const { tryMoult } = await import("../../packs/BP/scripts/systems/moult.js");
const { candle } = await import("../../packs/BP/scripts/systems/nest.js");
const RUG = COMPONENTS["kaleidoscope_ranching:rug"];

test("M9: the tanning rack takes four rabbit hides, and oils leather with tallow", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = stationAt("tanning_rack");
  hold(player, "minecraft:rabbit_hide", 4);
  use(STATION, rack, player);
  __skipTime(24000);
  use(STATION, rack, player);
  equal(player.inventory.count("minecraft:leather"), 1, "leather from rabbit hide");
  player.inventory.setItem(5, new ItemStack("kaleidoscope_ranching:beef_tallow", 1));
  use(STATION, rack, player); // holding the leather in slot 0
  __skipTime(24000);
  use(STATION, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:oiled_leather"), 1, "oiled leather");
  equal(player.inventory.count("kaleidoscope_ranching:beef_tallow"), 0, "tallow used");
});

test("M9: the spinning wheel and the loom run from the container above into the one below", () => {
  clearWorld();
  const wheel = __place(overworld, { x: 0, y: 64, z: 0 }, "kaleidoscope_ranching:spinning_wheel", { "kaleidoscope_ranching:busy": false });
  const above = hopperAt({ x: 0, y: 65, z: 0 });
  const below = hopperAt({ x: 0, y: 63, z: 0 });
  hopperItems(above).addItem(new ItemStack("minecraft:red_wool", 1));
  hopperItems(above).addItem(new ItemStack("kaleidoscope_ranching:goat_cashmere", 2));
  tickAutoStation(wheel);
  __skipTime(12000);
  tickAutoStation(wheel);
  __skipTime(12000);
  tickAutoStation(wheel);
  equal(hopperItems(below).count("kaleidoscope_ranching:yarn"), 2, "wool → 2 yarn");
  equal(hopperItems(below).count("kaleidoscope_ranching:fine_yarn"), 2, "cashmere → 2 fine yarn");
  const loom = stationAt("weaving_loom", 5);
  const player = __newPlayer(at(5));
  hold(player, "kaleidoscope_ranching:fine_yarn", 2);
  use(AUTO_STATION, loom, player);
  __skipTime(12000);
  use(AUTO_STATION, loom, player);
  equal(player.inventory.count("kaleidoscope_ranching:plush_cloth"), 1, "the loom also works by hand");
});

test("M9: silage is concentrate for ruminants only; calcium feed for poultry only", () => {
  clearWorld();
  const barrel = __place(overworld, { x: 0, y: 64, z: 5 }, "kaleidoscope_ranching:silage_barrel", { "kaleidoscope_ranching:busy": false });
  hopperItems(hopperAt({ x: 0, y: 65, z: 5 })).addItem(new ItemStack("kaleidoscope_ranching:forage", 4));
  const out = hopperAt({ x: 0, y: 63, z: 5 });
  tickAutoStation(barrel);
  __skipTime(24000 * 3);
  tickAutoStation(barrel);
  equal(hopperItems(out).count("kaleidoscope_ranching:silage"), 4, "four silage after three days");
  const player = __newPlayer(at(0, -3));
  const trough = place("trough", at(0), { fill: 0, kind: 0 });
  hold(player, "kaleidoscope_ranching:silage", 1);
  troughComponent.onPlayerInteract({ block: trough, player, dimension: overworld });
  const cow = ranch("cow", 1, "female");
  const hen = ranch("chicken", 2, "female");
  runBlockClock();
  assert(care.isMarkedToday(cow, "fed"), "the cow ate silage");
  assert(!care.isMarkedToday(hen, "fed"), "the hen did not");
  clearWorld();
  const trough2 = place("trough", at(0), { fill: 0, kind: 0 });
  const p2 = __newPlayer(at(0, -3));
  hold(p2, "kaleidoscope_ranching:calcium_feed", 1);
  troughComponent.onPlayerInteract({ block: trough2, player: p2, dimension: overworld });
  const hen2 = ranch("chicken", 1, "female");
  const cow2 = ranch("cow", 2, "female");
  runBlockClock();
  assert(care.isMarkedToday(hen2, "fed"), "the hen ate calcium feed");
  assert(!care.isMarkedToday(cow2, "fed"), "the cow did not");
});

test("M9: well-kept ducks shed down once a day; goats and rabbits brush out fine fleece", () => {
  clearWorld();
  const duck = ranch("duck", 1, "female");
  care.setAffection(duck, 80);
  assert(tryMoult(duck, 0), "shed");
  equal(dropsOf("kaleidoscope_ranching:down").length, 1, "down on the ground");
  assert(!tryMoult(duck, 0), "once a day");
  const shy = ranch("goose", 2, "female");
  care.setAffection(shy, 40);
  assert(!tryMoult(shy, 0), "not below four hearts");
  const { SPECIES } = await_species;
  assert(SPECIES["kaleidoscope_ranching:goat"].brushDrops.some(([id]) => id === "kaleidoscope_ranching:goat_cashmere"), "goat cashmere");
  assert(SPECIES["kaleidoscope_ranching:rabbit"].brushDrops.some(([id]) => id === "kaleidoscope_ranching:rabbit_fur"), "rabbit fur");
});

test("M9: a hatched egg leaves an eggshell; the candler tells how long the rest need", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const nest = nestAt();
  NEST.onPlace({ block: nest, dimension: overworld });
  hold(player, "kaleidoscope_ranching:fertilized_chicken_egg", 2);
  use(NEST, nest, player);
  __skipTime(DAY);
  hold(player, "kaleidoscope_ranching:fertilized_chicken_egg", 1);
  use(NEST, nest, player);
  const report = candle(nest);
  equal(report.count, 2, "two eggs hatching");
  assert(report.soonest > 0 && report.soonest <= 20, "the first is about a day away");
  ranch("chicken", 1, "female");
  __skipTime(DAY);
  __advance(700);
  hold(player, "minecraft:stick", 1);
  use(NEST, nest, player);
  equal(player.inventory.count("kaleidoscope_ranching:eggshell"), 1, "one shell from the hatched egg");
  const incubator = __place(overworld, { x: 4, y: 64, z: 0 }, "kaleidoscope_ranching:incubator", { "kaleidoscope_ranching:eggs": 0, "kaleidoscope_ranching:busy": false });
  hold(player, "kaleidoscope_ranching:fertilized_duck_egg", 1);
  use(INCUBATOR, incubator, player);
  assert(candle(incubator).paused, "cold incubator: paused");
});

test("M9: the lasso leads a ranch animal; the duster clears a patch of cobweb; dye colours a rug", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const cow = ranch("cow", 5, "female");
  hold(player, "kaleidoscope_ranching:lasso", 1);
  assert(textiles.lassoAnimal(player, cow), "lassoed");
  equal(cow.getComponent("minecraft:leashable").leashHolder, player, "on the player's lead");
  for (const [x, z] of [[0, 3], [1, 3], [-1, 4], [5, 5]]) __place(overworld, { x, y: 64, z }, "minecraft:web");
  hold(player, "kaleidoscope_ranching:feather_duster", 1);
  equal(textiles.dust(player, overworld.getBlock({ x: 0, y: 64, z: 3 })), 3, "the 3 × 3 patch, not the far one");
  equal(overworld.getBlock({ x: 5, y: 64, z: 5 }).typeId, "minecraft:web", "far web stays");
  const rug = __place(overworld, { x: 0, y: 64, z: 8 }, "kaleidoscope_ranching:rug", { "kaleidoscope_ranching:color": "white" });
  hold(player, "minecraft:red_dye", 2);
  RUG.onPlayerInteract({ block: rug, player });
  equal(rug.permutation.getState("kaleidoscope_ranching:color"), "red", "dyed red");
  equal(player.inventory.count("minecraft:red_dye"), 1, "one dye used");
});

test("M9: a leather apron sometimes spares the blade", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  player.inventory.setItem(0, carcassFrom("cow", "female"));
  use(RACK, rack, player);
  player.getComponent("minecraft:equippable").setEquipment("Chest", new ItemStack("kaleidoscope_ranching:leather_apron", 1));
  const random = Math.random;
  Math.random = () => 0; // every roll saves
  try {
    hold(player, "minecraft:iron_sword");
    use(RACK, rack, player);
  } finally {
    Math.random = random;
  }
  const wear = () => player.inventory.getItem(player.selectedSlotIndex).getComponent("minecraft:durability").damage;
  equal(wear(), 0, "no wear with the apron");
  player.getComponent("minecraft:equippable").setEquipment("Chest", undefined);
  use(RACK, rack, player);
  equal(wear(), 1, "without it the stroke costs durability");
});

// --- 1.1 M10: work animals, management and the night routine -----------------------

const sleep = await import("../../packs/BP/scripts/systems/sleep.js");
const work = await import("../../packs/BP/scripts/systems/workAnimals.js");
const PEN_GATE = COMPONENTS["kaleidoscope_ranching:pen_gate"];
const PEN_GATE_TOP = COMPONENTS["kaleidoscope_ranching:pen_gate_top"];
const asleep = (animal) => animal.getProperty("kaleidoscope_ranching:sleeping") === true;

test("M10: animals lie down at night, stay up on a lead, and get up at dawn", () => {
  clearWorld();
  const player = __newPlayer(at(0, -10));
  const cow = ranch("cow", 2, "female");
  const led = ranch("sheep", 4, "female");
  led.getComponent("minecraft:leashable").leashTo(player);
  toTimeOfDay(14000);
  sleep.settleSleep();
  assert(asleep(cow), "the cow sleeps");
  assert(cow.hasComponent("minecraft:movement") && cow.getComponent("minecraft:movement").value === 0, "and stops moving");
  assert(!asleep(led), "not while led");
  toTimeOfDay(23100);
  sleep.settleSleep();
  __advance(sleep.WAKE_SPREAD + 1);
  assert(!asleep(cow), "up at dawn");
});

test("M10: a hurt or pushed animal wakes and lies down again after a quiet while", () => {
  clearWorld();
  const player = __newPlayer(at(0, -10));
  const cow = ranch("cow", 2, "female");
  toTimeOfDay(15000);
  sleep.settleSleep();
  world.afterEvents.entityHurt.fire({ hurtEntity: cow });
  assert(!asleep(cow), "hurt wakes it");
  sleep.settleSleep();
  assert(!asleep(cow), "not straight back to sleep");
  __advance(sleep.RESLEEP_TICKS + 1);
  sleep.settleSleep();
  assert(asleep(cow), "asleep again after the quiet");
  player.location = { ...cow.location };
  sleep.checkSleepers();
  assert(!asleep(cow), "pushed by the player");
});

test("M10: sheltered by a hay rack the cow sleeps well; out in the snow it is cold, unless blanketed or a yak", () => {
  clearWorld();
  __newPlayer(at(0, -10));
  const cosy = ranch("cow", 2, "female");
  __place(overworld, { x: 2, y: 67, z: 0 }, "minecraft:oak_planks");
  place("hay_rack", at(3), { hay: 0 });
  care.setAffection(cosy, 40);
  const cold = ranch("cow", 10, "female");
  __place(overworld, { x: 11, y: 64, z: 0 }, "minecraft:snow_layer");
  care.setAffection(cold, 40);
  const warm = ranch("sheep", 12, "female", 2);
  __place(overworld, { x: 12, y: 64, z: 3 }, "minecraft:snow_layer");
  warm.setDynamicProperty(sleep.BLANKET, true);
  care.setAffection(warm, 40);
  const yak = ranch("yak", 14, "female");
  __place(overworld, { x: 14, y: 64, z: 1 }, "minecraft:snow_layer");
  care.setAffection(yak, 40);
  toTimeOfDay(14000);
  sleep.settleSleep();
  equal(care.getAffection(cosy), 40 + sleep.SLEPT_WELL_POINTS, "slept well");
  equal(care.getAffection(cold), 40 - sleep.COLD_NIGHT_POINTS, "a cold night");
  equal(care.getAffection(warm), 40, "the blanket keeps it warm");
  equal(care.getAffection(yak), 40, "yaks do not feel the cold");
  sleep.settleSleep();
  equal(care.getAffection(cosy), 40 + sleep.SLEPT_WELL_POINTS, "once a night");
});

test("M10: milking a sleeping cow wakes her, unless you wear gloves", () => {
  clearWorld();
  const player = __newPlayer(at(0, -10));
  toTimeOfDay(14000);
  const day = Math.floor(world.getAbsoluteTime() / 24000);
  const cows = [ranch("cow", 2, "female"), ranch("cow", 4, "female")];
  for (const cow of cows) {
    care.setAffection(cow, 60);
    careFor(cow, 3);
  }
  sleep.settleSleep();
  player.inventory.setItem(1, new ItemStack("minecraft:glass_bottle", 2));
  hold(player, "kaleidoscope_ranching:milking_pail");
  __interact(player, cows[0]);
  __advance(1);
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk"), 1, "a bottle of milk");
  assert(!asleep(cows[0]), "she woke");
  player.getComponent("minecraft:equippable").setEquipment("Offhand", new ItemStack("kaleidoscope_ranching:leather_gloves", 1));
  hold(player, "kaleidoscope_ranching:milking_pail");
  __interact(player, cows[1]);
  __advance(1);
  equal(player.inventory.count("kaleidoscope_ranching:cow_milk"), 2, "gloves: milked too");
  assert(asleep(cows[1]), "and she sleeps on");
  void day;
});

test("M10: the routine can be switched off", () => {
  clearWorld();
  __newPlayer(at(0, -10));
  const cow = ranch("cow", 2, "female");
  toTimeOfDay(14000);
  system.afterEvents.scriptEventReceive.fire({ id: "kaleidoscope_ranching:config", message: "sleep off", sourceType: "Server" });
  sleep.settleSleep();
  assert(!asleep(cow), "nobody sleeps");
  system.afterEvents.scriptEventReceive.fire({ id: "kaleidoscope_ranching:config", message: "sleep on", sourceType: "Server" });
  sleep.settleSleep();
  assert(asleep(cow), "back on");
});

test("M10: a harnessed buffalo with a plough tills three blocks wide while led", () => {
  clearWorld();
  toTimeOfDay(6000);
  const player = __newPlayer(at(0, -6));
  const buffalo = ranch("buffalo", 0, "female");
  care.setAffection(buffalo, 40);
  hold(player, "kaleidoscope_ranching:harness", 1);
  __interact(player, buffalo);
  __advance(1);
  assert(player.actionBar.at(-1).translate.endsWith("harness.shy"), "needs three hearts");
  care.setAffection(buffalo, 60);
  hold(player, "kaleidoscope_ranching:plough", 1);
  __interact(player, buffalo);
  __advance(1);
  assert(player.actionBar.at(-1).translate.endsWith("plough.need_harness"), "harness first");
  hold(player, "kaleidoscope_ranching:harness", 1);
  __interact(player, buffalo);
  __advance(1);
  hold(player, "kaleidoscope_ranching:plough", 1);
  __interact(player, buffalo);
  __advance(1);
  assert(buffalo.getDynamicProperty(work.PLOUGHING), "plough on");
  for (const x of [-1, 0, 1]) __place(overworld, { x, y: 63, z: 0 }, "minecraft:grass_block");
  equal(work.plough(buffalo), 0, "not without a lead");
  buffalo.getComponent("minecraft:leashable").leashTo(player);
  buffalo.viewDirection = { x: 0, y: 0, z: 1 };
  equal(work.plough(buffalo), 3, "three blocks wide");
  equal(overworld.getBlock({ x: 1, y: 63, z: 0 }).typeId, "minecraft:farmland", "farmland");
});

test("M10: a sheepdog drives the animals to the rally point when the horn is blown", () => {
  clearWorld();
  toTimeOfDay(6000);
  const player = __newPlayer(at(0, -6));
  const wolf = overworld.spawnEntity("minecraft:wolf", at(8));
  hold(player, "kaleidoscope_ranching:herding_horn", 1);
  __interact(player, wolf);
  __advance(1);
  assert(player.actionBar.at(-1).translate.endsWith("sheepdog.not_yours"), "an untamed wolf will not do");
  wolf.tamedTo = player.id;
  __interact(player, wolf);
  __advance(1);
  equal(wolf.getDynamicProperty(work.SHEEPDOG_OF), player.id, "a sheepdog now");
  const post = place("hitching_post", at(0), {});
  work.setRally(player, post);
  const stray = [ranch("sheep", 12, "female"), ranch("goat", 14, "male", 3)];
  work.blowHorn(player);
  let left = 0;
  for (let i = 0; i < 200 && (left = work.herdStep(player)) > 0; i++);
  for (const animal of stray) {
    const d = Math.hypot(animal.location.x - 0.5, animal.location.z - 0.5);
    assert(d <= work.RALLY_RADIUS + 0.5, `${animal.typeId} brought within the rally radius`);
  }
  assert(!player.actionBar.some((m) => m?.translate?.endsWith("horn.done")), "no herd read-out (core/actionBar.js)");
});

test("M10: the pen gate opens for a player close by and shuts behind them", () => {
  clearWorld();
  const gate = __place(overworld, { x: 0, y: 64, z: 0 }, "kaleidoscope_ranching:pen_gate", { "kaleidoscope_ranching:open": false });
  PEN_GATE.onPlace({ block: gate });
  const top = overworld.getBlock({ x: 0, y: 65, z: 0 });
  equal(top.typeId, "kaleidoscope_ranching:pen_gate_top", "the top half is placed");
  const player = __newPlayer(at(10));
  work.tendGates();
  equal(gate.permutation.getState("kaleidoscope_ranching:open"), false, "shut while nobody is near");
  player.location = { x: 1.5, y: 64, z: 0.5 };
  work.tendGates();
  equal(gate.permutation.getState("kaleidoscope_ranching:open"), true, "opens for the player");
  equal(overworld.getBlock({ x: 0, y: 65, z: 0 }).permutation.getState("kaleidoscope_ranching:open"), true, "top opens too");
  player.location = { x: 9, y: 64, z: 0 };
  work.tendGates();
  equal(gate.permutation.getState("kaleidoscope_ranching:open"), false, "shuts behind them");
  PEN_GATE_TOP.onPlayerBreak({ block: overworld.getBlock({ x: 0, y: 65, z: 0 }) });
  equal(overworld.getBlock({ x: 0, y: 64, z: 0 }).typeId, "minecraft:air", "breaking the top takes the gate");
  equal(dropsOf("kaleidoscope_ranching:pen_gate").length, 1, "and drops it once");
});

test("M10: every animal's client entity plays its sleep pose while asleep", () => {
  for (const { id } of animalsData.ANIMALS) {
    const entity = JSON.parse(readFileSync(new URL(`../../packs/RP/entity/${id}.entity.json`, import.meta.url), "utf8"))["minecraft:client_entity"].description;
    assert(entity.animations.sleep === `animation.kaleidoscope_ranching.${id}.sleep`, `${id} has a sleep animation`);
    assert(entity.scripts.animate.some((e) => e.sleep === "q.property('kaleidoscope_ranching:sleeping')"), `${id} plays it asleep`);
    const behaviour = JSON.parse(readFileSync(new URL(`../../packs/BP/entities/${id}.json`, import.meta.url), "utf8"))["minecraft:entity"];
    assert(behaviour.events["kaleidoscope_ranching:fall_asleep"], `${id} can fall asleep`);
  }
});

// --- 1.1 M11: health, the 1.1 API, Fishing and Tavern handshakes --------------------

const disease = await import("../../packs/BP/scripts/systems/disease.js");
const tagsCore = await import("../../packs/BP/scripts/core/tags.js");
const fishingApi = await import("../../packs/BP/scripts/api/fishing.js");
const tavernApi = await import("../../packs/BP/scripts/api/tavern.js");
const dayNow = () => Math.floor(world.getAbsoluteTime() / 24000);

test("M11: two days without water can make an animal sick: no milk, no breeding, no affection gain", () => {
  clearWorld();
  world.setDynamicProperty(disease.CFG_DISEASE, true);
  const cow = ranch("cow", 2, "female");
  cow.setDynamicProperty("kr:water_day", dayNow() - 2);
  assert(!disease.checkHealth(cow, 0.99), "a lucky roll stays healthy");
  __skipTime(24000);
  cow.setDynamicProperty("kr:water_day", dayNow() - 2);
  assert(disease.checkHealth(cow, 0), "falls ill");
  assert(!husbandry.production(cow, dayNow()).produces, "no milk");
  assert(!husbandry.canBreed(cow), "no breeding");
  care.setAffection(cow, 40);
  const before = care.getAffection(cow);
  care.setAffection(cow, before + 20);
  equal(care.getAffection(cow), before, "affection does not rise");
  const player = __newPlayer(at(0, -3));
  hold(player, "kaleidoscope_ranching:vet_medicine", 1);
  __interact(player, cow);
  __advance(1);
  assert(!disease.isSick(cow), "medicine cures it");
  equal(player.inventory.count("kaleidoscope_ranching:vet_medicine"), 0, "one used");
});

test("M11: soap keeps the dirt away for the day and counts as grooming; switching illness off cures", () => {
  clearWorld();
  world.setDynamicProperty(disease.CFG_DISEASE, true);
  const pig = ranch("pig", 2, "female");
  pig.setDynamicProperty("kr:clean_day", dayNow() - 3);
  equal(disease.riskOf(pig), "dirt", "a dirty pen is a risk");
  const player = __newPlayer(at(0, -3));
  hold(player, "kaleidoscope_ranching:soap", 1);
  __interact(player, pig);
  __advance(1);
  equal(disease.riskOf(pig), null, "soaped: no risk today");
  assert(care.isMarkedToday(pig, "groom"), "groomed");
  pig.setDynamicProperty(disease.SICK, true);
  system.afterEvents.scriptEventReceive.fire({ id: "kaleidoscope_ranching:config", message: "disease off", sourceType: "Server" });
  __skipTime(24000);
  disease.checkHealth(pig, 0);
  assert(!disease.isSick(pig), "illness off cures it");
});

test("M11: calcium feed gives a hen a chance of a second egg", () => {
  clearWorld();
  const nest = nestAt();
  NEST.onPlace({ block: nest, dimension: overworld });
  const hen = ranch("chicken", 1, "female");
  care.mark(hen, "fed", { fed_tier: 3, fed_kind: 7 });
  const random = Math.random;
  Math.random = () => 0.99; // above the extra-egg chance
  try {
    __advance(700);
  } finally {
    Math.random = random;
  }
  const player = __newPlayer(at(0));
  hold(player, "minecraft:stick", 1);
  use(NEST, nest, player);
  equal(player.inventory.count("minecraft:egg"), 1, "a high roll: one egg");
  __skipTime(24000);
  care.mark(hen, "fed", { fed_tier: 3, fed_kind: 7 });
  Math.random = () => 0.1;
  try {
    __advance(700);
  } finally {
    Math.random = random;
  }
  hold(player, "minecraft:stick", 1);
  use(NEST, nest, player);
  equal(player.inventory.count("minecraft:egg"), 3, "a low roll: two eggs that day");
});

test("M11: the 1.1 API takes new feed kinds, animal fields, offal cuts and remedies, and answers more", () => {
  clearWorld();
  system.__scriptEvents.length = 0;
  system.sendScriptEvent(`${API}:api_ping`, "");
  const caps = sent("api_ready").at(-1).capabilities;
  for (const cap of ["recipes_1_1", "butcher_offal", "animal_1_1", "feed_1_1", "remedy", "events_1_1", "query_1_1", "tag_contract"]) assert(caps.includes(cap), cap);
  equal(call("register_feed", { item: "kr_test:silage_cube", kind: "ruminant" }).ok, true, "ruminant feed");
  equal(call("register_remedy", { item: "kr_test:herb" }).ok, true, "remedy");
  equal(call("register_animal", { id: "kr_test:llama", reproduction: "gestation", breedItems: ["minecraft:wheat"], sleep: "lie", moult: ["kr_test:fibre", 0.5], coldHardy: true, harness: true, forage: { item: "kr_test:root", minHearts: 2 } }).ok, true, "animal with 1.1 fields");
  equal(call("register_animal", { id: "kr_test:bad", reproduction: "gestation", breedItems: ["minecraft:wheat"], sleep: "float" }).ok, false, "unknown pose refused");
  equal(call("register_butcher", { carcass: "kr_test:llama_carcass", cuts: [{ item: "kr_test:hide", count: [1, 1], skin: true }, { item: "kr_test:liver", count: [1, 1], offal: true }] }).ok, true, "offal cut");
  const cow = ranch("cow", 2, "female");
  cow.setDynamicProperty(disease.SICK, true);
  system.sendScriptEvent(`${API}:query_animal`, JSON.stringify({ entity: cow.id }));
  const info = sent("animal_info").at(-1);
  equal(info.sick, true, "sick reported");
  equal(info.sleeping, false, "sleeping reported");
  const player = __newPlayer(at(0, -3));
  hold(player, "kr_test:herb", 1);
  __interact(player, cow);
  __advance(1);
  assert(!disease.isSick(cow), "a registered remedy cures");
});

test("M11: other add-ons' tagged hides tan and tagged offal feeds pigs", () => {
  clearWorld();
  assert(tagsCore.addTagged("hide", "kr_test:alpaca_hide"), "tagged hide added");
  const player = __newPlayer(at(0));
  const rack = stationAt("tanning_rack");
  hold(player, "kr_test:alpaca_hide", 1);
  use(STATION, rack, player);
  __skipTime(24000);
  use(STATION, rack, player);
  equal(player.inventory.count("minecraft:leather"), 1, "leather from a tagged hide");
  tagsCore.addTagged("offal", "kr_test:lungs");
  assert(LIVE_FEEDS["kr_test:lungs"], "tagged offal is feed");
});

test("M11: with Fishing, Ranching baits are registered, fish bones grind to calcium and sea salt dries faster", () => {
  clearWorld();
  system.__scriptEvents.length = 0;
  fishingApi.onFishingReady(JSON.stringify({ api: 1, version: "1.6.2" }));
  const bait = system.__scriptEvents.filter((e) => e.id === "kaleidoscope_fishing:register_bait").map((e) => JSON.parse(e.message)).at(-1);
  assert(bait?.baits.some((b) => b.id === "kaleidoscope_ranching:chicken_gizzard" && b.biteFactor >= 0.5 && b.biteFactor <= 1), "gizzard bait");
  const player = __newPlayer(at(0));
  const grinder = stationAt("meat_grinder");
  hold(player, "kaleidoscope_fishing:fish_bones", 2);
  use(STATION, grinder, player);
  equal(player.inventory.count("kaleidoscope_ranching:calcium_powder"), 1, "calcium from fish bones");
  const rack = rackAt();
  player.inventory.setItem(5, new ItemStack("kaleidoscope_fishing:sea_salt", 1));
  hold(player, "kaleidoscope_ranching:pork_belly", 1);
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_fishing:sea_salt"), 0, "salt used");
  __skipTime(24000 * 2);
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:cured_pork_belly"), 1, "salted: done in two days");
});

test("M11: with the Tavern, the extension goes out and its grapes become feed", () => {
  clearWorld();
  system.__scriptEvents.length = 0;
  system.afterEvents.scriptEventReceive.fire({ id: "kaleidoscope_tavern:api_ready", message: JSON.stringify({ api: 1, version: "0.3.0", capabilities: ["shaker_recipes", "external_shaker_inputs", "guide_pages"] }), sourceType: "Server" });
  __advance(40);
  const begin = system.__scriptEvents.filter((e) => e.id === "kaleidoscope_tavern:extension_begin").map((e) => JSON.parse(e.message)).at(-1);
  equal(begin?.source, "kaleidoscope_ranching", "extension sent");
  assert(system.__scriptEvents.some((e) => e.id === "kaleidoscope_tavern:extension_commit"), "and committed");
  assert(LIVE_FEEDS["kaleidoscope_tavern:grape"], "grapes are feed");
  equal(tavernApi.TAVERN_EXTENSION.recipes.filter((r) => r.kind === "shaker").length, 2, "two shaker drinks");
});

test("1.1: milk wine goes to the Tavern as two milk fluids and two barrel recipes carried in a horn cup", () => {
  const ext = tavernApi.TAVERN_EXTENSION;
  const ids = new Set(
    readdirSync("packs/BP/items").map((f) => JSON.parse(readFileSync(`packs/BP/items/${f}`, "utf8"))["minecraft:item"].description.identifier)
  );
  const exists = (id) => id.startsWith("minecraft:") || ids.has(id);
  equal(ext.fluids.length, 2, "two fluids");
  for (const fluid of ext.fluids) {
    assert(fluid.id.startsWith("kaleidoscope_ranching:") && fluid.filled.startsWith("kaleidoscope_ranching:"), `${fluid.id}: own namespace`);
    equal(fluid.empty, "minecraft:bucket", `${fluid.id}: empties into a bucket`);
    assert(exists(fluid.filled), `${fluid.filled} exists`);
    assert(fluid.visuals.barrel.startsWith("kaleidoscope_ranching:"), "own visual");
  }
  const barrels = ext.recipes.filter((r) => r.kind === "barrel");
  equal(barrels.length, 2, "two barrel recipes");
  const fluids = new Set(ext.fluids.map((f) => f.id));
  for (const recipe of barrels) {
    assert(fluids.has(recipe.fluid), `${recipe.id}: its fluid is sent`);
    assert(recipe.ingredients.length <= 4, "four slots at most");
    for (const id of [recipe.carrier, recipe.output.item, ...recipe.ingredients.flat()]) assert(exists(id), `${id} exists`);
    equal(recipe.carrier, "kaleidoscope_ranching:horn_cup", "horn cup carries it");
  }
  const wine = JSON.parse(readFileSync("packs/BP/items/r_milk_wine.json", "utf8"))["minecraft:item"].components["minecraft:food"];
  equal(wine.using_converts_to, "kaleidoscope_ranching:horn_cup", "the cup comes back");
  const visual = JSON.parse(readFileSync("packs/BP/entities/milk_barrel_visual.json", "utf8"))["minecraft:entity"].description;
  assert(visual.properties["kt_art:amount"], "the Tavern's level property");
  equal(ext.pages.flatMap((p) => p.recipeIds ?? []).filter((id) => id.includes("barrel/")).length, 2, "a guide page for the wines");
});

const packBag = await import("../../packs/BP/scripts/systems/packBag.js");
test("1.1: a yak carries a pack bag of 15 slots; it drops when the yak dies", () => {
  clearWorld();
  const player = __newPlayer(at(0, -3));
  const calf = ranch("yak", 4, "female");
  calf.triggerEvent("kaleidoscope_ranching:become_baby");
  hold(player, "kaleidoscope_ranching:pack_bag", 1);
  __interact(player, calf);
  __advance(1);
  assert(player.actionBar.at(-1).translate.endsWith("pack_bag.baby"), "not on a calf");
  const yak = ranch("yak", 0, "female");
  __interact(player, yak);
  __advance(1);
  assert(packBag.wearsPackBag(yak), "bag on");
  equal(packBag.bagOf(yak).size, 15, "15 slots");
  equal(player.inventory.count("kaleidoscope_ranching:pack_bag"), 0, "bag used");
  hold(player, "minecraft:wheat", 20);
  player.isSneaking = true;
  __interact(player, yak);
  __advance(1);
  player.isSneaking = false;
  equal(player.inventory.count("minecraft:wheat"), 0, "stored, not fed");
  equal(packBag.bagContents(yak).length, 1, "one stack in the bag");
  assert(!packBag.takeOffPackBag(player, yak), "not while full");
  assert(player.actionBar.at(-1).translate.endsWith("pack_bag.not_empty"), "says so");
  assert(packBag.takeOut(player, yak, packBag.bagContents(yak)[0].slot), "taken out");
  equal(player.inventory.count("minecraft:wheat"), 20, "all 20 back");
  assert(packBag.takeOffPackBag(player, yak), "off when empty");
  equal(player.inventory.count("kaleidoscope_ranching:pack_bag"), 1, "bag back");
  hold(player, "kaleidoscope_ranching:pack_bag", 1);
  __interact(player, yak);
  __advance(1);
  yak.kill();
  assert(overworld.items.some((d) => d.item.typeId === "kaleidoscope_ranching:pack_bag"), "bag dropped");
  const cow = ranch("cow", 6, "female");
  hold(player, "kaleidoscope_ranching:pack_bag", 1);
  __interact(player, cow);
  __advance(1);
  assert(!packBag.wearsPackBag(cow), "only yaks");
});

const notebookUi = await import("../../packs/BP/scripts/ui/notebook.js");
test("1.1: the observation journal reads an animal's health, rest, produce, family and gear", () => {
  clearWorld();
  const keysOf = (parts) => {
    const out = [];
    const walk = (p) => {
      if (!p || typeof p !== "object") return;
      if (p.translate) out.push(p.translate.replace("kaleidoscope_ranching.ui.", ""));
      for (const v of Object.values(p)) if (Array.isArray(v)) v.forEach(walk);
        else if (v && typeof v === "object") walk(v);
    };
    parts.forEach(walk);
    return out;
  };
  const cow = ranch("cow", 0, "female");
  let keys = keysOf(notebookUi.observe(cow));
  for (const key of ["observe.who", "observe.hearts", "observe.section.health", "observe.health.well", "observe.section.produce", "observe.section.family"])
    assert(keys.includes(key), `shows ${key}`);
  assert(keys.some((k) => /^observe\.produce\.(milk_ready|no_milk)$/.test(k)), "says whether she gives milk");
  cow.setDynamicProperty("kaleidoscope_ranching:sick", true);
  keys = keysOf(notebookUi.observe(cow));
  assert(keys.includes("observe.health.sick"), "sick");
  assert(keys.includes("observe.produce.no_milk"), "no milk when sick");
  const bull = ranch("cow", 3, "male");
  keys = keysOf(notebookUi.observe(bull));
  assert(!keys.includes("observe.section.produce"), "a bull gives nothing");
  const yak = ranch("yak", 6, "female");
  const player = __newPlayer(at(6, -3));
  hold(player, "kaleidoscope_ranching:pack_bag", 1);
  __interact(player, yak);
  __advance(1);
  keys = keysOf(notebookUi.observe(yak));
  assert(keys.includes("observe.gear.pack_bag"), "pack bag shown");
  const duck = ranch("duck", 9, "female");
  keys = keysOf(notebookUi.observe(duck));
  assert(keys.includes("observe.produce.moult_shy"), "moulting needs hearts");
});

// --- 1.1 美術: what is worn or hung can be seen ---------------------------------

test("1.1: gear put on an animal sets its synced property, and taking it off clears it", () => {
  clearWorld();
  toTimeOfDay(6000);
  const player = __newPlayer(at(0, -6));
  const on = (animal, id) => animal.getProperty(`kaleidoscope_ranching:gear_${id}`) === true;
  const buffalo = ranch("buffalo", 0, "female");
  care.setAffection(buffalo, 60);
  for (const item of ["harness", "plough"]) {
    hold(player, `kaleidoscope_ranching:${item}`, 1);
    __interact(player, buffalo);
    __advance(1);
  }
  assert(on(buffalo, "harness") && on(buffalo, "plough"), "harness and plough show");
  hold(player, "kaleidoscope_ranching:plough", 1);
  __interact(player, buffalo);
  __advance(1);
  assert(on(buffalo, "harness") && !on(buffalo, "plough"), "plough unhitched");
  hold(player, "kaleidoscope_ranching:plough", 1);
  __interact(player, buffalo);
  __advance(1);
  hold(player, "minecraft:shears", 1);
  __interact(player, buffalo);
  __advance(1);
  assert(!on(buffalo, "harness") && !on(buffalo, "plough"), "shears take both off");

  const sheep = ranch("sheep", 4, "female");
  hold(player, "kaleidoscope_ranching:animal_blanket", 1);
  __interact(player, sheep);
  __advance(1);
  assert(on(sheep, "blanket"), "blanket shows");

  const yak = ranch("yak", 8, "female");
  hold(player, "kaleidoscope_ranching:pack_bag", 1);
  __interact(player, yak);
  __advance(1);
  assert(on(yak, "pack_bag"), "pack bag shows");
  assert(packBag.takeOffPackBag(player, yak), "bag off");
  assert(!on(yak, "pack_bag"), "pack bag gone");
});

test("1.1: an animal saved before gear was drawn shows its gear once it loads", () => {
  clearWorld();
  const cow = ranch("cow", 0, "female");
  cow.setDynamicProperty(sleep.BLANKET, true);
  world.afterEvents.entityLoad.fire({ entity: cow });
  equal(cow.getProperty("kaleidoscope_ranching:gear_blanket"), true, "blanket shown after loading");
});

/** Crates `animal` with the player's crate and lets it out at x = 6; returns the new animal. */
function crateAndRelease(player, animal) {
  hold(player, "kaleidoscope_ranching:animal_crate");
  __interact(player, animal);
  __advance(1);
  assert(!animal.isValid, "crated");
  const ground = __place(overworld, { x: 6, y: 63, z: 0 }, "minecraft:grass_block");
  CRATE_ITEM.onUseOn({ source: player, block: ground, blockFace: "Up" });
  __advance(1);
  return overworld.getEntities({ type: animal.typeId }).find((e) => e.isValid && e !== animal && e.id !== animal.id);
}

test("1.1: a crated ploughing buffalo still ploughs when let out", () => {
  clearWorld();
  toTimeOfDay(6000);
  const player = __newPlayer(at(0, -6));
  const buffalo = ranch("buffalo", 0, "female");
  care.setAffection(buffalo, 60);
  for (const item of ["harness", "plough"]) {
    hold(player, `kaleidoscope_ranching:${item}`, 1);
    __interact(player, buffalo);
    __advance(1);
  }
  const back = crateAndRelease(player, buffalo);
  assert(back, "released");
  equal(back.getProperty("kaleidoscope_ranching:gear_plough"), true, "the plough shows");
  const list = JSON.parse(world.getDynamicProperty("kaleidoscope_ranching:ploughing_buffalo") ?? "[]");
  assert(list.includes(back.id), "back on the ploughing list");
  assert(!list.includes(buffalo.id), "the crated one is off it");
  const { x, y, z } = back.location;
  for (const dx of [-1, 0, 1]) __place(overworld, { x: Math.floor(x) + dx, y: Math.floor(y) - 1, z: Math.floor(z) }, "minecraft:grass_block");
  back.getComponent("minecraft:leashable").leashTo(player);
  back.viewDirection = { x: 0, y: 0, z: 1 };
  __advance(20);
  equal(overworld.getBlock({ x: Math.floor(x), y: Math.floor(y) - 1, z: Math.floor(z) }).typeId, "minecraft:farmland", "it tills");
});

test("1.1: a crated yak keeps its pack bag; a bag with things in it must be emptied first", () => {
  clearWorld();
  const player = __newPlayer(at(0, -3));
  const yak = ranch("yak", 0, "female");
  hold(player, "kaleidoscope_ranching:pack_bag", 1);
  __interact(player, yak);
  __advance(1);
  hold(player, "minecraft:wheat", 5);
  player.isSneaking = true;
  __interact(player, yak);
  __advance(1);
  player.isSneaking = false;
  hold(player, "kaleidoscope_ranching:animal_crate");
  __interact(player, yak);
  __advance(1);
  assert(yak.isValid, "not crated while the bag holds things");
  assert(player.actionBar.at(-1).translate.endsWith("crate.bag_not_empty"), "told why");
  assert(packBag.takeOut(player, yak, packBag.bagContents(yak)[0].slot), "emptied");
  const back = crateAndRelease(player, yak);
  assert(back, "released");
  assert(packBag.wearsPackBag(back), "still wears the bag");
  equal(back.getProperty("kaleidoscope_ranching:gear_pack_bag"), true, "the bag shows");
  assert(packBag.bagOf(back), "the bag has room again");
  equal(packBag.bagOf(back).size, 15, "15 slots");
});

const rackSystem = await import("../../packs/BP/scripts/systems/butcherRack.js");
const processing = await import("../../packs/BP/scripts/data/processing.js");
/** How each strip on a rack looks, slot 1 first: "dried", "half" or "fresh". */
function stripsOn(rack) {
  const row = rack.permutation.getState("kaleidoscope_ranching:drying") ?? 0;
  const col = rack.permutation.getState("kaleidoscope_ranching:drying_mix") ?? 0;
  const look = processing.DRYING_LOOKS[row]?.[col];
  assert(look, `rack states ${row}/${col} name a look`);
  return processing.DRYING_STAGES.flatMap((stage, n) => Array(look[n]).fill(stage));
}

test("1.1: each drying strip darkens on its own clock: fresh, half dry, dried", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  const DAY = 24000;
  hold(player, "kaleidoscope_ranching:pork_belly", 1);
  use(RACK, rack, player);
  equal(stripsOn(rack).join(), "fresh", "just hung");
  __skipTime(DAY);
  hold(player, "kaleidoscope_ranching:beef_shank", 1);
  use(RACK, rack, player);
  equal(stripsOn(rack).join(), "fresh,fresh", "a day in, the belly is not half dry yet");
  __skipTime(DAY * 0.6);
  runBlockClock();
  equal(stripsOn(rack).join(), "half,fresh", "the belly turns half dry by itself at 1.5 days");
  __skipTime(DAY);
  runBlockClock();
  equal(stripsOn(rack).join(), "half,half", "the shank follows");
  hold(player, "kaleidoscope_ranching:duck_leg", 1);
  use(RACK, rack, player);
  equal(stripsOn(rack).join(), "half,half,fresh", "a new piece hangs fresh");
  __skipTime(DAY * 0.5);
  runBlockClock();
  equal(stripsOn(rack).join(), "dried,half,fresh", "the belly is done after three days");
  hold(player, "minecraft:stick", 1);
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:cured_pork_belly"), 1, "the dried one comes down");
  equal(stripsOn(rack).join(), "half,fresh", "the others keep their looks");
  __skipTime(DAY * 3);
  runBlockClock();
  equal(stripsOn(rack).join(), "dried,dried", "both done");
  use(RACK, rack, player);
  equal(stripsOn(rack).join(), "", "all down");
  __skipTime(DAY);
  runBlockClock();
  equal(stripsOn(rack).join(), "", "an empty rack stays empty");
});

test("1.1: a salted strip darkens a day sooner than a plain one and comes down first", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  const DAY = 24000;
  player.selectedSlotIndex = 0;
  hold(player, "kaleidoscope_ranching:beef_shank", 1);
  use(RACK, rack, player);
  player.inventory.setItem(5, new ItemStack("kaleidoscope_fishing:sea_salt", 1));
  hold(player, "kaleidoscope_ranching:pork_belly", 1);
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_fishing:sea_salt"), 0, "the salt went on the belly");
  equal(stripsOn(rack).join(), "fresh,fresh", "both hung fresh");
  __skipTime(DAY);
  runBlockClock();
  equal(stripsOn(rack).join(), "half,fresh", "the salted belly is half dry after one day, the shank not");
  __skipTime(DAY);
  runBlockClock();
  equal(stripsOn(rack).join(), "dried,half", "the salted belly is done after two days, the shank half dry");
  hold(player, "minecraft:stick", 1);
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:cured_pork_belly"), 1, "the salted belly comes down first");
  equal(player.inventory.count("kaleidoscope_ranching:beef_jerky"), 0, "the shank stays");
  equal(stripsOn(rack).join(), "half", "the shank keeps its look");
  __skipTime(DAY);
  runBlockClock();
  equal(stripsOn(rack).join(), "dried", "the shank is done after three days");
  use(RACK, rack, player);
  equal(player.inventory.count("kaleidoscope_ranching:beef_jerky"), 1, "then the shank comes down");
  equal(stripsOn(rack).join(), "", "all down");
});

/** Evaluates the bone_visibility Molang the rack uses: q.block_state('…') == n, &&, ||, (), false. */
function molang(source, states) {
  const tokens = source.match(/q\.block_state\('[^']+'\)|==|&&|\|\||\(|\)|-?\d+|false|true|\S/g);
  let at = 0;
  const peek = () => tokens[at];
  const take = (want) => {
    const token = tokens[at++];
    if (want !== undefined && token !== want) throw new Error(`molang: expected ${want}, got ${token} in ${source}`);
    return token;
  };
  const value = () => {
    const token = take();
    if (token === "(") {
      const inner = or();
      take(")");
      return inner;
    }
    if (token === "false") return false;
    if (token === "true") return true;
    if (/^-?\d+$/.test(token)) return Number(token);
    const name = token.match(/^q\.block_state\('([^']+)'\)$/)?.[1];
    if (!name) throw new Error(`molang: unexpected ${token} in ${source}`);
    if (!(name in states)) throw new Error(`molang: unknown state ${name}`);
    return states[name];
  };
  const compare = () => {
    const left = value();
    if (peek() !== "==") return left;
    take("==");
    return left === value();
  };
  const and = () => {
    let result = compare();
    while (peek() === "&&") {
      take("&&");
      result = compare() && result;
    }
    return result;
  };
  const or = () => {
    let result = and();
    while (peek() === "||") {
      take("||");
      result = and() || result;
    }
    return result;
  };
  const result = or();
  if (at !== tokens.length) throw new Error(`molang: trailing ${tokens.slice(at).join(" ")} in ${source}`);
  return Boolean(result);
}

test("1.1: the generated rack bone rules show exactly the strips each drying look stands for", () => {
  const rack = JSON.parse(readFileSync("packs/BP/blocks/r_butcher_rack.json", "utf8"))["minecraft:block"];
  const states = rack.description.states;
  const rules = Object.entries(rack.components["minecraft:geometry"].bone_visibility).filter(([bone]) => bone.startsWith("dry_"));
  assert(rules.length === processing.DRYING_SLOTS * (1 + processing.DRYING_STAGES.length), "a twine and three strips per slot");
  let checked = 0;
  for (const row of states["kaleidoscope_ranching:drying"]) {
    for (const col of states["kaleidoscope_ranching:drying_mix"]) {
      const at = { "kaleidoscope_ranching:drying": row, "kaleidoscope_ranching:drying_mix": col };
      const strips = processing.DRYING_STAGES.flatMap((stage, n) => Array(processing.DRYING_LOOKS[row][col][n]).fill(stage));
      const wanted = strips.flatMap((stage, n) => [`dry_${n + 1}`, `dry_${n + 1}_${stage}`]).sort();
      const shown = rules.filter(([, rule]) => molang(rule, at)).map(([bone]) => bone).sort();
      equal(shown.join(), wanted.join(), `look ${row}/${col} (${strips.join() || "empty"})`);
      checked++;
    }
  }
  equal(checked, 35, "every look checked");
});

test("1.1: a rack saved with pieces drying shows each one's stage after loading and keeps updating", () => {
  clearWorld();
  const DAY = 24000;
  const rack = rackAt(14);
  rack.setPermutation(rack.permutation.withState("kaleidoscope_ranching:drying", 3)); // as an older build left it
  const now = world.getAbsoluteTime();
  world.setDynamicProperty(
    "kaleidoscope_ranching:block:minecraft:overworld:14,64,0",
    JSON.stringify({ type: "kaleidoscope_ranching:butcher_rack", data: { drying: [
      { item: "kaleidoscope_ranching:pork_belly", start: now - DAY * 3 - 10 },
      { item: "kaleidoscope_ranching:raw_sausage", start: now - DAY * 2 },
      { item: "kaleidoscope_ranching:beef_shank", start: now - DAY / 2 },
    ] } })
  );
  equal(rackSystem.showSavedDrying(), 0, "nothing left to show");
  equal(stripsOn(rack).join(), "dried,half,fresh", "each piece by its own age");
  __skipTime(DAY);
  runBlockClock();
  equal(stripsOn(rack).join(), "dried,dried,half", "the clock keeps a loaded rack up to date");
});


test("1.1: a rack saved with pieces drying before they were drawn shows them once the world loads", () => {
  clearWorld();
  const rack = rackAt(12);
  const now = world.getAbsoluteTime();
  world.setDynamicProperty(
    "kaleidoscope_ranching:block:minecraft:overworld:12,64,0",
    JSON.stringify({ type: "kaleidoscope_ranching:butcher_rack", data: { drying: [{ item: "kaleidoscope_ranching:raw_sausage", start: now }, { item: "kaleidoscope_ranching:pork_belly", start: now }] } })
  );
  equal(rackSystem.showSavedDrying(), 0, "nothing left to show");
  equal(stripsOn(rack).length, 2, "two pieces shown");
});

test("1.1: the butcher rack shows how many pieces are air-drying", () => {
  clearWorld();
  const player = __newPlayer(at(0));
  const rack = rackAt();
  const shown = () => stripsOn(rack).length;
  equal(shown(), 0, "nothing hangs on a new rack");
  hold(player, "kaleidoscope_ranching:pork_belly", 1);
  use(RACK, rack, player);
  equal(shown(), 1, "one piece");
  __skipTime(24000 * 2);
  hold(player, "kaleidoscope_ranching:beef_shank", 2);
  use(RACK, rack, player);
  use(RACK, rack, player);
  equal(shown(), 3, "three pieces");
  __skipTime(24000);
  use(RACK, rack, player);
  equal(shown(), 2, "the finished belly came down");
  __skipTime(24000 * 3);
  use(RACK, rack, player);
  equal(shown(), 0, "all down");
  player.inventory.setItem(8, carcassFrom("chicken", "female"));
  player.selectedSlotIndex = 8;
  use(RACK, rack, player);
  equal(shown(), 0, "a carcass is not a drying piece");
});

// --- Report ---------------------------------------------------------------

const failed = results.filter((result) => !result.ok);
for (const result of results) console.log(`${result.ok ? "ok  " : "FAIL"} ${result.name}${result.ok ? "" : `\n     ${result.error.message}`}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
