// Pixel-art presentation built from Kenney's CC0 Tiny Town / Tiny Dungeon /
// Tiny Battle sheets. Purely visual: nothing here reads or writes game rules.
import { TILE, COLS, ROWS, W, H } from '../core/map.js';
import { TRAITS } from '../data/enemies.js';
import { HEROES } from '../data/heroes.js';
import { sprites, PX } from './sprites.js';

const S = TILE / PX; // world units per sprite pixel (2.5)

// cheap deterministic hash for tile variety
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// ------------------------------------------------------------------ background
// Built once per map (and again if a mandate opens the extra lane), from the
// map definition alone: terrain, roads, landmarks, keep, spawn banners, colour grade.
export function buildPixelBackground(world) {
  const map = world.map, def = map.def;
  const c = document.createElement('canvas');
  c.width = COLS * PX; c.height = ROWS * PX;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  const inB = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const landTile = (x, y) => inB(x, y) && map.terrain[y * COLS + x] !== 0;
  const isletAt = (x, y) => inB(x, y) && map.terrain[y * COLS + x] === 2;
  const onPath = (x, y, ids) => inB(x, y) && ids.some((id) => map.pathTile[id]?.[y * COLS + x]);
  const active = world.activePaths;
  const put = (name, x, y) => sprites.draw(g, name, x * PX, y * PX);
  const stone = def.id === 'cloister';

  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (landTile(x, y)) {
      const r = hash(x, y);
      if (stone && !map.blocked[y * COLS + x]) { put(r < 0.85 ? 'grass' : 'grass2', x, y); flagstones(g, x, y, r); }
      else put(r < 0.8 ? 'grass' : r < 0.975 ? 'grass2' : 'grassFlower', x, y);
      if (def.id === 'cumstead' && r > 0.55 && !map.anyPath[y * COLS + x] && !map.blocked[y * COLS + x] && !map.isCastle(x, y)) barleyTufts(g, x, y, r);
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
      g.fillStyle = '#e7c18a';
      if (N) g.fillRect(x * PX, y * PX, PX, 2);
      if (Sd) g.fillRect(x * PX, y * PX + PX - 2, PX, 2);
      if (Wd) g.fillRect(x * PX, y * PX, 2, PX);
      if (E) g.fillRect(x * PX + PX - 2, y * PX, 2, PX);
      const corner = (dx, dy, px, py) => { if (landTile(x + dx, y + dy) && !landTile(x + dx, y) && !landTile(x, y + dy)) g.fillRect(x * PX + px, y * PX + py, 3, 3); };
      corner(-1, -1, 0, 0); corner(1, -1, PX - 3, 0); corner(-1, 1, 0, PX - 3); corner(1, 1, PX - 3, PX - 3);
    }
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
        put(stone ? 'cobble' : r < 0.7 ? 'dirt' : r < 0.85 ? 'dirt2' : 'dirt3', x, y);
        g.fillStyle = stone ? 'rgba(40,36,40,0.5)' : 'rgba(120,70,40,0.55)';
        if (!n && landTile(x, y - 1)) g.fillRect(x * PX, y * PX, PX, 1);
        if (!s && landTile(x, y + 1)) g.fillRect(x * PX, y * PX + PX - 1, PX, 1);
        if (!w && landTile(x - 1, y)) g.fillRect(x * PX, y * PX, 1, PX);
        if (!e && landTile(x + 1, y)) g.fillRect(x * PX + PX - 1, y * PX, 1, PX);
        if (!stone) {
          g.fillStyle = 'rgba(150,95,55,0.35)';
          if (e || w) { g.fillRect(x * PX, y * PX + 5, PX, 1); g.fillRect(x * PX, y * PX + 10, PX, 1); }
          if (n || s) { g.fillRect(x * PX + 5, y * PX, 1, PX); g.fillRect(x * PX + 10, y * PX, 1, PX); }
        }
      }
    }
    g.globalAlpha = 1;
  };
  drawPath(active, 1);
  if (map.extraLane && !active.includes(map.extraLane)) drawPath([map.extraLane], 0.25);

  for (const b of def.blocked) drawLandmark(g, b);
  for (const isl of def.islets) drawLandmark(g, isl);
  drawKeep(g, map.keep);

  // spawn banners where each column enters
  for (const id of active) {
    const pts = map.paths[id].pts;
    const p = pts[0], q = pts[1];
    const x = Math.max(0, Math.min(W - 1, (p.x + q.x) / 2)), y = Math.max(0, Math.min(H - 1, (p.y + q.y) / 2));
    const tx = Math.min(COLS - 1, Math.floor(x / TILE)), ty = Math.min(ROWS - 1, Math.floor(y / TILE));
    sprites.draw(g, 'flagRed', tx * PX + 2, ty * PX - 2, 12, 12);
  }

  // per-map colour grade (multiply)
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = def.grade || '#e4d6ea';
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  return c;
}

