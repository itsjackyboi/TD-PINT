// Guided first game on Cumstead Fields: five short waves that walk through
// building, sending waves, upgrading, slowing, the hero, road items, Armored
// and Hidden enemies, and abilities. Each step waits for the player to do the
// thing; a ring points at the tile or button to use.
import { TILE } from '../core/map.js';
import { HERO_XP } from '../data/heroes.js';

export const TUTORIAL_WAVES = [
  [['zealot', 8, 1.3, 0, '*']],
  [['zealot', 10, 1.1, 0, '*'], ['matron', 1, 0, 6, '*']],
  [['believer', 1, 0, 0, '*'], ['zealot', 12, 0.8, 3, '*']],
  [['infiltrator', 4, 1.6, 0, '*'], ['zealot', 10, 0.8, 4, '*']],
  [['zealot', 30, 0.35, 0, '*'], ['widow', 3, 2.5, 4, '*'], ['revivalist', 2, 2, 8, '*']],
];

const count = (w, type) => w.towers.filter((t) => t.type === type).length;
const waveDone = (w, n) => w.wave >= n && !w.activeWaves.length;

// step: text, tile / el to point at, done(w, tut) → advance, enter(w, app) on arrival, next: manual "Next" button
const STEPS = [
  { text: 'MAMA marches along the road from the top-left to your keep on the right. Every enemy that gets through costs <b>Resolve</b> (your lives). Build towers beside the road to stop them.', next: true },
  { text: 'Pick the <b>Pikeman</b> from the bar at the bottom, then place it on the marked tile next to the road.', el: '#tb-pike', tile: [10, 4], done: (w) => count(w, 'pike') > 0 },
  { text: 'Now press <b>Send Wave</b>. Waves only start when you say so.', el: '#b-send', done: (w) => w.wave >= 1 },
  { text: 'Your Pikeman throws spears at the first enemy in range. Every kill pays gold. Let the wave finish.', done: (w) => waveDone(w, 1) },
  { text: 'Upgrades make towers much stronger. Tap your Pikeman and buy <b>Long Spears</b> from the first path: each spear then hits two enemies.', tile: [10, 4], done: (w) => w.towers.some((t) => t.type === 'pike' && t.tiers[0] + t.tiers[1] > 0) },
  { text: 'Build a <b>Taproom</b> on the marked tile. It does no damage, but its sticky ale slows enemies so your towers get more hits in.', el: '#tb-tap', tile: [9, 4], done: (w) => count(w, 'tap') > 0 },
  { text: 'Send wave 2. It brings a <b>Temperance Matron</b>: towers near her lose their buffs and ale towers fire at half speed.', el: '#b-send', done: (w) => waveDone(w, 2) },
  { text: 'Time for your hero. Pick <b>Seamus</b> at the left end of the bar and place him in the middle of the loop. Heroes level up as they fight and gain abilities.', el: '#tb-hero', tile: [7, 8], enter: (w) => { w.gold = Math.max(w.gold, 260); }, done: (w) => !!w.hero },
  { text: 'Road items cost <b>ale</b>. Pick <b>Caltrops</b> from the bar and drop them on the road. The next 20 enemies to cross take damage.', el: '#ti-caltrops', enter: (w) => { w.ale = Math.max(w.ale, 30); }, done: (w) => w.stats.itemsUsed > 0 },
  { text: 'Wave 3 has a <b>True Believer</b>. It is <b>Armored</b>: sharp attacks like spears bounce off. Explosives work, so build a <b>Keg Catapult</b> on the marked tile.', el: '#tb-keg', tile: [8, 4], enter: (w) => { w.gold = Math.max(w.gold, 160); }, done: (w) => count(w, 'keg') > 0 },
  { text: 'Send wave 3 and watch the kegs crack the armour. Tap an enemy any time to see its traits and what beats it.', el: '#b-send', done: (w) => waveDone(w, 3) },
  { text: 'Wave 4 has <b>Hidden</b> Infiltrators. Towers can\'t target them without detection. A <b>Lighthouse</b> (it normally unlocks at wave 8) reveals Hidden enemies near it for every tower. Build one on the marked tile.', el: '#tb-light', tile: [7, 4],
    enter: (w, app) => { w.runUnlocked.add('light'); w.gold = Math.max(w.gold, 220); app.hud.buildBar(w); }, done: (w) => count(w, 'light') > 0 },
  { text: 'Send wave 4.', el: '#b-send', done: (w) => waveDone(w, 4) },
  { text: 'Seamus reached level 3 and learned <b>Barrel Avalanche</b>. Send the last wave and use the ability from the bar under the map when the crowd bunches up.', el: '#b-send',
    enter: (w) => { const h = w.hero; if (h && h.level < 3) w.heroXp(HERO_XP[2] - h.xp + 1); }, done: (w, tut) => w.wave >= 5 && tut.usedAbility },
  { text: 'Nice. Hold the line until the wave is over.', done: (w) => w.won },
];

export class Tutorial {
  constructor(app) {
    this.app = app;
    this.active = true;
    this.i = -1;
    this.usedAbility = false;
    this.el = document.getElementById('tutor');
    this.ring = document.getElementById('tutor-ring');
    this.el.classList.remove('hidden');
    this.el.onclick = (ev) => {
      const b = ev.target.closest('[data-tut]');
      if (!b) return;
      if (b.dataset.tut === 'next') this.advance();
      if (b.dataset.tut === 'skip') app.endTutorial(false);
    };
    this.advance();
  }

  get step() { return STEPS[this.i]; }

  advance() {
    this.glow(null);
    this.i++;
    const st = this.step;
    if (!st) return;
    st.enter?.(this.app.world, this.app);
    this.el.innerHTML = `<div class="tstep">Tutorial ${this.i + 1}/${STEPS.length}</div><div class="tbody">${st.text}</div>
      <div class="tbtns">${st.next ? '<button class="primary" data-tut="next">Next</button>' : ''}<button data-tut="skip">Skip tutorial</button></div>`;
    this.glow(st.el);
  }

  glow(sel) {
    document.querySelectorAll('.tut-glow').forEach((e) => e.classList.remove('tut-glow'));
    if (sel) document.querySelector(sel)?.classList.add('tut-glow');
  }

  onEvent(ev) { if (ev.type === 'ability') this.usedAbility = true; }

  tick(world) {
    const st = this.step;
    if (!st) return;
    if (st.el && !document.querySelector(`${st.el}.tut-glow`)) this.glow(st.el); // bar was rebuilt
    if (st.done && st.done(world, this)) { this.advance(); return; }
    if (st.tile && !world.towerAt(st.tile[0], st.tile[1])) {
      const p = this.app.renderer.toClient((st.tile[0] + 0.5) * TILE, (st.tile[1] + 0.5) * TILE);
      const size = TILE * this.app.renderer.scale() * 1.4;
      Object.assign(this.ring.style, { left: `${p.x - size / 2}px`, top: `${p.y - size / 2}px`, width: `${size}px`, height: `${size}px` });
      this.ring.classList.remove('hidden');
    } else this.ring.classList.add('hidden');
  }

  close() {
    this.active = false;
    this.glow(null);
    this.el.classList.add('hidden');
    this.ring.classList.add('hidden');
  }
}
