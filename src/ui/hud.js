// DOM side panels, top bar and build bar. Panels rebuild on a short throttle and
// use event delegation (data-act attributes), so rebuilding never loses handlers.
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { KINGS } from '../data/kings.js';
import { DISTRICTS } from '../core/map.js';
import { sprites } from './sprites.js';
import { towerIconURL, enemyPortraitURL } from './pixelart.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Only touch the DOM when content changed: rebuilding a button under a finger
// mid-press would swallow the tap on touch screens.
const setHTML = (el, html) => { if (el._html !== html) { el._html = html; el.innerHTML = html; } };
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

export class Hud {
  constructor(app) {
    this.app = app;
    this.touch = app.touch;
    this.log = [];
    this.lastPanels = 0;
    this.buildMorale();
    this.setTab('info');
  }

  // keyboard hint, hidden on touch devices
  key(s) { return this.touch ? '' : s; }

  // touch drawer shows one panel at a time
  setTab(tab) {
    this.tab = tab;
    document.querySelectorAll('#side-tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('#side [data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === tab));
    this.lastPanels = 0;
  }

  buildMorale() {
    $('morale').innerHTML = DISTRICTS.map((d, i) =>
      `<div class="mbar" title="${esc(d.name)} morale. Below the line, insurgents rise inside your defenses."><span id="m-name-${i}">${esc(d.name.split(' ').pop())}</span>
        <div class="track"><div class="fill" id="m-fill-${i}"></div><div class="thresh" id="m-th-${i}"></div></div></div>`).join('');
  }

  buildBar(world) {
    $('buildbar').innerHTML = TOWER_ORDER.map((type) => {
      const def = TOWERS[type];
      const locked = !world.towerUnlocked(type);
      const icon = sprites.ready ? `<img class="ticon" alt="" src="${towerIconURL(type)}">` : '';
      return `<button class="tb" data-act="build" data-type="${type}" id="tb-${type}" ${locked ? 'disabled title="Locked — see the Ledger"' : ''}>
        ${icon}<span class="tlabel">${this.key(`<span class="key">[${def.key}]</span>`)}<span class="tname">${locked ? '🔒 ' : ''}${esc(def.name)}</span><span class="tshort">${locked ? '🔒 ' : ''}${esc(def.short)}</span>
        <span class="tcost">${world.cost(def.cost)}g${def.aleCost ? ` + ${def.aleCost} ale` : ''}</span></span></button>`;
    }).join('');
  }

  pushLog(text, cls = '') {
    this.log.unshift({ text, cls });
    this.log.length = Math.min(this.log.length, 14);
    this.renderLog();
  }

  renderLog() {
    $('log').innerHTML = this.log.map((l) => `<div class="${l.cls}">${esc(l.text)}</div>`).join('');
  }

  // cheap per-frame numbers
  tick(world, ui) {
    $('r-gold').textContent = Math.floor(world.gold);
    $('r-ale').textContent = Math.floor(world.ale);
    $('r-resolve').textContent = world.resolve;
    $('r-wave').textContent = `${world.wave}/30`;
    const th = world.mods.moraleThreshold;
    world.morale.forEach((m, i) => {
      const f = $(`m-fill-${i}`);
      f.style.width = `${m}%`;
      f.className = 'fill' + (m < th ? ' bad' : m < th + 15 ? ' warn' : '');
      $(`m-th-${i}`).style.left = `${th}%`;
    });
    $('b-speed').textContent = `${ui.speed}×`;
    $('b-pause').textContent = ui.paused ? 'Resume' : 'Pause';
    $('b-pause').classList.toggle('on', ui.paused);
    const send = $('b-send');
    send.disabled = !world.canSendWave();
    send.textContent = world.activeWaves.length && world.canSendWave() ? 'Call Early' : 'Send Wave';
    for (const type of TOWER_ORDER) {
      const b = $(`tb-${type}`);
      if (!b) continue;
      b.classList.toggle('on', ui.placing === type);
    }

    this.confirmBar(world, ui);

    const now = performance.now();
    if (now - this.lastPanels > 150) {
      this.lastPanels = now;
      this.panels(world, ui);
    }
  }

  confirmBar(world, ui) {
    const bar = $('confirm');
    const show = this.touch && (ui.placing || ui.kingTargeting);
    bar.classList.toggle('hidden', !show);
    if (!show) return;
    let text, ok = false, label = '✓ Build';
    if (ui.kingTargeting) {
      label = '✓ Barricade';
      ok = !!ui.mouse;
      text = ui.mouse ? 'Barricade here? Tap again or ✓.' : "Tap the road for Jagerbauhm's barricade.";
    } else {
      const def = TOWERS[ui.placing];
      const cost = `${world.cost(def.cost)}g${def.aleCost ? ` + ${def.aleCost} ale` : ''}`;
      if (!ui.hover) text = `${def.short}: ${cost}. Tap open land to preview.`;
      else {
        const why = world.canPlace(ui.placing, ui.hover.tx, ui.hover.ty);
        ok = !why;
        text = why ? { gold: 'Not enough gold.', ale: 'Not enough ale.', blocked: "Can't build there.", occupied: 'Already built there.', max: 'Maximum reached.', locked: 'Locked.' }[why] : `${def.short} here for ${cost}? Tap again or ✓.`;
      }
    }
    const t = $('confirm-text');
    if (t.textContent !== text) t.textContent = text;
    const b = $('b-confirm');
    b.disabled = !ok;
    if (b.textContent !== label) b.textContent = label;
  }

  panels(world, ui) {
    const p = world.incomePreview(world.wave + (world.activeWaves.length ? 0 : 1));
    $('r-income').textContent = `${p.income + p.interest + p.springGold}g · ${p.ale} ale`;
    $('r-income').title = `Tithes ${p.income} (scaled by average morale) + interest ${p.interest} (5% of banked gold, cap ${p.cap}) + spring ${p.springGold}`;
    setHTML($('p-info'), this.infoHtml(world, ui));
    const sel = ui.selected;
    if (sel && $('t-dmg')) { $('t-dmg').textContent = Math.round(sel.dmg); $('t-kills').textContent = sel.kills; }
    setHTML($('kings'), world.kings.map((id) => {
      const k = KINGS[id], st = world.kingState[id];
      const key = this.key(world.kings.indexOf(id) === 0 ? '[Q] ' : '[W] ');
      const cd = st.cd > 0 ? ` (${Math.ceil(st.cd)}s)` : k.once && st.used ? ' (spent)' : '';
      const on = ui.kingTargeting === id ? ' on' : '';
      return `<div class="king"><button class="${on}" data-act="king" data-id="${id}" ${world.kingReady(id) ? '' : 'disabled'}>
        ${key}<b>${esc(k.ability)}</b> — ${world.kingCost(id)} ale${cd}</button>
        <div class="kdesc">${esc(k.name)}, “${esc(k.title)}”. ${esc(k.text)}</div></div>`;
    }).join(''));
    const q = world.bondQuote();
    setHTML($('bonds'), `<div class="row"><span>+${q.principal}g now → repay <b>${q.due}g</b> after wave ${q.dueWave}</span></div>
      <div class="muted" style="font-size:11px;margin:3px 0">${Math.round(q.rate * 100)}% interest, rising 15% per issue. Can't pay → default: every district −40 morale.</div>
      <button data-act="bond" ${world.canIssueBond() ? '' : 'disabled'}>Issue Bond${this.key(' [B]')}</button>
      ${world.bonds.length ? '<div style="margin-top:6px">' + world.bonds.map((b) => `<div class="row"><span>Due after wave ${b.dueWave}</span><b style="color:var(--red)">${b.due}g</b></div>`).join('') + '</div>' : ''}`);
    const L = world.letter;
    setHTML($('letter'), L
      ? `<div class="muted" style="margin-bottom:4px">Re: wave ${L.wave}${L.verified ? `<span class="tag ${L.verified === 'AUTHENTIC' ? 'auth' : 'forged'}">${L.verified}</span>` : ''}</div>
         <div class="ltext">${esc(L.text)}<div class="sig">${esc(L.sig)}</div></div>`
      : '<div class="muted">No further letters. This is the end, one way or another.</div>');
  }

  infoHtml(world, ui) {
    const t = ui.selected && world.towers.includes(ui.selected) ? ui.selected : null;
    if (t) return this.towerPanel(world, t);
    const type = ui.placing || ui.hoverBuild;
    if (type) return this.towerInfo(world, type);
    if (ui.hoverEnemy && ui.hoverEnemy.alive) return this.enemyInfo(world, ui.hoverEnemy);
    if (this.touch) {
      return `<h3>Orders</h3><div class="muted">Tap a tower in the bottom bar, then tap open land to preview it and tap again to build.
        Tap a built tower to upgrade or sell it. Long-press an enemy to inspect it. Pinch or double-tap to zoom, drag to pan.</div>`;
    }
    return `<h3>Orders</h3><div class="muted">Select a tower below (<kbd>1</kbd>–<kbd>7</kbd>) and click the land to build.
      Click a tower to upgrade it. <kbd>Space</kbd> sends the next wave, <kbd>P</kbd> pauses (you can build while paused),
      <kbd>F</kbd> changes speed. Hover an enemy to inspect it.</div>`;
  }

  statsHtml(world, s, t) {
    const rows = [];
    if (s.attack === 'global') rows.push(['Chime every', `${fmt(1 / s.rate)}s`], ['Slow', `${Math.round(s.slow * 100)}% for ${s.slowDur}s`]);
    else {
      if (s.dmg) rows.push(['Damage', fmt(s.dmg)]);
      rows.push(['Rate', `${fmt(s.rate)}/s`], ['Range', Math.round(s.range)]);
      if (s.dmg && s.attack !== 'pulse') rows.push(['DPS', fmt(s.dmg * s.rate)]);
    }
    if (s.pierce) rows.push(['Armor pierce', s.pierce]);
    if (s.splash) rows.push(['Splash', s.splash]);
    if (s.burn) rows.push(['Burn', `${s.burn}/s for ${s.burnDur}s`]);
    if (s.slow && s.attack !== 'global') rows.push(['Slow', `${Math.round(s.slow * 100)}%`]);
    if (s.mark) rows.push(['Mark', `+${Math.round(s.mark * 100)}% dmg taken ×${s.marks}`]);
    if (s.detect) rows.push(['Detects', 'Infiltrators']);
    if (s.knockback) rows.push(['Knockback', `${s.knockback}px`]);
    if (s.penetrate) rows.push(['Penetrates', s.penetrate]);
    if (s.aura) rows.push(['Aura', `+${Math.round(s.aura.rate * 100)}% rate${s.aura.dmg ? `, +${Math.round(s.aura.dmg * 100)}% dmg` : ''}`]);
    if (s.aleIncome) rows.push(['Ale / wave', `+${s.aleIncome}`]);
    if (s.goldIncome) rows.push(['Gold / wave', `+${s.goldIncome}`]);
    if (s.moraleCost) rows.push(['District morale', `−${s.moraleCost}/wave`]);
    if (s.minRange) rows.push(['Min range', s.minRange]);
    // live numbers go in spans updated by textContent so the panel's buttons aren't rebuilt
    if (t) rows.push(['Damage dealt', '<span id="t-dmg"></span>'], ['Kills', '<span id="t-kills"></span>']);
    return `<div class="stats">${rows.map(([a, b]) => `<span class="muted">${a}</span><span>${b}</span>`).join('')}</div>`;
  }

  towerInfo(world, type) {
    const def = TOWERS[type];
    return `<h3>Build</h3><div class="row"><b>${esc(def.name)}</b><span style="color:var(--gold)">${world.cost(def.cost)}g${def.aleCost ? ` + ${def.aleCost} ale` : ''}</span></div>
      <div class="flavor">${esc(def.flavor)}</div>${def.ale ? '<div class="muted">Ale tower: Temperance Matrons halve its fire rate.</div>' : ''}
      ${def.max ? `<div class="muted">Max ${def.max}.</div>` : ''}
      ${this.statsHtml(world, { ...def.base, range: (def.base.range || 0) * (1 + world.mods.rangeMult) })}
      <div class="muted">Branches: ${def.branches.map((b) => esc(b.name)).join(' / ')}</div>`;
  }

  towerPanel(world, t) {
    const def = t.def;
    const status = [];
    if (t.disabledT > 0) status.push(`<span style="color:#ff9b3d">Disabled ${Math.ceil(t.disabledT)}s</span>`);
    if (t.soberT > 0) status.push('<span style="color:#9fd8ff">Sobered</span>');
    if (t.turnedT > 0) status.push('<span style="color:var(--pink)">Turned by J.R.</span>');
    const modes = def.base.attack === 'pulse' || def.base.attack === 'global' ? '' :
      `<div class="modes">${['first', 'last', 'strong', 'close'].map((m) => `<button data-act="mode" data-mode="${m}" class="${t.mode === m ? 'on' : ''}">${m}</button>`).join('')}</div>`;
    const branches = def.branches.map((b, i) => {
      const lockedOut = t.branch != null && t.branch !== i;
      const next = t.tier < 3 && !lockedOut ? b.tiers[t.tier] : null;
      const c = next ? world.upgradeCost(t, i) : null;
      const key = this.key(i === 0 ? '[Z] ' : '[X] ');
      return `<div class="branch ${lockedOut ? 'locked' : ''}"><div class="bname">${esc(b.name)}</div>
        <div class="muted" style="font-size:11px">${esc(b.flavor)}</div>
        ${next ? `<button data-act="up" data-branch="${i}" ${world.gold >= c ? '' : 'disabled'}>${key}${esc(next.name)} — ${c}g</button>`
          : `<div class="muted" style="font-size:11px;margin-top:4px">${lockedOut ? 'Other branch chosen' : 'Fully upgraded'}</div>`}</div>`;
    }).join('');
    return `<h3>${esc(def.name)}</h3>
      <div class="row"><span>${t.branch != null ? esc(def.branches[t.branch].name) + ' · ' : ''}Tier ${t.tier}</span><span>${status.join(' ')}</span></div>
      ${this.statsHtml(world, t.s, t)}${modes}<div class="branches">${branches}</div>
      <div style="margin-top:8px"><button data-act="sell" ${world.mods.noSell ? 'disabled title="Old Aleforge Historic Act"' : ''}>Sell for ${world.sellValue(t)}g${this.key(' [S]')}</button></div>`;
  }

  enemyInfo(world, e) {
    const d = e.def;
    const portrait = sprites.ready ? `<img alt="" src="${enemyPortraitURL(e.type)}" style="float:left;width:48px;height:48px;image-rendering:pixelated;margin:0 8px 4px 0">` : '';
    return `<h3>MAMA</h3>${portrait}<div class="row"><b>${esc(d.name)}</b><span>${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)} hp</span></div>
      <div class="flavor">${esc(d.desc)}</div>
      <div class="stats"><span class="muted">Armor</span><span>${d.armor}</span><span class="muted">Speed</span><span>${d.speed}</span>
      <span class="muted">Leak cost</span><span>${d.boss ? 'Everything' : d.leak + ' resolve'}</span><span class="muted">Shield</span><span>${Math.round(e.shield)}</span></div>`;
  }
}

