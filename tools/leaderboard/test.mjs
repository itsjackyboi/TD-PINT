#!/usr/bin/env node
// Runs Code.gs against stubbed SpreadsheetApp / LockService / CacheService /
// ContentService, so the leaderboard logic can be checked without deploying.
//   node tools/leaderboard/test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('./Code.gs', import.meta.url), 'utf8');

function makeEnv() {
  const rows = [];
  const cache = new Map();
  let clock = Date.UTC(2026, 0, 1);
  const sheet = {
    appendRow: (r) => rows.push(r.map((v) => (v instanceof Date ? new Date(clock++) : v))),
    setFrozenRows: () => {},
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
  };
  let exists = false;
  const ctx = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (exists ? sheet : null), insertSheet: () => { exists = true; return sheet; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (s) => ({ body: s, setMimeType() { return this; } }),
    },
    Date, JSON, Math, Number, String, Object, isFinite, parseInt,
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const post = (entry) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(entry) } }).body);
  const get = (params) => JSON.parse(ctx.doGet({ parameter: params }).body);
  return { rows, cache, post, get, clearRate: () => cache.clear() };
}

const base = { name: 'Rollo', map: 'cumstead', wave: 12, cleared: false, freeplay: false, mode: 'beginner', hero: 'seamus', kills: 300, seed: 5, version: '2.0' };
const env = makeEnv();

// accepted, header row created
assert.deepEqual(env.post(base), { ok: true });
assert.equal(env.rows[0][1], 'name');
assert.equal(env.rows.length, 2);

// rate limit per name
assert.equal(env.post({ ...base, wave: 13 }).ok, false);
env.clearRate();
assert.equal(env.post({ ...base, wave: 13 }).ok, true);

// validation
env.clearRate();
assert.equal(env.post({ ...base, name: 'X', map: 'narnia' }).error, 'unknown map');
assert.equal(env.post({ ...base, name: 'X', wave: 31 }).error, 'wave above 30 outside freeplay');
assert.equal(env.post({ ...base, name: 'X', wave: 20, cleared: true }).error, 'cleared before wave 30');
assert.equal(env.post({ ...base, name: 'X', wave: 2.5 }).error, 'bad wave');
assert.equal(env.post({ ...base, name: 'X', wave: 45, freeplay: true, cleared: false }).error, 'freeplay without a clear');
// formula injection and length
env.post({ ...base, name: '=HYPERLINK("x")' + 'a'.repeat(40), wave: 3 });
assert.ok(!String(env.rows.at(-1)[1]).startsWith('='));
assert.ok(String(env.rows.at(-1)[1]).length <= 20);

// ranking: best per name, highest wave first, ties to the earlier score
env.clearRate();
env.post({ ...base, name: 'Susan', wave: 44, cleared: true, freeplay: true });
env.clearRate();
env.post({ ...base, name: 'Jack', wave: 30, cleared: true });
env.clearRate();
env.post({ ...base, name: 'Buke', wave: 30, cleared: true });
env.clearRate();
env.post({ ...base, name: 'Rollo', wave: 9 });
env.clearRate();
env.post({ ...base, name: 'Other', map: 'aleforge', wave: 50, cleared: true, freeplay: true });
const top = env.get({ map: 'cumstead', limit: '10' }).rows;
assert.deepEqual(top.map((r) => [r.name, r.wave]), [['Susan', 44], ['Jack', 30], ['Buke', 30], ['Rollo', 13], [top[4].name, 3]]);
assert.equal(env.get({ map: 'cumstead', limit: '2' }).rows.length, 2);
assert.equal(env.get({ map: 'aleforge' }).rows[0].name, 'Other');
assert.equal(env.get({ map: 'nope' }).error, 'unknown map');

console.log('leaderboard Code.gs: all checks passed');
