// Menus and modal screens: title, map & hero select, notes, settings,
// progress, leaderboard, doctrine choice, tips, victory, pause and run end.
import { World } from '../core/world.js';
import { TOWERS, TOWER_ORDER, TIER_XP } from '../data/towers.js';
import { HEROES, HERO_ORDER } from '../data/heroes.js';
import { MAPS, MAP_ORDER } from '../data/maps.js';
import { MANDATES } from '../data/mandates.js';
import { DOCTRINES } from '../data/doctrines.js';
import { ITEMS, ITEM_ORDER } from '../data/items.js';
import { towerStatus, tierCap, heroStatus, describeUnlock, bestWave, clears, runUnlocks, MILESTONES } from '../core/progress.js';
import { saveProfile, resetProfile } from './profile.js';
import { lbUrl, fetchTop, localTop, flushQueue } from './leaderboard.js';
import { sprites } from './sprites.js';
import { sfx } from './audio.js';
import { towerIconURL, heroPortraitURL, mapThumbURL } from './pixelart.js';
import { esc } from './hud.js';

const modal = () => document.getElementById('modal');
const n0 = (n) => Math.round(n).toLocaleString();

function show(html, bind, cls = '') {
  const m = modal();
  m.className = cls;
  m.innerHTML = cls.includes('full') ? html : `<div class="card">${html}</div>`;
  m.scrollTop = 0;
  bind?.(m);
}
export function hide() { modal().className = 'hidden'; modal().innerHTML = ''; }
export function isOpen() { return !modal().classList.contains('hidden'); }
const on = (el, sel, fn) => { const x = el.querySelector(sel); if (x) x.onclick = (ev) => { sfx.play('click', 0); fn(ev); }; };

// ------------------------------------------------------------------ title
export function titleScreen(app) {
  const p = app.profile;
  const best = bestWave(p);
  show(`<div class="title-screen">
      <canvas id="title-canvas"></canvas>
      <div class="title-ui">
        <h1 class="logo">Siege of Aleforge</h1>
        <div class="tagline">A Pintland Isles tower defense</div>
        <label class="namefield"><span>Your name</span><input id="pname" maxlength="20" autocomplete="nickname" placeholder="Name for the leaderboard" value="${esc(p.name)}"></label>
        <div class="menu">
          <button class="primary big" id="go-play">Play</button>
          <button id="go-tut">${p.tutorialDone ? 'Tutorial' : 'Tutorial (start here)'}</button>
          <button id="go-lb">Leaderboard</button>
          <button id="go-prog">Progress</button>
          <button id="go-set">Settings</button>
        </div>
        <div class="modes-toggle" role="radiogroup" aria-label="Mode">
          <button id="m-beg" class="${p.tips ? 'on' : ''}" title="The game pauses to explain each new tower and enemy the first time you meet it.">Beginner</button>
          <button id="m-exp" class="${p.tips ? '' : 'on'}" title="No pop-up tips. Same difficulty.">Experienced</button>
        </div>
        <div class="mode-note">${p.tips ? 'Tips pause the game the first time you meet a new tower or enemy.' : 'No tips. The siege is equally hard in both modes.'}</div>
        <div class="title-foot">${best ? `Best wave ${best} · ${p.totals.wins} victories · ${p.totals.runs} games` : 'No games yet'}</div>
      </div>
      <button class="note-btn" id="go-notes" title="How the game works"><span>📜</span> Notes</button>
    </div>`, (el) => {
    const input = el.querySelector('#pname');
    input.oninput = () => { p.name = input.value.replace(/[<>]/g, '').slice(0, 20); saveProfile(p); };
    on(el, '#go-play', () => {
      if (!p.tutorialDone && !p.totals.runs) confirmTutorial(app);
      else mapSelect(app);
    });
    on(el, '#go-tut', () => { hide(); app.startTutorial(); });
    on(el, '#go-lb', () => leaderboardScreen(app));
    on(el, '#go-prog', () => progressScreen(app));
    on(el, '#go-set', () => settingsScreen(app));
    on(el, '#go-notes', () => notesScreen(app, () => titleScreen(app)));
    const setMode = (tips) => { p.tips = tips; saveProfile(p); titleScreen(app); };
    on(el, '#m-beg', () => setMode(true));
    on(el, '#m-exp', () => setMode(false));
    new TitleScene(el.querySelector('#title-canvas'));
  }, 'full');
  flushQueue(p).catch(() => {});
}

