// Pixel-art presentation built from Kenney's CC0 Tiny Town / Tiny Dungeon /
// Tiny Battle sheets. Purely visual: nothing here reads or writes game rules.
import { TILE, COLS, ROWS, W, H, CASTLE } from '../core/map.js';
import { sprites, PX } from './sprites.js';

const S = TILE / PX; // world units per sprite pixel (2.5)

// Decorative islets in open water (visual only; the map's buildable tiles are
// untouched). [x, y, w, h] in tiles, plus the landmark drawn on each.
// Each is separated from buildable land by at least one water tile so nobody
// mistakes it for a build spot.
export const ISLETS = [
  { rect: [13, 14, 4, 3], landmark: 'tankard' },
  { rect: [18, 15, 1, 2], landmark: 'clock' },
  { rect: [22, 14, 2, 3], landmark: 'lighthouse' },
  { rect: [12, 0, 7, 1], landmark: 'docks' },
];

// cheap deterministic hash for tile variety
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ------------------------------------------------------------------ background
export function buildPixelBackground(world) {
  const map = world.map;
  const c = document.createElement('canvas');
  c.width = COLS * PX; c.height = ROWS * PX;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const isletAt = (x, y) => ISLETS.some(({ rect: [ix, iy, iw, ih] }) => x >= ix && x < ix + iw && y >= iy && y < iy + ih);
  const inB = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const landTile = (x, y) => inB(x, y) && (map.land[y * COLS + x] >= 0 || isletAt(x, y));
  const onPath = (x, y, ids) => inB(x, y) && ids.some((id) => map.pathTile[id][y * COLS + x]);
  const active = world.activePaths;
  const put = (name, x, y) => sprites.draw(g, name, x * PX, y * PX);

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (landTile(x, y)) {
      const r = hash(x, y);
      put(r < 0.8 ? 'grass' : r < 0.975 ? 'grass2' : 'grassFlower', x, y);
      continue;
    }
    // water with Kenney shorelines where it meets land
    const N = landTile(x, y - 1), Sd = landTile(x, y + 1), E = landTile(x + 1, y), Wd = landTile(x - 1, y);
    let t = 'water';
    if (N && Wd && !Sd && !E) t = 'shoreTL';
    else if (N && E && !Sd && !Wd) t = 'shoreTR';
    else if (Sd && Wd && !N && !E) t = 'shoreBL';
    else if (Sd && E && !N && !Wd) t = 'shoreBR';
    else if (N && !Sd && !E && !Wd) t = 'shoreT';
    else if (Sd && !N && !E && !Wd) t = 'shoreB';
    else if (Wd && !E && !N && !Sd) t = 'shoreL';
    else if (E && !Wd && !N && !Sd) t = 'shoreR';
    put(t, x, y);
    if (t === 'water') {
      // straits between two shores and outside corners: thin sandy rims
      g.fillStyle = '#e7c18a';
      if (N) g.fillRect(x * PX, y * PX, PX, 2);
      if (Sd) g.fillRect(x * PX, y * PX + PX - 2, PX, 2);
      if (Wd) g.fillRect(x * PX, y * PX, 2, PX);
      if (E) g.fillRect(x * PX + PX - 2, y * PX, 2, PX);
      const corner = (dx, dy, px, py) => { if (landTile(x + dx, y + dy) && !landTile(x + dx, y) && !landTile(x, y + dy)) g.fillRect(x * PX + px, y * PX + py, 3, 3); };
      corner(-1, -1, 0, 0); corner(1, -1, PX - 3, 0); corner(-1, 1, 0, PX - 3); corner(1, 1, PX - 3, PX - 3);
    }
    // gentle wave glints
    if (hash(y, x) < 0.12) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x * PX + 4 + ((x * 7) % 6), y * PX + 5 + ((y * 5) % 6), 3, 1); }
  }

  // roads and bridges
  const drawPath = (ids, alpha) => {
    g.globalAlpha = alpha;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (!onPath(x, y, ids)) continue;
      const water = !landTile(x, y) || isletAt(x, y);
      const n = onPath(x, y - 1, ids), s = onPath(x, y + 1, ids), e = onPath(x + 1, y, ids), w = onPath(x - 1, y, ids);
      if (water) bridge(g, x * PX, y * PX, (e || w) && !(n || s));
      else {
        const r = hash(x + 50, y);
        put(r < 0.7 ? 'dirt' : r < 0.85 ? 'dirt2' : 'dirt3', x, y);
        // darker trodden edges where the road meets grass
        g.fillStyle = 'rgba(120,70,40,0.55)';
        if (!n && landTile(x, y - 1)) g.fillRect(x * PX, y * PX, PX, 1);
        if (!s && landTile(x, y + 1)) g.fillRect(x * PX, y * PX + PX - 1, PX, 1);
        if (!w && landTile(x - 1, y)) g.fillRect(x * PX, y * PX, 1, PX);
        if (!e && landTile(x + 1, y)) g.fillRect(x * PX + PX - 1, y * PX, 1, PX);
        // cart ruts
        g.fillStyle = 'rgba(150,95,55,0.35)';
        if (e || w) { g.fillRect(x * PX, y * PX + 5, PX, 1); g.fillRect(x * PX, y * PX + 10, PX, 1); }
        if (n || s) { g.fillRect(x * PX + 5, y * PX, 1, PX); g.fillRect(x * PX + 10, y * PX, 1, PX); }
      }
    }
    g.globalAlpha = 1;
  };
  drawPath(active, 1);
  if (!active.includes('C')) drawPath(['C'], 0.28); // the Owe Block causeway, not yet stormed

  // landmarks on the islets
  for (const isl of ISLETS) drawLandmark(g, isl);
  drawCastle(g);

  // spawn gates: MAMA banners where the columns enter
  for (const id of active) {
    const p = map.paths[id].pts[1];
    const tx = Math.min(COLS - 1, Math.max(0, Math.floor(p.x / TILE))), ty = Math.min(ROWS - 1, Math.max(0, Math.floor(p.y / TILE)));
    const bx = id === 'B' ? 0 : tx, by = id === 'A' ? 0 : id === 'C' ? ROWS - 1 : ty;
    sprites.draw(g, 'flagRed', bx * PX + (id === 'A' ? 10 : 2), by * PX - (id === 'C' ? 4 : 2), 12, 12);
  }

  // dusk grade: a faint violet multiply keeps the bright tiles on the grim side
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = '#e4d6ea';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}

