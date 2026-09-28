// DOM side of the game screen: top bar, build bar (towers, hero, road items),
// ability bar, toasts and the side panels. Panels rebuild on a short throttle
// through setHTML (which only touches the DOM when content changed) and use
// event delegation (data-act), so rebuilding never loses a tap.
import { TOWERS, TOWER_ORDER, TIER_XP, DTYPE_TEXT } from '../data/towers.js';
import { ENEMIES, TRAITS } from '../data/enemies.js';
import { HEROES, HERO_COST, HERO_XP } from '../data/heroes.js';
import { ITEMS, ITEM_ORDER, ITEMS_PER_WAVE } from '../data/items.js';
import { DOCTRINES } from '../data/doctrines.js';
import { wavePreview } from '../core/waves.js';
import { towerStatus } from '../core/progress.js';
import { sprites } from './sprites.js';
import { towerIconURL, enemyPortraitURL, heroPortraitURL } from './pixelart.js';

const $ = (id) => document.getElementById(id);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const setHTML = (el, html) => { if (el && el._html !== html) { el._html = html; el.innerHTML = html; } };
const fmt = (n) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10);
const n0 = (n) => Math.round(n).toLocaleString();

export const ITEM_KEYS = { caltrops: 'c', powderkeg: 'v', stickyale: 'n' };
export const ABILITY_KEYS = ['j', 'k', 'l', ';', "'"];
const MODES = { first: 'First', last: 'Last', strong: 'Strong', close: 'Close' };

export function traitChip(tr, withText = false) {
  const T = TRAITS[tr];
  if (!T) return '';
  return `<span class="trait" style="--tc:${T.color}" title="${esc(T.name)}: ${esc(T.text)}"><i>${esc(T.icon)}</i>${esc(T.name)}</span>${withText ? ` <span class="ttext">${esc(T.text)}</span>` : ''}`;
}

export function speedWord(sp) { return sp >= 70 ? 'Fast' : sp >= 48 ? 'Normal' : sp >= 32 ? 'Slow' : 'Very slow'; }

export class Hud {
  constructor(app) {
    this.app = app;
    this.touch = app.touch;
    this.lastPanels = 0;
    this.toasts = [];
    this.fresh = new Set();
    this.setTab('info');
  }

  key(s) { return this.touch ? '' : s; }