function confirmTutorial(app) {
  show(`<h2>First siege?</h2><p>The tutorial is a short guided game (about 5 minutes) that covers building, upgrading, your hero, road items and the enemy traits that matter.</p>
    <div class="actions"><button class="primary" id="t-yes">Play the tutorial</button><button id="t-no">Skip, straight to a map</button></div>`, (el) => {
    on(el, '#t-yes', () => { hide(); app.startTutorial(); });
    on(el, '#t-no', () => { app.profile.tutorialDone = true; saveProfile(app.profile); mapSelect(app); });
  });
}

// Animated backdrop: the keep, the Tankard and a MAMA column marching past.
class TitleScene {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.t0 = performance.now();
    const loop = () => { if (!this.c.isConnected) return; this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  draw() {
    const c = this.c, g = this.g;
    const cw = c.clientWidth, ch = c.clientHeight;
    const k = Math.max(2, Math.ceil(Math.max(cw / 240, ch / 135)));
    const w = Math.ceil(cw / k), h = Math.ceil(ch / k);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    g.imageSmoothingEnabled = false;
    const t = (performance.now() - this.t0) / 1000;
    const sky = ['#1e1228', '#2a1830', '#46243c', '#6e3440', '#a4543e', '#d88a4a'];
    const band = Math.ceil((h * 0.62) / sky.length);
    sky.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * band, w, band); });
    g.fillStyle = '#f2d48a'; g.fillRect(Math.round(w * 0.72), Math.round(h * 0.34), 12, 12);
    for (let i = 0; i < 24; i++) { g.fillStyle = 'rgba(255,240,220,0.6)'; g.fillRect((i * 53) % w, (i * 29) % Math.round(h * 0.3), 1, 1); }
    const ground = Math.round(h * 0.62);
    g.fillStyle = '#2f3a22'; g.fillRect(0, ground, w, h - ground);
    if (!sprites.ready) return;
    for (let x = 0; x < w; x += 16) { sprites.draw(g, 'grass', x, ground); sprites.draw(g, 'grass', x, ground + 32); sprites.draw(g, 'grass', x, ground + 48); }
    for (let x = 0; x < w; x += 16) sprites.draw(g, x % 32 ? 'dirt' : 'dirt2', x, ground + 16);
    const kx = Math.round(w * 0.66);
    const at = (n, x, y) => sprites.draw(g, n, x, y);
    at('battlementL', kx, ground - 32); at('battlement', kx + 16, ground - 32); at('battlementR', kx + 32, ground - 32);
    at('wallStone', kx, ground - 16); at('gateTL', kx + 16, ground - 16); at('wallStone', kx + 32, ground - 16);
    sprites.draw(g, 'flagOrange', kx + 18, ground - 46 + Math.round(Math.sin(t * 3)), 14, 14);
    const tx = Math.round(w * 0.36);
    at('roofRedL', tx, ground - 32); at('roofRedR', tx + 16, ground - 32); at('winWood', tx, ground - 16); at('doorWood', tx + 16, ground - 16);
    sprites.draw(g, 'tavernSign', tx + 32, ground - 10, 12, 12);
    at('treePine', 6, ground - 30); at('treeRound', 20, ground - 18); at('treeAutumnSmall', Math.round(w * 0.52), ground - 12); at('treeSmall', w - 30, ground - 14);
    // the column marches left→right on the road and loops
    const marchers = ['matron', 'redhead', 'youth', 'hooded', 'villager', 'redhead', 'knight', 'baldman'];
    const span = w + 140;
    marchers.forEach((m, i) => {
      const x = ((t * 14 + i * 16) % span) - 60;
      const y = ground + 12 - Math.abs(Math.sin(t * 8 + i)) * 2;
      if (m === 'knight') sprites.drawVariant(g, m, '#8a1f2a', 0.6, 'tint', x, y, 14, 14, false);
      else sprites.draw(g, m, x, y, 14, 14);
      if (i === 2) sprites.draw(g, 'sign', x + 2, y - 9, 10, 10);
    });
    const px = ((t * 14 + marchers.length * 16 + 6) % span) - 60;
    sprites.draw(g, 'woman', px, ground + 6 - Math.abs(Math.sin(t * 6)) * 2, 20, 20);
    g.fillStyle = '#c9a0ff'; g.fillRect(px + 5, ground + 5, 8, 2);
    // the keep's defenders
    sprites.draw(g, 'knight', kx - 14, ground - 4, 14, 14);
    sprites.draw(g, 'viking', kx + 48, ground - 4, 14, 14, true);
    const grd = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(10,4,12,0.55)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }
}

