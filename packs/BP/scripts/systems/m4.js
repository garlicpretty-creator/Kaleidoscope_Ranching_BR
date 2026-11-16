// M4 hand tools and devices: animal crate, hitching post, cowbell.

import { system } from "@minecraft/server";
import { crateItemComponent, startCrates } from "./crate.js";
import { cowbellItemComponent } from "./cowbell.js";
import { hitchingPostComponent } from "./hitchingPost.js";

export function startM4() {
  system.beforeEvents.startup.subscribe(({ blockComponentRegistry, itemComponentRegistry }) => {
    blockComponentRegistry.registerCustomComponent("kaleidoscope_ranching:hitching_post", hitchingPostComponent);
    itemComponentRegistry.registerCustomComponent("kaleidoscope_ranching:animal_crate", crateItemComponent);
    itemComponentRegistry.registerCustomComponent("kaleidoscope_ranching:cowbell", cowbellItemComponent);
  });
  startCrates();
}
