// Uniform-grid spatial hash for enemy range queries. Rebuilt once per tick;
// buckets are reused arrays so steady-state ticks allocate nothing.
export class SpatialHash {
  constructor(width, height, cell) {
    this.cell = cell;
    this.cols = Math.ceil(width / cell) + 2;
    this.rows = Math.ceil(height / cell) + 2;
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }
  clear() {
    for (const b of this.buckets) b.length = 0;
  }
  _idx(cx, cy) {
    cx = Math.min(this.cols - 1, Math.max(0, cx + 1));
    cy = Math.min(this.rows - 1, Math.max(0, cy + 1));
    return cy * this.cols + cx;
  }
  insert(e) {
    this.buckets[this._idx(Math.floor(e.x / this.cell), Math.floor(e.y / this.cell))].push(e);
  }
  // Calls fn(e) for every entity within r of (x, y). fn may return true to stop early.
  query(x, y, r, fn) {
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.buckets[this._idx(cx, cy)];
        for (let i = 0; i < b.length; i++) {
          const e = b[i];
          const dx = e.x - x, dy = e.y - y;
          if (dx * dx + dy * dy <= r2 && fn(e)) return;
        }
      }
    }
  }
}