// ------------------------------------------------------------------ map & hero select
export function mapSelect(app) {
  const p = app.profile;
  const cards = MAP_ORDER.map((id) => {
    const m = MAPS[id];
    const b = p.best[id];
    const thumb = sprites.ready ? `<img class="thumb" alt="" src="${mapThumbURL(new World({ headless: true, map: id, seed: 1 }))}">` : '';
    return `<button class="choice mapc" data-map="${id}">${thumb}<div class="cname">${esc(m.name)}</div>
      <div class="tier t${m.tierN}">${m.tier}</div><div class="ctext">${esc(m.desc)}</div>
      <div class="muted small">${b ? `Best: wave ${b.wave}${b.cleared ? ' · cleared ✓' : ''}` : 'Not played yet'}</div></button>`;
  }).join('');
  show(`<h2>Choose a map</h2>
    <div class="choices maps">${cards}<button class="choice mapc random" data-map="random"><div class="cname">Random</div><div class="ctext">Let the dice pick.</div><div class="dice">⚄</div></button></div>
    <div class="actions"><button id="back">Back</button></div>`, (el) => {
    el.querySelectorAll('[data-map]').forEach((c) => {
      c.onclick = () => {
        sfx.play('click', 0);
        const id = c.dataset.map === 'random' ? MAP_ORDER[Math.floor(Math.random() * MAP_ORDER.length)] : c.dataset.map;
        heroSelect(app, id);
      };
    });
    on(el, '#back', () => titleScreen(app));
  });
}

export function heroSelect(app, mapId) {
  const p = app.profile;
  const un = runUnlocks(p);
  let chosen = un.heroes.includes(app.lastHero) ? app.lastHero : un.heroes[0];
  const mand = new Set();
  show(`<h2>${esc(MAPS[mapId].name)} <span class="muted small">${MAPS[mapId].tier}</span></h2>
    <h3>Choose your hero</h3>
    <div class="choices heroes">${HERO_ORDER.map((id) => {
      const h = HEROES[id];
      const st = heroStatus(p, id);
      const img = sprites.ready ? `<img class="portrait" alt="" src="${heroPortraitURL(id)}">` : '';
      return `<button class="choice ${st.available ? '' : 'locked'}" data-hero="${id}" ${st.available ? '' : 'disabled'}>
        ${img}<div class="cname">${st.available ? '' : '🔒 '}${esc(h.name)}</div>
        <div class="ctext">${esc(h.desc)}</div>
        ${st.available ? `<div class="muted small">${h.abilities.map((a) => `Lv ${a.level}: <b>${esc(a.name)}</b>`).join(' · ')}</div>` : `<div class="muted small">${esc(st.label)}</div>`}
      </button>`;
    }).join('')}</div>
    ${un.mandates ? `<h3>Plinket's Mandates <span class="muted small">optional extra difficulty · heat <span id="heat">0</span></span></h3>
      <div class="choices mands">${Object.entries(MANDATES).map(([id, md]) => `<button class="choice small" data-mand="${id}"><div class="cname">${esc(md.name)}</div><div class="ctext">${esc(md.text)}</div></button>`).join('')}</div>` : ''}
    <div class="actions"><button class="primary" id="go">Start</button><button id="back">Back</button></div>`, (el) => {
    const sync = () => {
      el.querySelectorAll('[data-hero]').forEach((c) => c.classList.toggle('sel', c.dataset.hero === chosen));
      el.querySelectorAll('[data-mand]').forEach((c) => c.classList.toggle('sel', mand.has(c.dataset.mand)));
      const heat = el.querySelector('#heat');
      if (heat) heat.textContent = mand.size;
    };
    el.querySelectorAll('[data-hero]').forEach((c) => { c.onclick = () => { if (!c.disabled) { chosen = c.dataset.hero; sfx.play('click', 0); sync(); } }; });
    el.querySelectorAll('[data-mand]').forEach((c) => { c.onclick = () => { const id = c.dataset.mand; mand.has(id) ? mand.delete(id) : mand.add(id); sync(); }; });
    on(el, '#go', () => { app.lastHero = chosen; hide(); app.startRun({ map: mapId, hero: chosen, mandates: [...mand] }); });
    on(el, '#back', () => mapSelect(app));
    sync();
  });
}

