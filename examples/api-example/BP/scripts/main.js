// Ranching API example: an alpaca that Kaleidoscope Ranching milks, feeds,
// breeds and butchers, without this pack importing any Ranching script.
//
// 1. Ping Ranching after the world loads.
// 2. When Ranching answers with api_ready, send the registrations below.
// 3. Watch api_result for mistakes and animal_event for births.
//
// Registrations last for the current world session, so this runs on every
// load. Sending them twice is harmless. See docs/API.md in the Ranching repo.

import { system, world } from "@minecraft/server";

const R = "kaleidoscope_ranching";
const ME = "kr_example";

/** [event, payload] pairs, in the order they should be sent. */
export const REGISTRATIONS = [
  ["register_feed", { item: `${ME}:hay_cube`, kind: "grass", units: 2 }],
  [
    "register_animal",
    {
      id: `${ME}:alpaca`,
      reproduction: "gestation",
      days: 3,
      breedItems: [`${ME}:hay_cube`, "kaleidoscope_ranching:mixed_feed"],
      carcass: `${ME}:alpaca_carcass`,
      largeCarcass: true,
      dailyProduct: {
        via: "milking_pail",
        items: [`${ME}:alpaca_milk`],
      },
      care: { eats: ["grass", "mixed", "concentrate"], treat: "kaleidoscope_ranching:alfalfa_cake", brushDrops: [["minecraft:white_wool", 0.2]] },
    },
  ],
  [
    "register_butcher",
    {
      carcass: `${ME}:alpaca_carcass`,
      look: "sheep",
      cuts: [
        { item: "minecraft:white_wool", count: [1, 2] },
        { item: "minecraft:leather", count: [1, 1] },
        { item: "minecraft:mutton", count: [2, 3], maleBonus: 1 },
        { item: "kaleidoscope_ranching:large_bone", count: [1, 2] },
      ],
    },
  ],
  [
    "register_recipe",
    {
      id: `${ME}:alpaca_yogurt`,
      station: "fermenting_jar",
      inputs: [{ item: `${ME}:alpaca_milk`, count: 1 }],
      outputs: [{ item: `${ME}:alpaca_yogurt`, count: 1 }],
      ticks: 24000,
    },
  ],
];

let registered = false;

function register() {
  if (registered) return;
  registered = true;
  for (const [event, payload] of REGISTRATIONS) system.sendScriptEvent(`${R}:${event}`, JSON.stringify(payload));
}

system.afterEvents.scriptEventReceive.subscribe(({ id, message }) => {
  if (id === `${R}:api_ready`) return register();

  if (id === `${R}:api_result`) {
    const result = JSON.parse(message);
    // Results for every add-on arrive here; report only our own.
    if (!result.ok && String(result.id ?? "").startsWith(`${ME}:`)) console.warn(`[${ME}] Ranching refused ${result.event} ${result.id ?? ""}: ${result.error}`);
    return;
  }

  if (id === `${R}:animal_event`) {
    const event = JSON.parse(message);
    // The Kaleidoscope series puts no text on screen: answer with a sound and particles instead.
    if (event.type === "born" && event.animal === `${ME}:alpaca`) {
      const baby = world.getEntity(event.entity);
      if (!baby?.isValid) return;
      const at = { ...baby.location, y: baby.location.y + 0.8 };
      baby.dimension.playSound("random.orb", at, { pitch: 1.4 });
      baby.dimension.spawnParticle("minecraft:villager_happy", at);
    }
  }
});

world.afterEvents.worldLoad.subscribe(() => {
  // Ranching also announces itself once after loading; pinging covers the
  // case where this pack started listening later.
  system.runTimeout(() => system.sendScriptEvent(`${R}:api_ping`, ""), 40);
});