function flagstones(g, x, y, r) {
  g.fillStyle = 'rgba(150,150,160,0.55)';
  g.fillRect(x * PX + 1, y * PX + 1, 14, 14);
  g.fillStyle = 'rgba(70,66,74,0.5)';
  g.fillRect(x * PX, y * PX + (r < 0.5 ? 7 : 8), PX, 1);
  g.fillRect(x * PX + (r < 0.5 ? 5 : 10), y * PX, 1, 8);
  g.fillRect(x * PX + (r < 0.5 ? 11 : 4), y * PX + 8, 1, 8);
}

function barleyTufts(g, x, y, r) {
  g.fillStyle = r > 0.8 ? '#d9b44a' : '#c9a23a';
  for (let i = 0; i < 4; i++) {
    const px = x * PX + 2 + ((i * 5 + Math.floor(r * 13)) % 12), py = y * PX + 3 + ((i * 7 + Math.floor(r * 29)) % 10);
    g.fillRect(px, py, 1, 3); g.fillRect(px - 1, py - 1, 3, 1);
  }
}

function bridge(g, x, y, horizontal) {
  g.fillStyle = '#7a4f2c';
  g.fillRect(x, y, PX, PX);
  g.fillStyle = '#9a6a3c';
  for (let i = 1; i < PX; i += 4) {
    if (horizontal) g.fillRect(x + i, y + 2, 3, PX - 4);
    else g.fillRect(x + 2, y + i, PX - 4, 3);
  }
  g.fillStyle = '#3b2616';
  if (horizontal) { g.fillRect(x, y + 1, PX, 1); g.fillRect(x, y + PX - 2, PX, 1); }
  else { g.fillRect(x + 1, y, 1, PX); g.fillRect(x + PX - 2, y, 1, PX); }
}

function drawLandmark(g, { rect: [x0, y0, x1, y1], landmark }) {
  const x = x0, y = y0, w = x1 - x0, h = y1 - y0;
  const at = (name, tx, ty, s = 1) => sprites.draw(g, name, x * PX + tx, y * PX + ty, PX * s, PX * s);
  switch (landmark) {
    case 'tankard':
      at('roofRedL', 8, 0); at('roofRed', 24, 0); at('roofRedR', 40, 0);
      at('winWood', 8, 16); at('doorWood', 24, 16); at('winWood', 40, 16);
      at('tavernSign', 50, 30, 0.8); at('barrel', 2, 32, 0.7); at('barrel', 12, 34, 0.6); at('treeAutumnSmall', 30, 32, 0.8);
      break;
    case 'clock':
      at('battlementEnd', 0, -10); at('towerWindow', 0, 6); at('wallStone', 0, 16);
      clockFace(g, x * PX + 8, y * PX - 1, 4);
      break;
    case 'lighthouse':
      at('battlementEnd', 8, -6); at('wallStone', 8, 10); at('wallStoneDoor', 8, 26);
      g.fillStyle = '#ffe08a'; g.fillRect(x * PX + 13, y * PX - 4, 6, 4);
      g.fillStyle = 'rgba(255,224,138,0.25)'; g.fillRect(x * PX + 4, y * PX - 8, 24, 12);
      break;
    case 'docks':
      for (let i = 0; i < w; i++) { g.fillStyle = '#7a4f2c'; g.fillRect((x + i) * PX, y * PX + 4, PX, 8); g.fillStyle = '#9a6a3c'; g.fillRect((x + i) * PX + 1, y * PX + 5, PX - 2, 2); }
      at('barrel', 4, -2, 0.8); at('barrel', 14, 0, 0.8); if (w > 3) { at('pot', 30, 0, 0.8); at('log', 46, 0, 0.8); at('barrel', 62, -2, 0.8); }
      break;
    case 'shipwreck':
      sprites.drawVariant(g, 'boatBig', '#5a3a1a', 0.55, 'tint', x * PX, y * PX + 4, PX * 2, PX * 2, true);
      at('barrel', 30, 18, 0.6); at('log', 36, 4, 0.7);
      break;
    case 'fountain':
      g.fillStyle = '#8d877d'; g.fillRect(x * PX + 1, y * PX + 3, 14, 11);
      g.fillStyle = '#6fb6ff'; g.fillRect(x * PX + 3, y * PX + 5, 10, 7);
      g.fillStyle = '#dff4ff'; g.fillRect(x * PX + 7, y * PX + 1, 2, 6);
      break;
    case 'farmhouse':
      at('roofRedL', 2, 12); at('roofRedR', 18, 12); at('wallWood', 2, 28); at('doorWood', 18, 28);
      at('treeRound', 2, 44); at('well', 20, 46, 0.9); at('fencePost', 34, 50);
      break;
    case 'windmill': {
      at('wallStone', 16, 22); at('roofSlateGable', 16, 8);
      const cx = x * PX + 24, cy = y * PX + 14;
      g.strokeStyle = '#e9dcc0'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - 14, cy - 14); g.lineTo(cx + 14, cy + 14); g.moveTo(cx + 14, cy - 14); g.lineTo(cx - 14, cy + 14); g.stroke();
      g.lineWidth = 1;
      at('sprout', 0, 36); at('sprout', 34, 36);
      break;
    }
    case 'barn':
      at('roofRedGable', 8, 0); at('wallWoodDoor', 8, 16); at('barrel', 0, 18, 0.6); at('log', 22, 20, 0.6);
      break;
    case 'wall':
      for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
        const edge = ty === 0 || ty === h - 1 || tx === 0 || tx === w - 1;
        sprites.draw(g, edge ? 'wallStone' : 'castleC', (x + tx) * PX, (y + ty) * PX);
      }
      for (let tx = 0; tx < w; tx++) sprites.draw(g, 'battlement', (x + tx) * PX, (y + (y === 0 ? h - 1 : 0)) * PX);
      break;
    case 'pillar':
      for (let tx = 0; tx < w; tx++) { at('battlementEnd', tx * PX, -8); at('wallStone', tx * PX, 6, 0.7); }
      break;
  }
}

