// Modal screens: title, run setup, doctrine choice, run end, ledger, help.
import { KINGS } from '../data/kings.js';
import { MANDATES } from '../data/mandates.js';
import { DOCTRINES } from '../data/doctrines.js';
import { INTRO, DEATHS } from '../data/lore.js';
import { UNLOCKS, worldUnlocks, resetMeta } from './meta.js';
import { sprites } from './sprites.js';
import { titleArtURL, KING_PORTRAIT } from './pixelart.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const modal = () => document.getElementById('modal');

function show(html, bind) {
  const m = modal();
  m.innerHTML = `<div class="card">${html}</div>`;
  m.classList.remove('hidden');
  bind?.(m);
}
export function hide() { modal().classList.add('hidden'); modal().innerHTML = ''; }
export function isOpen() { return !modal().classList.contains('hidden'); }

export function titleScreen(app) {
  const m = app.meta;
  show(`${sprites.ready ? `<img class="title-art" alt="" src="${titleArtURL()}">` : ''}<h1>Siege of Aleforge</h1><div class="sub">A Pintland Isles tower defense · permadeath</div>
    ${INTRO.map((p) => `<p>${esc(p)}</p>`).join('')}
    <p class="muted">Best: wave ${m.bestWave} · ${m.wins} victories · ${m.runs.length} recorded runs</p>
    <div class="actions">
      <button class="primary" data-go="setup">Begin the Siege</button>
      <button data-go="ledger">The Ledger</button>
      <button data-go="help">How It Works</button>
    </div>`, (el) => {
    el.querySelector('[data-go=setup]').onclick = () => setupScreen(app);
    el.querySelector('[data-go=ledger]').onclick = () => ledgerScreen(app);
    el.querySelector('[data-go=help]').onclick = () => helpScreen(app);
  });
}

export function setupScreen(app) {
  const un = worldUnlocks(app.meta);
  const chosen = new Set(['seamus', 'buke'].filter((k) => un.kings.includes(k)));
  const mand = new Set();
  const render = () => show(`<h2>Muster the Kings</h2>
    <p class="muted">Choose two Liquor Kings. Their abilities cost ale and are your only way out of a bad wave.</p>
    <div class="choices">${Object.entries(KINGS).map(([id, k]) => {
      const ok = un.kings.includes(id);
      const portrait = sprites.ready ? `<img class="portrait" alt="" src="${sprites.dataURL(KING_PORTRAIT[id], 3)}">` : '';
      return `<div class="choice ${chosen.has(id) ? 'sel' : ''} ${ok ? '' : 'locked'}" data-king="${id}">
        ${portrait}<div class="cname">${ok ? '' : '🔒 '}${esc(k.name)}</div><div class="muted" style="font-size:12px">“${esc(k.title)}”</div>
        <div class="ctext"><b>${esc(k.ability)}</b> (${k.ale} ale${k.cd ? `, ${k.cd}s cooldown` : ''}): ${esc(k.text)}</div></div>`;
    }).join('')}</div>
    ${un.mandates ? `<h2 style="margin-top:14px">Plinket's Mandates <span class="muted" style="font-size:14px">heat <span id="heat">${mand.size}</span> · best cleared: ${app.meta.maxHeatWon}</span></h2>
      <div class="choices">${Object.entries(MANDATES).map(([id, md]) => `<div class="choice ${mand.has(id) ? 'sel' : ''}" data-mand="${id}">
        <div class="cname">${esc(md.name)}</div><div class="ctext">${esc(md.text)}</div>${md.flavor ? `<div class="cflav">${esc(md.flavor)}</div>` : ''}</div>`).join('')}</div>`
      : '<p class="muted">Defeat Susan Plinket to unlock Plinket\'s Mandates (heat levels).</p>'}
    <div class="actions"><button class="primary" id="go" ${chosen.size === 2 ? '' : 'disabled'}>March to the Walls</button><button id="back">Back</button></div>`, (el) => {
    // update in place (a full re-render would jump a phone back to the top of the list)
    const sync = () => {
      el.querySelectorAll('[data-king]').forEach((c) => c.classList.toggle('sel', chosen.has(c.dataset.king)));
      el.querySelectorAll('[data-mand]').forEach((c) => c.classList.toggle('sel', mand.has(c.dataset.mand)));
      el.querySelector('#go').disabled = chosen.size !== 2;
      const heat = el.querySelector('#heat');
      if (heat) heat.textContent = mand.size;
    };
    el.querySelectorAll('[data-king]').forEach((c) => {
      c.onclick = () => {
        const id = c.dataset.king;
        if (!un.kings.includes(id)) return;
        if (chosen.has(id)) chosen.delete(id);
        else if (chosen.size < 2) chosen.add(id);
        sync();
      };
    });
    el.querySelectorAll('[data-mand]').forEach((c) => {
      c.onclick = () => { const id = c.dataset.mand; mand.has(id) ? mand.delete(id) : mand.add(id); sync(); };
    });
    el.querySelector('#go').onclick = () => { hide(); app.startRun([...chosen], [...mand]); };
    el.querySelector('#back').onclick = () => titleScreen(app);
  });
  render();
}

