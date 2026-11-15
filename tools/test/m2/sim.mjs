// Simulates the two M2 acceptance criteria against the mock API.
import * as mc from "@minecraft/server";
const S = globalThis.__mc;
const NS = "kaleidoscope_ranching";

const init = await import("../../../packs/BP/scripts/care_init.js");
// collect custom components
const comps = {};
for (const cb of mc.system.beforeEvents.startup.list)
  cb({ blockComponentRegistry: { registerCustomComponent: (n, c) => (comps[n] = c) },
       itemComponentRegistry: { registerCustomComponent: (n, c) => (comps[n] = c) } });
const flush = () => { while (S.queue.length) S.queue.shift()(); };

let failures = 0;
const check = (cond, msg) => { console.log((cond ? "PASS " : "FAIL ") + msg); if (!cond) failures++; };

function reset() {
  S.time = 0; S.dp.clear(); S.blocks.clear(); S.entities.length = 0; S.drops.length = 0;
}
const dim = new mc.Dimension("minecraft:overworld");
const ground = () => { for (let x = -10; x <= 10; x++) for (let z = -10; z <= 10; z++) dim.setBlockType({ x, y: 63, z }, "minecraft:grass_block"); };

function cows(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const e = new mc.Entity(dim, `${NS}:cow`, { x: (i % 4) * 1.5 - 2, y: 64, z: Math.floor(i / 4) * 2 + 1 },
      ["ranching_livestock", i % 2 ? "ranching_male" : "ranching_female"]);
    S.entities.push(e);
    out.push(e);
  }
  return out;
}
function player(held, sneaking = false) {
  const inv = new mc.Container(36);
  const p = { id: "p1", isSneaking: sneaking, dimension: dim, location: { x: 0, y: 64, z: 0 }, selectedSlotIndex: 0,
    onScreenDisplay: { setActionBar(m) { p.last = m; } }, playSound() {},
    getGameMode: () => "survival",
    getComponent: (n) => n === "minecraft:inventory" ? { container: inv }
      : n === "minecraft:equippable" ? { getEquipment: () => inv.getItem(0), setEquipment: (_, s) => inv.setItem(0, s) } : undefined,
    getEntitiesFromViewDirection: () => [] };
  inv.setItem(0, held);
  return p;
}
const states = (b) => b.permutation.states;
const hearts = (e) => init.getHearts(e);
const DAY = 24000;

// ---------- Scenario A: 5 consecutive days of full care → 5 hearts ----------
reset(); ground();
const trough = dim.setBlock(new mc.Block(dim, { x: 0, y: 64, z: 0 }, `${NS}:trough`, { [`${NS}:fill`]: 0, [`${NS}:kind`]: 0 }));
const water = dim.setBlock(new mc.Block(dim, { x: 3, y: 64, z: 0 }, `${NS}:water_trough`, { [`${NS}:water`]: 0 }));
const herd = cows(8);
const interact = mc.world.beforeEvents.playerInteractWithEntity.list[0];

for (let day = 0; day < 6; day++) {
  S.time = day * DAY + 1000;
  // morning: settle via a tick, then chores
  comps[`${NS}:trough`].onTick({ block: trough });
  if (day < 5) {
    comps[`${NS}:trough`].onPlayerInteract({ block: trough, player: player(new mc.ItemStack(`${NS}:mixed_feed`, 16), true) });
    comps[`${NS}:water_trough`].onPlayerInteract({ block: water, player: player(new mc.ItemStack("minecraft:water_bucket", 1)) });
    // clean manure with the fork
    for (const b of [...S.blocks.values()].filter((b) => b.typeId === `${NS}:manure`)) {
      const fork = new mc.ItemStack(`${NS}:manure_fork`, 1);
      fork.durability = { damage: 0, maxDurability: 128 };
      comps[`${NS}:manure_fork`].onUseOn({ source: player(fork), block: b });
    }
    for (const e of herd) {
      const brush = new mc.ItemStack(`${NS}:brush`, 1);
      brush.durability = { damage: 0, maxDurability: 64 };
      const p = player(brush);
      const ev = { player: p, target: e, itemStack: brush, cancel: false };
      interact(ev); flush();
    }
    for (let t = 0; t < 5; t++) { // rest of the day
      S.time += 2000;
      comps[`${NS}:trough`].onTick({ block: trough });
      comps[`${NS}:water_trough`].onTick({ block: water });
    }
  }
  console.log(`  day ${day}: hearts ${herd.map(hearts).join(",")}  manure ${[...S.blocks.values()].filter(b => b.typeId === `${NS}:manure`).length}`);
}
check(herd.every((e) => hearts(e) === 5), "Scenario A: 5 cared days → every cow at 5 hearts");