function clockFace(g, cx, cy, r) {
  g.fillStyle = '#3b2c20'; g.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r * 2 + 2);
  g.fillStyle = '#f2e6c8'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.fillStyle = '#3b2c20'; g.fillRect(cx, cy - r + 1, 1, r); g.fillRect(cx, cy, r - 1, 1);
}

// The keep: a 3×5 walled courtyard around the keep tiles, gate on the road row.
function drawKeep(g, K) {
  const x0 = (K.x - 1) * PX, y0 = (K.y - 1) * PX;
  const at = (name, tx, ty) => sprites.draw(g, name, x0 + tx * PX, y0 + ty * PX);
  at('castleTL', 0, 0); at('castleT', 1, 0); at('castleTR', 2, 0);
  at('castleL', 0, 1); at('castleC', 1, 1); at('castleR', 2, 1);
  at('gateTL', 1, 2); at('gateTR', 2, 2);
  at('castleL', 0, 3); at('castleC', 1, 3); at('castleR', 2, 3);
  at('castleBL', 0, 4); at('castleB', 1, 4); at('castleBR', 2, 4);
  at('towerWindow', 1, 1);
  sprites.draw(g, 'flagOrange', x0 + PX + 2, y0 - 10, 14, 14);
}

// ------------------------------------------------------------------ towers
const PLINTH = '#6f6a63', PLINTH_TOP = '#8d877d';
function plinth(g, x, y) {
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 2 * S, y + 13 * S, 12 * S, 3 * S);
  g.fillStyle = PLINTH; g.fillRect(x + 2 * S, y + 11 * S, 12 * S, 4 * S);
  g.fillStyle = PLINTH_TOP; g.fillRect(x + 2 * S, y + 11 * S, 12 * S, 1 * S);
}
const shadow = (g, x, y) => { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 1 * S, y + 13 * S, 14 * S, 3 * S); };

// dominant path (for looks) and highest tier from BTD5-style [a, b] tiers
export function towerLook(tiers = [0, 0]) {
  const [a, b] = tiers;
  if (!a && !b) return { path: null, tier: 0 };
  return a >= b ? { path: 0, tier: a } : { path: 1, tier: b };
}

