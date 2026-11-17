// Run: node --test <this file>. The handshake with Order To Cook and Grilling (api/burntTea.js), and that
// data/burntTeaCatalog.js still matches the pack (tools/gen_burnt_tea.mjs --check).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const C = JSON.parse(process.env.BURNT_TEA ?? "null") ?? (await import(pathToFileURL(resolve(here, "burnt_tea.config.mjs")).href)).default;
const root = resolve(here, C.root);
const at = (p) => pathToFileURL(resolve(root, p)).href;
const { OTC, GRILLING_SMOKING, startBurntTea, otcCatalogMessages, otcSmokingMessages } = await import(at(C.module));
const { OTC_FOODS, SMOKER_RECIPES } = await import(at(C.catalog));

function fakeSystem() {
  const subs = [], timers = [], sent = [];
  const system = {
    sendScriptEvent(id, message) {
      assert.ok(message.length <= 2048, `${id} over 2048 characters`);
      sent.push({ id, message });
      for (const s of subs) if (s.ns.includes(id.split(":")[0])) s.fn({ id, message, sourceType: "Server" });
    },
    afterEvents: { scriptEventReceive: { subscribe: (fn, { namespaces }) => subs.push({ fn, ns: namespaces }) } },
    runTimeout: (fn, ticks) => timers.push({ fn, ticks }),
  };
  return { system, sent, timers, fire: (id, sourceType = "Server") => { for (const s of subs) if (s.ns.includes(id.split(":")[0])) s.fn({ id, message: '{"v":1}', sourceType }); } };
}

test("the catalog is up to date with the pack", () => {
  execFileSync(process.execPath, [resolve(root, "tools/gen_burnt_tea.mjs"), resolve(root, C.bp), resolve(root, C.rp), C.ns, resolve(root, C.catalog), "--check"], { stdio: "pipe" });
});

test("dishes: our own ids, named, positive nutrition unless a drink", () => {
  assert.ok(OTC_FOODS.length > 0);
  for (const [id, nutrition, label, drink] of OTC_FOODS) {
    assert.ok(id.startsWith(C.ns + ":"), id);
    assert.ok(label && label.length <= 100 && !label.includes(":"), `${id} label ${label}`);
    assert.ok(Number.isInteger(nutrition) && nutrition >= (drink ? 0 : 1), `${id} nutrition`);
  }
  assert.equal(new Set(OTC_FOODS.map((f) => f[0])).size, OTC_FOODS.length, "no duplicates");
  const raw = new Set(SMOKER_RECIPES.map((r) => r[0]));
  assert.ok(OTC_FOODS.every((f) => !raw.has(f[0])), "raw ingredients are not menu dishes");
});

test("after load: OTC catalog, OTC smoking and Grilling smoking go out, each under 2048 characters", () => {
  const w = fakeSystem();
  startBurntTea(w.system, { source: C.ns, foods: OTC_FOODS, smoking: SMOKER_RECIPES });
  assert.equal(w.sent.length, 0, "nothing at script load");
  w.timers.forEach((t) => t.fn());
  const of = (id) => w.sent.filter((e) => e.id === id).map((e) => JSON.parse(e.message));
  const catalog = of(OTC.catalog);
  assert.equal(catalog[0].replace, true, "the first batch replaces");
  assert.ok(catalog.slice(1).every((m) => m.replace === undefined), "later batches add");
  assert.ok(catalog.every((m) => m.v === 1 && m.provider === C.ns));
  assert.equal(catalog.flatMap((m) => m.foods).length, OTC_FOODS.length, "every dish");
  const drinks = catalog.flatMap((m) => m.foods).filter((f) => f.servingKind === "drink").length;
  assert.equal(drinks, OTC_FOODS.filter((f) => f[3]).length, "drinks are declared");
  const smoking = of(OTC.smoking);
  assert.equal(smoking.flatMap((m) => m.recipes).length, SMOKER_RECIPES.length);
  for (const m of smoking) {
    assert.deepEqual(Object.keys(m).sort(), ["catalog", "provider", "recipes", "version"], "only the fields OTC accepts");
    for (const r of m.recipes) {
      assert.deepEqual(Object.keys(r).sort(), ["count", "id", "input", "output", "process"]);
      assert.ok(r.id.startsWith(C.ns + ":") && r.process === "smoking" && r.count === 1);
    }
  }
  assert.equal(new Set(smoking.map((m) => m.catalog)).size, smoking.length, "one catalog per message");
  assert.deepEqual(of(GRILLING_SMOKING), SMOKER_RECIPES.map(([input, output]) => ({ input, output })));
});

