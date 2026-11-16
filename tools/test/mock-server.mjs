// A small in-memory stand-in for @minecraft/server, enough to run Ranching's
// scripts in Node. Ranching entities execute the events from their real
// behaviour-pack JSON, so tests also exercise the generated entity files.
//
// This is not a Minecraft emulator: AI, physics, rendering and most vanilla
// behaviour are absent. It exists to catch logic and wiring mistakes.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENTITY_DEFS = new Map();
for (const file of readdirSync(join(root, "packs/BP/entities"))) {
  const def = JSON.parse(readFileSync(join(root, "packs/BP/entities", file), "utf8"))["minecraft:entity"];
  ENTITY_DEFS.set(def.description.identifier, def);
}

// --- Events ---------------------------------------------------------------

class Signal {
  constructor() {
    this.listeners = [];
  }
  subscribe(listener) {
    this.listeners.push(listener);
    return listener;
  }
  unsubscribe(listener) {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }
  fire(event) {
    for (const listener of [...this.listeners]) listener(event);
    return event;
  }
}

// --- Enums ----------------------------------------------------------------

/** Item types: tests add other add-ons' items here (core/tags.js asks for them). */
export const __itemTypes = [];
export const ItemTypes = { getAll: () => __itemTypes.map((id) => ({ id })), get: (id) => ({ id }) };
export const EquipmentSlot = { Mainhand: "Mainhand", Offhand: "Offhand", Head: "Head", Chest: "Chest", Legs: "Legs", Feet: "Feet" };
export const GameMode = { Survival: "Survival", Creative: "Creative", Adventure: "Adventure", Spectator: "Spectator" };
export const Direction = { Up: "Up", Down: "Down", North: "North", South: "South", East: "East", West: "West" };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2, Custom: 3 };
export class BlockVolume {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }
}
const STATE_VALUES = new Map();
export const BlockStates = { get: (name) => (STATE_VALUES.has(name) ? { validValues: STATE_VALUES.get(name) } : undefined) };
/** Test helper: declares the valid values of a block state. */
export function __defineState(name, values) {
  STATE_VALUES.set(name, values);
}

// --- Items ----------------------------------------------------------------

const MAX_STACK = new Map();
const DURABLE = new Map([
  ["minecraft:shears", 238], ["minecraft:iron_sword", 250], ["minecraft:iron_axe", 250],
  ["kaleidoscope_cookery:iron_kitchen_knife", 250],
]);
const TAGS = new Map([
  ["minecraft:iron_sword", ["minecraft:is_sword"]],
  ["minecraft:iron_axe", ["minecraft:is_axe"]],
  ["kaleidoscope_cookery:iron_kitchen_knife", ["kaleidoscope_cookery:kitchen_knife"]],
  ...["bread", "apple", "carrot", "potato", "baked_potato", "cooked_beef", "rotten_flesh"].map((id) => [`minecraft:${id}`, ["minecraft:is_food"]]),
]);

// Stack sizes, durability and tags of the pack's own items come from the
// generated item files, so tests see what the game would.
for (const file of readdirSync(join(root, "packs/BP/items"))) {
  const item = JSON.parse(readFileSync(join(root, "packs/BP/items", file), "utf8"))["minecraft:item"];
  const id = item.description.identifier;
  const c = item.components ?? {};
  if (c["minecraft:max_stack_size"] !== undefined) MAX_STACK.set(id, c["minecraft:max_stack_size"]);
  if (c["minecraft:durability"]) DURABLE.set(id, c["minecraft:durability"].max_durability);
  if (c["minecraft:tags"]) TAGS.set(id, c["minecraft:tags"].tags);
}

/** Lets tests declare non-default stack sizes (e.g. generated Ranching items). */
export function __setMaxStack(typeId, max) {
  MAX_STACK.set(typeId, max);
}