function bridge(g, x, y, horizontal) {
  g.fillStyle = '#7a4f2c';
  g.fillRect(x, y, PX, PX);
  g.fillStyle = '#9a6a3c';
  for (let i = 1; i < PX; i += 4) {
    if (horizontal) g.fillRect(x + i, y + 2, 3, PX - 4);
    else g.fillRect(x + 2, y + i, PX - 4, 3);
  }
  g.fillStyle = '#3b2616'; // rails
  if (horizontal) { g.fillRect(x, y + 1, PX, 1); g.fillRect(x, y + PX - 2, PX, 1); }
  else { g.fillRect(x + 1, y, 1, PX); g.fillRect(x + PX - 2, y, 1, PX); }
}

function drawLandmark(g, { rect: [x, y, w, h], landmark }) {
  const at = (name, tx, ty, s = 1) => sprites.draw(g, name, x * PX + tx, y * PX + ty, PX * s, PX * s);
  switch (landmark) {
    case 'tankard': // the Gilded Tankard: red-roofed inn, sign, kegs out front
      at('roofRedL', 8, 0); at('roofRed', 24, 0); at('roofRedR', 40, 0);
      at('winWood', 8, 16); at('doorWood', 24, 16); at('winWood', 40, 16);
      at('tavernSign', 50, 30, 0.8); at('barrel', 2, 32, 0.7); at('barrel', 12, 34, 0.6); at('treeAutumnSmall', 30, 32, 0.8);
      break;
    case 'clock': // CockPower's clock tower
      at('battlementEnd', 0, -10); at('towerWindow', 0, 6); at('wallStone', 0, 16);
      clockFace(g, x * PX + 8, y * PX - 1, 4);
      break;
    case 'lighthouse':
      at('battlementEnd', 8, -6); at('wallStone', 8, 10); at('wallStoneDoor', 8, 26);
      g.fillStyle = '#ffe08a'; g.fillRect(x * PX + 13, y * PX - 4, 6, 4);
      g.fillStyle = 'rgba(255,224,138,0.25)'; g.fillRect(x * PX + 4, y * PX - 8, 24, 12);
      at('treeSmall', -2, 30, 0.8);
      break;
    case 'docks': // Brewers Lane's barrel docks on the northern sandbar
      at('barrel', 4, 2, 0.8); at('barrel', 14, 4, 0.8); at('pot', 26, 3, 0.8); at('beehive', 44, 2, 0.8);
      at('barrel', 60, 2, 0.8); at('log', 76, 4, 0.8); at('fencePost', 92, 0, 0.9); at('treeSmall', 100, 0, 0.9);
      break;
  }
}

