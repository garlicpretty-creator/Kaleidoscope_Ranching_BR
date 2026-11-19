// 1.1 動物動作: everyday animations for every Ranching animal (企劃書 1.2 五、沉浸式動畫,
// moved forward into 1.1 on 2026-11-17).
//
// The behaviour pack sets the synced enum property kaleidoscope_ranching:action
// (data/actions.js, core/actions.js). For each animal this writes
//   animations/<id>.actions.animation.json            eat, drink, petted, graze, chew
//   animation_controllers/<id>.actions.animation_controllers.json
// and wires the controller into the client entity:
// - eat     head down to the trough, chewing; poultry peck; the rabbit nibbles.
// - drink   head lower, lapping; poultry dip the beak and tip the head back to swallow.
// - petted  the head leans in and sways, the tail wags; poultry fluff up; the rabbit lays its ears back.
// - graze   head to the ground (1.1 追加 草場與放牧, systems/pasture.js), for every animal that grazes
//           (data/pasture.js GRAZE); the sheep also plays it for its own grass eating (q.is_grazing).
// - chew    the ruminants chew now and then while standing still: client only, no property.
// 1.1 追加 新動物的招牌動作 (企劃書 四; systems/specialActions.js sets the property):
// - display   開屏, the adult tom (data/actions.js SPECIAL_ACTIONS): the tail swings up over the
//             back and spreads (turkey.py FAN), the wings droop to the ground, the head pulls back
//             onto the puffed breast, and it stamps in place, turning a little to show off.
// - dust_bath 沙浴, the quail and its chicks: belly down on the sand, rolling from side to side,
//             wings fluttering and the head tossing dust; the script raises the dust.
// - spit      吐口水, the alpaca: the head pulls back, the ears pin back, and it spits forward.
// - shake     甩頭, the alpaca now and then while standing still: the head shakes and the ears
//             flick (a_/b_ear_left/right bones); client only, no property, like chew.
// The controller leaves each state when the property changes or after the action's
// time (ACTION_SECONDS), so a property left set when a world closed plays only once.
// The head stops following the player (look_at_target) while an action plays.
//
// Run after gen_sleep.mjs (it rebuilds the animate list) and the gear layers; npm run generate does.
// Idempotent.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const load = (name) => import(pathToFileURL(join(root, "packs/BP/scripts/data", name)).href);
const { ANIMALS } = await load("animals.js");
const { ACTION_PROPERTY, ACTION_SECONDS, SPECIAL_ACTIONS } = await load("actions.js");
const { GRAZE } = await load("pasture.js");

const NS = "kaleidoscope_ranching";
const RP = join(root, "packs/RP");
const ASLEEP = `q.property('${NS}:sleeping')`;
const ACTION = (value) => `q.property('${ACTION_PROPERTY}') == '${value}'`;
const KEYS = ["eat", "drink", "petted", "graze", "chew", "display", "dust_bath", "spit", "shake", "actions"];

const POULTRY = new Set(["chicken", "duck", "goose", "quail", "turkey"]);
/**
 * Per species: pixels the adult head drops at the bottom of a peck or a sip, on top of the 70°
 * nod, for birds whose neck stands too tall for the bill to reach the feed (the turkey's head is
 * about 9 px up at the nod; trough feed is at 5). The young keep the plain nod.
 */
const PECK_DIP = { turkey: 3 };
/**
 * Poultry too small for the 70° peck to bring the bill to the ground: the head also moves this
 * far (model pixels, [x, y, z], -z forward) at the bottom of the peck, per head bone. The quail's
 * bill comes to under half a pixel off the ground; it cannot reach into a trough (accepted).
 */
const PECK_REACH = { quail: { head: [0, -2.5, -0.5], b_head: [0, -0.9, -1.5] } };
/** Animals that graze on a pasture (data/pasture.js). */
const GRAZERS = new Set(Object.keys(GRAZE).map((typeId) => typeId.split(":")[1]));
/** Animals whose behaviour pack eats grass blocks itself (minecraft:behavior.eat_block, q.is_grazing): the sheep. */
const EAT_BLOCK = new Set(["sheep"]);
/** Animals that chew the cud while standing still. */
const RUMINANTS = new Set(["cow", "buffalo", "yak", "sheep", "goat", "alpaca"]);
/** Every so many seconds of its life an idle ruminant chews for a few seconds (life time keeps herds out of step). */
const CHEW_EVERY = 20;
const CHEW_SECONDS = 3;
/** The alpaca shakes its head once every so many seconds of its life (offset from the chew), for this long. */
const SHAKE_EVERY = 17;
const SHAKE_AT = 9;
const SHAKE_SECONDS = 1.5;

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
};

