// Behaviour tests for Ranching's scripts, run against the mock API.
// Run with: node --import ./tools/test/register.mjs tools/test/run.mjs

import * as mc from "@minecraft/server";

const { world, ItemStack, __advance, __interact, __newPlayer, __skipTime } = mc;
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
