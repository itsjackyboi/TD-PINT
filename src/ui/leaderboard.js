// Leaderboard client for the Google Apps Script web app in tools/leaderboard.
// - submit: POST as text/plain with mode "no-cors" (a "simple" request, so the
//   browser sends no CORS preflight, which Apps Script can't answer). The
//   response is opaque, so a score counts as sent once the request completes;
//   network failures stay queued in the profile and are retried later.
// - top: GET ?map=…&limit=… returns JSON (Apps Script's redirect to
//   googleusercontent.com allows cross-origin reads).
// Without a URL everything stays local: the local table is built from the
// profile's own run history.
import { LEADERBOARD_URL, GAME_VERSION } from '../config.js';
import { saveProfile } from './profile.js';

export function lbUrl(profile) { return (profile.lbUrl || LEADERBOARD_URL || '').trim(); }

export function makeEntry(profile, summary) {
  return {
    name: (profile.name || 'Anonymous').slice(0, 20),
    map: summary.map,
    wave: summary.wave,
    cleared: !!summary.cleared,
    freeplay: !!summary.freeplay,
    mode: profile.tips ? 'beginner' : 'experienced',
    hero: summary.hero || '',
    kills: summary.kills || 0,
    seed: summary.seed,
    version: GAME_VERSION,
  };
}

async function post(url, entry) {
  await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(entry) });
}

// Returns 'sent' | 'queued' | 'local'
export async function submitScore(profile, summary) {
  const entry = makeEntry(profile, summary);
  const url = lbUrl(profile);
  if (!url) return 'local';
  try {
    await post(url, entry);
    return 'sent';
  } catch {
    profile.pending.push(entry);
    profile.pending = profile.pending.slice(-20);
    saveProfile(profile);
    return 'queued';
  }
}

// Retry scores that failed to send (called from the title screen).
export async function flushQueue(profile) {
  const url = lbUrl(profile);
  if (!url || !profile.pending.length) return 0;
  let sent = 0;
  while (profile.pending.length) {
    try { await post(url, profile.pending[0]); profile.pending.shift(); sent++; } catch { break; }
  }
  saveProfile(profile);
  return sent;
}

export async function fetchTop(profile, map, limit = 20) {
  const url = lbUrl(profile);
  if (!url) throw new Error('no-url');
  const u = new URL(url);
  u.searchParams.set('map', map);
  u.searchParams.set('limit', String(limit));
  const r = await fetch(u.toString(), { method: 'GET' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  if (!data || !Array.isArray(data.rows)) throw new Error('bad response');
  return data.rows;
}

// This device's best runs on a map (the fallback / "Local" tab).
export function localTop(profile, map, limit = 20) {
  return profile.runs.filter((r) => r.map === map)
    .map((r) => ({ name: profile.name || 'You', wave: r.wave, cleared: r.cleared, hero: r.hero, date: r.date }))
    .sort((a, b) => b.wave - a.wave)
    .slice(0, limit);
}
