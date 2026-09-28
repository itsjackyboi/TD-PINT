// Canvas renderer. Reads world state; never mutates it.
import { TILE, COLS, ROWS, W, H } from '../core/map.js';
import { TOWERS } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEMS } from '../data/items.js';
import { HEROES } from '../data/heroes.js';
import { sprites } from './sprites.js';
import * as px from './pixelart.js';

const MAX_ZOOM = 3;

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.bg = null;
    this.bgKey = '';
    this.cam = { z: 1, x: W / 2, y: H / 2 };
    this.cssW = 0; this.cssH = 0; this.dpr = 1; this.fit = 1;
    this.drawList = [];
  }

  layout() {
    const cw = this.c.clientWidth || W, ch = this.c.clientHeight || H;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cw !== this.cssW || ch !== this.cssH || dpr !== this.dpr) {
      this.cssW = cw; this.cssH = ch; this.dpr = dpr;
      this.c.width = Math.round(cw * dpr);
      this.c.height = Math.round(ch * dpr);
      this.fit = Math.min(cw / W, ch / H);
      this.clamp();
    }
  }

  scale() { return this.fit * this.cam.z; }

  clamp() {
    const s = this.scale();
    const hw = this.cssW / (2 * s), hh = this.cssH / (2 * s);
    this.cam.x = hw >= W / 2 ? W / 2 : Math.max(hw, Math.min(W - hw, this.cam.x));
    this.cam.y = hh >= H / 2 ? H / 2 : Math.max(hh, Math.min(H - hh, this.cam.y));
  }

  toWorld(clientX, clientY) {
    const r = this.c.getBoundingClientRect();
    const s = this.scale();
    return { x: (clientX - r.left - this.cssW / 2) / s + this.cam.x, y: (clientY - r.top - this.cssH / 2) / s + this.cam.y };
  }

  // world -> client coordinates (for DOM overlays such as tutorial pointers)
  toClient(x, y) {
    const r = this.c.getBoundingClientRect();
    const s = this.scale();
    return { x: (x - this.cam.x) * s + this.cssW / 2 + r.left, y: (y - this.cam.y) * s + this.cssH / 2 + r.top };
  }

  zoomAt(factor, clientX, clientY) {
    const before = this.toWorld(clientX, clientY);
    this.cam.z = Math.max(1, Math.min(MAX_ZOOM, this.cam.z * factor));
    const after = this.toWorld(clientX, clientY);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clamp();
  }

  panBy(dxClient, dyClient) {
    const s = this.scale();
    this.cam.x -= dxClient / s;
    this.cam.y -= dyClient / s;
    this.clamp();
  }

  resetView() { this.cam.z = 1; this.cam.x = W / 2; this.cam.y = H / 2; this.clamp(); }

  key(world) { return `${world.mapId}|${world.activePaths.join('')}|${sprites.ready ? 'px' : 'geo'}`; }

  buildBackground(world) {
    this.bgKey = this.key(world);
    this.pixel = sprites.ready;
    if (sprites.ready) { this.bg = px.buildPixelBackground(world); return; }
    // plain fallback while (or if) the sprite sheets can't load
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const g = off.getContext('2d');
    const map = world.map;
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      const i = ty * COLS + tx;
      g.fillStyle = map.terrain[i] === 0 ? '#1d3a4a' : map.blocked[i] ? '#4a4038' : '#3e4a2a';
      if (map.anyPath[i] && world.activePaths.some((id) => map.pathTile[id][i])) g.fillStyle = '#7a6040';
      if (map.isCastle(tx, ty)) g.fillStyle = '#6a6a6a';
      g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
    this.bg = off;
  }

  draw(world, ui) {
    const g = this.g;
    this.layout();
    if (!this.bg || this.bgKey !== this.key(world)) this.buildBackground(world);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0907';
    g.fillRect(0, 0, this.c.width, this.c.height);
    const s = this.scale() * this.dpr;
    g.setTransform(s, 0, 0, s, this.dpr * (this.cssW / 2) - this.cam.x * s, this.dpr * (this.cssH / 2) - this.cam.y * s);
    g.imageSmoothingEnabled = !this.pixel;
    g.drawImage(this.bg, 0, 0, W, H);
    const t = performance.now() / 1000;

    // districts about to revolt pulse pink
    world.map.districts.forEach((d, i) => {
      if (world.morale[i] < world.mods.moraleThreshold + 10) {
        const [x0, y0, x1, y1] = d.rect;
        g.fillStyle = `rgba(194,59,138,${0.08 + 0.05 * Math.sin(t * 3)})`;
        g.fillRect(x0 * TILE, y0 * TILE, (x1 - x0) * TILE, (y1 - y0) * TILE);
      }
    });
    if (world.timers.flood > 0) {
      g.fillStyle = `rgba(110,170,220,${0.12 + 0.04 * Math.sin(t * 4)})`;
      for (let i = 0; i < world.map.anyPath.length; i++) if (world.map.anyPath[i]) g.fillRect((i % COLS) * TILE, Math.floor(i / COLS) * TILE, TILE, TILE);
    }
    if (world.timers.hallowed > 0 && world.hallowed) {
      g.fillStyle = 'rgba(255,240,170,0.12)'; g.beginPath(); g.arc(world.hallowed.x, world.hallowed.y, world.hallowed.r, 0, 7); g.fill();
    }
    if (ui.placing || ui.placingHero) this.buildGrid(world, ui.placing ? TOWERS[ui.placing].water : false);

    for (const it of world.items) this.pixel ? px.drawItem(g, it, t) : this.dot(it.x, it.y, 6, ITEMS[it.type]?.color || '#aaa');
    for (const b of world.barricades) px.drawBarricade(g, b);

    const sel = ui.selected && world.towers.includes(ui.selected) ? ui.selected : null;
    if (sel) this.rangeRing(sel, sel.s.kind === 'aura' || sel.s.auraRange ? '#ffd35a' : '#ffe08a');

    const list = this.drawList;
    list.length = 0;
    for (const tw of world.towers) list.push(tw);
    for (const e of world.enemies) if (e.alive) list.push(e);
    list.sort((a, b) => (a.tx != null ? (a.ty + 1) * TILE : a.y + 12) - (b.tx != null ? (b.ty + 1) * TILE : b.y + 12));
    for (const o of list) {
      if (o.tx != null) this.tower(o, world, t, sel === o);
      else if (this.pixel) px.drawEnemy(g, o, world, t, ui.hoverEnemy === o, true);
      else this.dot(o.x, o.y, o.def.size, world.visible(o) ? '#d05050' : 'rgba(200,200,200,0.3)');
    }
    px.pruneEnemyMemory(t);
    for (const tw of world.towers) if (tw.type === 'cloud' && this.pixel) px.drawPlane(g, tw, t);

    this.placementGhost(world, ui, t);

    for (const p of world.projectiles) this.pixel ? px.drawProjectile(g, p, t) : this.dot(p.x, p.y, 2, p.color || '#fff');
    for (const f of world.effects) px.drawEffect(g, f);

    // aim point for Mortar / Repeater
    if (sel && (sel.s.kind === 'mortar' || sel.s.kind === 'repeater')) this.crosshair(sel.aim || (sel.s.kind === 'mortar' ? world.defaultAim() : null), ui.aiming === sel);
    if (ui.aiming && ui.mouse) this.crosshair(ui.mouse, true);
    // targeted ability or road item under the cursor
    if (ui.targeting && ui.mouse) this.targetPreview(world, ui);

    if (this.pixel) this.labels(world);

    const f = this.fit * this.dpr;
    g.setTransform(f, 0, 0, f, this.dpr * (this.cssW / 2) - (W / 2) * f, this.dpr * (this.cssH / 2) - (H / 2) * f);
    if (this.pixel) px.vignette(g);
    const boss = world.boss?.alive ? world.boss : world.enemies.find((e) => e.alive && e.boss);
    if (boss) this.bossBar(boss);
    this.timersText(world);
  }

  tower(tw, world, t, selected) {
    const g = this.g;
    const x = tw.tx * TILE, y = tw.ty * TILE;
    if (selected) { g.strokeStyle = '#ffe08a'; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4); g.lineWidth = 1; }
    if (!this.pixel) { this.dot(tw.x, tw.y, 14, tw.hero ? '#ffd35a' : tw.def.color); return; }
    const dim = tw.disabledT > 0 || tw.turnedT > 0;
    if (dim) g.globalAlpha = 0.55;
    if (tw.hero) px.drawTower(g, 'hero', x, y, [0, 0], t, { heroId: tw.heroId, level: tw.level });
    else px.drawTower(g, tw.type, x, y, tw.tiers, t);
    g.globalAlpha = 1;
    if (tw.soberT > 0) {
      g.fillStyle = '#9fd8ff'; g.font = '18px "Kenney Pixel", monospace';
      g.fillText('z', x + 26, y - 4 - ((t * 1.5) % 1) * 8);
    }
    if (tw.disabledT > 0) {
      g.fillStyle = '#ffb03d';
      for (let i = 0; i < 3; i++) g.fillRect(x + 8 + ((t * 40 + i * 11) % 24), y + 4 + ((i * 7 + t * 30) % 20), 3, 3);
    }
    if (tw.turnedT > 0) {
      g.strokeStyle = '#ff5fb0'; g.lineWidth = 2; g.setLineDash([4, 3]);
      g.beginPath(); g.arc(tw.x, tw.y, 22 + Math.sin(t * 8) * 2, 0, 7); g.stroke(); g.setLineDash([]); g.lineWidth = 1;
    }
    if (tw.tonicT > 0) { g.fillStyle = '#6fe06f'; g.fillRect(x + 32, y + 30, 4, 4); }
    // an ability is ready on this tower: a small pulsing star
    if ((tw.s.abilities || []).some((a) => !(tw.abilityT['cd_' + a.id] > 0))) {
      g.fillStyle = `rgba(255,211,90,${0.6 + 0.4 * Math.sin(t * 5)})`;
      g.fillRect(x + 2, y - 2, 5, 5);
    }
  }

  placementGhost(world, ui, t) {
    const g = this.g;
    if (!ui.hover || !(ui.placing || ui.placingHero)) return;
    const { tx, ty } = ui.hover;
    const cx = (tx + 0.5) * TILE, cy = (ty + 0.5) * TILE;
    let why, stats;
    if (ui.placingHero) {
      why = world.canPlaceHero(tx, ty);
      const h = HEROES[world.heroId];
      stats = { range: h.base.range, kind: h.base.kind, auraRange: h.base.auraRange };
    } else {
      why = world.canPlace(ui.placing, tx, ty);
      stats = TOWERS[ui.placing].base;
    }
    this.rangeRing({ x: cx, y: cy, s: stats, eff: { range: (stats.range || 0) * (1 + world.mods.rangeMult) } }, why ? '#ff5050' : '#7dff9a');
    if (!this.pixel) return;
    g.globalAlpha = 0.75;
    if (ui.placingHero) px.drawTower(g, 'hero', tx * TILE, ty * TILE, [0, 0], t, { heroId: world.heroId });
    else px.drawTower(g, ui.placing, tx * TILE, ty * TILE, [0, 0], t, { ghost: why ? 'rgba(255,60,60,0.45)' : null });
    g.globalAlpha = 1;
  }

  targetPreview(world, ui) {
    const g = this.g;
    const m = ui.mouse;
    const tg = ui.targeting;
    const p = world.nearestPathPoint(m.x, m.y);
    const ok = p && p.dist <= (tg.kind === 'item' ? 26 : 40);
    const at = ok ? p : m;
    if (tg.kind === 'item') {
      const it = ITEMS[tg.id];
      g.globalAlpha = 0.7;
      px.drawItem(g, { type: tg.id, x: at.x, y: at.y, hits: it.hits || 20, life: 12, radius: it.radius }, 0);
      g.globalAlpha = 1;
      if (it.blast) { g.strokeStyle = 'rgba(255,155,61,0.6)'; g.beginPath(); g.arc(at.x, at.y, it.blast, 0, 7); g.stroke(); }
    } else {
      g.globalAlpha = 0.7; px.drawBarricade(g, at); g.globalAlpha = 1;
    }
    g.strokeStyle = ok ? '#7dff9a' : '#ff5050';
    g.setLineDash([4, 4]); g.beginPath(); g.arc(at.x, at.y, 22, 0, 7); g.stroke(); g.setLineDash([]);
  }

  crosshair(p, live) {
    if (!p) return;
    const g = this.g;
    g.strokeStyle = live ? '#ffe08a' : 'rgba(255,90,90,0.9)'; g.lineWidth = 2;
    g.beginPath(); g.arc(p.x, p.y, 16, 0, 7);
    g.moveTo(p.x - 24, p.y); g.lineTo(p.x - 8, p.y); g.moveTo(p.x + 8, p.y); g.lineTo(p.x + 24, p.y);
    g.moveTo(p.x, p.y - 24); g.lineTo(p.x, p.y - 8); g.moveTo(p.x, p.y + 8); g.lineTo(p.x, p.y + 24);
    g.stroke(); g.lineWidth = 1;
  }

  dot(x, y, r, c) { const g = this.g; g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }

  buildGrid(world, water) {
    const g = this.g;
    g.strokeStyle = water ? 'rgba(160,220,255,0.25)' : 'rgba(255,255,255,0.10)';
    g.lineWidth = 1;
    g.beginPath();
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      if (world.map.buildable(tx, ty, water ? 'water' : 'land') && !world.towerAt(tx, ty)) g.rect(tx * TILE + 1.5, ty * TILE + 1.5, TILE - 3, TILE - 3);
    }
    g.stroke();
  }

  labels(world) {
    const g = this.g;
    g.font = '20px "Kenney Pixel", monospace';
    g.textBaseline = 'top';
    for (const d of world.map.districts) {
      const [x0, y0] = d.rect;
      const text = d.name.toUpperCase();
      g.fillStyle = 'rgba(20,12,8,0.55)';
      g.fillText(text, x0 * TILE + 9, y0 * TILE + 5);
      g.fillStyle = 'rgba(255,240,200,0.8)';
      g.fillText(text, x0 * TILE + 8, y0 * TILE + 4);
    }
    g.textBaseline = 'alphabetic';
  }

  // o: a tower (or {x, y, s, eff}) — draws its reach
  rangeRing(o, color) {
    const g = this.g;
    const s = o.s;
    if (s.kind === 'global' || s.kind === 'farm' || s.kind === 'mortar') return;
    const r = o.eff?.range ?? s.range;
    const ring = (rad, dash, alpha) => {
      g.globalAlpha = alpha;
      if (dash) g.setLineDash(dash);
      g.beginPath(); g.arc(o.x, o.y, rad, 0, 7); g.stroke();
      g.setLineDash([]);
    };
    g.strokeStyle = color; g.fillStyle = color;
    if (s.kind === 'orbit') { g.globalAlpha = 1; return; }
    if (r && r < 2000) {
      g.globalAlpha = 0.08; g.beginPath(); g.arc(o.x, o.y, r, 0, 7); g.fill();
      ring(r, null, 0.5);
    }
    if (s.auraRange) ring(s.auraRange, [2, 6], 0.45);
    g.globalAlpha = 1;
  }

  bossBar(b) {
    const g = this.g;
    const w = 520, x = (W - w) / 2, y = 10;
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 6, y - 4, w + 12, 34);
    g.font = this.pixel ? '22px "Kenney Pixel", monospace' : '700 13px Georgia, serif'; g.fillStyle = '#ff5fb0'; g.textAlign = 'center';
    let title = ENEMIES[b.type].name.toUpperCase();
    if (b.type === 'plinket') title = b.phase === 1 ? 'SUSAN PLINKET: CAN’T BE HIT YET — MARKS TOWERS SHE PASSES' : b.phase === 2 ? 'SUSAN PLINKET: SHIELDED — TURNS MARKED TOWERS' : 'SUSAN PLINKET: ENRAGED — SUMMONING';
    g.fillText(title, W / 2, y + 10);
    g.textAlign = 'left';
    g.fillStyle = '#300'; g.fillRect(x, y + 16, w, 8);
    g.fillStyle = b.untargetable ? '#886' : '#ff5fb0'; g.fillRect(x, y + 16, w * Math.max(0, b.hp / b.maxHp), 8);
    if (b.shield > 0) { g.fillStyle = '#6fb6ff'; g.fillRect(x, y + 16, w * Math.min(1, b.shield / (b.maxShield || b.shield)), 4); }
  }

  timersText(world) {
    const g = this.g;
    const T = world.timers;
    const parts = [];
    if (T.chug > 0) parts.push(['#ffd35a', `CHUG! ${T.chug.toFixed(1)}s`]);
    if (T.hangover > 0) parts.push(['#9ab', `Hungover ${T.hangover.toFixed(1)}s`]);
    if (T.muster > 0) parts.push(['#ffd35a', `Muster ${T.muster.toFixed(1)}s`]);
    if (T.longarm > 0) parts.push(['#ffd35a', `Long Arm ${T.longarm.toFixed(1)}s`]);
    if (T.kegparty > 0) parts.push(['#ffd35a', `Keg Party ${T.kegparty.toFixed(1)}s`]);
    if (T.sabotage > 0) parts.push(['#ff9b3d', `Sabotage ${T.sabotage.toFixed(1)}s`]);
    if (T.faces > 0) parts.push(['#ff9b9b', `Faces remembered ${T.faces.toFixed(1)}s`]);
    if (!parts.length) return;
    g.font = this.pixel ? '24px "Kenney Pixel", monospace' : '700 14px Georgia, serif';
    let x = 12;
    for (const [c, s] of parts) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(s, x + 2, H - 10);
      g.fillStyle = c; g.fillText(s, x, H - 12);
      x += g.measureText(s).width + 18;
    }
  }
}
