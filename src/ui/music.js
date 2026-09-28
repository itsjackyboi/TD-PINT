// Chiptune music, synthesized live with WebAudio (no audio files): two pulse
// channels, a triangle bass and noise drums, like an NES. A look-ahead
// scheduler keeps timing tight. Shares the AudioContext created by sfx.unlock().
import { sfx } from './audio.js';

const KEY = 'aleforge.music';
const LEVEL = 0.12; // master music level: light, under the sound effects

// ------------------------------------------------------------------ notation
// Tracks are space-separated steps: a note ("E5", "F#4"), "-" holds the
// previous note, "." is a rest. "|" is a bar line (ignored). Drums: k s h.
const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function noteFreq(n) {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) throw new Error(`bad note ${n}`);
  const midi = (Number(m[2]) + 1) * 12 + SEMI[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}
const steps = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/);

// notes → per-step {f, len} (len in steps, counting held "-") or null
function compile(tokens, len) {
  const out = new Array(len).fill(null);
  for (let i = 0; i < len; i++) {
    const tk = tokens[i % tokens.length];
    if (tk === '-' || tk === '.') continue;
    let l = 1;
    while (tokens[(i + l) % tokens.length] === '-' && l < len) l++;
    out[i] = { f: noteFreq(tk), len: l };
  }
  return out;
}

// a bar of bass (root/fifth bounce) and harmony (chord stabs) per chord name
const CHORDS = {
  G: ['G2', 'D3', ['B4', 'D5']], D: ['D2', 'A2', ['A4', 'F#4']], C: ['C3', 'G2', ['E4', 'G4']], Em: ['E2', 'B2', ['G4', 'B4']],
  Am: ['A2', 'E3', ['C5', 'E4']], F: ['F2', 'C3', ['A4', 'C5']], Dm: ['D3', 'A2', ['F4', 'A4']], E: ['E2', 'B2', ['G#4', 'B4']], Gm: ['G2', 'D3', ['A#4', 'D5']],
};
function bassBar(ch, style) {
  const [r, f] = CHORDS[ch];
  return style === 'march' ? `${r} . ${r} . ${f} . ${r} ${f}` : `${r} . ${f} . ${r} . ${f} .`;
}
function harmBar(ch) { const [, , [a, b]] = CHORDS[ch]; return `. . ${a} . . . ${b} .`; }

function song({ bpm, lead, chords, style, drums }) {
  const L = steps(lead);
  const len = L.length;
  return {
    bpm, div: 2, len,
    lead: compile(L, len),
    bass: compile(steps(chords.map((c) => bassBar(c, style)).join(' ')), len),
    harm: compile(steps(chords.map((c) => harmBar(c)).join(' ')), len),
    drums: steps(drums),
  };
}

// ------------------------------------------------------------------ the tunes (original)
// Title: a jaunty tavern jig in G major.
const TITLE = song({
  bpm: 124, style: 'jig',
  lead: `G4 B4 D5 B4 G4 B4 D5 G5 | F#5 D5 A4 D5 F#5 E5 D5 C5 | B4 D5 G5 D5 B4 G4 A4 B4 | C5 E5 A5 G5 F#5 D5 E5 F#5 |
         G5 - D5 - B4 - G4 B4 | C5 - A4 - F#4 A4 D5 C5 | B4 D5 G5 F#5 E5 C5 A4 F#4 | G4 - D5 - G4 - . . |
         E5 - G5 E5 D5 - B4 D5 | C5 E5 G5 E5 D5 C5 B4 A4 | B4 - D5 B4 G4 - B4 D5 | A4 C5 E5 D5 C5 B4 A4 F#4 |
         G4 B4 D5 G5 B5 - A5 G5 | F#5 A5 G5 F#5 E5 D5 C5 B4 | C5 E5 D5 C5 B4 G4 A4 F#4 | G4 - B4 D5 G5 - . . |`,
  chords: ['G', 'D', 'G', 'C', 'G', 'D', 'C', 'G', 'Em', 'C', 'G', 'D', 'G', 'D', 'C', 'G'],
  drums: 'k . h . s . h . k . h k s . h .',
});

// Battle: an upbeat march in A minor.
const BATTLE_LEAD = `A4 A4 C5 E5 A5 - G5 E5 | F5 - E5 D5 C5 - D5 E5 | A4 A4 C5 E5 A5 - B5 C6 | B5 - G5 E5 G5 - - - |
         F5 F5 A5 F5 E5 E5 G5 E5 | D5 D5 F5 D5 C5 B4 C5 D5 | E5 - C5 A4 B4 - G#4 B4 | A4 - - - E5 - A5 - |`;
const BATTLE_CHORDS = ['Am', 'F', 'Am', 'G', 'F', 'Dm', 'E', 'Am'];
const BATTLE = song({ bpm: 140, style: 'march', lead: BATTLE_LEAD, chords: BATTLE_CHORDS, drums: 'k . h k s . h . k . h k s . s s' });
const BOSS = song({ bpm: 164, style: 'march', lead: BATTLE_LEAD, chords: BATTLE_CHORDS, drums: 'k h k h s h k h k h k h s s s s' });

export const SONGS = { title: TITLE, battle: BATTLE, boss: BOSS };

// short one-shots: [note, 16ths] pairs
const STINGS = {
  unlock: { bpm: 150, notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['E6', 4]] },
  victory: { bpm: 130, notes: [['G4', 2], ['C5', 2], ['E5', 2], ['G5', 2], ['E5', 1], ['G5', 1], ['C6', 8]] },
  defeat: { bpm: 90, notes: [['E4', 3], ['D#4', 3], ['D4', 3], ['C#4', 8]] },
};

