// Tower behaviours. Every tower (and the hero) is updated here according to its
// stat block's `kind`. Effective stats (after auras, tonics, abilities, sober)
// are recomputed four times a second into `t.eff` by world.auraTick().
import { W, H } from './map.js';

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- targeting
export function canSee(world, t, e) {
  if (!e.hidden) return true;
  return t.eff.detect || e.revealedT > 0 || world.revealAll > 0;
}

// best target in range by the tower's mode; n > 1 returns up to n targets
export function acquire(world, t, range, n = 1, pos = t) {
  const min2 = (t.s.minRange || 0) ** 2;
  const mode = t.mode;
  const glue = t.s.glue;
  const score = (e) => {
    let s;
    if (mode === 'first') s = e.d - e.path.total;
    else if (mode === 'last') s = e.path.total - e.d;
    else if (mode === 'strong') s = e.hp + e.shield;
    else s = -((e.x - pos.x) ** 2 + (e.y - pos.y) ** 2);
    if (glue && e.slowT > 0.5) s -= 1e7; // sticky ale prefers fresh targets
    return s;
  };
  if (n === 1) {
    let best = null, bestScore = -Infinity;
    world.spatial.query(pos.x, pos.y, range, (e) => {
      if (!e.alive || e.untargetable || !canSee(world, t, e)) return;
      if (min2 && (e.x - pos.x) ** 2 + (e.y - pos.y) ** 2 < min2) return;
      const s = score(e);
      if (s > bestScore) { bestScore = s; best = e; }
    });
    return best;
  }
  const list = [];
  world.spatial.query(pos.x, pos.y, range, (e) => {
    if (e.alive && !e.untargetable && canSee(world, t, e)) list.push(e);
  });
  list.sort((a, b) => score(b) - score(a));
  return list.slice(0, n);
}

// predicted position of e after `time` seconds (lead shots)
const tmp = { x: 0, y: 0 };
function lead(e, time) {
  if (!e.path) return { x: e.x, y: e.y };
  e.path.posAt(e.d + (e.curSpeed || 0) * time, tmp);
  return { x: tmp.x, y: tmp.y };
}

// ---------------------------------------------------------------- firing helpers
function shot(world, t, extra = {}) {
  const e = t.eff;
  return {
    src: t, dtype: t.s.dtype, shred: e.shred, dmg: t.s.dmg * e.dmgMul + e.dmgAdd, pierce: (t.s.pierce || 1) + e.pierceAdd,
    splash: t.s.splash || 0, burn: t.s.burn || 0, burnDur: t.s.burnDur || 0, burnVuln: t.s.burnVuln || 0,
    slow: t.s.slow || 0, slowDur: t.s.slowDur || 0, acid: t.s.acid || 0, stun: t.s.stun || 0,
    knockback: t.s.knockback || 0, distract: t.s.distract || 0, bossMult: t.s.bossMult || 1, homing: !!t.s.homing,
    color: t.def.color, speed: t.s.projSpeed || 500, voodoo: t.s.voodoo || 0, cluster: t.s.cluster || 0, ...extra,
  };
}

export function fireDart(world, t, x, y, ang, extra) {
  const { travel, ...rest } = extra || {};
  const o = shot(world, t, rest);
  world.spawnProjectile({ kind: 'dart', x, y, vx: Math.cos(ang) * o.speed, vy: Math.sin(ang) * o.speed, ...o, maxTravel: travel ?? t.eff.range * 1.25 });
}

function fireShell(world, t, tx, ty, extra) {
  const o = shot(world, t, extra);
  world.spawnProjectile({ kind: 'shell', x: t.x, y: t.y, tx, ty, ...o });
}

