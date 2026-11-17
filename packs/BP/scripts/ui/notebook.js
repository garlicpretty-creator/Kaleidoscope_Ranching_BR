// 觀察手冊 (item id ranch_notebook, formerly 牧場記事本): use it on an animal to
// observe it in detail and rename it; use it in the air to browse the ear-tag
// roster and, for operators, the settings.

import { world, PlayerPermissionLevel } from "@minecraft/server";
import { CFG_SLEEP } from "../systems/sleep.js";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { CFG_CLEAN_NEED } from "../data/care_config.js";
import { getAffection, getHearts, needsToday, cleanNeedEnabled } from "../care/state.js";
import { updateRoster, rosterEntries } from "./roster.js";
import { today } from "../utils/world_util.js";
import { T, L, lines, heartBar } from "./text.js";
import { CARE } from "../data/care_config.js";
import { isBaby, isFemale, speciesOf } from "../core/animal.js";
import { canBreed, production } from "../core/husbandry.js";
import { diseaseEnabled, isSick, riskOf } from "../systems/disease.js";
import { BLANKET, LAST_NIGHT, isAsleep, isSheltered, sleepEnabled } from "../systems/sleep.js";
import { LAST_MILKED_DAY, NURSING_FEEDS } from "../systems/milking.js";
import { NURSING_FEEDS_TO_GROW } from "../data/animals.js";
import { daysToBirth, isResting } from "../systems/breeding.js";
import { HARNESSED, PLOUGHING } from "../systems/workAnimals.js";
import { PACKED, bagContents, bagOf } from "../systems/packBag.js";
import { MOULT_MIN_HEARTS, moultOf } from "../systems/moult.js";
import { forageOf } from "../systems/truffle.js";
import { CFG_PASTURE, GRAZED_DAY } from "../data/pasture.js";
import { CFG_BLOCK_FX } from "../data/stationFrames.js";

function mark(ok) {
  return ok ? "§a✔§r" : "§c✘§r";
}

const O = (key, args) => T(`observe.${key}`, args);
const section = (key) => ({ rawtext: [{ text: "\n§l" }, T(`observe.section.${key}`), { text: "§r" }] });

