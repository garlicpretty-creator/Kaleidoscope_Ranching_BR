// Gear an animal wears, made visible (data/gear.js).
//
// The systems keep what an animal wears in dynamic properties (workAnimals.js,
// sleep.js, packBag.js), which only scripts can read. The resource pack draws
// the gear from a synced entity property per kind, `kaleidoscope_ranching:gear_<id>`,
// so every change of a worn dynamic property is mirrored with showGear().
//
// ## Animals from other add-ons do not declare these properties; setProperty
// ## throws for them and the gear simply stays invisible.

import { world } from "@minecraft/server";
import { GEAR, gearProperty } from "../data/gear.js";
import { dp } from "./ids.js";

/** Gear id → the dynamic property that says the animal wears it. */
export const WORN = {
  harness: dp("harnessed"),
  plough: dp("ploughing"),
  blanket: dp("blanket"),
  pack_bag: dp("pack_bag"),
};

/** Shows or hides one kind of gear on the animal. */
export function showGear(entity, id, on) {
  try {
    entity.setProperty(gearProperty(id), Boolean(on));
  } catch {}
}

/** Brings every gear property in line with what the animal wears. */
export function syncGear(entity) {
  for (const { id } of GEAR) {
    try {
      const worn = entity.getDynamicProperty(WORN[id]) === true;
      if (worn !== (entity.getProperty(gearProperty(id)) === true)) showGear(entity, id, worn);
    } catch {}
  }
}

/** Animals saved before gear was drawn pick up their properties as they load. */
export function startGear() {
  world.afterEvents.entityLoad.subscribe(({ entity }) => {
    if (entity?.typeId?.startsWith("kaleidoscope_ranching:")) syncGear(entity);
  });
}
