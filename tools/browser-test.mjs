#!/usr/bin/env node
// Browser smoke test: serves the repo, plays through the UI in headless Chromium,
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

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const shots = join(root, 'tools', 'screenshots');
await mkdir(shots, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
const step = async (name, fn) => {
  process.stdout.write(`- ${name}… `);
  try { await fn(); } catch (e) { await shot('FAILED'); console.log(await page.evaluate(() => JSON.stringify({ wave: window.app.world?.wave, over: window.app.world?.over, resolve: window.app.world?.resolve }))); throw e; }
  console.log('ok');
};
const shot = (n) => page.screenshot({ path: join(shots, `${n}.png`) });

// clicks the centre of tile (tx, ty) on the scaled canvas
async function clickTile(tx, ty, opts) {
  const box = await page.locator('#game').boundingBox();
  const scale = Math.min(box.width / 1280, box.height / 720);
  const ox = box.x + (box.width - 1280 * scale) / 2, oy = box.y + (box.height - 720 * scale) / 2;
  await page.mouse.click(ox + (tx + 0.5) * 40 * scale, oy + (ty + 0.5) * 40 * scale, opts);
}

await step('title screen', async () => {
  await page.goto(`http://localhost:${port}/index.html?debug&seed=42`);
  await page.waitForSelector('text=Begin the Siege');
  await shot('01-title');
});
await step('setup + start run', async () => {
  await page.click('text=Begin the Siege');
  await page.click('#go');
  await page.waitForFunction(() => window.app.world && window.app.world.gold > 0);
});
await step('place towers with real clicks', async () => {
  await page.keyboard.press('5'); await clickTile(25, 6);
  await page.keyboard.press('1'); await clickTile(20, 8);
  await page.keyboard.press('1'); await clickTile(26, 6);
  const n = await page.evaluate(() => window.app.world.towers.length);
  if (n !== 3) throw new Error(`expected 3 towers, got ${n}`);
  await clickTile(25, 6); // select
  const sel = await page.evaluate(() => window.app.ui.selected?.type);
  if (sel !== 'bow') throw new Error('selection failed');
  await shot('02-built');
});
await step('play waves 1-3 at 8x', async () => {
  await page.evaluate(() => { window.app.ui.speed = 8; });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Space');
    await page.waitForFunction((n) => window.app.world.wave === n && window.app.world.activeWaves.length === 0, i + 1, { timeout: 60000 });
  }
  await shot('03-wave3');
});
await step('autoplay bot, then answer the doctrine pick', async () => {
  await page.click('#debug [data-d=bot]');
  await page.waitForFunction(() => window.app.world.wave >= 4, null, { timeout: 120000 });
  await page.click('#debug [data-d=bot]'); // off again: the doctrine modal is ours to answer
  await page.waitForFunction(() => {
    const w = window.app.world;
    if (w.canSendWave() && !w.activeWaves.length) w.sendWave();
    return !!document.querySelector('#modal .choice');
  }, null, { timeout: 120000, polling: 250 });
  await shot('04-doctrine');
  await page.click('.choice >> nth=0');
  await page.waitForFunction(() => window.app.world.doctrines.length === 1);
});
await step('jump to boss wave and fight Plinket', async () => {
  await page.evaluate(() => {
    const w = window.app.world;
    w.gold += 20000; w.ale += 500; w.invincible = true;
  });
  await page.fill('#d-wave', '30');
  await page.click('#debug [data-d=jump]');
  await page.evaluate(() => window.app.world.sendWave());
  await page.waitForFunction(() => window.app.world.boss && window.app.world.boss.phase >= 2, null, { timeout: 120000 });
  await shot('05-boss-p2');
});
await step('stress test: 300 enemies', async () => {
  await page.click('#debug [data-d=stress]');
  await page.evaluate(() => { window.app.ui.speed = 1; });
  await page.waitForTimeout(3000);
  const perf = await page.evaluate(() => {
    const f = window.app.debug.frames;
    return { sim: f.reduce((a, x) => a + x.simMs, 0) / f.length, draw: f.reduce((a, x) => a + x.renderMs, 0) / f.length, enemies: window.app.world.enemies.length };
  });
  console.log(`\n    ${perf.enemies} enemies: sim ${perf.sim.toFixed(2)}ms, draw ${perf.draw.toFixed(2)}ms per frame`);
  if (perf.sim + perf.draw > 16) throw new Error('frame budget exceeded');
  await shot('06-stress');
});
await step('defeat screen', async () => {
  await page.evaluate(() => { const w = window.app.world; w.invincible = false; w.resolve = 1; });
  await page.evaluate(() => { window.app.ui.speed = 8; });
  await page.waitForSelector('text=Aleforge Has Fallen', { timeout: 60000 });
  await shot('07-defeat');
});

await browser.close();
server.close();
if (errors.length) { console.error('\nConsole errors:\n' + errors.join('\n')); process.exit(1); }
console.log(`\nAll good. Screenshots in ${shots}`);
