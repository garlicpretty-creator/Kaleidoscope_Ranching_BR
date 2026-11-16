// Gear an animal wears where everyone can see it (1.1 役用、披毯、馱袋).
//
// Field notes
// - id:      the gear kind; the animal's synced entity property is `kaleidoscope_ranching:gear_<id>`
//            (tools/gen_entities.mjs declares it, core/gear.js sets it), and the gear model has a
//            bone `gear_<id>` shown while it is true (art_src/m4_scripts/gear.py).
// - item:    the item that puts it on.
// - animals: built-in animals that can wear it (ids from data/animals.js).
// - babies:  whether a young animal can wear it too; the gear model then also has `gear_<id>_baby`.
//
// Animals from other add-ons (api/ranchingApi.js `harness`, `packBag`) wear gear by the same
// rules but show nothing unless their own pack draws it.

export const GEAR = [
  { id: "harness", item: "harness", animals: ["buffalo"], babies: false },
  { id: "plough", item: "plough", animals: ["buffalo"], babies: false },
  { id: "blanket", item: "animal_blanket", animals: ["cow", "sheep", "goat", "pig", "buffalo"], babies: true },
  { id: "pack_bag", item: "pack_bag", animals: ["yak"], babies: false },
];

/** The synced entity property that says an animal wears `id`. */
export const gearProperty = (id) => `kaleidoscope_ranching:gear_${id}`;

/** Gear kinds a built-in animal can wear. */
export const gearOf = (animalId) => GEAR.filter((gear) => gear.animals.includes(animalId));
