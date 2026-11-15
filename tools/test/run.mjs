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
