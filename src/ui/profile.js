// The player's profile in localStorage: name, settings, tower XP, bests and
// "seen" sets for beginner tips. Rules live in src/core/progress.js; this file
// only loads, migrates and saves.
import { blankProfile } from '../core/progress.js';
import { TOWER_ORDER } from '../data/towers.js';

const KEY = 'aleforge.profile.v2';
const OLD_KEY = 'aleforge.ledger.v1';

function normalize(p) {
  const b = blankProfile();
  const out = { ...b, ...p };
  out.towerXP = { ...b.towerXP, ...(p.towerXP || {}) };
  out.totals = { ...b.totals, ...(p.totals || {}) };
  out.milestones = { ...b.milestones, ...(p.milestones || {}) };
  out.seen = { towers: [], enemies: [], traits: [], ...(p.seen || {}) };
  out.best = p.best || {};
  out.runs = p.runs || [];
  out.pending = p.pending || []; // leaderboard submissions waiting for a connection
  out.lbUrl = p.lbUrl || '';
  return out;
}

// v1 "Ledger" → v2 profile: keep best wave, kills and wins on the original map
function migrate(old) {
  const p = blankProfile();
  p.totals.kills = old.totalKills || 0;
  p.totals.wins = old.wins || 0;
  p.totals.runs = (old.runs || []).length;
  p.totals.waves = (old.runs || []).reduce((a, r) => a + Math.max(0, (r.won ? 30 : r.wave - 1) || 0), 0);
  if (old.bestWave) p.best.aleforge = { wave: old.won ? 30 : old.bestWave, cleared: (old.wins || 0) > 0 };
  if ((old.wins || 0) > 0) p.milestones.plinket = true;
  return p;
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    const old = localStorage.getItem(OLD_KEY);
    if (old) { const p = normalize(migrate(JSON.parse(old))); saveProfile(p); return p; }
  } catch { /* storage blocked — play without persistence */ }
  return normalize(blankProfile());
}

export function saveProfile(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function resetProfile(keepName) {
  const p = normalize(blankProfile());
  if (keepName) { p.name = keepName.name; p.tips = keepName.tips; p.lbUrl = keepName.lbUrl; }
  saveProfile(p);
  return p;
}

// Mark something as seen for beginner tips; returns true the first time.
export function markSeen(p, kind, id) {
  const list = p.seen[kind] || (p.seen[kind] = []);
  if (list.includes(id)) return false;
  list.push(id);
  saveProfile(p);
  return true;
}

export const ALL_TOWERS = TOWER_ORDER;
