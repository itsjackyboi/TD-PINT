// The Aleforge island chain. Aleforge "sits nestled upon a loose collection of
// coastal islands, still close enough to the shore to pass via bridge" — so the
// bridges between islands are the natural chokepoints.
export const TILE = 40, COLS = 32, ROWS = 18;
export const W = COLS * TILE, H = ROWS * TILE;

// rect = [x0, y0, x1, y1) in tiles
export const DISTRICTS = [
  { id: 'brewers', name: 'Brewers Lane', rect: [0, 0, 11, 8], node: [7, 3], nodePath: 'A' },
  { id: 'bazaar', name: 'Aleforge Bazaar', rect: [0, 10, 12, 18], node: [4, 15], nodePath: 'B' },
  { id: 'tankard', name: 'Tankard Square', rect: [14, 2, 23, 13], node: [19, 9], nodePath: 'A' },
  { id: 'castle', name: 'Castle Hill', rect: [25, 0, 32, 18], node: [27, 9], nodePath: 'A' },
];

// Waypoints in tile coords. Every path runs spawn → castle keep.
const COMMON = [[16, 9], [22, 9], [22, 4], [27, 4], [27, 14], [31, 14]];
export const PATH_DEFS = {
  A: { name: 'the north bridge', pts: [[3, -1], [3, 3], [10, 3], [10, 7], [16, 7], ...COMMON] },
  B: { name: 'the Bazaar road', pts: [[-1, 15], [7, 15], [7, 12], [15, 12], [15, 9], ...COMMON] },
  C: { name: 'the Owe Block causeway', pts: [[20, 18], [20, 11], [22, 11], ...COMMON.slice(1)] },
};
export const CASTLE = { x: 30, y: 13, w: 2, h: 3 };

class Path {
  constructor(id, def) {
    this.id = id;
    this.name = def.name;
    this.pts = def.pts.map(([x, y]) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE }));
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

export function buildMap() {
  const paths = {};
  for (const id in PATH_DEFS) paths[id] = new Path(id, PATH_DEFS[id]);

  // tile grid: -1 water, else district index
  const land = new Int8Array(COLS * ROWS).fill(-1);
  DISTRICTS.forEach((d, i) => {
    const [x0, y0, x1, y1] = d.rect;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) land[y * COLS + x] = i;
  });

  // path tiles, per path id (C only active under a mandate)
  const pathTile = { A: new Uint8Array(COLS * ROWS), B: new Uint8Array(COLS * ROWS), C: new Uint8Array(COLS * ROWS) };
  for (const id in PATH_DEFS) {
    const pts = PATH_DEFS[id].pts;
    for (let i = 1; i < pts.length; i++) {
      let [x, y] = pts[i - 1];
      const [bx, by] = pts[i];
      const sx = Math.sign(bx - x), sy = Math.sign(by - y);
      for (;;) {
        if (x >= 0 && y >= 0 && x < COLS && y < ROWS) pathTile[id][y * COLS + x] = 1;
        if (x === bx && y === by) break;
        x += sx; y += sy;
      }
    }
  }

  const isCastle = (tx, ty) => tx >= CASTLE.x - 1 && tx < CASTLE.x + CASTLE.w && ty >= CASTLE.y - 1 && ty < CASTLE.y + CASTLE.h + 1;
  const inBounds = (tx, ty) => tx >= 0 && ty >= 0 && tx < COLS && ty < ROWS;

  return {
    paths,
    land,
    pathTile,
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
    // A tile can take a tower if it's land, not path (any path — C is reserved even
    // when inactive so a mandate can't invalidate a layout), and not the keep.
    buildable(tx, ty) {
      if (!inBounds(tx, ty)) return false;
      const i = ty * COLS + tx;
      if (land[i] < 0) return false;
      if (pathTile.A[i] || pathTile.B[i] || pathTile.C[i]) return false;
      return !isCastle(tx, ty);
    },
  };
}