function clockFace(g, cx, cy, r) {
  g.fillStyle = '#3b2c20'; g.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
  g.fillStyle = '#f2e6c8'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.fillStyle = '#3b2c20'; g.fillRect(cx, cy - r + 1, 1, r); g.fillRect(cx, cy, r - 1, 1);
}

// The castle keep on its unbuildable tiles, gate opening onto the road.
function drawCastle(g) {
  const x0 = (CASTLE.x - 1) * PX, y0 = (CASTLE.y - 1) * PX;
  const at = (name, tx, ty) => sprites.draw(g, name, x0 + tx * PX, y0 + ty * PX);
  // walls around the courtyard
  at('castleTL', 0, 0); at('castleT', 1, 0); at('castleTR', 2, 0);
  at('castleL', 0, 1); at('castleC', 1, 1); at('castleR', 2, 1);
  at('gateTL', 1, 2); at('gateTR', 2, 2); // portcullis where the road arrives
  at('castleL', 0, 3); at('castleC', 1, 3); at('castleR', 2, 3);
  at('castleBL', 0, 4); at('castleB', 1, 4); at('castleBR', 2, 4);
  at('towerWindow', 1, 1);
  sprites.draw(g, 'flagOrange', x0 + PX + 2, y0 - 10, 14, 14);
}

// ------------------------------------------------------------------ towers
// Each tower is composed from sprites in "sprite pixels" relative to its tile's
// top-left (0..16), and may rise above its tile for a 3/4 look.
const PLINTH = '#6f6a63', PLINTH_TOP = '#8d877d';

function plinth(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2 * S, y + 13 * S, 12 * S, 3 * S);
  g.fillStyle = PLINTH; g.fillRect(x + 2 * S, y + 11 * S, 12 * S, 4 * S);
  g.fillStyle = PLINTH_TOP; g.fillRect(x + 2 * S, y + 11 * S, 12 * S, 1 * S);
}

