#!/usr/bin/env node
// Downloads the CC0 art, font and sound files the game uses from the public
// series-ai/jam-ready-assets mirror of Kenney's packs (Git LFS files are served
// by media.githubusercontent.com, so git-lfs isn't needed), plus each pack's
// License.txt. Re-run to refresh; results are committed under assets/.
//   node tools/fetch-assets.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIRROR = 'https://media.githubusercontent.com/media/series-ai/jam-ready-assets/main/';

// [source path in mirror, destination under assets/]
const FILES = [
  ['kenney-tiny-town/2D/top-down-rpg/Tilemap/tilemap_packed.png', 'sprites/tiny-town.png'],
  ['kenney-tiny-dungeon/2D/dungeon/Tilemap/tilemap_packed.png', 'sprites/tiny-dungeon.png'],
  ['kenney-tiny-battle/2D/top-down-rpg/Tilemap/tilemap_packed.png', 'sprites/tiny-battle.png'],
  ['kenney-ui-pack-pixel-adventure/ui/Tilesheets/Small tiles/Thick outline/tilemap_packed.png', 'ui/ui-pixel-adventure.png'],
  ['kenney-ui-pack-pixel-adventure/ui/Tilesheets/Small tiles/Tilesheet.txt', 'ui/ui-pixel-adventure.txt'],
  ['kenney-fonts/fonts/Kenney Pixel.ttf', 'fonts/kenney-pixel.ttf'],
  ['kenney-fonts/fonts/Kenney Mini.ttf', 'fonts/kenney-mini.ttf'],
  // sound effects (converted to .wav by tools/convert-audio.mjs)
  ['kenney-impact-sounds/audio/Audio/impactWood_medium_000.ogg', 'audio-src/build.ogg'],
  ['kenney-retro-sounds-2/audio/Audio/upgrade1.ogg', 'audio-src/upgrade.ogg'],
  ['kenney-rpg-audio/audio/Audio/handleCoins.ogg', 'audio-src/sell.ogg'],
  ['kenney-rpg-audio/audio/Audio/handleCoins2.ogg', 'audio-src/bond.ogg'],
  ['kenney-rpg-audio/audio/Audio/drawKnife2.ogg', 'audio-src/shot-bow.ogg'],
  ['kenney-impact-sounds/audio/Audio/impactWood_light_000.ogg', 'audio-src/shot-pike.ogg'],
  ['kenney-impact-sounds/audio/Audio/impactWood_heavy_000.ogg', 'audio-src/shot-keg.ogg'],
  ['kenney-interface-sounds/audio/Audio/glass_002.ogg', 'audio-src/shot-tap.ogg'],
  ['kenney-rpg-audio/audio/Audio/metalPot1.ogg', 'audio-src/shot-still.ogg'],
  ['kenney-rpg-audio/audio/Audio/metalClick.ogg', 'audio-src/shot-light.ogg'],
  ['kenney-impact-sounds/audio/Audio/impactBell_heavy_000.ogg', 'audio-src/shot-clock.ogg'],
  ['kenney-retro-sounds-2/audio/Audio/hurt1.ogg', 'audio-src/death1.ogg'],
  ['kenney-retro-sounds-2/audio/Audio/hurt3.ogg', 'audio-src/death2.ogg'],
  ['kenney-retro-sounds-2/audio/Audio/explosion1.ogg', 'audio-src/explosion.ogg'],
  ['kenney-impact-sounds/audio/Audio/impactPunch_heavy_000.ogg', 'audio-src/leak.ogg'],
  ['kenney-retro-sounds-2/audio/Audio/secret2.ogg', 'audio-src/king.ogg'],
  ['kenney-retro-sounds-2/audio/Audio/coin2.ogg', 'audio-src/coin.ogg'],
  ['kenney-retro-sounds-1/audio/Audio/rumble1.ogg', 'audio-src/boss.ogg'],
  ['kenney-interface-sounds/audio/Audio/click_001.ogg', 'audio-src/click.ogg'],
  ['kenney-interface-sounds/audio/Audio/error_004.ogg', 'audio-src/error.ogg'],
  ['kenney-interface-sounds/audio/Audio/confirmation_002.ogg', 'audio-src/doctrine.ogg'],
  ['kenney-music-jingles/audio/Audio (Retro)/jingles-retro_02.ogg', 'audio-src/wave.ogg'],
  ['kenney-music-jingles/audio/Audio (Retro)/jingles-retro_04.ogg', 'audio-src/defeat.ogg'],
  ['kenney-music-jingles/audio/Audio (Retro)/jingles-retro_00.ogg', 'audio-src/victory.ogg'],
];
const PACKS = ['kenney-tiny-town/2D/top-down-rpg', 'kenney-tiny-dungeon/2D/dungeon', 'kenney-tiny-battle/2D/top-down-rpg',
  'kenney-ui-pack-pixel-adventure/ui', 'kenney-fonts/fonts', 'kenney-impact-sounds/audio', 'kenney-retro-sounds-1/audio',
  'kenney-retro-sounds-2/audio', 'kenney-rpg-audio/audio', 'kenney-interface-sounds/audio', 'kenney-music-jingles/audio'];

const url = (p) => MIRROR + p.split('/').map(encodeURIComponent).join('/');
async function get(src, dest) {
  // LFS-tracked binaries come from media.githubusercontent.com; plain text files from raw
  let res = await fetch(url(src));
  if (res.status === 404) res = await fetch(url(src).replace(MIRROR, 'https://raw.githubusercontent.com/series-ai/jam-ready-assets/main/'));
  if (!res.ok) throw new Error(`${res.status} ${src}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.slice(0, 40).toString().startsWith('version https://git-lfs')) throw new Error(`LFS pointer, not content: ${src}`);
  const out = join(root, 'assets', dest);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buf);
  console.log(`${String(buf.length).padStart(7)}  assets/${dest}`);
}
for (const [src, dest] of FILES) await get(src, dest);
for (const p of PACKS) {
  const res = await fetch('https://raw.githubusercontent.com/series-ai/jam-ready-assets/main/' + p.split('/').map(encodeURIComponent).join('/') + '/License.txt');
  const text = res.ok ? await res.text() : `License.txt unavailable (${res.status}); pack is listed as CC0 in the mirror.`;
  await mkdir(join(root, 'assets/licenses'), { recursive: true });
  await writeFile(join(root, 'assets/licenses', p.split('/')[0] + '.txt'), text);
}
console.log('licences written to assets/licenses/');
