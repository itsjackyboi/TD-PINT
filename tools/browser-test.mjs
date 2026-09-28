#!/usr/bin/env node
// Browser test: serves the repo, plays through the UI in headless Chromium,
// fails on any console error, and writes screenshots to tools/screenshots/.
//   node tools/browser-test.mjs            (requires the `playwright` package)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.wav': 'audio/wav', '.ttf': 'font/ttf' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const base = `http://localhost:${port}`;
const shots = join(root, 'tools', 'screenshots');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const errors = [];
let page;
const watch = (p) => {
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  p.on('pageerror', (e) => errors.push(String(e)));
};
const shot = (n, p = page) => p.screenshot({ path: join(shots, `${n}.png`) });
const step = async (name, fn) => {
  process.stdout.write(`- ${name}… `);
  try { await fn(); } catch (e) {
    await shot('FAILED');
    console.log(await page.evaluate(() => JSON.stringify({ wave: window.app.world?.wave, over: window.app.world?.over, resolve: window.app.world?.resolve })).catch(() => ''));
    throw e;
  }
  console.log('ok');
};
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const ev = (fn, arg) => page.evaluate(fn, arg);

// a profile with XP so later tiers and towers are unlocked
const VETERAN = {
  version: 2, name: 'Rollo', tips: false, tutorialDone: true,
  towerXP: { pike: 3200, keg: 1200, bow: 3200, tap: 1600, spinner: 900, cellar: 0, light: 0, hook: 0, still: 0, scout: 0, ship: 0, caltrop: 0, farm: 0, garrison: 0, mortar: 0, repeater: 0, cloud: 0, clock: 0, witch: 0 },
  totals: { waves: 60, kills: 2000, runs: 5, wins: 1 }, best: { cumstead: { wave: 30, cleared: true } }, milestones: { plinket: true },
  seen: { towers: [], enemies: [], traits: [] }, runs: [],
};

async function clickTile(tx, ty) {
  const p = await ev(([x, y]) => window.app.renderer.toClient((x + 0.5) * 40, (y + 0.5) * 40), [tx, ty]);
  await page.mouse.click(p.x, p.y);
}

page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
watch(page);

