// Browser entry: fixed-timestep loop, input, and wiring between world, HUD and screens.
import { World } from '../core/world.js';
import { TILE, W, H } from '../core/map.js';
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { Renderer } from './render.js';
import { Hud } from './hud.js';
import { loadMeta, recordRun, worldUnlocks } from './meta.js';
import * as screens from './screens.js';

const STEP = 1 / 60;
const MAX_STEPS = 24;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

class App {
  constructor() {
    this.canvas = $('game');
    this.renderer = new Renderer(this.canvas);
    this.meta = loadMeta();
    this.debugMode = params.has('debug');
    this.speeds = this.debugMode ? [1, 2, 3, 5, 8] : [1, 2, 3];
    this.ui = { placing: null, selected: null, hover: null, mouse: null, hoverBuild: null, hoverEnemy: null, kingTargeting: null, speed: 1, paused: false };
    this.world = null;
    this.backdrop = new World({ headless: true, seed: 1 });
    this.backdrop.events.length = 0;
    this.hud = new Hud(this);
    this.acc = 0;
    this.last = performance.now();
    this.simMs = 0;
    this.debug = null;
    this.bindInput();
    if (this.debugMode) import('./debug.js').then((m) => { this.debug = new m.Debug(this); if (this.world) this.debug.attach(this.world); });
    screens.titleScreen(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  reloadMeta() { this.meta = loadMeta(); }

  startRun(kings, mandates) {
    const un = worldUnlocks(this.meta);
    const seed = params.has('seed') ? Number(params.get('seed')) : undefined;
    this.world = new World({ seed, kings, mandates, unlocks: { towers: un.towers, doctrines: un.doctrines } });
    Object.assign(this.ui, { placing: null, selected: null, kingTargeting: null, paused: false, speed: 1 });
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
    } else {
      this.renderer.draw(this.backdrop, this.ui);
    }
    this.debug?.frame(dt, this.simMs, performance.now() - t1);
  }

  handleEvents(w) {
    for (const ev of w.events) {
      switch (ev.type) {
        case 'bbl': this.hud.pushLog(ev.text, ev.text.startsWith('SUSAN') || ev.text.startsWith('MINISTER') ? 'warn' : 'bbl'); break;
        case 'waveStart': this.banner(ev.text); this.hud.pushLog(ev.text); break;
        case 'boss': this.banner(ev.text); break;
        case 'doctrine': if (w.pendingDoctrine) { this.ui.placing = null; screens.doctrineScreen(this, w); } break;
        case 'defeat': case 'victory': this.endRun(w); break;
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
  toWorld(ev) {
    const r = this.canvas.getBoundingClientRect();
    // the canvas keeps a 16:9 aspect inside its box; compute the drawn area
    const scale = Math.min(r.width / W, r.height / H);
    const ox = r.left + (r.width - W * scale) / 2, oy = r.top + (r.height - H * scale) / 2;
    return { x: (ev.clientX - ox) / scale, y: (ev.clientY - oy) / scale };
  }

  bindInput() {
    const c = this.canvas;
    c.addEventListener('mousemove', (ev) => {
      const p = this.toWorld(ev);
      this.ui.mouse = p;
      this.ui.hover = { tx: Math.floor(p.x / TILE), ty: Math.floor(p.y / TILE) };
      const w = this.world;
      this.ui.hoverEnemy = null;
      if (w) {
        let best = 18 * 18;
        for (const e of w.enemies) {
          const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
          if (e.alive && d < best && w.visible(e)) { best = d; this.ui.hoverEnemy = e; }
        }
      }
    });
    c.addEventListener('mouseleave', () => { this.ui.hover = null; this.ui.mouse = null; });
    c.addEventListener('contextmenu', (ev) => { ev.preventDefault(); this.cancel(); });
    c.addEventListener('mousedown', (ev) => {
      if (ev.button !== 0 || !this.world) return;
      const w = this.world;
      const p = this.toWorld(ev);
      const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
      if (this.ui.kingTargeting) {
        if (w.useKing(this.ui.kingTargeting, p)) this.ui.kingTargeting = null;
        else this.hud.pushLog('The barricade must go on the road.', 'warn');
        return;
      }
      if (this.ui.placing) {
        const why = w.canPlace(this.ui.placing, tx, ty);
        if (!why) {
          const t = w.placeTower(this.ui.placing, tx, ty);
          if (!ev.shiftKey) { this.ui.placing = null; this.ui.selected = t; }
        } else if (why === 'gold' || why === 'ale') this.hud.pushLog(`Not enough ${why}.`, 'warn');
        return;
      }
      this.ui.selected = w.towerAt(tx, ty);
    });

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
      }
    });
  }

  cancel() {
    this.ui.placing = null;
    this.ui.kingTargeting = null;
    this.ui.selected = null;
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
        break;
      case 'up': if (t) w.upgrade(t, Number(d.branch)); break;
      case 'sell': if (t && w.sell(t)) this.ui.selected = null; break;
      case 'mode': if (t) t.mode = d.mode; break;
      case 'bond': w.issueBond(); break;
      case 'king': {
        const id = d.id;
        if (!w.kingReady(id)) return;
        if (id === 'jagerbauhm') { this.ui.kingTargeting = this.ui.kingTargeting === id ? null : id; this.ui.placing = null; }
        else w.useKing(id);
        break;
      }
    }
    this.hud.lastPanels = 0; // refresh panels immediately
  }
}

window.app = new App();