export class ItemStack {
  constructor(typeId, amount = 1) {
    this.typeId = typeId.includes(":") ? typeId : `minecraft:${typeId}`;
    this.amount = amount;
    this.dynamic = new Map();
    const max = DURABLE.get(this.typeId);
    this.durability = max ? { damage: 0, maxDurability: max, getDamageChance: () => 100 } : undefined;
    // Like the game: an amount above the stack size is clamped, not an error.
    this.amount = Math.min(amount, this.maxAmount);
  }
  get maxAmount() {
    return MAX_STACK.get(this.typeId) ?? (this.durability ? 1 : 64);
  }
  getComponent(id) {
    if (id === "minecraft:durability") return this.durability;
    if (id === "minecraft:food") return this.hasTag("minecraft:is_food") ? { canAlwaysEat: false } : undefined;
    return undefined;
  }
  hasTag(tag) {
    return (TAGS.get(this.typeId) ?? []).includes(tag);
  }
  getTags() {
    return TAGS.get(this.typeId) ?? [];
  }
  getDynamicProperty(key) {
    return this.dynamic.get(key);
  }
  setDynamicProperty(key, value) {
    if (this.maxAmount > 1) throw new Error("dynamic properties need a non-stackable item");
    if (value === undefined) this.dynamic.delete(key);
    else this.dynamic.set(key, value);
  }
  getLore() {
    return [...(this.lore ?? [])];
  }
  setLore(lines) {
    this.lore = lines ? [...lines] : [];
  }
  clone() {
    const copy = new ItemStack(this.typeId, this.amount);
    copy.dynamic = new Map(this.dynamic);
    copy.lore = this.lore ? [...this.lore] : undefined;
    if (this.durability) copy.durability = { ...this.durability };
    return copy;
  }
  isStackableWith(other) {
    return other && other.typeId === this.typeId && this.maxAmount > 1 && this.dynamic.size === 0 && other.dynamic.size === 0;
  }
}

class Container {
  constructor(size) {
    this.size = size;
    this.slots = new Array(size).fill(undefined);
  }
  getItem(i) {
    return this.slots[i]?.clone();
  }
  setItem(i, item) {
    this.slots[i] = item ? item.clone() : undefined;
  }
  addItem(item) {
    let left = item.amount;
    for (let i = 0; i < this.size && left > 0; i++) {
      const slot = this.slots[i];
      if (slot && slot.isStackableWith(item)) {
        const room = slot.maxAmount - slot.amount;
        const move = Math.min(room, left);
        slot.amount += move;
        left -= move;
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const copy = item.clone();
        copy.amount = Math.min(left, item.maxAmount);
        this.slots[i] = copy;
        left -= copy.amount;
      }
    }
    if (left <= 0) return undefined;
    const rest = item.clone();
    rest.amount = left;
    return rest;
  }
  count(typeId) {
    return this.slots.reduce((sum, slot) => sum + (slot?.typeId === typeId ? slot.amount : 0), 0);
  }
}

// --- Entities -------------------------------------------------------------

let nextId = 1;