// draw tower `type` whose tile top-left is (x, y) in world units
export function drawTower(g, type, x, y, tier = 0, branch = null, t = 0, opts = {}) {
  const sp = (name, px, py, sc = 1, flip = false) => sprites.draw(g, name, x + px * S, y + py * S, PX * S * sc, PX * S * sc, flip);
  const tint = (name, color, amt, px, py, sc = 1) => sprites.drawVariant(g, name, color, amt, 'tint', x + px * S, y + py * S, PX * S * sc, PX * S * sc, false);
  switch (type) {
    case 'pike':
      plinth(g, x, y);
      if (branch === 1) sp('knightVisor', 0, -3);
      else sp('knight', 0, -3);
      if (branch === 0) sp(tier >= 3 ? 'flagOrange' : 'flagRed', 7, -9, 0.7);
      if (branch === 1 && tier >= 2) { g.fillStyle = '#ffd35a'; g.fillRect(x + 7 * S, y + 5 * S, 2 * S, 2 * S); }
      break;
    case 'keg': {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 1 * S, y + 13 * S, 14 * S, 3 * S);
      // wooden throwing frame
      g.fillStyle = '#5b3a1f'; g.fillRect(x + 2 * S, y + 6 * S, 2 * S, 8 * S); g.fillRect(x + 12 * S, y + 6 * S, 2 * S, 8 * S);
      g.fillStyle = '#8a5a30'; g.fillRect(x + 1 * S, y + 11 * S, 14 * S, 3 * S);
      g.fillStyle = '#6b4424'; g.fillRect(x + 3 * S, y + 5 * S, 11 * S, 2 * S);
      if (branch === 0) tint('barrel', '#6e7480', tier >= 3 ? 0.7 : 0.45, 3, -3 - tier, 0.7 + tier * 0.06);
      else sp('barrel', 3, -2, 0.7);
      if (branch === 1) { sp('barrel', -1, 6, 0.55); if (tier >= 2) sp('barrel', 10, 7, 0.5); }
      break;
    }
    case 'tap':
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 1 * S, y + 13 * S, 14 * S, 3 * S);
      sp('roofRedGable', 1, -8, 0.88); sp('doorWood', 1, 5, 0.88);
      sp('tavernSign', 10, 3, 0.55);
      if (branch === 1) sp('well', -3, 6, 0.55 + tier * 0.05);
      if (branch === 0) sp('barrel', -2, 8, 0.45 + tier * 0.05);
      break;
    case 'still': {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 1 * S, y + 13 * S, 14 * S, 3 * S);
      sp('roofSlateGable', 1, -8, 0.88); sp('wallWood', 1, 5, 0.88);
      const toxic = branch === 1;
      sp(toxic ? 'potionGreen' : 'potionRed', 8, 6, 0.6);
      // chimney smoke
      g.fillStyle = toxic ? 'rgba(120,230,120,0.45)' : 'rgba(210,210,210,0.45)';
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        g.fillRect(x + (4 + Math.sin(k * 6) * 1.5) * S, y + (-7 - k * 8) * S, 2 * S, 2 * S);
      }
      if (tier >= 2) { g.fillStyle = toxic ? '#6fe06f' : '#ff9b3d'; g.fillRect(x + 3 * S, y + 11 * S, 2 * S, 2 * S); }
      break;
    }
    case 'bow':
      plinth(g, x, y);
      sp('ranger', 0, -3);
      sp(branch === 1 ? 'arrow' : 'bow', 8, 1, 0.6 + (branch === 1 ? tier * 0.08 : 0));
      if (branch === 0 && tier >= 2) sp('pickaxe', -3, 4, 0.5);
      break;
    case 'light': {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2 * S, y + 13 * S, 12 * S, 3 * S);
      sp('battlementEnd', 2, -10, 0.75); sp('wallStone', 2, -2, 0.75); sp('wallStoneDoor', 2, 6, 0.75);
      // lamp and a sweeping beam
      const a = t * 1.6 + x * 0.01;
      g.fillStyle = 'rgba(255,224,138,0.22)';
      g.beginPath(); g.moveTo(x + 8 * S, y - 7 * S);
      g.lineTo(x + 8 * S + Math.cos(a - 0.25) * 60, y - 7 * S + Math.sin(a - 0.25) * 60);
      g.lineTo(x + 8 * S + Math.cos(a + 0.25) * 60, y - 7 * S + Math.sin(a + 0.25) * 60);
      g.closePath(); g.fill();
      g.fillStyle = '#ffe08a'; g.fillRect(x + 6 * S, y - 8 * S, 4 * S, 2 * S);
      if (branch === 0) sp('coin', 10, 7, 0.45);
      break;
    }
    case 'clock': {
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2 * S, y + 13 * S, 12 * S, 3 * S);
      sp('battlementEnd', 2, -12, 0.75); sp('towerWindow', 2, -4, 0.75); sp('wallStone', 2, 4, 0.75);
      const cx = x + 8 * S, cy = y - 7 * S, r = 3.5 * S;
      g.fillStyle = '#3b2c20'; g.beginPath(); g.arc(cx, cy, r + S * 0.8, 0, 7); g.fill();
      g.fillStyle = branch === 1 ? '#f0c6c6' : '#f2e6c8'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.strokeStyle = '#3b2c20'; g.lineWidth = S * 0.6;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t) * r * 0.8, cy + Math.sin(t) * r * 0.8);
      g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t / 12) * r * 0.5, cy + Math.sin(t / 12) * r * 0.5); g.stroke();
      g.lineWidth = 1;
      break;
    }
  }
  // tier pips on the plinth
  for (let i = 0; i < tier; i++) {
    g.fillStyle = '#2a1d12'; g.fillRect(x + (3 + i * 3.5) * S, y + 12.5 * S, 3 * S, 2 * S);
    g.fillStyle = branch === 0 ? '#ffd35a' : '#cfe4f5'; g.fillRect(x + (3.5 + i * 3.5) * S, y + 13 * S, 2 * S, 1 * S);
  }
  if (opts.ghost) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = opts.ghost; g.fillRect(x - 8 * S, y - 14 * S, 32 * S, 32 * S);
    g.globalCompositeOperation = 'source-over';
  }
}