await step('title screen with name field, mode toggle and notes', async () => {
  await page.goto(`${base}/index.html?seed=42`);
  await page.waitForSelector('#go-play');
  await page.waitForFunction(() => document.body.classList.contains('pixel'), null, { timeout: 10000 });
  await page.fill('#pname', 'Tester');
  expect(await ev(() => window.app.profile.name) === 'Tester', 'name not saved');
  await page.click('#m-exp');
  expect(await ev(() => window.app.profile.tips === false), 'experienced mode not set');
  await page.click('#m-beg');
  expect(await ev(() => window.app.profile.tips === true), 'beginner mode not set');
  await shot('01-title');
  await page.click('#go-notes');
  await page.waitForSelector('.note-paper');
  await shot('02-notes');
  await page.click('#back');
});
await step('music: title theme wanted; every song renders audible audio', async () => {
  expect(await ev(() => window.app.music.current) === 'title', 'title music not requested');
  const rms = await ev(async () => {
    const { renderSong, SONGS } = await import('/src/ui/music.js');
    const out = {};
    for (const k of Object.keys(SONGS)) out[k] = await renderSong(k, 3);
    return out;
  });
  for (const [k, v] of Object.entries(rms)) expect(v > 0.005, `song ${k} is silent (rms ${v})`);
  await page.click('#go-music');
  expect(await ev(() => window.app.music.muted && localStorage.getItem('aleforge.music') === '0'), 'music toggle not saved');
  await page.click('#go-music');
});
await step('pixel art loaded; every atlas sprite is non-empty', async () => {
  const empty = await ev(async () => {
    const { sprites, ATLAS } = await import('/src/ui/sprites.js');
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const g = c.getContext('2d');
    return Object.keys(ATLAS).filter((n) => {
      g.clearRect(0, 0, 16, 16); sprites.draw(g, n, 0, 0);
      return !g.getImageData(0, 0, 16, 16).data.some((v, i) => i % 4 === 3 && v > 0);
    });
  });
  expect(!empty.length, 'blank sprites: ' + empty.join(', '));
});
await step('all sound effects decode', async () => {
  const n = await ev(async () => {
    const names = ['build', 'upgrade', 'sell', 'bond', 'shot-bow', 'shot-pike', 'shot-keg', 'shot-tap', 'shot-still', 'shot-light', 'shot-clock', 'death1', 'death2', 'explosion', 'leak', 'king', 'coin', 'boss', 'click', 'error', 'doctrine', 'wave', 'defeat', 'victory'];
    const ctx = new OfflineAudioContext(1, 1, 22050);
    let ok = 0;
    for (const n of names) { const r = await fetch(`/assets/audio/${n}.wav`); await ctx.decodeAudioData(await r.arrayBuffer()); ok++; }
    return ok;
  });
  expect(n === 24, `${n}/24 sounds decoded`);
});
await step('first Play offers the tutorial; the tutorial completes', async () => {
  await page.click('#go-play');
  await page.waitForSelector('#t-yes');
  await page.click('#t-yes');
  await page.waitForFunction(() => window.app.tutorial?.active);
  await page.click('[data-tut=next]');
  const i = () => ev(() => window.app.tutorial?.i ?? 99);
  const waitStep = (n) => page.waitForFunction((k) => (window.app.tutorial?.i ?? 99) >= k, n, { timeout: 90000 });
  await page.click('#tb-pike'); await clickTile(10, 4);
  await waitStep(2); await page.click('#b-send');
  await ev(() => { window.app.ui.speed = 3; });
  await waitStep(4);
  await clickTile(10, 4);
  await page.click('#p-info [data-act=up][data-path="0"]');
  await waitStep(5); await page.click('#tb-tap'); await clickTile(9, 4);
  await waitStep(6); await page.click('#b-send');
  await waitStep(7); await page.click('#tb-hero'); await clickTile(7, 8);
  await waitStep(8); await page.click('#ti-caltrops');
  const road = await ev(() => { const p = window.app.world.nearestPathPoint(130, 360); return window.app.renderer.toClient(p.x, p.y); });
  await page.mouse.click(road.x, road.y);
  await waitStep(9); await page.click('#tb-keg'); await clickTile(8, 4);
  await waitStep(10); await page.click('#b-send');
  await waitStep(11); await page.click('#tb-light'); await clickTile(7, 4);
  await waitStep(12); await page.click('#b-send');
  await waitStep(13); await page.click('#b-send');
  await page.waitForSelector('#abilities .ab:not([disabled])', { timeout: 30000 });
  await shot('03-tutorial');
  await page.click('#abilities .ab');
  await page.waitForFunction(() => !window.app.tutorial, null, { timeout: 120000 });
  expect(await ev(() => window.app.profile.tutorialDone), 'tutorial not recorded');
  expect(await i() === 99, 'tutorial still running');
  await page.waitForSelector('.tipcard'); // "Ready for the siege"
  await page.click('#ok');
});
await step('map select (Random) → hero select → start', async () => {
  await page.waitForSelector('[data-map=random]');
  await shot('04-maps');
  await page.click('[data-map=random]');
  await page.waitForSelector('[data-hero]');
  await page.click('[data-hero=buke]');
  await page.click('#go');
  await page.waitForFunction(() => window.app.world && !window.app.tutorial);
  const st = await ev(() => ({ hero: window.app.world.heroId, map: window.app.world.mapId }));
  expect(st.hero === 'buke', `hero was ${st.hero}`);
  expect(['cumstead', 'aleforge', 'shanty', 'cloister'].includes(st.map), `map was ${st.map}`);
});
await step('beginner tip shows once per tower', async () => {
  await ev(() => { window.app.profile.seen = { towers: [], enemies: [], traits: [] }; });
  await page.keyboard.press('2');
  await page.waitForSelector('.tipcard');
  await shot('05-tip');
  await page.click('#ok');
  await page.keyboard.press('Escape');
  await page.keyboard.press('2');
  await page.waitForTimeout(200);
  expect(!(await page.$('.tipcard')), 'tip showed twice');
  await page.keyboard.press('Escape');
});
await step('enemy tip pauses the wave; trait panel explains counters', async () => {
  await page.click('#b-send');
  await page.waitForSelector('.tipcard', { timeout: 10000 });
  const t = await ev(() => window.app.world.time);
  await page.waitForTimeout(400);
  expect(await ev(() => window.app.world.time) === t, 'game kept running under a tip');
  await page.click('#ok');
  await page.waitForFunction(() => window.app.world.enemies.some((e) => e.alive));
  await ev(() => window.app.inspect(window.app.world.enemies.find((e) => e.alive)));
  await page.waitForSelector('#p-info .trait');
  await shot('06-enemy');
});