// ------------------------------------------------------------------ notes (the rules, as a note)
export function notesScreen(app, back) {
  show(`<div class="note-paper"><h2>Notes on the Siege</h2><div class="help">
    <p><b>Goal.</b> MAMA marches on the keep in 30 waves, with a boss every 10. Hold all 30 to win, then keep going in <b>Freeplay</b>: the waves never stop getting harder. Your record is the highest wave you reach.</p>
    <p><b>Resolve</b> is your life total (20). Each enemy that reaches the keep costs 1–3; a boss costs all of it.</p>
    <p><b>Gold</b> comes from kills and from the pay at the end of each wave. Unspent gold earns 5% interest (capped). <b>Ale</b> pays for road items and comes in every wave.</p>
    <p><b>Towers</b> have two upgrade paths of four tiers. One path can reach tier 4; the other then stops at tier 2. Tiers 3 and 4 need <b>XP</b> with that tower, earned by dealing damage with it in any game.</p>
    <p><b>Unlocking towers.</b> Some unlock during every game at a certain wave. Others unlock for good once you earn XP with a related tower. The strongest need long-term milestones (see Progress).</p>
    <p><b>Enemy traits.</b> <i>Hidden</i>: only towers with detection can target it. <i>Armored</i>: sharp attacks do nothing; use explosive, fire, cold or magic, or Shred upgrades. <i>Regrow</i>: heals if left alone; fire stops it. <i>Fortified</i>: double health. Badges above enemies show their traits.</p>
    <p><b>Hero.</b> Pick one Liquor King per game and place them like a tower. They level up to 10 and gain abilities at levels 3 and 7.</p>
    <p><b>Road items</b> (Caltrops, Powder Keg, Sticky Ale) cost ale and go on the road. Three per wave.</p>
    <p><b>Morale.</b> Each district has morale. Pamphleteers and leaks lower it; holding waves raises it. Low morale cuts your pay, and under the line <b>insurgents rise inside your defences</b>.</p>
    <p><b>Bonds</b> give 150 gold now, repaid 5 waves later with interest. Failing to repay drops morale everywhere. <b>Doctrines</b> every 5 waves: pick one of three trade-offs.</p>
    ${app.touch ? '<p><b>Touch:</b> tap a tower in the bar, tap the map to preview, tap again (or ✓) to build. Tap a built tower for upgrades. Tap an enemy to inspect it. Pinch or double-tap to zoom, drag to pan. ☰ opens the panels.</p>'
      : '<p><b>Keys:</b> <kbd>1</kbd>–<kbd>0</kbd> <kbd>-</kbd> <kbd>=</kbd> <kbd>Q</kbd>–<kbd>U</kbd> towers · <kbd>H</kbd> hero · <kbd>C</kbd> <kbd>V</kbd> <kbd>N</kbd> road items · <kbd>Z</kbd>/<kbd>X</kbd> upgrade · <kbd>S</kbd> sell · <kbd>Tab</kbd> targeting · <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> abilities · <kbd>B</kbd> bond · <kbd>Space</kbd> send wave · <kbd>P</kbd> pause · <kbd>F</kbd> speed · <kbd>Esc</kbd> cancel.</p>'}
    </div></div><div class="actions"><button id="back">Close</button></div>`, (el) => { on(el, '#back', back || (() => hide())); });
}

