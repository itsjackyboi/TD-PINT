// Retro sound effects (Kenney CC0, converted to WAV). WebAudio with per-sound
// rate limiting and a voice cap so a 300-enemy wave doesn't become noise.
// Triggered only from the UI by watching world state; the simulation is untouched.
const NAMES = ['build', 'upgrade', 'sell', 'bond', 'shot-bow', 'shot-pike', 'shot-keg', 'shot-tap', 'shot-still', 'shot-light',
  'shot-clock', 'death1', 'death2', 'explosion', 'leak', 'king', 'coin', 'boss', 'click', 'error', 'doctrine', 'wave', 'defeat', 'victory'];
const VOL = { 'shot-pike': 0.25, 'shot-bow': 0.35, 'shot-keg': 0.5, 'shot-tap': 0.25, 'shot-still': 0.3, 'shot-light': 0.2, 'shot-clock': 0.5,
  death1: 0.35, death2: 0.35, click: 0.4, wave: 0.6, defeat: 0.7, victory: 0.7, leak: 0.8, explosion: 0.6 };
const GAP = { 'shot-pike': 0.09, 'shot-bow': 0.09, 'shot-tap': 0.2, 'shot-still': 0.15, 'shot-light': 0.25, death1: 0.06, death2: 0.06, leak: 0.12, explosion: 0.1 };
const MAX_VOICES = 14;
const KEY = 'aleforge.muted';

class Sfx {
  constructor() {
    this.ctx = null;
    this.buf = {};
    this.last = {};
    this.voices = 0;
    try { this.muted = localStorage.getItem(KEY) === '1'; } catch { this.muted = false; }
  }

  // Browsers (iOS especially) only allow audio after a user gesture.
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = this.muted ? 0 : 0.7;
    this.gain.connect(this.ctx.destination);
    for (const n of NAMES) {
      fetch(new URL(`../../assets/audio/${n}.wav`, import.meta.url))
        .then((r) => r.arrayBuffer())
        .then((a) => new Promise((res, rej) => this.ctx.decodeAudioData(a, res, rej)))
        .then((b) => { this.buf[n] = b; })
        .catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(KEY, m ? '1' : '0'); } catch { /* ignore */ }
    if (this.gain) this.gain.gain.value = m ? 0 : 0.7;
  }

  play(name, jitter = 0.08) {
    if (this.muted || !this.ctx || !this.buf[name] || this.voices >= MAX_VOICES) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[name] || -1) < (GAP[name] || 0.03)) return;
    this.last[name] = now;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buf[name];
    src.playbackRate.value = 1 + (Math.random() * 2 - 1) * jitter;
    const g = this.ctx.createGain();
    g.gain.value = VOL[name] ?? 0.6;
    src.connect(g).connect(this.gain);
    this.voices++;
    src.onended = () => { this.voices--; };
    src.start();
  }
}

export const sfx = new Sfx();

// Watches a world each frame and plays sounds for what changed.
export class SfxWatcher {
  constructor() { this.reset(null); }

  reset(world) {
    this.world = world;
    this.kills = world ? world.stats.kills : 0;
    this.leaks = world ? world.stats.leaks : 0;
    this.cd = new WeakMap();
    this.seenFx = new WeakSet();
  }

  tick(world) {
    if (world !== this.world) this.reset(world);
    if (!world || sfx.muted) return;
    if (world.stats.kills > this.kills) sfx.play(Math.random() < 0.5 ? 'death1' : 'death2', 0.15);
    if (world.stats.leaks > this.leaks) sfx.play('leak');
    this.kills = world.stats.kills;
    this.leaks = world.stats.leaks;
    // a tower fired when its cooldown jumped back up
    for (const t of world.towers) {
      const prev = this.cd.get(t);
      if (prev !== undefined && t.cd > prev + 0.02) sfx.play('shot-' + t.type);
      this.cd.set(t, t.cd);
    }
    for (const f of world.effects) {
      if (this.seenFx.has(f)) continue;
      this.seenFx.add(f);
      if (f.kind === 'ring' && f.color === '#ff9b3d' && f.r >= 60) sfx.play('explosion');
    }
  }
}
