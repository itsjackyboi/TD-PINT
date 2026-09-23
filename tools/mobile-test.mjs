#!/usr/bin/env node
// Mobile/touch smoke test: emulated iPhone (landscape) and Android (portrait) in
// headless Chromium with real touch input (taps, CDP multi-touch pinch, drag,
// long-press). Fails on console errors; screenshots go to tools/screenshots/.
// Note: this is Chromium emulating the devices, not real WebKit/iOS Safari.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(root, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const shots = join(root, 'tools', 'screenshots');
await mkdir(shots, { recursive: true });
const browser = await chromium.launch();
const errors = [];

async function newPage(device, query = '') {
  const ctx = await browser.newContext({ ...devices[device] });
  // pretend Jagerbauhm is unlocked so the targeted-ability flow can be tested
  await ctx.addInitScript(() => {
    localStorage.setItem('aleforge.ledger.v1', JSON.stringify({ bestWave: 5, totalKills: 0, wins: 0, maxHeatWon: -1, runs: [], unlocked: ['king:jagerbauhm'] }));
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${device}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${device}] ${e}`));
  await page.goto(`${base}/index.html?seed=42${query}`);
  const cdp = await ctx.newCDPSession(page);
  return { page, cdp, ctx };
}

// world tile / point -> client coordinates via the renderer's camera
const toClient = (page, x, y) => page.evaluate(([x, y]) => {
  const r = window.app.renderer, rect = r.c.getBoundingClientRect(), s = r.scale();
  return { x: rect.left + r.cssW / 2 + (x - r.cam.x) * s, y: rect.top + r.cssH / 2 + (y - r.cam.y) * s };
}, [x, y]);
const tile = (page, tx, ty) => toClient(page, (tx + 0.5) * 40, (ty + 0.5) * 40);
async function tapTile(page, tx, ty) { const p = await tile(page, tx, ty); await page.touchscreen.tap(p.x, p.y); }
const touch = (cdp, type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i })) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = (page, fn, arg) => page.evaluate(fn, arg);
let current;
async function step(name, fn) {
  process.stdout.write(`- ${name}… `);
  try { await fn(); } catch (e) { await current?.screenshot({ path: join(shots, 'mobile-FAILED.png') }); throw e; }
  console.log('ok');
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

// ------------------------------------------------------------ iPhone landscape
const { page, cdp } = await newPage('iPhone 13 landscape');
current = page;
await step('iPhone landscape: title → setup → start via taps', async () => {
  await page.tap('text=Begin the Siege');
  await page.tap('[data-king=seamus]'); // swap Seamus for Jagerbauhm
  await page.tap('[data-king=jagerbauhm]');
  await page.tap('#go');
  await page.waitForFunction(() => window.app.world);
  expect(await ev(page, () => document.body.classList.contains('touch')), 'touch mode not detected');
  const kings = await ev(page, () => window.app.world.kings);
  expect(kings.includes('jagerbauhm'), `kings were ${kings}`);
  await page.screenshot({ path: join(shots, 'mobile-01-landscape.png') });
});
await step('tap-tap to build (preview then confirm)', async () => {
  await page.tap('#tb-bow');
  await tapTile(page, 25, 6);
  expect(await ev(page, () => window.app.world.towers.length) === 0, 'first tap should only preview');
  expect(await page.isVisible('#confirm'), 'confirm bar hidden');
  await page.screenshot({ path: join(shots, 'mobile-02-preview.png') });
  await tapTile(page, 25, 6);
  expect(await ev(page, () => window.app.world.towers.length) === 1, 'second tap should build');
});
await step('build via the ✓ button', async () => {
  await page.tap('#tb-pike');
  await tapTile(page, 20, 8);
  await page.tap('#b-confirm');
  expect(await ev(page, () => window.app.world.towerAt(20, 8)?.type) === 'pike', 'pike not built');
});
await step('tap tower → drawer → upgrade and sell', async () => {
  await tapTile(page, 25, 6);
  await page.waitForFunction(() => document.body.classList.contains('drawer-open'));
  await sleep(300); // drawer slide-in
  await page.tap('#p-info [data-act=up][data-branch="0"]');
  expect(await ev(page, () => window.app.world.towerAt(25, 6).tier) === 1, 'upgrade failed');
  await page.screenshot({ path: join(shots, 'mobile-03-drawer.png') });
  await page.tap('#side-tabs [data-tab=letter]');
  expect(await page.isVisible('#p-letter'), 'letter tab not shown');
  await page.tap('#side-tabs [data-tab=info]');
  await page.tap('#b-drawer-close');
  expect(!(await ev(page, () => document.body.classList.contains('drawer-open'))), 'drawer ✕ did not close');
  await sleep(300); // slide-out
  await tapTile(page, 20, 8);
  await sleep(300);
  await page.tap('#p-info [data-act=sell]');
  expect(!(await ev(page, () => window.app.world.towerAt(20, 8))), 'sell failed');
  await tapTile(page, 12, 1); // empty ground closes the drawer
  expect(!(await ev(page, () => document.body.classList.contains('drawer-open'))), 'drawer should close');
});
await step('pinch zoom, then build accurately while zoomed', async () => {
  const c = await toClient(page, 640, 360);
  await touch(cdp, 'touchStart', [[c.x - 40, c.y], [c.x + 40, c.y]]);
  for (let i = 1; i <= 8; i++) await touch(cdp, 'touchMove', [[c.x - 40 - i * 15, c.y], [c.x + 40 + i * 15, c.y]]);
  await touch(cdp, 'touchEnd', []);
  const z = await ev(page, () => window.app.renderer.cam.z);
  expect(z > 1.5, `zoom was ${z}`);
  await page.screenshot({ path: join(shots, 'mobile-04-zoomed.png') });
  await ev(page, () => { window.app.world.gold += 500; });
  await page.tap('#tb-pike');
  const cam = await ev(page, () => ({ ...window.app.renderer.cam }));
  const tx = Math.floor(cam.x / 40) + 1, ty = Math.floor(cam.y / 40) - 1;
  let target = [tx, ty];
  const ok = await ev(page, ([x, y]) => !window.app.world.canPlace('pike', x, y), target);
  if (!ok) target = await ev(page, ([cx, cy]) => {
    for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
      if (!window.app.world.canPlace('pike', cx + dx, cy + dy)) return [cx + dx, cy + dy];
  }, [tx, ty]);
  await tapTile(page, ...target);
  await tapTile(page, ...target);
  expect(await ev(page, ([x, y]) => window.app.world.towerAt(x, y)?.type, target) === 'pike', `zoomed tap missed tile ${target}`);
});
await step('one-finger drag pans; ⤢ resets', async () => {
  const before = await ev(page, () => window.app.renderer.cam.x);
  const c = await toClient(page, 640, 360);
  await touch(cdp, 'touchStart', [[c.x, c.y]]);
  for (let i = 1; i <= 6; i++) await touch(cdp, 'touchMove', [[c.x + i * 20, c.y]]);
  await touch(cdp, 'touchEnd', []);
  const after = await ev(page, () => window.app.renderer.cam.x);
  expect(Math.abs(after - before) > 20, `pan did nothing (${before} → ${after})`);
  await page.tap('#b-fit');
  expect(await ev(page, () => window.app.renderer.cam.z) === 1, 'fit did not reset');
});
await step('double-tap empty ground zooms', async () => {
  const p = await tile(page, 12, 1);
  await page.touchscreen.tap(p.x, p.y);
  await sleep(80);
  await page.touchscreen.tap(p.x, p.y);
  expect(await ev(page, () => window.app.renderer.cam.z) > 1.5, 'double-tap zoom failed');
  await page.tap('#b-fit');
});
await step('send wave, long-press an enemy to inspect', async () => {
  await page.tap('#b-send');
  await page.waitForFunction(() => window.app.world.enemies.some((e) => e.alive && e.x > 40 && e.y > 40), null, { timeout: 20000 });
  await page.tap('#b-pause');
  const e = await ev(page, () => { const e = window.app.world.enemies.find((e) => e.alive && e.x > 40 && e.y > 40); return { x: e.x, y: e.y }; });
  const c = await toClient(page, e.x, e.y);
  await touch(cdp, 'touchStart', [[c.x, c.y]]);
  await sleep(650);
  await touch(cdp, 'touchEnd', []);
  expect(await ev(page, () => !!window.app.ui.hoverEnemy), 'long-press did not inspect');
  await sleep(250);
  expect((await page.textContent('#p-info')).includes('Zealot'), 'enemy info not shown');
  await page.screenshot({ path: join(shots, 'mobile-05-inspect.png') });
  await page.tap('#b-drawer-close');
  await sleep(300);
  await page.tap('#b-pause');
});
await step("Jagerbauhm's barricade: preview then confirm on the road", async () => {
  await ev(page, () => { window.app.world.ale += 60; });
  await page.tap('#b-drawer');
  await page.tap('#side-tabs [data-tab=kings]');
  await sleep(200);
  await page.tap('[data-act=king][data-id=jagerbauhm]');
  await sleep(300);
  expect(await ev(page, () => window.app.ui.kingTargeting) === 'jagerbauhm', 'targeting not armed');
  await tapTile(page, 18, 9); // on the road
  expect(await ev(page, () => window.app.world.barricades.length) === 0, 'should only preview');
  await page.tap('#b-confirm');
  expect(await ev(page, () => window.app.world.barricades.length) === 1, 'barricade not placed');
});
await step('doctrine modal answered by tap', async () => {
  await ev(page, () => window.app.world.offerDoctrines());
  await page.waitForSelector('#modal .choice');
  await page.screenshot({ path: join(shots, 'mobile-06-doctrine.png') });
  await page.tap('#modal .choice >> nth=1');
  expect(await ev(page, () => window.app.world.doctrines.length) === 1, 'doctrine not picked');
});
await step('backgrounding the tab pauses the siege', async () => {
  await ev(page, () => { window.app.ui.paused = false; Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await ev(page, () => window.app.ui.paused), 'not paused on hide');
});

// ------------------------------------------------------------ Android portrait
const P = await newPage('Pixel 7');
current = P.page;
await step('Pixel portrait: rotate hint, start, inline panels', async () => {
  const pg = P.page;
  expect(await pg.isVisible('#rotate'), 'rotate hint missing in portrait');
  await pg.screenshot({ path: join(shots, 'mobile-07-portrait-title.png') });
  await pg.tap('#rotate-dismiss');
  await pg.tap('text=Begin the Siege');
  await pg.tap('#go');
  await pg.waitForFunction(() => window.app.world);
  await pg.tap('#tb-keg');
  await tapTile(pg, 25, 8);
  await tapTile(pg, 25, 8);
  expect(await ev(pg, () => window.app.world.towers.length) === 1, 'portrait build failed');
  await tapTile(pg, 25, 8);
  await sleep(300);
  await pg.screenshot({ path: join(shots, 'mobile-08-portrait-panels.png') });
  // portrait: panels sit inline under the map (no drawer), upgrade reachable by tap
  const map = await pg.locator('#stage').boundingBox(), side = await pg.locator('#side').boundingBox();
  expect(side.y >= map.y + map.height - 1, 'panels should sit below the map in portrait');
  await pg.tap('#p-info [data-act=up][data-branch="1"]');
  expect(await ev(pg, () => window.app.world.towerAt(25, 8).branch) === 1, 'portrait upgrade failed');
});

await browser.close();
server.close();
if (errors.length) { console.error('\nConsole errors:\n' + errors.join('\n')); process.exit(1); }
console.log(`\nAll good. Screenshots in ${shots}`);