// draw tower `type` whose tile top-left is (x, y) in world units
export function drawTower(g, type, x, y, tiers = [0, 0], t = 0, opts = {}) {
  const sp = (name, px, py, sc = 1, flip = false) => sprites.draw(g, name, x + px * S, y + py * S, PX * S * sc, PX * S * sc, flip);
  const tint = (name, color, amt, px, py, sc = 1, flip = false) => sprites.drawVariant(g, name, color, amt, 'tint', x + px * S, y + py * S, PX * S * sc, PX * S * sc, flip);
  const { path: branch, tier } = towerLook(tiers);
  switch (type) {
    case 'pike':
      plinth(g, x, y);
      sp(branch === 1 ? 'knightVisor' : 'knight', 0, -3);
      if (branch === 0) sp(tier >= 3 ? 'flagOrange' : 'flagRed', 7, -9, 0.7);
      if (branch === 1 && tier >= 2) { g.fillStyle = '#ffd35a'; g.fillRect(x + 7 * S, y + 5 * S, 2 * S, 2 * S); }
      break;
    case 'keg':
      shadow(g, x, y);
      g.fillStyle = '#5b3a1f'; g.fillRect(x + 2 * S, y + 6 * S, 2 * S, 8 * S); g.fillRect(x + 12 * S, y + 6 * S, 2 * S, 8 * S);
      g.fillStyle = '#8a5a30'; g.fillRect(x + 1 * S, y + 11 * S, 14 * S, 3 * S);
      g.fillStyle = '#6b4424'; g.fillRect(x + 3 * S, y + 5 * S, 11 * S, 2 * S);
      if (branch === 0) tint('barrel', '#6e7480', tier >= 3 ? 0.7 : 0.45, 3, -3 - tier, 0.7 + tier * 0.06);
      else sp('barrel', 3, -2, 0.7);
      if (branch === 1) { sp('barrel', -1, 6, 0.55); if (tier >= 2) sp('barrel', 10, 7, 0.5); }
      break;
    case 'bow':
      plinth(g, x, y);
      sp('ranger', 0, -3);
      sp(branch === 1 ? 'arrow' : 'bow', 8, 1, 0.6 + (branch === 1 ? tier * 0.08 : 0));
      if (branch === 0 && tier >= 2) sp('pickaxe', -3, 4, 0.5);
      break;
    case 'tap':
      shadow(g, x, y);
      sp('roofRedGable', 1, -8, 0.88); sp('doorWood', 1, 5, 0.88);
      sp('tavernSign', 10, 3, 0.55);
      if (branch === 1) sp('well', -3, 6, 0.55 + tier * 0.05);
      if (branch === 0) sp('barrel', -2, 8, 0.45 + tier * 0.05);
      break;
    case 'spinner': {
      plinth(g, x, y);
      const fire = branch === 0 && tier >= 3;
      sp(fire ? 'brazier' : 'barrel', 3, 0, 0.62);
      const n = branch === 1 && tier >= 2 ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a = t * (1.5 + tier * 0.4) + (i / n) * Math.PI * 2;
        sp(fire ? 'potionRed' : 'potionGreen', 5.5 + Math.cos(a) * 6, 2.5 + Math.sin(a) * 3, 0.32);
      }
      break;
    }
    case 'cellar':
      shadow(g, x, y);
      tint('wallStone', '#9fd8ff', 0.4, 1, 3, 0.88); tint('doorStone', '#6fa8d8', 0.4, 1, 3, 0.88);
      tint('battlement', '#cfeeff', 0.35, 1, -6, 0.88);
      g.fillStyle = 'rgba(220,245,255,0.8)';
      for (let i = 0; i < 3 + tier; i++) g.fillRect(x + ((i * 5 + t * 6) % 14 + 1) * S, y + ((i * 3 + t * 9) % 12 - 4) * S, S, S);
      break;
    case 'light': {
      shadow(g, x, y);
      sp('battlementEnd', 2, -10, 0.75); sp('wallStone', 2, -2, 0.75); sp('wallStoneDoor', 2, 6, 0.75);
      const a = t * 1.6 + x * 0.01;
      g.fillStyle = 'rgba(255,224,138,0.22)';
      g.beginPath(); g.moveTo(x + 8 * S, y - 7 * S);
      g.lineTo(x + 8 * S + Math.cos(a - 0.25) * 60, y - 7 * S + Math.sin(a - 0.25) * 60);
      g.lineTo(x + 8 * S + Math.cos(a + 0.25) * 60, y - 7 * S + Math.sin(a + 0.25) * 60);
      g.closePath(); g.fill();
      g.fillStyle = '#ffe08a'; g.fillRect(x + 6 * S, y - 8 * S, 4 * S, 2 * S);
      if (branch === 1) sp('coin', 10, 7, 0.45);
      break;
    }
    case 'hook':
      plinth(g, x, y);
      tint('brute', '#5a3a2a', 0.35, 0, -3);
      sp('sickle', 9, 1 + Math.sin(t * 4) * 0.8, 0.6);
      if (tier >= 3) sp('flagGrey', -2, -8, 0.6);
      break;
    case 'still': {
      shadow(g, x, y);
      sp('roofSlateGable', 1, -8, 0.88); sp('wallWood', 1, 5, 0.88);
      const toxic = branch === 0;
      sp(toxic ? 'potionGreen' : 'potionRed', 8, 6, 0.6);
      g.fillStyle = toxic ? 'rgba(120,230,120,0.45)' : 'rgba(210,210,210,0.45)';
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.6 + i / 3) % 1;
        g.fillRect(x + (4 + Math.sin(k * 6) * 1.5) * S, y + (-7 - k * 8) * S, 2 * S, 2 * S);
      }
      if (tier >= 2) { g.fillStyle = toxic ? '#6fe06f' : '#ff9b3d'; g.fillRect(x + 3 * S, y + 11 * S, 2 * S, 2 * S); }
      break;
    }
    case 'scout':
      plinth(g, x, y);
      tint('hooded', '#1a2a24', 0.4, 0, -3);
      sp('dagger', 9, 2, 0.5);
      if (tier >= 2) sp('dagger', -2, 3, 0.45, true);
      break;
    case 'ship': {
      const bob = Math.sin(t * 2 + x) * 0.6;
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 1 * S, y + 12 * S, 14 * S, 1 * S);
      sp(tier >= 3 ? 'boatOrangeBig' : 'boatOrange', -1, -1 + bob, 1.1);
      if (branch === 0 && tier >= 2) sp('flagGrey', 6, -9 + bob, 0.6);
      if (branch === 1) sp('coin', 10, -2 + bob, 0.4);
      break;
    }
    case 'caltrop':
      shadow(g, x, y);
      sp('roofSlateL', 0, -6, 0.6); sp('roofSlateR', 8, -6, 0.6);
      sp('wallWood', 0, 3, 0.6); sp('wallWoodDoor', 8, 3, 0.6);
      sp('anvil', 3, 8, 0.55);
      g.fillStyle = t % 0.5 < 0.08 ? '#ffd35a' : '#ff9b3d'; g.fillRect(x + 7 * S, y + 8 * S, S, S);
      break;
    case 'farm':
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) sp('sprout', i * 5, 6 + j * 4, 0.45);
      sp('roofRedGable', 8, -6, 0.6); sp('wallWoodDoor', 8, 3, 0.6);
      if (tier >= 2) sp(branch === 1 ? 'chest' : 'barrel', 0, -2, 0.45);
      break;
    case 'garrison':
      shadow(g, x, y);
      g.fillStyle = '#c9b089'; g.beginPath(); g.moveTo(x + 1 * S, y + 13 * S); g.lineTo(x + 7 * S, y + 2 * S); g.lineTo(x + 13 * S, y + 13 * S); g.fill();
      g.fillStyle = '#8a6a44'; g.fillRect(x + 6 * S, y + 8 * S, 2 * S, 5 * S);
      sp(branch === 1 ? 'flagOrange' : 'flagRed', 9, -6, 0.7);
      sp('shield', 10, 6, 0.45);
      break;
    case 'mortar':
      shadow(g, x, y);
      sp('gunOrange', 0, 0, 1);
      if (tier >= 2) sp('barrel', 10, 7, 0.4);
      break;
    case 'repeater':
      shadow(g, x, y);
      sp('gunGrey', 0, 0, 1);
      if (branch === 0 && tier >= 4) { g.fillStyle = '#ff5050'; g.fillRect(x + 12 * S, y + 5 * S, 3 * S, S); }
      break;
    case 'cloud':
      // the airstrip; the plane itself is drawn at the tower's orbit position
      g.fillStyle = '#5a5048'; g.fillRect(x + 1 * S, y + 6 * S, 14 * S, 5 * S);
      g.fillStyle = '#e9dcc0'; for (let i = 0; i < 3; i++) g.fillRect(x + (2 + i * 5) * S, y + 8 * S, 3 * S, S);
      if (opts.icon) sp('planeOrange', 1, -3, 0.9);
      break;
    case 'clock': {
      shadow(g, x, y);
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
    case 'witch': {
      plinth(g, x, y);
      g.fillStyle = `rgba(190,120,255,${0.25 + 0.12 * Math.sin(t * 3)})`;
      g.beginPath(); g.ellipse(x + 8 * S, y + 5 * S, 8 * S, 9 * S, 0, 0, 7); g.fill();
      tint('wizard', '#6a2a9a', 0.4, 0, -3);
      sp('staff', 9, -1, 0.6);
      break;
    }
    case 'hero': {
      plinth(g, x, y);
      const h = HEROES[opts.heroId] || HEROES.seamus;
      g.fillStyle = 'rgba(255,211,90,0.25)'; g.beginPath(); g.ellipse(x + 8 * S, y + 13 * S, 7 * S, 2 * S, 0, 0, 7); g.fill();
      sp(h.sprite, -1, -5, 1.1);
      g.fillStyle = '#ffd35a';
      g.fillRect(x + 5 * S, y - 5.5 * S, 6 * S, 1 * S);
      for (let i = 0; i < 3; i++) g.fillRect(x + (5 + i * 2.5) * S, y - 6.5 * S, 1 * S, 1 * S);
      if (opts.level) {
        g.fillStyle = '#3b2616'; g.fillRect(x + 11 * S, y + 9 * S, 5 * S, 4 * S);
        g.fillStyle = '#ffd35a'; g.font = `${4 * S}px "Kenney Pixel", monospace`; g.textBaseline = 'top';
        g.fillText(String(opts.level), x + 11.8 * S, y + 8.8 * S); g.textBaseline = 'alphabetic';
      }
      return;
    }
  }
  // tier pips: gold for the top path, pale blue for the bottom path
  let k = 0;
  for (let p = 0; p < 2; p++) for (let i = 0; i < tiers[p]; i++, k++) {
    g.fillStyle = '#2a1d12'; g.fillRect(x + (1.5 + k * 2.6) * S, y + 13.2 * S, 2.2 * S, 1.8 * S);
    g.fillStyle = p === 0 ? '#ffd35a' : '#9fd8ff'; g.fillRect(x + (1.9 + k * 2.6) * S, y + 13.6 * S, 1.4 * S, 1 * S);
  }
  if (opts.ghost) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = opts.ghost; g.fillRect(x - 8 * S, y - 14 * S, 32 * S, 32 * S);
    g.globalCompositeOperation = 'source-over';
  }
}

