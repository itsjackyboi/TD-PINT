#!/usr/bin/env node
// Cuts single 16×16 tiles out of the Kenney sheets into standalone PNGs for CSS
// (9-slice border-image frames and HUD icons). Run after tools/fetch-assets.mjs.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const SHEETS = { ui: ['assets/ui/ui-pixel-adventure.png', 23], town: ['assets/sprites/tiny-town.png', 12], battle: ['assets/sprites/tiny-battle.png', 18], dungeon: ['assets/sprites/tiny-dungeon.png', 12] };
const CUTS = {
  'ui/frame-parchment.png': ['ui', 10], 'ui/frame-wood.png': ['ui', 11], 'ui/frame-steel.png': ['ui', 12],
  'ui/button.png': ['ui', 49], 'ui/button-red.png': ['ui', 3], 'ui/button-steel.png': ['ui', 26],
  'ui/icon-gold.png': ['town', 93], 'ui/icon-ale.png': ['town', 130], 'ui/icon-resolve.png': ['battle', 195],
  'ui/icon-wave.png': ['battle', 70], 'ui/icon-lock.png': ['battle', 193], 'ui/icon-scroll.png': ['town', 83],
};
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [out, [sheet, idx]] of Object.entries(CUTS)) {
  const [file, cols] = SHEETS[sheet];
  const b64 = (await readFile(join(root, file))).toString('base64');
  const png = await page.evaluate(async ([b64, idx, cols]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    c.getContext('2d').drawImage(im, (idx % cols) * 16, Math.floor(idx / cols) * 16, 16, 16, 0, 0, 16, 16);
    return c.toDataURL().split(',')[1];
  }, [b64, idx, cols]);
  await writeFile(join(root, 'assets', out), Buffer.from(png, 'base64'));
  console.log('assets/' + out);
}
await browser.close();
