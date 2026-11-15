// M3: Ranching animals drop only a carcass when they die.
//
// ## The entity loot table is empty (tools/gen_entities.mjs); the carcass is
// ## spawned here instead because a large carcass carries data the butcher
// ## rack needs: the animal's sex (males yield more) and, for sheep, the wool
// ## colour when it still had its fleece. Item dynamic properties only work on
// ## items that do not stack, which is why large carcasses stack to 1.

import { ItemStack, world } from "@minecraft/server";
import { isBaby, sexOf, speciesOf } from "../core/animal.js";
import { dp, rid } from "../core/ids.js";

export const CARCASS_MALE = dp("carcass_male");
export const CARCASS_WOOL = dp("carcass_wool");

export function startCarcassDrops() {
  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    let species, baby, male, wool, dimension, location;
    try {
      species = speciesOf(deadEntity);
      if (!species) return;
      baby = isBaby(deadEntity);
      male = sexOf(deadEntity) === "male";
      if (species.id === "sheep" && !deadEntity.hasComponent("minecraft:is_sheared")) {
        wool = deadEntity.getComponent("minecraft:color")?.value ?? 0;
      }
      dimension = deadEntity.dimension;
      location = deadEntity.location;
    } catch {
      return;
    }
    // ## Animals other add-ons register may have no carcass (docs/API.md).
    if (baby || !species.carcass) return;

    const carcass = new ItemStack(rid(species.carcass), 1);
    if (species.largeCarcass) {
      carcass.setDynamicProperty(CARCASS_MALE, male);
      if (wool !== undefined) carcass.setDynamicProperty(CARCASS_WOOL, wool);
    }
    dimension.spawnItem(carcass, location);
  });
}