// ------------------------------------------------------------------ settings
export function settingsScreen(app, back) {
  const p = app.profile;
  const url = lbUrl(p);
  show(`<h2>Settings</h2>
    <div class="setting"><b>Mode</b>
      <div class="modes-toggle"><button id="s-beg" class="${p.tips ? 'on' : ''}">Beginner (tips)</button><button id="s-exp" class="${p.tips ? '' : 'on'}">Experienced</button></div>
      <div class="muted small">Beginner pauses the game to explain each new tower and enemy the first time. The siege is equally hard in both.</div>
      <button id="s-retips">Show all tips again</button></div>
    <div class="setting"><b>Sound</b> <button id="s-sound">${sfx.muted ? 'Off' : 'On'}</button></div>
    <div class="setting"><b>Leaderboard URL</b>
      <input id="s-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(p.lbUrl || '')}">
      <div class="muted small">${url ? 'Scores are sent to the leaderboard at the end of each game.' : 'Paste the Apps Script web-app URL here (see tools/leaderboard/SETUP.md). Until then, scores stay on this device.'}</div></div>
    <div class="setting"><b>Progress</b> <button id="s-reset">Reset all progress</button></div>
    <div class="actions"><button class="primary" id="back">Done</button></div>`, (el) => {
    const setMode = (v) => { p.tips = v; saveProfile(p); settingsScreen(app, back); };
    on(el, '#s-beg', () => setMode(true));
    on(el, '#s-exp', () => setMode(false));
    on(el, '#s-retips', () => { p.seen = { towers: [], enemies: [], traits: [] }; saveProfile(p); el.querySelector('#s-retips').textContent = 'Tips reset ✓'; });
    on(el, '#s-sound', () => { sfx.setMuted(!sfx.muted); el.querySelector('#s-sound').textContent = sfx.muted ? 'Off' : 'On'; });
    el.querySelector('#s-url').onchange = (ev) => { p.lbUrl = ev.target.value.trim(); saveProfile(p); };
    on(el, '#s-reset', () => {
      if (confirm('Erase all tower XP, unlocks, bests and run history?')) { app.profile = resetProfile(p); settingsScreen(app, back); }
    });
    on(el, '#back', () => { p.lbUrl = el.querySelector('#s-url').value.trim(); saveProfile(p); (back || (() => titleScreen(app)))(); });
  });
}

// ------------------------------------------------------------------ progress
export function progressScreen(app) {
  const p = app.profile;
  const bar = (have, need) => `<span class="xpbar"><i style="width:${Math.min(100, (have / need) * 100)}%"></i></span>`;
  const towers = TOWER_ORDER.map((type) => {
    const def = TOWERS[type];
    const st = towerStatus(p, type);
    const xp = p.towerXP[type] || 0;
    const cap = tierCap(p, type);
    const icon = sprites.ready ? `<img class="ticon" alt="" src="${towerIconURL(type, 2)}">` : '';
    let unlock;
    if (st.available) unlock = '<span class="good">Unlocked</span>';
    else if (st.inRun) unlock = `<span>Every game from wave ${st.inRun}</span>`;
    else unlock = `<span>🔒 ${esc(st.label)}</span>${st.progress ? bar(...st.progress) + `<span class="muted small">${n0(st.progress[0])} / ${n0(st.progress[1])}</span>` : ''}`;
    const nextTier = cap < 4 ? TIER_XP[cap + 1] : null;
    const tiers = `<span class="muted small">Tiers 1–${cap}${nextTier ? ` · tier ${cap + 1} at ${n0(nextTier)} XP` : ' (all)'}</span>${nextTier ? bar(xp, nextTier) : ''}`;
    return `<div class="prow">${icon}<div class="pmain"><b>${esc(def.name)}</b><div class="unl">${unlock}</div></div><div class="pxp"><span>${n0(xp)} XP</span>${tiers}</div></div>`;
  }).join('');
  const heroes = HERO_ORDER.map((id) => {
    const st = heroStatus(p, id);
    return `<div class="prow"><div class="pmain"><b>${esc(HEROES[id].name)}</b><div class="unl">${st.available ? '<span class="good">Unlocked</span>' : `🔒 ${esc(st.label)}`}</div></div></div>`;
  }).join('');
  const maps = MAP_ORDER.map((id) => {
    const b = p.best[id];
    return `<span class="muted">${esc(MAPS[id].name)}</span><span>${b ? `wave ${b.wave}${b.cleared ? ' ✓' : ''}` : '—'}</span>`;
  }).join('');
  const ms = Object.entries(MILESTONES).map(([, m]) => { const [h, n] = m.progress(p); return `<div class="prow"><div class="pmain"><b>${esc(m.label)}</b>${bar(h, n)}<span class="muted small">${n0(Math.min(h, n))} / ${n0(n)}</span></div></div>`; }).join('');
  show(`<h2>Progress</h2>
    <div class="stats wide"><span class="muted">Games</span><span>${p.totals.runs}</span><span class="muted">Victories</span><span>${p.totals.wins}</span>
      <span class="muted">Waves survived</span><span>${n0(p.totals.waves)}</span><span class="muted">Enemies defeated</span><span>${n0(p.totals.kills)}</span>
      <span class="muted">Maps cleared</span><span>${clears(p)} / ${MAP_ORDER.length}</span>${maps}</div>
    <h3>Towers</h3><div class="muted small">XP = damage dealt with that tower ÷ 40, added up over every game.</div><div class="plist">${towers}</div>
    <h3>Milestones</h3><div class="plist">${ms}</div>
    <h3>Heroes</h3><div class="plist">${heroes}</div>
    <div class="actions"><button id="back">Back</button></div>`, (el) => { on(el, '#back', () => titleScreen(app)); });
}

