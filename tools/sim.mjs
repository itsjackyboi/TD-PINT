#!/usr/bin/env node
// Headless balance simulator.
//   node tools/sim.mjs                         run every build in tools/builds/
//   node tools/sim.mjs tools/builds/x.json     run specific builds
//   options: --seed=N  --seeds=N (run N seeds, report spread)  --verbose  --mandates=a,b  --unlock-all
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { World } from '../src/core/world.js';
import { Bot } from '../src/core/bot.js';

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
const MAX_TIME = 60 * 60; // an hour of game time is a stuck run

export function runBuild(build, seed, o = {}) {
  const unlockAll = o.unlockAll;
  const w = new World({
    seed, headless: true, mandates: o.mandates || [], kings: build.kings_pick || ['seamus', 'buke'],
    unlocks: unlockAll ? { towers: ['clock'], doctrines: ['refinance', 'historicAct'] } : { towers: [], doctrines: [] },
  });
  const bot = new Bot(w, build);
  const perWave = [];
  let lastWave = 0, leaksAt = 0;
  while (!w.over && w.time < MAX_TIME) {
    bot.think(DT);
    w.update(DT);
    for (const ev of w.events) {
      if (ev.type === 'waveEnd') {
        perWave.push({ wave: ev.wave, resolve: w.resolve, gold: Math.round(w.gold), ale: w.ale, leaks: w.stats.leaks - leaksAt, towers: w.towers.length, morale: Math.round(w.avgMorale()) });
        leaksAt = w.stats.leaks;
      }
    }
    w.events.length = 0;
    lastWave = w.wave;
  }
  return { summary: w.summary(), perWave, world: w, lastWave };
}

const seeds = Number(opt('seeds', 1));
const baseSeed = Number(opt('seed', 12345));
const mandates = opt('mandates', '') ? String(opt('mandates')).split(',') : [];
for (const f of files) {
  const build = JSON.parse(readFileSync(f, 'utf8'));
  const results = [];
  for (let i = 0; i < seeds; i++) {
    const t0 = performance.now();
    const r = runBuild(build, baseSeed + i, { mandates, unlockAll: opt('unlock-all', false) });
    r.ms = performance.now() - t0;
    results.push(r);
  }
  const target = build.target ? ` (target: ${build.target})` : '';
  console.log(`\n=== ${build.name}${target} ===`);
  for (const r of results) {
    const s = r.summary;
    const outcome = s.won ? `WON with ${s.resolve} resolve` : `DIED on wave ${s.wave}`;
    console.log(`seed ${s.seed}: ${outcome} | kills ${s.kills} leaks ${s.leaks} towers ${s.towers} | doctrines ${s.doctrines.join(',')} | ${r.ms.toFixed(0)}ms`);
    if (opt('verbose', false) || seeds === 1) {
      console.log('  wave  resolve  gold  ale  leaks  towers  morale');
      for (const p of r.perWave) console.log(`  ${String(p.wave).padStart(4)}  ${String(p.resolve).padStart(7)}  ${String(p.gold).padStart(4)}  ${String(p.ale).padStart(3)}  ${String(p.leaks).padStart(5)}  ${String(p.towers).padStart(6)}  ${String(p.morale).padStart(6)}`);
      const dmg = r.world.stats.dmgByType;
      const total = Object.values(dmg).reduce((a, b) => a + b, 0) || 1;
      console.log('  damage share: ' + Object.entries(dmg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / total).toFixed(0)}%`).join(', '));
      const leakTypes = {};
      for (const l of r.world.leakLog) leakTypes[l.type] = (leakTypes[l.type] || 0) + 1;
      console.log('  leaks by type: ' + JSON.stringify(leakTypes));
    }
  }
}
