// Liquor King heroes: one per run, placed like a tower, levels 1–10 during the run.
// Stats scale with level; ability 1 unlocks at level 3, ability 2 at level 7.
export const HERO_COST = 250;
export const HERO_XP = [0, 150, 400, 800, 1400, 2300, 3500, 5000, 7000, 9500]; // XP to reach level i+1

export const HEROES = {
  seamus: {
    name: 'Seamus Bonehardy', title: 'King of Kegs', sprite: 'viking', color: '#c9a45c',
    desc: 'Throws exploding kegs. Explosive splash damage.',
    base: { kind: 'proj', proj: 'shell', dtype: 'explosive', range: 125, dmg: 14, rate: 0.9, splash: 38, projSpeed: 340 },
    abilities: [
      { id: 'avalanche', name: 'Barrel Avalanche', level: 3, cd: 45, desc: '220 damage to every enemy and knocks them back (Bosses take damage only).' },
      { id: 'kegparty', name: 'Keg Party', level: 7, cd: 60, desc: 'All Keg Catapults and Mortars fire twice as fast for 10s.' },
    ],
  },
  buke: {
    name: 'Buke', title: 'No Middle, No Last Name', sprite: 'youth', color: '#e0b93c',
    desc: 'Brawler. Punches everything around him.',
    base: { kind: 'pulse', dtype: 'sharp', shred: true, range: 62, dmg: 16, rate: 1.6 },
    abilities: [
      { id: 'chug', name: 'Chug!', level: 3, cd: 40, desc: 'All towers attack 80% faster for 8s, then 40% slower for 6s while hungover.' },
      { id: 'dive', name: 'Barrel Dive', level: 7, cd: 50, desc: 'Stuns every enemy within 150px for 3s and deals 400 damage.' },
    ],
  },
  jagerbauhm: {
    name: 'Jagerbauhm', title: 'Drunken Angel', sprite: 'wizard', color: '#9fd8ff',
    desc: 'Support. Towers within his radius get +15% range. Light magic bolts.',
    base: { kind: 'proj', proj: 'dart', dtype: 'magic', range: 115, dmg: 7, rate: 1.3, pierce: 2, projSpeed: 520, aura: { rangeMul: 0.15 }, auraRange: 140 },
    abilities: [
      { id: 'barricade', name: "Angel's Barricade", level: 3, cd: 40, targeted: true, desc: 'Place a barricade on the road that halts every non-Boss enemy for 5s.' },
      { id: 'hallowed', name: 'Hallowed Ground', level: 7, cd: 55, desc: 'Enemies within 160px of him take double damage for 8s.' },
    ],
  },
  guinnie: {
    name: "Steph 'Guinnie' O'Guinness", title: 'Never Forgets a Face', sprite: 'knightVisor', color: '#8fa3b8',
    desc: 'Marksman. Long range, Shred, sees Hidden.',
    base: { kind: 'beam', dtype: 'sharp', shred: true, detect: true, range: 230, dmg: 28, rate: 0.7 },
    abilities: [
      { id: 'grudge', name: 'Old Grudge', level: 3, cd: 30, desc: 'Executes the toughest non-Boss enemy. Against a Boss: 6% of its max health.' },
      { id: 'faces', name: 'Never Forgets a Face', level: 7, cd: 50, desc: 'Every enemy is revealed and takes +30% damage for 10s.' },
    ],
  },
  jack: {
    name: 'Jack Anqoak', title: 'Oracle of Aleforge', sprite: 'hooded', color: '#6fd96f',
    desc: 'Merchant. Kills near him pay +20% gold. Weak magic attack.',
    base: { kind: 'proj', proj: 'dart', dtype: 'magic', range: 110, dmg: 8, rate: 1, pierce: 1, projSpeed: 480, bountyAura: 0.2, auraRange: 150 },
    abilities: [
      { id: 'ledger', name: 'Read the Ledger', level: 3, cd: 50, desc: '+150 gold, and every enemy is marked (+25% damage taken) for 6s.' },
      { id: 'mercantile', name: 'Aggressive Mercantilism', level: 7, cd: 90, desc: '+500 gold.' },
    ],
  },
  jp: {
    name: 'Jameson Pilsner', title: 'Born of the Spill', sprite: 'ranger', color: '#c98a5c',
    desc: 'Archer. Quick arrows that pierce 2.',
    base: { kind: 'proj', proj: 'dart', dtype: 'sharp', range: 120, dmg: 9, rate: 1.4, pierce: 2, projSpeed: 600 },
    abilities: [
      { id: 'spill', name: 'Whiskey & Beer', level: 3, cd: 90, desc: '+2 Resolve.' },
      { id: 'flood', name: 'The Great Spill', level: 7, cd: 55, desc: 'Floods the road: every enemy slowed 70% and takes 30 damage/s for 8s.' },
    ],
  },
};
export const HERO_ORDER = ['seamus', 'buke', 'jagerbauhm', 'guinnie', 'jack', 'jp'];

// per-level scaling
export const heroScale = (lv) => ({ dmg: 1 + 0.15 * (lv - 1), rate: 1 + 0.05 * (lv - 1), range: 3 * (lv - 1) });
