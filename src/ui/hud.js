// DOM side panels, top bar and build bar. Panels rebuild on a short throttle and
// use event delegation (data-act attributes), so rebuilding never loses handlers.
import { TOWERS, TOWER_ORDER } from '../data/towers.js';
import { KINGS } from '../data/kings.js';
import { DISTRICTS } from '../core/map.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);

export class Hud {
  constructor(app) {
    this.app = app;
    this.log = [];
    this.lastPanels = 0;
    this.buildMorale();
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
      return `<button class="tb" data-act="build" data-type="${type}" id="tb-${type}" ${locked ? 'disabled title="Locked — see the Ledger"' : ''}>
        <span class="key">[${def.key}]</span><span class="tname">${locked ? '🔒 ' : ''}${esc(def.name)}</span>
        <span class="tcost">${world.cost(def.cost)}g${def.aleCost ? ` + ${def.aleCost} ale` : ''}</span></button>`;
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

    const now = performance.now();
    if (now - this.lastPanels > 150) {
      this.lastPanels = now;
      this.panels(world, ui);
    }
  }

  panels(world, ui) {
    const p = world.incomePreview(world.wave + (world.activeWaves.length ? 0 : 1));
    $('r-income').textContent = `${p.income + p.interest + p.springGold}g · ${p.ale} ale`;
    $('r-income').title = `Tithes ${p.income} (scaled by average morale) + interest ${p.interest} (5% of banked gold, cap ${p.cap}) + spring ${p.springGold}`;
    $('p-info').innerHTML = this.infoHtml(world, ui);
    $('kings').innerHTML = world.kings.map((id) => {
      const k = KINGS[id], st = world.kingState[id];
      const key = world.kings.indexOf(id) === 0 ? 'Q' : 'W';
      const cd = st.cd > 0 ? ` (${Math.ceil(st.cd)}s)` : k.once && st.used ? ' (spent)' : '';
      const on = ui.kingTargeting === id ? ' on' : '';
      return `<div class="king"><button class="${on}" data-act="king" data-id="${id}" ${world.kingReady(id) ? '' : 'disabled'}>
        [${key}] <b>${esc(k.ability)}</b> — ${world.kingCost(id)} ale${cd}</button>
        <div class="kdesc">${esc(k.name)}, “${esc(k.title)}”. ${esc(k.text)}</div></div>`;
    }).join('');
    const q = world.bondQuote();
    $('bonds').innerHTML = `<div class="row"><span>+${q.principal}g now → repay <b>${q.due}g</b> after wave ${q.dueWave}</span></div>
      <div class="muted" style="font-size:11px;margin:3px 0">${Math.round(q.rate * 100)}% interest, rising 15% per issue. Can't pay → default: every district −40 morale.</div>
      <button data-act="bond" ${world.canIssueBond() ? '' : 'disabled'}>Issue Bond [B]</button>
      ${world.bonds.length ? '<div style="margin-top:6px">' + world.bonds.map((b) => `<div class="row"><span>Due after wave ${b.dueWave}</span><b style="color:var(--red)">${b.due}g</b></div>`).join('') + '</div>' : ''}`;
    const L = world.letter;
    $('letter').innerHTML = L
      ? `<div class="muted" style="margin-bottom:4px">Re: wave ${L.wave}${L.verified ? `<span class="tag ${L.verified === 'AUTHENTIC' ? 'auth' : 'forged'}">${L.verified}</span>` : ''}</div>
         <div class="ltext">${esc(L.text)}<div class="sig">${esc(L.sig)}</div></div>`
      : '<div class="muted">No further letters. This is the end, one way or another.</div>';
  }

  infoHtml(world, ui) {
    const t = ui.selected && world.towers.includes(ui.selected) ? ui.selected : null;
    if (t) return this.towerPanel(world, t);
    const type = ui.placing || ui.hoverBuild;
    if (type) return this.towerInfo(world, type);
    if (ui.hoverEnemy && ui.hoverEnemy.alive) return this.enemyInfo(world, ui.hoverEnemy);
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
    if (t) rows.push(['Damage dealt', Math.round(t.dmg)], ['Kills', t.kills]);
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
    if (t.disabledT > 0) status.push(`<span style="color:#ff9b3d">Disabled ${t.disabledT.toFixed(1)}s</span>`);
    if (t.soberT > 0) status.push('<span style="color:#9fd8ff">Sobered</span>');
    if (t.turnedT > 0) status.push('<span style="color:var(--pink)">Turned by J.R.</span>');
    const modes = def.base.attack === 'pulse' || def.base.attack === 'global' ? '' :
      `<div class="modes">${['first', 'last', 'strong', 'close'].map((m) => `<button data-act="mode" data-mode="${m}" class="${t.mode === m ? 'on' : ''}">${m}</button>`).join('')}</div>`;
    const branches = def.branches.map((b, i) => {
      const lockedOut = t.branch != null && t.branch !== i;
      const next = t.tier < 3 && !lockedOut ? b.tiers[t.tier] : null;
      const c = next ? world.upgradeCost(t, i) : null;
      const key = i === 0 ? 'Z' : 'X';
      return `<div class="branch ${lockedOut ? 'locked' : ''}"><div class="bname">${esc(b.name)}</div>
        <div class="muted" style="font-size:11px">${esc(b.flavor)}</div>
        ${next ? `<button data-act="up" data-branch="${i}" ${world.gold >= c ? '' : 'disabled'}>[${key}] ${esc(next.name)} — ${c}g</button>`
          : `<div class="muted" style="font-size:11px;margin-top:4px">${lockedOut ? 'Other branch chosen' : 'Fully upgraded'}</div>`}</div>`;
    }).join('');
    return `<h3>${esc(def.name)}</h3>
      <div class="row"><span>${t.branch != null ? esc(def.branches[t.branch].name) + ' · ' : ''}Tier ${t.tier}</span><span>${status.join(' ')}</span></div>
      ${this.statsHtml(world, t.s, t)}${modes}<div class="branches">${branches}</div>
      <div style="margin-top:8px"><button data-act="sell" ${world.mods.noSell ? 'disabled title="Old Aleforge Historic Act"' : ''}>Sell for ${world.sellValue(t)}g [S]</button></div>`;
  }

  enemyInfo(world, e) {
    const d = e.def;
    return `<h3>MAMA</h3><div class="row"><b>${esc(d.name)}</b><span>${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)} hp</span></div>
      <div class="flavor">${esc(d.desc)}</div>
      <div class="stats"><span class="muted">Armor</span><span>${d.armor}</span><span class="muted">Speed</span><span>${d.speed}</span>
      <span class="muted">Leak cost</span><span>${d.boss ? 'Everything' : d.leak + ' resolve'}</span><span class="muted">Shield</span><span>${Math.round(e.shield)}</span></div>`;
  }
}

