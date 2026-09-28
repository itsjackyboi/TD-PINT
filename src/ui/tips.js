// Beginner mode: the first time you pick a tower, a tower unlocks mid-run, you
// meet a new enemy or a new trait, the game pauses on a short card that says
// what it is and how to deal with it. Recorded in profile.seen, so each card
// shows once. Experienced mode never shows them.
import { TOWERS } from '../data/towers.js';
import { ENEMIES, TRAITS } from '../data/enemies.js';
import { HEROES } from '../data/heroes.js';
import { ITEMS } from '../data/items.js';
import { markSeen } from './profile.js';
import { sprites } from './sprites.js';
import { towerIconURL, enemyPortraitURL, heroPortraitURL } from './pixelart.js';
import { esc, traitChip, speedWord, Hud } from './hud.js';

const statRows = Hud.prototype.statRows;

export class Tips {
  constructor(app) {
    this.app = app;
    this.queue = [];
    this.open = false;
  }

  get on() { return this.app.profile.tips && !this.app.tutorial?.active; }

  push(card) {
    this.queue.push(card);
    if (!this.open) this.next();
  }

  next() {
    const card = this.queue.shift();
    if (!card) { this.open = false; return; }
    this.open = true;
    this.app.showTip(card, () => this.next());
  }

  // ---------------------------------------------------------------- triggers
  tower(type, reason) {
    if (!this.on || !markSeen(this.app.profile, 'towers', type)) return;
    const def = TOWERS[type];
    const img = sprites.ready ? `<img class="tipicon" alt="" src="${towerIconURL(type, 4)}">` : '';
    const rows = statRows.call({ touch: this.app.touch }, def.base, null, def);
    this.push({
      kicker: reason === 'unlock' ? 'New tower unlocked' : 'New tower',
      title: def.name,
      html: `${img}<p>${esc(def.desc)}</p>
        <div class="stats">${rows.map(([a, b]) => `<span class="muted">${a}</span><span>${b}</span>`).join('')}</div>
        <p class="muted">Two upgrade paths: <b>${esc(def.paths[0].name)}</b> and <b>${esc(def.paths[1].name)}</b>. Either can reach tier 4, but then the other stops at tier 2. Tiers 3–4 need XP with this tower, earned by using it in any game.</p>`,
    });
  }

  hero(id) {
    if (!this.on || !markSeen(this.app.profile, 'towers', 'hero:' + id)) return;
    const h = HEROES[id];
    const img = sprites.ready ? `<img class="tipicon" alt="" src="${heroPortraitURL(id, 4)}">` : '';
    this.push({
      kicker: 'Your hero', title: h.name,
      html: `${img}<p>${esc(h.desc)}</p><p>One hero per game. Place it like a tower. It gains levels (up to 10) from fighting and from every wave you hold.</p>
        <ul>${h.abilities.map((a) => `<li><b>${esc(a.name)}</b> (level ${a.level}): ${esc(a.desc)}</li>`).join('')}</ul>
        <p class="muted">Abilities appear in the bar at the bottom of the map when ready.</p>`,
    });
  }

  item(id) {
    if (!this.on || !markSeen(this.app.profile, 'towers', 'item:' + id)) return;
    const it = ITEMS[id];
    this.push({
      kicker: 'Road item', title: it.name,
      html: `<p>${esc(it.desc)}</p><p>Road items cost <b>ale</b>, not gold, and you can use 3 per wave. Drop them on the road where things are getting through.</p>`,
    });
  }

  enemy(type, traits) {
    if (!this.on) return;
    const newEnemy = markSeen(this.app.profile, 'enemies', type);
    const newTraits = traits.filter((tr) => TRAITS[tr] && markSeen(this.app.profile, 'traits', tr));
    if (!newEnemy && !newTraits.length) return;
    const d = ENEMIES[type];
    const img = sprites.ready ? `<img class="tipicon" alt="" src="${enemyPortraitURL(type)}">` : '';
    if (newEnemy) {
      this.push({
        kicker: d.traits.includes('boss') ? 'Boss' : 'New enemy', title: d.name,
        html: `${img}<p>${esc(d.desc)}</p>
          <div class="stats"><span class="muted">Speed</span><span>${speedWord(d.speed)}</span>
          <span class="muted">If it gets through</span><span>${d.traits.includes('boss') ? 'All your Resolve' : `−${d.leak} Resolve`}</span></div>
          ${traits.length ? `<div class="traits">${traits.map((tr) => `<div>${traitChip(tr, true)}</div>`).join('')}</div>` : ''}`,
      });
    } else {
      // a known enemy arriving with a new modifier trait
      this.push({
        kicker: 'New trait', title: newTraits.map((tr) => TRAITS[tr].name).join(' + '),
        html: `${img}<p>This wave's <b>${esc(d.name)}s</b> have a modifier:</p>
          <div class="traits">${newTraits.map((tr) => `<div>${traitChip(tr, true)}</div>`).join('')}</div>
          <p class="muted">Trait badges float above enemies on the map. Tap or hover an enemy for details.</p>`,
      });
    }
  }
}