// ------------------------------------------------------------------ leaderboard
export function leaderboardScreen(app, mapId = MAP_ORDER[0]) {
  const p = app.profile;
  const url = lbUrl(p);
  const tabs = MAP_ORDER.map((id) => `<button data-lbmap="${id}" class="${id === mapId ? 'on' : ''}">${esc(MAPS[id].name)}</button>`).join('');
  const table = (rows) => rows.length
    ? `<table class="runs"><tr><th>#</th><th>Name</th><th>Highest wave</th><th>Hero</th><th></th></tr>${rows.map((r, i) => `<tr class="${r.name === p.name ? 'me' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td><b>${r.wave}</b>${r.cleared ? ' ✓' : ''}</td><td>${esc(HEROES[r.hero]?.name.split(' ')[0] || '')}</td><td class="muted small">${esc(r.mode === 'experienced' ? 'exp.' : '')}</td></tr>`).join('')}</table>`
    : '<p class="muted">No scores yet.</p>';
  show(`<h2>Leaderboard</h2><div class="tabs">${tabs}</div><div id="lb-body">${url ? '<p class="muted">Loading…</p>' : ''}</div>
    <div class="actions"><button id="back">Back</button>${url ? '' : '<button id="lb-set">Set up the online leaderboard</button>'}</div>`, (el) => {
    el.querySelectorAll('[data-lbmap]').forEach((b) => { b.onclick = () => leaderboardScreen(app, b.dataset.lbmap); });
    on(el, '#back', () => titleScreen(app));
    on(el, '#lb-set', () => settingsScreen(app, () => leaderboardScreen(app, mapId)));
    const body = el.querySelector('#lb-body');
    const local = `<h3>On this device</h3>${table(localTop(p, mapId, 10))}`;
    if (!url) { body.innerHTML = `<p class="muted">The online leaderboard isn't set up yet. The game's owner deploys a small Google Sheet script and pastes its URL in Settings.</p>${local}`; return; }
    fetchTop(p, mapId, 25).then((rows) => {
      if (body.isConnected) body.innerHTML = `<h3>Everyone</h3>${table(rows)}${local}`;
    }).catch((e) => {
      if (body.isConnected) body.innerHTML = `<p class="warn">Couldn't reach the leaderboard (${esc(e.message)}).</p>${local}`;
    });
  });
}

// ------------------------------------------------------------------ in-game
export function doctrineScreen(app, world) {
  show(`<h2>Choose a doctrine</h2><p class="muted">Pick one. It lasts the rest of the game.</p>
    <div class="choices">${world.pendingDoctrine.map((id) => {
      const d = DOCTRINES[id];
      return `<button class="choice" data-doc="${id}"><div class="cname">${esc(d.name)}</div><div class="ctext">${esc(d.text)}</div></button>`;
    }).join('')}</div>`, (el) => {
    el.querySelectorAll('[data-doc]').forEach((b) => { b.onclick = () => { world.pickDoctrine(b.dataset.doc); sfx.play('click', 0); hide(); app.hud.buildBar(world); }; });
  });
}

export function tipCard(app, card, done) {
  show(`<div class="tipcard"><div class="kicker">${esc(card.kicker)}</div><h2>${esc(card.title)}</h2>${card.html}</div>
    <div class="actions"><button class="primary" id="ok">Got it</button><button id="notips">Turn off tips</button></div>`, (el) => {
    on(el, '#ok', () => { hide(); done(); });
    on(el, '#notips', () => { app.profile.tips = false; saveProfile(app.profile); app.tips.queue.length = 0; hide(); done(); });
    el.querySelector('#ok').focus();
  }, 'tip');
}