// the Cloudrunner's plane, drawn at its orbit position
export function drawPlane(g, tw, t) {
  const a = (tw.orbitA || 0) + Math.PI / 2;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(tw.x + 6, tw.y + 16, 12, 4, 0, 0, 7); g.fill();
  g.save(); g.translate(tw.x, tw.y); g.rotate(a);
  sprites.draw(g, 'planeOrange', -20, -20, 40, 40);
  g.restore();
}

// small canvas icon of a tower (or hero) for the DOM
export function towerIconURL(type, scale = 3, heroId) {
  const key = `icon|${type}|${scale}|${heroId || ''}`;
  if (sprites.cache.has(key)) return sprites.cache.get(key);
  const c = document.createElement('canvas');
  c.width = 20 * scale; c.height = 30 * scale;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(scale / S, scale / S);
  drawTower(g, type, 2 * S, 13 * S, [0, 0], 0.8, { icon: true, heroId });
  const url = c.toDataURL();
  sprites.cache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ enemies
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
  revivalist: { spr: 'wizard', tint: ['#e8e0f0', 0.5], sc: 2.0, prop: 'staff' },
  bagman: { spr: 'brute', sc: 2.5, prop: 'chest' },
  insurgent: { spr: 'villager', tint: ['#c23b8a', 0.55], sc: 1.8, prop: 'pitchfork' },
  warwagon: { spr: 'tankGrey', tint: ['#8a2a4a', 0.45], sc: 3.4, boss: true },
  fortress: { spr: 'watchTower', tint: ['#b0306a', 0.4], sc: 3.8, prop: 'sign', propAbove: true, boss: true },
  plinket: { spr: 'woman', sc: 3.4 },
};

