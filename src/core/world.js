// The simulation. No DOM access — the browser game and tools/sim.mjs both drive this.
import { makeRng } from './rng.js';
import { SpatialHash } from './spatial.js';
import { buildMap, DISTRICTS, TILE, COLS, W, H } from './map.js';
import { TOWERS, towerStats, SELL_REFUND } from '../data/towers.js';
import { ENEMIES, hpMult } from '../data/enemies.js';
import { WAVES, BOSS_WAVE } from '../data/waves.js';
import { DOCTRINES } from '../data/doctrines.js';
import { KINGS } from '../data/kings.js';
import { BBL, LETTER_TEMPLATES, PLINKET_P1_LINES } from '../data/lore.js';

export const START_GOLD = 300;
export const START_ALE = 20;
export const START_RESOLVE = 20;
export const START_MORALE = 75;
const AURA_TICK = 0.25;
const MAX_EFFECTS = 400;
const LETTER_TYPES = ['zealot', 'matron', 'picket', 'believer', 'infiltrator', 'pamphleteer', 'martyr', 'widow', 'bagman'];

export class World {
  constructor(opts = {}) {
    this.seed = opts.seed ?? (Date.now() & 0x7fffffff);
    this.rng = makeRng(this.seed);
    this.headless = !!opts.headless;
    this.mandates = opts.mandates || [];
    this.kings = opts.kings || ['seamus', 'buke'];
    this.unlocks = opts.unlocks || { towers: [], doctrines: [] };
    this.map = buildMap();
    this.activePaths = ['A', 'B'];

    this.time = 0;
    this.wave = 0;
    this.gold = START_GOLD - (this.has('rumpsLedger') ? 90 : 0);
    this.ale = START_ALE;
    this.resolve = START_RESOLVE;
    this.morale = DISTRICTS.map(() => START_MORALE);
    this.insurgentFlag = DISTRICTS.map(() => false);
    this.bonds = [];
    this.bondsIssued = 0;
    this.noInterestUntil = 0;

    this.enemies = [];
    this.towers = [];
    this.towerGrid = new Map();
    this.projectiles = [];
    this.effects = [];
    this.enemyPool = [];
    this.projPool = [];
    this.spawnBuffer = [];
    this.spatial = new SpatialHash(W, H, 80);
    this.activeWaves = [];
    this.barricades = [];
    this.turnedTowers = [];
    this.auraT = 0;
    this.uid = 1;

    this.events = [];
    this.doctrines = [];
    this.pendingDoctrine = null;
    this.kingState = {};
    for (const k of this.kings) this.kingState[k] = { cd: 0, used: false };
    this.chugT = 0;
    this.hangoverT = 0;
    this.oracleCharges = 0;
    this.leakCount = 0;
    this.leakLog = [];
    this.stats = { kills: 0, leaks: 0, goldEarned: 0, dmgByType: {}, bondsIssued: 0, defaults: 0, insurgencies: 0 };
    this.over = false;
    this.won = false;
    this.boss = null;
    this.invincible = false; // debug
    this.recomputeMods();
    this.letter = this.makeLetter(1);
    this.emit('bbl', BBL.start);
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
      costMult: 0, sellRefund: SELL_REFUND, bowPierce: 0, bowDmg: 0, pikeDmg: 0, bondRate: 0, enemyHp: 0,
      rangeMult: 0, noSell: false, bountyMult: 0, leakTax: false,
    };
    for (const id of this.doctrines) {
      const d = DOCTRINES[id].mods;
      for (const k in d) {
        if (typeof d[k] === 'boolean') m[k] = m[k] || d[k];
        else if (k === 'sellRefund') m.sellRefund = Math.min(m.sellRefund, d[k]);
        else m[k] += d[k];
      }
    }
    if (this.has('blight')) m.incomeMult -= 0.25;
    if (this.has('rotoTightens')) m.bondRate += 0.15;
    if (this.has('zeal')) m.enemyHp += 0.15;
    if (this.has('zealotry')) m.enemySpeed += 0.12;
    m.kingCost = this.has('hungover') ? 1.5 : 1;
    m.detectMult = this.has('holiday') ? 0.5 : 1;
    m.regen = this.has('amnesty') ? 0.01 : 0;
    m.moraleThreshold = this.has('presses') ? 40 : 30;
    m.pamphletMult = this.has('presses') ? 2 : 1;
    this.mods = m;
    for (const t of this.towers) this.refreshStats(t);
  }

  cost(base) { return Math.round(base * (1 + this.mods.costMult)); }

  // ---------------------------------------------------------------- towers
  towerUnlocked(type) {
    const def = TOWERS[type];
    return !def.locked || this.unlocks.towers.includes(type);
  }

  canPlace(type, tx, ty) {
    const def = TOWERS[type];
    if (!def || !this.towerUnlocked(type)) return 'locked';
    if (!this.map.buildable(tx, ty)) return 'blocked';
    if (this.towerGrid.has(ty * COLS + tx)) return 'occupied';
    if (def.max && this.towers.filter((t) => t.type === type).length >= def.max) return 'max';
    if (this.gold < this.cost(def.cost)) return 'gold';
    if ((def.aleCost || 0) > this.ale) return 'ale';
    return null;
  }

  placeTower(type, tx, ty) {
    if (this.over || this.canPlace(type, tx, ty)) return null;
    const def = TOWERS[type];
    const c = this.cost(def.cost);
    this.gold -= c;
    this.ale -= def.aleCost || 0;
    const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
    const t = {
      id: this.uid++, type, def, tx, ty, x, y, branch: null, tier: 0, s: null,
      cd: 0, mode: def.base.attack === 'splash' ? 'strong' : 'first', invested: c,
      disabledT: 0, soberT: 0, turnedT: 0, plinketMarked: false, plinketBuffT: 0,
      auraRate: 0, auraDmg: 0, dmg: 0, kills: 0, district: this.map.districtAt(x, y),
    };
    this.refreshStats(t);
    this.towers.push(t);
    this.towerGrid.set(ty * COLS + tx, t);
    this.fx({ kind: 'ring', x, y, r: 20, max: 0.4, color: def.color });
    return t;
  }

  refreshStats(t) {
    const s = towerStats(t.type, t.branch, t.tier);
    if (s.range) s.range *= 1 + this.mods.rangeMult;
    if (t.type === 'bow') { s.pierce = (s.pierce || 0) + this.mods.bowPierce; s.dmg *= 1 + this.mods.bowDmg; }
    if (t.type === 'pike') s.dmg *= 1 + this.mods.pikeDmg;
    s.detectRange = s.detect ? s.range * this.mods.detectMult : 0;
    t.s = s;
  }

  upgradeCost(t, branch) {
    if (t.tier >= 3) return null;
    if (t.branch != null && t.branch !== branch) return null;
    return this.cost(t.def.branches[branch].tiers[t.tier].cost);
  }

  upgrade(t, branch) {
    const c = this.upgradeCost(t, branch);
    if (c == null || this.gold < c || this.over) return false;
    this.gold -= c;
    t.invested += c;
    t.branch = branch;
    t.tier++;
    this.refreshStats(t);
    this.fx({ kind: 'ring', x: t.x, y: t.y, r: 26, max: 0.5, color: '#ffe08a' });
    return true;
  }

  sellValue(t) { return Math.floor(t.invested * this.mods.sellRefund); }

  sell(t) {
    if (this.mods.noSell || this.over) return false;
    this.gold += this.sellValue(t);
    this.towers.splice(this.towers.indexOf(t), 1);
    this.towerGrid.delete(t.ty * COLS + t.tx);
    return true;
  }

  towerAt(tx, ty) { return this.towerGrid.get(ty * COLS + tx) || null; }

  // ---------------------------------------------------------------- economy
  bondQuote() {
    const principal = 150;
    const rate = 0.2 + 0.15 * this.bondsIssued + this.mods.bondRate;
    return { principal, rate, due: Math.round(principal * (1 + rate)), dueWave: Math.max(this.wave, 1) + 5 };
  }

  canIssueBond() { return !this.over && this.wave <= 24; }

  issueBond() {
    if (!this.canIssueBond()) return false;
    const q = this.bondQuote();
    this.gold += q.principal;
    this.bonds.push({ due: q.due, dueWave: q.dueWave, rate: q.rate });
    this.bondsIssued++;
    this.stats.bondsIssued++;
    this.emit('msg', `Issued an Aleforge Bond: +${q.principal}g now, ${q.due}g due after wave ${q.dueWave} (${Math.round(q.rate * 100)}% interest).`);
    return true;
  }

  avgMorale() { return this.morale.reduce((a, b) => a + b, 0) / this.morale.length; }

  addMoraleAll(n) { for (let i = 0; i < this.morale.length; i++) this.addMorale(i, n); }

  addMorale(i, n) {
    this.morale[i] = Math.max(0, Math.min(100, this.morale[i] + n));
  }

  incomePreview(n = this.wave) {
    const base = 60 + 7 * n;
    const moraleF = Math.max(0.3, Math.min(1, this.avgMorale() / 100));
    const income = Math.round(base * moraleF * (1 + this.mods.incomeMult));
    const cap = Math.round(25 * (1 + this.mods.interestCapMult));
    const interest = n > this.noInterestUntil ? Math.min(Math.floor(Math.max(0, this.gold) * 0.05), cap) : 0;
    let springGold = 0, springAle = 0;
    for (const t of this.towers) { springGold += t.s.goldIncome || 0; springAle += t.s.aleIncome || 0; }
    const ale = Math.max(0, 12 + this.mods.aleIncome + springAle);
    return { income, interest, springGold, ale, cap };
  }

  endOfWave(n) {
    const p = this.incomePreview(n);
    const gold = p.income + p.interest + p.springGold;
    this.gold += gold;
    this.stats.goldEarned += gold;
    this.ale += p.ale;
    for (const t of this.towers) if (t.s.moraleCost && t.district >= 0) this.addMorale(t.district, -t.s.moraleCost);
    const regen = 8 * (1 + this.mods.moraleRegenMult);
    this.addMoraleAll(regen);

    let paid = 0;
    for (const b of this.bonds.filter((b) => b.dueWave === n)) {
      if (this.gold >= b.due) { this.gold -= b.due; paid += b.due; }
      else {
        this.gold = 0;
        this.addMoraleAll(-40);
        this.stats.defaults++;
        this.emit('bbl', BBL.default);
      }
    }
    if (paid) this.emit('bbl', BBL.bondDue + ` (−${paid}g)`);
    this.bonds = this.bonds.filter((b) => b.dueWave !== n);
    this.emit('waveEnd', `Wave ${n} held. +${p.income}g tithes, +${p.interest}g interest${p.springGold ? `, +${p.springGold}g spring` : ''}, +${p.ale} ale.`, { wave: n });

    if (n === BOSS_WAVE) {
      this.won = true;
      this.over = true;
      this.emit('bbl', BBL.victory);
      this.emit('victory', 'Aleforge stands.');
      return;
    }
    if (n % 5 === 0) this.offerDoctrines();
  }

  // ---------------------------------------------------------------- doctrines
  doctrineAvailable(id) {
    const d = DOCTRINES[id];
    return !this.doctrines.includes(id) && (!d.locked || this.unlocks.doctrines.includes(id));
  }

  offerDoctrines() {
    const pool = Object.keys(DOCTRINES).filter((id) => this.doctrineAvailable(id));
    this.pendingDoctrine = this.rng.shuffle(pool).slice(0, 3);
    this.emit('doctrine', BBL.doctrine);
  }

  pickDoctrine(id) {
    if (!this.pendingDoctrine || !this.pendingDoctrine.includes(id)) return false;
    this.doctrines.push(id);
    this.pendingDoctrine = null;
    this.recomputeMods();
    DOCTRINES[id].now?.(this);
    this.emit('msg', `Doctrine adopted: ${DOCTRINES[id].name}.`);
    return true;
  }

  // ---------------------------------------------------------------- waves
  canSendWave() {
    if (this.over || this.pendingDoctrine || this.wave >= WAVES.length) return false;
    return this.activeWaves.every((w) => w.qi >= w.queue.length);
  }

  sendWave() {
    if (!this.canSendWave()) return false;
    const early = this.activeWaves.length > 0;
    if (early) {
      const bonus = 10 + this.wave;
      this.gold += bonus;
      this.emit('msg', `Called the next wave early: +${bonus}g.`);
    }
    const n = ++this.wave;
    if (this.has('oweBlock') && n >= 8 && !this.activePaths.includes('C')) {
      this.activePaths.push('C');
      this.emit('msg', 'The Owe Block causeway is open. A third column marches from the south.');
    }
    const queue = [];
    for (const [type, count, gap, delay, path] of WAVES[n - 1]) {
      for (let i = 0; i < count; i++) {
        const p = path === 'AB' ? (i % 2 ? 'B' : 'A') : path;
        queue.push({ t: delay + i * gap, type, path: p, d0: 0 });
        // Owe Block Riots: every third marcher brings a friend up the causeway
        if (this.activePaths.includes('C') && type !== 'plinket' && i % 3 === 2) queue.push({ t: delay + i * gap + 0.3, type, path: 'C', d0: 0 });
      }
    }
    queue.sort((a, b) => a.t - b.t);
    const aw = { n, queue, qi: 0, t: 0, alive: 0 };
    this.activeWaves.push(aw);
    this.insurgentFlag.fill(false);
    for (let i = 0; i < DISTRICTS.length; i++) if (this.morale[i] < this.mods.moraleThreshold) this.raiseInsurgency(i, aw);

    this.emit('waveStart', `Wave ${n}${n === BOSS_WAVE ? ' — THE SIEGE OF ALEFORGE' : ''}.`, { wave: n });
    if (n === 10) this.emit('bbl', BBL.wave10);
    if (WAVES[n - 1].some((g) => g[0] === 'bagman')) this.emit('bbl', BBL.bagman);
    if (n === BOSS_WAVE) this.emit('bbl', BBL.preBoss);
    this.letter = this.makeLetter(n + 1);
    return true;
  }

  raiseInsurgency(i, aw) {
    aw = aw || this.activeWaves[this.activeWaves.length - 1];
    if (!aw || this.insurgentFlag[i]) return;
    this.insurgentFlag[i] = true;
    const d = DISTRICTS[i];
    const path = this.map.paths[d.nodePath];
    const d0 = path.distOf((d.node[0] + 0.5) * TILE, (d.node[1] + 0.5) * TILE);
    const count = 3 + Math.floor(this.wave / 4);
    for (let k = 0; k < count; k++) aw.queue.push({ t: aw.t + 1 + k * 0.7, type: 'insurgent', path: d.nodePath, d0 });
    aw.queue.sort((a, b) => a.t - b.t);
    // queue entries before qi were already consumed; re-sorting only reorders the unconsumed tail
    // because new entries are all later than aw.t
    this.stats.insurgencies++;
    // the uprising vents some of the anger — punishment, not a permanent death spiral
    this.addMorale(i, 15);
    this.emit('bbl', BBL.insurgency(d.name));
  }

  // ---------------------------------------------------------------- letters
  makeLetter(n) {
    if (n > WAVES.length) return null;
    if (n === BOSS_WAVE) {
      return {
        wave: n, truthful: true, sig: '— S.P.', verified: null,
        text: 'I am the leader of this organization and I will not be treated otherwise! We strike when I say we strike. And yes, finally hear my name, loyal MAMAists.',
      };
    }
    const counts = {};
    const paths = new Set();
    for (const [type, count, , , path] of WAVES[n - 1]) {
      counts[type] = (counts[type] || 0) + count;
      paths.add(path);
    }
    let types = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 2);
    let pathKey = paths.size === 1 && !paths.has('AB') ? [...paths][0] : 'AB';
    const truthful = !(n >= 10 && this.rng.chance(1 / 3));
    const shown = types.map((t) => ({ t, c: counts[t] }));
    if (!truthful) {
      const decoys = LETTER_TYPES.filter((t) => !counts[t]);
      const swap = this.rng.int(0, shown.length - 1);
      shown[swap] = { t: this.rng.pick(decoys), c: Math.max(2, Math.round(counts[types[swap]] * this.rng.range(0.4, 1.2))) };
      pathKey = pathKey === 'AB' ? this.rng.pick(['A', 'B']) : pathKey === 'A' ? 'B' : 'A';
    }
    const pathText = pathKey === 'AB' ? 'both bridges' : this.map.paths[pathKey].name;
    const typeText = shown.map(({ t, c }) => `${c} ${ENEMIES[t].name}${c > 1 ? 's' : ''}`).join(' and ');
    const tpl = this.rng.pick(LETTER_TEMPLATES);
    const letter = {
      wave: n, truthful, sig: truthful ? '— J.R.' : '— JR', verified: null,
      text: tpl.replace('{types}', typeText).replace('{path}', pathText),
    };
    if (this.oracleCharges > 0) { this.oracleCharges--; letter.verified = truthful ? 'AUTHENTIC' : 'FORGED'; }
    return letter;
  }

  // ---------------------------------------------------------------- kings
  kingCost(id) { return Math.round(KINGS[id].ale * this.mods.kingCost); }

  kingReady(id) {
    const st = this.kingState[id];
    if (!st || this.over) return false;
    if (KINGS[id].once && st.used) return false;
    return st.cd <= 0 && this.ale >= this.kingCost(id);
  }

  useKing(id, target) {
    if (!this.kingReady(id)) return false;
    const k = KINGS[id];
    switch (id) {
      case 'seamus':
        for (const e of this.enemies) {
          if (!e.alive || e.untargetable) continue;
          this.damage(e, 220, null, { pierce: 99 });
          if (!e.def.heavy) this.knockback(e, 60);
        }
        this.fx({ kind: 'flash', x: W / 2, y: H / 2, r: 0, max: 0.6, color: '#b0643a' });
        break;
      case 'buke':
        this.chugT = 8;
        this.hangoverT = 0;
        break;
      case 'jagerbauhm': {
        if (!target) return false;
        const p = this.nearestPathPoint(target.x, target.y);
        if (!p || p.dist > 40) return false;
        this.barricades.push({ x: p.x, y: p.y, t: 5 });
        break;
      }
      case 'guinnie': {
        if (this.boss && this.boss.alive && !this.boss.untargetable) {
          this.damage(this.boss, this.boss.maxHp * 0.06, null, { pierce: 99, raw: true });
          this.fx({ kind: 'ring', x: this.boss.x, y: this.boss.y, r: 40, max: 0.5, color: '#3fbf5f' });
          break;
        }
        let best = null;
        for (const e of this.enemies) if (e.alive && !e.untargetable && !e.def.boss && (!best || e.hp > best.hp)) best = e;
        if (!best) return false;
        this.fx({ kind: 'ring', x: best.x, y: best.y, r: 30, max: 0.5, color: '#3fbf5f' });
        this.kill(best, null);
        break;
      }
      case 'jack':
        this.oracleCharges = 3;
        if (this.letter && !this.letter.verified) {
          this.oracleCharges--;
          this.letter.verified = this.letter.truthful ? 'AUTHENTIC' : 'FORGED';
        }
        for (const e of this.enemies) if (e.alive) this.applyMark(e, 0.25, 6, 0);
        break;
      case 'jp':
        this.resolve += 3;
        break;
    }
    this.ale -= this.kingCost(id);
    this.kingState[id].cd = k.cd;
    if (k.once) this.kingState[id].used = true;
    this.emit('msg', `${k.name}: ${k.ability}!`);
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
      if (!best || dist < best.dist) best = { x: out.x, y: out.y, dist };
    }
    return best;
  }

  // ---------------------------------------------------------------- enemies
  spawnEnemy(type, pathId, d0, waveN, aw) {
    const def = ENEMIES[type];
    const e = this.enemyPool.pop() || {};
    const scale = def.boss ? 1 : hpMult(waveN);
    const hp = def.hp * scale * (1 + this.mods.enemyHp);
    Object.assign(e, {
      uid: this.uid++, type, def, path: this.map.paths[pathId], d: d0, x: 0, y: 0,
      hp, maxHp: hp, shield: 0, maxShield: 0, armor: def.armor, alive: true,
      slowAmt: 0, slowT: 0, slowImmuneT: 0, burnDps: 0, burnT: 0, burnVuln: 0, burnSrc: null,
      mark: 0, markT: 0, markBounty: 0, revealedT: 0, stunT: 0, cleansed: false,
      untargetable: false, auraT: this.rng.range(0, 1), tickT: 0, sabotaged: 0, sabotagedIds: [],
      district: -1, aw, waveN, phase: 0, phaseT: 0, turnT: 0, summonT: 0, lineT: 0,
    });
    e.path.posAt(e.d, e);
    if (aw) aw.alive++;
    this.enemies.push(e);
    if (def.boss) {
      this.boss = e;
      e.untargetable = true;
      e.phase = 1;
      this.emit('bbl', PLINKET_P1_LINES[0]);
    }
    return e;
  }

  applySlow(e, amt, dur) {
    if (e.slowImmuneT > 0) return;
    if (e.def.heavy) amt *= 0.5;
    amt = Math.min(0.7, amt);
    if (e.slowT <= 0 || amt > e.slowAmt) e.slowAmt = amt;
    e.slowT = Math.max(e.slowT, dur);
  }

  applyBurn(e, dps, dur, src) {
    if (e.burnT <= 0 || dps >= e.burnDps) { e.burnDps = dps; e.burnSrc = src; }
    e.burnT = Math.max(e.burnT, dur);
    if (src && src.s.burnVuln) e.burnVuln = Math.max(e.burnVuln, src.s.burnVuln);
  }

  applyMark(e, amt, dur, bounty) {
    if (e.markT <= 0 || amt >= e.mark) e.mark = amt;
    e.markT = Math.max(e.markT, dur);
    if (bounty) e.markBounty = Math.max(e.markBounty, bounty);
  }

  knockback(e, px) {
    if (e.def.heavy) return;
    e.d = Math.max(0, e.d - px);
  }

  visible(e) {
    return !e.def.invisible || e.revealedT > 0 || this.mods.revealAll;
  }

  damage(e, amount, src, o = {}) {
    if (!e.alive || e.untargetable) return;
    let amt = amount * (1 + (e.markT > 0 ? e.mark : 0));
    if (e.burnT > 0 && e.burnVuln) amt *= 1 + e.burnVuln;
    if (!o.burn && !o.raw) {
      const armor = Math.max(0, e.armor - (o.pierce || 0));
      amt = Math.max(amt * 0.2, amt - armor);
    }
    if (e.shield > 0 && !o.raw) {
      const sb = o.shieldBreak || 1;
      const sd = amt * sb;
      if (sd <= e.shield) { e.shield -= sd; amt = 0; }
      else { amt = (sd - e.shield) / sb; e.shield = 0; }
    }
    const dealt = Math.min(e.hp, amt);
    e.hp -= amt;
    if (src) {
      src.dmg += dealt;
      this.stats.dmgByType[src.type] = (this.stats.dmgByType[src.type] || 0) + dealt;
    }
    if (e.def.cleanse && !e.cleansed && e.hp < e.maxHp / 2 && e.hp > 0) {
      e.cleansed = true;
      e.slowT = 0; e.burnT = 0; e.slowImmuneT = 3;
      this.fx({ kind: 'ring', x: e.x, y: e.y, r: 24, max: 0.4, color: '#ffffff' });
    }
    if (e.hp <= 0) this.kill(e, src);
  }

  kill(e, src) {
    if (!e.alive) return;
    e.alive = false;
    e.hp = 0;
    const bounty = Math.round(e.def.bounty * (1 + 0.02 * e.waveN) * (1 + this.mods.bountyMult) * (1 + (e.markT > 0 ? e.markBounty : 0)));
    this.gold += bounty;
    this.stats.goldEarned += bounty;
    this.stats.kills++;
    if (src) src.kills++;
    if (e.aw) e.aw.alive--;
    this.fx({ kind: 'burst', x: e.x, y: e.y, r: e.def.size + 6, max: 0.3, color: e.def.color });
    const blast = e.def.deathBlast;
    if (blast) {
      for (const t of this.towers) {
        if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= blast.range ** 2) t.disabledT = Math.max(t.disabledT, blast.dur);
      }
      this.fx({ kind: 'ring', x: e.x, y: e.y, r: blast.range, max: 0.5, color: '#ff9b3d' });
    }
    const split = e.def.split;
    if (split) {
      for (let i = 0; i < split.count; i++) {
        this.spawnBuffer.push({ type: split.type, path: e.path.id, d0: Math.max(0, e.d - 16 * i), waveN: e.waveN, aw: e.aw });
      }
    }
    if (e.def.boss) {
      this.boss = null;
      this.emit('msg', 'Susan Plinket has fallen.');
    }
  }

  leak(e) {
    e.alive = false;
    if (e.aw) e.aw.alive--;
    if (this.invincible) return;
    this.leakCount++;
    this.stats.leaks++;
    this.leakLog.push({ t: this.time, wave: this.wave, type: e.type, path: e.path.id, hp: Math.round(e.hp) });
    if (this.leakCount === 1) this.emit('bbl', BBL.firstLeak);
    let cost = e.def.boss ? this.resolve : e.def.leak;
    if (this.mods.leakTax && this.leakCount % 3 === 0) cost++;
    this.resolve -= cost;
    if (e.def.steal) {
      const s = Math.floor(Math.max(0, this.gold) * e.def.steal);
      this.gold -= s;
      this.emit('msg', `The Bagman made it through. −${s}g from the Treasury.`);
    }
    this.addMoraleAll(-3);
    this.fx({ kind: 'flash', x: W - 60, y: H - 140, r: 0, max: 0.3, color: '#ff3030' });
    if (e.def.boss) this.emit('msg', 'Susan Plinket has reached the castle.');
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    if (this.over || this.pendingDoctrine) return;
    this.time += dt;

    // spawning
    for (const aw of this.activeWaves) {
      aw.t += dt;
      while (aw.qi < aw.queue.length && aw.queue[aw.qi].t <= aw.t) {
        const s = aw.queue[aw.qi++];
        this.spawnEnemy(s.type, s.path, s.d0, aw.n, aw);
      }
    }

    // timers
    for (const k in this.kingState) this.kingState[k].cd = Math.max(0, this.kingState[k].cd - dt);
    if (this.chugT > 0) { this.chugT -= dt; if (this.chugT <= 0) this.hangoverT = 6; }
    else if (this.hangoverT > 0) this.hangoverT -= dt;
    for (let i = this.barricades.length - 1; i >= 0; i--) if ((this.barricades[i].t -= dt) <= 0) this.barricades.splice(i, 1);

    // spatial
    this.spatial.clear();
    for (const e of this.enemies) if (e.alive) this.spatial.insert(e);

    this.auraT -= dt;
    if (this.auraT <= 0) { this.auraT += AURA_TICK; this.auraTick(); }

    for (const e of this.enemies) if (e.alive) this.updateEnemy(e, dt);
    for (const t of this.towers) this.updateTower(t, dt);
    this.updateProjectiles(dt);
    if (this.boss && this.boss.alive) this.updateBoss(this.boss, dt);

    // compact enemies, flush spawn buffer
    let j = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.alive) this.enemies[j++] = e;
      else { e.aw = null; e.burnSrc = null; this.enemyPool.push(e); }
    }
    this.enemies.length = j;
    if (this.spawnBuffer.length) {
      for (const s of this.spawnBuffer) this.spawnEnemy(s.type, s.path, s.d0, s.waveN, s.aw);
      this.spawnBuffer.length = 0;
    }

    // effects
    let k = 0;
    for (const f of this.effects) if ((f.t += dt) < f.max) this.effects[k++] = f;
    this.effects.length = k;

    if (this.resolve <= 0 && !this.over) {
      this.resolve = 0;
      this.over = true;
      this.emit('defeat', 'The castle has fallen.');
      return;
    }

    // wave completion
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
    for (const t of this.towers) { t.auraRate = 0; t.auraDmg = 0; }
    this.turnedTowers.length = 0;
    for (const t of this.towers) {
      const a = t.s.aura;
      if (a && t.disabledT <= 0 && t.turnedT <= 0) {
        const r2 = a.range * a.range;
        for (const o of this.towers) {
          if ((o.x - t.x) ** 2 + (o.y - t.y) ** 2 <= r2) {
            o.auraRate = Math.max(o.auraRate, a.rate);
            o.auraDmg = Math.max(o.auraDmg, a.dmg);
          }
        }
      }
      if (t.s.detectRange && t.disabledT <= 0 && t.turnedT <= 0) {
        this.spatial.query(t.x, t.y, t.s.detectRange, (e) => { if (e.def.invisible) e.revealedT = AURA_TICK * 2; });
      }
      if (t.turnedT > 0) this.turnedTowers.push(t);
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const def = e.def;
      if (def.soberAura) {
        const r2 = def.soberAura * def.soberAura;
        for (const t of this.towers) if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= r2) t.soberT = AURA_TICK * 2;
      }
    }
    for (let i = 0; i < DISTRICTS.length; i++) {
      if (this.morale[i] < this.mods.moraleThreshold && !this.insurgentFlag[i] && this.activeWaves.length) {
        this.emit('bbl', BBL.lowMorale(DISTRICTS[i].name));
        this.raiseInsurgency(i);
      }
    }
  }

  updateEnemy(e, dt) {
    const def = e.def;
    if (e.slowT > 0) e.slowT -= dt;
    if (e.slowImmuneT > 0) e.slowImmuneT -= dt;
    if (e.markT > 0) e.markT -= dt;
    if (e.revealedT > 0) e.revealedT -= dt;
    if (e.stunT > 0) e.stunT -= dt;

    if (e.burnT > 0) {
      e.burnT -= dt;
      this.damage(e, e.burnDps * dt, e.burnSrc, { burn: true });
      if (!e.alive) return;
    }
    if (this.mods.regen && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * this.mods.regen * dt);

    let speed = def.speed * (1 + this.mods.enemySpeed);
    if (e.phase === 3) speed *= 1.3;
    if (e.slowT > 0) speed *= 1 - e.slowAmt;
    if (e.stunT > 0 && !def.heavy) speed = 0;
    if (!def.boss) {
      for (const b of this.barricades) if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < 900) { speed = 0; break; }
    }
    if (speed > 0 && this.turnedTowers.length) {
      for (const t of this.turnedTowers) {
        if ((t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= (t.s.range || 120) ** 2) { speed *= 1.25; break; }
      }
    }
    e.d += speed * dt;
    if (e.d >= e.path.total) { this.leak(e); return; }
    e.path.posAt(e.d, e);
    e.district = this.map.districtAt(e.x, e.y);

    if (def.moraleDrain && e.district >= 0) this.addMorale(e.district, -def.moraleDrain * this.mods.pamphletMult * dt);

    e.auraT -= dt;
    if (def.shieldAura && e.auraT <= 0) {
      const sa = def.shieldAura;
      e.auraT = sa.every;
      const amount = sa.amount * hpMult(e.waveN);
      this.spatial.query(e.x, e.y, sa.range, (o) => {
        if (o.alive && o !== e && !o.def.boss) {
          o.maxShield = Math.max(o.maxShield, amount * 1.5);
          o.shield = Math.min(amount * 1.5, o.shield + amount);
        }
      });
    }

    if (def.sabotage && e.sabotaged < def.sabotage.max && !this.visible(e)) {
      e.tickT -= dt;
      if (e.tickT <= 0) {
        e.tickT = 0.2;
        const r2 = def.sabotage.range ** 2;
        for (const t of this.towers) {
          if (e.sabotaged >= def.sabotage.max) break;
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

  // ---------------------------------------------------------------- towers
  towerRate(t) {
    const sober = t.soberT > 0;
    let mult = 1;
    if (!sober) {
      mult += t.auraRate;
      if (this.chugT > 0) mult += 0.8;
    }
    if (this.hangoverT > 0) mult -= 0.4;
    if (sober && t.def.ale) mult *= 0.5;
    return t.s.rate * mult;
  }

  towerDmgMult(t) {
    return 1 + (t.soberT > 0 ? 0 : t.auraDmg) + (t.plinketBuffT > 0 ? 0.25 : 0);
  }

  acquire(t, range, n) {
    const s = t.s;
    const min2 = (s.minRange || 0) ** 2;
    const mode = t.mode;
    if (n === 1) {
      let best = null, bestScore = -Infinity;
      this.spatial.query(t.x, t.y, range, (e) => {
        if (!e.alive || e.untargetable || !this.visible(e)) return;
        if (min2 && (e.x - t.x) ** 2 + (e.y - t.y) ** 2 < min2) return;
        let score;
        if (mode === 'first') score = e.d - e.path.total;
        else if (mode === 'last') score = e.path.total - e.d;
        else if (mode === 'strong') score = e.hp + e.shield;
        else score = -((e.x - t.x) ** 2 + (e.y - t.y) ** 2);
        if (score > bestScore) { bestScore = score; best = e; }
      });
      return best;
    }
    const list = [];
    this.spatial.query(t.x, t.y, range, (e) => {
      if (e.alive && !e.untargetable && this.visible(e)) list.push(e);
    });
    list.sort((a, b) => (a.path.total - a.d) - (b.path.total - b.d));
    return list.slice(0, n);
  }

  updateTower(t, dt) {
    if (t.disabledT > 0) t.disabledT -= dt;
    if (t.soberT > 0) t.soberT -= dt;
    if (t.turnedT > 0) t.turnedT -= dt;
    if (t.plinketBuffT > 0) t.plinketBuffT -= dt;
    t.cd -= dt;
    if (t.cd > 0 || t.disabledT > 0 || t.turnedT > 0) return;
    const s = t.s;
    const rate = this.towerRate(t);
    if (rate <= 0) return;
    const dmgMult = this.towerDmgMult(t);

    switch (s.attack) {
      case 'global': {
        if (!this.enemies.length) return;
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (s.slow) this.applySlow(e, s.slow, s.slowDur);
          if (s.dmg) this.damage(e, s.dmg * dmgMult, t, { pierce: 99 });
          if (s.knockback && e.alive) this.knockback(e, s.knockback);
        }
        this.fx({ kind: 'flash', x: t.x, y: t.y, r: 0, max: 0.35, color: '#b58cd9' });
        break;
      }
      case 'pulse': {
        let hit = false;
        this.spatial.query(t.x, t.y, s.range, (e) => {
          if (!e.alive || e.untargetable || !this.visible(e)) return;
          hit = true;
          if (s.slow) this.applySlow(e, s.slow, s.slowDur);
          if (s.dmg) this.damage(e, s.dmg * dmgMult, t);
          if (s.stagger && e.alive && this.rng.chance(s.stagger)) this.knockback(e, 30);
        });
        if (!hit) return;
        this.fx({ kind: 'ring', x: t.x, y: t.y, r: s.range, max: 0.35, color: t.def.color });
        break;
      }
      case 'hitscan': {
        const targets = this.acquire(t, s.range, s.marks || 1);
        const list = Array.isArray(targets) ? targets : targets ? [targets] : [];
        if (!list.length) return;
        for (const e of list) {
          this.applyMark(e, s.mark, s.markDur, s.bountyBonus || 0);
          this.damage(e, s.dmg * dmgMult, t, { pierce: s.pierce });
          this.fx({ kind: 'beam', x: t.x, y: t.y, x2: e.x, y2: e.y, max: 0.15, color: t.def.color });
        }
        break;
      }
      default: {
        const e = this.acquire(t, s.range, 1);
        if (!e) return;
        this.fire(t, e, dmgMult);
      }
    }
    t.cd = 1 / rate;
  }

  fire(t, e, dmgMult) {
    const s = t.s;
    const p = this.projPool.pop() || {};
    Object.assign(p, {
      src: t, x: t.x, y: t.y, target: e, tuid: e.uid, tx: e.x, ty: e.y, speed: s.projSpeed || 500,
      dmg: s.dmg * dmgMult, pierce: s.pierce || 0, splash: s.splash || 0, burn: s.burn || 0, burnDur: s.burnDur || 0,
      kb: s.knockback || 0, stun: s.stun || 0, shieldBreak: s.shieldBreak || 1,
      kind: s.attack === 'splash' ? 'shell' : s.penetrate ? 'lance' : 'bullet',
      pen: s.penetrate || 0, hits: 0, hitIds: p.hitIds || [], travel: 0, maxTravel: s.range * 1.3, vx: 0, vy: 0,
      color: t.def.color,
    });
    p.hitIds.length = 0;
    if (p.kind === 'lance') {
      const dx = e.x - t.x, dy = e.y - t.y, len = Math.hypot(dx, dy) || 1;
      p.vx = (dx / len) * p.speed; p.vy = (dy / len) * p.speed;
    }
    this.projectiles.push(p);
  }

  updateProjectiles(dt) {
    let j = 0;
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (this.stepProjectile(p, dt)) this.projectiles[j++] = p;
      else { p.target = null; p.src = null; this.projPool.push(p); }
    }
    this.projectiles.length = j;
  }

  // returns true if still alive
  stepProjectile(p, dt) {
    const step = p.speed * dt;
    if (p.kind === 'lance') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.travel += step;
      this.spatial.query(p.x, p.y, 14, (e) => {
        if (!e.alive || e.untargetable || !this.visible(e) || p.hitIds.includes(e.uid)) return;
        p.hitIds.push(e.uid);
        this.damage(e, p.dmg, p.src, { pierce: p.pierce, shieldBreak: p.shieldBreak });
        p.hits++;
        return p.hits >= p.pen;
      });
      return p.hits < p.pen && p.travel < p.maxTravel && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20;
    }
    const tgt = p.target;
    const live = tgt && tgt.alive && tgt.uid === p.tuid;
    if (live && p.kind === 'bullet') { p.tx = tgt.x; p.ty = tgt.y; }
    const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
    if (dist > step) { p.x += (dx / dist) * step; p.y += (dy / dist) * step; return true; }
    p.x = p.tx; p.y = p.ty;

    if (p.kind === 'shell') {
      this.spatial.query(p.x, p.y, p.splash, (e) => {
        if (!e.alive || e.untargetable) return;
        this.damage(e, p.dmg, p.src, { pierce: p.pierce });
        if (e.alive && p.kb) this.knockback(e, p.kb);
        if (e.alive && p.stun && !e.def.heavy) e.stunT = Math.max(e.stunT, p.stun);
      });
      this.fx({ kind: 'ring', x: p.x, y: p.y, r: p.splash, max: 0.3, color: p.color });
      return false;
    }
    // bullet
    if (!live) return false;
    const src = p.src;
    this.damage(tgt, p.dmg, src, { pierce: p.pierce, shieldBreak: p.shieldBreak });
    if (p.burn) {
      if (p.splash) {
        this.spatial.query(p.x, p.y, p.splash, (e) => { if (e.alive && !e.untargetable) this.applyBurn(e, p.burn, p.burnDur, src); });
        this.fx({ kind: 'ring', x: p.x, y: p.y, r: p.splash, max: 0.3, color: p.color });
      } else if (tgt.alive) this.applyBurn(tgt, p.burn, p.burnDur, src);
    }
    return false;
  }

  // ---------------------------------------------------------------- boss
  updateBoss(b, dt) {
    b.phaseT += dt;
    const progress = b.d / b.path.total;
    if (b.phase === 1) {
      const r2 = 170 * 170;
      for (const t of this.towers) {
        if ((t.x - b.x) ** 2 + (t.y - b.y) ** 2 <= r2) { t.plinketBuffT = 0.5; t.plinketMarked = true; }
      }
      b.lineT += dt;
      if (b.lineT > 9) { b.lineT = 0; this.emit('bbl', this.rng.pick(PLINKET_P1_LINES)); }
      if (b.phaseT >= 28 || progress >= 0.35) {
        b.phase = 2; b.phaseT = 0;
        b.untargetable = false;
        b.shield = b.maxShield = 4500 * (1 + this.mods.enemyHp);
        this.emit('bbl', BBL.bossP2);
        this.emit('boss', 'JR UNMASKED', { phase: 2 });
      }
    } else if (b.phase === 2) {
      b.turnT += dt;
      if (b.turnT >= 3.5) {
        b.turnT = 0;
        const marked = this.towers.filter((t) => t.plinketMarked && t.turnedT <= 0);
        if (marked.length) {
          const t = this.rng.pick(marked);
          t.turnedT = 8;
          this.fx({ kind: 'ring', x: t.x, y: t.y, r: 24, max: 0.8, color: '#ff5fb0' });
        }
      }
      b.summonT += dt;
      if (b.summonT >= 7) { b.summonT = 0; this.summon(b, [['insurgent', 5]]); }
      if (b.shield <= 0 || progress >= 0.7) {
        b.phase = 3; b.phaseT = 0; b.shield = 0; b.summonT = 0;
        this.emit('bbl', BBL.bossP3);
        this.emit('boss', 'SUSAN PLINKET, MAMA', { phase: 3 });
      }
    } else if (b.phase === 3) {
      b.summonT += dt;
      if (b.summonT >= 9) { b.summonT = 0; this.summon(b, [['believer', 2], ['zealot', 4]]); }
    }
  }

  summon(b, groups) {
    for (const [type, count] of groups) {
      for (let i = 0; i < count; i++) {
        this.spawnBuffer.push({ type, path: b.path.id, d0: Math.max(0, b.d - 20 - i * 10), waveN: BOSS_WAVE, aw: b.aw });
      }
    }
    this.fx({ kind: 'ring', x: b.x, y: b.y, r: 50, max: 0.5, color: '#ff5fb0' });
  }

  // ---------------------------------------------------------------- summary
  summary() {
    return {
      seed: this.seed, wave: this.wave, won: this.won, resolve: this.resolve, kills: this.stats.kills,
      leaks: this.stats.leaks, goldEarned: this.stats.goldEarned, doctrines: this.doctrines.slice(),
      mandates: this.mandates.slice(), kings: this.kings.slice(), towers: this.towers.length,
      heat: this.mandates.length, time: Math.round(this.time),
    };
  }
}
