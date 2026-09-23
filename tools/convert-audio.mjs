#!/usr/bin/env node
// Converts assets/audio-src/*.ogg to 16-bit mono 22.05 kHz WAV in assets/audio/
// using headless Chromium's decoder (older iOS Safari can't decode Ogg Vorbis;
// WAV plays everywhere). Run after tools/fetch-assets.mjs.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const src = join(root, 'assets/audio-src'), out = join(root, 'assets/audio');
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f of (await readdir(src)).filter((f) => f.endsWith('.ogg'))) {
  const b64 = (await readFile(join(src, f))).toString('base64');
  const wav = await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const decoded = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(bytes.buffer);
    const rate = 22050, len = Math.ceil(decoded.duration * rate);
    const ctx = new OfflineAudioContext(1, len, rate);
    const node = ctx.createBufferSource();
    node.buffer = decoded; node.connect(ctx.destination); node.start();
    const pcm = (await ctx.startRendering()).getChannelData(0);
    const buf = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const str = (o, s) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); buf.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true);
    buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true);
    str(36, 'data'); buf.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i++) buf.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i])) * 0x7fff, true);
    let s = ''; const u8 = new Uint8Array(buf.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, b64);
  const name = f.replace('.ogg', '.wav');
  await writeFile(join(out, name), Buffer.from(wav, 'base64'));
  console.log(`assets/audio/${name}`);
}
await browser.close();