export class Entity {
  constructor(dimension, typeId, location) {
    this.id = String(nextId++);
    this.typeId = typeId;
    this.dimension = dimension;
    this.location = { ...location };
    this.rotation = { x: 0, y: 0 };
    this.nameTag = "";
    this.isValid = true;
    this.dynamic = new Map();
    this.properties = new Map();
    this.groups = new Set();
    this.extraComponents = new Map(); // for vanilla mocks
    this.events = [];
    const def = ENTITY_DEFS.get(typeId);
    this.def = def;
    if (def) {
      for (const [key, prop] of Object.entries(def.description.properties ?? {})) this.properties.set(key, prop.default);
    }
  }
  componentMap() {
    const map = new Map(Object.entries(this.def?.components ?? {}));
    for (const group of this.groups) {
      for (const [key, value] of Object.entries(this.def.component_groups[group] ?? {})) map.set(key, value);
    }
    for (const [key, value] of this.extraComponents) map.set(key, value);
    return map;
  }
  hasComponent(id) {
    return this.componentMap().has(id);
  }
  getComponent(id) {
    // Vanilla wolves in tests: tamed by setting `tamedTo` to a player id.
    if (id === "minecraft:tameable" && this.typeId === "minecraft:wolf") return { isTamed: Boolean(this.tamedTo), tamedToPlayerId: this.tamedTo };
    const data = this.componentMap().get(id);
    if (data === undefined) return undefined;
    if (id === "minecraft:color" || id === "minecraft:variant") return { value: data.value };
    if (id === "minecraft:leashable") {
      const entity = this;
      return {
        get leashHolder() {
          return entity.leashedTo?.isValid ? entity.leashedTo : undefined;
        },
        get isLeashed() {
          return Boolean(entity.leashedTo?.isValid);
        },
        leashTo: (holder) => (entity.leashedTo = holder),
        unleash: () => {
          if (entity.leashedTo) entity.dimension.spawnItem(new ItemStack("minecraft:lead", 1), entity.location);
          entity.leashedTo = undefined;
        },
      };
    }
    if (id === "minecraft:rideable") return { ...data, getRiders: () => this.riders ?? [] };
    return data;
  }
  getProperty(key) {
    return this.properties.get(key);
  }
  matches({ families = [], type } = {}) {
    if (type && this.typeId !== type) return false;
    const own = this.componentMap().get("minecraft:type_family")?.family ?? [];
    return families.every((family) => own.includes(family));
  }
  setProperty(key, value) {
    this.properties.set(key, value);
  }
  getDynamicProperty(key) {
    return this.dynamic.get(key);
  }
  getDynamicPropertyIds() {
    return [...this.dynamic.keys()];
  }
  setDynamicProperty(key, value) {
    if (value === undefined) this.dynamic.delete(key);
    else this.dynamic.set(key, value);
  }
  getRotation() {
    return { ...this.rotation };
  }
  /** Tests move the entity by the impulse at once (no physics). */
  applyImpulse(vector) {
    this.location = { x: this.location.x + vector.x, y: this.location.y + vector.y, z: this.location.z + vector.z };
  }
  getViewDirection() {
    return this.viewDirection ?? { x: 0, y: 0, z: 1 };
  }
  setRotation(rotation) {
    this.rotation = { ...rotation };
  }
  triggerEvent(name) {
    this.events.push(name);
    const response = this.def?.events?.[name];
    if (!response) throw new Error(`${this.typeId} has no event ${name}`);
    this.applyResponse(response);
  }
  applyResponse(response) {
    if (response.sequence) for (const step of response.sequence) this.applyResponse(step);
    if (response.randomize) {
      const total = response.randomize.reduce((sum, option) => sum + (option.weight ?? 1), 0);
      let roll = world.__random() * total;
      for (const option of response.randomize) {
        roll -= option.weight ?? 1;
        if (roll < 0) {
          this.applyResponse(option);
          break;
        }
      }
    }
    for (const group of response.remove?.component_groups ?? []) this.groups.delete(group);
    for (const group of response.add?.component_groups ?? []) {
      if (!this.def.component_groups[group]) throw new Error(`${this.typeId} has no component group ${group}`);
      this.groups.add(group);
    }
    for (const [key, value] of Object.entries(response.set_property ?? {})) this.properties.set(key, value);
    if (response.trigger) this.triggerEvent(typeof response.trigger === "string" ? response.trigger : response.trigger.event);
  }
  remove() {
    this.isValid = false;
    this.dimension.entities = this.dimension.entities.filter((e) => e !== this);
  }
  kill() {
    this.remove();
    world.afterEvents.entityDie.fire({ deadEntity: this, damageSource: {} });
  }
}

