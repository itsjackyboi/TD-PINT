#!/usr/bin/env node
// Tower benchmark: each tower alone (at its best tile on the chosen map) against a
// fixed test wave. Reports damage dealt and damage per gold so tiers can be compared.
//   node tools/bench.mjs [--map=cumstead] [--tiers=0,0|2,0|...] [--wave=8] [--only=pike,keg]
import { World } from '../src/core/world.js';
import { Bot } from '../src/core/bot.js';
import { veteranUnlocks } from '../src/core/progress.js';
import { TOWERS, TOWER_ORDER } from '../src/data/towers.js';

const args = process.argv.slice(2);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const map = opt('map', 'cumstead');
const waveN = Number(opt('wave', 8));
const tierSets = opt('tiers', '0,0;2,0;0,2;4,2;2,4').split(';').map((s) => s.split(',').map(Number));
const only = opt('only', '') ? opt('only').split(',') : TOWER_ORDER;

// a mixed column: plain, armored, hidden and tough units spread over ~40s
const TEST = [
  ['zealot', 30, 0.5, 0, '*'],
  ['revivalist', 6, 2, 4, '*'],
  ['believer', 4, 3, 8, '*'],
  ['infiltrator', 6, 2, 12, '*'],
  ['widow', 6, 2, 16, '*'],
];

function bench(type, tiers) {
  const waves = []; waves[waveN - 1] = TEST;
  const w = new World({ seed: 7, headless: true, map, hero: null, unlocks: veteranUnlocks(), waves, gold: 1e7 });
  w.wave = waveN - 1;
  w.resolve = 1e9; // leaks never end the test
  for (const k of Object.keys(TOWERS)) w.runUnlocked.add(k);
  const bot = new Bot(w, { plan: [] });
  const tile = bot.bestTile(type);
  if (!tile) return null;
  const t = w.placeTower(type, tile.tx, tile.ty);
  if (!t) return null;
  let spent = TOWERS[type].cost;
  const order = tiers[0] >= tiers[1] ? [1, 0] : [0, 1];
  for (const p of order) {
    while (t.tiers[p] < tiers[p]) {
      spent += w.upgradeCost(t, p);
      if (!w.upgrade(t, p, true)) return null;
    }
  }
  w.sendWave();
  for (let i = 0; i < 240 * 60 && w.activeWaves.length; i++) w.update(1 / 60);
  const dmg = Object.values(w.stats.dmgByType).reduce((a, b) => a + b, 0);
  return { dmg, spent, kills: w.stats.kills, leaks: w.stats.leaks, income: w.stats.goldEarned };
}

console.log(`map ${map}, wave ${waveN}; tiers ${tierSets.map((t) => t.join('-')).join(' ')}`);
console.log('tower'.padEnd(10) + tierSets.map((t) => `${t.join('-')}: dmg / per-gold / kills`.padEnd(30)).join(''));
for (const type of only) {
  const cells = tierSets.map((ts) => {
    const r = bench(type, ts);
    return r ? `${Math.round(r.dmg)} / ${(r.dmg / r.spent).toFixed(1)} / ${r.kills}`.padEnd(30) : '—'.padEnd(30);
  });
  console.log(type.padEnd(10) + cells.join(''));
}
