// Player profile and unlock rules (DOM-free: the simulator uses this too).
// - Towers: a few are available from the start, some unlock mid-run at a wave
//   (every run), some unlock permanently with XP earned on a related tower, and
//   the strongest need long-term milestones across many games.
// - Upgrade tiers 3–4 of each tower need XP with that tower.
// - Heroes unlock with milestones.
import { TOWERS, TOWER_ORDER, TIER_XP } from '../data/towers.js';
import { HEROES, HERO_ORDER } from '../data/heroes.js';
import { MAP_ORDER } from '../data/maps.js';

export const XP_PER_DAMAGE = 1 / 40;

export function blankProfile() {
  return {
    version: 2, name: '', tips: true, tutorialDone: false,
    towerXP: Object.fromEntries(TOWER_ORDER.map((t) => [t, 0])),
    totals: { waves: 0, kills: 0, runs: 0, wins: 0 },
    best: {}, // mapId -> { wave, cleared }
    milestones: { plinket: false },
    seen: { towers: [], enemies: [], traits: [] },
    runs: [],
  };
}

const HERO_UNLOCKS = {
  seamus: { label: 'Available from the start', test: () => true },
  buke: { label: 'Available from the start', test: () => true },
  jagerbauhm: { label: 'Survive 25 waves in total', test: (p) => p.totals.waves >= 25 },
  guinnie: { label: 'Reach wave 15 on any map', test: (p) => bestWave(p) >= 15 },
  jack: { label: 'Reach wave 20 on any map', test: (p) => bestWave(p) >= 20 },
  jp: { label: 'Defeat 1,500 enemies in total', test: (p) => p.totals.kills >= 1500 },
};

const MILESTONES = {
  waves400: { label: 'Survive 400 waves in total', progress: (p) => [p.totals.waves, 400] },
  plinket: { label: 'Defeat Susan Plinket on any map', progress: (p) => [p.milestones.plinket ? 1 : 0, 1] },
  maps3: { label: 'Clear 3 different maps, or reach freeplay wave 50', progress: (p) => [Math.max(clears(p), bestWave(p) >= 50 ? 3 : 0), 3] },
};

export function bestWave(p) { return Math.max(0, ...Object.values(p.best).map((b) => b.wave || 0)); }
export function clears(p) { return Object.values(p.best).filter((b) => b.cleared).length; }

// Is a tower permanently available (not counting mid-run wave unlocks)?
export function towerStatus(p, type) {
  const u = TOWERS[type].unlock;
  if (u.start) return { available: true, label: 'Available from the start' };
  if (u.wave) return { available: false, inRun: u.wave, label: `Unlocks each run when you reach wave ${u.wave}` };
  if (u.xp) {
    const have = p.towerXP[u.xp.tower] || 0;
    return { available: have >= u.xp.amount, label: `Earn ${u.xp.amount.toLocaleString()} XP with the ${TOWERS[u.xp.tower].short}`, progress: [Math.min(have, u.xp.amount), u.xp.amount] };
  }
  if (u.milestone) {
    const m = MILESTONES[u.milestone];
    const [have, need] = m.progress(p);
    return { available: have >= need, label: m.label, progress: [Math.min(have, need), need] };
  }
  return { available: false, label: '?' };
}

export function tierCap(p, type) {
  const xp = p.towerXP[type] || 0;
  let cap = 2;
  for (let t = 3; t <= 4; t++) if (xp >= TIER_XP[t]) cap = t;
  return cap;
}

export function heroStatus(p, id) {
  const h = HERO_UNLOCKS[id];
  return { available: h.test(p), label: h.label };
}

// Unlock state handed to a World at run start.
export function runUnlocks(p) {
  const towers = TOWER_ORDER.filter((t) => towerStatus(p, t).available);
  const tiers = Object.fromEntries(TOWER_ORDER.map((t) => [t, tierCap(p, t)]));
  const heroes = HERO_ORDER.filter((h) => heroStatus(p, h).available);
  return { towers, tiers, heroes, mandates: clears(p) >= 1 };
}

// Everything unlocked, max tiers (simulator "veteran" profile).
export function veteranUnlocks() {
  return { towers: [...TOWER_ORDER], tiers: Object.fromEntries(TOWER_ORDER.map((t) => [t, 4])), heroes: [...HERO_ORDER], mandates: true };
}

function snapshot(p) {
  const s = new Set();
  for (const t of TOWER_ORDER) {
    if (towerStatus(p, t).available) s.add(`tower:${t}`);
    const cap = tierCap(p, t);
    for (let k = 3; k <= cap; k++) s.add(`tier:${t}:${k}`);
  }
  for (const h of HERO_ORDER) if (heroStatus(p, h).available) s.add(`hero:${h}`);
  if (clears(p) >= 1) s.add('mandates');
  return s;
}

export function describeUnlock(key) {
  const [kind, a, b] = key.split(':');
  if (kind === 'tower') return `New tower: ${TOWERS[a].name}`;
  if (kind === 'tier') return `${TOWERS[a].name}: tier ${b} upgrades`;
  if (kind === 'hero') return `New hero: ${HEROES[a].name}`;
  if (kind === 'mandates') return "Plinket's Mandates (extra-hard modifiers)";
  return key;
}

// Apply a finished run to the profile. summary: { map, wave, cleared, kills, damage: {type: dmg}, plinket }
// Returns { xp: {type: gained}, unlocked: [keys] }.
export function awardRun(p, summary) {
  const before = snapshot(p);
  const xp = {};
  for (const [type, dmg] of Object.entries(summary.damage || {})) {
    if (!(type in p.towerXP)) continue;
    const g = Math.floor(dmg * XP_PER_DAMAGE);
    if (g > 0) { xp[type] = g; p.towerXP[type] += g; }
  }
  const survived = Math.max(0, summary.wave - (summary.cleared && !summary.freeplay ? 0 : 1));
  p.totals.waves += survived;
  p.totals.kills += summary.kills || 0;
  p.totals.runs += 1;
  if (summary.cleared) p.totals.wins += 1;
  if (summary.plinket) p.milestones.plinket = true;
  const b = p.best[summary.map] || { wave: 0, cleared: false };
  b.wave = Math.max(b.wave, summary.wave);
  b.cleared = b.cleared || !!summary.cleared;
  p.best[summary.map] = b;
  p.runs.unshift({ ...summary, damage: undefined, date: new Date().toISOString().slice(0, 10) });
  p.runs = p.runs.slice(0, 25);
  const after = snapshot(p);
  return { xp, unlocked: [...after].filter((k) => !before.has(k)) };
}

export { MILESTONES, HERO_UNLOCKS, MAP_ORDER };