  setTab(tab) {
    this.tab = tab;
    document.querySelectorAll('#side-tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    document.querySelectorAll('#side [data-panel]').forEach((p) => p.classList.toggle('active', p.dataset.panel === tab));
    this.lastPanels = 0;
  }

  // --------------------------------------------------------------- one-off builds
  start(world) {
    this.world = world;
    this.buildMorale(world);
    this.fresh = new Set((this.app.profile.fresh || []).filter((t) => world.towerAvailable(t)));
    this.buildBar(world);
    $('toasts').innerHTML = '';
    this.toasts = [];
    this.lastPanels = 0;
  }

  buildMorale(world) {
    $('morale').innerHTML = world.map.districts.map((d, i) =>
      `<div class="mbar" title="${esc(d.name)} morale. Under the line, insurgents rise inside your defences."><span>${esc(d.name.split(' ').pop())}</span>
        <div class="track"><div class="fill" id="m-fill-${i}"></div><div class="thresh" id="m-th-${i}"></div></div></div>`).join('');
  }

  // Towers you can use this run, then towers that unlock later this run; the
  // hero; road items. Permanently locked towers are listed in Progress, not here.
  buildBar(world) {
    const icon = (type) => (sprites.ready ? `<img class="ticon" alt="" src="${towerIconURL(type)}">` : '');
    const towers = TOWER_ORDER.filter((t) => world.towerAvailable(t) || (TOWERS[t].unlock.wave && !world.towerAvailable(t)));
    let html = towers.map((type) => {
      const def = TOWERS[type];
      const soon = !world.towerAvailable(type);
      const fresh = !soon && this.fresh.has(type);
      return `<button class="tb ${soon ? 'soon' : ''} ${fresh ? 'fresh' : ''}" data-act="build" data-type="${type}" id="tb-${type}" ${soon ? `disabled title="Unlocks at wave ${def.unlock.wave}"` : `title="${esc(def.desc)}"`}>
        ${fresh ? '<span class="newtag">NEW!</span>' : ''}${icon(type)}<span class="tlabel">${this.key(`<span class="key">${def.key}</span>`)}<span class="tname">${esc(def.short)}</span>
        <span class="tcost">${soon ? `wave ${def.unlock.wave}` : `${world.cost(def.cost)}g`}</span></span></button>`;
    }).join('');
    if (world.heroId && !world.hero) {
      const h = HEROES[world.heroId];
      const img = sprites.ready ? `<img class="ticon hero" alt="" src="${heroPortraitURL(world.heroId)}">` : '';
      html = `<button class="tb herob" data-act="hero" id="tb-hero" title="${esc(h.desc)}">${img}<span class="tlabel">${this.key('<span class="key">h</span>')}<span class="tname">${esc(h.name.split(' ')[0])}</span><span class="tcost">${HERO_COST}g hero</span></span></button>` + html;
    }
    html += '<span class="bsep"></span>' + ITEM_ORDER.map((id) => {
      const it = ITEMS[id];
      return `<button class="tb item" data-act="item" data-id="${id}" id="ti-${id}" title="${esc(it.desc)}"><span class="tlabel">${this.key(`<span class="key">${ITEM_KEYS[id]}</span>`)}<span class="tname">${esc(it.name)}</span><span class="tcost ale">${it.ale} ale</span></span></button>`;
    }).join('');
    $('buildbar').innerHTML = html;
  }

  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    $('toasts').prepend(el);
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4200);
    while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
  }

  // --------------------------------------------------------------- per frame
  tick(world, ui) {
    $('r-gold').textContent = Math.floor(world.gold);
    $('r-ale').textContent = Math.floor(world.ale);
    $('r-resolve').textContent = world.resolve;
    $('r-wave').textContent = world.freeplay ? `${world.wave} ∞` : `${world.wave}/${world.campaignWaves}`;
    const th = world.mods.moraleThreshold;
    world.morale.forEach((m, i) => {
      const f = $(`m-fill-${i}`);
      if (!f) return;
      f.style.width = `${m}%`;
      f.className = 'fill' + (m < th ? ' bad' : m < th + 15 ? ' warn' : '');
      $(`m-th-${i}`).style.left = `${th}%`;
    });
    $('b-speed').textContent = `${ui.speed}×`;
    $('b-pause').textContent = ui.paused ? 'Resume' : 'Pause';
    $('b-pause').classList.toggle('on', ui.paused);
    const send = $('b-send');
    send.disabled = !world.canSendWave();
    const label = world.activeWaves.length && world.canSendWave() ? 'Call Early' : 'Send Wave';
    if (send.textContent !== label) send.textContent = label;

    for (const b of $('buildbar').children) {
      if (b.dataset.type) {
        const def = TOWERS[b.dataset.type];
        const soon = !world.towerAvailable(b.dataset.type);
        b.classList.toggle('on', ui.placing === b.dataset.type);
        b.classList.toggle('poor', !soon && world.gold < world.cost(def.cost));
      } else if (b.dataset.id) {
        b.classList.toggle('on', ui.targeting?.kind === 'item' && ui.targeting.id === b.dataset.id);
        b.disabled = !!world.canPlaceItem(b.dataset.id, -999, -999) && world.canPlaceItem(b.dataset.id, -999, -999) !== 'road';
      } else if (b.id === 'tb-hero') b.classList.toggle('on', !!ui.placingHero);
    }
    this.abilityBar(world, ui);
    this.confirmBar(world, ui);

    const now = performance.now();
    if (now - this.lastPanels > 150) {
      this.lastPanels = now;
      this.panels(world, ui);
    }
  }

  abilityBar(world, ui) {
    const list = world.abilityList();
    const html = list.map(({ t, a }, i) => {
      const owner = t.hero ? HEROES[t.heroId].name.split(' ')[0] : t.def.short;
      return `<button class="ab" data-act="ability" data-tid="${t.id}" data-id="${a.id}" id="ab-${t.id}-${a.id}" title="${esc(owner)}: ${esc(a.name)}${a.desc ? ' — ' + esc(a.desc) : ''}">
        <span class="abn">${this.key(`<span class="key">${ABILITY_KEYS[i] || ''}</span>`)}${esc(a.name)}</span><span class="abo">${esc(owner)}</span><span class="cd" id="abcd-${t.id}-${a.id}"></span></button>`;
    }).join('');
    setHTML($('abilities'), html);
    for (const { t, a, cd } of list) {
      const b = $(`ab-${t.id}-${a.id}`), c = $(`abcd-${t.id}-${a.id}`);
      if (!b) continue;
      const max = a.cd * world.mods.abilityCd;
      b.disabled = cd > 0 || world.over;
      b.classList.toggle('on', ui.targeting?.kind === 'ability' && ui.targeting.id === a.id && ui.targeting.t === t);
      c.style.setProperty('--p', cd > 0 ? `${(cd / max) * 100}%` : '0%');
      c.textContent = cd > 0 ? Math.ceil(cd) : '';
    }
  }

  confirmBar(world, ui) {
    const bar = $('confirm');
    const show = this.touch && (ui.placing || ui.placingHero || ui.targeting || ui.aiming);
    bar.classList.toggle('hidden', !show);
    if (!show) return;
    let text, ok = false, label = '✓ Build';
    if (ui.aiming) {
      label = '✓ Target'; ok = !!ui.mouse;
      text = ui.mouse ? 'Aim here? Tap again or ✓.' : `Tap where the ${ui.aiming.def.short} should aim.`;
    } else if (ui.targeting) {
      const tg = ui.targeting;
      const name = tg.kind === 'item' ? ITEMS[tg.id].name : 'Barricade';
      label = '✓ Place';
      ok = !!ui.mouse;
      text = ui.mouse ? `${name} here? Tap again or ✓.` : `Tap the road to place the ${name}.`;
    } else if (ui.placingHero) {
      label = '✓ Place';
      if (!ui.hover) text = `Hero: ${HERO_COST}g. Tap open land to preview.`;
      else { const why = world.canPlaceHero(ui.hover.tx, ui.hover.ty); ok = !why; text = why ? this.whyText(why) : 'Place your hero here? Tap again or ✓.'; }
    } else {
      const def = TOWERS[ui.placing];
      const cost = `${world.cost(def.cost)}g`;
      if (!ui.hover) text = `${def.short}: ${cost}. Tap ${def.water ? 'open water' : 'open land'} to preview.`;
      else {
        const why = world.canPlace(ui.placing, ui.hover.tx, ui.hover.ty);
        ok = !why;
        text = why ? this.whyText(why) : `${def.short} here for ${cost}? Tap again or ✓.`;
      }
    }
    const t = $('confirm-text');
    if (t.textContent !== text) t.textContent = text;
    const b = $('b-confirm');
    b.disabled = !ok;
    if (b.textContent !== label) b.textContent = label;
  }

  whyText(why) {
    return { gold: 'Not enough gold.', ale: 'Not enough ale.', blocked: 'Build on open land.', water: 'Ships go on open water.', occupied: 'Something is already there.', locked: 'Locked.', placed: 'Hero already placed.', road: 'Must go on the road.', limit: `Only ${ITEMS_PER_WAVE} road items per wave.` }[why] || "Can't do that.";
  }

  // --------------------------------------------------------------- panels
  panels(world, ui) {
    const p = world.incomePreview(world.wave + (world.activeWaves.length ? 0 : 1));
    $('r-income').textContent = `${p.income + p.interest + p.towerGold}g`;
    $('r-income').title = `Paid at the end of the wave: ${p.income} base (scaled by morale) + ${p.interest} interest (5% of banked gold, max ${p.cap}) + ${p.towerGold} from towers. Also +${p.ale} ale.`;
    setHTML($('p-info'), this.infoHtml(world, ui));
    const sel = ui.selected;
    if (sel && $('t-dmg')) { $('t-dmg').textContent = n0(sel.dmg); $('t-kills').textContent = sel.kills; }
    if (ui.hoverEnemy?.alive && $('e-hp')) $('e-hp').textContent = `${Math.ceil(ui.hoverEnemy.hp)} / ${Math.ceil(ui.hoverEnemy.maxHp)}`;
    setHTML($('p-hero-body'), this.heroHtml(world, ui));
    $('p-hero').classList.toggle('picked', !!ui.selected?.hero);
    setHTML($('p-econ-body'), this.econHtml(world));
  }

  infoHtml(world, ui) {
    const t = ui.selected && world.towers.includes(ui.selected) ? ui.selected : null;
    if (t && !t.hero) return this.towerPanel(world, t);
    if (ui.targeting?.kind === 'item') return this.itemInfo(world, ui.targeting.id);
    const type = ui.placing || ui.hoverBuild;
    if (type && TOWERS[type]) return this.towerInfo(world, type);
    if (ui.hoverEnemy && ui.hoverEnemy.alive) return this.enemyInfo(world, ui.hoverEnemy);
    if (ui.inspectType) return this.enemyTypeInfo(ui.inspectType);
    return this.waveInfo(world);
  }

  waveInfo(world) {
    const n = world.wave + (world.canSendWave() && !world.activeWaves.length ? 1 : world.activeWaves.length ? 0 : 1);
    const next = world.canSendWave() ? world.wave + 1 : null;
    const show = next || n;
    if (!world.freeplay && show > world.campaignWaves) return '<h3>Waves</h3><div class="muted">Final wave under way.</div>';
    const { counts, mods } = wavePreview(show, world.seed, world.waveOverride);
    const rows = Object.entries(counts).map(([type, c]) => {
      const d = ENEMIES[type];
      const img = sprites.ready ? `<img class="eicon" alt="" src="${enemyPortraitURL(type)}">` : '';
      return `<button class="erow" data-act="inspect" data-type="${type}">${img}<b>${c}× ${esc(d.name)}</b> ${d.traits.map((tr) => traitChip(tr)).join('')}</button>`;
    }).join('');
    const hint = this.touch ? 'Tap a tower in the bar, then tap the map. Tap an enemy to see what beats it.'
      : 'Pick a tower below and click the map. Hover or click an enemy to see what beats it.';
    return `<h3>${next ? `Next: wave ${next}` : `Wave ${show}`}${world.freeplay ? ' · Freeplay' : ''}</h3>
      <div class="elist">${rows}</div>
      ${mods.length ? `<div class="row wrap">Modifiers this wave: ${mods.map((m) => traitChip(m)).join('')}</div>` : ''}
      <div class="muted small">${hint}</div>`;
  }

  // stat rows in plain words
  statRows(s, eff, def) {
    const rows = [];
    const r = eff?.range ?? s.range;
    const rate = eff?.rate ?? s.rate ?? 0;
    const dmg = (s.dmg || 0) * (eff?.dmgMul ?? 1) + (eff?.dmgAdd ?? 0);
    const k = s.kind;
    if (k === 'farm') {
      rows.push(['Pays per wave', `${s.income || 0} gold`]);
      if (s.aleIncome) rows.push(['Ale per wave', s.aleIncome]);
      if (s.interestCap) rows.push(['Interest cap', `+${s.interestCap}`]);
      return rows;
    }
    if (k === 'aura') {
      const a = s.aura || {};
      rows.push(['Radius', Math.round(r)]);
      if (a.rangeMul) rows.push(['Range bonus', `+${Math.round(a.rangeMul * 100)}%`]);
      if (a.rate) rows.push(['Attack speed', `+${Math.round(a.rate * 100)}%`]);
      if (a.detect) rows.push(['Grants', 'Hidden detection']);
      if (a.discount) rows.push(['Discount', `${Math.round(a.discount * 100)}%`]);
      if (a.shred) rows.push(['Grants', 'Shred']);
      if (s.income) rows.push(['Pays per wave', `${s.income} gold`]);
      return rows;
    }
    if (s.dtype) rows.push(['Damage type', DTYPE_TEXT[s.dtype] + (eff?.shred || s.shred ? ' + Shred' : '')]);
    if (dmg) rows.push(['Damage', fmt(dmg) + (s.count > 1 ? ` × ${s.count}` : '')]);
    if (rate) rows.push(['Attacks/sec', fmt(rate)]);
    if (k === 'global') rows.push(['Reach', 'Whole map']);
    else if (k === 'mortar') rows.push(['Reach', 'Anywhere (aim point)']);
    else if (r) rows.push(['Range', Math.round(r)]);
    if ((s.pierce || 1) > 1 || eff?.pierceAdd) rows.push(['Hits per shot', (s.pierce || 1) + (eff?.pierceAdd || 0)]);
    if (s.splash) rows.push(['Blast radius', Math.round(s.splash)]);
    if (s.slow) rows.push(['Slow', `${Math.round(s.slow * 100)}% for ${fmt(s.slowDur)}s`]);
    if (s.freeze) rows.push(['Freeze', `${fmt(s.freeze)}s`]);
    if (s.burn) rows.push(['Burn', `${s.burn}/s for ${s.burnDur}s`]);
    if (s.acid) rows.push(['Acid', `${s.acid}/s on slowed enemies`]);
    if (s.stun) rows.push(['Stun', `${s.stun}s`]);
    if (s.mark) rows.push(['Marked targets take', `+${Math.round(s.mark * 100)}% damage`]);
    if (s.income) rows.push(['Pays per wave', `${s.income} gold`]);
    const armored = s.dtype && s.dtype !== 'sharp' && s.dtype !== 'none' ? 'Yes' : (eff?.shred || s.shred) ? 'Yes (Shred)' : s.dtype === 'none' ? '—' : 'No';
    if (k !== 'global') {
      rows.push(['Sees Hidden', eff?.detect || s.detect ? 'Yes' : 'No']);
      if (s.dtype && s.dtype !== 'none') rows.push(['Hurts Armored', armored]);
    }
    if (def?.water) rows.push(['Placed on', 'Water']);
    return rows;
  }

  statsHtml(rows) {
    return `<div class="stats">${rows.map(([a, b]) => `<span class="muted">${a}</span><span>${b}</span>`).join('')}</div>`;
  }

  towerInfo(world, type) {
    const def = TOWERS[type];
    const s = { ...def.base };
    return `<h3>Build</h3><div class="row"><b class="big">${esc(def.name)}</b><span class="gold">${world.cost(def.cost)}g</span></div>
      <p class="desc">${esc(def.desc)}</p>
      ${def.ale ? '<div class="muted small">Ale tower: Temperance Matrons make it fire at half speed.</div>' : ''}
      ${this.statsHtml(this.statRows(s, { range: (s.range || 0) * (1 + world.mods.rangeMult) }, def))}
      <div class="muted small">Upgrade paths: ${def.paths.map((p) => `<b>${esc(p.name)}</b>`).join(' / ')}</div>`;
  }

  // BTD5 layout: two columns of four tiers
  towerPanel(world, t) {
    const def = t.def;
    const xp = this.app.profile.towerXP[t.type] || 0;
    const status = [];
    if (t.disabledT > 0) status.push(`<span class="warn">Disabled ${Math.ceil(t.disabledT)}s</span>`);
    if (t.soberT > 0) status.push('<span class="cold">Sobered</span>');
    if (t.turnedT > 0) status.push('<span class="warn">Turned by Plinket</span>');
    const noTarget = ['farm', 'aura', 'global', 'mortar', 'spikes', 'freeze', 'pulse', 'orbit', 'radial'].includes(t.s.kind);
    const modes = noTarget ? '' : `<div class="modes">${Object.entries(MODES).map(([m, label]) => `<button data-act="mode" data-mode="${m}" class="${t.mode === m ? 'on' : ''}">${label}</button>`).join('')}</div>`;
    const aim = t.s.kind === 'mortar' || t.s.kind === 'repeater'
      ? `<div class="row"><button data-act="aim" class="${this.app.ui.aiming === t ? 'on' : ''}">${t.aim ? 'Move target' : 'Set target'}</button>${t.aim ? '<button data-act="unaim">Auto-aim</button>' : ''}<span class="muted small">${t.s.kind === 'mortar' ? 'Shells land around the target.' : 'Fires toward the target.'}</span></div>`
      : '';
    const cols = def.paths.map((p, pi) => {
      const have = t.tiers[pi];
      const block = world.upgradeBlock(t, pi);
      const rows = p.tiers.map((tier, ti) => {
        const n = ti + 1;
        if (n <= have) return `<div class="tier done"><span class="tn">✓ ${esc(tier.name)}</span><span class="td">${esc(tier.desc)}</span></div>`;
        if (n === have + 1) {
          if (block === 'crosspath') return `<div class="tier lock"><span class="tn">${esc(tier.name)}</span><span class="td">Closed: the other path is past tier 2. Only one path can go to tier 3–4.</span></div>`;
          if (block === 'xp') {
            const need = TIER_XP[n];
            return `<div class="tier lock"><span class="tn">🔒 ${esc(tier.name)}</span><span class="td">${esc(tier.desc)}</span>
              <span class="xpneed">Needs ${n0(need)} ${esc(def.short)} XP (${n0(Math.min(xp, need))} / ${n0(need)}). Earn XP by dealing damage with ${esc(def.short)}s in any game.</span>
              <span class="xpbar"><i style="width:${Math.min(100, (xp / need) * 100)}%"></i></span></div>`;
          }
          const c = world.upgradeCost(t, pi);
          return `<div class="tier next"><button data-act="up" data-path="${pi}" ${world.gold >= c ? '' : 'disabled'}>${this.key(pi === 0 ? '<span class="key">Z</span> ' : '<span class="key">X</span> ')}${esc(tier.name)} · ${c}g</button><span class="td">${esc(tier.desc)}</span></div>`;
        }
        const locked = n > world.tierCap(t.type);
        return `<div class="tier later"><span class="tn">${locked ? '🔒 ' : ''}${esc(tier.name)}</span><span class="td">${esc(tier.desc)}</span></div>`;
      }).join('');
      return `<div class="path"><div class="pname">${esc(p.name)}</div>${rows}</div>`;
    }).join('');
    const abil = (t.s.abilities || []).map((a) => {
      const cd = t.abilityT['cd_' + a.id] || 0;
      return `<button data-act="ability" data-tid="${t.id}" data-id="${a.id}" ${cd > 0 ? 'disabled' : ''}>Use ${esc(a.name)}${cd > 0 ? ` (${Math.ceil(cd)}s)` : ''}</button>`;
    }).join('');
    return `<h3>${esc(def.name)}</h3>
      <div class="row"><span class="muted small">${esc(def.desc)}</span></div>
      ${status.length ? `<div class="row">${status.join(' ')}</div>` : ''}
      ${this.statsHtml([...this.statRows(t.s, t.eff, def), ['Damage dealt', '<span id="t-dmg"></span>'], ['Kills', '<span id="t-kills"></span>']])}
      ${modes}${aim}${abil ? `<div class="row wrap">${abil}</div>` : ''}
      <div class="paths">${cols}</div>
      <div class="row"><button data-act="sell" ${world.mods.noSell ? 'disabled' : ''}>Sell for ${world.sellValue(t)}g${this.key(' <span class="key">S</span>')}</button><span class="muted small">${esc(def.short)} XP: ${n0(xp)}</span></div>`;
  }

  enemyInfo(world, e) {
    const d = e.def;
    const portrait = sprites.ready ? `<img class="portrait" alt="" src="${enemyPortraitURL(e.type)}">` : '';
    return `<h3>Enemy</h3>${portrait}<div class="row"><b class="big">${esc(d.name)}</b></div>
      <div class="muted">${esc(d.desc)}</div>
      <div class="stats"><span class="muted">Health</span><span id="e-hp">${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}</span>
        ${e.shield > 0 ? `<span class="muted">Shield</span><span>${Math.round(e.shield)}</span>` : ''}
        <span class="muted">Speed</span><span>${speedWord(e.speed)}</span>
        <span class="muted">If it gets through</span><span>${e.boss ? 'All your Resolve' : `−${d.leak + (e.traits.has('fortified') ? 1 : 0)} Resolve`}</span></div>
      <div class="traits">${[...e.traits].map((tr) => `<div>${traitChip(tr, true)}</div>`).join('') || '<div class="muted">No special traits.</div>'}</div>`;
  }

  enemyTypeInfo(type) {
    const d = ENEMIES[type];
    const portrait = sprites.ready ? `<img class="portrait" alt="" src="${enemyPortraitURL(type)}">` : '';
    return `<h3>Enemy</h3>${portrait}<div class="row"><b class="big">${esc(d.name)}</b></div>
      <div class="muted">${esc(d.desc)}</div>
      <div class="stats"><span class="muted">Speed</span><span>${speedWord(d.speed)}</span>
        <span class="muted">If it gets through</span><span>${d.traits.includes('boss') ? 'All your Resolve' : `−${d.leak} Resolve`}</span></div>
      <div class="traits">${d.traits.map((tr) => `<div>${traitChip(tr, true)}</div>`).join('') || '<div class="muted">No special traits.</div>'}</div>
      <button data-act="uninspect">Back to wave</button>`;
  }

  itemInfo(world, id) {
    const it = ITEMS[id];
    return `<h3>Road item</h3><div class="row"><b class="big">${esc(it.name)}</b><span class="ale">${it.ale} ale</span></div>
      <p class="desc">${esc(it.desc)}</p>
      <div class="muted small">${this.touch ? 'Tap the road to place it.' : 'Click the road to place it.'} ${world.itemsThisWave}/${ITEMS_PER_WAVE} used this wave.</div>`;
  }

  heroHtml(world, ui, compact) {
    if (!world.heroId) return '<div class="muted">No hero this run.</div>';
    const h = HEROES[world.heroId];
    const t = world.hero;
    const img = sprites.ready ? `<img class="portrait" alt="" src="${heroPortraitURL(world.heroId)}">` : '';
    const head = `${img}<div class="row"><b class="big">${esc(h.name)}</b>${t ? `<span>Level ${t.level}</span>` : ''}</div><div class="muted small">“${esc(h.title)}”</div><p class="desc">${esc(h.desc)}</p>`;
    if (!t) {
      return `${compact ? '<h3>Hero</h3>' : ''}${head}<button data-act="hero" class="${ui.placingHero ? 'on' : ''}">Place hero · ${HERO_COST}g${this.key(' <span class="key">H</span>')}</button>
        <div class="muted small">Heroes level up (1–10) as they fight and as waves end. Abilities unlock at levels 3 and 7.</div>`;
    }
    const next = t.level < 10 ? HERO_XP[t.level] : null;
    const prev = HERO_XP[t.level - 1] || 0;
    const bar = next ? `<span class="xpbar"><i style="width:${Math.min(100, ((t.xp - prev) / (next - prev)) * 100)}%"></i></span>` : '<span class="muted small">Max level</span>';
    const abil = h.abilities.map((a) => {
      const ok = t.level >= a.level;
      const cd = t.abilityT['cd_' + a.id] || 0;
      return `<div class="tier ${ok ? 'next' : 'later'}"><span class="tn">${esc(a.name)} ${ok ? '' : `(level ${a.level})`}</span><span class="td">${esc(a.desc)} Cooldown ${a.cd}s.</span>
        ${ok ? `<button data-act="ability" data-tid="${t.id}" data-id="${a.id}" ${cd > 0 ? 'disabled' : ''}>${cd > 0 ? `Ready in ${Math.ceil(cd)}s` : 'Use'}</button>` : ''}</div>`;
    }).join('');
    return `${compact ? '<h3>Hero</h3>' : ''}${head}${bar}${this.statsHtml(this.statRows(t.s, t.eff))}${abil}`;
  }

  econHtml(world) {
    const q = world.bondQuote();
    const p = world.incomePreview(world.wave + (world.activeWaves.length ? 0 : 1));
    const bonds = `<div class="row"><span>Borrow ${q.principal}g now, repay <b>${q.due}g</b> after wave ${q.dueWave}</span></div>
      <div class="muted small">${Math.round(q.rate * 100)}% interest; each bond costs more. If you can't repay: every district −40 morale.</div>
      <button data-act="bond" ${world.canIssueBond() ? '' : 'disabled'}>Issue Bond${this.key(' <span class="key">B</span>')}</button>
      ${world.bonds.map((b) => `<div class="row"><span>Due after wave ${b.dueWave}</span><b class="warn">${b.due}g</b></div>`).join('')}`;
    const docs = world.doctrines.length
      ? world.doctrines.map((id) => `<div><b>${esc(DOCTRINES[id].name)}</b> <span class="muted small">${esc(DOCTRINES[id].text)}</span></div>`).join('')
      : '<div class="muted small">Every 5 waves you pick one of three doctrines. Each is a trade-off.</div>';
    return `<div class="stats"><span class="muted">End-of-wave pay</span><span>${p.income}g</span><span class="muted">Interest (5%, max ${p.cap})</span><span>${p.interest}g</span>
      <span class="muted">From towers</span><span>${p.towerGold}g</span><span class="muted">Ale per wave</span><span>${p.ale}</span></div>
      <div class="muted small">Low morale cuts your pay. Under the line, insurgents rise inside your defences. Pamphleteers and leaks lower morale; each wave you hold raises it.</div>
      <h3>Aleforge Bonds</h3>${bonds}<h3>Doctrines</h3>${docs}`;
  }
}

// Short text for the unlock lists (end screen, progress screen)
export function towerUnlockText(profile, type) {
  return towerStatus(profile, type).label;
}
