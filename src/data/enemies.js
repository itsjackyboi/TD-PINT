// MAMA's forces. HP is wave-1 HP; waves apply hpMult(wave) and trait modifiers.
// Every mechanic an enemy has is expressed as a trait so the UI can explain it.

// Trait glossary shown to players (icon letter + colour used on the map).
export const TRAITS = {
  hidden: { name: 'Hidden', icon: 'H', color: '#9fe0a0', text: "Invisible to towers without detection. Counter: detection (Pikeman path 1 tier 2, Crossbowman path 2 tier 1, Veilwalker Scout, Lighthouse, Garrison)." },
  armored: { name: 'Armored', icon: 'A', color: '#b8c4d0', text: 'Sharp attacks (spears, bolts, bottles, hooks) do nothing. Counter: explosive, fire, cold or magic damage, or upgrades that grant Shred.' },
  shielded: { name: 'Shielded', icon: 'S', color: '#6fb6ff', text: 'A blue shield soaks up damage before health. Shields are replenished by Picket Lines.' },
  regrow: { name: 'Regrow', icon: 'R', color: '#ff9fd0', text: 'Heals back to full if left alone for 1.5 seconds. Keep hitting it, or burn it: fire (Still, Grog Ring, burning shells) stops the healing.' },
  fortified: { name: 'Fortified', icon: 'F', color: '#e0b060', text: 'Double health.' },
  fast: { name: 'Fast', icon: '»', color: '#ffe08a', text: 'Moves much faster than normal. Slows and freezes are the answer.' },
  splits: { name: 'Splits', icon: 'x', color: '#c9a0ff', text: 'Breaks into smaller enemies when killed. Kill it early, where the pieces still have far to walk.' },
  elite: { name: 'Elite', icon: '★', color: '#ffd35a', text: 'Tougher than normal and costs more Resolve if it gets through.' },
  boss: { name: 'Boss', icon: 'B', color: '#ff5fb0', text: "Huge health. Can't be frozen, stunned or knocked back, and slows are halved. Costs all your Resolve if it reaches the keep." },
  sobering: { name: 'Sobering', icon: 'z', color: '#9fd8ff', text: 'Towers near it lose all buffs, and ale towers (Taproom, Still) fire at half speed.' },
  shieldbearer: { name: 'Shield-Bearer', icon: 'S', color: '#6fb6ff', text: 'Gives shields to nearby enemies every few seconds (not to itself).' },
  saboteur: { name: 'Saboteur', icon: '!', color: '#ff9b3d', text: 'While unseen, disables up to 2 towers it walks past for 4 seconds.' },
  propaganda: { name: 'Propaganda', icon: 'P', color: '#d9c38c', text: 'Drains the morale of the district it walks through.' },
  explodes: { name: 'Explodes', icon: '*', color: '#ff9b3d', text: 'When killed, disables towers within a short radius for 2.5 seconds.' },
  thief: { name: 'Thief', icon: '$', color: '#6fd96f', text: 'Steals 25% of your gold if it reaches the keep.' },
};

export const ENEMIES = {
  zealot: { name: 'Zealot Rusher', size: 8, hp: 38, speed: 78, bounty: 5, leak: 1, traits: ['fast'],
    desc: 'Fast and fragile. Comes in large numbers.' },
  matron: { name: 'Temperance Matron', size: 11, hp: 170, speed: 42, bounty: 12, leak: 2, traits: ['sobering'], soberAura: 100,
    desc: 'Slow and sturdy. Switches off tower buffs around her.' },
  picket: { name: 'Picket Line', size: 12, hp: 240, speed: 34, bounty: 14, leak: 2, traits: ['shieldbearer'],
    shieldAura: { range: 70, amount: 18, every: 4 }, desc: 'Keeps the marchers around it shielded.' },
  believer: { name: 'True Believer', size: 14, hp: 480, speed: 38, bounty: 30, leak: 3, traits: ['armored', 'elite'],
    desc: 'Heavily armored elite. Sharp attacks bounce off.' },
  infiltrator: { name: 'Infiltrator', size: 9, hp: 85, speed: 60, bounty: 15, leak: 2, traits: ['hidden', 'saboteur'],
    sabotage: { range: 55, dur: 4, max: 2 }, desc: 'Invisible without detection, and disables towers it slips past.' },
  pamphleteer: { name: 'Pamphleteer', size: 9, hp: 115, speed: 50, bounty: 10, leak: 1, traits: ['propaganda'], moraleDrain: 0.5,
    desc: 'Lowers district morale while alive.' },
  martyr: { name: 'Martyr', size: 9, hp: 85, speed: 70, bounty: 8, leak: 1, traits: ['explodes'], deathBlast: { range: 80, dur: 2.5 },
    desc: 'Disables nearby towers when killed.' },
  widow: { name: 'Cave Widow', size: 12, hp: 220, speed: 44, bounty: 10, leak: 2, traits: ['splits'], split: { type: 'widowling', count: 2 },
    desc: 'Splits into two Orphans when killed.' },
  widowling: { name: 'Orphan', size: 6, hp: 32, speed: 60, bounty: 2, leak: 1, traits: [], desc: 'Small and quick.' },
  revivalist: { name: 'Revivalist', size: 10, hp: 190, speed: 48, bounty: 12, leak: 2, traits: ['regrow'], regrow: 0.04,
    desc: 'Heals 4% of its health per second once it has gone 1.5s without being hit, unless it is burning.' },
  bagman: { name: "Rump's Bagman", size: 16, hp: 1400, speed: 46, bounty: 60, leak: 2, traits: ['elite', 'thief'], steal: 0.25,
    desc: 'Big, slow, and robs the treasury if he gets through.' },
  insurgent: { name: 'Insurgent', size: 7, hp: 55, speed: 66, bounty: 2, leak: 1, traits: [],
    desc: 'Townsfolk turned by low morale. They appear inside your defences.' },
  // bosses (every 10 waves)
  warwagon: { name: 'MAMA War Wagon', size: 22, hp: 3600, speed: 26, bounty: 150, leak: 999, traits: ['boss'],
    spill: [['zealot', 8], ['matron', 2]], desc: 'A rolling barricade. Spills Zealots and Matrons when destroyed.' },
  fortress: { name: 'Picket Fortress', size: 24, hp: 7000, speed: 20, bounty: 250, leak: 999, traits: ['boss', 'shieldbearer'],
    shieldAura: { range: 110, amount: 60, every: 3 }, spill: [['picket', 4], ['believer', 2]],
    desc: 'A siege tower of placards. Shields everything around it; spills Pickets and Believers.' },
  plinket: { name: 'Susan Plinket', size: 20, hp: 16000, speed: 22, bounty: 0, leak: 999, traits: ['boss'],
    desc: 'Untargetable at first, then shielded, then enraged. Summons MAMA as she walks.' },
};

// Modifiers waves can stack on any non-boss unit (BTD5 camo/regrow style).
export const MODIFIERS = {
  hidden: { traits: ['hidden'] },
  fortified: { traits: ['fortified'], hp: 2 },
  regrow: { traits: ['regrow'], regrow: 0.03 },
  armored: { traits: ['armored'] },
  fast: { traits: ['fast'], speed: 1.35 },
};

// wave-based HP scaling; the late term keeps the siege ahead of a snowballed economy,
// and freeplay (31+) keeps compounding
export const hpMult = (w) => {
  let m = 1 + 0.06 * (w - 1) + 0.004 * (w - 1) ** 2 + 0.012 * Math.max(0, w - 12) ** 2;
  if (w > 30) m *= 1.035 ** (w - 30);
  return m;
};