/** Head bones to move: the adult's, and the young one's when it does not hang from the adult's. */
function heads(bones) {
  const has = (name) => bones.some((b) => b.name === name);
  const out = [has("head") ? "head" : "a_head"];
  const baby = bones.find((b) => b.name === "b_head");
  if (baby && baby.parent !== "head") out.push("b_head");
  return out.filter(has);
}

function animationsFor(id, bones) {
  const has = (name) => bones.some((b) => b.name === name);
  const each = (names, channels) => Object.fromEntries(names.filter(has).map((name) => [name, channels]));
  const H = heads(bones);
  const tails = ["a_tail", "b_tail"];
  const wings = (side, sign) => each([`a_wing_${side}`, `b_wing_${side}`], { rotation: [0, 0, `${sign}(10 + math.abs(math.sin(q.anim_time * 360)) * 8)`] });
  const out = {};

  if (POULTRY.has(id)) {
    const PECK = "math.max(0, math.sin(q.anim_time * 720))";
    const reach = PECK_REACH[id] ?? {};
    // Adds the reach (PECK_REACH) to each head bone that has one; other poultry are unchanged.
    const peck = (bones, position) => {
      for (const [name, r] of Object.entries(reach)) if (bones[name]) bones[name] = { ...bones[name], position: position(r) };
      return bones;
    };
    out.eat = {
      loop: true,
      bones: peck(each(H, { rotation: [`${PECK} * 70`, 0, 0] }), (r) => r.map((v) => (v ? `${PECK} * ${v}` : 0))),
    };
    out.drink = {
      loop: true,
      animation_length: 1.4,
      bones: peck(each(H, { rotation: { "0.0": [0, 0, 0], "0.35": [70, 0, 0], "0.7": [-40, 0, 0], "1.1": [0, 0, 0] } }), (r) => ({
        "0.0": [0, 0, 0],
        "0.35": r,
        "0.7": [0, 0, 0],
        "1.1": [0, 0, 0],
      })),
    };
    const dip = PECK_DIP[id];
    if (dip && H[0] !== "b_head") {
      const adult = H[0];
      out.eat.bones[adult] = { ...out.eat.bones[adult], position: [0, `-math.max(0, math.sin(q.anim_time * 720)) * ${dip}`, 0] };
      out.drink.bones[adult] = {
        ...out.drink.bones[adult],
        position: { "0.0": [0, 0, 0], "0.35": [0, -dip, 0], "0.7": [0, 0, 0], "1.1": [0, 0, 0] },
      };
    }
    out.petted = {
      loop: true,
      bones: {
        ...each(["body"], { scale: "1 + math.abs(math.sin(q.anim_time * 360)) * 0.06" }),
        ...each(H, { rotation: [-5, 0, "math.sin(q.anim_time * 360) * 15"] }),
        ...wings("left", "-"),
        ...wings("right", ""),
        ...each(tails, { rotation: [0, "math.sin(q.anim_time * 1080) * 20", 0] }),
      },
    };
  } else if (id === "rabbit") {
    out.eat = { loop: true, bones: { ...each(H, { rotation: ["18 + math.sin(q.anim_time * 1440) * 3", 0, 0] }), ...each(["a_ears"], { rotation: [12, 0, 0] }) } };
    out.drink = { loop: true, bones: each(H, { rotation: ["26 + math.sin(q.anim_time * 720) * 2", 0, 0] }) };
    out.petted = {
      loop: true,
      bones: {
        ...each(H, { rotation: [-5, 0, "math.sin(q.anim_time * 360) * 12"] }),
        ...each(["a_ears"], { rotation: [45, 0, 0] }),
        ...each(tails, { rotation: [0, "math.sin(q.anim_time * 1440) * 20", 0] }),
      },
    };
  } else {
    out.eat = { loop: true, bones: each(H, { rotation: ["38 + math.sin(q.anim_time * 720) * 4", "math.sin(q.anim_time * 180) * 6", 0] }) };
    out.drink = { loop: true, bones: each(H, { rotation: ["50 + math.sin(q.anim_time * 540) * 3", 0, 0] }) };
    out.petted = {
      loop: true,
      bones: {
        ...each(H, { rotation: ["-6 + math.sin(q.anim_time * 360) * 4", "math.sin(q.anim_time * 360) * 14", 10] }),
        ...each(tails, { rotation: [0, "math.sin(q.anim_time * 1080) * 28", 0] }),
      },
    };
  }
  if (GRAZERS.has(id)) {
    // Poultry peck and the rabbit nibbles as they do at a trough; the rest put the head to the ground.
    out.graze = POULTRY.has(id) || id === "rabbit"
      ? { ...out.eat }
      : { loop: true, bones: each(H, { rotation: ["62 + math.sin(q.anim_time * 720) * 4", 0, 0], position: [0, -2, 0] }) };
  }
  if (id === "alpaca") {
    // The alpaca bends its neck: the head bone (the base of the neck, in the chest) swings the
    // neck forward and down, and a_head (the top of the neck) tips the face back toward the
    // feed, so the face meets the food as a grazing alpaca's does instead of the whole neck
    // dropping. The muzzle comes to just over the feed (5 px), over the trough's rim (7 px)
    // and 2 px off the grass, in front of the forelegs. The cria (b_neck > b_head) is drawn at
    // half size, so its targets are twice as many model pixels.
    // Check with art_src/m4_scripts/actions_preview.py.
    const CHEW = (k) => `math.sin(q.anim_time * 720) * ${k}`;
    const SWAY = "math.sin(q.anim_time * 180) * 4";
    const bend = (neck, face, babyNeck, babyFace) => ({
      ...(has("head") ? { head: { rotation: neck } } : {}),
      ...(has("a_head") ? { a_head: { rotation: face } } : {}),
      ...(has("b_neck") ? { b_neck: { rotation: babyNeck } } : {}),
      ...(has("b_head") ? { b_head: { rotation: babyFace } } : {}),
    });
    out.eat = {
      loop: true,
      bones: bend([105, SWAY, 0], [`-30 + ${CHEW(5)}`, 0, 0], [70, SWAY, 0], [`-25 + ${CHEW(5)}`, 0, 0]),
    };
    out.drink = {
      loop: true,
      bones: bend([90, 0, 0], ["-20 + math.sin(q.anim_time * 540) * 3", 0, 0], [30, 0, 0], ["10 + math.sin(q.anim_time * 540) * 3", 0, 0]),
    };
    if (GRAZERS.has(id)) {
      out.graze = {
        loop: true,
        bones: bend([130, SWAY, 0], [`-35 + ${CHEW(4)}`, 0, 0], [130, SWAY, 0], [`-40 + ${CHEW(4)}`, 0, 0]),
      };
    }
  }
  Object.assign(out, specialFor(SPECIAL_ACTIONS[id], each));
  if (id === "alpaca") out.shake = headShake(each);
  if (RUMINANTS.has(id)) {
    out.chew = { loop: true, bones: each(H, { rotation: ["4 + math.sin(q.anim_time * 540) * 2", "math.sin(q.anim_time * 270) * 4", 0] }) };
  }
  return Object.fromEntries(Object.entries(out).map(([key, anim]) => [`animation.${NS}.${id}.${key}`, anim]));
}