// ---------------------------------------------------------------- per-kind behaviour
export function updateTower(world, t, dt) {
  if (t.disabledT > 0) t.disabledT -= dt;
  if (t.turnedT > 0) t.turnedT -= dt;
  if (t.soberT > 0) t.soberT -= dt;
  if (t.plinketBuffT > 0) t.plinketBuffT -= dt;
  for (const k in t.abilityT) if (t.abilityT[k] > 0) t.abilityT[k] -= dt;
  if (t.s.buff) brew(world, t, dt);
  if (t.s.kind === 'orbit') orbitMove(world, t, dt);
  t.cd -= dt;
  if (t.cd > 0 || t.disabledT > 0 || t.turnedT > 0) return;
  const rate = t.eff.rate;
  if (rate <= 0) return;
  const s = t.s, range = t.eff.range;
  let fired = false;

  switch (s.kind) {
    case 'farm': case 'aura': return;
    case 'global': {
      if (!world.enemies.length) return;
      for (const e of world.enemies) {
        if (!e.alive) continue;
        if (s.slow) world.applySlow(e, s.slow, s.slowDur);
        if (s.dmg) world.damage(e, s.dmg * t.eff.dmgMul, t, { dtype: 'magic' });
        if (s.knockback && e.alive) world.knockback(e, s.knockback);
      }
      world.fx({ kind: 'flash', x: t.x, y: t.y, r: 0, max: 0.35, color: t.def.color });
      fired = true;
      break;
    }
    case 'pulse': {
      let hit = false;
      world.spatial.query(t.x, t.y, range, (e) => {
        if (!e.alive || e.untargetable || !canSee(world, t, e)) return;
        hit = true;
        if (s.slow) world.applySlow(e, s.slow, s.slowDur);
        if (s.acid) e.acid = Math.max(e.acid, s.acid);
        if (s.dmg) world.damage(e, s.dmg * t.eff.dmgMul + t.eff.dmgAdd, t, { dtype: s.dtype, shred: t.eff.shred });
        if (s.burn && e.alive) world.applyBurn(e, s.burn, s.burnDur, t);
      });
      if (!hit) return;
      world.fx({ kind: 'ring', x: t.x, y: t.y, r: range, max: 0.35, color: t.def.color });
      fired = true;
      break;
    }
    case 'freeze': {
      let hit = false;
      world.spatial.query(t.x, t.y, range, (e) => {
        if (!e.alive || e.untargetable || !canSee(world, t, e)) return;
        hit = true;
        world.freeze(e, s.freeze, s.frost || 0);
        if (s.dmg) world.damage(e, s.dmg * t.eff.dmgMul, t, { dtype: 'cold' });
      });
      if (!hit) return;
      world.fx({ kind: 'ring', x: t.x, y: t.y, r: range, max: 0.4, color: '#cfeeff' });
      fired = true;
      break;
    }
    case 'beam': {
      const targets = (s.marks || 1) > 1 ? acquire(world, t, range, s.marks) : [acquire(world, t, range)].filter(Boolean);
      if (!targets.length) return;
      for (const e of targets) {
        if (s.mark) world.applyMark(e, s.mark, s.markDur, s.bountyBonus || 0);
        world.damage(e, s.dmg * t.eff.dmgMul + t.eff.dmgAdd, t, { dtype: s.dtype, shred: t.eff.shred, bossMult: s.bossMult });
        if (s.stun && e.alive) world.stun(e, s.stun);
        world.fx({ kind: 'beam', x: t.x, y: t.y, x2: e.x, y2: e.y, max: 0.15, color: t.def.color });
      }
      fired = true;
      break;
    }
    case 'radial': {
      if (!acquire(world, t, range)) return;
      const n = s.count || 8;
      for (let i = 0; i < n; i++) fireDart(world, t, t.x, t.y, (i / n) * TAU, { travel: range + 10 });
      fired = true;
      break;
    }
    case 'mortar': {
      const aim = t.aim || world.defaultAim();
      const r = (s.inaccuracy || 0) * Math.sqrt(world.rng.next());
      const a = world.rng.next() * TAU;
      fireShell(world, t, aim.x + Math.cos(a) * r, aim.y + Math.sin(a) * r, { flare: !!s.flare });
      fired = true;
      break;
    }
    case 'repeater': {
      let aim = t.aim;
      if (!aim) { const e = acquire(world, t, range); if (!e) return; aim = e; }
      const base = Math.atan2(aim.y - t.y, aim.x - t.x);
      if (s.ray) { rayAttack(world, t, base, range); fired = true; break; }
      const rockets = t.abilityT.rockets > 0 ? 3 : 1;
      for (let k = 0; k < rockets; k++) {
        const ang = base + ((world.rng.next() - 0.5) * (s.spread || 0) * Math.PI) / 180;
        fireDart(world, t, t.x, t.y, ang, rockets > 1 ? { dtype: 'explosive', splash: 30, dmg: s.dmg * 4 } : undefined);
      }
      fired = true;
      break;
    }
    case 'spikes': {
      const p = world.roadPointNear(t, range, !!s.smart);
      if (!p) return;
      world.placePile(t, p.x, p.y);
      fired = true;
      break;
    }
    case 'orbit': {
      const e = world.enemies.some((e) => e.alive);
      if (!e) return;
      const n = s.count || 8;
      for (let i = 0; i < n; i++) fireDart(world, t, t.x, t.y, (i / n) * TAU + t.orbitA, { travel: 160 });
      if (s.bombs && (t.bombT = (t.bombT || 0) + 1) % 3 === 0) {
        world.spawnProjectile({ kind: 'shell', x: t.x, y: t.y, tx: t.x, ty: t.y + 4, ...shot(world, t, { dmg: s.bombs, splash: 45, dtype: 'explosive' }) });
      }
      fired = true;
      break;
    }
    case 'proj': default: {
      const target = acquire(world, t, range);
      if (!target) return;
      const o = shot(world, t);
      const dist = Math.hypot(target.x - t.x, target.y - t.y);
      const p = lead(target, dist / o.speed);
      if (s.chain) { chainAttack(world, t, target); fired = true; break; }
      if (s.proj === 'shell') {
        fireShell(world, t, p.x, p.y);
      } else if (s.proj === 'hook') {
        if (t.abilityT.mutiny > 0) { // Mutiny: a ring of 30 hooks
          for (let i = 0; i < 30; i++) {
            const a = (i / 30) * TAU;
            world.spawnProjectile({ kind: 'hook', x: t.x, y: t.y, tx: t.x + Math.cos(a) * range, ty: t.y + Math.sin(a) * range, home: t, leg: 0, ...o });
          }
          t.abilityT.mutiny = 0;
        } else world.spawnProjectile({ kind: 'hook', x: t.x, y: t.y, tx: p.x, ty: p.y, home: t, leg: 0, ...o });
      } else {
        const n = s.count || 1, spread = ((s.spread || 0) * Math.PI) / 180;
        const base = Math.atan2(p.y - t.y, p.x - t.x);
        for (let i = 0; i < n; i++) {
          const ang = base + (n > 1 ? (i / (n - 1) - 0.5) * spread : 0);
          fireDart(world, t, t.x, t.y, ang, { target: o.homing ? target : null });
        }
        if (s.cannon) fireShell(world, t, p.x, p.y, { dmg: s.cannon * t.eff.dmgMul, splash: 32, dtype: 'explosive', speed: 420 });
        if (s.grape) for (let i = 0; i < s.grape; i++) fireDart(world, t, t.x, t.y, base + (world.rng.next() - 0.5) * 0.7, { dmg: 4, pierce: 1 });
        if (s.flash && (t.shots = (t.shots || 0) + 1) % s.flash === 0) {
          world.spatial.query(target.x, target.y, 50, (e) => { if (e.alive) world.stun(e, 1); });
          world.fx({ kind: 'flash', x: target.x, y: target.y, r: 0, max: 0.15, color: '#ffffff' });
        }
      }
      fired = true;
    }
  }
  if (fired) t.cd = 1 / rate;
}