test("OTC's requests are answered; typed /scriptevent is not", () => {
  const w = fakeSystem();
  startBurntTea(w.system, { source: C.ns, foods: OTC_FOODS, smoking: SMOKER_RECIPES });
  w.fire(OTC.catalogRequest, "Entity");
  assert.equal(w.sent.length, 0);
  w.fire(OTC.catalogRequest);
  assert.equal(w.sent.filter((e) => e.id === OTC.catalog).length, otcCatalogMessages(C.ns, OTC_FOODS).length);
  w.fire(OTC.smokingRequest);
  assert.equal(w.sent.filter((e) => e.id === OTC.smoking).length, otcSmokingMessages(C.ns, SMOKER_RECIPES).length);
  assert.equal(w.sent.filter((e) => e.id === GRILLING_SMOKING).length, 0, "Grilling only after load");
});

// When burnt-tea-dev's repositories are checked out next to this one, their own code takes our messages.
const beside = (name) => resolve(root, "..", name);
const otcDir = beside("order-to-cook-unofficial/runtime/BP/scripts");
test("Order To Cook's own catalog and stove code accept our messages", { skip: !existsSyncSafe(otcDir) && "order-to-cook-unofficial not beside this repo" }, async () => {
  const { createFoodCatalog } = await import(pathToFileURL(resolve(otcDir, "food_catalog.js")).href);
  const catalog = createFoodCatalog();
  for (const m of otcCatalogMessages(C.ns, OTC_FOODS)) catalog.register(JSON.parse(m));
  const [id, nutrition, label] = OTC_FOODS[0];
  const fake = { typeId: id, getDynamicProperty: () => undefined, getLore: () => [], getDynamicPropertyIds: () => [] };
  const got = catalog.resolve(fake);
  assert.ok(got.known, "known to OTC");
  if (got.food) assert.equal(got.food.label, label);
  assert.equal(catalog.labelFor(id), label);
  assert.ok(nutrition >= 0);
  if (SMOKER_RECIPES.length) {
    const { createSmokingRecipeRegistry } = await import(pathToFileURL(resolve(otcDir, "smoking_recipes.js")).href);
    const reg = createSmokingRecipeRegistry({ hasItem: () => true });
    for (const m of otcSmokingMessages(C.ns, SMOKER_RECIPES)) {
      const result = reg.registerProvider(JSON.parse(m));
      assert.ok(result.ok, `OTC refused: ${result.reason}`);
    }
  }
});
const grillDir = beside("kaleidoscope-grilling-unofficial/projects/grilling/gameplay_core/behavior_pack/scripts");
test("Grilling's own registry cooks our raw ingredients", { skip: (!SMOKER_RECIPES.length && "no smoker recipes") || (!existsSyncSafe(grillDir) && "kaleidoscope-grilling-unofficial not beside this repo") }, async () => {
  const P = await import(pathToFileURL(resolve(grillDir, "core/parity_contract.js")).href);
  for (const [input, output] of SMOKER_RECIPES) {
    assert.ok(P.applyParityRegistration("smoking", { input, output }), `${input} accepted`);
    assert.equal(P.resolveSmokingResult(input), output);
  }
  P.resetParityRegistrationsForTest();
});
import { existsSync } from "node:fs";
function existsSyncSafe(p) { try { return existsSync(p); } catch { return false; } }