/** Every line of the observation page, as rawtext parts. Exported for tests. */
export function observe(e) {
  const day = today();
  const species = speciesOf(e);
  const baby = isBaby(e);
  const female = isFemale(e);
  const tag = e.getDynamicProperty("kr:ear_tag");
  const out = [];

  // Who it is.
  out.push(T("info.name", [e.nameTag ? e.nameTag : T("info.unnamed")]));
  out.push(O("who", [L(`entity.${e.typeId}.name`), T(`gender.${female ? "female" : "male"}`), O(baby ? "age.baby" : "age.adult")]));
  if (tag !== undefined) out.push(T("info.ear_tag", [`#${String(tag).padStart(3, "0")}`]));

  // Affection.
  const points = getAffection(e);
  out.push(O("hearts", [heartBar(getHearts(e)), `${points}`, `${CARE.MAX_POINTS}`]));

  // Today's care.
  out.push(section("today"));
  const n = needsToday(e);
  const needParts = [T("need.fed"), ` ${mark(n.fed)}  `, T("need.water"), ` ${mark(n.water)}  `, T("need.groom"), ` ${mark(n.groom)}`];
  if (cleanNeedEnabled()) needParts.push("  ", T("need.clean"), ` ${mark(n.clean)}`);
  out.push({ rawtext: needParts.map((p) => (typeof p === "string" ? { text: p } : p)) });
  out.push(O(n.all ? "needs.all" : "needs.some"));
  if (e.getDynamicProperty(GRAZED_DAY) === day) out.push(O("needs.grazed"));

  // Health.
  out.push(section("health"));
  if (isSick(e)) out.push(O("health.sick"));
  else {
    const risk = diseaseEnabled() ? riskOf(e, day) : null;
    out.push(O(risk ? `health.risk_${risk}` : "health.well"));
  }

  // Rest.
  if (sleepEnabled()) {
    out.push(section("rest"));
    out.push(O(isAsleep(e) ? "rest.asleep" : "rest.awake"));
    const night = e.getDynamicProperty(LAST_NIGHT);
    if (typeof night === "string") out.push(O(`rest.night_${night}`));
    out.push(O(isSheltered(e) ? "rest.sheltered" : "rest.open_sky"));
    if (e.getDynamicProperty(BLANKET) === true) out.push(O("rest.blanket"));
  }

  // Produce.
  const product = species?.dailyProduct;
  const produce = [];
  if (product && female && !baby) {
    const { produces } = production(e, day);
    if (product.via === "milking_pail") {
      produce.push(O(e.getDynamicProperty(LAST_MILKED_DAY) === day ? "produce.milked" : produces ? "produce.milk_ready" : "produce.no_milk"));
    } else {
      produce.push(O(produces ? "produce.lays" : "produce.no_eggs"));
    }
  }
  const moult = moultOf(e.typeId);
  if (moult && !baby) produce.push(O(getHearts(e) >= MOULT_MIN_HEARTS ? "produce.moults" : "produce.moult_shy", [`${MOULT_MIN_HEARTS}`]));
  const forage = forageOf(e.typeId);
  if (forage && !baby) {
    const need = forage.minHearts ?? 0;
    produce.push(O(getHearts(e) >= need ? "produce.forages" : "produce.forage_shy", [`${need}`]));
  }
  if (produce.length) out.push(section("produce"), ...produce);

  // Family.
  out.push(section("family"));
  if (baby) {
    if (species?.reproduction === "gestation") {
      const feeds = e.getDynamicProperty(NURSING_FEEDS) ?? 0;
      out.push(O("family.nursed", [`${feeds}`, `${NURSING_FEEDS_TO_GROW}`]));
    } else out.push(O("family.growing"));
  } else if (female && daysToBirth(e) > 0) {
    out.push(O("family.pregnant", [`${daysToBirth(e)}`]));
  } else if (isResting(e)) {
    out.push(O("family.resting"));
  } else {
    out.push(O(canBreed(e) && n.all ? "family.ready" : "family.not_ready"));
  }

  // Gear.
  const gear = [];
  if (e.getDynamicProperty(HARNESSED) === true) gear.push(O(e.getDynamicProperty(PLOUGHING) === true ? "gear.plough" : "gear.harness"));
  if (e.getDynamicProperty(PACKED) === true) gear.push(O("gear.pack_bag", [`${bagContents(e).length}`, `${bagOf(e)?.size ?? 0}`]));
  if (gear.length) out.push(section("gear"), ...gear);
  return out;
}

export function showAnimal(player, e) {
  const body = lines(...observe(e));
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
    // 1.1 動物作息 (systems/sleep.js)
    .toggle(T("settings.sleep"), { defaultValue: world.getDynamicProperty(CFG_SLEEP) !== false })
    .toggle(T("settings.disease"), { defaultValue: world.getDynamicProperty("kr:cfg:disease") !== false })
    // 1.1 追加 草場與放牧 (systems/pasture.js)
    .toggle(T("settings.pasture"), { defaultValue: world.getDynamicProperty(CFG_PASTURE) !== false })
    // 1.1 追加 方塊動畫 (core/blockFrames.js, systems/blockFx.js)
    .toggle(T("settings.block_fx"), { defaultValue: world.getDynamicProperty(CFG_BLOCK_FX) !== false })
    .show(player)
    .then((r) => {
      if (r.canceled) return;
      world.setDynamicProperty(CFG_CLEAN_NEED, !!r.formValues?.[0]);
      world.setDynamicProperty(CFG_SLEEP, !!r.formValues?.[1]);
      world.setDynamicProperty("kr:cfg:disease", !!r.formValues?.[2]);
      world.setDynamicProperty(CFG_PASTURE, !!r.formValues?.[3]);
      world.setDynamicProperty(CFG_BLOCK_FX, !!r.formValues?.[4]);
    })
    .catch(() => {});
}