export class Player extends Entity {
  constructor(dimension, location) {
    super(dimension, "minecraft:player", location);
    this.inventory = new Container(36);
    this.selectedSlotIndex = 0;
    this.gameMode = GameMode.Survival;
    this.actionBar = [];
    this.sounds = [];
    this.onScreenDisplay = { setActionBar: (message) => this.actionBar.push(message) };
    this.isSneaking = false;
    this.worn = {};
    this.hunger = 10; // of 20
  }
  // Only the saturation effect is modelled: level n restores n hunger points.
  addEffect(id, _ticks, options = {}) {
    if (id === "saturation") this.hunger = Math.min(20, this.hunger + (options.amplifier ?? 0) + 1);
  }
  getEntitiesFromViewDirection() {
    return [];
  }
  getComponent(id) {
    if (id === "minecraft:inventory") return { container: this.inventory };
    if (id === "minecraft:player.hunger") return { currentValue: this.hunger, effectiveMax: 20 };
    if (id === "minecraft:equippable") {
      return {
        // Armour and the off hand are their own slots; anything else is the selected hotbar slot.
        getEquipment: (slot) => (this.worn[slot] !== undefined || ["Head", "Chest", "Legs", "Feet", "Offhand"].includes(slot) ? this.worn[slot]?.clone() : this.inventory.getItem(this.selectedSlotIndex)),
        setEquipment: (slot, item) => (["Head", "Chest", "Legs", "Feet", "Offhand"].includes(slot) ? (this.worn[slot] = item?.clone()) : this.inventory.setItem(this.selectedSlotIndex, item)),
        getEquipmentSlot: () => ({
          getItem: () => this.inventory.getItem(this.selectedSlotIndex),
          setItem: (item) => this.inventory.setItem(this.selectedSlotIndex, item),
          hasItem: () => Boolean(this.inventory.slots[this.selectedSlotIndex]),
        }),
      };
    }
    return undefined;
  }
  getGameMode() {
    return this.gameMode;
  }
  playSound(id) {
    this.sounds.push(id);
  }
  sendMessage() {}
}

// --- Blocks ---------------------------------------------------------------

export class BlockPermutation {
  constructor(typeId, states = {}) {
    this.type = { id: typeId };
    this.states = { ...states };
  }
  static resolve(typeId, states = {}) {
    return new BlockPermutation(typeId, states);
  }
  getState(name) {
    return this.states[name];
  }
  getAllStates() {
    return { ...this.states };
  }
  withState(name, value) {
    return new BlockPermutation(this.type.id, { ...this.states, [name]: value });
  }
  matches(typeId) {
    return this.type.id === typeId;
  }
}

export class Block {
  constructor(dimension, location) {
    this.dimension = dimension;
    this.location = location;
  }
  get key() {
    const { x, y, z } = this.location;
    return `${x},${y},${z}`;
  }
  get permutation() {
    return this.dimension.blocks.get(this.key) ?? new BlockPermutation("minecraft:air");
  }
  get typeId() {
    return this.permutation.type.id;
  }
  get isAir() {
    return this.typeId === "minecraft:air";
  }
  get isLiquid() {
    return this.typeId === "minecraft:water" || this.typeId === "minecraft:lava";
  }
  get isValid() {
    return true;
  }
  setPermutation(permutation) {
    this.dimension.blocks.set(this.key, permutation);
  }
  setType(typeId) {
    this.dimension.blocks.set(this.key, new BlockPermutation(typeId));
  }
  offset(delta) {
    const { x, y, z } = this.location;
    return this.dimension.getBlock({ x: x + delta.x, y: y + delta.y, z: z + delta.z });
  }
  above(n = 1) {
    return this.offset({ x: 0, y: n, z: 0 });
  }
  below(n = 1) {
    return this.offset({ x: 0, y: -n, z: 0 });
  }
  north(n = 1) {
    return this.offset({ x: 0, y: 0, z: -n });
  }
  south(n = 1) {
    return this.offset({ x: 0, y: 0, z: n });
  }
  east(n = 1) {
    return this.offset({ x: n, y: 0, z: 0 });
  }
  west(n = 1) {
    return this.offset({ x: -n, y: 0, z: 0 });
  }
  center() {
    const { x, y, z } = this.location;
    return { x: x + 0.5, y: y + 0.5, z: z + 0.5 };
  }
  bottomCenter() {
    const { x, y, z } = this.location;
    return { x: x + 0.5, y, z: z + 0.5 };
  }
  getComponent(id) {
    if (id === "minecraft:inventory" && this.typeId === "minecraft:hopper") {
      if (!this.dimension.containers.has(this.key)) this.dimension.containers.set(this.key, new Container(5));
      return { container: this.dimension.containers.get(this.key) };
    }
    return undefined;
  }
}