// ------------------------------------------------------------------ player
class Music {
  constructor() {
    try { this.muted = localStorage.getItem(KEY) === '0'; } catch { this.muted = false; }
    this.current = null; // song the game wants
    this.playing = null; // song actually running
    this.duck = 1;
    this.timer = null;
  }

  // lazily build the graph on the shared context (exists after a user gesture)
  ready() {
    const ctx = sfx.ctx;
    if (!ctx) return false;
    if (!this.out) this.init(ctx);
    return true;
  }

  init(ctx) {
    {
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = this.level();
      this.out.connect(ctx.destination);
      // 25% duty pulse, the classic NES lead
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) re[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
      this.pulse = ctx.createPeriodicWave(re, im);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
    }
  }

  level() { return this.muted ? 0 : LEVEL * this.duck; }
  applyLevel() { if (this.out) this.out.gain.setTargetAtTime(this.level(), this.ctx.currentTime, 0.08); }

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem(KEY, m ? '0' : '1'); } catch { /* ignore */ }
    this.applyLevel();
  }

  setDuck(on) { const d = on ? 0.4 : 1; if (d !== this.duck) { this.duck = d; this.applyLevel(); } }

  play(name) {
    this.current = name;
    this.resume();
  }

  // (re)start the wanted song once audio is available
  resume() {
    if (!this.current || this.playing === this.current || !this.ready()) return;
    const ctx = this.ctx;
    if (this.bus) { const old = this.bus; old.gain.setTargetAtTime(0, ctx.currentTime, 0.15); setTimeout(() => old.disconnect(), 800); }
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.gain.setTargetAtTime(1, ctx.currentTime, 0.15);
    this.bus.connect(this.out);
    this.song = SONGS[this.current];
    this.playing = this.current;
    this.step = 0;
    this.nextT = ctx.currentTime + 0.06;
    if (!this.timer) this.timer = setInterval(() => this.pump(), 25);
  }

  stop() {
    this.current = this.playing = null;
    if (this.bus && this.ctx) { const old = this.bus; old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); setTimeout(() => old.disconnect(), 600); this.bus = null; }
    clearInterval(this.timer);
    this.timer = null;
  }

  pump() {
    if (!this.song || !this.ctx) return;
    const ctx = this.ctx;
    if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.02; // tab was asleep
    const dt = 60 / this.song.bpm / this.song.div;
    while (this.nextT < ctx.currentTime + 0.12) {
      this.playStep(this.song, this.step, this.nextT, dt, this.bus);
      this.nextT += dt;
      this.step = (this.step + 1) % this.song.len;
    }
  }

  playStep(s, i, t, dt, bus) {
    const lead = s.lead[i], bass = s.bass[i], harm = s.harm[i];
    if (lead) this.tone(this.pulse, lead.f, t, lead.len * dt * 0.92, 0.5, bus);
    if (harm) this.tone('square', harm.f, t, dt * 0.8, 0.14, bus);
    if (bass) this.tone('triangle', bass.f, t, bass.len * dt * 0.85, 0.75, bus);
    const d = s.drums[i % s.drums.length];
    if (d !== '.') this.drum(d, t, bus);
  }

  tone(type, f, t, dur, vol, dest) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    if (typeof type === 'string') o.type = type; else o.setPeriodicWave(type);
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0, t + Math.max(0.02, dur), 0.02);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.15);
  }

  drum(kind, t, dest) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.connect(dest);
    if (kind === 'k') {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g); o.start(t); o.stop(t + 0.18);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = kind === 's' ? 1200 : 7000;
    const len = kind === 's' ? 0.13 : 0.035;
    g.gain.setValueAtTime(kind === 's' ? 0.35 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(f).connect(g);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.02);
  }

  // one-shot jingle over a briefly ducked song
  sting(name) {
    const st = STINGS[name];
    if (!st || !this.ready()) return;
    const ctx = this.ctx;
    const dt = 60 / st.bpm / 4;
    const bus = ctx.createGain();
    bus.gain.value = 1.3;
    bus.connect(this.out);
    let t = ctx.currentTime + 0.03;
    for (const [n, l] of st.notes) {
      this.tone(this.pulse, noteFreq(n), t, l * dt * 0.95, 0.55, bus);
      this.tone('triangle', noteFreq(n) / 2, t, l * dt * 0.9, 0.5, bus);
      t += l * dt;
    }
    const total = t - ctx.currentTime;
    if (this.bus) {
      this.bus.gain.setTargetAtTime(0.25, ctx.currentTime, 0.03);
      this.bus.gain.setTargetAtTime(1, ctx.currentTime + total, 0.2);
    }
    setTimeout(() => bus.disconnect(), (total + 1) * 1000);
  }
}

export const music = new Music();

// Render a few seconds of a song offline and return its RMS level (tests use
// this to check every song actually makes sound).
export async function renderSong(name, secs = 3) {
  const rate = 22050;
  const ctx = new OfflineAudioContext(1, rate * secs, rate);
  const m = new Music();
  m.muted = false;
  m.init(ctx);
  const s = SONGS[name], dt = 60 / s.bpm / s.div;
  for (let t = 0.02, i = 0; t < secs - 0.2; t += dt, i++) m.playStep(s, i % s.len, t, dt, m.out);
  const d = (await ctx.startRendering()).getChannelData(0);
  let sum = 0;
  for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  return Math.sqrt(sum / d.length);
}