// ---------- Scenario A2: neglect drops affection, no death ----------
trough.setPermutation(trough.permutation.withState(`${NS}:fill`, 0).withState(`${NS}:kind`, 0));
for (let day = 6; day < 11; day++) { S.time = day * DAY + 1000; comps[`${NS}:trough`].onTick({ block: trough }); }
check(herd.every((e) => hearts(e) === 3), `Scenario A2: 4 unfed days (6–9) → -2 hearts (got ${hearts(herd[0])})`);

// ---------- Scenario B: hopper + auto feeder, 3 days without manual refill ----------
reset(); ground();
const t2 = dim.setBlock(new mc.Block(dim, { x: 0, y: 64, z: 0 }, `${NS}:trough`, { [`${NS}:fill`]: 0, [`${NS}:kind`]: 0 }));
const feeder = dim.setBlock(new mc.Block(dim, { x: 0, y: 65, z: 0 }, `${NS}:auto_feeder`));
const hopper = new mc.Container(5);
hopper.setItem(0, new mc.ItemStack(`${NS}:mixed_feed`, 64));
dim.setBlock(new mc.Block(dim, { x: 0, y: 66, z: 0 }, "minecraft:hopper", {}, hopper));
const herd2 = cows(8);
let fedDays = 0;
for (let day = 0; day < 3; day++) {
  for (let t = 0; t < 24000; t += 200) {
    S.time = day * DAY + t;
    if (t % 40 === 0) comps[`${NS}:auto_feeder`].onTick({ block: feeder });
    comps[`${NS}:trough`].onTick({ block: t2 });
  }
  const fed = herd2.filter((e) => e.getDynamicProperty("kr:fed_day") === day).length;
  console.log(`  day ${day}: fed ${fed}/8, trough fill ${states(t2)[`${NS}:fill`]}, hopper left ${hopper.getItem(0)?.amount ?? 0}`);
  if (fed === 8) fedDays++;
}
check(fedDays === 3, "Scenario B: auto feeder keeps 8 cows fed 3 days with no manual refill");

// ---------- Scenario C: species filter — chickens don't eat hay ----------
reset(); ground();
const t3 = dim.setBlock(new mc.Block(dim, { x: 0, y: 64, z: 0 }, `${NS}:trough`, { [`${NS}:fill`]: 5, [`${NS}:kind`]: 1 }));
const hen = new mc.Entity(dim, `${NS}:chicken`, { x: 1, y: 64, z: 1 }, ["ranching_livestock", "ranching_female"]);
S.entities.push(hen);
comps[`${NS}:trough`].onTick({ block: t3 });
check(hen.getDynamicProperty("kr:fed_day") === undefined && states(t3)[`${NS}:fill`] === 5, "Scenario C: chicken ignores hay feed");

// ---------- Scenario D: compost bin and salt lick wear ----------
reset(); ground();
const bin = dim.setBlock(new mc.Block(dim, { x: 0, y: 64, z: 0 }, `${NS}:compost_bin`, { [`${NS}:stage`]: 0, [`${NS}:manure`]: 0 }));
for (let i = 0; i < 4; i++) comps[`${NS}:compost_bin`].onPlayerInteract({ block: bin, player: player(new mc.ItemStack(`${NS}:manure_item`, 1)) });
comps[`${NS}:compost_bin`].onPlayerInteract({ block: bin, player: player(new mc.ItemStack("minecraft:wheat", 1)) });
const stage1 = states(bin)[`${NS}:stage`];
S.time += 24000;
const pc = player(undefined);
comps[`${NS}:compost_bin`].onPlayerInteract({ block: bin, player: pc });
const got = pc.getComponent("minecraft:inventory").container.items.find((s) => s?.typeId === `${NS}:fertilizer`);
check(stage1 === 1 && got?.amount === 4 && states(bin)[`${NS}:stage`] === 0, "Scenario D: compost 4 manure + wheat → 4 fertilizer after a day");

const lick = dim.setBlock(new mc.Block(dim, { x: 2, y: 64, z: 2 }, `${NS}:salt_lick`, { [`${NS}:bites`]: 0 }));
cows(1);
for (let d = 0; d < 7; d++) { S.time = 100000 + d * DAY; comps[`${NS}:salt_lick`].onTick({ block: lick }); }
check(dim.getBlock({ x: 2, y: 64, z: 2 }).typeId === "minecraft:air", "Scenario D2: salt lick lasts 7 days then disappears");

// ---------- Scenario E: notebook form renders ----------
globalThis.__forms.length = 0;
const nb = new mc.ItemStack(`${NS}:ranch_notebook`, 1);
interact({ player: player(nb), target: herd[0], itemStack: nb, cancel: false }); flush();
check(globalThis.__forms.length === 1, "Scenario E: notebook opens the info form");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
process.exit(failures ? 1 : 0);