// small canvas icon of a tower for the DOM build bar
export function towerIconURL(type, scale = 3) {
  const key = `icon|${type}|${scale}`;
  if (sprites.cache.has(key)) return sprites.cache.get(key);
  const c = document.createElement('canvas');
  c.width = 20 * scale; c.height = 30 * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(scale / S, scale / S);
  drawTower(g, type, 2 * S, 13 * S, 0, null, 0.8);
  const url = c.toDataURL();
  sprites.cache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ enemies
// sprite, optional tint [color, amount], scale, and a carried prop
export const ENEMY_LOOK = {
  zealot: { spr: 'redhead', tint: ['#c23b2a', 0.35], sc: 1.9, prop: 'pitchfork' },
  matron: { spr: 'matron', sc: 2.1 },
  picket: { spr: 'youth', sc: 2.0, prop: 'sign', propAbove: true },
  believer: { spr: 'knight', tint: ['#8a1f2a', 0.6], sc: 2.3, prop: 'sword' },
  infiltrator: { spr: 'hooded', sc: 2.0 },
  pamphleteer: { spr: 'villager', sc: 1.9, scroll: true },
  martyr: { spr: 'baldman', sc: 1.9, prop: 'bomb' },
  widow: { spr: 'woman', tint: ['#2a2030', 0.75], sc: 2.1 },
  widowling: { spr: 'youth', tint: ['#6e5a85', 0.45], sc: 1.3 },
  bagman: { spr: 'brute', sc: 2.5, prop: 'chest' },
  insurgent: { spr: 'villager', tint: ['#c23b8a', 0.55], sc: 1.8, prop: 'pitchfork' },
  plinket: { spr: 'woman', sc: 3.4 },
};

// per-enemy render memory (facing, hit flash) keyed by uid; pruned as enemies die
const mem = new Map();

export function drawEnemy(g, e, world, t, inspected) {
  const look = ENEMY_LOOK[e.type] || ENEMY_LOOK.zealot;
  const vis = world.visible(e);
  let m = mem.get(e.uid);
  if (!m) { m = { x: e.x, flip: false, hp: e.hp, flash: 0, seen: 0 }; mem.set(e.uid, m); }
  if (Math.abs(e.x - m.x) > 0.3) m.flip = e.x < m.x;
  m.x = e.x;
  if (e.hp < m.hp - 0.5) m.flash = t + 0.07;
  m.hp = e.hp;
  m.seen = t;

  const sz = PX * look.sc;
  const moving = !(e.stunT > 0 && !e.def.heavy);
  const bob = moving ? Math.abs(Math.sin(t * 9 + e.uid)) * 2.2 : 0;
  const fx = e.x - sz / 2, fy = e.y + 12 - sz - bob;

  // shadow
  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(e.x, e.y + 11, sz * 0.32, sz * 0.1, 0, 0, 7); g.fill();

  let alpha = 1;
  if (!vis) alpha = 0.2 + 0.1 * Math.sin(t * 6 + e.uid);
  if (e.def.boss && e.untargetable) alpha = 0.85;
  g.globalAlpha = alpha;

  if (e.def.boss) {
    // Plinket's aura changes with each phase
    const col = e.phase === 1 ? 'rgba(180,120,255,' : e.phase === 2 ? 'rgba(255,95,176,' : 'rgba(255,60,60,';
    g.fillStyle = col + (0.18 + 0.08 * Math.sin(t * 4)) + ')';
    g.beginPath(); g.ellipse(e.x, e.y + 4, sz * 0.55, sz * 0.3, 0, 0, 7); g.fill();
  }

  if (look.propAbove) sprites.draw(g, look.prop, e.x - sz * 0.28, fy - sz * 0.35, sz * 0.56, sz * 0.56);
  if (t < m.flash) sprites.drawVariant(g, look.spr, '#ffffff', 1, 'solid', fx, fy, sz, sz, m.flip);
  else if (e.def.boss) {
    const tint = e.phase === 2 ? ['#40103a', 0.5] : e.phase === 3 ? ['#b0102a', 0.4] : null;
    if (tint) sprites.drawVariant(g, look.spr, tint[0], tint[1], 'tint', fx, fy, sz, sz, m.flip);
    else sprites.draw(g, look.spr, fx, fy, sz, sz, m.flip);
    // crown
    g.fillStyle = e.phase === 3 ? '#ffd35a' : '#c9a0ff';
    const cx = e.x - sz * 0.14, cy = fy + sz * 0.02;
    g.fillRect(cx, cy, sz * 0.28, sz * 0.06);
    for (let i = 0; i < 3; i++) g.fillRect(cx + i * sz * 0.11, cy - sz * 0.06, sz * 0.06, sz * 0.06);
  } else if (look.tint) sprites.drawVariant(g, look.spr, look.tint[0], look.tint[1], 'tint', fx, fy, sz, sz, m.flip);
  else sprites.draw(g, look.spr, fx, fy, sz, sz, m.flip);

  if (look.prop && !look.propAbove) {
    const ps = sz * 0.5;
    sprites.draw(g, look.prop, m.flip ? fx - ps * 0.1 : fx + sz - ps * 0.9, fy + sz * 0.35, ps, ps, m.flip);
    if (look.prop === 'bomb' && Math.sin(t * 20) > 0) { g.fillStyle = '#ffd35a'; g.fillRect(m.flip ? fx : fx + sz - 4, fy + sz * 0.3, 3, 3); }
  }
  if (look.scroll) { g.fillStyle = '#f2e6c8'; g.fillRect(m.flip ? fx : fx + sz * 0.72, fy + sz * 0.45, sz * 0.22, sz * 0.26); g.fillStyle = '#3b2c20'; g.fillRect(m.flip ? fx + 2 : fx + sz * 0.72 + 2, fy + sz * 0.52, sz * 0.14, 1); }
  g.globalAlpha = 1;
  if (!vis) {
    g.strokeStyle = 'rgba(200,230,190,0.5)'; g.setLineDash([3, 4]);
    g.beginPath(); g.ellipse(e.x, e.y, sz * 0.4, sz * 0.5, 0, 0, 7); g.stroke(); g.setLineDash([]);
  }

  // status effects
  const top = fy - 2;
  if (e.shield > 0) {
    g.strokeStyle = 'rgba(111,182,255,0.9)'; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(e.x, fy + sz * 0.55, sz * 0.48, sz * 0.58, 0, 0, 7 * Math.min(1, e.shield / (e.maxShield || e.shield))); g.stroke(); g.lineWidth = 1;
  }
  if (e.burnT > 0) {
    for (let i = 0; i < 3; i++) {
      const k = (t * 3 + i / 3) % 1;
      g.fillStyle = k < 0.5 ? '#ffd35a' : '#ff6a2a';
      g.fillRect(e.x - 6 + i * 5, fy + sz * 0.5 - k * 14, 3, 3);
    }
  }
  if (e.slowT > 0) { g.fillStyle = '#9fd8ff'; g.fillRect(e.x - sz * 0.45, fy + sz * 0.3 + ((t * 20) % 8), 2.5, 4); }
  if (e.markT > 0) {
    g.fillStyle = '#ff4040';
    const r = sz * 0.5, cy = fy + sz * 0.5;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.fillRect(e.x + dx * r - (dx > 0 ? 5 : 0), cy + dy * r - (dy > 0 ? 1.5 : 0), 5, 1.5);
      g.fillRect(e.x + dx * r - (dx > 0 ? 1.5 : 0), cy + dy * r - (dy > 0 ? 5 : 0), 1.5, 5);
    }
  }
  if (e.stunT > 0 && !e.def.heavy) { g.fillStyle = '#fff6b0'; g.fillRect(e.x - 5 + Math.sin(t * 10) * 5, top - 3, 3, 3); }
  if (e.def.soberAura && vis) { g.strokeStyle = 'rgba(200,225,255,0.14)'; g.beginPath(); g.arc(e.x, e.y, e.def.soberAura, 0, 7); g.stroke(); }
  if (inspected) {
    g.strokeStyle = '#ffe08a'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(e.x, e.y + 11, sz * 0.4, sz * 0.14, 0, 0, 7); g.stroke(); g.lineWidth = 1;
  }
  if (e.hp < e.maxHp && !e.def.boss) {
    const w = Math.max(18, sz * 0.7);
    g.fillStyle = '#1a0d0d'; g.fillRect(e.x - w / 2 - 1, top - 5, w + 2, 4);
    g.fillStyle = e.hp / e.maxHp > 0.5 ? '#6fd96f' : e.hp / e.maxHp > 0.25 ? '#ffd35a' : '#ff4a4a';
    g.fillRect(e.x - w / 2, top - 4, w * (e.hp / e.maxHp), 2);
  }
}

