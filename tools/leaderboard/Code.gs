/**
 * Siege of Aleforge leaderboard — Google Apps Script web app.
 *
 * Paste this into Extensions → Apps Script of a Google Sheet, then deploy it
 * as a web app (Execute as: Me, Who has access: Anyone). See SETUP.md.
 *
 *   POST  body = JSON {name, map, wave, cleared, freeplay, mode, hero, kills, seed, version}
 *         (sent as text/plain so browsers skip the CORS preflight)
 *   GET   ?map=cumstead&limit=20  →  {"rows":[{name, wave, cleared, freeplay, mode, hero, date}, …]}
 *         ranked by highest wave; ties go to whoever got there first. One row
 *         per name per map (their best).
 */

var SHEET_NAME = 'Scores';
var MAPS = ['cumstead', 'aleforge', 'shanty', 'cloister'];
var HEROES = ['seamus', 'buke', 'jagerbauhm', 'guinnie', 'jack', 'jp'];
var HEADERS = ['time', 'name', 'map', 'wave', 'cleared', 'freeplay', 'mode', 'hero', 'kills', 'seed', 'version'];
var MAX_WAVE = 1000;           // sanity cap for freeplay
var RATE_LIMIT_SECONDS = 20;   // one score per name per 20 s

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });
  try {
    var body;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return json_({ ok: false, error: 'bad json' }); }
    var entry = validate_(body);
    if (entry.error) return json_({ ok: false, error: entry.error });

    var cache = CacheService.getScriptCache();
    var key = 'rl:' + entry.name.toLowerCase();
    if (cache.get(key)) return json_({ ok: false, error: 'too many submissions' });
    cache.put(key, '1', RATE_LIMIT_SECONDS);

    sheet_().appendRow([new Date(), entry.name, entry.map, entry.wave, entry.cleared, entry.freeplay, entry.mode, entry.hero, entry.kills, entry.seed, entry.version]);
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  var map = String(p.map || '');
  if (MAPS.indexOf(map) < 0) return json_({ rows: [], error: 'unknown map' });
  var limit = Math.max(1, Math.min(100, parseInt(p.limit, 10) || 20));
  var values = sheet_().getDataRange().getValues();
  var best = {};
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (r[2] !== map) continue;
    var row = { time: new Date(r[0]).getTime(), name: String(r[1]), wave: Number(r[3]), cleared: r[4] === true || r[4] === 'TRUE', freeplay: r[5] === true || r[5] === 'TRUE', mode: String(r[6]), hero: String(r[7]) };
    var k = row.name.toLowerCase();
    var cur = best[k];
    if (!cur || row.wave > cur.wave || (row.wave === cur.wave && row.time < cur.time)) best[k] = row;
  }
  var rows = Object.keys(best).map(function (k) { return best[k]; });
  rows.sort(function (a, b) { return b.wave - a.wave || a.time - b.time; });
  rows = rows.slice(0, limit).map(function (r) {
    return { name: r.name, wave: r.wave, cleared: r.cleared, freeplay: r.freeplay, mode: r.mode, hero: r.hero, date: new Date(r.time).toISOString().slice(0, 10) };
  });
  return json_({ rows: rows });
}

// Clean and check a submission. Returns the entry or {error}.
function validate_(b) {
  var name = String(b.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20);
  // stop the sheet treating a name as a formula
  name = name.replace(/^[=+\-@]+/, '').trim();
  if (!name) name = 'Anonymous';
  var map = String(b.map || '');
  if (MAPS.indexOf(map) < 0) return { error: 'unknown map' };
  var wave = Number(b.wave);
  if (!isFinite(wave) || wave !== Math.floor(wave) || wave < 1 || wave > MAX_WAVE) return { error: 'bad wave' };
  var freeplay = b.freeplay === true;
  var cleared = b.cleared === true;
  if (!freeplay && wave > 30) return { error: 'wave above 30 outside freeplay' };
  if (cleared && wave < 30) return { error: 'cleared before wave 30' };
  if (freeplay && !cleared) return { error: 'freeplay without a clear' };
  var mode = b.mode === 'experienced' ? 'experienced' : 'beginner';
  var hero = HEROES.indexOf(String(b.hero)) >= 0 ? String(b.hero) : '';
  var kills = Math.max(0, Math.min(1e7, Math.floor(Number(b.kills) || 0)));
  var seed = Math.max(0, Math.min(2147483647, Math.floor(Number(b.seed) || 0)));
  var version = String(b.version || '').slice(0, 10);
  return { name: name, map: map, wave: wave, cleared: cleared, freeplay: freeplay, mode: mode, hero: hero, kills: kills, seed: seed, version: version };
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
