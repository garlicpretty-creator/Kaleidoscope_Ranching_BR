// Minimal in-memory mock of @minecraft/server for logic tests.
const subs = (name) => ({ list: [], subscribe(cb){ this.list.push(cb); return cb; } });
const S = globalThis.__mc = { time: 0, dp: new Map(), queue: [], tick: 0, blocks: new Map(), entities: [], sounds: 0, drops: [] };
export const GameMode = { Creative: "creative", Survival: "survival" };
export const EquipmentSlot = { Mainhand: "Mainhand" };
export const PlayerPermissionLevel = { Operator: 2 };
export class ItemStack {
  constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.dp = new Map(); this.lore = []; }
  getDynamicProperty(k){ return this.dp.get(k); } setDynamicProperty(k,v){ v===undefined?this.dp.delete(k):this.dp.set(k,v); }
  setLore(l){ this.lore=l; } getComponent(n){ return n==="minecraft:durability" ? this.durability : undefined; }
}
export class BlockVolume { constructor(from,to){ this.from=from; this.to=to; } }
const STATE_RANGES = {};
export const BlockStates = { get(n){ return STATE_RANGES[n] ? { validValues: STATE_RANGES[n] } : undefined; } };
export function __defineState(n, values){ STATE_RANGES[n]=values; }
class Permutation {
  constructor(type, states){ this.type={id:type}; this.states={...states}; }
  getState(n){ return this.states[n]; } getAllStates(){ return {...this.states}; }
  withState(n,v){ return new Permutation(this.type.id, {...this.states, [n]: v}); }
}
const key = (l) => `${Math.floor(l.x)},${Math.floor(l.y)},${Math.floor(l.z)}`;
export class Block {
  constructor(dim, loc, typeId, states = {}, container) { this.dimension=dim; this.location={x:Math.floor(loc.x),y:Math.floor(loc.y),z:Math.floor(loc.z)}; this.typeId=typeId; this.permutation=new Permutation(typeId, states); this.container=container; }
  get isAir(){ return this.typeId==="minecraft:air"; } get isLiquid(){ return this.typeId==="minecraft:water"; } get isWaterlogged(){ return false; }
  setPermutation(p){ this.permutation=p; } setType(t){ this.dimension.setBlockType(this.location, t); }
  below(){ return this.dimension.getBlock({...this.location, y:this.location.y-1}); }
  above(){ return this.dimension.getBlock({...this.location, y:this.location.y+1}); }
  getComponent(n){ return n==="minecraft:inventory" && this.container ? { container: this.container } : undefined; }
}
export class Container {
  constructor(size){ this.size=size; this.items=new Array(size).fill(undefined); }
  getItem(i){ return this.items[i]; } setItem(i,s){ this.items[i]=s; }
  addItem(s){ const i=this.items.findIndex(x=>!x); if(i<0) return s; this.items[i]=s; }
}
export class Dimension {
  constructor(id){ this.id=id; }
  getBlock(l){ const k=key(l); if(!S.blocks.has(k)){ S.blocks.set(k, new Block(this, l, l.y<64?"minecraft:dirt":"minecraft:air")); } return S.blocks.get(k); }
  setBlockType(l,t){ S.blocks.set(key(l), new Block(this, l, t)); }
  setBlock(b){ S.blocks.set(key(b.location), b); b.dimension=this; return b; }
  getEntities(q){ return S.entities.filter(e=>e.isValid && Math.hypot(e.location.x-q.location.x, e.location.y-q.location.y, e.location.z-q.location.z) <= q.maxDistance && (!q.families || q.families.every(f=>e.families.includes(f)))); }
  getBlocks(vol, filter){ const out=[]; for(const b of S.blocks.values()){ const l=b.location; if(l.x>=vol.from.x&&l.x<=vol.to.x&&l.y>=vol.from.y&&l.y<=vol.to.y&&l.z>=vol.from.z&&l.z<=vol.to.z && filter.includeTypes.includes(b.typeId)) out.push(l);} return { getBlockLocationIterator(){ return out[Symbol.iterator](); } }; }
  spawnParticle(){} playSound(){ S.sounds++; } spawnItem(s,l){ S.drops.push(s); }
}
export class Entity {
  constructor(dim, typeId, loc, families){ this.dimension=dim; this.typeId=typeId; this.location=loc; this.families=families; this.dp=new Map(); this.isValid=true; this.nameTag=""; this.id=String(Math.random()); }
  getDynamicProperty(k){ return this.dp.get(k); } setDynamicProperty(k,v){ v===undefined?this.dp.delete(k):this.dp.set(k,v); }
  matches(o){ return (o.families||[]).every(f=>this.families.includes(f)); }
  triggerEvent(){ throw new Error("no event"); }
}
export const world = {
  getDay(){ return Math.floor(S.time/24000); }, getAbsoluteTime(){ return S.time; },
  getDynamicProperty(k){ return S.dp.get(k); }, setDynamicProperty(k,v){ v===undefined?S.dp.delete(k):S.dp.set(k,v); },
  getDynamicPropertyIds(){ return [...S.dp.keys()]; },
  beforeEvents: { playerInteractWithEntity: subs() },
  afterEvents: { itemUse: subs(), entityHurt: subs(), entityDie: subs(), playerBreakBlock: subs() },
};
export const system = {
  run(fn){ S.queue.push(fn); }, get currentTick(){ return S.tick; },
  beforeEvents: { startup: subs() }, afterEvents: { scriptEventReceive: subs() },
};