// --- 1.1 追加 special actions ---------------------------------------------------------
// Check the poses with art_src/m4_scripts/actions_preview.py --special (nothing under the ground).

/** q.is_baby is 1 or 0 in Molang: picks the young value or the adult's inside an expression. */
const young = (baby, adult) => `(q.is_baby * ${baby} + (1 - q.is_baby) * ${adult})`;

function specialFor(action, each) {
  if (action === "display") {
    // turkey.py FAN (the wings dropped further, their tips trailing on the ground), held while it stamps (the legs lift in turn) and turns from side to side.
    // Only an adult tom plays it (systems/specialActions.js), so only the adult's bones move.
    const STEP = "math.sin(q.anim_time * 360)";
    return {
      display: {
        loop: true,
        bones: {
          ...each(["body"], { rotation: [0, "math.sin(q.anim_time * 90) * 12", 0] }),
          ...each(["a_tail"], { rotation: [125, 0, "math.sin(q.anim_time * 2160) * 1.5"], scale: [2.0, 1.6, 0.5] }),
          ...each(["a_wing_left"], { rotation: [-8, 0, -14], position: [0.5, -4.5, 0] }),
          ...each(["a_wing_right"], { rotation: [-8, 0, 14], position: [-0.5, -4.5, 0] }),
          ...each(["head"], { rotation: ["-18 + math.sin(q.anim_time * 180) * 3", 0, 0], position: [0, 0, 1] }),
          ...each(["a_torso"], { scale: [1.08, 1.06, 1.04] }),
          ...each(["a_leg_left"], { position: [0, `math.max(0, ${STEP}) * 1.5`, 0] }),
          ...each(["a_leg_right"], { position: [0, `math.max(0, -${STEP}) * 1.5`, 0] }),
        },
      },
    };
  }
  if (action === "dust_bath") {
    // Belly on the ground (the legs folded away, as in the roost), rolling from side to side
    // (ROLL, about the ground under it; lifted by the roll's sag so the low flank stays on the
    // ground), the wings fluttering and the head tossing dust over the back.
    const PHASE = "math.sin(q.anim_time * 240)";
    const ROLL = 18;
    const LIFT = 0.7;
    const FLAP = "math.abs(math.sin(q.anim_time * 1440))";
    const wing = (sign) => ({ rotation: [0, 0, `${sign}(25 + ${FLAP} * 25)`] });
    return {
      dust_bath: {
        loop: true,
        bones: {
          ...each(["body"], {
            rotation: [0, 0, `${PHASE} * ${ROLL}`],
            position: [0, `-${young(0.5, 1.5)} + math.abs(${PHASE}) * ${LIFT}`, 0],
          }),
          ...each(["a_leg_left", "a_leg_right", "b_leg_left", "b_leg_right"], { scale: [1, 0.05, 1] }),
          ...each(["a_wing_left", "b_wing_left"], wing("-")),
          ...each(["a_wing_right", "b_wing_right"], wing("")),
          ...each(["head", "b_head"], { rotation: [`-10 - math.abs(${PHASE}) * 15`, 0, "math.sin(q.anim_time * 1440) * 12"] }),
          ...each(["a_torso", "b_torso"], { scale: `1 + ${FLAP} * 0.05` }),
          ...each(["a_tail"], { rotation: [-25, "math.sin(q.anim_time * 1440) * 20", 0] }),
        },
      },
    };
  }
  if (action === "spit") {
    // Ears pinned back, the head drawn back and up, then thrust forward as it spits (the script
    // sends the spit at the 0.45 s mark's direction: the player who hit it).
    const head = {
      rotation: { "0.0": [0, 0, 0], "0.3": [-10, 0, 0], "0.45": [10, 0, 0], "0.8": [0, 0, 0] },
      position: { "0.0": [0, 0, 0], "0.3": [0, 0.5, 0.5], "0.45": [0, 0, -1.5], "0.8": [0, 0, 0] },
    };
    return {
      spit: {
        animation_length: ACTION_SECONDS.spit,
        bones: {
          ...each(["head", "b_head"], head),
          ...each(["a_ear_left", "a_ear_right", "b_ear_left", "b_ear_right"], { rotation: [-50, 0, 0] }),
        },
      },
    };
  }
  return {};
}

