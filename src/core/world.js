// The simulation. No DOM access — the browser game and tools/sim.mjs both drive this.
import { makeRng } from './rng.js';
import { SpatialHash } from './spatial.js';
import { buildMap, TILE, COLS, ROWS, W, H } from './map.js';
import { TOWERS, TOWER_ORDER, towerStats, canCrosspath, SELL_REFUND } from '../data/towers.js';
import { ENEMIES, MODIFIERS, hpMult } from '../data/enemies.js';
import { CAMPAIGN_WAVES, BOSS_TYPES } from '../data/waves.js';
import { DOCTRINES } from '../data/doctrines.js';
import { HEROES, HERO_COST, HERO_XP, heroScale } from '../data/heroes.js';
import { ITEMS, ITEMS_PER_WAVE } from '../data/items.js';
import { updateTower, computeEffective, canSee } from './towers.js';
import { buildQueue } from './waves.js';

export const START_GOLD = 350;
export const START_ALE = 20;
export const START_RESOLVE = 20;
export const START_MORALE = 75;
const AURA_TICK = 0.25;
const MAX_EFFECTS = 400;
const MAX_PROJECTILES = 1500;

export class World {
  constructor(opts = {}) {
    this.seed = opts.seed ?? (Date.now() & 0x7fffffff);
    this.rng = makeRng(this.seed);
    this.headless = !!opts.headless;
    this.mandates = opts.mandates || [];
    this.heroId = opts.hero || null;
    this.unlocks = opts.unlocks || { towers: ['pike', 'keg', 'bow', 'tap'], tiers: {}, heroes: ['seamus', 'buke'] };
    this.waveOverride = opts.waves || null; // tutorial
    this.campaignWaves = opts.waves ? opts.waves.length : CAMPAIGN_WAVES;
    this.map = buildMap(opts.map || 'aleforge');
    this.mapId = this.map.id;
    this.activePaths = [...this.map.baseLanes];

    this.time = 0;
    this.wave = 0;
    this.gold = opts.gold ?? START_GOLD - (this.has('rumpsLedger') ? 90 : 0);
    this.ale = START_ALE;
    this.resolve = START_RESOLVE;
    this.morale = this.map.districts.map(() => START_MORALE);
    this.insurgentFlag = this.map.districts.map(() => false);
    this.bonds = [];
    this.bondsIssued = 0;
    this.noInterestUntil = 0;

    this.enemies = [];
    this.towers = [];
    this.towerGrid = new Map();
    this.projectiles = [];
    this.effects = [];
    this.items = [];
    this.itemsThisWave = 0;
    this.enemyPool = [];
    this.projPool = [];
    this.spawnBuffer = [];
    this.spatial = new SpatialHash(W, H, 80);
    this.activeWaves = [];
    this.barricades = [];
    this.turnedTowers = [];
    this.auraT = 0;
    this.uid = 1;
    this.hero = null;
    this.timers = { chug: 0, hangover: 0, muster: 0, longarm: 0, kegparty: 0, drown: 0, sabotage: 0, faces: 0, flood: 0, zero: 0, hallowed: 0 };
    this.revealAll = 0;
    this.hallowed = null;

    this.events = [];
    this.doctrines = [];
    this.pendingDoctrine = null;
    this.seenTypes = new Set();
    this.runUnlocked = new Set(this.unlocks.towers.filter((t) => TOWERS[t] && !TOWERS[t].unlock.wave));
    this.leakCount = 0;
    this.leakLog = [];
    this.stats = { kills: 0, leaks: 0, goldEarned: 0, dmgByType: {}, bondsIssued: 0, defaults: 0, insurgencies: 0, plinket: false, itemsUsed: 0 };
    this.over = false;
    this.won = false;
    this.freeplay = false;
    this.boss = null;
    this.invincible = false; // debug
    this.recomputeMods();
    this.checkRunUnlocks();
  }

  has(mandate) { return this.mandates.includes(mandate); }
  emit(type, text, extra) { this.events.push({ type, text, ...extra }); }
  fx(e) {
    if (this.headless || this.effects.length >= MAX_EFFECTS) return;
    e.t = 0;
    this.effects.push(e);
  }

  // ---------------------------------------------------------------- modifiers
  recomputeMods() {
    const m = {
      incomeMult: 0, enemySpeed: 0, revealAll: false, interestCapMult: 0, aleIncome: 0, moraleRegenMult: 0,
      costMult: 0, sellRefund: SELL_REFUND, typeDmg: {}, dtypeDmg: {}, bondRate: 0, enemyHp: 0,
      rangeMult: 0, noSell: false, bountyMult: 0, leakTax: false, incomeTypes: 0,
    };
    for (const id of this.doctrines) {
      const d = DOCTRINES[id].mods;
      for (const k in d) {
        if (typeof d[k] === 'boolean') m[k] = m[k] || d[k];
        else if (k === 'sellRefund') m.sellRefund = Math.min(m.sellRefund, d[k]);
        else if (typeof d[k] === 'object') for (const kk in d[k]) m[k][kk] = (m[k][kk] || 0) + d[k][kk];
        else m[k] += d[k];
      }
    }
    if (this.has('blight')) m.incomeMult -= 0.25;
    if (this.has('rotoTightens')) m.bondRate += 0.15;
    if (this.has('zeal')) m.enemyHp += 0.15;
    if (this.has('zealotry')) m.enemySpeed += 0.12;
    m.detectMult = this.has('holiday') ? 0.5 : 1;
    m.regen = this.has('amnesty') ? 0.01 : 0;
    m.moraleThreshold = this.has('presses') ? 40 : 30;
    m.pamphletMult = this.has('presses') ? 2 : 1;
    m.abilityCd = this.has('hungover') ? 1.5 : 1;
    this.mods = m;
    for (const t of this.towers) this.refreshStats(t);
  }

  // discount from Garrison quartermasters covering tile (tx, ty)
  discountAt(x, y) {
    let d = 0;
    for (const t of this.towers) {
      const disc = t.s.aura?.discount;
      if (disc && (t.x - x) ** 2 + (t.y - y) ** 2 <= t.s.range * t.s.range) d = Math.max(d, disc);
    }
    return d;
  }
  cost(base, x, y) {
    const disc = x != null ? this.discountAt(x, y) : 0;
    return Math.round(base * (1 + this.mods.costMult) * (1 - disc));
  }

  // ---------------------------------------------------------------- towers
  towerAvailable(type) { return this.runUnlocked.has(type); }

  checkRunUnlocks() {
    for (const type of TOWER_ORDER) {
      const u = TOWERS[type].unlock;
      if (u.wave && this.wave >= u.wave && !this.runUnlocked.has(type)) {
        this.runUnlocked.add(type);
        this.emit('unlock', `${TOWERS[type].name} is now available.`, { tower: type });
      }
    }
  }

