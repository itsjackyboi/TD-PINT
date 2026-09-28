// Turns a wave number into a spawn queue for the current map.
// Waves 1–30 come from src/data/waves.js; freeplay (31+) is generated from a
// seed so every run's freeplay is reproducible.
import { WAVES, CAMPAIGN_WAVES, BOSS_TYPES } from '../data/waves.js';
import { makeRng } from './rng.js';

const FREEPLAY_POOL = ['zealot', 'matron', 'picket', 'believer', 'infiltrator', 'martyr', 'widow', 'revivalist', 'pamphleteer', 'bagman'];
const FREEPLAY_MODS = ['hidden', 'fortified', 'regrow', 'armored', 'fast'];

export function waveGroups(n, seed, override) {
  if (override) return override[n - 1] || [];
  if (n <= CAMPAIGN_WAVES) return WAVES[n - 1];
  return freeplayGroups(n, seed);
}

// Endless waves: bigger counts, more stacked modifiers, a boss every 10 waves.
export function freeplayGroups(n, seed) {
  const rng = makeRng((seed ^ (n * 2654435761)) >>> 0);
  const k = n - CAMPAIGN_WAVES;
  const groups = [];
  if (n % 10 === 0) {
    const boss = BOSS_TYPES[(n / 10) % BOSS_TYPES.length];
    groups.push([boss, 1 + Math.floor(k / 30), 6, 0, '*']);
  }
  const nGroups = 3 + Math.min(3, Math.floor(k / 8));
  const modChance = Math.min(0.85, 0.15 + k * 0.025);
  for (let i = 0; i < nGroups; i++) {
    const type = rng.pick(FREEPLAY_POOL);
    const baseCount = { zealot: 40, matron: 8, picket: 10, believer: 8, infiltrator: 16, martyr: 18, widow: 14, revivalist: 10, pamphleteer: 14, bagman: 2 }[type];
    const count = Math.round(baseCount * (1 + k * 0.035));
    const mods = FREEPLAY_MODS.filter(() => rng.chance(modChance * 0.4));
    groups.push([type, count, Math.max(0.08, 1.2 - k * 0.02) / Math.sqrt(baseCount / 8), i * 4, '*', mods]);
  }
  return groups;
}

// Build the spawn queue. Lanes: '*' alternates across the map's lanes; a number
// picks a lane (wrapping). With the Owe Block mandate, every third marcher gets a
// twin on the extra lane.
export function buildQueue(world, n) {
  const lanes = world.map.baseLanes;
  const extra = world.activePaths.includes(world.map.extraLane) ? world.map.extraLane : null;
  const queue = [];
  for (const g of waveGroups(n, world.seed, world.waveOverride)) {
    const [type, count, gap, delay, lane, mods = []] = g;
    for (let i = 0; i < count; i++) {
      const p = lane === '*' ? lanes[i % lanes.length] : lanes[lane % lanes.length];
      const t = delay + i * gap;
      queue.push({ t, type, path: p, d0: 0, mods });
      if (extra && i % 3 === 2 && !BOSS_TYPES.includes(type)) queue.push({ t: t + 0.3, type, path: extra, d0: 0, mods });
    }
  }
  queue.sort((a, b) => a.t - b.t);
  return queue;
}

// Short summary of what a wave contains, for the "next wave" preview.
export function wavePreview(n, seed, override) {
  const counts = {};
  const mods = new Set();
  for (const [type, count, , , , m = []] of waveGroups(n, seed, override)) {
    counts[type] = (counts[type] || 0) + count;
    for (const x of m) mods.add(x);
  }
  return { counts, mods: [...mods] };
}
