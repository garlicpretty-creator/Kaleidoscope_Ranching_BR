// Optional integration with Kaleidoscope Tavern (森羅物語：酒館（非官方）), through its
// public v1 extension API (企劃書 1.1 酒館整合). Nothing happens without the Tavern.
//
// - The vendored SDK (api/tavern_sdk/, BSD 3-Clause) pings the Tavern, waits for
//   its api_ready and sends one extension in chunks; the Tavern acknowledges it.
//   The SDK itself skips the shaker parts if the Tavern lacks those capabilities.
// - Sent: Ranching's dairy as shaker inputs, two shaker drinks made from it, and
//   a guide page. The drinks are Ranching items, so they exist with or without
//   the Tavern; only the Tavern makes them.
// - Once the Tavern answers, its four grapes become vegetable feed (pigs, rabbits).
//
// - Milk wine: Ranching's two milk buckets are Tavern fluids (custom_fluids),
//   drawn in an open barrel by Ranching's own visual entity. Fermented in the
//   Tavern's barrel with yogurt as the starter, the wine is drawn off into a
//   horn cup (the recipe's carrier); drinking it gives the cup back.
//
// ## The wine is one item whatever the Tavern's six ageing levels say: Ranching
// ## products have no quality grades (the player's call).

import { system } from "@minecraft/server";
import { registerTavernExtension } from "./tavern_sdk/tavern-extension-client.js";
import { KIND, registerFeed } from "../data/feeds.js";
import { PACK_VERSION } from "./ranchingApi.js";

const R = (id) => `kaleidoscope_ranching:${id}`;
const TAVERN_READY = "kaleidoscope_tavern:api_ready";
export const TAVERN_GRAPES = ["grape", "green_grape", "gold_grape", "ice_grape"].map((id) => `kaleidoscope_tavern:${id}`);

const text = (zh_TW, zh_CN, en_US) => ({ zh_TW, zh_CN, en_US });

export const TAVERN_EXTENSION = {
  api: 1,
  source: "kaleidoscope_ranching",
  version: PACK_VERSION,
  title: text("森羅物語：樂牧", "森罗物语：乐牧", "Kaleidoscope Ranching"),
  fluids: [
    {
      id: R("fresh_milk"),
      filled: R("fresh_milk_bucket"),
      empty: "minecraft:bucket",
      title: text("鮮奶", "鲜奶", "Fresh Milk"),
      visuals: { barrel: R("milk_barrel_visual") },
    },
    {
      id: R("yak_milk"),
      filled: R("yak_milk_bucket"),
      empty: "minecraft:bucket",
      title: text("氂牛奶", "牦牛奶", "Yak Milk"),
      visuals: { barrel: R("milk_barrel_visual") },
    },
  ],
  shakerInputs: [
    { item: R("cream"), color: 0xf8f2e4 },
    { item: R("yogurt"), color: 0xf6f2ea },
    { item: R("skim_milk"), color: 0xe8eef4 },
    { item: R("condensed_milk"), color: 0xf4e2b4 },
    { item: R("vanilla_ice_cream"), color: 0xfaf4dc },
  ],
  recipes: [
    {
      id: R("barrel/milk_wine"),
      kind: "barrel",
      fluid: R("fresh_milk"),
      ingredients: [[R("yogurt")], ["minecraft:sugar", "minecraft:honey_bottle"]],
      carrier: R("horn_cup"),
      output: { item: R("milk_wine") },
      title: text("奶酒", "奶酒", "Milk Wine"),
    },
    {
      id: R("barrel/yak_milk_wine"),
      kind: "barrel",
      fluid: R("yak_milk"),
      ingredients: [[R("yogurt")], ["minecraft:wheat"]],
      carrier: R("horn_cup"),
      output: { item: R("yak_milk_wine") },
      title: text("氂牛奶酒", "牦牛奶酒", "Yak Milk Wine"),
    },
    {
      id: R("shaker/cream_cocoa"),
      kind: "shaker",
      ingredients: [[R("cream")], ["minecraft:cocoa_beans"], ["minecraft:sugar"]],
      output: { item: R("cream_cocoa") },
      title: text("鮮奶油可可飲", "淡奶油可可饮", "Cream Cocoa"),
    },
    {
      id: R("shaker/yogurt_berry_drink"),
      kind: "shaker",
      ingredients: [[R("yogurt")], ["minecraft:sweet_berries"], [R("condensed_milk"), "minecraft:sugar"]],
      output: { item: R("yogurt_berry_drink") },
      title: text("優格莓果飲", "酸奶莓果饮", "Yogurt Berry Drink"),
    },
  ],
  pages: [
    {
      id: R("dairy_drinks"),
      title: text("樂牧的乳品調飲", "乐牧的乳品调饮", "Ranching dairy drinks"),
      body: text(
        "樂牧的鮮奶油、優格、脫脂奶、煉乳與香草冰淇淋都能放進調酒器。",
        "乐牧的淡奶油、酸奶、脱脂奶、炼乳与香草冰淇淋都能放进调酒器。",
        "Ranching's cream, yogurt, skim milk, condensed milk and vanilla ice cream all go into the shaker."
      ),
      recipeIds: [R("shaker/cream_cocoa"), R("shaker/yogurt_berry_drink")],
    },
    {
      id: R("milk_wine"),
      title: text("奶酒與角杯", "奶酒与角杯", "Milk wine and the horn cup"),
      body: text(
        "把桶裝鮮奶或桶裝氂牛奶倒進酒桶，加優格當酒引，再加糖、蜂蜜或小麥。熟成後用角杯（一個牛角做成）裝出來；喝完會留下角杯。桶裝鮮奶用原版牛奶桶換，或一個空桶加三瓶牛奶、山羊奶或水牛奶；桶裝氂牛奶用空桶加三瓶氂牛奶。",
        "把桶装鲜奶或桶装牦牛奶倒进酒桶，加酸奶当酒引，再加糖、蜂蜜或小麦。熟成后用角杯（一个牛角做成）装出来；喝完会留下角杯。桶装鲜奶用原版牛奶桶换，或一个空桶加三瓶牛奶、山羊奶或水牛奶；桶装牦牛奶用空桶加三瓶牦牛奶。",
        "Pour a bucket of fresh milk or yak milk into the barrel, add yogurt as the starter and sugar, honey or wheat. Draw the wine off into a horn cup (made from one cattle horn); the cup comes back when you drink it. Fresh milk comes from a vanilla milk bucket, or a bucket and three bottles of cow, goat or buffalo milk; yak milk from a bucket and three bottles of yak milk."
      ),
      recipeIds: [R("barrel/milk_wine"), R("barrel/yak_milk_wine")],
    },
  ],
};

let handle = null;
let tavernSeen = false;

/** Handles the Tavern's api_ready (exported for tests): its grapes become feed. */
export function onTavernReady() {
  if (tavernSeen) return false;
  tavernSeen = true;
  for (const grape of TAVERN_GRAPES) registerFeed(grape, KIND.VEG, 1);
  console.info("[kaleidoscope_ranching] Tavern found: dairy drinks sent, grapes are feed");
  return true;
}

export function connectToTavern() {
  system.afterEvents.scriptEventReceive.subscribe(
    (event) => {
      if (event.id === TAVERN_READY) onTavernReady();
    },
    { namespaces: ["kaleidoscope_tavern"] }
  );
  // The SDK pings and retries on its own; it logs only if the Tavern never acknowledges.
  handle = registerTavernExtension(system, TAVERN_EXTENSION, { log: () => {} });
  return handle;
}
