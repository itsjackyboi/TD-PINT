// Scripted player used by the headless simulator (tools/sim.mjs) and the in-game
// debug "autoplay". A build is a JSON policy:
//   plan:      ordered steps — {"build":"pike"} or {"up":"bow","branch":0}
//              executed in order whenever affordable (steps never skipped)
//   reserve:   gold the bot refuses to spend below (interest farming)
//   bonds:     waves at which to issue one bond before sending
//   doctrines: preference order for doctrine picks
//   kings:     use Liquor King abilities heuristically (true/false)
import { TOWERS } from '../data/towers.js';
import { COLS, ROWS, TILE } from './map.js';

export class Bot {
  constructor(world, build) {
    this.w = world;
    this.b = build;
    this.step = 0;
    this.thinkT = 0;
    this.coverage = {};
  }

  // number of path samples each tile covers for a given range band
  scoreTiles(range, minRange = 0) {
    const key = `${range}|${minRange}|${this.w.activePaths.join('')}`;
    if (this.coverage[key]) return this.coverage[key];
    const samples = [];
    const out = { x: 0, y: 0 };
    for (const id of this.w.activePaths) {
      const p = this.w.map.paths[id];
      for (let d = 0; d < p.total; d += 12) {
        p.posAt(d, out);
        // later path = closer to castle = more valuable
        samples.push({ x: out.x, y: out.y, wgt: 0.6 + d / p.total });
      }
    }
    const scores = [];
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      if (!this.w.map.buildable(tx, ty)) continue;
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
    const s = TOWERS[type].base;
    const range = s.attack === 'global' ? 60 : s.range;
    for (const c of this.scoreTiles(range, s.minRange || 0)) {
      if (!this.w.towerAt(c.tx, c.ty)) return c;
    }
    return null;
  }

  tryStep() {
    const w = this.w;
    const st = this.b.plan[this.step];
    if (!st) return false;
    const reserve = this.w.wave >= (this.b.reserveFromWave || 0) ? this.b.reserve || 0 : 0;
    if (st.build) {
      const def = TOWERS[st.build];
      if (w.gold - w.cost(def.cost) < reserve) return false;
      const tile = this.bestTile(st.build);
      if (!tile) return false;
      const why = w.canPlace(st.build, tile.tx, tile.ty);
      if (why === 'ale' || why === 'locked' || why === 'max') { this.step++; return true; } // skip, don't stall
      if (why) return false;
      w.placeTower(st.build, tile.tx, tile.ty);
    } else if (st.up) {
      const cands = w.towers.filter((t) => t.type === st.up && t.tier < 3 && (t.branch == null || t.branch === st.branch));
      if (!cands.length) { this.step++; return true; }
      cands.sort((a, b) => a.tier - b.tier);
      const t = cands[0];
      const c = w.upgradeCost(t, st.branch);
      if (c == null || w.gold - c < reserve) return false;
      w.upgrade(t, st.branch);
    }
    this.step++;
    return true;
  }

  think(dt) {
    const w = this.w;
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 0.5;
    if (w.pendingDoctrine) {
      const pref = this.b.doctrines || [];
      const pick = pref.find((d) => w.pendingDoctrine.includes(d)) || w.pendingDoctrine[0];
      w.pickDoctrine(pick);
    }
    while (this.tryStep());
    if (this.b.kings !== false) this.useKings();
    if (w.canSendWave() && w.activeWaves.length === 0) {
      if ((this.b.bonds || []).includes(w.wave + 1)) w.issueBond();
      while (this.tryStep());
      w.sendWave();
    }
  }

  useKings() {
    const w = this.w;
    const alive = w.enemies.filter((e) => e.alive && !e.untargetable);
    const danger = alive.some((e) => e.d / e.path.total > 0.8);
    for (const k of w.kings) {
      if (!w.kingReady(k)) continue;
      if (k === 'seamus' && (alive.length >= 18 || danger)) w.useKing(k);
      else if (k === 'buke' && alive.length >= 22) w.useKing(k);
      else if (k === 'guinnie' && alive.some((e) => e.def.elite)) w.useKing(k);
      else if (k === 'jp' && w.resolve <= 8) w.useKing(k);
      else if (k === 'jack' && alive.length >= 15) w.useKing(k);
      else if (k === 'jagerbauhm' && danger) {
        const e = alive.reduce((a, b) => (b.d / b.path.total > a.d / a.path.total ? b : a));
        w.useKing(k, { x: e.x, y: e.y });
      }
    }
  }
}