// --- Dimension and world --------------------------------------------------

class Dimension {
  constructor(id) {
    this.id = id;
    this.entities = [];
    this.items = [];
    this.particles = [];
    this.sounds = [];
    this.blocks = new Map();
    this.containers = new Map();
  }
  spawnEntity(typeId, location) {
    const entity = new Entity(this, typeId.includes(":") ? typeId : `minecraft:${typeId}`, location);
    this.entities.push(entity);
    if (entity.def?.events?.["minecraft:entity_spawned"]) entity.applyResponse(entity.def.events["minecraft:entity_spawned"]);
    world.afterEvents.entitySpawn.fire({ entity, cause: "Spawned" });
    return entity;
  }
  /** Test helper: a vanilla animal with the given vanilla components. */
  __spawnVanilla(typeId, location, components = {}, cause = "Spawned") {
    const entity = new Entity(this, typeId, location);
    for (const [key, value] of Object.entries(components)) entity.extraComponents.set(key, value);
    this.entities.push(entity);
    world.afterEvents.entitySpawn.fire({ entity, cause });
    return entity;
  }
  getEntities({ type, location, maxDistance, families } = {}) {
    return this.entities.filter((entity) => {
      if (type && entity.typeId !== type) return false;
      if (families && !entity.matches({ families })) return false;
      if (location && maxDistance !== undefined) {
        const d = (entity.location.x - location.x) ** 2 + (entity.location.y - location.y) ** 2 + (entity.location.z - location.z) ** 2;
        if (d > maxDistance * maxDistance) return false;
      }
      return true;
    });
  }
  spawnItem(item, location) {
    this.items.push({ item: item.clone(), location });
    return { item };
  }
  spawnParticle(id, location) {
    this.particles.push({ id, location });
  }
  playSound(id, location) {
    this.sounds.push({ id, location });
  }
  getBlock(location) {
    return new Block(this, { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) });
  }
  setBlockType(location, typeId) {
    this.getBlock(location).setType(typeId);
  }
  setBlockPermutation(location, permutation) {
    this.getBlock(location).setPermutation(permutation);
  }
  /** Only `includeTypes` filters are supported. */
  getBlocks(volume, filter = {}) {
    const { from, to } = volume;
    const hits = [];
    for (const [key, permutation] of this.blocks) {
      const [x, y, z] = key.split(",").map(Number);
      if (x < Math.min(from.x, to.x) || x > Math.max(from.x, to.x)) continue;
      if (y < Math.min(from.y, to.y) || y > Math.max(from.y, to.y)) continue;
      if (z < Math.min(from.z, to.z) || z > Math.max(from.z, to.z)) continue;
      if (filter.includeTypes && !filter.includeTypes.includes(permutation.type.id)) continue;
      hits.push({ x, y, z });
    }
    return { getBlockLocationIterator: () => hits[Symbol.iterator]() };
  }
}

const dimensions = new Map(["minecraft:overworld", "minecraft:nether", "minecraft:the_end"].map((id) => [id, new Dimension(id)]));

const worldDynamic = new Map();
let absoluteTime = 0;
let seed = 12345;

