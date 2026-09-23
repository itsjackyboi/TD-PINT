// Canvas renderer. Reads world state; never mutates it.
import { TILE, COLS, ROWS, W, H, DISTRICTS, CASTLE } from '../core/map.js';
import { TOWERS } from '../data/towers.js';

const LAND = ['#3b3322', '#372f1f', '#3e3424', '#35302a'];
const PATH = '#6d5b40', PATH_EDGE = '#4d3f2b', BRIDGE = '#7b5a33', WATER = '#132230';

const MAX_ZOOM = 3;

export class Renderer {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.bg = null;
    this.bgKey = '';
    // camera: zoom factor over "fit to box", centred on world point (x, y)
    this.cam = { z: 1, x: W / 2, y: H / 2 };
    this.cssW = 0; this.cssH = 0; this.dpr = 1; this.fit = 1;
  }

  // Match the backing store to the canvas' CSS box (sharp on HiDPI and when zoomed).
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

  // client (viewport) coordinates -> world coordinates
  toWorld(clientX, clientY) {
    const r = this.c.getBoundingClientRect();
    const s = this.scale();
    return { x: (clientX - r.left - this.cssW / 2) / s + this.cam.x, y: (clientY - r.top - this.cssH / 2) / s + this.cam.y };
  }

  // zoom by factor keeping the world point under (clientX, clientY) fixed
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

  buildBackground(world) {
    const off = document.createElement('canvas');
    off.width = W * 2; off.height = H * 2;
    const g = off.getContext('2d');
    g.scale(2, 2);
    const map = world.map;
    g.fillStyle = WATER;
    g.fillRect(0, 0, W, H);
    // water ripples
    g.strokeStyle = 'rgba(120,170,200,0.06)';
    g.lineWidth = 1;
    for (let y = 8; y < H; y += 14) {
      g.beginPath();
      for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 2);
      g.stroke();
    }
    for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
      const d = map.land[ty * COLS + tx];
      if (d < 0) continue;
      g.fillStyle = LAND[d];
      g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      // subtle build grid
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
    }
    // shorelines
    g.strokeStyle = 'rgba(200,180,130,0.25)';
    g.lineWidth = 2;
    for (const d of DISTRICTS) {
      const [x0, y0, x1, y1] = d.rect;
      g.strokeRect(x0 * TILE + 1, y0 * TILE + 1, (x1 - x0) * TILE - 2, (y1 - y0) * TILE - 2);
    }
    // paths
    for (const id of world.activePaths) {
      const pt = map.pathTile[id];
      for (let ty = 0; ty < ROWS; ty++) for (let tx = 0; tx < COLS; tx++) {
        if (!pt[ty * COLS + tx]) continue;
        const water = map.land[ty * COLS + tx] < 0;
        g.fillStyle = water ? BRIDGE : PATH;
        g.fillRect(tx * TILE, ty * TILE, TILE, TILE);
        g.fillStyle = water ? 'rgba(0,0,0,0.25)' : PATH_EDGE;
        if (water) for (let k = 4; k < TILE; k += 8) g.fillRect(tx * TILE, ty * TILE + k, TILE, 1.5);
        else { g.fillRect(tx * TILE + 6, ty * TILE + 10, 6, 4); g.fillRect(tx * TILE + 24, ty * TILE + 26, 7, 4); }
      }
    }
    // reserved (inactive) Owe Block causeway, faint
    if (!world.activePaths.includes('C')) {
      g.fillStyle = 'rgba(109,91,64,0.25)';
      const pt = map.pathTile.C;
      for (let i = 0; i < pt.length; i++) if (pt[i] && !map.pathTile.A[i]) g.fillRect((i % COLS) * TILE, Math.floor(i / COLS) * TILE, TILE, TILE);
    }
    // castle keep
    const cx = CASTLE.x * TILE, cy = CASTLE.y * TILE;
    g.fillStyle = '#5b5a58';
    g.fillRect(cx - 6, cy - 10, CASTLE.w * TILE + 6, CASTLE.h * TILE + 20);
    g.fillStyle = '#747370';
    for (let k = 0; k < 5; k++) g.fillRect(cx - 6 + k * 18, cy - 18, 10, 10);
    g.fillStyle = '#2a2622';
    g.fillRect(cx - 6, cy + 30, 18, 22);
    g.fillStyle = '#d4a93c';
    g.beginPath(); g.moveTo(cx + 40, cy - 40); g.lineTo(cx + 40, cy - 14); g.stroke();
    g.fillRect(cx + 40, cy - 40, 18, 11);
    // district labels
    g.font = '600 12px Georgia, serif';
    g.fillStyle = 'rgba(230,210,160,0.35)';
    for (const d of DISTRICTS) {
      const [x0, y0] = d.rect;
      g.fillText(d.name.toUpperCase(), x0 * TILE + 8, y0 * TILE + 16);
    }
    // spawn markers
    g.font = '700 11px Georgia, serif';
    for (const id of world.activePaths) {
      const p = map.paths[id].pts[0], q = map.paths[id].pts[1];
      const x = Math.max(14, Math.min(W - 40, (p.x + q.x) / 2)), y = Math.max(14, Math.min(H - 8, (p.y + q.y) / 2));
      g.fillStyle = 'rgba(255,95,176,0.8)';
      g.fillText('MAMA', x - 14, y);
    }
    this.bg = off;
    this.bgKey = world.activePaths.join('');
  }

  draw(world, ui) {
    const g = this.g;
    this.layout();
    if (!this.bg || this.bgKey !== world.activePaths.join('')) this.buildBackground(world);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#0b0907';
    g.fillRect(0, 0, this.c.width, this.c.height);
    const s = this.scale() * this.dpr;
    g.setTransform(s, 0, 0, s, this.dpr * (this.cssW / 2) - this.cam.x * s, this.dpr * (this.cssH / 2) - this.cam.y * s);
    g.drawImage(this.bg, 0, 0, W, H);
    const t = performance.now() / 1000;

    // morale tint on districts in danger
    DISTRICTS.forEach((d, i) => {
      if (world.morale[i] < world.mods.moraleThreshold + 10) {
        const [x0, y0, x1, y1] = d.rect;
        g.fillStyle = `rgba(194,59,138,${0.06 + 0.04 * Math.sin(t * 3)})`;
        g.fillRect(x0 * TILE, y0 * TILE, (x1 - x0) * TILE, (y1 - y0) * TILE);
      }
    });

    for (const b of world.barricades) {
      g.fillStyle = '#e8e0c8';
      g.fillRect(b.x - 16, b.y - 5, 32, 10);
      g.strokeStyle = '#d4a93c';
      g.strokeRect(b.x - 16, b.y - 5, 32, 10);
    }

    // range rings under towers
    const sel = ui.selected;
    if (sel && world.towers.includes(sel)) this.rangeRing(sel.x, sel.y, sel.s, sel.def.color);
    if (ui.placing && ui.hover) {
      const { tx, ty } = ui.hover;
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      const why = world.canPlace(ui.placing, tx, ty);
      const def = TOWERS[ui.placing];
      this.rangeRing(x, y, def.base, why ? '#ff5050' : '#7dff9a');
      g.globalAlpha = 0.6;
      this.towerBody(x, y, def, 0, null, why ? '#ff5050' : def.color);
      g.globalAlpha = 1;
    }

    for (const tw of world.towers) this.tower(tw, world, t);
    for (const e of world.enemies) if (e.alive) this.enemy(e, world, t);
    const insp = ui.hoverEnemy;
    if (insp && insp.alive) {
      g.strokeStyle = '#ffe08a'; g.lineWidth = 2;
      g.beginPath(); g.arc(insp.x, insp.y, insp.def.size + 7, 0, 7); g.stroke(); g.lineWidth = 1;
    }

    for (const p of world.projectiles) {
      g.fillStyle = p.color;
      if (p.kind === 'shell') {
        g.beginPath(); g.arc(p.x, p.y, 5, 0, 7); g.fill();
        g.strokeStyle = '#2a1a0a'; g.stroke();
      } else if (p.kind === 'lance') {
        g.strokeStyle = p.color; g.lineWidth = 3;
        const len = Math.hypot(p.vx, p.vy) || 1;
        g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - (p.vx / len) * 14, p.y - (p.vy / len) * 14); g.stroke();
        g.lineWidth = 1;
      } else {
        g.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }

    for (const f of world.effects) {
      const k = f.t / f.max;
      g.globalAlpha = Math.max(0, 1 - k);
      g.strokeStyle = g.fillStyle = f.color;
      if (f.kind === 'ring') { g.lineWidth = 2; g.beginPath(); g.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, 7); g.stroke(); }
      else if (f.kind === 'burst') { g.beginPath(); g.arc(f.x, f.y, f.r * k, 0, 7); g.fill(); }
      else if (f.kind === 'beam') { g.lineWidth = 2; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x2, f.y2); g.stroke(); }
      else if (f.kind === 'flash') { g.globalAlpha = 0.25 * (1 - k); g.fillRect(0, 0, W, H); }
    }
    g.globalAlpha = 1; g.lineWidth = 1;

    if (ui.kingTargeting) {
      g.fillStyle = 'rgba(232,224,200,0.08)';
      g.fillRect(0, 0, W, H);
      if (ui.mouse) {
        g.strokeStyle = '#e8e0c8';
        g.beginPath(); g.arc(ui.mouse.x, ui.mouse.y, 30, 0, 7); g.stroke();
      }
    }

    // screen-space overlays, laid out as if unzoomed so they stay put while panning
    const f = this.fit * this.dpr;
    g.setTransform(f, 0, 0, f, this.dpr * (this.cssW / 2) - (W / 2) * f, this.dpr * (this.cssH / 2) - (H / 2) * f);
    if (world.boss && world.boss.alive) this.bossBar(world.boss);
    if (world.chugT > 0 || world.hangoverT > 0) {
      g.font = '700 14px Georgia, serif';
      g.fillStyle = world.chugT > 0 ? '#ffd35a' : '#8aa';
      g.fillText(world.chugT > 0 ? `CHUG! ${world.chugT.toFixed(1)}s` : `Hungover ${world.hangoverT.toFixed(1)}s`, 12, H - 12);
    }
  }

  rangeRing(x, y, s, color) {
    const g = this.g;
    if (s.attack === 'global') return;
    g.strokeStyle = color; g.fillStyle = color;
    g.globalAlpha = 0.08; g.beginPath(); g.arc(x, y, s.range, 0, 7); g.fill();
    g.globalAlpha = 0.5; g.stroke();
    if (s.minRange) { g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y, s.minRange, 0, 7); g.stroke(); g.setLineDash([]); }
    if (s.aura) { g.globalAlpha = 0.35; g.setLineDash([2, 6]); g.beginPath(); g.arc(x, y, s.aura.range, 0, 7); g.stroke(); g.setLineDash([]); }
    g.globalAlpha = 1;
  }

  towerBody(x, y, def, tier, branch, color) {
    const g = this.g;
    g.fillStyle = '#1c1712';
    g.fillRect(x - 16, y - 16, 32, 32);
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.strokeRect(x - 15, y - 15, 30, 30);
    g.lineWidth = 1;
    g.fillStyle = color;
    g.font = '700 16px Georgia, serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(def.glyph, x, y + 1);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    for (let i = 0; i < tier; i++) {
      g.fillStyle = branch === 0 ? '#ffd35a' : '#cfd8e0';
      g.fillRect(x - 13 + i * 7, y + 10, 5, 4);
    }
  }

  tower(tw, world, t) {
    const g = this.g;
    this.towerBody(tw.x, tw.y, tw.def, tw.tier, tw.branch, tw.def.color);
    if (tw.soberT > 0) { g.fillStyle = 'rgba(160,220,255,0.28)'; g.fillRect(tw.x - 16, tw.y - 16, 32, 32); }
    if (tw.disabledT > 0) {
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(tw.x - 16, tw.y - 16, 32, 32);
      g.strokeStyle = '#ff9b3d'; g.beginPath();
      g.moveTo(tw.x - 8, tw.y - 8); g.lineTo(tw.x + 8, tw.y + 8); g.moveTo(tw.x + 8, tw.y - 8); g.lineTo(tw.x - 8, tw.y + 8); g.stroke();
    }
    if (tw.turnedT > 0) {
      g.strokeStyle = '#ff5fb0'; g.lineWidth = 2;
      g.beginPath(); g.arc(tw.x, tw.y, 22 + Math.sin(t * 8) * 2, 0, 7); g.stroke(); g.lineWidth = 1;
    }
    if (tw.plinketMarked && world.boss && world.boss.phase >= 2) {
      g.fillStyle = '#ff5fb0'; g.beginPath(); g.arc(tw.x + 12, tw.y - 12, 3, 0, 7); g.fill();
    }
    if (tw.auraRate > 0 && tw.soberT <= 0) { g.fillStyle = '#ffd35a'; g.fillRect(tw.x + 10, tw.y + 10, 4, 4); }
  }

  enemy(e, world, t) {
    const g = this.g;
    const def = e.def;
    const vis = world.visible(e);
    const r = def.size;
    g.globalAlpha = vis ? 1 : 0.22 + 0.08 * Math.sin(t * 6 + e.uid);
    if (def.boss && e.untargetable) g.globalAlpha = 0.75;
    g.fillStyle = def.color;
    g.strokeStyle = '#0b0906';
    g.beginPath();
    switch (def.shape) {
      case 'tri': g.moveTo(e.x, e.y - r); g.lineTo(e.x + r, e.y + r * 0.8); g.lineTo(e.x - r, e.y + r * 0.8); break;
      case 'square': g.rect(e.x - r * 0.8, e.y - r * 0.8, r * 1.6, r * 1.6); break;
      case 'diamond': g.moveTo(e.x, e.y - r); g.lineTo(e.x + r, e.y); g.lineTo(e.x, e.y + r); g.lineTo(e.x - r, e.y); break;
      case 'hex': for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; g.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r); } break;
      case 'star': for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; g.lineTo(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr); } break;
      default: g.arc(e.x, e.y, r, 0, 7);
    }
    g.closePath(); g.fill(); g.stroke();
    if (!vis) { g.setLineDash([2, 3]); g.strokeStyle = '#cfe0c0'; g.stroke(); g.setLineDash([]); }
    g.globalAlpha = 1;
    if (e.shield > 0) {
      g.strokeStyle = '#6fb6ff'; g.lineWidth = 2;
      g.beginPath(); g.arc(e.x, e.y, r + 4, 0, 7 * Math.min(1, e.shield / (e.maxShield || e.shield))); g.stroke(); g.lineWidth = 1;
    }
    if (e.burnT > 0) { g.fillStyle = '#ff7a2a'; g.fillRect(e.x - 2, e.y - r - 8 + Math.sin(t * 20) * 1.5, 4, 4); }
    if (e.slowT > 0) { g.fillStyle = '#9fd8ff'; g.fillRect(e.x - r - 6, e.y - 2, 4, 4); }
    if (e.markT > 0) { g.strokeStyle = '#ff4040'; g.strokeRect(e.x - r - 3, e.y - r - 3, 2 * r + 6, 2 * r + 6); }
    if (e.stunT > 0 && !def.heavy) { g.fillStyle = '#fff'; g.fillRect(e.x + r, e.y - r, 3, 3); }
    if (def.soberAura && vis) {
      g.strokeStyle = 'rgba(240,240,255,0.12)'; g.beginPath(); g.arc(e.x, e.y, def.soberAura, 0, 7); g.stroke();
    }
    if (e.hp < e.maxHp && !def.boss) {
      const w = Math.max(16, r * 2.2);
      g.fillStyle = '#300'; g.fillRect(e.x - w / 2, e.y - r - 6, w, 3);
      g.fillStyle = '#e44'; g.fillRect(e.x - w / 2, e.y - r - 6, w * (e.hp / e.maxHp), 3);
    }
  }

  bossBar(b) {
    const g = this.g;
    const w = 520, x = (W - w) / 2, y = 10;
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x - 6, y - 4, w + 12, 34);
    g.font = '700 13px Georgia, serif'; g.fillStyle = '#ff5fb0'; g.textAlign = 'center';
    const title = b.phase === 1 ? 'MINISTER SUSAN PLINKET — "a moderate voice"' : b.phase === 2 ? 'J.R. UNMASKED' : 'SUSAN PLINKET, FOUNDER OF MAMA';
    g.fillText(title, W / 2, y + 10);
    g.textAlign = 'left';
    g.fillStyle = '#300'; g.fillRect(x, y + 16, w, 8);
    g.fillStyle = b.phase === 1 ? '#886' : '#ff5fb0'; g.fillRect(x, y + 16, w * (b.hp / b.maxHp), 8);
    if (b.shield > 0) { g.fillStyle = '#6fb6ff'; g.fillRect(x, y + 16, w * (b.shield / b.maxShield), 4); }
  }
}