/** 甩頭: the head shakes off a fly, the ears flick out and back. */
function headShake(each) {
  const SHAKE = "math.sin(q.anim_time * 1080)";
  const flick = (sign) => ({ rotation: [`math.sin(q.anim_time * 720) * 25`, 0, `${sign}math.abs(${SHAKE}) * 30`] });
  return {
    loop: true,
    bones: {
      ...each(["head", "b_head"], { rotation: [0, `${SHAKE} * 8`, `${SHAKE} * 14`] }),
      ...each(["a_ear_left", "b_ear_left"], flick("-")),
      ...each(["a_ear_right", "b_ear_right"], flick("")),
    },
  };
}

const SPECIAL = ["display", "dust_bath", "spit"];

function controllerFor(id, keys, eatsBlocks) {
  const state = (key, exit) => ({
    animations: [key],
    blend_transition: 0.25,
    transitions: [{ done: exit }],
  });
  const states = {
    idle: {
      blend_transition: 0.25,
      transitions: [
        ...["eat", "drink", "petted"].map((key) => ({ [key]: ACTION(key) })),
        ...(keys.includes("graze") ? [{ graze: eatsBlocks ? `${ACTION("graze")} || q.is_grazing` : ACTION("graze") }] : []),
        ...(keys.includes("chew") ? [{ chew: `!q.is_moving && ${ACTION("none")} && math.mod(math.floor(q.life_time), ${CHEW_EVERY}) == 0` }] : []),
        ...SPECIAL.filter((key) => keys.includes(key)).map((key) => ({ [key]: ACTION(key) })),
        ...(keys.includes("shake") ? [{ shake: `!q.is_moving && ${ACTION("none")} && math.mod(math.floor(q.life_time), ${SHAKE_EVERY}) == ${SHAKE_AT}` }] : []),
      ],
    },
    eat: state("eat", `!(${ACTION("eat")}) || q.state_time > ${ACTION_SECONDS.eat}`),
    drink: state("drink", `!(${ACTION("drink")}) || q.state_time > ${ACTION_SECONDS.drink}`),
    petted: state("petted", `!(${ACTION("petted")}) || q.state_time > ${ACTION_SECONDS.petted}`),
    // Back to idle only once the property is reset, so a stale value plays once.
    done: { transitions: [{ idle: ACTION("none") }] },
  };
  if (keys.includes("graze")) {
    const grazing = eatsBlocks ? `${ACTION("graze")} || q.is_grazing` : ACTION("graze");
    states.graze = { animations: ["graze"], blend_transition: 0.25, transitions: [{ done: `!(${grazing}) || q.state_time > ${ACTION_SECONDS.graze}` }] };
  }
  for (const key of SPECIAL.filter((k) => keys.includes(k))) {
    states[key] = state(key, `!(${ACTION(key)}) || q.state_time > ${ACTION_SECONDS[key]}`);
  }
  if (keys.includes("shake")) {
    states.shake = { animations: ["shake"], blend_transition: 0.2, transitions: [{ idle: `q.is_moving || !(${ACTION("none")}) || q.state_time > ${SHAKE_SECONDS}` }] };
  }
  if (keys.includes("chew")) {
    states.chew = { animations: ["chew"], blend_transition: 0.4, transitions: [{ idle: `q.is_moving || !(${ACTION("none")}) || q.state_time > ${CHEW_SECONDS}` }] };
  }
  return {
    format_version: "1.10.0",
    animation_controllers: { [`controller.animation.${NS}.${id}.actions`]: { initial_state: "idle", states } },
  };
}