// traits worth a badge (the rest show through the sprite itself)
const BADGE_TRAITS = ['armored', 'regrow', 'fortified', 'fast', 'hidden', 'elite'];

const mem = new Map();

export function drawEnemy(g, e, world, t, inspected, showBadges) {
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
  const moving = !(e.stunT > 0 || e.frozenT > 0);
  const bob = moving && !look.boss ? Math.abs(Math.sin(t * 9 + e.uid)) * 2.2 : 0;
  const fx = e.x - sz / 2, fy = e.y + 12 - sz - bob;

  g.fillStyle = 'rgba(0,0,0,0.28)';
  g.beginPath(); g.ellipse(e.x, e.y + 11, sz * 0.32, sz * 0.1, 0, 0, 7); g.fill();

  let alpha = vis ? 1 : 0.2 + 0.1 * Math.sin(t * 6 + e.uid);
  if (e.untargetable) alpha = 0.85;
  g.globalAlpha = alpha;

  if (e.boss) {
    const col = e.type !== 'plinket' ? 'rgba(255,95,176,' : e.phase === 1 ? 'rgba(180,120,255,' : e.phase === 2 ? 'rgba(255,95,176,' : 'rgba(255,60,60,';
    g.fillStyle = col + (0.18 + 0.08 * Math.sin(t * 4)) + ')';
    g.beginPath(); g.ellipse(e.x, e.y + 4, sz * 0.55, sz * 0.3, 0, 0, 7); g.fill();
  }
  const flip = look.boss ? !m.flip : m.flip; // vehicles face the other way on the sheet
  if (look.propAbove) sprites.draw(g, look.prop, e.x - sz * 0.28, fy - sz * 0.35, sz * 0.56, sz * 0.56);
  if (t < m.flash) sprites.drawVariant(g, look.spr, '#ffffff', 1, 'solid', fx, fy, sz, sz, flip);
  else if (e.type === 'plinket') {
    const tint = e.phase === 2 ? ['#40103a', 0.5] : e.phase === 3 ? ['#b0102a', 0.4] : null;
    if (tint) sprites.drawVariant(g, look.spr, tint[0], tint[1], 'tint', fx, fy, sz, sz, flip);
    else sprites.draw(g, look.spr, fx, fy, sz, sz, flip);
    g.fillStyle = e.phase === 3 ? '#ffd35a' : '#c9a0ff';
    const cx = e.x - sz * 0.14, cy = fy + sz * 0.02;
    g.fillRect(cx, cy, sz * 0.28, sz * 0.06);
    for (let i = 0; i < 3; i++) g.fillRect(cx + i * sz * 0.11, cy - sz * 0.06, sz * 0.06, sz * 0.06);
  } else if (e.frozenT > 0) sprites.drawVariant(g, look.spr, '#bfe8ff', 0.7, 'tint', fx, fy, sz, sz, flip);
  else if (look.tint) sprites.drawVariant(g, look.spr, look.tint[0], look.tint[1], 'tint', fx, fy, sz, sz, flip);
  else sprites.draw(g, look.spr, fx, fy, sz, sz, flip);

  if (look.prop && !look.propAbove) {
    const ps = sz * 0.5;
    sprites.draw(g, look.prop, m.flip ? fx - ps * 0.1 : fx + sz - ps * 0.9, fy + sz * 0.35, ps, ps, m.flip);
    if (look.prop === 'bomb' && Math.sin(t * 20) > 0) { g.fillStyle = '#ffd35a'; g.fillRect(m.flip ? fx : fx + sz - 4, fy + sz * 0.3, 3, 3); }
  }
  if (look.scroll) { g.fillStyle = '#f2e6c8'; g.fillRect(m.flip ? fx : fx + sz * 0.72, fy + sz * 0.45, sz * 0.22, sz * 0.26); g.fillStyle = '#3b2c20'; g.fillRect(m.flip ? fx + 2 : fx + sz * 0.72 + 2, fy + sz * 0.52, sz * 0.14, 1); }
  // armour sheen, regrow glow
  if (e.armored && vis) { g.strokeStyle = 'rgba(200,215,230,0.9)'; g.lineWidth = 2; g.strokeRect(fx + sz * 0.22, fy + sz * 0.1, sz * 0.56, sz * 0.8); g.lineWidth = 1; }
  if (e.regrow && vis) { g.fillStyle = `rgba(255,159,208,${0.25 + 0.15 * Math.sin(t * 5 + e.uid)})`; g.beginPath(); g.arc(e.x, fy + sz * 0.5, sz * 0.45, 0, 7); g.fill(); }
  g.globalAlpha = 1;
  if (!vis) {
    g.strokeStyle = 'rgba(200,230,190,0.5)'; g.setLineDash([3, 4]);
    g.beginPath(); g.ellipse(e.x, e.y, sz * 0.4, sz * 0.5, 0, 0, 7); g.stroke(); g.setLineDash([]);
  }

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
  if (e.slowT > 0) { g.fillStyle = '#e0b93c'; g.fillRect(e.x - sz * 0.45, fy + sz * 0.3 + ((t * 20) % 8), 2.5, 4); }
  if (e.markT > 0) {
    g.fillStyle = '#ff4040';
    const r = sz * 0.5, cy = fy + sz * 0.5;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.fillRect(e.x + dx * r - (dx > 0 ? 5 : 0), cy + dy * r - (dy > 0 ? 1.5 : 0), 5, 1.5);
      g.fillRect(e.x + dx * r - (dx > 0 ? 1.5 : 0), cy + dy * r - (dy > 0 ? 5 : 0), 1.5, 5);
    }
  }
  if (e.stunT > 0) { g.fillStyle = '#fff6b0'; g.fillRect(e.x - 5 + Math.sin(t * 10) * 5, top - 3, 3, 3); }
  if (e.def.soberAura && vis) { g.strokeStyle = 'rgba(200,225,255,0.14)'; g.beginPath(); g.arc(e.x, e.y, e.def.soberAura, 0, 7); g.stroke(); }
  if (inspected) {
    g.strokeStyle = '#ffe08a'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(e.x, e.y + 11, sz * 0.4, sz * 0.14, 0, 0, 7); g.stroke(); g.lineWidth = 1;
  }
  if (e.hp < e.maxHp && !e.boss) {
    const w = Math.max(18, sz * 0.7);
    g.fillStyle = '#1a0d0d'; g.fillRect(e.x - w / 2 - 1, top - 5, w + 2, 4);
    g.fillStyle = e.hp / e.maxHp > 0.5 ? '#6fd96f' : e.hp / e.maxHp > 0.25 ? '#ffd35a' : '#ff4a4a';
    g.fillRect(e.x - w / 2, top - 4, w * (e.hp / e.maxHp), 2);
  }
  if (showBadges && !e.boss) {
    let bx = e.x + sz * 0.3;
    for (const tr of BADGE_TRAITS) {
      if (!e.traits.has(tr) || (tr === 'fast' && e.type === 'zealot')) continue;
      traitBadge(g, tr, bx, top - 12, 9);
      bx += 10;
    }
  }
}

