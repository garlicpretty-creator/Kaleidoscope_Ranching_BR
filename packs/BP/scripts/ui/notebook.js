// 牧場記事本: inspect / rename an animal; use in the air to browse the ear-tag roster.

import { world, PlayerPermissionLevel } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { FAMILY_MALE, DP_PREGNANT_UNTIL_DAY } from "../data/m1_contract.js";
import { CFG_CLEAN_NEED } from "../data/care_config.js";
import { getHearts, needsToday, cleanNeedEnabled } from "../care/state.js";
import { updateRoster, rosterEntries } from "./roster.js";
import { today } from "../utils/world_util.js";
import { T, L, lines, heartBar } from "./text.js";

function genderOf(e) {
  return e.matches({ families: [FAMILY_MALE] }) ? "male" : "female";
}
function mark(ok) {
  return ok ? "§a✔§r" : "§c✘§r";
}

export function showAnimal(player, e) {
  const gender = genderOf(e);
  const n = needsToday(e);
  const due = e.getDynamicProperty(DP_PREGNANT_UNTIL_DAY);
  const tag = e.getDynamicProperty("kr:ear_tag");
  const preg =
    gender === "male"
      ? T("info.pregnant_na")
      : typeof due === "number" && due >= today()
        ? T("info.pregnant", [`${due - today()}`])
        : T("info.not_pregnant");

  const needParts = [T("need.fed"), ` ${mark(n.fed)}  `, T("need.water"), ` ${mark(n.water)}  `,
    T("need.groom"), ` ${mark(n.groom)}`];
  if (cleanNeedEnabled()) needParts.push("  ", T("need.clean"), ` ${mark(n.clean)}`);

  const body = lines(
    T("info.name", [e.nameTag ? e.nameTag : T("info.unnamed")]),
    T("info.species", [L(`entity.${e.typeId}.name`)]),
    T("info.gender", [T(`gender.${gender}`)]),
    T("info.hearts", [heartBar(getHearts(e))]),
    preg,
    T("info.ear_tag", [tag !== undefined ? `#${String(tag).padStart(3, "0")}` : T("info.none")]),
    "",
    T("info.needs"),
    { rawtext: needParts.map((p) => (typeof p === "string" ? { text: p } : p)) },
  );

  new ActionFormData()
    .title(T("notebook.title"))
    .body(body)
    .button(T("notebook.rename"))
    .button(T("notebook.close"))
    .show(player)
    .then((r) => {
      if (r.canceled || r.selection !== 0 || !e.isValid) return;
      rename(player, e);
    })
    .catch(() => {});
}

function rename(player, e) {
  new ModalFormData()
    .title(T("notebook.rename"))
    .textField(T("notebook.rename_label"), "", { defaultValue: e.nameTag ?? "" })
    .show(player)
    .then((r) => {
      if (r.canceled || !e.isValid) return;
      const name = String(r.formValues?.[0] ?? "").trim().slice(0, 32);
      e.nameTag = name;
      updateRoster(e);
    })
    .catch(() => {});
}

function isOperator(player) {
  try {
    return player.playerPermissionLevel === PlayerPermissionLevel.Operator;
  } catch {
    return false;
  }
}

export function showRoster(player) {
  const entries = rosterEntries();
  const form = new ActionFormData().title(T("roster.title"));
  form.body(entries.length ? T("roster.count", [`${entries.length}`]) : T("roster.empty"));
  for (const en of entries) {
    form.button({
      rawtext: [
        { text: `#${String(en.tag).padStart(3, "0")} ` },
        en.name ? { text: en.name } : { translate: `entity.${en.type}.name` },
      ],
    });
  }
  const op = isOperator(player);
  if (op) form.button(T("settings.title"));
  form
    .show(player)
    .then((r) => {
      if (r.canceled || r.selection === undefined) return;
      if (op && r.selection === entries.length) return showSettings(player);
      const en = entries[r.selection];
      if (!en) return;
      new ActionFormData()
        .title(T("roster.title"))
        .body(lines(
          T("info.species", [L(`entity.${en.type}.name`)]),
          T("roster.last_seen", [`${en.x}`, `${en.y}`, `${en.z}`]),
        ))
        .button(T("notebook.close"))
        .show(player)
        .catch(() => {});
    })
    .catch(() => {});
}

function showSettings(player) {
  new ModalFormData()
    .title(T("settings.title"))
    .toggle(T("settings.clean_need"), { defaultValue: cleanNeedEnabled() })
    .show(player)
    .then((r) => {
      if (r.canceled) return;
      world.setDynamicProperty(CFG_CLEAN_NEED, !!r.formValues?.[0]);
    })
    .catch(() => {});
}
