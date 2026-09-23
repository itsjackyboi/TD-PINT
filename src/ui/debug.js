// ?debug tuning panel: speed, resources, wave jumps, spawns, autoplay bot,
// per-tower DPS, leak log and a stress test. Any cheat taints the run so it
// isn't recorded in the Ledger.
import { ENEMIES } from '../data/enemies.js';
import { WAVES } from '../data/waves.js';
import { Bot } from '../core/bot.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Debug {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('debug');
    this.el.classList.remove('hidden');
    this.tainted = false;
    this.bot = null;
    this.frames = [];
    this.statT = 0;
    this.dpsHist = new Map(); // tower id -> [{t, dmg}]
    this.el.addEventListener('click', (ev) => this.onClick(ev));
    this.render();
  }

  attach(world) {
    this.world = world;
    this.tainted = false;
    this.bot = null;
    this.dpsHist.clear();
    this.render();
  }

  taint() { this.tainted = true; }

  beforeStep(dt) {
    if (this.bot && this.world && !this.world.over) this.bot.think(dt);
  }

  onClick(ev) {
    const b = ev.target.closest('[data-d]');
    const w = this.world;
    if (!b || !w) return;
    const act = b.dataset.d;
    this.taint();
    switch (act) {
      case 'gold': w.gold += 1000; break;
      case 'ale': w.ale += 200; break;
      case 'resolve': w.resolve += 10; break;
      case 'inv': w.invincible = !w.invincible; break;
      case 'kill': for (const e of w.enemies) if (e.alive && !e.def.boss) w.kill(e, null); break;
      case 'jump': {
        const n = Math.max(1, Math.min(WAVES.length, Number(this.el.querySelector('#d-wave').value) || 1));
        w.enemies.length = 0; w.projectiles.length = 0; w.activeWaves.length = 0; w.pendingDoctrine = null; w.boss = null;
        w.wave = n - 1; w.letter = w.makeLetter(n);
        break;
      }
      case 'spawn': {
        const type = this.el.querySelector('#d-type').value;
        const count = Number(this.el.querySelector('#d-count').value) || 1;
        for (let i = 0; i < count; i++) w.spawnEnemy(type, i % 2 ? 'B' : 'A', -i * 14, Math.max(1, w.wave), null);
        break;
      }
      case 'stress': {
        w.invincible = true;
        for (let i = 0; i < 300; i++) {
          const e = w.spawnEnemy('zealot', i % 2 ? 'B' : 'A', -i * 4, 30, null);
          e.hp = e.maxHp = 1e6;
        }
        break;
      }
      case 'bot':
        if (this.bot) this.bot = null;
        else fetch('tools/builds/balanced.json').then((r) => r.json()).then((build) => { this.bot = new Bot(w, build); this.render(); });
        break;
    }
    this.render();
  }

  frame(dt, simMs, renderMs) {
    this.frames.push({ dt, simMs, renderMs });
    if (this.frames.length > 60) this.frames.shift();
    this.statT += dt;
    if (this.statT > 0.25) { this.statT = 0; this.renderStats(); }
  }

  render() {
    const w = this.world;
    this.el.innerHTML = `<b>DEBUG</b> ${this.tainted ? '<span style="color:#f88">(run tainted)</span>' : ''}<br>
      <button data-d="gold">+1000g</button><button data-d="ale">+200 ale</button><button data-d="resolve">+10 resolve</button>
      <button data-d="inv">${w?.invincible ? 'invincible ON' : 'invincible off'}</button><button data-d="kill">kill all</button><br>
      wave <input id="d-wave" type="number" min="1" max="30" value="${(w?.wave || 0) + 1}" style="width:40px"><button data-d="jump">jump</button>
      <button data-d="bot">${this.bot ? 'autoplay ON' : 'autoplay (balanced bot)'}</button><br>
      <select id="d-type">${Object.keys(ENEMIES).filter((k) => k !== 'plinket').map((k) => `<option>${k}</option>`).join('')}</select>
      ×<input id="d-count" type="number" value="5" style="width:36px"><button data-d="spawn">spawn</button>
      <button data-d="stress">stress 300</button>
      <div id="d-stats"></div>`;
  }

  renderStats() {
    const w = this.world;
    const box = this.el.querySelector('#d-stats');
    if (!box) return;
    const f = this.frames;
    const avg = (k) => f.reduce((a, x) => a + x[k], 0) / (f.length || 1);
    const fps = 1 / (avg('dt') || 1);
    let html = `<div>fps ${fps.toFixed(0)} · sim ${avg('simMs').toFixed(2)}ms · draw ${avg('renderMs').toFixed(2)}ms</div>`;
    if (w) {
      html += `<div>enemies ${w.enemies.length} · proj ${w.projectiles.length} · fx ${w.effects.length} · seed ${w.seed}</div>`;
      // sliding 10s DPS per tower
      const now = w.time;
      const rows = [];
      for (const t of w.towers) {
        let h = this.dpsHist.get(t.id);
        if (!h) this.dpsHist.set(t.id, (h = []));
        h.push({ t: now, dmg: t.dmg });
        while (h.length > 1 && now - h[0].t > 10) h.shift();
        const span = now - h[0].t;
        rows.push({ t, dps: span > 0 ? (t.dmg - h[0].dmg) / span : 0 });
      }
      rows.sort((a, b) => b.dps - a.dps);
      html += '<table><tr><td>tower</td><td>tier</td><td>dps(10s)</td><td>total</td></tr>' +
        rows.slice(0, 10).map((r) => `<tr><td>${r.t.type}@${r.t.tx},${r.t.ty}</td><td>${r.t.branch ?? '-'}/${r.t.tier}</td><td>${r.dps.toFixed(0)}</td><td>${Math.round(r.t.dmg)}</td></tr>`).join('') + '</table>';
      html += '<div style="margin-top:4px">leaks:</div>' + w.leakLog.slice(-8).reverse().map((l) => `<div>w${l.wave} ${esc(l.type)} via ${l.path} (${l.hp}hp)</div>`).join('');
    }
    box.innerHTML = html;
  }
}
