// M1: vanilla behaviours the Ranching replacements must keep.
//
// - Shears on an unsheared adult sheep drop 1–3 wool of its colour.
// - Dye on a sheep recolours it.
// - A saddled pig drops its saddle on death.

import { ItemStack, world } from "@minecraft/server";
import { isBaby } from "../core/animal.js";
import { rid } from "../core/ids.js";
import { registerEntityInteraction } from "../core/interact.js";
import { consumeMainHand, damageMainHand } from "../core/inventory.js";

const SHEEP = rid("sheep");
// 1.1 追加: the alpaca is sheared with shears too, for its own fleece.
const ALPACA = rid("alpaca");
const ALPACA_WOOL = rid("alpaca_wool");
// Mirrors minecraft:color for the client (the render controller picks the wool texture from it).
const WOOL_COLOR = rid("wool_color");
const PIG = rid("pig");

// Index = Bedrock colour value.
const COLORS = [
  "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
  "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];

const DYES = new Map(COLORS.map((color, index) => [`minecraft:${color}_dye`, index]));
// Legacy items that also dye in Bedrock.
DYES.set("minecraft:bone_meal", 0);
DYES.set("minecraft:lapis_lazuli", 11);
DYES.set("minecraft:cocoa_beans", 12);
DYES.set("minecraft:ink_sac", 15);

function colorOf(sheep) {
  try {
    return sheep.getComponent("minecraft:color")?.value ?? 0;
  } catch {
    return 0;
  }
}

export function startVanillaParity() {
  registerEntityInteraction({
    id: "m1:dye_sheep",
    priority: 60,
    match: ({ entity, item }) => entity.typeId === SHEEP && DYES.has(item?.typeId) && colorOf(entity) !== DYES.get(item.typeId),
    handle: ({ player, entity, item }) => {
      entity.triggerEvent(`kaleidoscope_ranching:set_color_${DYES.get(item.typeId)}`);
      consumeMainHand(player);
    },
  });

  registerEntityInteraction({
    id: "m1:shear_sheep",
    priority: 60,
    match: ({ entity, item }) =>
      entity.typeId === SHEEP && item?.typeId === "minecraft:shears" && !isBaby(entity) && !entity.hasComponent("minecraft:is_sheared"),
    handle: ({ player, entity }) => {
      const wool = `minecraft:${COLORS[colorOf(entity) & 15]}_wool`;
      const count = 1 + Math.floor(Math.random() * 3);
      entity.dimension.spawnItem(new ItemStack(wool, count), entity.location);
      entity.triggerEvent("kaleidoscope_ranching:shear");
      entity.dimension.playSound("mob.sheep.shear", entity.location);
      damageMainHand(player);
    },
  });

  registerEntityInteraction({
    id: "m1:shear_alpaca",
    priority: 60,
    match: ({ entity, item }) =>
      entity.typeId === ALPACA && item?.typeId === "minecraft:shears" && !isBaby(entity) && !entity.hasComponent("minecraft:is_sheared"),
    handle: ({ player, entity }) => {
      entity.dimension.spawnItem(new ItemStack(ALPACA_WOOL, 1 + Math.floor(Math.random() * 2)), entity.location);
      entity.triggerEvent("kaleidoscope_ranching:shear");
      entity.dimension.playSound("mob.sheep.shear", entity.location);
      damageMainHand(player);
    },
  });

  // Sheep saved before wool_color existed load with it at 0 (white); copy their real colour over.
  world.afterEvents.entityLoad.subscribe(({ entity }) => {
    try {
      if (entity.typeId !== SHEEP) return;
      const color = colorOf(entity) & 15;
      if (entity.getProperty(WOOL_COLOR) !== color) entity.setProperty(WOOL_COLOR, color);
    } catch {}
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    try {
      if (deadEntity.typeId === PIG && deadEntity.hasComponent("minecraft:is_saddled")) {
        deadEntity.dimension.spawnItem(new ItemStack("minecraft:saddle", 1), deadEntity.location);
      }
    } catch {}
  });
}
