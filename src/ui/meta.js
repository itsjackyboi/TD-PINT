// Between-run "Ledger": sidegrade unlocks and run history, kept in localStorage.
// Unlocks add options, never raw power — every run is equally hard.
const KEY = 'aleforge.ledger.v1';

export const UNLOCKS = [
  { id: 'king:jagerbauhm', label: "King Jagerbauhm — Angel's Barricade", req: 'Reach wave 5', test: (m) => m.bestWave >= 5 },
  { id: 'tower:clock', label: 'CockPower Clock Tower', req: 'Reach wave 10', test: (m) => m.bestWave >= 10 },
  { id: 'king:guinnie', label: "King Guinnie — Old Grudge", req: 'Reach wave 15', test: (m) => m.bestWave >= 15 },
  { id: 'king:jack', label: 'King Jack Anqoak — Read the Ledger', req: 'Reach wave 20', test: (m) => m.bestWave >= 20 },
  { id: 'king:jp', label: 'King Jameson Pilsner — Whiskey & Beer', req: 'Slay 1,500 MAMAists (all runs)', test: (m) => m.totalKills >= 1500 },
  { id: 'doctrine:refinance', label: 'Doctrine: Roto Bond Refinancing', req: 'Reach wave 25', test: (m) => m.bestWave >= 25 },
  { id: 'doctrine:historicAct', label: 'Doctrine: Old Aleforge Historic Act', req: 'Reach wave 25', test: (m) => m.bestWave >= 25 },
  { id: 'mandates', label: "Plinket's Mandates (heat levels)", req: 'Defeat Susan Plinket', test: (m) => m.wins >= 1 },
];

function blank() {
  return { bestWave: 0, totalKills: 0, wins: 0, maxHeatWon: -1, runs: [], unlocked: [] };
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch { /* storage blocked — play without persistence */ }
  return blank();
}

export function saveMeta(m) {
  try { localStorage.setItem(KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

export function isUnlocked(m, id) { return m.unlocked.includes(id); }

// Records a finished run; returns labels of newly earned unlocks.
export function recordRun(m, summary) {
  m.bestWave = Math.max(m.bestWave, summary.won ? 30 : summary.wave - 1);
  m.totalKills += summary.kills;
  if (summary.won) { m.wins++; m.maxHeatWon = Math.max(m.maxHeatWon, summary.heat); }
  m.runs.unshift({ ...summary, date: new Date().toISOString().slice(0, 10) });
  m.runs = m.runs.slice(0, 25);
  const fresh = [];
  for (const u of UNLOCKS) if (!m.unlocked.includes(u.id) && u.test(m)) { m.unlocked.push(u.id); fresh.push(u.label); }
  saveMeta(m);
  return fresh;
}

export function worldUnlocks(m) {
  return {
    towers: m.unlocked.filter((u) => u.startsWith('tower:')).map((u) => u.slice(6)),
    doctrines: m.unlocked.filter((u) => u.startsWith('doctrine:')).map((u) => u.slice(9)),
    kings: ['seamus', 'buke', ...m.unlocked.filter((u) => u.startsWith('king:')).map((u) => u.slice(5))],
    mandates: m.unlocked.includes('mandates'),
  };
}

export function resetMeta() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