await step('new tower unlocked: callout, NEW! ribbon until picked; battle music', async () => {
  expect(await ev(() => window.app.music.current) === 'battle', 'battle music not requested');
  await ev(() => { window.app.profile.tips = false; const w = window.app.world; for (const a of w.activeWaves) a.qi = a.queue.length; w.wave = 3; });
  await page.waitForFunction(() => window.app.world.canSendWave());
  await ev(() => window.app.world.sendWave());
  await page.waitForSelector('#unlock.show');
  const txt = await page.textContent('#unlock');
  expect(/new tower unlocked/i.test(txt) && txt.includes('Bottle Spinner'), `callout text: ${txt}`);
  await page.waitForSelector('#tb-spinner.fresh .newtag');
  await page.waitForTimeout(700);
  await shot('06b-unlock');
  await page.keyboard.press('5');
  expect(!(await page.$('#tb-spinner.fresh')), 'NEW! ribbon not cleared after picking the tower');
  await page.keyboard.press('Escape');
});

// ------------------------------------------------------------ veteran profile
await step('XP-gated tiers: locked on a fresh tower XP, open with enough XP', async () => {
  await ev((p) => { localStorage.setItem('aleforge.profile.v2', JSON.stringify(p)); }, VETERAN);
  await page.goto(`${base}/index.html?debug&seed=7`);
  await page.waitForSelector('#go-play');
  await ev(() => window.app.startRun({ map: 'cumstead', hero: 'seamus' }));
  await ev(() => { const w = window.app.world; w.gold = 20000; });
  const r = await ev(() => {
    const w = window.app.world;
    const keg = w.placeTower('keg', 5, 4), pike = w.placeTower('pike', 6, 4);
    for (let i = 0; i < 4; i++) { w.upgrade(keg, 0); w.upgrade(pike, 0); }
    window.app.ui.selected = keg;
    return { keg: keg.tiers[0], pike: pike.tiers[0], kegBlock: w.upgradeBlock(keg, 0), cross: w.upgradeBlock(pike, 1) };
  });
  expect(r.keg === 3 && r.kegBlock === 'xp', `keg should stop at tier 3 with 1,200 XP (got ${r.keg}, ${r.kegBlock})`);
  expect(r.pike === 4, `pike should reach tier 4 with 3,200 XP (got ${r.pike})`);
  expect(r.cross === null, 'second path tier 1 should still be open');
  await page.waitForTimeout(300);
  await page.waitForSelector('#p-info .xpneed');
  await shot('07-xp-locked');
});
await step('crosspath: second path stops at tier 2', async () => {
  const b = await ev(() => { const w = window.app.world; const pike = w.towerAt(6, 4); w.upgrade(pike, 1); w.upgrade(pike, 1); return [pike.tiers.join('-'), w.upgradeBlock(pike, 1)]; });
  expect(b[0] === '4-2' && b[1] === 'crosspath', `crosspath rule broken: ${b}`);
});
await step('tier-4 ability from the ability bar; road item on the road', async () => {
  await page.waitForSelector('#abilities .ab');
  await page.click('#abilities .ab');
  expect(await ev(() => window.app.world.timers.longarm > 0), 'Long Arm did not fire');
  await page.keyboard.press('c');
  const road = await ev(() => { const p = window.app.world.nearestPathPoint(560, 620); return window.app.renderer.toClient(p.x, p.y); });
  await page.mouse.click(road.x, road.y);
  expect(await ev(() => window.app.world.items.length) === 1, 'caltrops not placed');
  await page.keyboard.press('c');
  await clickTile(1, 10); // off the road: refused, stays in placement
  expect(await ev(() => window.app.world.items.length) === 1, 'item placed off the road');
  await page.keyboard.press('Escape');
});
await step('Mortar aim point set with a click', async () => {
  await ev(() => { window.app.world.runUnlocked.add('mortar'); window.app.hud.buildBar(window.app.world); });
  await ev(() => { window.app.ui.selected = window.app.world.placeTower('mortar', 7, 4); window.app.hud.lastPanels = 0; });
  await page.waitForSelector('#p-info [data-act=aim]');
  await page.click('#p-info [data-act=aim]');
  await clickTile(20, 10);
  const aim = await ev(() => window.app.world.towerAt(7, 4).aim);
  expect(aim && Math.abs(aim.x - 820) < 30, `aim not set: ${JSON.stringify(aim)}`);
});
await step('hero placed, levels up, ability ready', async () => {
  await page.click('#tb-hero'); await clickTile(8, 8);
  await ev(() => window.app.world.heroXp(1000));
  const lv = await ev(() => window.app.world.hero.level);
  expect(lv >= 3, `hero level ${lv}`);
  await page.waitForSelector('#abilities [data-id=avalanche]');
});
await step('boss wave: Plinket phases', async () => {
  await ev(() => { const w = window.app.world; w.invincible = true; w.wave = 29; window.app.ui.speed = 8; w.sendWave(); });
  await page.waitForFunction(() => window.app.world.boss && window.app.world.boss.phase >= 2, null, { timeout: 120000 });
  expect(await ev(() => window.app.music.current) === 'boss', 'boss music not playing');
  await shot('08-boss');
});
await step('victory → Continue into Freeplay → wave 31+', async () => {
  await ev(() => { const w = window.app.world; for (const e of w.enemies) if (e.alive) w.kill(e, null); w.boss = null; for (const a of w.activeWaves) a.qi = a.queue.length; });
  await page.waitForSelector('#fp', { timeout: 60000 });
  await shot('09-victory');
  await page.click('#fp');
  await ev(() => window.app.world.sendWave());
  expect(await ev(() => window.app.world.wave) === 31 && await ev(() => window.app.world.freeplay), 'freeplay did not continue');
});
await step('stress test: 300 enemies', async () => {
  await page.click('#debug [data-d=stress]');
  await ev(() => { window.app.ui.speed = 1; });
  await page.waitForTimeout(3000);
  const perf = await ev(() => {
    const f = window.app.debug.frames;
    return { sim: f.reduce((a, x) => a + x.simMs, 0) / f.length, draw: f.reduce((a, x) => a + x.renderMs, 0) / f.length, enemies: window.app.world.enemies.length };
  });
  console.log(`\n    ${perf.enemies} enemies: sim ${perf.sim.toFixed(2)}ms, draw ${perf.draw.toFixed(2)}ms per frame`);
  expect(perf.sim + perf.draw < 16, 'frame budget exceeded');
  await shot('10-stress');
});