export function traitBadge(g, trait, x, y, s) {
  const T = TRAITS[trait];
  if (!T) return;
  g.fillStyle = '#1a0f08'; g.fillRect(x - 1, y - 1, s + 2, s + 2);
  g.fillStyle = T.color; g.fillRect(x, y, s, s);
  g.fillStyle = '#1a0f08'; g.font = `${s + 3}px "Kenney Pixel", monospace`; g.textBaseline = 'top'; g.textAlign = 'center';
  g.fillText(T.icon, x + s / 2, y - 2);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
}

export function pruneEnemyMemory(t) {
  if (mem.size < 200) return;
  for (const [k, m] of mem) if (t - m.seen > 2) mem.delete(k);
}

// ------------------------------------------------------------------ road items
export function drawItem(g, it, t) {
  if (it.type === 'stickyale') {
    const k = Math.min(1, it.life / 2);
    g.fillStyle = `rgba(224,185,60,${0.35 * k})`;
    g.beginPath(); g.ellipse(it.x, it.y, it.radius, it.radius * 0.6, 0, 0, 7); g.fill();
    g.fillStyle = `rgba(255,240,180,${0.4 * k})`; g.fillRect(it.x - 8, it.y - 4, 5, 2); g.fillRect(it.x + 6, it.y + 3, 4, 2);
  } else if (it.type === 'powderkeg') {
    sprites.drawVariant(g, 'barrel', '#3a2a2a', 0.45, 'tint', it.x - 12, it.y - 16, 24, 24, false);
    if (Math.sin(t * 16) > 0) { g.fillStyle = '#ffd35a'; g.fillRect(it.x + 2, it.y - 19, 3, 3); }
  } else {
    // caltrops / smithy piles: a scatter of spikes that thins as it's used
    const n = Math.max(2, Math.min(8, Math.ceil(it.hits / 3)));
    g.fillStyle = it.type === 'pile' ? '#c8c0b0' : '#b0b0b0';
    for (let i = 0; i < n; i++) {
      const a = i * 2.4, r = 3 + (i % 3) * 3;
      const px = it.x + Math.cos(a) * r, py = it.y + Math.sin(a) * r * 0.6;
      g.fillRect(px - 2, py, 5, 1); g.fillRect(px, py - 2, 1, 5);
    }
    if (it.explode) { g.fillStyle = '#ff9b3d'; g.fillRect(it.x - 1, it.y - 1, 3, 3); }
  }
}