export function pruneEnemyMemory(t) {
  if (mem.size < 200) return;
  for (const [k, m] of mem) if (t - m.seen > 2) mem.delete(k);
}

// ------------------------------------------------------------------ projectiles & effects
export function drawProjectile(g, p, t) {
  const type = p.src?.type;
  const ang = p.kind === 'lance' ? Math.atan2(p.vy, p.vx) : Math.atan2(p.ty - p.y, p.tx - p.x);
  const rot = (name, sz, a) => {
    g.save(); g.translate(p.x, p.y); g.rotate(a);
    sprites.draw(g, name, -sz / 2, -sz / 2, sz, sz);
    g.restore();
  };
  if (p.kind === 'shell') { rot('barrel', 18, t * 8); return; }
  if (p.kind === 'lance') { rot('arrow', 34, ang + Math.PI * 0.25); return; }
  if (type === 'still') { rot('potionRed', 16, t * 10); return; }
  if (type === 'bow') { rot('arrow', 24, ang + Math.PI * 0.25); return; }
  // pike militia: short thrown spear
  g.strokeStyle = '#d8d0c0'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - Math.cos(ang) * 10, p.y - Math.sin(ang) * 10); g.stroke();
  g.lineWidth = 1;
}

export function drawEffect(g, f) {
  const k = f.t / f.max;
  g.globalAlpha = Math.max(0, 1 - k);
  g.fillStyle = g.strokeStyle = f.color;
  if (f.kind === 'ring') {
    g.lineWidth = 3; g.setLineDash([6, 4]);
    g.beginPath(); g.arc(f.x, f.y, f.r * (0.4 + 0.6 * k), 0, 7); g.stroke(); g.setLineDash([]);
  } else if (f.kind === 'burst') {
    // chunky pixel debris + a puff of smoke
    const n = 8, d = 4 + f.r * 1.4 * k;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + f.x * 0.01;
      g.fillRect(f.x + Math.cos(a) * d - 2, f.y + Math.sin(a) * d - 2 - k * 6, 4, 4);
    }
    g.fillStyle = 'rgba(220,220,220,0.5)';
    g.fillRect(f.x - 5, f.y - 8 - k * 10, 10 * (1 - k) + 2, 10 * (1 - k) + 2);
  } else if (f.kind === 'beam') {
    g.lineWidth = 4; g.globalAlpha *= 0.4; g.beginPath(); g.moveTo(f.x, f.y - 16); g.lineTo(f.x2, f.y2); g.stroke();
    g.lineWidth = 1.5; g.globalAlpha = Math.max(0, 1 - k); g.strokeStyle = '#fffbe0'; g.stroke();
  } else if (f.kind === 'flash') {
    g.globalAlpha = 0.22 * (1 - k); g.fillRect(0, 0, W, H);
  }
  g.globalAlpha = 1; g.lineWidth = 1;
}