// ------------------------------------------------------------ leaderboard (mocked Apps Script)
await step('end of game sends the score; leaderboard reads it back', async () => {
  const p2 = await browser.newPage({ viewport: { width: 1400, height: 850 } });
  watch(p2);
  const posted = [];
  await p2.route('https://script.google.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'POST') { posted.push(JSON.parse(req.postData())); return route.fulfill({ status: 200, body: '{"ok":true}' }); }
    const map = new URL(req.url()).searchParams.get('map');
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: JSON.stringify({ rows: posted.filter((r) => r.map === map).map((r) => ({ ...r, date: '2026-01-01' })) }) });
  });
  await p2.goto(`${base}/index.html?seed=9`);
  await p2.evaluate(() => { const a = window.app; a.profile.name = 'Rollo'; a.profile.lbUrl = 'https://script.google.com/macros/s/TEST/exec'; a.profile.tutorialDone = true; a.startRun({ map: 'aleforge', hero: 'seamus' }); });
  await p2.evaluate(() => { const w = window.app.world; w.sendWave(); w.wave = 12; w.resolve = 0; });
  await p2.waitForSelector('text=Score sent', { timeout: 15000 });
  expect(posted.length === 1 && posted[0].name === 'Rollo' && posted[0].wave === 12 && posted[0].map === 'aleforge', `bad post ${JSON.stringify(posted)}`);
  await shot('11-end', p2);
  await p2.click('#lb');
  await p2.waitForSelector('#lb-body table');
  expect((await p2.textContent('#lb-body')).includes('Rollo'), 'leaderboard row missing');
  await shot('12-leaderboard', p2);
  await p2.close();
});
await step('missing art falls back to the plain renderer', async () => {
  const p3 = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p3.on('pageerror', (e) => errs.push(String(e)));
  await p3.route('**/assets/sprites/**', (r) => r.abort());
  await p3.goto(`${base}/index.html?seed=3`);
  await p3.waitForSelector('#go-play');
  await p3.evaluate(() => { window.app.startRun({ map: 'aleforge', hero: 'seamus' }); const w = window.app.world; w.placeTower('bow', 25, 6); w.sendWave(); });
  await p3.waitForTimeout(1500);
  const pixel = await p3.evaluate(() => window.app.renderer.pixel);
  await shot('13-fallback', p3);
  await p3.close();
  expect(!errs.length, 'page errors in fallback: ' + errs.join('; '));
  expect(!pixel, 'renderer should not be in pixel mode without sprites');
});

await browser.close();
server.close();
// the sprite-abort page logs failed loads by design
const real = errors.filter((e) => !/sprite sheet failed|Failed to load resource/.test(e));
if (real.length) { console.error('\nConsole errors:\n' + real.join('\n')); process.exit(1); }
console.log(`\nAll good. Screenshots in ${shots}`);
