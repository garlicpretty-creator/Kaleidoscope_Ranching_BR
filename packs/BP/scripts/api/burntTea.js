// Handshakes with burnt-tea-dev's packs, which take registrations but have no api_ping of their own:
//
//   下單了 Order To Cook  ordertocook:food_catalog_v1     {v:1, provider, replace?, foods:[{typeId, nutrition, label, servingKind?}]}
//                         our dishes become restaurant menu dishes under their Chinese names (drinks included).
//                         Sent after load, and again whenever OTC asks with ordertocook:food_catalog_request_v1.
//                         ordertocook:smoking_recipes_v1  {version:1, provider, catalog, recipes:[{id, process:"smoking", input, output, count}]}
//                         our smoker recipes work on OTC's stove (replacing the "main" snapshot OTC ships for us). OTC listens only once its world is ready and then
//                         asks with ordertocook:request_smoking_recipes_v1, which we answer.
//   煙火 Grilling          kaleidoscope_grilling:register_smoking  {input, output}, one pair per message
//                         a mystery skewer (3 ingredients) with our raw meat or fish on it comes off the grill with the
//                         cooked food, the way Java Grilling looks up smoking recipes.
//
// Both are optional: without them nobody listens and nothing happens. Both keep these registrations for the world
// session only, so they are sent on every load. Re-sending is safe (OTC: replace / snapshot; Grilling: same key, same value).
// No @minecraft imports: the caller passes `system`, so tests can drive this file.

export const OTC = Object.freeze({
  catalog: "ordertocook:food_catalog_v1",
  catalogRequest: "ordertocook:food_catalog_request_v1",
  smoking: "ordertocook:smoking_recipes_v1",
  smokingRequest: "ordertocook:request_smoking_recipes_v1",
});
export const GRILLING_SMOKING = "kaleidoscope_grilling:register_smoking";
const MAX_MESSAGE = 1800; // a script event message holds 2048 characters

/** OTC food catalog messages; the first replaces whatever this pack declared before. */
export function otcCatalogMessages(source, foods) {
  const out = [];
  let batch = [];
  const message = (rows, first) => JSON.stringify({ v: 1, provider: source, ...(first ? { replace: true } : {}), foods: rows });
  for (const [typeId, nutrition, label, drink] of foods) {
    const row = { typeId, nutrition, label, ...(drink ? { servingKind: "drink" } : {}) };
    if (batch.length && message([...batch, row], !out.length).length > MAX_MESSAGE) {
      out.push(message(batch, !out.length));
      batch = [];
    }
    batch.push(row);
  }
  if (batch.length) out.push(message(batch, !out.length));
  return out;
}

/** OTC smoking snapshots in catalogs main, main_2, … (to stay under the message limit). "main" is the catalog OTC
 *  audited from our recipe JSON at its own release; sending it replaces that snapshot with this version's recipes. */
export function otcSmokingMessages(source, recipes) {
  const out = [];
  let batch = [];
  const message = (rows) => JSON.stringify({ version: 1, provider: source, catalog: out.length ? `main_${out.length + 1}` : "main", recipes: rows });
  for (const [input, output] of recipes) {
    const row = { id: `${source}:smoking/${input.split(":")[1]}`, process: "smoking", input, output, count: 1 };
    if (batch.length && message([...batch, row]).length > MAX_MESSAGE) {
      out.push(message(batch));
      batch = [];
    }
    batch.push(row);
  }
  if (batch.length) out.push(message(batch));
  return out;
}

export const grillingSmokingMessages = (recipes) => recipes.map(([input, output]) => JSON.stringify({ input, output }));

/** Wires the handshakes. `system` is @minecraft/server's. Returns the senders (tests). */
export function startBurntTea(system, { source, foods = [], smoking = [], delay = 20 }) {
  const send = (id, message) => { try { system.sendScriptEvent(id, message); } catch {} };
  const sendCatalog = () => { for (const m of otcCatalogMessages(source, foods)) send(OTC.catalog, m); };
  const sendSmoking = () => { for (const m of otcSmokingMessages(source, smoking)) send(OTC.smoking, m); };
  const sendGrilling = () => { for (const m of grillingSmokingMessages(smoking)) send(GRILLING_SMOKING, m); };
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      if (event.sourceType !== undefined && event.sourceType !== "Server") return;
      if (event.id === OTC.catalogRequest) sendCatalog();
      else if (event.id === OTC.smokingRequest) sendSmoking();
    },
    { namespaces: ["ordertocook"] }
  );
  system.runTimeout(() => { sendCatalog(); sendSmoking(); sendGrilling(); }, delay);
  return { sendCatalog, sendSmoking, sendGrilling };
}
