// Browser entry: fixed-timestep loop, input, and wiring between the world,
// HUD, screens, beginner tips, tutorial and leaderboard.
import { World } from '../core/world.js';
import { TILE } from '../core/map.js';
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { HEROES } from '../data/heroes.js';
import { ITEM_ORDER } from '../data/items.js';
import { runUnlocks, awardRun } from '../core/progress.js';
import { Renderer } from './render.js';
import { Hud, ITEM_KEYS, ABILITY_KEYS } from './hud.js';
import { loadProfile, saveProfile } from './profile.js';
import { submitScore } from './leaderboard.js';
import * as screens from './screens.js';
import { Tips } from './tips.js';
import { Tutorial, TUTORIAL_WAVES } from './tutorial.js';
import { Gestures } from './touch.js';
import { sprites } from './sprites.js';
import { sfx, SfxWatcher } from './audio.js';
import { music } from './music.js';
import { towerIconURL } from './pixelart.js';

const STEP = 1 / 60;
const MAX_STEPS = 24;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const TOUCH = params.has('touch') || matchMedia('(pointer: coarse)').matches;
const MODES = ['first', 'last', 'strong', 'close'];

class App {
  constructor() {
    this.canvas = $('game');
    this.renderer = new Renderer(this.canvas);
    this.profile = loadProfile();
    this.debugMode = params.has('debug');
    this.speeds = this.debugMode ? [1, 2, 3, 5, 8] : [1, 2, 3];
    this.touch = TOUCH;
    document.body.classList.toggle('touch', TOUCH);
    this.ui = this.freshUi();
    this.world = null;
    this.tutorial = null;
    this.backdrop = new World({ headless: true, seed: 1, map: 'aleforge' });
    this.hud = new Hud(this);
    this.tips = new Tips(this);
    this.acc = 0;
    this.last = performance.now();
    this.simMs = 0;
    this.debug = null;
    this.sfxWatch = new SfxWatcher();
    this.music = music;
    this.bindInput();
    sprites.load().then(() => {
      document.body.classList.toggle('pixel', sprites.ready);
      if (this.world) this.hud.buildBar(this.world);
      else if (sprites.ready && document.querySelector('#modal .title-screen')) screens.titleScreen(this);
    });
    document.fonts?.load('20px "Kenney Pixel"').catch(() => {});
    if (this.debugMode) import('./debug.js').then((m) => { this.debug = new m.Debug(this); if (this.world) this.debug.attach(this.world); });
    screens.titleScreen(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  freshUi() {
    return { placing: null, placingHero: false, targeting: null, aiming: null, selected: null, hover: null, mouse: null,
      hoverBuild: null, hoverEnemy: null, inspectType: null, speed: this.ui?.speed || 1, paused: false, touch: TOUCH };
  }

  // ------------------------------------------------------------------ runs
  startRun(opts) {
    this.lastRun = opts;
    const un = runUnlocks(this.profile);
    const seed = params.has('seed') ? Number(params.get('seed')) : undefined;
    const hero = un.heroes.includes(opts.hero) ? opts.hero : un.heroes[0];
    this.begin(new World({ seed, map: opts.map, hero, mandates: un.mandates ? opts.mandates || [] : [], unlocks: un }));
  }

  startTutorial() {
    const un = { towers: ['pike', 'keg', 'bow', 'tap'], tiers: {}, heroes: ['seamus'] };
    this.begin(new World({ seed: 7, map: 'cumstead', hero: 'seamus', unlocks: un, waves: TUTORIAL_WAVES, gold: 400 }));
    this.tutorial = new Tutorial(this);
  }

  endTutorial(completed) {
    this.tutorial?.close();
    this.tutorial = null;
    this.profile.tutorialDone = true;
    saveProfile(this.profile);
    this.world = null;
    if (completed) {
      this.showTip({ kicker: 'Tutorial complete', title: 'Ready for the siege',
        html: '<p>That\'s the core of it. Every tower has two upgrade paths; tiers 3–4 unlock as you earn XP with that tower across games. New towers unlock along the way, some during each game and some for good.</p><p>Start on <b>Cumstead Fields</b> (Beginner). Clear wave 30 to win, then see how far Freeplay goes.</p>' },
      () => screens.mapSelect(this));
    } else screens.titleScreen(this);
  }

  begin(world) {
    this.tutorial?.close();
    this.tutorial = null;
    this.world = world;
    this.ui = this.freshUi();
    this.ended = false;
    this.tips.queue.length = 0;
    this.renderer.resetView();
    this.renderer.bg = null;
    this.hud.start(world);
    this.debug?.attach(world);
    music.play('battle');
    this.closeDrawer();
    screens.hide();
    // tips for the towers the player starts with come when they first pick one
  }

  continueFreeplay() {
    const w = this.world;
    if (w?.continueFreeplay()) { this.ended = false; this.hud.buildBar(w); }
  }

  // Record the result, send the score, show the end screen.
  finishRun() {
    const w = this.world;
    if (!w || this.recorded === w) return;
    this.recorded = w;
    w.over = true;
    const s = w.summary();
    const tainted = this.debug?.tainted;
    const result = tainted ? { xp: {}, unlocked: [] } : awardRun(this.profile, s);
    // towers unlocked for good get a NEW! ribbon in the build bar next game
    for (const k of result.unlocked) if (k.startsWith('tower:') && !this.profile.fresh.includes(k.slice(6))) this.profile.fresh.push(k.slice(6));
    saveProfile(this.profile);
    if (tainted) { screens.endScreen(this, w, result, null); return; }
    screens.endScreen(this, w, result, null);
    submitScore(this.profile, s).then((lb) => { if (document.querySelector('#modal .bigwave')) screens.endScreen(this, w, result, lb); });
  }

  showTip(card, done) {
    screens.tipCard(this, card, done);
  }

  // ------------------------------------------------------------------ loop
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
        if (w.events.length) break; // handle events (tips pause) before simulating further
      }
      if (n >= MAX_STEPS) this.acc = 0;
      this.simMs = performance.now() - t0;
    }
    const t1 = performance.now();
    if (w) {
      this.handleEvents(w);
      this.renderer.draw(w, this.ui);
      this.hud.tick(w, this.ui);
      this.tutorial?.tick(w);
      this.sfxWatch.tick(w);
      $('paused').classList.toggle('hidden', !this.ui.paused || screens.isOpen());
      music.setDuck(this.ui.paused || (screens.isOpen() && !w.over));
      if (music.current === 'boss' && !w.over && !w.enemies.some((e) => e.alive && e.boss)) music.play('battle');
    } else {
      this.renderer.draw(this.backdrop, this.ui);
    }
    this.debug?.frame(dt, this.simMs, performance.now() - t1);
  }

  handleEvents(w) {
    for (const ev of w.events) {
      this.tutorial?.onEvent(ev);
      switch (ev.type) {
        case 'waveStart': this.banner(ev.text); sfx.play('wave', 0); break;
        case 'waveEnd': sfx.play('coin', 0); break;
        case 'boss': this.banner(ev.text); sfx.play('boss', 0); music.play('boss'); break;
        case 'unlock':
          this.hud.buildBar(w);
          if (ev.tower) this.unlockCallout(ev.tower);
          else this.hud.toast(ev.text, 'good');
          break;
        case 'newEnemy': this.tips.enemy(ev.enemy, ev.traits || []); break;
        case 'heroLevel': this.hud.toast(ev.text, 'good'); sfx.play('upgrade', 0); break;
        case 'ability': sfx.play('king', 0); break;
        case 'toast': this.hud.toast(ev.text, ev.warn ? 'warn' : ''); break;
        case 'doctrine':
          if (w.pendingDoctrine) { this.cancel(); screens.doctrineScreen(this, w); sfx.play('doctrine', 0); }
          break;
        case 'victory':
          sfx.play('victory', 0);
          music.stop(); music.sting('victory');
          if (this.tutorial) { this.endTutorial(true); break; }
          this.banner('ALEFORGE STANDS');
          setTimeout(() => { if (this.world === w && !w.freeplay) screens.victoryScreen(this, w); }, 1500);
          break;
        case 'defeat':
          sfx.play('defeat', 0);
          music.stop(); music.sting('defeat');
          if (this.tutorial) { this.hud.toast('The keep fell. Try the tutorial again from the title screen.', 'warn'); setTimeout(() => this.endTutorial(false), 2500); break; }
          this.banner(w.freeplay ? `FREEPLAY ENDS ON WAVE ${w.wave}` : 'THE KEEP HAS FALLEN');
          setTimeout(() => { if (this.world === w) this.finishRun(); }, 1800);
          break;
      }
    }
    w.events.length = 0;
  }

  // A tower became available mid-game: big callout, jingle, and a glowing
  // NEW! ribbon on its build-bar button until the player picks it.
  unlockCallout(type) {
    const w = this.world, def = TOWERS[type];
    const el = $('unlock');
    el.innerHTML = `<div class="uk">New tower unlocked!</div>${sprites.ready ? `<img alt="" src="${towerIconURL(type, 4)}">` : ''}
      <div class="un">${def.name}</div><div class="ud">${def.desc}</div><div class="uh">${this.touch ? 'Tap' : 'Click'} it in the build bar${this.touch ? '' : ` or press ${def.key.toUpperCase()}`}.</div>`;
    this.hud.fresh.add(type);
    this.hud.buildBar(w);
    $(`tb-${type}`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    // unlocks arrive with a wave start: let the "Wave N" banner clear first
    clearTimeout(this.unlockT);
    this.unlockT = setTimeout(() => {
      if (this.world !== w) return;
      el.classList.remove('show');
      void el.offsetWidth; // restart the pop-in animation
      el.classList.add('show');
      music.sting('unlock');
      this.unlockT = setTimeout(() => el.classList.remove('show'), 4200);
    }, 1500);
    setTimeout(() => { if (this.world === w) this.tips.tower(type, 'unlock'); }, 4000);
  }

  clearFresh(type) {
    if (!this.hud.fresh.delete(type)) return;
    this.profile.fresh = this.profile.fresh.filter((t) => t !== type);
    saveProfile(this.profile);
    $(`tb-${type}`)?.classList.remove('fresh');
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
      const d = (e.x - p.x) ** 2 + (e.y - p.y + 8) ** 2;
      if (e.alive && d < best) { best = d; found = e; }
    }
    return found;
  }

  // Click / tap on the map. Desktop acts at once; touch previews first and
  // confirms with a second tap on the same spot (or the ✓ button).
  tapMap(ev) {
    const w = this.world;
    if (!w) return;
    const p = this.toWorld(ev);
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    const ui = this.ui;
    const same = (a) => a && Math.hypot(a.x - p.x, a.y - p.y) < 30;
    if (ui.aiming || ui.targeting) {
      if (this.touch && !same(ui.mouse)) { ui.mouse = p; return; }
      this.confirmPoint(this.touch ? ui.mouse : p);
      return;
    }
    if (ui.placing || ui.placingHero) {
      const hit = ui.hover && ui.hover.tx === tx && ui.hover.ty === ty;
      if (this.touch && !hit) { ui.hover = { tx, ty }; return; }
      this.confirmBuild(tx, ty, ev.shiftKey);
      return;
    }
    const t = w.towerAt(tx, ty) || w.towers.find((o) => o.type === 'cloud' && Math.hypot(o.x - p.x, o.y - p.y) < 24);
    const e = this.enemyNear(p, this.touch ? 30 : 20);
    if (e && (!t || this.touch)) { this.inspect(e); return; }
    if (t) {
      ui.selected = t; ui.hoverEnemy = null; ui.inspectType = null;
      if (this.touch) this.openDrawer(t.hero ? 'hero' : 'info');
      sfx.play('click', 0);
      this.hud.lastPanels = 0;
      return;
    }
    ui.selected = null; ui.hoverEnemy = null; ui.inspectType = null;
    this.hud.lastPanels = 0;
    if (this.touch) {
      this.closeDrawer();
      const now = performance.now();
      if (this.lastEmptyTap && now - this.lastEmptyTap.t < 320 && Math.hypot(ev.clientX - this.lastEmptyTap.x, ev.clientY - this.lastEmptyTap.y) < 40) {
        const r = this.renderer;
        if (r.cam.z > 1.05) r.resetView(); else r.zoomAt(2, ev.clientX, ev.clientY);
        this.lastEmptyTap = null;
      } else this.lastEmptyTap = { t: now, x: ev.clientX, y: ev.clientY };
    }
  }

  inspect(e) {
    Object.assign(this.ui, { hoverEnemy: e, selected: null, inspectType: null, pinnedEnemy: true });
    if (this.touch) this.openDrawer('info');
    this.hud.lastPanels = 0;
  }

  confirmBuild(tx, ty, keep = false) {
    const w = this.world, ui = this.ui;
    if (ui.placingHero) {
      const why = w.canPlaceHero(tx, ty);
      if (!why) {
        ui.selected = w.placeHero(tx, ty);
        ui.placingHero = false; ui.hover = null;
        sfx.play('build');
        this.hud.buildBar(w);
      } else { this.hud.toast(this.hud.whyText(why), 'warn'); sfx.play('error', 0); }
      this.hud.lastPanels = 0;
      return;
    }
    const why = w.canPlace(ui.placing, tx, ty);
    if (!why) {
      const t = w.placeTower(ui.placing, tx, ty);
      sfx.play('build');
      if (!keep) { ui.placing = null; ui.selected = t; ui.hover = null; }
    } else { this.hud.toast(this.hud.whyText(why), 'warn'); sfx.play('error', 0); }
    this.hud.lastPanels = 0;
  }

  // a point for a road item, a targeted ability (barricade) or a tower's aim
  confirmPoint(p) {
    const w = this.world, ui = this.ui;
    if (!p) return;
    if (ui.aiming) {
      ui.aiming.aim = { x: p.x, y: p.y };
      ui.selected = ui.aiming; ui.aiming = null; ui.mouse = null;
      sfx.play('click', 0);
    } else if (ui.targeting.kind === 'item') {
      const why = w.canPlaceItem(ui.targeting.id, p.x, p.y);
      if (!why) { w.placeItem(ui.targeting.id, p.x, p.y); sfx.play('build'); ui.targeting = null; ui.mouse = null; }
      else { this.hud.toast(this.hud.whyText(why), 'warn'); sfx.play('error', 0); if (why !== 'road') ui.targeting = null; }
    } else {
      const { t, id } = ui.targeting;
      if (w.useAbility(t, id, p)) { ui.targeting = null; ui.mouse = null; }
      else { this.hud.toast('That has to go on the road.', 'warn'); sfx.play('error', 0); }
    }
    this.hud.lastPanels = 0;
  }

  confirmPending() {
    const ui = this.ui;
    if (ui.aiming || ui.targeting) this.confirmPoint(ui.mouse);
    else if ((ui.placing || ui.placingHero) && ui.hover) this.confirmBuild(ui.hover.tx, ui.hover.ty);
  }

  longPressMap(ev) {
    const p = this.toWorld(ev);
    const e = this.enemyNear(p, 36);
    const t = this.world?.towerAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    if (e) this.inspect(e);
    else if (t) { this.ui.selected = t; if (this.touch) this.openDrawer('info'); }
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
        if (!this.ui.pinnedEnemy || !this.ui.hoverEnemy?.alive) { this.ui.hoverEnemy = this.enemyNear(p, 18); this.ui.pinnedEnemy = false; }
      },
      leave: () => { if (!this.touch) { this.ui.hover = null; this.ui.mouse = null; } },
      pan: (dx, dy) => this.renderer.panBy(dx, dy),
      pinch: (f, cx, cy) => this.renderer.zoomAt(f, cx, cy),
      cancel: () => this.cancel(),
    });

    $('b-confirm').onclick = () => this.confirmPending();
    $('b-cancel').onclick = () => this.cancel();
    $('b-fit').onclick = () => this.renderer.resetView();
    $('b-help').onclick = () => { if (this.world) screens.notesScreen(this); };
    $('b-menu').onclick = () => { if (this.world) screens.pauseMenu(this); };
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

    document.addEventListener('visibilitychange', () => { if (document.hidden && this.world) this.ui.paused = true; });
    window.addEventListener('pagehide', () => { if (this.world) this.ui.paused = true; });
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    const unlock = () => { sfx.unlock(); music.resume(); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    const mute = $('b-mute');
    const syncMute = () => { mute.textContent = sfx.muted ? '🔇' : '🔊'; mute.classList.toggle('on', sfx.muted); };
    mute.onclick = () => { sfx.setMuted(!sfx.muted); syncMute(); };
    syncMute();
    const mus = $('b-music');
    const syncMusic = () => { mus.classList.toggle('on', music.muted); mus.title = music.muted ? 'Music off (Shift+M)' : 'Music on (Shift+M)'; };
    mus.onclick = () => { music.setMuted(!music.muted); syncMusic(); };
    this.syncMusic = syncMusic;
    syncMusic();
    $('b-speed').onclick = () => this.cycleSpeed();
    $('b-pause').onclick = () => { this.ui.paused = !this.ui.paused; };
    $('paused').onclick = () => { this.ui.paused = false; };
    $('b-send').onclick = () => this.sendWave();

    const delegate = (ev) => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled || !this.world) return;
      this.act(el.dataset.act, el.dataset);
    };
    for (const id of ['side', 'buildbar', 'abilities']) $(id).addEventListener('click', delegate);
    $('buildbar').addEventListener('mouseover', (ev) => {
      const el = ev.target.closest('[data-type]');
      this.ui.hoverBuild = el ? el.dataset.type : null;
    });
    $('buildbar').addEventListener('mouseleave', () => { this.ui.hoverBuild = null; });

    window.addEventListener('keydown', (ev) => this.key(ev));
  }

  key(ev) {
    if (ev.target.tagName === 'INPUT' || ev.metaKey || ev.ctrlKey) return;
    if (screens.isOpen()) {
      if (ev.key === 'Escape' && this.world && !this.world.over && !this.world.pendingDoctrine && !this.tips.open) screens.hide();
      return;
    }
    const w = this.world;
    if (!w) return;
    const k = ev.key.toLowerCase();
    const type = TOWER_ORDER.find((t) => TOWERS[t].key === k);
    if (type) { if (w.towerAvailable(type)) this.act('build', { type }); return; }
    const item = ITEM_ORDER.find((id) => ITEM_KEYS[id] === k);
    if (item) { this.act('item', { id: item }); return; }
    const ai = ABILITY_KEYS.indexOf(k);
    if (ai >= 0) { const a = w.abilityList()[ai]; if (a) this.act('ability', { tid: String(a.t.id), id: a.a.id }); return; }
    switch (k) {
      case ' ': ev.preventDefault(); this.sendWave(); break;
      case 'p': this.ui.paused = !this.ui.paused; break;
      case 'f': this.cycleSpeed(); break;
      case 'escape': this.cancel(); break;
      case 'z': this.act('up', { path: '0' }); break;
      case 'x': this.act('up', { path: '1' }); break;
      case 's': case 'delete': this.act('sell', {}); break;
      case 'tab': ev.preventDefault(); this.cycleMode(); break;
      case 'h': this.act('hero', {}); break;
      case 'b': this.act('bond', {}); break;
      case '?': screens.notesScreen(this); break;
      case 'm': (ev.shiftKey ? $('b-music') : $('b-mute')).click(); break;
    }
  }

  sendWave() {
    const w = this.world;
    if (w?.sendWave()) this.hud.lastPanels = 0;
  }

  cancel() {
    Object.assign(this.ui, { placing: null, placingHero: false, targeting: null, aiming: null, selected: null, hoverEnemy: null, inspectType: null, pinnedEnemy: false });
    if (this.touch) { this.ui.hover = null; this.ui.mouse = null; }
    this.hud.lastPanels = 0;
  }

  cycleSpeed() {
    const i = this.speeds.indexOf(this.ui.speed);
    this.ui.speed = this.speeds[(i + 1) % this.speeds.length];
  }

  cycleMode() {
    const t = this.ui.selected;
    if (!t || t.hero && t.s.kind === 'pulse') return;
    t.mode = MODES[(MODES.indexOf(t.mode) + 1) % MODES.length];
    this.hud.lastPanels = 0;
  }

  selectedTower() {
    const t = this.ui.selected;
    return t && this.world.towers.includes(t) ? t : null;
  }

  act(act, d) {
    const w = this.world, ui = this.ui;
    const t = this.selectedTower();
    const clearModes = () => Object.assign(ui, { placing: null, placingHero: false, targeting: null, aiming: null });
    switch (act) {
      case 'build': {
        if (!w.towerAvailable(d.type)) return;
        const was = ui.placing === d.type;
        clearModes();
        ui.placing = was ? null : d.type;
        ui.selected = null; ui.inspectType = null;
        if (this.touch) { ui.hover = null; this.closeDrawer(); }
        if (!was) { this.tips.tower(d.type); this.clearFresh(d.type); }
        sfx.play('click', 0);
        break;
      }
      case 'hero': {
        if (!w.heroId) return;
        if (w.hero) { ui.selected = w.hero; if (this.touch) this.openDrawer('hero'); break; }
        const was = ui.placingHero;
        clearModes();
        ui.placingHero = !was; ui.selected = null;
        if (this.touch) { ui.hover = null; this.closeDrawer(); }
        if (!was) this.tips.hero(w.heroId);
        break;
      }
      case 'item': {
        const was = ui.targeting?.kind === 'item' && ui.targeting.id === d.id;
        clearModes();
        if (!was) { ui.targeting = { kind: 'item', id: d.id }; this.tips.item(d.id); }
        ui.mouse = this.touch ? null : ui.mouse;
        if (this.touch) this.closeDrawer();
        break;
      }
      case 'ability': {
        const owner = w.towers.find((o) => String(o.id) === d.tid);
        if (!owner || !w.abilityReady(owner, d.id)) return;
        const a = owner.s.abilities.find((x) => x.id === d.id);
        if (a.targeted || d.id === 'barricade') {
          clearModes();
          ui.targeting = { kind: 'ability', id: d.id, t: owner };
          ui.mouse = this.touch ? null : ui.mouse;
          if (this.touch) this.closeDrawer();
        } else if (!w.useAbility(owner, d.id)) sfx.play('error', 0);
        break;
      }
      case 'up': if (t && !t.hero) { const ok = w.upgrade(t, Number(d.path)); sfx.play(ok ? 'upgrade' : 'error', 0); } break;
      case 'sell': if (t && !t.hero && w.sell(t)) { ui.selected = null; sfx.play('sell'); } break;
      case 'mode': if (t) { t.mode = d.mode; sfx.play('click', 0); } break;
      case 'aim':
        if (t) { clearModes(); ui.aiming = t; ui.mouse = this.touch ? null : ui.mouse; if (this.touch) this.closeDrawer(); }
        break;
      case 'unaim': if (t) t.aim = null; break;
      case 'bond': if (w.issueBond()) sfx.play('bond'); break;
      case 'inspect': ui.inspectType = d.type; ui.selected = null; break;
      case 'uninspect': ui.inspectType = null; break;
    }
    this.hud.lastPanels = 0;
  }
}

window.app = new App();
export { HEROES };