// the Hookman's ricochet: jumps between enemies instantly
function chainAttack(world, t, first) {
  const o = shot(world, t);
  let cur = first;
  const hit = new Set();
  let px = t.x, py = t.y;
  for (let i = 0; i < t.s.chain && cur; i++) {
    hit.add(cur.uid);
    world.fx({ kind: 'beam', x: px, y: py, x2: cur.x, y2: cur.y, max: 0.18, color: t.def.color });
    px = cur.x; py = cur.y;
    world.damage(cur, o.dmg, t, { dtype: o.dtype, shred: o.shred });
    if (o.burn && cur.alive) world.applyBurn(cur, o.burn, o.burnDur, t);
    let next = null, best = 130 * 130;
    world.spatial.query(px, py, 130, (e) => {
      if (!e.alive || e.untargetable || hit.has(e.uid) || !canSee(world, t, e)) return;
      const d = (e.x - px) ** 2 + (e.y - py) ** 2;
      if (d < best) { best = d; next = e; }
    });
    cur = next;
  }
}

// Orchenk death ray: hits everything along a line
function rayAttack(world, t, ang, range) {
  const o = shot(world, t);
  const ex = t.x + Math.cos(ang) * range, ey = t.y + Math.sin(ang) * range;
  let n = 0;
  for (const e of world.enemies) {
    if (!e.alive || e.untargetable || !canSee(world, t, e)) continue;
    const dx = ex - t.x, dy = ey - t.y, len2 = dx * dx + dy * dy;
    const k = Math.max(0, Math.min(1, ((e.x - t.x) * dx + (e.y - t.y) * dy) / len2));
    if ((t.x + dx * k - e.x) ** 2 + (t.y + dy * k - e.y) ** 2 < 16 * 16) {
      world.damage(e, o.dmg, t, { dtype: o.dtype, shred: o.shred });
      if (++n >= o.pierce) break;
    }
  }
  world.fx({ kind: 'beam', x: t.x, y: t.y, x2: ex, y2: ey, max: 0.1, color: '#ff5050' });
}