  canPlace(type, tx, ty) {
    const def = TOWERS[type];
    if (!def || !this.towerAvailable(type)) return 'locked';
    if (!this.map.buildable(tx, ty, def.water ? 'water' : 'land')) return def.water ? 'water' : 'blocked';
    if (this.towerGrid.has(ty * COLS + tx)) return 'occupied';
    const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
    if (this.gold < this.cost(def.cost, x, y)) return 'gold';
    if ((def.aleCost || 0) > this.ale) return 'ale';
    return null;
  }

  newTower(type, def, tx, ty, extra) {
    const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
    const t = {
      id: this.uid++, type, def, tx, ty, x, y, tiers: [0, 0], s: null, eff: null, auras: [],
      cd: 0, mode: 'first', invested: 0, disabledT: 0, soberT: 0, turnedT: 0, plinketMarked: false, plinketBuffT: 0,
      tonic: null, tonicT: 0, abilityT: {}, dmg: 0, kills: 0, district: this.map.districtAt(x, y), aim: null, ...extra,
    };
    this.towers.push(t);
    this.towerGrid.set(ty * COLS + tx, t);
    return t;
  }

  placeTower(type, tx, ty) {
    if (this.over || this.canPlace(type, tx, ty)) return null;
    const def = TOWERS[type];
    const c = this.cost(def.cost, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
    this.gold -= c;
    this.ale -= def.aleCost || 0;
    const t = this.newTower(type, def, tx, ty, { invested: c, mode: def.base.proj === 'shell' ? 'strong' : 'first' });
    this.refreshStats(t);
    computeEffective(this, t);
    this.fx({ kind: 'ring', x: t.x, y: t.y, r: 20, max: 0.4, color: def.color });
    return t;
  }

  refreshStats(t) {
    if (t.hero) {
      const h = HEROES[t.heroId];
      const sc = heroScale(t.level);
      const s = structuredClone(h.base);
      s.dmg = (s.dmg || 0) * sc.dmg;
      s.rate = (s.rate || 0) * sc.rate;
      s.range = (s.range || 0) + sc.range;
      s.abilities = h.abilities.filter((a) => t.level >= a.level);
      t.s = s;
      return;
    }
    t.s = towerStats(t.type, t.tiers);
  }

  tierCap(type) { return this.unlocks.tiers?.[type] ?? 2; }

  // why an upgrade is unavailable, or null if it can be bought
  upgradeBlock(t, path) {
    if (t.hero) return 'hero';
    if (t.tiers[path] >= 4) return 'max';
    if (!canCrosspath(t.tiers, path)) return 'crosspath';
    if (t.tiers[path] + 1 > this.tierCap(t.type)) return 'xp';
    return null;
  }

  upgradeCost(t, path) {
    if (t.hero || t.tiers[path] >= 4) return null;
    return this.cost(t.def.paths[path].tiers[t.tiers[path]].cost, t.x, t.y);
  }

  upgrade(t, path) {
    if (this.over || this.upgradeBlock(t, path)) return false;
    const c = this.upgradeCost(t, path);
    if (this.gold < c) return false;
    this.gold -= c;
    t.invested += c;
    t.tiers[path]++;
    this.refreshStats(t);
    computeEffective(this, t);
    this.fx({ kind: 'ring', x: t.x, y: t.y, r: 26, max: 0.5, color: '#ffe08a' });
    return true;
  }

  sellValue(t) { return t.hero ? 0 : Math.floor(t.invested * this.mods.sellRefund); }

  sell(t) {
    if (this.mods.noSell || this.over || t.hero) return false;
    this.gold += this.sellValue(t);
    this.towers.splice(this.towers.indexOf(t), 1);
    this.towerGrid.delete(t.ty * COLS + t.tx);
    return true;
  }

  towerAt(tx, ty) { return this.towerGrid.get(ty * COLS + tx) || null; }

  // drawn normally (Hidden enemies are ghostly until revealed)
  visible(e) { return !e.hidden || e.revealedT > 0 || this.revealAll > 0; }

  // ---------------------------------------------------------------- hero
  canPlaceHero(tx, ty) {
    if (!this.heroId) return 'none';
    if (this.hero) return 'placed';
    if (!this.map.buildable(tx, ty, 'land')) return 'blocked';
    if (this.towerGrid.has(ty * COLS + tx)) return 'occupied';
    if (this.gold < HERO_COST) return 'gold';
    return null;
  }

  placeHero(tx, ty) {
    if (this.over || this.canPlaceHero(tx, ty)) return null;
    this.gold -= HERO_COST;
    const h = HEROES[this.heroId];
    const t = this.newTower('hero', h, tx, ty, { hero: true, heroId: this.heroId, level: 1, xp: 0, invested: HERO_COST });
    this.refreshStats(t);
    computeEffective(this, t);
    this.hero = t;
    this.fx({ kind: 'ring', x: t.x, y: t.y, r: 30, max: 0.6, color: '#ffd35a' });
    return t;
  }

  heroXp(amount) {
    const t = this.hero;
    if (!t || t.level >= 10) return;
    t.xp += amount;
    while (t.level < 10 && t.xp >= HERO_XP[t.level]) {
      t.level++;
      this.refreshStats(t);
      this.fx({ kind: 'ring', x: t.x, y: t.y, r: 34, max: 0.8, color: '#ffd35a' });
      const unlocked = HEROES[t.heroId].abilities.find((a) => a.level === t.level);
      this.emit('heroLevel', `${HEROES[t.heroId].name} reached level ${t.level}${unlocked ? ` — ${unlocked.name} unlocked` : ''}.`, { level: t.level });
    }
  }

  // ---------------------------------------------------------------- abilities
  // every activatable ability: tier-4 tower upgrades and the hero's
  abilityList() {
    const list = [];
    for (const t of this.towers) for (const a of t.s.abilities || []) list.push({ t, a, cd: t.abilityT['cd_' + a.id] || 0 });
    return list;
  }

  abilityReady(t, id) {
    const a = (t.s.abilities || []).find((x) => x.id === id);
    return !!a && !this.over && !((t.abilityT['cd_' + id] || 0) > 0);
  }

  useAbility(t, id, target) {
    if (!this.abilityReady(t, id)) return false;
    const a = t.s.abilities.find((x) => x.id === id);
    const all = () => this.enemies.filter((e) => e.alive && !e.untargetable);
    switch (id) {
      // towers
      case 'longarm': this.timers.longarm = 10; break;
      case 'kegstorm': for (let i = 0; i < 24; i++) { const e = this.rng.pick(all()); if (!e) break; this.spawnProjectile({ kind: 'shell', x: e.x, y: -20, tx: e.x, ty: e.y, dmg: 300, splash: 50, dtype: 'explosive', src: t, speed: 700, color: '#b0643a' }); } break;
      case 'supply': { const g = 400 + Math.floor(this.rng.next() * 300); this.gold += g; this.emit('toast', `Supply Drop: +${g} gold.`); break; }
      case 'drown': for (const e of all()) this.applySlow(e, 0.75, 6); this.timers.drown = 6; break;
      case 'whirl': t.abilityT.whirl = 5; break;
      case 'zero': for (const e of all()) this.freeze(e, 4, 0); break;
      case 'blind': for (const e of all()) if (!e.boss) this.stun(e, 2.5); this.fx({ kind: 'flash', x: 0, y: 0, r: 0, max: 0.5, color: '#fffbe0' }); break;
      case 'mutiny': t.abilityT.mutiny = 0.2; t.cd = 0; break;
      case 'sabotage': this.timers.sabotage = 12; break;
      case 'board': { let b = null; for (const e of all()) if (e.boss && (!b || e.hp > b.hp)) b = e; if (!b) return false; this.damage(b, b.hp * 0.4, t, { raw: true }); break; }
      case 'storm': for (const id2 of this.activePaths) { const p = this.map.paths[id2]; for (let d = 40; d < p.total - 40; d += 70) { const o = { x: 0, y: 0 }; p.posAt(d, o); this.placePile(t, o.x, o.y); } } break;
      case 'muster': this.timers.muster = 10; break;
      case 'awe': for (const e of all()) { this.stun(e, 3); this.damage(e, 150, t, { dtype: 'explosive' }); } this.fx({ kind: 'flash', x: 0, y: 0, r: 0, max: 0.5, color: '#ff9b3d' }); break;
      case 'rockets': t.abilityT.rockets = 10; break;
      case 'groundzero': for (const e of all()) this.damage(e, 800, t, { dtype: 'explosive' }); this.fx({ kind: 'flash', x: 0, y: 0, r: 0, max: 0.8, color: '#ffffff' }); break;
      case 'timestop': for (const e of all()) { if (e.boss) this.applySlow(e, 0.5, 5); else this.freeze(e, 5, 0, true); } break;
      case 'price': for (const e of all()) if (!e.boss) this.damage(e, e.hp * 0.8, t, { raw: true }); break;
      // heroes
      case 'avalanche': for (const e of all()) { this.damage(e, 220, t, { dtype: 'explosive' }); if (e.alive) this.knockback(e, 60); } this.fx({ kind: 'flash', x: 0, y: 0, r: 0, max: 0.6, color: '#b0643a' }); break;
      case 'kegparty': this.timers.kegparty = 10; break;
      case 'chug': this.timers.chug = 8; this.timers.hangover = 0; break;
      case 'dive': this.spatial.query(t.x, t.y, 150, (e) => { if (e.alive) { this.stun(e, 3); this.damage(e, 400, t, { dtype: 'explosive' }); } }); this.fx({ kind: 'ring', x: t.x, y: t.y, r: 150, max: 0.6, color: '#e0b93c' }); break;
      case 'barricade': {
        if (!target) return false;
        const p = this.nearestPathPoint(target.x, target.y);
        if (!p || p.dist > 40) return false;
        this.barricades.push({ x: p.x, y: p.y, t: 5 });
        break;
      }
      case 'hallowed': this.hallowed = { x: t.x, y: t.y, r: 160 }; this.timers.hallowed = 8; break;
      case 'grudge': {
        const boss = all().find((e) => e.boss);
        if (boss) { this.damage(boss, boss.maxHp * 0.06, t, { raw: true }); break; }
        let best = null;
        for (const e of all()) if (!best || e.hp > best.hp) best = e;
        if (!best) return false;
        this.kill(best, t);
        break;
      }
      case 'faces': this.timers.faces = 10; this.revealAll = 10; for (const e of all()) this.applyMark(e, 0.3, 10, 0); break;
      case 'ledger': this.gold += 150; for (const e of all()) this.applyMark(e, 0.25, 6, 0); break;
      case 'mercantile': this.gold += 500; break;
      case 'spill': this.resolve += 2; break;
      case 'flood': this.timers.flood = 8; break;
      default: return false;
    }
    t.abilityT['cd_' + id] = a.cd * this.mods.abilityCd;
    this.emit('ability', `${a.name}!`, { id });
    return true;
  }

  nearestPathPoint(x, y) {
    let best = null;
    const out = { x: 0, y: 0 };
    for (const id of this.activePaths) {
      const path = this.map.paths[id];
      const d = path.distOf(x, y);
      path.posAt(d, out);
      const dist = Math.hypot(out.x - x, out.y - y);
      if (!best || dist < best.dist) best = { x: out.x, y: out.y, dist, path, d };
    }
    return best;
  }

  // default mortar aim: halfway along the first lane
  defaultAim() {
    const p = this.map.paths[this.activePaths[0]];
    const o = { x: 0, y: 0 };
    return p.posAt(p.total * 0.6, o);
  }

  // a point on the road within range of tower t (smart: the one furthest along)
  roadPointNear(t, range, smart) {
    const pts = [];
    const o = { x: 0, y: 0 };
    for (const id of this.activePaths) {
      const p = this.map.paths[id];
      for (let d = 0; d < p.total; d += 20) {
        p.posAt(d, o);
        if ((o.x - t.x) ** 2 + (o.y - t.y) ** 2 <= range * range) pts.push({ x: o.x, y: o.y, k: d / p.total });
      }
    }
    if (!pts.length) return null;
    if (smart) return pts.reduce((a, b) => (b.k > a.k ? b : a));
    return this.rng.pick(pts);
  }

  // ---------------------------------------------------------------- road items & piles
  canPlaceItem(type, x, y) {
    const it = ITEMS[type];
    if (!it || this.over) return 'none';
    if (this.itemsThisWave >= ITEMS_PER_WAVE) return 'limit';
    if (this.ale < it.ale) return 'ale';
    const p = this.nearestPathPoint(x, y);
    if (!p || p.dist > 26) return 'road';
    return null;
  }

  placeItem(type, x, y) {
    if (this.canPlaceItem(type, x, y)) return false;
    const it = ITEMS[type];
    const p = this.nearestPathPoint(x, y);
    this.ale -= it.ale;
    this.itemsThisWave++;
    this.stats.itemsUsed++;
    this.items.push({ type, x: p.x, y: p.y, hits: it.hits || 0, life: it.life, hitIds: [], src: null, dmg: it.dmg || 0, dtype: it.dtype, radius: it.radius });
    return true;
  }

  placePile(t, x, y) {
    const s = t.s;
    this.items.push({
      type: 'pile', x: x + (this.rng.next() - 0.5) * 10, y: y + (this.rng.next() - 0.5) * 10, hits: s.pile.hits, life: s.pile.life, hitIds: [],
      src: t, dmg: s.dmg * t.eff.dmgMul + t.eff.dmgAdd, dtype: s.dtype, shred: t.eff.shred, explode: s.pile.explode || 0, radius: 14,
    });
  }

  updateItems(dt) {
    let j = 0;
    for (const it of this.items) {
      it.life -= dt;
      let keep = it.life > 0;
      if (keep && it.type === 'stickyale') {
        this.spatial.query(it.x, it.y, it.radius, (e) => { if (e.alive) this.applySlow(e, ITEMS.stickyale.slow, 0.3); });
      } else if (keep && it.type === 'powderkeg') {
        let boom = false;
        this.spatial.query(it.x, it.y, it.radius, (e) => { if (e.alive && !e.untargetable) boom = true; return boom; });
        if (boom) {
          this.spatial.query(it.x, it.y, ITEMS.powderkeg.blast, (e) => { if (e.alive) this.damage(e, it.dmg, null, { dtype: 'explosive' }); });
          this.fx({ kind: 'ring', x: it.x, y: it.y, r: ITEMS.powderkeg.blast, max: 0.5, color: '#ff9b3d' });
          keep = false;
        }
      } else if (keep) { // caltrops & smithy piles
        this.spatial.query(it.x, it.y, it.radius, (e) => {
          if (!e.alive || e.untargetable || it.hits <= 0 || it.hitIds.includes(e.uid)) return;
          it.hitIds.push(e.uid);
          it.hits--;
          this.damage(e, it.dmg, it.src, { dtype: it.dtype, shred: it.shred });
        });
        if (it.hits <= 0) {
          if (it.explode) {
            this.spatial.query(it.x, it.y, 50, (e) => { if (e.alive) this.damage(e, it.explode, it.src, { dtype: 'explosive' }); });
            this.fx({ kind: 'ring', x: it.x, y: it.y, r: 50, max: 0.4, color: '#ff9b3d' });
          }
          keep = false;
        }
        if (it.hitIds.length > 60) it.hitIds.splice(0, 30);
      }
      if (keep) this.items[j++] = it;
    }
    this.items.length = j;
  }

  // ---------------------------------------------------------------- economy
  bondQuote() {
    let disc = 0;
    for (const t of this.towers) disc = Math.max(disc, t.s.bondDiscount || 0);
    const principal = 150;
    const rate = Math.max(0.05, 0.2 + 0.15 * this.bondsIssued + this.mods.bondRate - disc);
    return { principal, rate, due: Math.round(principal * (1 + rate)), dueWave: Math.max(this.wave, 1) + 5 };
  }

  canIssueBond() { return !this.over && (this.freeplay || this.wave <= this.campaignWaves - 6); }

  issueBond() {
    if (!this.canIssueBond()) return false;
    const q = this.bondQuote();
    this.gold += q.principal;
    this.bonds.push({ due: q.due, dueWave: q.dueWave, rate: q.rate });
    this.bondsIssued++;
    this.stats.bondsIssued++;
    return true;
  }

  avgMorale() { return this.morale.reduce((a, b) => a + b, 0) / (this.morale.length || 1); }
  addMoraleAll(n) { for (let i = 0; i < this.morale.length; i++) this.addMorale(i, n); }
  addMorale(i, n) { if (i >= 0 && i < this.morale.length) this.morale[i] = Math.max(0, Math.min(100, this.morale[i] + n)); }

  incomePreview(n = this.wave) {
    const base = 60 + 7 * Math.min(n, 40);
    const moraleF = Math.max(0.3, Math.min(1, this.avgMorale() / 100));
    const income = Math.round(base * moraleF * (1 + this.mods.incomeMult));
    let capBonus = 0, towerGold = 0, towerAle = 0;
    for (const t of this.towers) {
      capBonus = Math.max(capBonus, t.s.interestCap || 0);
      if (t.s.income) towerGold += t.s.income * ((t.type === 'farm' || t.type === 'ship') ? 1 + this.mods.incomeTypes : 1);
      towerAle += t.s.aleIncome || 0;
    }
    const cap = Math.round(25 * (1 + this.mods.interestCapMult)) + capBonus;
    const interest = n > this.noInterestUntil ? Math.min(Math.floor(Math.max(0, this.gold) * 0.05), cap) : 0;
    const ale = Math.max(0, 15 + this.mods.aleIncome + towerAle);
    return { income, interest, towerGold: Math.round(towerGold), ale, cap };
  }

  endOfWave(n) {
    const p = this.incomePreview(n);
    const gold = p.income + p.interest + p.towerGold;
    this.gold += gold;
    this.stats.goldEarned += gold;
    this.ale += p.ale;
    this.addMoraleAll(8 * (1 + this.mods.moraleRegenMult));
    this.heroXp(40 + 12 * n);

    let paid = 0;
    for (const b of this.bonds.filter((b) => b.dueWave === n)) {
      if (this.gold >= b.due) { this.gold -= b.due; paid += b.due; }
      else {
        this.gold = 0;
        this.addMoraleAll(-40);
        this.stats.defaults++;
        this.emit('toast', 'Bond default! Every district loses 40 morale.', { warn: true });
      }
    }
    if (paid) this.emit('toast', `Bond repaid: −${paid} gold.`);
    this.bonds = this.bonds.filter((b) => b.dueWave !== n);
    this.emit('waveEnd', `Wave ${n} held: +${gold} gold, +${p.ale} ale.`, { wave: n, gold });

    if (n === this.campaignWaves && !this.freeplay) {
      this.won = true;
      this.over = true;
      this.emit('victory', 'Aleforge stands.');
      return;
    }
    if (n % 5 === 0 && n < this.campaignWaves && !this.waveOverride) this.offerDoctrines();
  }

  // After beating the campaign, keep going with endlessly scaling waves.
  continueFreeplay() {
    if (!this.won || this.freeplay) return false;
    this.freeplay = true;
    this.over = false;
    this.emit('toast', 'Freeplay: the waves get harder forever. How far can Aleforge hold?');
    return true;
  }

  // ---------------------------------------------------------------- doctrines
  doctrineAvailable(id) { return !this.doctrines.includes(id); }

  offerDoctrines() {
    const pool = Object.keys(DOCTRINES).filter((id) => this.doctrineAvailable(id));
    this.pendingDoctrine = this.rng.shuffle(pool).slice(0, 3);
    this.emit('doctrine', 'Choose a doctrine.');
  }

  pickDoctrine(id) {
    if (!this.pendingDoctrine || !this.pendingDoctrine.includes(id)) return false;
    this.doctrines.push(id);
    this.pendingDoctrine = null;
    this.recomputeMods();
    DOCTRINES[id].now?.(this);
    return true;
  }

  // ---------------------------------------------------------------- waves
  canSendWave() {
    if (this.over || this.pendingDoctrine) return false;
    if (!this.freeplay && this.wave >= this.campaignWaves) return false;
    return this.activeWaves.every((w) => w.qi >= w.queue.length);
  }

  sendWave() {
    if (!this.canSendWave()) return false;
    if (this.activeWaves.length) {
      const bonus = 10 + Math.min(this.wave, 40);
      this.gold += bonus;
    }
    const n = ++this.wave;
    this.itemsThisWave = 0;
    if (this.has('oweBlock') && n >= 8 && this.map.extraLane && !this.activePaths.includes(this.map.extraLane)) {
      this.activePaths.push(this.map.extraLane);
      this.emit('toast', 'The Owe Block lane is open: a third column joins every wave.', { warn: true });
    }
    const aw = { n, queue: buildQueue(this, n), qi: 0, t: 0, alive: 0 };
    this.activeWaves.push(aw);
    this.insurgentFlag.fill(false);
    for (let i = 0; i < this.morale.length; i++) if (this.morale[i] < this.mods.moraleThreshold) this.raiseInsurgency(i, aw);
    this.checkRunUnlocks();
    const boss = aw.queue.find((q) => BOSS_TYPES.includes(q.type));
    this.emit('waveStart', `Wave ${n}${boss ? ` — ${ENEMIES[boss.type].name}` : ''}`, { wave: n, boss: boss?.type });
    return true;
  }

  raiseInsurgency(i, aw) {
    aw = aw || this.activeWaves[this.activeWaves.length - 1];
    if (!aw || this.insurgentFlag[i]) return;
    this.insurgentFlag[i] = true;
    const d = this.map.districts[i];
    const pathId = this.map.paths[d.nodePath] ? d.nodePath : this.activePaths[0];
    const path = this.map.paths[pathId];
    const d0 = path.distOf((d.node[0] + 0.5) * TILE, (d.node[1] + 0.5) * TILE);
    const count = 3 + Math.floor(Math.min(this.wave, 40) / 4);
    for (let k = 0; k < count; k++) aw.queue.push({ t: aw.t + 1 + k * 0.7, type: 'insurgent', path: pathId, d0, mods: [] });
    aw.queue.sort((a, b) => a.t - b.t);
    this.stats.insurgencies++;
    this.addMorale(i, 15);
    this.emit('toast', `Insurgents rise in ${d.name}! (morale fell below ${this.mods.moraleThreshold}%)`, { warn: true });
  }

  // ---------------------------------------------------------------- enemies
  spawnEnemy(type, pathId, d0, waveN, aw, mods = []) {
    const def = ENEMIES[type];
    const e = this.enemyPool.pop() || {};
    const traits = new Set(def.traits);
    let hpX = 1, speedX = 1, regrow = def.regrow || 0;
    for (const m of mods) {
      const M = MODIFIERS[m];
      if (!M || traits.has('boss')) continue;
      for (const tr of M.traits) traits.add(tr);
      if (M.hp) hpX *= M.hp;
      if (M.speed) speedX *= M.speed;
      if (M.regrow) regrow = Math.max(regrow, M.regrow);
    }
    const boss = traits.has('boss');
    const scale = boss ? (waveN > 30 ? hpMult(waveN) / hpMult(30) : 1) : hpMult(waveN);
    const hp = def.hp * scale * hpX * (1 + this.mods.enemyHp) * (this.map.def.hpScale || 1);
    Object.assign(e, {
      uid: this.uid++, type, def, path: this.map.paths[pathId], d: d0, x: 0, y: 0, traits, mods,
      hp, maxHp: hp, shield: 0, maxShield: 0, alive: true, speed: def.speed * speedX, curSpeed: 0,
      hidden: traits.has('hidden'), armored: traits.has('armored'), boss, elite: traits.has('elite'), regrow,
      slowAmt: 0, slowT: 0, frozenT: 0, frostAmt: 0, frostT: 0, burnDps: 0, burnT: 0, burnVuln: 0, burnSrc: null, acid: 0,
      mark: 0, markT: 0, markBounty: 0, revealedT: 0, stunT: 0,
      untargetable: false, auraT: this.rng.range(0, 1), tickT: 0, sabotaged: 0, sabotagedIds: [],
      district: -1, aw, waveN, phase: 0, phaseT: 0, turnT: 0, summonT: 0,
    });
    e.path.posAt(e.d, e);
    if (aw) aw.alive++;
    this.enemies.push(e);
    const key = type + (mods.length ? ':' + mods.join(',') : '');
    if (!this.seenTypes.has(key)) {
      this.seenTypes.add(key);
      this.emit('newEnemy', ENEMIES[type].name, { enemy: type, traits: [...traits] });
    }
    if (type === 'plinket') {
      this.boss = e;
      e.untargetable = true;
      e.phase = 1;
      this.emit('boss', 'MINISTER SUSAN PLINKET', { phase: 1 });
    } else if (boss) {
      this.emit('boss', def.name.toUpperCase(), { phase: 0 });
    }
    return e;
  }

  applySlow(e, amt, dur) {
    if (e.boss) amt *= 0.5;
    amt = Math.min(0.8, amt);
    if (e.slowT <= 0 || amt > e.slowAmt) e.slowAmt = amt;
    e.slowT = Math.max(e.slowT, dur);
  }

  freeze(e, dur, frost, force) {
    if (e.boss) { this.applySlow(e, 0.6, dur); return; }
    if (force || e.frozenT <= 0) e.frozenT = Math.max(e.frozenT, dur);
    if (frost) { e.frostAmt = frost; e.frostT = dur + 3; }
  }

  stun(e, dur) { if (!e.boss) e.stunT = Math.max(e.stunT, dur); }

  applyBurn(e, dps, dur, src) {
    if (e.burnT <= 0 || dps >= e.burnDps) { e.burnDps = dps; e.burnSrc = src; }
    e.burnT = Math.max(e.burnT, dur);
    if (src?.s?.burnVuln) e.burnVuln = Math.max(e.burnVuln, src.s.burnVuln);
  }

  applyMark(e, amt, dur, bounty) {
    if (e.markT <= 0 || amt >= e.mark) e.mark = amt;
    e.markT = Math.max(e.markT, dur);
    if (bounty) e.markBounty = Math.max(e.markBounty, bounty);
  }

  knockback(e, px) { if (!e.boss) e.d = Math.max(0, e.d - px); }

  // Damage rules (BTD5-style, binary and readable):
  //   Armored ignores sharp without Shred; frozen enemies ignore sharp without Shred.
  damage(e, amount, src, o = {}) {
    if (!e.alive || e.untargetable || amount <= 0) return;
    const dtype = o.dtype || 'magic';
    if (!o.raw && dtype === 'sharp' && !o.shred && (e.armored || e.frozenT > 0)) {
      if (!this.headless && this.rng.next() < 0.1) this.fx({ kind: 'ping', x: e.x, y: e.y - 14, r: 0, max: 0.4, color: '#b8c4d0' });
      return;
    }
    let amt = amount;
    if (!o.raw) {
      amt *= 1 + (e.markT > 0 ? e.mark : 0);
      if (e.burnT > 0 && e.burnVuln) amt *= 1 + e.burnVuln;
      if (this.timers.sabotage > 0) amt *= 1.3;
      if (this.timers.hallowed > 0 && this.hallowed && (e.x - this.hallowed.x) ** 2 + (e.y - this.hallowed.y) ** 2 < this.hallowed.r ** 2) amt *= 2;
      if (e.curse > 0) amt *= 1 + e.curse;
      if ((e.boss || e.elite) && o.bossMult) amt *= o.bossMult;
      amt *= 1 + (this.mods.dtypeDmg[dtype] || 0);
      if (e.shield > 0) {
        if (amt <= e.shield) { e.shield -= amt; amt = 0; }
        else { amt -= e.shield; e.shield = 0; }
      }
    }
    const dealt = Math.min(e.hp, amt);
    e.hp -= amt;
    e.lastHitT = this.time;
    if (src) {
      src.dmg += dealt;
      const key = src.hero ? 'hero' : src.type;
      this.stats.dmgByType[key] = (this.stats.dmgByType[key] || 0) + dealt;
      if (src.hero) this.heroXp(dealt * 0.12);
      if (src.s?.voodoo && !e.boss && !e.elite && this.rng.next() < src.s.voodoo) e.hp = 0;
    }
    if (e.hp <= 0) this.kill(e, src);
  }

  kill(e, src) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    let bounty = e.def.bounty * (1 + 0.02 * Math.min(e.waveN, 40)) * (1 + this.mods.bountyMult) * (1 + (e.markT > 0 ? e.markBounty : 0));
    if (this.hero?.s.bountyAura && (e.x - this.hero.x) ** 2 + (e.y - this.hero.y) ** 2 < this.hero.s.auraRange ** 2) bounty *= 1 + this.hero.s.bountyAura;
    bounty = Math.round(bounty);
    this.gold += bounty;
    this.stats.goldEarned += bounty;
    this.stats.kills++;
    if (src) src.kills++;
    if (e.aw) e.aw.alive--;
    this.fx({ kind: 'burst', x: e.x, y: e.y, r: e.def.size + 6, max: 0.3, color: '#e0d0b0' });
    const blast = e.def.deathBlast;
    if (blast) {
      for (const t of this.towers) if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= blast.range ** 2) t.disabledT = Math.max(t.disabledT, blast.dur);
      this.fx({ kind: 'ring', x: e.x, y: e.y, r: blast.range, max: 0.5, color: '#ff9b3d' });
    }
    const spawnKids = (type, count) => {
      for (let i = 0; i < count; i++) this.spawnBuffer.push({ type, path: e.path.id, d0: Math.max(0, e.d - 14 * i), waveN: e.waveN, aw: e.aw, mods: e.boss ? [] : e.mods });
    };
    if (e.def.split) spawnKids(e.def.split.type, e.def.split.count);
    if (e.def.spill) for (const [type, count] of e.def.spill) spawnKids(type, count);
    if (e.type === 'plinket') { this.boss = null; this.stats.plinket = true; }
    if (e.boss) this.emit('toast', `${e.def.name} destroyed!`);
  }

  leak(e) {
    e.alive = false;
    if (e.aw) e.aw.alive--;
    if (this.invincible) return;
    this.leakCount++;
    this.stats.leaks++;
    this.leakLog.push({ t: this.time, wave: this.wave, type: e.type, path: e.path.id, hp: Math.round(e.hp) });
    let cost = e.boss ? this.resolve : e.def.leak + (e.traits.has('fortified') ? 1 : 0);
    if (this.mods.leakTax && this.leakCount % 3 === 0) cost++;
    this.resolve -= cost;
    if (e.def.steal) this.gold -= Math.floor(Math.max(0, this.gold) * e.def.steal);
    this.addMoraleAll(-3);
    this.fx({ kind: 'flash', x: 0, y: 0, r: 0, max: 0.3, color: '#ff3030' });
  }

  // ---------------------------------------------------------------- projectiles
  spawnProjectile(o) {
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const p = this.projPool.pop() || { hitIds: [] };
    const hitIds = p.hitIds;
    hitIds.length = 0;
    for (const k in p) if (k !== 'hitIds') delete p[k];
    Object.assign(p, { travel: 0, hits: 0, target: null, maxTravel: 400, pierce: 1 }, o);
    p.hitIds = hitIds;
    this.projectiles.push(p);
  }

  updateProjectiles(dt) {
    let j = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (this.stepProjectile(p, dt)) this.projectiles[j++] = p;
      else { p.target = null; p.src = null; p.home = null; this.projPool.push(p); }
    }
    this.projectiles.length = j;
  }

  hitWith(p, e) {
    const src = p.src;
    this.damage(e, p.dmg, src, { dtype: p.dtype, shred: p.shred, bossMult: p.bossMult });
    if (!e.alive && !p.slow) return;
    if (p.slow) {
      this.applySlow(e, p.slow, p.slowDur);
      if (p.acid) e.acid = Math.max(e.acid, p.acid);
    }
    if (p.burn && e.alive) this.applyBurn(e, p.burn, p.burnDur, src);
    if (p.stun && e.alive) this.stun(e, p.stun);
    if (p.distract && e.alive && this.rng.next() < p.distract) this.knockback(e, p.knockback);
  }

  explode(p) {
    const r = p.splash || 30;
    this.spatial.query(p.x, p.y, r, (e) => {
      if (!e.alive || e.untargetable) return;
      this.hitWith(p, e);
      if (e.alive && p.knockback && !p.distract) this.knockback(e, p.knockback);
      if (p.flare) e.revealedT = Math.max(e.revealedT, 2);
    });
    this.fx({ kind: 'ring', x: p.x, y: p.y, r, max: 0.3, color: p.color || '#ff9b3d' });
    if (p.cluster) {
      for (let i = 0; i < p.cluster; i++) {
        const a = (i / p.cluster) * Math.PI * 2;
        this.spawnProjectile({ ...p, kind: 'shell', x: p.x, y: p.y, tx: p.x + Math.cos(a) * 45, ty: p.y + Math.sin(a) * 45, cluster: 0, dmg: p.dmg * 0.5, splash: 28, speed: 260, hitIds: undefined });
      }
    }
  }

  stepProjectile(p, dt) {
    const step = (p.speed || 500) * dt;
    if (p.kind === 'shell') {
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
      if (dist > step) { p.x += (dx / dist) * step; p.y += (dy / dist) * step; return true; }
      p.x = p.tx; p.y = p.ty;
      this.explode(p);
      return false;
    }
    if (p.kind === 'hook') {
      const tx = p.leg === 0 ? p.tx : p.home?.x ?? p.x, ty = p.leg === 0 ? p.ty : p.home?.y ?? p.y;
      const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
      if (dist > step) { p.x += (dx / dist) * step; p.y += (dy / dist) * step; }
      else if (p.leg === 0) { p.leg = 1; p.hitIds.length = 0; p.hits = 0; }
      else return false;
      this.pierceHits(p, 14);
      return true;
    }
    // dart
    if (p.homing && p.target && p.target.alive) {
      const a = Math.atan2(p.target.y - p.y, p.target.x - p.x), cur = Math.atan2(p.vy, p.vx);
      let d = a - cur; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const na = cur + Math.max(-6 * dt, Math.min(6 * dt, d)), sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
    }
    p.x += p.vx * dt; p.y += p.vy * dt; p.travel += step;
    this.pierceHits(p, 13);
    return p.hits < p.pierce && p.travel < p.maxTravel && p.x > -30 && p.x < W + 30 && p.y > -30 && p.y < H + 30;
  }

  pierceHits(p, r) {
    this.spatial.query(p.x, p.y, r, (e) => {
      if (!e.alive || e.untargetable || p.hitIds.includes(e.uid)) return;
      if (p.src && !p.src.dead && e.hidden && !canSee(this, p.src, e)) return;
      p.hitIds.push(e.uid);
      if (p.splash && p.kind === 'dart') { this.explode({ ...p, x: e.x, y: e.y, cluster: 0 }); }
      else this.hitWith(p, e);
      p.hits++;
      return p.hits >= p.pierce;
    });
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.over || this.pendingDoctrine) return;
    this.time += dt;

    for (const aw of this.activeWaves) {
      aw.t += dt;
      while (aw.qi < aw.queue.length && aw.queue[aw.qi].t <= aw.t) {
        const s = aw.queue[aw.qi++];
        this.spawnEnemy(s.type, s.path, s.d0, aw.n, aw, s.mods);
      }
    }

    for (const k in this.timers) if (this.timers[k] > 0) {
      this.timers[k] -= dt;
      if (k === 'chug' && this.timers.chug <= 0) this.timers.hangover = 6;
    }
    if (this.revealAll > 0) this.revealAll -= dt;
    if (this.mods.revealAll) this.revealAll = 1;
    for (let i = this.barricades.length - 1; i >= 0; i--) if ((this.barricades[i].t -= dt) <= 0) this.barricades.splice(i, 1);

    this.spatial.clear();
    for (const e of this.enemies) if (e.alive) this.spatial.insert(e);

    this.auraT -= dt;
    if (this.auraT <= 0) { this.auraT += AURA_TICK; this.auraTick(); }

    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
    this.updateItems(dt);
    for (const t of this.towers) {
      if (t.abilityT.whirl > 0) { // Bilgrat Whirlwind: 40 bottles/s
        t.whirlAcc = (t.whirlAcc || 0) + dt * 40;
        while (t.whirlAcc >= 1) { t.whirlAcc--; this.spawnProjectile({ kind: 'dart', x: t.x, y: t.y, vx: 0, vy: 0, src: t, dtype: 'sharp', shred: t.eff.shred, dmg: t.s.dmg * t.eff.dmgMul, pierce: 3, speed: 420, maxTravel: t.eff.range + 20, color: t.def.color, ...(() => { const a = this.rng.next() * Math.PI * 2; return { vx: Math.cos(a) * 420, vy: Math.sin(a) * 420 }; })() }); }
      }
      updateTower(this, t, dt);
    }
    this.updateProjectiles(dt);
    if (this.boss && this.boss.alive) this.updateBoss(this.boss, dt);

    let j = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive) this.enemies[j++] = e;
      else { e.aw = null; e.burnSrc = null; this.enemyPool.push(e); }
    }
    this.enemies.length = j;
    if (this.spawnBuffer.length) {
      for (const s of this.spawnBuffer) this.spawnEnemy(s.type, s.path, s.d0, s.waveN, s.aw, s.mods);
      this.spawnBuffer.length = 0;
    }

    let k = 0;
    for (const f of this.effects) if ((f.t += dt) < f.max) this.effects[k++] = f;
    this.effects.length = k;

    if (this.resolve <= 0 && !this.over) {
      this.resolve = 0;
      this.over = true;
      this.emit('defeat', 'The castle has fallen.');
      return;
    }

    for (let i = this.activeWaves.length - 1; i >= 0; i--) {
      const aw = this.activeWaves[i];
      if (aw.qi >= aw.queue.length && aw.alive <= 0) {
        this.activeWaves.splice(i, 1);
        this.endOfWave(aw.n);
        if (this.over) return;
      }
    }
  }

  auraTick() {
    for (const t of this.towers) t.auras.length = 0;
    this.turnedTowers.length = 0;
    const holiday = this.mods.detectMult;
    for (const t of this.towers) {
      const a = t.s.aura;
      const ar = t.s.auraRange || t.s.range;
      if (a && t.disabledT <= 0 && t.turnedT <= 0) {
        for (const o of this.towers) if (o !== t && (o.x - t.x) ** 2 + (o.y - t.y) ** 2 <= ar * ar) o.auras.push(a);
      }
      if (t.s.reveal && t.disabledT <= 0) {
        const r = (t.eff?.range || t.s.range) * holiday;
        this.spatial.query(t.x, t.y, r, (e) => { if (e.hidden) e.revealedT = AURA_TICK * 2; });
        if (t.s.revealAll) this.revealAll = Math.max(this.revealAll, AURA_TICK * 2);
      }
      if (t.s.curse) this.spatial.query(t.x, t.y, t.eff?.range || t.s.range, (e) => { e.curse = t.s.curse; e.curseT = AURA_TICK * 2; });
      if (t.s.chill) this.spatial.query(t.x, t.y, t.eff?.range || t.s.range, (e) => { if (e.alive) this.applySlow(e, t.s.chill, AURA_TICK * 2); });
      if (t.turnedT > 0) this.turnedTowers.push(t);
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.curseT > 0) e.curseT -= AURA_TICK; else e.curse = 0;
      if (e.def.soberAura) {
        const r2 = e.def.soberAura ** 2;
        for (const t of this.towers) if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= r2) t.soberT = AURA_TICK * 2;
      }
    }
    for (const t of this.towers) computeEffective(this, t);
    for (let i = 0; i < this.morale.length; i++) {
      if (this.morale[i] < this.mods.moraleThreshold && !this.insurgentFlag[i] && this.activeWaves.length) this.raiseInsurgency(i);
    }
  }

  updateEnemy(e, dt) {
    const def = e.def;
    if (e.slowT > 0) e.slowT -= dt;
    if (e.markT > 0) e.markT -= dt;
    if (e.revealedT > 0) e.revealedT -= dt;
    if (e.stunT > 0) e.stunT -= dt;
    if (e.frostT > 0) e.frostT -= dt;
    if (e.frozenT > 0) { e.frozenT -= dt; if (e.frozenT <= 0 && e.frostT > 0) this.applySlow(e, e.frostAmt, e.frostT); }

    if (e.burnT > 0) {
      e.burnT -= dt;
      this.damage(e, e.burnDps * dt, e.burnSrc, { dtype: 'fire' });
      if (!e.alive) return;
    }
    if (e.acid > 0 && e.slowT > 0) { this.damage(e, e.acid * dt, null, { dtype: 'fire' }); if (!e.alive) return; }
    else if (e.slowT <= 0) e.acid = 0;
    if (this.timers.flood > 0) { this.damage(e, 30 * dt, this.hero, { dtype: 'magic' }); if (!e.alive) return; this.applySlow(e, 0.7, 0.2); }
    // Regrow: heals only after 1.5s without being hit, and never while burning
    if (e.regrow && e.burnT <= 0 && e.hp < e.maxHp && this.time - (e.lastHitT || 0) > 1.5) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.regrow * dt);
    if (this.mods.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * this.mods.regen * dt);

    let speed = e.speed * (1 + this.mods.enemySpeed);
    if (e.phase === 3) speed *= 1.3;
    if (e.slowT > 0) speed *= 1 - e.slowAmt;
    if (this.timers.sabotage > 0) speed *= 0.5;
    if ((e.stunT > 0 || e.frozenT > 0) && !e.boss) speed = 0;
    if (!e.boss) for (const b of this.barricades) if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < 900) { speed = 0; break; }
    if (speed > 0 && this.turnedTowers.length) {
      for (const t of this.turnedTowers) if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= (t.s.range || 120) ** 2) { speed *= 1.25; break; }
    }
    e.curSpeed = speed;
    e.d += speed * dt;
    if (e.d >= e.path.total) { this.leak(e); return; }
    e.path.posAt(e.d, e);
    e.district = this.map.districtAt(e.x, e.y);

    if (def.moraleDrain && e.district >= 0) this.addMorale(e.district, -def.moraleDrain * this.mods.pamphletMult * dt);

    e.auraT -= dt;
    if (def.shieldAura && e.auraT <= 0) {
      const sa = def.shieldAura;
      e.auraT = sa.every;
      const amount = sa.amount * (e.boss ? 1 : hpMult(e.waveN));
      this.spatial.query(e.x, e.y, sa.range, (o) => {
        if (o.alive && o !== e && !o.boss) {
          o.maxShield = Math.max(o.maxShield, amount * 1.5);
          o.shield = Math.min(amount * 1.5, o.shield + amount);
        }
      });
    }

    if (def.sabotage && e.sabotaged < def.sabotage.max && !(e.revealedT > 0 || this.revealAll > 0)) {
      e.tickT -= dt;
      if (e.tickT <= 0) {
        e.tickT = 0.2;
        const r2 = def.sabotage.range ** 2;
        for (const t of this.towers) {
          if (e.sabotaged >= def.sabotage.max) break;
          if (t.eff?.detect) continue; // towers that can see it aren't fooled
          if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= r2 && !e.sabotagedIds.includes(t.id)) {
            e.sabotagedIds.push(t.id);
            e.sabotaged++;
            t.disabledT = Math.max(t.disabledT, def.sabotage.dur);
            this.fx({ kind: 'ring', x: t.x, y: t.y, r: 22, max: 0.5, color: '#5a6b4d' });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------- Plinket (wave 30)
  updateBoss(b, dt) {
    b.phaseT += dt;
    const progress = b.d / b.path.total;
    if (b.phase === 1) {
      for (const t of this.towers) if ((t.x - b.x) ** 2 + (t.y - b.y) ** 2 <= 170 * 170) { t.plinketBuffT = 0.5; t.plinketMarked = true; }
      if (b.phaseT >= 28 || progress >= 0.35) {
        b.phase = 2; b.phaseT = 0;
        b.untargetable = false;
        b.shield = b.maxShield = 4500 * (b.maxHp / 16000);
        this.emit('boss', 'J.R. UNMASKED', { phase: 2 });
      }
    } else if (b.phase === 2) {
      b.turnT += dt;
      if (b.turnT >= 3.5) {
        b.turnT = 0;
        const marked = this.towers.filter((t) => t.plinketMarked && t.turnedT <= 0 && !t.hero);
        if (marked.length) this.rng.pick(marked).turnedT = 8;
      }
      b.summonT += dt;
      if (b.summonT >= 7) { b.summonT = 0; this.summon(b, [['insurgent', 5]]); }
      if (b.shield <= 0 || progress >= 0.7) {
        b.phase = 3; b.phaseT = 0; b.shield = 0; b.summonT = 0;
        this.emit('boss', 'SUSAN PLINKET, FOUNDER OF MAMA', { phase: 3 });
      }
    } else if (b.phase === 3) {
      b.summonT += dt;
      if (b.summonT >= 9) { b.summonT = 0; this.summon(b, [['believer', 2], ['zealot', 4]]); }
    }
  }

  summon(b, groups) {
    for (const [type, count] of groups) {
      for (let i = 0; i < count; i++) this.spawnBuffer.push({ type, path: b.path.id, d0: Math.max(0, b.d - 20 - i * 10), waveN: Math.min(b.waveN, 30), aw: b.aw, mods: [] });
    }
  }

  // ---------------------------------------------------------------- summary
  summary() {
    return {
      seed: this.seed, map: this.mapId, wave: this.wave, cleared: this.won, freeplay: this.freeplay, resolve: this.resolve,
      kills: this.stats.kills, leaks: this.stats.leaks, goldEarned: this.stats.goldEarned, doctrines: this.doctrines.slice(),
      mandates: this.mandates.slice(), hero: this.heroId, heroLevel: this.hero?.level || 0, towers: this.towers.length,
      heat: this.mandates.length, time: Math.round(this.time), damage: { ...this.stats.dmgByType }, plinket: this.stats.plinket,
    };
  }
}

export { TOWERS, ENEMIES, TILE, COLS, ROWS };
