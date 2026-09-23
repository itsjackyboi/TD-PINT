// Browser entry: fixed-timestep loop, input, and wiring between world, HUD and screens.
import { World } from '../core/world.js';
import { TILE, W, H } from '../core/map.js';
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { loadMeta, recordRun, worldUnlocks } from './meta.js';
import * as screens from './screens.js';
import { Gestures } from './touch.js';
import { sprites } from './sprites.js';
import { sfx, SfxWatcher } from './audio.js';

const STEP = 1 / 60;
const MAX_STEPS = 24;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
// touch UI: coarse pointer (phones/tablets) or forced with ?touch
const TOUCH = params.has('touch') || matchMedia('(pointer: coarse)').matches;

class App {
  constructor() {
    this.canvas = $('game');
    this.renderer = new Renderer(this.canvas);
    this.meta = loadMeta();
    this.debugMode = params.has('debug');
    this.speeds = this.debugMode ? [1, 2, 3, 5, 8] : [1, 2, 3];
    this.touch = TOUCH;
    document.body.classList.toggle('touch', TOUCH);
    this.ui = { placing: null, selected: null, hover: null, mouse: null, hoverBuild: null, hoverEnemy: null, kingTargeting: null, speed: 1, paused: false, touch: TOUCH };
    this.world = null;
    this.backdrop = new World({ headless: true, seed: 1 });
    this.backdrop.events.length = 0;
    this.hud = new Hud(this);
    this.acc = 0;
    this.last = performance.now();
    this.simMs = 0;
    this.debug = null;
    this.sfxWatch = new SfxWatcher();
    this.bindInput();
    // art loads in the background; until then (or if it fails) the geometric renderer draws
    sprites.load().then(() => {
      document.body.classList.toggle('pixel', sprites.ready);
      if (this.world) this.hud.buildBar(this.world);
      else if (sprites.ready && screens.isOpen() && !this.world) screens.titleScreen(this); // redraw with art
    });
    document.fonts?.load('20px "Kenney Pixel"').catch(() => {});
    if (this.debugMode) import('./debug.js').then((m) => { this.debug = new m.Debug(this); if (this.world) this.debug.attach(this.world); });
    screens.titleScreen(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  reloadMeta() { this.meta = loadMeta(); }

  startRun(kings, mandates) {
    const un = worldUnlocks(this.meta);
    const seed = params.has('seed') ? Number(params.get('seed')) : undefined;
    this.world = new World({ seed, kings, mandates, unlocks: { towers: un.towers, doctrines: un.doctrines } });
    Object.assign(this.ui, { placing: null, selected: null, kingTargeting: null, hover: null, mouse: null, hoverEnemy: null, paused: false, speed: 1 });
    this.renderer.resetView();
    this.ended = false;
    this.hud.log = [];
    this.hud.renderLog();
    this.hud.buildBar(this.world);
    this.renderer.bg = null;
    this.debug?.attach(this.world);
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const w = this.world;
    if (w && !w.over && !this.ui.paused && !screens.isOpen()) {
      const t0 = performance.now();
      this.acc += dt * this.ui.speed;
      let n = 0;
      while (this.acc >= STEP && n < MAX_STEPS) {
        this.debug?.beforeStep(STEP);
        w.update(STEP);
        this.acc -= STEP;
        n++;
      }
      if (n >= MAX_STEPS) this.acc = 0;
      this.simMs = performance.now() - t0;
    }
    const t1 = performance.now();
    if (w) {
      this.handleEvents(w);
      this.renderer.draw(w, this.ui);
      this.hud.tick(w, this.ui);
      this.sfxWatch.tick(w);
    } else {
      this.renderer.draw(this.backdrop, this.ui);
    }
    this.debug?.frame(dt, this.simMs, performance.now() - t1);
  }

  handleEvents(w) {
    for (const ev of w.events) {
      switch (ev.type) {
        case 'bbl': this.hud.pushLog(ev.text, ev.text.startsWith('SUSAN') || ev.text.startsWith('MINISTER') ? 'warn' : 'bbl'); break;
        case 'waveStart': this.banner(ev.text); this.hud.pushLog(ev.text); sfx.play('wave', 0); break;
        case 'boss': this.banner(ev.text); sfx.play('boss', 0); break;
        case 'doctrine': if (w.pendingDoctrine) { this.ui.placing = null; this.ui.kingTargeting = null; screens.doctrineScreen(this, w); sfx.play('doctrine', 0); } break;
        case 'defeat': case 'victory': this.endRun(w); sfx.play(ev.type, 0); break;
        case 'waveEnd': this.hud.pushLog(ev.text); sfx.play('coin', 0); break;
        default: this.hud.pushLog(ev.text);
      }
    }
    w.events.length = 0;
  }

  endRun(w) {
    if (this.ended) return;
    this.ended = true;
    this.banner(w.won ? 'ALEFORGE STANDS' : 'THE CASTLE HAS FALLEN');
    // debug-assisted runs don't count toward the Ledger
    const fresh = this.debug?.tainted ? [] : recordRun(this.meta, w.summary());
    setTimeout(() => screens.endScreen(this, w, fresh), 1800);
  }

  banner(text) {
    const b = $('banner');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => b.classList.remove('show'), 2200);
  }

  // ------------------------------------------------------------------ input
  toWorld(ev) { return this.renderer.toWorld(ev.clientX, ev.clientY); }

  enemyNear(p, radius) {
    const w = this.world;
    let best = radius * radius, found = null;
    if (!w) return null;
    for (const e of w.enemies) {
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (e.alive && d < best && w.visible(e)) { best = d; found = e; }
    }
    return found;
  }

  // Tap/click on the map. Desktop acts immediately; touch previews first and
  // confirms on a second tap of the same spot (or the ✓ button).
  tapMap(ev) {
    const w = this.world;
    if (!w) return;
    const p = this.toWorld(ev);
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    const ui = this.ui;
    if (ui.kingTargeting) {
      const same = ui.mouse && Math.hypot(ui.mouse.x - p.x, ui.mouse.y - p.y) < 30;
      if (this.touch && !same) { ui.mouse = p; return; }
      this.confirmKing(this.touch ? ui.mouse : p);
      return;
    }
    if (ui.placing) {
      const same = ui.hover && ui.hover.tx === tx && ui.hover.ty === ty;
      if (this.touch && !same) { ui.hover = { tx, ty }; return; }
      this.confirmBuild(tx, ty, ev.shiftKey);
      return;
    }
    const t = w.towerAt(tx, ty);
    if (t) {
      ui.selected = t;
      ui.hoverEnemy = null;
      if (this.touch) this.openDrawer('info');
      return;
    }
    ui.selected = null;
    if (this.touch) {
      const e = this.enemyNear(p, 26);
      ui.hoverEnemy = e;
      if (e) { this.openDrawer('info'); return; }
      this.closeDrawer();
      // double-tap empty ground: toggle 2x zoom around the tap
      const now = performance.now();
      if (this.lastEmptyTap && now - this.lastEmptyTap.t < 320 && Math.hypot(ev.clientX - this.lastEmptyTap.x, ev.clientY - this.lastEmptyTap.y) < 40) {
        const r = this.renderer;
        if (r.cam.z > 1.05) r.resetView(); else r.zoomAt(2, ev.clientX, ev.clientY);
        this.lastEmptyTap = null;
      } else this.lastEmptyTap = { t: now, x: ev.clientX, y: ev.clientY };
    }
  }

  confirmBuild(tx, ty, keep = false) {
    const w = this.world;
    const why = w.canPlace(this.ui.placing, tx, ty);
    if (!why) {
      const t = w.placeTower(this.ui.placing, tx, ty);
      sfx.play('build');
      if (!keep) { this.ui.placing = null; this.ui.selected = t; this.ui.hover = null; }
    } else if (why === 'gold' || why === 'ale') { this.hud.pushLog(`Not enough ${why}.`, 'warn'); sfx.play('error', 0); }
    else if (this.touch) this.hud.pushLog(why === 'occupied' ? 'Something is already built there.' : why === 'max' ? 'You have the maximum of those.' : 'You can only build on open land.', 'warn');
    this.hud.lastPanels = 0;
  }

  confirmKing(p) {
    if (!p) return;
    if (this.world.useKing(this.ui.kingTargeting, p)) { this.ui.kingTargeting = null; this.ui.mouse = null; sfx.play('king', 0); }
    else this.hud.pushLog('The barricade must go on the road.', 'warn');
    this.hud.lastPanels = 0;
  }

  // the ✓ on the touch confirm bar
  confirmPending() {
    const ui = this.ui;
    if (ui.kingTargeting) this.confirmKing(ui.mouse);
    else if (ui.placing && ui.hover) this.confirmBuild(ui.hover.tx, ui.hover.ty);
  }

  longPressMap(ev) {
    const p = this.toWorld(ev);
    const e = this.enemyNear(p, 34);
    const t = this.world?.towerAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    if (e) { this.ui.hoverEnemy = e; this.ui.selected = null; }
    else if (t) this.ui.selected = t;
    else return;
    if (this.touch) this.openDrawer('info');
    this.hud.lastPanels = 0;
  }

  openDrawer(tab) {
    if (tab) this.hud.setTab(tab);
    document.body.classList.add('drawer-open');
    this.hud.lastPanels = 0;
  }

  closeDrawer() { document.body.classList.remove('drawer-open'); }

  bindInput() {
    const c = this.canvas;
    new Gestures(c, {
      tap: (ev) => this.tapMap(ev),
      longPress: (ev) => this.longPressMap(ev),
      hover: (ev) => {
        if (this.touch && ev.pointerType !== 'mouse') return;
        const p = this.toWorld(ev);
        this.ui.mouse = p;
        this.ui.hover = { tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE) };
        this.ui.hoverEnemy = this.enemyNear(p, 18);
      },
      leave: () => { if (!this.touch) { this.ui.hover = null; this.ui.mouse = null; } },
      pan: (dx, dy) => this.renderer.panBy(dx, dy),
      pinch: (f, cx, cy) => this.renderer.zoomAt(f, cx, cy),
      cancel: () => this.cancel(),
    });

    $('b-confirm').onclick = () => this.confirmPending();
    $('b-cancel').onclick = () => this.cancel();
    $('b-fit').onclick = () => this.renderer.resetView();
    $('b-help').onclick = () => screens.helpScreen(this);
    $('b-drawer').onclick = () => document.body.classList.toggle('drawer-open');
    $('b-drawer-close').onclick = () => this.closeDrawer();
    const full = $('b-full');
    if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
      full.onclick = () => {
        const el = document.documentElement;
        if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        else {
          const req = el.requestFullscreen || el.webkitRequestFullscreen;
          Promise.resolve(req?.call(el, { navigationUI: 'hide' })).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
        }
      };
    } else full.classList.add('hidden');
    $('rotate-dismiss').onclick = () => $('rotate').classList.add('hidden');
    $('side-tabs').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-tab]');
      if (b) this.hud.setTab(b.dataset.tab);
    });

    // a phone going to sleep or switching apps pauses the siege
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.world) this.ui.paused = true; });
    window.addEventListener('pagehide', () => { if (this.world) this.ui.paused = true; });
    // iOS Safari page pinch-zoom (outside the canvas)
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const mute = $('b-mute');
    const syncMute = () => { mute.textContent = sfx.muted ? 'Muted' : 'Sound'; mute.classList.toggle('on', sfx.muted); };
    mute.onclick = () => { sfx.setMuted(!sfx.muted); syncMute(); };
    syncMute();
    $('b-speed').onclick = () => this.cycleSpeed();
    $('b-pause').onclick = () => { this.ui.paused = !this.ui.paused; };
    $('b-send').onclick = () => this.world?.sendWave();

    const delegate = (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled || !this.world) return;
      this.act(el.dataset.act, el.dataset);
    };
    $('side').addEventListener('click', delegate);
    $('buildbar').addEventListener('click', delegate);
    $('buildbar').addEventListener('mouseover', (ev) => {
      const el = ev.target.closest('[data-type]');
      this.ui.hoverBuild = el ? el.dataset.type : null;
    });
    $('buildbar').addEventListener('mouseleave', () => { this.ui.hoverBuild = null; });

    window.addEventListener('keydown', (ev) => {
      if (ev.target.tagName === 'INPUT') return;
      if (screens.isOpen()) return;
      const w = this.world;
      if (!w) return;
      const k = ev.key.toLowerCase();
      const type = TOWER_ORDER.find((t) => TOWERS[t].key === k);
      if (type) { this.act('build', { type }); return; }
      switch (k) {
        case ' ': ev.preventDefault(); w.sendWave(); break;
        case 'p': this.ui.paused = !this.ui.paused; break;
        case 'f': this.cycleSpeed(); break;
        case 'escape': this.cancel(); break;
        case 'z': this.act('up', { branch: '0' }); break;
        case 'x': this.act('up', { branch: '1' }); break;
        case 's': case 'delete': this.act('sell', {}); break;
        case 't': this.cycleMode(); break;
        case 'q': if (w.kings[0]) this.act('king', { id: w.kings[0] }); break;
        case 'w': if (w.kings[1]) this.act('king', { id: w.kings[1] }); break;
        case 'b': this.act('bond', {}); break;
        case 'h': case '?': screens.helpScreen(this); break;
        case 'm': $('b-mute').click(); break;
      }
    });
  }

  cancel() {
    Object.assign(this.ui, { placing: null, kingTargeting: null, selected: null, hoverEnemy: null });
    if (this.touch) { this.ui.hover = null; this.ui.mouse = null; }
  }

  cycleSpeed() {
    const i = this.speeds.indexOf(this.ui.speed);
    this.ui.speed = this.speeds[(i + 1) % this.speeds.length];
  }

  cycleMode() {
    const t = this.ui.selected;
    if (!t) return;
    const modes = ['first', 'last', 'strong', 'close'];
    t.mode = modes[(modes.indexOf(t.mode) + 1) % modes.length];
  }

  act(act, d) {
    const w = this.world;
    const t = this.ui.selected && w.towers.includes(this.ui.selected) ? this.ui.selected : null;
    switch (act) {
      case 'build':
        if (!w.towerUnlocked(d.type)) return;
        this.ui.placing = this.ui.placing === d.type ? null : d.type;
        this.ui.selected = null;
        this.ui.kingTargeting = null;
        if (this.touch) { this.ui.hover = null; this.closeDrawer(); }
        break;
      case 'up': if (t) sfx.play(w.upgrade(t, Number(d.branch)) ? 'upgrade' : 'error', 0); break;
      case 'sell': if (t && w.sell(t)) { this.ui.selected = null; sfx.play('sell'); } break;
      case 'mode': if (t) { t.mode = d.mode; sfx.play('click'); } break;
      case 'bond': if (w.issueBond()) sfx.play('bond'); break;
      case 'king': {
        const id = d.id;
        if (!w.kingReady(id)) return;
        if (id === 'jagerbauhm') {
          this.ui.kingTargeting = this.ui.kingTargeting === id ? null : id;
          this.ui.placing = null;
          this.ui.mouse = null;
          if (this.touch) this.closeDrawer();
        }
        else if (w.useKing(id)) sfx.play('king', 0);
        break;
      }
    }
    this.hud.lastPanels = 0; // refresh panels immediately
  }
}

window.app = new App();
