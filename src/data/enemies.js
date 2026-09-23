// MAMA's forces. HP here is wave-1 HP; the wave runner applies hpMult(wave).
export const ENEMIES = {
  zealot: {
    name: 'Zealot Rusher', shape: 'tri', color: '#e05a47', size: 8,
    hp: 38, speed: 78, armor: 0, bounty: 5, leak: 1,
    desc: 'Fast, fragile, fanatical. There are always more.',
  },
  matron: {
    name: 'Temperance Matron', shape: 'circle', color: '#f2f2f2', size: 11,
    hp: 170, speed: 42, armor: 2, bounty: 12, leak: 2, soberAura: 100,
    desc: 'MAA veteran. "Sobers" nearby towers: ale towers fire at half speed and lose all buffs.',
  },
  picket: {
    name: 'Picket Line', shape: 'square', color: '#9aa0a6', size: 12,
    hp: 240, speed: 34, armor: 6, bounty: 14, leak: 2, shieldAura: { range: 70, amount: 18, every: 4 },
    desc: 'Placards up. Every 4s, shields other nearby marchers (not itself).',
  },
  believer: {
    name: 'True Believer', shape: 'hex', color: '#6b1f2a', size: 14,
    hp: 650, speed: 38, armor: 10, bounty: 30, leak: 3, heavy: true, elite: true, cleanse: true,
    desc: 'Elite. Heavy armor. At half health, shakes off every slow and burn and shrugs off slows for 3s.',
  },
  infiltrator: {
    name: 'Infiltrator', shape: 'diamond', color: '#5a6b4d', size: 9,
    hp: 105, speed: 60, armor: 1, bounty: 15, leak: 2, invisible: true, sabotage: { range: 55, dur: 4, max: 2 },
    desc: 'MAMA is already inside the government. Invisible without detection; sabotages towers it walks past.',
  },
  pamphleteer: {
    name: 'Pamphleteer', shape: 'circle', color: '#d9c38c', size: 9,
    hp: 115, speed: 50, armor: 0, bounty: 10, leak: 1, moraleDrain: 0.5,
    desc: '"THE LIQUOR KINGS SLAUGHTERED CUM!" Drains the morale of whichever district it walks through.',
  },
  martyr: {
    name: 'Martyr', shape: 'tri', color: '#ff9b3d', size: 9,
    hp: 85, speed: 70, armor: 0, bounty: 8, leak: 1, deathBlast: { range: 80, dur: 2.5 },
    desc: 'Dies for the cause. Disables towers within 80px when killed. Kill them where it doesn\'t matter.',
  },
  widow: {
    name: 'Cave Widow', shape: 'circle', color: '#3d2f4a', size: 12,
    hp: 300, speed: 44, armor: 3, bounty: 10, leak: 2, split: { type: 'widowling', count: 2 },
    desc: 'Survivors of the cave massacre. Split into two orphans on death.',
  },
  widowling: {
    name: 'Orphan', shape: 'circle', color: '#6e5a85', size: 6,
    hp: 45, speed: 66, armor: 0, bounty: 2, leak: 1,
    desc: '"Only one child survived." Not anymore.',
  },
  bagman: {
    name: "Rump's Bagman", shape: 'square', color: '#3f7a3a', size: 16,
    hp: 1400, speed: 46, armor: 4, bounty: 60, leak: 2, heavy: true, elite: true, steal: 0.25,
    desc: 'Carries the Treasurer\'s embezzled gold to MAMA. Steals 25% of your gold if he gets through.',
  },
  insurgent: {
    name: 'Insurgent Cell', shape: 'tri', color: '#c23b8a', size: 7,
    hp: 55, speed: 66, armor: 0, bounty: 2, leak: 1,
    desc: 'Townsfolk turned by low morale. They rise from inside your defenses.',
  },
  plinket: {
    name: 'Susan Plinket', shape: 'star', color: '#ff5fb0', size: 20,
    hp: 16000, speed: 22, armor: 8, bounty: 0, leak: 999, heavy: true, elite: true, boss: true,
    desc: 'Minister of Foreign Relations. Moderate. Reasonable. Founder of MAMA.',
  },
};

// wave-based HP scaling; the extra term only kicks in after wave 15 so the late siege
// keeps outpacing a snowballed economy
export const hpMult = (w) => 1 + 0.08 * (w - 1) + 0.0045 * (w - 1) ** 2 + 0.006 * Math.max(0, w - 15) ** 2;