export function drawBarricade(g, b) {
  sprites.draw(g, 'fenceH', b.x - 22, b.y - 14, 22, 22);
  sprites.draw(g, 'fenceH', b.x, b.y - 14, 22, 22);
  g.fillStyle = '#ffe08a'; g.fillRect(b.x - 1, b.y - 18, 2, 6);
}

// screen-space vignette (drawn in the unzoomed overlay space)
export function vignette(g) {
  const grd = g.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, W * 0.7);
  grd.addColorStop(0, 'rgba(10,6,14,0)');
  grd.addColorStop(1, 'rgba(10,6,14,0.3)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ title art & portraits
export const KING_PORTRAIT = { seamus: 'viking', buke: 'youth', jagerbauhm: 'wizard', guinnie: 'knightVisor', jack: 'hooded', jp: 'ranger' };

// A little diorama for the title card: the keep and the Tankard under a dusk
// sky while a MAMA column marches in behind Plinket.
export function titleArtURL() {
  if (sprites.cache.has('title')) return sprites.cache.get('title');
  const w = 176, h = 72, k = 4;
  const c = document.createElement('canvas');
  c.width = w * k; c.height = h * k;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(k, k);
  // sky bands
  const sky = ['#2a1830', '#46243c', '#6e3440', '#a4543e', '#d88a4a'];
  sky.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 7, w, 7); });
  g.fillStyle = '#f2d48a'; g.fillRect(130, 22, 10, 10); // setting sun
  // ground
  for (let x = 0; x < w; x += 16) { sprites.draw(g, 'grass', x, 40); sprites.draw(g, 'grass', x, 56); }
  for (let x = 0; x < w; x += 16) sprites.draw(g, x % 32 ? 'dirt' : 'dirt2', x, 52);
  // the keep
  const at = (n, x, y) => sprites.draw(g, n, x, y);
  at('battlementL', 110, 22); at('battlement', 126, 22); at('battlementR', 142, 22);
  at('wallStone', 110, 38); at('gateTL', 126, 36); at('wallStone', 142, 38);
  sprites.draw(g, 'flagOrange', 128, 8, 14, 14);
  // the Gilded Tankard
  at('roofRedL', 64, 24); at('roofRedR', 80, 24); at('winWood', 64, 40); at('doorWood', 80, 40);
  sprites.draw(g, 'tavernSign', 96, 42, 12, 12);
  at('treePine', 4, 22); at('treeRound', 4, 8); at('treeAutumnSmall', 44, 38); at('treeSmall', 160, 40);
  // the column
  const marchers = ['matron', 'redhead', 'youth', 'hooded', 'villager'];
  marchers.forEach((m, i) => sprites.draw(g, m, 8 + i * 11, 48, 14, 14));
  sprites.draw(g, 'sign', 30, 40, 10, 10);
  sprites.draw(g, 'woman', 62, 42, 20, 20);
  g.fillStyle = '#c9a0ff'; g.fillRect(67, 41, 8, 2); g.fillRect(67, 39, 2, 2); g.fillRect(70, 39, 2, 2); g.fillRect(73, 39, 2, 2);
  // vignette
  const grd = g.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, 100);
  grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(20,8,20,0.45)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const url = c.toDataURL();
  sprites.cache.set('title', url);
  return url;
}

export function enemyPortraitURL(type) {
  const look = ENEMY_LOOK[type] || ENEMY_LOOK.zealot;
  return sprites.dataURL(look.spr, 4, look.tint);
}
