// Scripted player used by the headless simulator (tools/sim.mjs) and the in-game
// debug "autoplay". A build is a JSON policy:
//   plan:      ordered steps, executed whenever affordable (never skipped unless impossible):
//              {"build":"pike"} | {"up":"keg","path":0} (least-upgraded keg +1) |
//              {"up":"keg","path":0,"to":3} (one keg up to tier 3) | {"hero":true} | {"item":"caltrops"}
//   reserve:   gold kept back for interest from `reserveFromWave`
//   bonds:     waves before which to issue one bond
//   doctrines: preference order
//   abilities: use hero/tower abilities heuristically (default true)
import { TOWERS } from '../data/towers.js';
import { ENEMIES, MODIFIERS } from '../data/enemies.js';
import { COLS, ROWS, TILE } from './map.js';
import { wavePreview } from './waves.js';

export class Bot {
  constructor(world, build) {
    this.w = world;
    this.b = build;
    this.step = 0;
    this.thinkT = 0;
    this.coverage = {};
  }

  scoreTiles(range, on, minRange = 0) {
    const key = `${range}|${on}|${this.w.activePaths.join('')}`;
    if (this.coverage[key]) return this.coverage[key];
    const samples = [];
    const out = { x: 0, y: 0 };
    for (const id of this.w.activePaths) {
      const p = this.w.map.paths[id];
      for (let d = 0; d < p.total; d += 12) {
        p.posAt(d, out);
        samples.push({ x: out.x, y: out.y, wgt: 0.6 + d / p.total });
      }
    }
    const scores = [];
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      if (!this.w.map.buildable(tx, ty, on)) continue;
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      let s = 0;
      for (const p of samples) {
        const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d2 <= range * range && d2 >= minRange * minRange) s += p.wgt;
      }
      scores.push({ tx, ty, s });
    }
    scores.sort((a, b) => b.s - a.s);
    return (this.coverage[key] = scores);
  }

  bestTile(type) {
    const def = TOWERS[type];
    const s = def.base;
    const on = def.water ? 'water' : 'land';
    if (s.kind === 'aura') { // Garrison: where the most towers are
      let best = null;
      for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
        if (!this.w.map.buildable(tx, ty, on) || this.w.towerAt(tx, ty)) continue;
        const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
        const n = this.w.towers.filter((t) => (t.x - x) ** 2 + (t.y - y) ** 2 <= s.range * s.range).length;
        if (!best || n > best.n) best = { tx, ty, n };
      }
      return best;
    }
    const range = s.kind === 'farm' || s.kind === 'global' || s.kind === 'mortar' || s.kind === 'orbit' ? 40 : s.range;
    const list = this.scoreTiles(range, on);
    const pick = s.kind === 'farm' || s.kind === 'global' || s.kind === 'orbit' ? [...list].reverse() : list;
    for (const c of pick) if (!this.w.towerAt(c.tx, c.ty)) return c;
    return null;
  }

  // What a sensible player does after reading the next-wave preview: make sure
  // something can see Hidden and something can hurt Armored before it arrives.
  counterStep() {
    const w = this.w;
    const { counts, mods } = wavePreview(w.wave + 1, w.seed, w.waveOverride);
    const has = (trait) => mods.includes(trait) || Object.keys(counts).some((k) => ENEMIES[k]?.traits.includes(trait));
    const tw = w.towers;
    if (has('hidden') && !tw.some((t) => t.s.detect || t.s.reveal)) {
      const bow = tw.find((t) => t.type === 'bow' && !w.upgradeBlock(t, 1) && t.tiers[1] === 0);
      if (bow) return { up: 'bow', path: 1, counter: true };
      if (w.towerAvailable('light')) return { build: 'light', counter: true };
      if (w.towerAvailable('scout')) return { build: 'scout', counter: true };
      const pike = tw.find((t) => t.type === 'pike' && t.tiers[0] < 2 && !w.upgradeBlock(t, 0));
      if (pike) return { up: 'pike', path: 0, counter: true };
      return { build: 'bow', counter: true };
    }
    if (has('armored') && !tw.some((t) => t.s.shred || (t.s.dtype && t.s.dtype !== 'sharp' && t.s.dtype !== 'none' && t.s.dmg > 0))) {
      return { build: 'keg', counter: true };
    }
    return null;
  }

  reserve() { return this.w.wave >= (this.b.reserveFromWave || 0) ? this.b.reserve || 0 : 0; }

  // plan steps advance the plan; counter steps don't (and give up quietly)
  advance(st) {
    if (st.counter) return false;
    this.step++;
    return true;
  }

  tryStep() {
    const w = this.w;
    const counter = this.counterStep();
    const st = counter || this.b.plan[this.step];
    if (!st) return false;
    const reserve = this.reserve();
    if (st.build) {
      const def = TOWERS[st.build];
      if (!def) { return this.advance(st); }
      if (!w.unlocks.towers.includes(st.build) && !def.unlock.wave) { return this.advance(st); } // never available
      if (!w.towerAvailable(st.build)) return false; // mid-run unlock: wait for it
      if (w.gold - w.cost(def.cost) < reserve) return false;
      const tile = this.bestTile(st.build);
      if (!tile) { return this.advance(st); }
      const why = w.canPlace(st.build, tile.tx, tile.ty);
      if (why === 'ale' || why === 'water' || why === 'blocked') { return this.advance(st); }
      if (why) return false;
      w.placeTower(st.build, tile.tx, tile.ty);
    } else if (st.up && st.to) {
      // take one tower of this type up to tier `to` (deepest first)
      const mine = w.towers.filter((t) => t.type === st.up);
      if (mine.some((t) => t.tiers[st.path] >= st.to)) return this.advance(st);
      const cands = mine.filter((t) => !w.upgradeBlock(t, st.path));
      if (!cands.length) return this.advance(st);
      cands.sort((a, b) => b.tiers[st.path] - a.tiers[st.path] || b.invested - a.invested);
      const t = cands[0];
      if (w.gold - w.upgradeCost(t, st.path) < reserve) return false;
      w.upgrade(t, st.path);
      return true;
    } else if (st.up) {
      const cands = w.towers.filter((t) => t.type === st.up && !w.upgradeBlock(t, st.path));
      if (!cands.length) { return this.advance(st); }
      cands.sort((a, b) => a.tiers[st.path] - b.tiers[st.path]);
      const t = cands[0];
      const c = w.upgradeCost(t, st.path);
      if (w.gold - c < reserve) return false;
      w.upgrade(t, st.path);
    } else if (st.hero) {
      if (!w.heroId || w.hero) { return this.advance(st); }
      if (w.gold < 250) return false;
      const list = this.scoreTiles(130, 'land');
      const tile = list.find((c) => !w.towerAt(c.tx, c.ty));
      if (!tile) { return this.advance(st); }
      w.placeHero(tile.tx, tile.ty);
    } else if (st.item) {
      if (!w.activeWaves.length) return false;
      const lane = w.map.paths[w.activePaths[0]];
      const o = { x: 0, y: 0 };
      lane.posAt(lane.total * 0.85, o);
      if (w.canPlaceItem(st.item, o.x, o.y)) { if (w.canPlaceItem(st.item, o.x, o.y) === 'limit' || w.ale < 30) return false; return this.advance(st); }
      w.placeItem(st.item, o.x, o.y);
    }
    if (!st.counter) this.step++;
    return true;
  }

  think(dt) {
    const w = this.w;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 0.5;
    if (w.pendingDoctrine) {
      const pref = this.b.doctrines || [];
      w.pickDoctrine(pref.find((d) => w.pendingDoctrine.includes(d)) || w.pendingDoctrine[0]);
    }
    if (w.won && !w.freeplay && this.b.freeplay) w.continueFreeplay();
    if (this.step >= this.b.plan.length && this.b.loop) this.step = this.b.loop;
    let guard = 0;
    while (guard++ < 20 && this.tryStep());
    if (this.b.abilities !== false) this.useAbilities();
    if (w.canSendWave() && w.activeWaves.length === 0) {
      if ((this.b.bonds || []).includes(w.wave + 1)) w.issueBond();
      w.sendWave();
    }
  }

  useAbilities() {
    const w = this.w;
    const alive = w.enemies.filter((e) => e.alive && !e.untargetable);
    if (!alive.length) return;
    const danger = alive.some((e) => e.d / e.path.total > 0.75) || alive.some((e) => e.boss);
    for (const { t, a, cd } of w.abilityList()) {
      if (cd > 0) continue;
      if (a.id === 'barricade') {
        const e = alive.reduce((x, y) => (y.d / y.path.total > x.d / x.path.total ? y : x));
        if (danger) w.useAbility(t, a.id, { x: e.x, y: e.y });
      } else if (a.id === 'spill') { if (w.resolve <= 12) w.useAbility(t, a.id); }
      else if (a.id === 'supply' || a.id === 'mercantile' || a.id === 'ledger') w.useAbility(t, a.id);
      else if (danger || alive.length > 25) w.useAbility(t, a.id);
    }
  }
}