export function doctrineScreen(app, world) {
  show(`<h2>A Decision of State</h2><p class="muted">Mr. BBL has narrowed it to three. Choose one; it lasts the rest of the siege.</p>
    <div class="choices">${world.pendingDoctrine.map((id) => {
      const d = DOCTRINES[id];
      return `<button class="choice" data-doc="${id}"><div class="cname">${esc(d.name)}</div><div class="ctext">${esc(d.text)}</div><div class="cflav">${esc(d.flavor)}</div></button>`;
    }).join('')}</div>`, (el) => {
    el.querySelectorAll('[data-doc]').forEach((b) => { b.onclick = () => { world.pickDoctrine(b.dataset.doc); hide(); app.hud.buildBar(world); }; });
  });
}

export function endScreen(app, world, fresh) {
  const s = world.summary();
  const flavor = s.won ? 'Susan Plinket has been sentenced to be Rollo\'s permanent girlfriend. Aleforge drinks tonight.' : DEATHS[s.seed % DEATHS.length];
  show(`<h1 style="color:${s.won ? 'var(--gold)' : 'var(--red)'}">${s.won ? 'Aleforge Stands' : 'Aleforge Has Fallen'}</h1>
    <div class="sub">${s.won ? `Victory · heat ${s.heat}` : `Fell on wave ${s.wave} of 30`}</div>
    <p>${esc(flavor)}</p>
    <div class="stats" style="max-width:420px">
      <span class="muted">MAMAists slain</span><span>${s.kills}</span><span class="muted">Leaked</span><span>${s.leaks}</span>
      <span class="muted">Gold earned</span><span>${s.goldEarned}</span><span class="muted">Bonds issued / defaulted</span><span>${world.stats.bondsIssued} / ${world.stats.defaults}</span>
      <span class="muted">Insurgencies</span><span>${world.stats.insurgencies}</span><span class="muted">Doctrines</span><span>${s.doctrines.map((d) => esc(DOCTRINES[d].name)).join(', ') || '—'}</span>
      <span class="muted">Seed</span><span>${s.seed}</span><span class="muted">Time</span><span>${Math.floor(s.time / 60)}m ${s.time % 60}s</span>
    </div>
    ${fresh.length ? `<h2 style="margin-top:14px">New in the Ledger</h2><ul>${fresh.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    <p class="muted">There are no continues. There is only the next siege.</p>
    <div class="actions"><button class="primary" id="again">New Siege</button><button id="ledger">The Ledger</button><button id="title">Title</button></div>`, (el) => {
    el.querySelector('#again').onclick = () => setupScreen(app);
    el.querySelector('#ledger').onclick = () => ledgerScreen(app);
    el.querySelector('#title').onclick = () => titleScreen(app);
  });
}

export function ledgerScreen(app) {
  const m = app.meta;
  show(`<h2>The Ledger</h2><p class="muted">Unlocks add options, never power. Every siege is equally hard.</p>
    <div class="stats" style="max-width:420px"><span class="muted">Best wave</span><span>${m.bestWave}</span><span class="muted">Victories</span><span>${m.wins}</span>
    <span class="muted">Total slain</span><span>${m.totalKills}</span><span class="muted">Highest heat cleared</span><span>${m.maxHeatWon < 0 ? '—' : m.maxHeatWon}</span></div>
    <table class="runs"><tr><th></th><th>Unlock</th><th>Requirement</th></tr>
    ${UNLOCKS.map((u) => `<tr><td>${m.unlocked.includes(u.id) ? '✓' : '🔒'}</td><td>${esc(u.label)}</td><td class="muted">${esc(u.req)}</td></tr>`).join('')}</table>
    <h2 style="margin-top:14px">Recent Sieges</h2>
    ${m.runs.length ? `<table class="runs"><tr><th>Date</th><th>Result</th><th>Kings</th><th>Heat</th><th>Kills</th><th>Seed</th></tr>
      ${m.runs.map((r) => `<tr><td>${r.date}</td><td>${r.won ? 'Victory' : `Fell on ${r.wave}`}</td><td>${r.kings.map((k) => esc(KINGS[k].name.split(' ')[0])).join(', ')}</td><td>${r.heat}</td><td>${r.kills}</td><td>${r.seed}</td></tr>`).join('')}</table>`
      : '<p class="muted">No sieges recorded yet.</p>'}
    <div class="actions"><button id="back">Back</button><button id="reset">Burn the Ledger (reset progress)</button></div>`, (el) => {
    el.querySelector('#back').onclick = () => titleScreen(app);
    el.querySelector('#reset').onclick = () => {
      if (confirm('Erase all unlocks and run history?')) { resetMeta(); app.reloadMeta(); ledgerScreen(app); }
    };
  });
}

export function helpScreen(app) {
  show(`<h2>How the Siege Works</h2><div class="help">
    <p><b>Resolve</b> is your life total: 20, and it never comes back (except through Jameson Pilsner). Most leaks cost 1–3. If Susan Plinket reaches the keep, it's over.</p>
    <p><b>Gold</b> comes from kills and from wave payouts: tithes (scaled by average district morale), 5% interest on banked gold (capped), and Magic Spring taprooms. Greed is paid with Resolve.</p>
    <p><b>Ale</b> builds the ale towers (Taproom, Still) and fuels Liquor King abilities. The Tankard pours 12 a wave.</p>
    <p><b>Aleforge Bonds</b> give 150g now. Repay after 5 waves at a rate that rises every time you borrow. Default and every district loses 40 morale.</p>
    <p><b>District morale</b> falls when Pamphleteers walk through, when anything leaks, and when Bootleg ClockHeart is sold. Below the line (30%), <b>insurgents rise inside your defenses</b>, as Plinket planned.</p>
    <p><b>Intercepted letters</b> from “J.R.” preview the next wave. From wave 10 on, some are forgeries. Real letters are signed <i>J.R.</i> with the dots. Jack Anqoak can verify them.</p>
    <p><b>Infiltrators</b> are invisible until a Lighthouse or Sheriff's Deputies reveals them. Unseen, they sabotage the towers they pass.</p>
    <p><b>Temperance Matrons</b> sober nearby towers: every buff is stripped and ale towers fire at half speed. <b>Martyrs</b> disable nearby towers when they die. <b>True Believers</b> cleanse slows and burns at half HP.</p>
    <p><b>Doctrines</b> every 5 waves: pick one of three trades. None is free.</p>
    ${app.touch ? `<p><b>Touch:</b> tap a tower in the bottom bar, tap open land to preview it, tap the same spot again (or ✓) to build. Tap a built tower to open its panel. Long-press or tap an enemy to inspect it. Pinch or double-tap to zoom, drag to pan, ⤢ resets the view. ☰ opens the panels (Kings, Bonds, Letters, Log). Add to your Home Screen for fullscreen.</p>` : ''}
    <p class="${app.touch ? 'hidden' : ''}"><b>Keys:</b> <kbd>1</kbd>–<kbd>7</kbd> build · <kbd>Z</kbd>/<kbd>X</kbd> upgrade branch · <kbd>S</kbd> sell · <kbd>T</kbd> targeting · <kbd>Q</kbd>/<kbd>W</kbd> Kings · <kbd>B</kbd> bond · <kbd>Space</kbd> send wave · <kbd>P</kbd> pause · <kbd>F</kbd> speed · <kbd>M</kbd> sound · <kbd>Esc</kbd> cancel.</p>
    <p>Add <code>?debug</code> to the URL for the tuning panel.</p>
    </div><div class="actions"><button id="back">Back</button></div>`, (el) => {
    el.querySelector('#back').onclick = () => (app.world && !app.world.over ? hide() : titleScreen(app));
  });
}
