// Map geometry built from a definition in src/data/maps.js.
import { MAPS } from '../data/maps.js';

export const TILE = 40, COLS = 32, ROWS = 18;
export const W = COLS * TILE, H = ROWS * TILE;

class Path {
  constructor(id, pts) {
    this.id = id;
    this.pts = pts.map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }));
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      this.cum.push(this.cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.total = this.cum[this.cum.length - 1];
  }
  // Writes position at distance d into out; returns out.
  posAt(d, out) {
    if (d <= 0) { out.x = this.pts[0].x; out.y = this.pts[0].y; return out; }
    if (d >= this.total) { const p = this.pts[this.pts.length - 1]; out.x = p.x; out.y = p.y; return out; }
    let i = 1;
    while (this.cum[i] < d) i++;
    const a = this.pts[i - 1], b = this.pts[i];
    const t = (d - this.cum[i - 1]) / (this.cum[i] - this.cum[i - 1]);
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    return out;
  }
  // Distance along path of the closest point to (x, y).
  distOf(x, y) {
    let best = Infinity, bestD = 0;
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1], b = this.pts[i];
      const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
      const px = a.x + dx * t, py = a.y + dy * t;
      const dd = (px - x) ** 2 + (py - y) ** 2;
      if (dd < best) { best = dd; bestD = this.cum[i - 1] + Math.sqrt(len2) * t; }
    }
    return bestD;
  }
}

const inRect = (x, y, [x0, y0, x1, y1]) => x >= x0 && y >= y0 && x < x1 && y < y1;

export function buildMap(mapId = 'aleforge') {
  const def = MAPS[mapId] || MAPS.aleforge;
  const N = COLS * ROWS;
  // terrain: 0 water, 1 land, 2 islet (decorative land)
  const terrain = new Uint8Array(N).fill(1);
  for (const r of def.water) for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) terrain[y * COLS + x] = 0;
  for (const r of def.land) for (let y = r[1]; y < r[3]; y++) for (let x = r[0]; x < r[2]; x++) terrain[y * COLS + x] = 1;
  for (const { rect } of def.islets) for (let y = rect[1]; y < rect[3]; y++) for (let x = rect[0]; x < rect[2]; x++) terrain[y * COLS + x] = 2;

  // district index per land tile (-1 = none)
  const land = new Int8Array(N).fill(-1);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
    if (terrain[y * COLS + x] !== 1) continue;
    const di = def.districts.findIndex((d) => inRect(x, y, d.rect));
    land[y * COLS + x] = di >= 0 ? di : 0;
  }

  const pathDefs = { ...def.paths };
  if (def.extraPath) pathDefs[def.extraPath.id] = def.extraPath.pts;
  const paths = {};
  const pathTile = {};
  for (const id in pathDefs) {
    paths[id] = new Path(id, pathDefs[id]);
    const pt = new Uint8Array(N);
    const pts = pathDefs[id];
    for (let i = 1; i < pts.length; i++) {
      let [x, y] = pts[i - 1];
      const [bx, by] = pts[i];
      const sx = Math.sign(bx - x), sy = Math.sign(by - y);
      for (;;) {
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) pt[y * COLS + x] = 1;
        if (x === bx && y === by) break;
        x += sx; y += sy;
      }
    }
    pathTile[id] = pt;
  }
  const anyPath = new Uint8Array(N);
  for (const id in pathTile) for (let i = 0; i < N; i++) anyPath[i] |= pathTile[id][i];

  const blocked = new Uint8Array(N);
  for (const { rect } of def.blocked) for (let y = rect[1]; y < rect[3]; y++) for (let x = rect[0]; x < rect[2]; x++) blocked[y * COLS + x] = 1;

  const K = def.keep;
  const isCastle = (tx, ty) => tx >= K.x - 1 && tx < K.x + K.w && ty >= K.y - 1 && ty < K.y + K.h + 1;
  const inBounds = (tx, ty) => tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;

  return {
    id: def.id,
    def,
    paths,
    baseLanes: Object.keys(def.paths),
    extraLane: def.extraPath ? def.extraPath.id : null,
    land,
    terrain,
    pathTile,
    anyPath,
    blocked,
    districts: def.districts,
    keep: K,
    isCastle,
    inBounds,
    districtAt(x, y) {
      const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
      if (!inBounds(tx, ty)) return -1;
      return land[ty * COLS + tx];
    },
    isPath(tx, ty, activePaths) {
      for (const id of activePaths) if (pathTile[id][ty * COLS + tx]) return true;
      return false;
    },
    // Tower footing: 'land' towers need open land; 'water' towers (ships) need open water.
    // Path tiles are reserved even when a lane is inactive, so a mandate can't break a layout.
    buildable(tx, ty, on = 'land') {
      if (!inBounds(tx, ty)) return false;
      const i = ty * COLS + tx;
      if (anyPath[i] || blocked[i] || isCastle(tx, ty)) return false;
      return on === 'water' ? terrain[i] === 0 : terrain[i] === 1;
    },
  };
}