// Brewers Lane Still: tonic buffs for nearby towers
function brew(world, t, dt) {
  t.brewT = (t.brewT ?? t.s.buff.every) - dt;
  if (t.brewT > 0 || t.disabledT > 0) return;
  const b = t.s.buff;
  t.brewT = b.every;
  const cands = world.towers.filter((o) => o !== t && !o.hero && o.s.kind !== 'farm' && o.s.kind !== 'aura' &&
    (o.x - t.x) ** 2 + (o.y - t.y) ** 2 <= b.range * b.range && !(o.tonicT > 0));
  cands.sort((a, c) => (c.dmg - a.dmg));
  for (const o of cands.slice(0, b.count)) {
    o.tonic = { dmg: b.dmg, rangeMul: b.rangeMul || 0, shred: !!b.shred };
    o.tonicT = b.dur;
    world.fx({ kind: 'ring', x: o.x, y: o.y, r: 22, max: 0.5, color: '#ff9b3d' });
  }
}

// Cloudrunner: flies an ellipse around the map
function orbitMove(world, t, dt) {
  t.orbitA = ((t.orbitA || 0) + dt * 0.45) % TAU;
  t.x = W / 2 + Math.cos(t.orbitA) * (W * 0.36);
  t.y = H / 2 + Math.sin(t.orbitA) * (H * 0.34);
}

// ---------------------------------------------------------------- effective stats
// Called from the world's aura tick. Collects every buff source into t.eff.
export function computeEffective(world, t) {
  const s = t.s, eff = t.eff || (t.eff = {});
  const sober = t.soberT > 0;
  let rangeMul = 1 + world.mods.rangeMult, rate = 1, dmgMul = 1 + (world.mods.typeDmg[t.type] || 0), dmgAdd = 0, pierceAdd = 0;
  let shred = !!s.shred, detect = !!s.detect;
  if (!sober) {
    for (const a of t.auras) {
      rangeMul += a.rangeMul || 0; rate += a.rate || 0; pierceAdd += a.pierce || 0; dmgAdd += a.dmgAdd || 0;
      if (a.shred) shred = true;
      if (a.detect) detect = true;
    }
    if (t.tonicT > 0) { dmgMul += t.tonic.dmg; rangeMul += t.tonic.rangeMul; if (t.tonic.shred) shred = true; }
    if (world.timers.chug > 0) rate += 0.8;
    if (world.timers.muster > 0) rate *= 2;
    if (world.timers.longarm > 0 && t.type === 'pike') rate *= 3;
    if (world.timers.kegparty > 0 && (t.type === 'keg' || t.type === 'mortar')) rate *= 2;
    if (t.plinketBuffT > 0) dmgMul += 0.25;
  }
  if (world.timers.hangover > 0) rate *= 0.6;
  if (sober && t.def.ale) rate *= 0.5;
  if (t.tonicT > 0) t.tonicT -= 0.25;
  if (world.mods.detectMult < 1 && !t.hero) { /* Sheriff on Holiday: detection radius handled by reveal range */ }
  eff.range = (s.range || 0) * rangeMul;
  eff.rate = (s.rate || 0) * rate;
  eff.dmgMul = dmgMul;
  eff.dmgAdd = dmgAdd;
  eff.pierceAdd = pierceAdd;
  eff.shred = shred;
  eff.detect = detect;
}