export function victoryScreen(app, world) {
  show(`<h1>Aleforge Stands!</h1><div class="sub">All ${world.campaignWaves} waves held · ${esc(world.map.def.name)}</div>
    <p>Susan Plinket is beaten. You can end here, or carry on into <b>Freeplay</b>: endless waves that keep getting harder. Your record is the highest wave you reach.</p>
    <div class="actions"><button class="primary" id="fp">Continue into Freeplay</button><button id="end">End the game</button></div>`, (el) => {
    on(el, '#fp', () => { hide(); app.continueFreeplay(); });
    on(el, '#end', () => { app.finishRun(); });
  });
}

export function pauseMenu(app) {
  show(`<h2>Paused</h2><div class="menu col">
    <button class="primary" id="resume">Resume</button><button id="notes">Notes</button><button id="settings">Settings</button>
    <button id="quit">${app.tutorial?.active ? 'Leave the tutorial' : 'End this game'}</button></div>`, (el) => {
    const again = () => pauseMenu(app);
    on(el, '#resume', () => hide());
    on(el, '#notes', () => notesScreen(app, again));
    on(el, '#settings', () => settingsScreen(app, again));
    on(el, '#quit', () => {
      if (app.tutorial?.active) { app.endTutorial(false); return; }
      if (confirm('End this game now? It counts as your result.')) app.finishRun();
    });
  });
}

// result: { xp: {type: gained}, unlocked: [keys] }, lb: 'sent' | 'queued' | 'local' | null
export function endScreen(app, world, result, lb) {
  const s = world.summary();
  const won = s.cleared;
  const head = s.freeplay ? `Freeplay ended on wave ${s.wave}` : won ? 'Victory' : `Fell on wave ${s.wave}`;
  const xpRows = Object.entries(result.xp).sort((a, b) => b[1] - a[1]).map(([type, g]) =>
    `<span class="muted">${esc(TOWERS[type].name)}</span><span>+${n0(g)} XP <span class="muted small">(${n0(app.profile.towerXP[type])})</span></span>`).join('');
  const lbText = { sent: 'Score sent to the leaderboard.', queued: "Couldn't reach the leaderboard; the score will be sent next time.", local: 'Saved on this device (online leaderboard not set up).' }[lb] || '';
  show(`<h1 class="${won || s.freeplay ? 'good' : 'bad'}">${won || s.freeplay ? 'Aleforge Stands' : 'Aleforge Has Fallen'}</h1>
    <div class="sub">${head} · ${esc(world.map.def.name)}</div>
    <div class="bigwave"><span>Highest wave</span><b>${s.wave}</b></div>
    <div class="stats wide">
      <span class="muted">Enemies defeated</span><span>${n0(s.kills)}</span><span class="muted">Got through</span><span>${s.leaks}</span>
      <span class="muted">Gold earned</span><span>${n0(s.goldEarned)}</span><span class="muted">Hero</span><span>${esc(HEROES[s.hero]?.name || '—')} (level ${s.heroLevel})</span>
      <span class="muted">Doctrines</span><span>${s.doctrines.map((d) => esc(DOCTRINES[d].name)).join(', ') || '—'}</span><span class="muted">Time</span><span>${Math.floor(s.time / 60)}m ${s.time % 60}s</span>
    </div>
    ${xpRows ? `<h3>Tower XP earned</h3><div class="stats wide">${xpRows}</div>` : ''}
    ${result.unlocked.length ? `<h3>Unlocked!</h3><ul class="unlocks">${result.unlocked.map((k) => `<li>${esc(describeUnlock(k))}</li>`).join('')}</ul>` : ''}
    <p class="muted small">${esc(lbText)}</p>
    <div class="actions"><button class="primary" id="again">Play again</button><button id="maps">Choose map</button><button id="lb">Leaderboard</button><button id="title">Title</button></div>`, (el) => {
    on(el, '#again', () => { hide(); app.startRun(app.lastRun); });
    on(el, '#maps', () => mapSelect(app));
    on(el, '#lb', () => leaderboardScreen(app, s.map));
    on(el, '#title', () => titleScreen(app));
  });
}

export { ITEMS, ITEM_ORDER };
