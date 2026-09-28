#!/usr/bin/env node
// Headless balance simulator.
//   node tools/sim.mjs [builds...] [--map=aleforge|cumstead|shanty|cloister|all] [--profile=fresh|veteran]
//                      [--seeds=N] [--seed=N] [--freeplay=N] [--hero=seamus] [--mandates=a,b] [--verbose]
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../src/core/world.js';
import { Bot } from '../src/core/bot.js';
import { blankProfile, runUnlocks, veteranUnlocks } from '../src/core/progress.js';
import { MAP_ORDER } from '../src/data/maps.js';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const a = args.find((x) => x.startsWith(`--${name}`));
  if (!a) return dflt;
  return a.includes('=') ? a.split('=')[1] : true;
};
let files = args.filter((a) => !a.startsWith('--'));
if (!files.length) files = readdirSync(join(here, 'builds')).filter((f) => f.endsWith('.json')).map((f) => join(here, 'builds', f));

const DT = 1 / 60;
const MAX_TIME = 2 * 60 * 60;

export function runBuild(build, seed, o = {}) {
  const profile = o.profile || build.profile || 'fresh';
  const unlocks = profile === 'veteran' ? veteranUnlocks() : runUnlocks(blankProfile());
  const w = new World({ seed, headless: true, map: o.map, mandates: o.mandates || [], hero: o.hero || build.hero || 'seamus', unlocks });
  const bot = new Bot(w, { ...build, freeplay: !!o.freeplay });
  const perWave = [];
  let leaksAt = 0;
  while (w.time < MAX_TIME) {
    if (w.over && !(w.won && o.freeplay && !w.freeplay)) break;
    if (o.freeplay && w.wave >= o.freeplay && !w.activeWaves.length) break;
    bot.think(DT);
    w.update(DT);
    for (const ev of w.events) {
      if (ev.type === 'waveEnd') {
        perWave.push({ wave: ev.wave, resolve: w.resolve, gold: Math.round(w.gold), ale: w.ale, leaks: w.stats.leaks - leaksAt, towers: w.towers.length, morale: Math.round(w.avgMorale()) });
        leaksAt = w.stats.leaks;
      }
    }
    w.events.length = 0;
  }
  return { summary: w.summary(), perWave, world: w };
}

const seeds = Number(opt('seeds', 1));
const baseSeed = Number(opt('seed', 12345));
const mandates = opt('mandates', '') ? String(opt('mandates')).split(',') : [];
const mapOpt = opt('map', 'aleforge');
const maps = mapOpt === 'all' ? MAP_ORDER : [mapOpt];
const freeplay = opt('freeplay', false) ? Number(opt('freeplay')) : 0;
for (const f of files) {
  const build = JSON.parse(readFileSync(f, 'utf8'));
  for (const map of maps) {
    console.log(`\n=== ${build.name} on ${map} (${opt('profile', build.profile || 'fresh')})${build.target ? ` — target: ${build.target}` : ''} ===`);
    for (let i = 0; i < seeds; i++) {
      const t0 = performance.now();
      const r = runBuild(build, baseSeed + i, { map, mandates, profile: opt('profile', undefined), hero: opt('hero', undefined), freeplay });
      const s = r.summary;
      const outcome = s.cleared && !s.freeplay ? `CLEARED with ${s.resolve} resolve` : s.freeplay ? `FREEPLAY reached wave ${s.wave}` : `DIED on wave ${s.wave}`;
      console.log(`seed ${s.seed}: ${outcome} | kills ${s.kills} leaks ${s.leaks} towers ${s.towers} hero L${s.heroLevel} | ${(performance.now() - t0).toFixed(0)}ms`);
      if (opt('verbose', false)) {
        console.log('  wave  resolve  gold  ale  leaks  towers  morale');
        for (const p of r.perWave) console.log(`  ${String(p.wave).padStart(4)}  ${String(p.resolve).padStart(7)}  ${String(p.gold).padStart(5)}  ${String(p.ale).padStart(3)}  ${String(p.leaks).padStart(5)}  ${String(p.towers).padStart(6)}  ${String(p.morale).padStart(6)}`);
        const dmg = s.damage, total = Object.values(dmg).reduce((a, b) => a + b, 0) || 1;
        console.log('  damage share: ' + Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / total).toFixed(0)}%`).join(', '));
        const lk = {}; for (const l of r.world.leakLog) lk[l.type] = (lk[l.type] || 0) + 1;
        console.log('  leaks by type: ' + JSON.stringify(lk));
      }
    }
  }
}
