// Tower definitions. All tuning numbers live here.
// Each branch has 3 tiers; a tier's `set` is merged (Object.assign) over the
// running stats, so later tiers only list what changes.
//
// attack kinds:
//   bullet  – homing projectile, single target (optionally penetrates a line)
//   splash  – lobbed shell at target position, damages radius
//   pulse   – instant AoE around the tower
//   hitscan – instant hit, drawn as a beam
//   global  – instant effect on every enemy on the map
export const TOWERS = {
  pike: {
    key: '1', name: 'Militia Pikeline', short: 'Pike', glyph: 'P', color: '#c9a45c',
    flavor: "Gideon's volunteer militia. \"Only strong enough to deter small groups.\" You'll need a lot of them.",
    cost: 70,
    base: { attack: 'bullet', range: 100, dmg: 12, rate: 1.6, projSpeed: 520 },
    branches: [
      { name: 'Color Guard', flavor: 'Cpt. Lincoln Dillydally plants the flag. Nearby towers fight harder.', tiers: [
        { cost: 80, name: 'Standard Bearers', set: { dmg: 17, aura: { rate: 0.12, dmg: 0, range: 110 } } },
        { cost: 120, name: 'Honor Guard', set: { dmg: 24, aura: { rate: 0.2, dmg: 0.08, range: 115 } } },
        { cost: 210, name: 'Plant the Flag', set: { dmg: 34, aura: { rate: 0.3, dmg: 0.15, range: 125 } } },
      ] },
      { name: "Sheriff's Deputies", flavor: 'Sheriff Edward Cocaine, Old Aleforge Municipal. Sees through MAMA disguises.', tiers: [
        { cost: 70, name: 'Deputized', set: { detect: true, range: 115 } },
        { cost: 120, name: 'Posse', set: { dmg: 19, rate: 2.0 } },
        { cost: 230, name: 'Long Arm of the Law', set: { dmg: 28, rate: 2.5, pierce: 6, range: 125 } },
      ] },
    ],
  },
  keg: {
    key: '2', name: 'Keg Catapult', short: 'Keg', glyph: 'K', color: '#b0643a',
    flavor: 'The Barrel Breakers\' answer to crowds: a full keg, delivered at speed.',
    cost: 120,
    base: { attack: 'splash', range: 130, minRange: 45, dmg: 22, rate: 0.55, splash: 45, projSpeed: 300 },
    branches: [
      { name: "Alemaster's Mortar", flavor: "Named for Seamus Bonehardy's ship. Bigger kegs, farther.", tiers: [
        { cost: 130, name: 'Double Hoops', set: { dmg: 40, range: 155 } },
        { cost: 190, name: 'Hogshead Shells', set: { dmg: 62, splash: 55 } },
        { cost: 340, name: "The Alemaster's Mortar", set: { dmg: 92, splash: 60, range: 195, pierce: 4 } },
      ] },
      { name: 'Rolling Barrels', flavor: 'Aim low. Barrels bowl down the road and knock zealots back.', tiers: [
        { cost: 120, name: 'Low Arc', set: { dmg: 32, rate: 0.7, knockback: 12 } },
        { cost: 180, name: 'Barrel Run', set: { dmg: 44, knockback: 20, stun: 0.3 } },
        { cost: 310, name: 'Brewery Avalanche', set: { dmg: 64, rate: 0.9, knockback: 28, stun: 0.5 } },
      ] },
    ],
  },
  tap: {
    key: '3', name: 'Gilded Tankard Taproom', short: 'Tap', glyph: 'T', color: '#e0b93c', ale: true,
    flavor: 'Magic ale from the Tankard spring. Never a hangover — just a great deal of stumbling.',
    cost: 90, aleCost: 20,
    base: { attack: 'pulse', range: 90, dmg: 3, rate: 1.0, slow: 0.35, slowDur: 1.2 },
    branches: [
      { name: "Wepple's Stout", flavor: 'Glub Tuppus Wepple\'s strongest pour. They forget which way the castle is.', tiers: [
        { cost: 90, name: 'Double Pour', set: { slow: 0.45 } },
        { cost: 150, name: 'Stout Night', set: { slow: 0.55, range: 105 } },
        { cost: 250, name: 'Last Call', set: { slow: 0.6, stagger: 0.15 } },
      ] },
      { name: 'Magic Spring', flavor: 'Tap the spring directly. Ale income — the Gilded Tankard Grant at work.', tiers: [
        { cost: 100, name: 'Spring Tap', set: { aleIncome: 8 } },
        { cost: 160, name: 'Grant Money', set: { aleIncome: 16, goldIncome: 10 } },
        { cost: 260, name: 'Goldcoral Reinvestment', set: { aleIncome: 28, goldIncome: 25 } },
      ] },
    ],
  },
  still: {
    key: '4', name: 'Brewers Lane Still', short: 'Still', glyph: 'S', color: '#d9512c', ale: true,
    flavor: 'Brewers Lane families have distilled here for generations. Some of it burns on the way down. All of it burns on the way out.',
    cost: 100, aleCost: 15,
    base: { attack: 'bullet', range: 110, dmg: 6, rate: 0.9, burn: 15, burnDur: 3, projSpeed: 380 },
    branches: [
      { name: 'Firewater', flavor: 'Burning spirits splash onto everyone nearby.', tiers: [
        { cost: 110, name: 'High Proof', set: { burn: 22 } },
        { cost: 170, name: 'Splash Cask', set: { burn: 34, splash: 35 } },
        { cost: 290, name: 'Hall of Ale Bonfire', set: { burn: 56, splash: 50 } },
      ] },
      { name: 'Bootleg ClockHeart', flavor: 'Legalized under blackmail from John Rump. Enormous damage — and the town hates it.', tiers: [
        { cost: 120, name: 'Cut Tonic', set: { burn: 40, moraleCost: 3 } },
        { cost: 180, name: 'Rump\'s Reserve', set: { burn: 64, moraleCost: 5 } },
        { cost: 330, name: 'Tonic Madness', set: { burn: 105, moraleCost: 8, burnVuln: 0.15 } },
      ] },
    ],
  },
  bow: {
    key: '5', name: 'Mining Guild Crossbows', short: 'Bow', glyph: 'B', color: '#8fa3b8',
    flavor: 'The Kings founded the craftsmen and mining guilds to give idle drunkards something to do. Now they shoot bolts through True Believers.',
    cost: 110,
    base: { attack: 'bullet', range: 150, dmg: 28, rate: 0.8, pierce: 5, projSpeed: 700 },
    branches: [
      { name: 'Deep Delvers', flavor: 'Mining-guild bolts. Armor is just more rock.', tiers: [
        { cost: 120, name: 'Pick Heads', set: { dmg: 48, pierce: 8 } },
        { cost: 190, name: 'Bedrock Bolts', set: { dmg: 80, pierce: 12 } },
        { cost: 330, name: 'Vein Splitter', set: { dmg: 150, pierce: 20, shieldBreak: 2 } },
      ] },
      { name: "Craftsmen's Ballista", flavor: 'Guild-built siege engines. Bolts go through the first zealot, and the next.', tiers: [
        { cost: 130, name: 'Longstock', set: { dmg: 42, range: 185 } },
        { cost: 200, name: 'Impaler', set: { dmg: 64, penetrate: 3 } },
        { cost: 350, name: 'Guildmaster\'s Ballista', set: { dmg: 110, penetrate: 5, range: 215 } },
      ] },
    ],
  },
  light: {
    key: '6', name: 'Lighthouse & Customs', short: 'Light', glyph: 'L', color: '#7fd1d9',
    flavor: 'Aleforge Light House and Customs Control. Nothing comes ashore uninspected.',
    cost: 90,
    base: { attack: 'hitscan', range: 170, dmg: 6, rate: 0.6, detect: true, mark: 0.2, markDur: 3, marks: 1 },
    branches: [
      { name: 'Customs Seizure', flavor: 'Marked contraband is confiscated. Bounties on marked kills.', tiers: [
        { cost: 90, name: 'Inspection', set: { bountyBonus: 0.5 } },
        { cost: 140, name: 'Seizure', set: { bountyBonus: 1.0, mark: 0.25 } },
        { cost: 240, name: 'Tariff Wall', set: { bountyBonus: 1.5, mark: 0.3, marks: 2 } },
      ] },
      { name: 'Beacon', flavor: 'The great lamp turned inland. Marks many at once.', tiers: [
        { cost: 100, name: 'Polished Lens', set: { range: 210 } },
        { cost: 150, name: 'Sweeping Beam', set: { range: 250, mark: 0.3, marks: 3 } },
        { cost: 260, name: 'Beacon of Aleforge', set: { range: 290, mark: 0.35, marks: 5 } },
      ] },
    ],
  },
  clock: {
    key: '7', name: 'CockPower Clock Tower', short: 'Clock', glyph: 'C', color: '#b58cd9', max: 2, locked: true,
    flavor: 'Sir Robert CockPower keeps time for all Aleforge — and, briefly, stops it.',
    cost: 200,
    base: { attack: 'global', range: 0, dmg: 0, rate: 1 / 8, slow: 0.3, slowDur: 1.5 },
    branches: [
      { name: 'Tick', flavor: 'Faster chimes.', tiers: [
        { cost: 150, name: 'Quarter Chime', set: { rate: 1 / 6 } },
        { cost: 220, name: 'Heavy Pendulum', set: { slow: 0.4, slowDur: 2 } },
        { cost: 350, name: 'Stopped Clock', set: { rate: 1 / 4, slowDur: 2.2 } },
      ] },
      { name: 'Tock', flavor: 'The bell hits like a hammer.', tiers: [
        { cost: 160, name: 'Tolling', set: { dmg: 40 } },
        { cost: 240, name: 'Great Bell', set: { dmg: 90 } },
        { cost: 380, name: 'Rewind', set: { dmg: 180, knockback: 40 } },
      ] },
    ],
  },
};

export const TOWER_ORDER = ['pike', 'keg', 'tap', 'still', 'bow', 'light', 'clock'];
export const SELL_REFUND = 0.7;

// Full stat block for a tower at (branch, tier).
export function towerStats(type, branch, tier) {
  const def = TOWERS[type];
  const s = { ...def.base };
  if (branch != null) for (let t = 0; t < tier; t++) Object.assign(s, def.branches[branch].tiers[t].set);
  return s;
}