let patched = 0;
for (const { id } of ANIMALS) {
  const entityPath = join(RP, "entity", `${id}.entity.json`);
  let entity;
  try {
    entity = readJson(entityPath);
  } catch {
    continue;
  }
  const description = entity["minecraft:client_entity"].description;
  const geo = readJson(join(RP, "models/entity", `${id}.geo.json`))["minecraft:geometry"][0];
  const animations = animationsFor(id, geo.bones);
  writeJson(join(RP, "animations", `${id}.actions.animation.json`), { format_version: "1.8.0", animations });
  const keys = Object.keys(animations).map((full) => full.split(".").pop());
  writeJson(join(RP, "animation_controllers", `${id}.actions.animation_controllers.json`), controllerFor(id, keys, EAT_BLOCK.has(id)));

  for (const key of KEYS) delete description.animations[key];
  for (const key of keys) description.animations[key] = `animation.${NS}.${id}.${key}`;
  description.animations.actions = `controller.animation.${NS}.${id}.actions`;

  const animate = (description.scripts.animate ?? []).filter((entry) => !KEYS.includes(typeof entry === "string" ? entry : Object.keys(entry)[0]));
  // The head follows the player only while no action moves it.
  for (const entry of animate) {
    if (typeof entry === "object" && "look_at_target" in entry) entry.look_at_target = `!${ASLEEP} && ${ACTION("none")} && !q.is_grazing`;
  }
  animate.push({ actions: `!${ASLEEP}` });
  description.scripts.animate = animate;
  writeJson(entityPath, entity);
  patched++;
}
console.log(`gen_actions: ${patched} animals eat, drink and lean into a pat`);