// ------------------------------------------------------------------ projectiles & effects
export function drawProjectile(g, p, t) {
  const type = p.src?.type;
  const ang = p.kind === 'dart' ? Math.atan2(p.vy, p.vx) : Math.atan2((p.ty ?? p.y) - p.y, (p.tx ?? p.x) - p.x);
  const rot = (name, sz, a) => {
    g.save(); g.translate(p.x, p.y); g.rotate(a);
    sprites.draw(g, name, -sz / 2, -sz / 2, sz, sz);
    g.restore();
  };
  if (p.kind === 'shell') {
    if (type === 'still') rot('potionGreen', 16, t * 10);
    else if (type === 'mortar' || type === 'witch' || type === 'cloud') { g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(p.x, p.y, 5, 0, 7); g.fill(); }
    else rot('barrel', 18, t * 8);
    return;
  }
  if (p.kind === 'hook') { rot('sickle', 18, t * 14); return; }
  if (type === 'bow' || type === 'hero') { rot('arrow', 22, ang + Math.PI * 0.25); return; }
  if (type === 'tap') { g.fillStyle = '#e0b93c'; g.beginPath(); g.arc(p.x, p.y, 4, 0, 7); g.fill(); return; }
  if (type === 'spinner') { rot('potionGreen', 12, t * 12); return; }
  if (type === 'witch') { g.fillStyle = '#c9a0ff'; g.fillRect(p.x - 3, p.y - 3, 6, 6); g.fillStyle = '#fff'; g.fillRect(p.x - 1, p.y - 1, 2, 2); return; }
  if (p.dtype === 'explosive') { g.fillStyle = '#ff9b3d'; g.fillRect(p.x - 3, p.y - 3, 6, 6); return; }
  if (p.dtype === 'magic') { g.fillStyle = p.color || '#9fd8ff'; g.fillRect(p.x - 3, p.y - 3, 6, 6); return; }
  g.strokeStyle = type === 'repeater' ? '#ffe08a' : '#d8d0c0'; g.lineWidth = 2;
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
    if (!f.x && !f.y) { g.globalAlpha = 0.22 * (1 - k); g.fillRect(0, 0, W, H); } // screen flash
    else { g.globalAlpha = 0.5 * (1 - k); g.beginPath(); g.arc(f.x, f.y, 10 + 20 * k, 0, 7); g.fill(); } // local glint
  } else if (f.kind === 'ping') {
    g.fillRect(f.x - 3, f.y - k * 8, 2, 2); g.fillRect(f.x + 2, f.y - 2 - k * 8, 2, 2);
  }
  g.globalAlpha = 1; g.lineWidth = 1;
}

export function drawBarricade(g, b) {
  sprites.draw(g, 'fenceH', b.x - 22, b.y - 14, 22, 22);
  sprites.draw(g, 'fenceH', b.x, b.y - 14, 22, 22);
  g.fillStyle = '#ffe08a'; g.fillRect(b.x - 1, b.y - 18, 2, 6);
}

export function vignette(g) {
  const grd = g.createRadialGradient(W / 2, H / 2, H * 0.55, W / 2, H / 2, W * 0.7);
  grd.addColorStop(0, 'rgba(10,6,14,0)');
  grd.addColorStop(1, 'rgba(10,6,14,0.3)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ portraits
export function heroPortraitURL(id, scale = 3) { return sprites.dataURL(HEROES[id].sprite, scale); }

export function enemyPortraitURL(type) {
  const look = ENEMY_LOOK[type] || ENEMY_LOOK.zealot;
  return sprites.dataURL(look.spr, 4, look.tint);
}

// Thumbnail of a map for the map-select cards (drawn from its definition).
export function mapThumbURL(world, w = 256) {
  const key = `thumb|${world.mapId}|${w}`;
  if (sprites.cache.has(key)) return sprites.cache.get(key);
  const bg = buildPixelBackground(world);
  const c = document.createElement('canvas');
  c.width = w; c.height = Math.round((w * ROWS) / COLS);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(bg, 0, 0, c.width, c.height);
  const url = c.toDataURL();
  sprites.cache.set(key, url);
  return url;
}
