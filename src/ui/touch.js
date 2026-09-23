// Pointer-event gesture recognizer for the map canvas. Works for mouse, touch
// and pen: tap, long-press, one-finger drag (pan), two-finger pinch/pan, wheel
// zoom, mouse hover and right-click cancel.
const TAP_SLOP = 10; // px of movement before a press becomes a drag
const LONG_PRESS_MS = 450;

export class Gestures {
  // h: { tap(ev), longPress(ev), hover(ev), leave(), pan(dx, dy), pinch(factor, cx, cy), cancel() }
  constructor(el, h) {
    this.el = el;
    this.h = h;
    this.pts = new Map();
    this.mode = 'idle'; // idle | press | drag | pinch | done
    this.lpTimer = 0;
    this.last = null; // last pinch distance / midpoint

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') h.leave(); });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      h.pinch(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX, e.clientY);
    }, { passive: false });
    // iOS Safari: stop the page itself from pinch-zooming / scrolling under the map
    for (const t of ['touchstart', 'touchmove']) el.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  }

  down(e) {
    if (e.pointerType === 'mouse' && e.button === 2) { this.h.cancel(); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.el.setPointerCapture?.(e.pointerId);
    this.pts.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
    clearTimeout(this.lpTimer);
    if (this.pts.size === 1) {
      this.mode = 'press';
      this.lpTimer = setTimeout(() => {
        if (this.mode === 'press') { this.mode = 'done'; this.h.longPress(e); }
      }, LONG_PRESS_MS);
    } else if (this.pts.size === 2) {
      this.mode = 'pinch';
      this.last = this.pinchState();
    }
  }

  move(e) {
    const p = this.pts.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') this.h.hover(e);
      return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (e.pointerType === 'mouse') this.h.hover(e);
    if (this.mode === 'press' && Math.hypot(p.x - p.sx, p.y - p.sy) > TAP_SLOP) {
      this.mode = 'drag';
      clearTimeout(this.lpTimer);
    }
    if (this.mode === 'drag') this.h.pan(dx, dy);
    else if (this.mode === 'pinch' && this.pts.size >= 2) {
      const now = this.pinchState();
      if (this.last.d > 0) this.h.pinch(now.d / this.last.d, now.cx, now.cy);
      this.h.pan(now.cx - this.last.cx, now.cy - this.last.cy);
      this.last = now;
    }
  }

  up(e, cancelled = false) {
    if (!this.pts.has(e.pointerId)) return;
    this.pts.delete(e.pointerId);
    clearTimeout(this.lpTimer);
    if (!cancelled && this.mode === 'press') this.h.tap(e);
    if (this.pts.size === 0) this.mode = 'idle';
    else this.mode = 'done'; // lifting one finger of a pinch shouldn't tap or pan
  }

  pinchState() {
    const [a, b] = [...this.pts.values()];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }
}