export const world = {
  beforeEvents: {
    playerInteractWithEntity: new Signal(),
    playerBreakBlock: new Signal(),
  },
  afterEvents: {
    entitySpawn: new Signal(),
    entityLoad: new Signal(),
    entityDie: new Signal(),
    entityRemove: new Signal(),
    projectileHitBlock: new Signal(),
    projectileHitEntity: new Signal(),
    worldLoad: new Signal(),
    itemCompleteUse: new Signal(),
    itemUse: new Signal(),
    entityHurt: new Signal(),
    playerBreakBlock: new Signal(),
  },
  getDimension: (id) => dimensions.get(id.includes(":") ? id : `minecraft:${id}`),
  getAbsoluteTime: () => absoluteTime,
  getTimeOfDay: () => absoluteTime % 24000,
  getAllPlayers: () => [...dimensions.values()].flatMap((dimension) => dimension.entities.filter((entity) => entity instanceof Player && entity.isValid !== false)),
  getDay: () => Math.floor(absoluteTime / 24000),
  getDynamicProperty: (key) => worldDynamic.get(key),
  setDynamicProperty: (key, value) => (value === undefined ? worldDynamic.delete(key) : worldDynamic.set(key, value)),
  getDynamicPropertyIds: () => [...worldDynamic.keys()],
  getEntity: (id) => {
    for (const dimension of dimensions.values()) {
      const found = dimension.entities.find((entity) => entity.id === id);
      if (found) return found;
    }
    return undefined;
  },
  sendMessage: (message) => world.__messages.push(message),
  __messages: [],
  __random() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  },
};

// --- System ---------------------------------------------------------------

const queue = [];
const intervals = [];
let tick = 0;

export const system = {
  get currentTick() {
    return tick;
  },
  run(callback) {
    queue.push({ at: tick + 1, callback });
    return queue.length;
  },
  runTimeout(callback, delay = 1) {
    queue.push({ at: tick + delay, callback });
    return queue.length;
  },
  runInterval(callback, every = 1) {
    intervals.push({ callback, every, next: tick + every });
    return intervals.length;
  },
  clearRun() {},
  sendScriptEvent(id, message) {
    system.__scriptEvents.push({ id, message });
    system.afterEvents.scriptEventReceive.fire({ id, message });
  },
  __scriptEvents: [],
  afterEvents: { scriptEventReceive: new Signal() },
  beforeEvents: { startup: new Signal() },
};

/** Test helper: places a block with the given states. */
export function __place(dimension, location, typeId, states = {}) {
  dimension.blocks.set(`${location.x},${location.y},${location.z}`, new BlockPermutation(typeId, states));
  return dimension.getBlock(location);
}

/** Advances game time, running queued callbacks and intervals. */
export function __advance(ticks) {
  for (let i = 0; i < ticks; i++) {
    tick++;
    absoluteTime++;
    for (const job of queue.filter((job) => job.at <= tick)) {
      queue.splice(queue.indexOf(job), 1);
      job.callback();
    }
    for (const interval of intervals) {
      if (interval.next <= tick) {
        interval.next = tick + interval.every;
        interval.callback();
      }
    }
  }
}

/** Jumps absolute time without running per-tick work (e.g. sleeping, being away). */
export function __skipTime(ticks) {
  absoluteTime += ticks;
}

/** Simulates a player using their held item on an entity. Returns true if cancelled. */
export function __interact(player, entity) {
  const event = { player, target: entity, itemStack: player.getComponent("minecraft:equippable").getEquipmentSlot().getItem(), cancel: false };
  world.beforeEvents.playerInteractWithEntity.fire(event);
  __advance(1);
  return event.cancel;
}

export function __newPlayer(location = { x: 0, y: 64, z: 0 }) {
  const player = new Player(world.getDimension("overworld"), location);
  world.getDimension("overworld").entities.push(player);
  return player;
}
