// Tower roster. BTD5 structure: two upgrade paths of four tiers; one path may go
// to tier 4 while the other stops at tier 2. Tiers 3–4 also need tower XP
// (earned across runs, see src/core/progress.js).
//
// Stat fields (base, then modified by tiers via set / add / mul):
//   kind      proj | beam | radial | pulse | freeze | mortar | repeater | spikes | farm | aura | orbit | global
//   proj      dart (straight, pierces) | shell (explodes at the target) | hook (goes out and back)
//   dtype     sharp | explosive | fire | cold | magic      shred: sharp that also hurts Armored
//   range dmg rate pierce count spread(deg) splash projSpeed homing detect
//   slow slowDur burn burnDur stun knockback mark markDur marks bountyBonus bossMult
//   income aleIncome aura{} buff{} pile{} freeze frost chain abilities
// Every tier has `desc`: exactly what it changes, in plain words.
export const TOWERS = {
  // ------------------------------------------------------------ starters
  pike: {
    name: 'Militia Pikeman', short: 'Pikeman', key: '1', cost: 70, color: '#c9a45c', unlock: { start: true },
    desc: 'Cheap, quick spear thrower. Sharp damage, hits one enemy per spear.',
    base: { kind: 'proj', proj: 'dart', dtype: 'sharp', range: 110, dmg: 16, rate: 1.6, pierce: 1, projSpeed: 560 },
    paths: [
      { name: 'Sheriff\'s Deputies', tiers: [
        { name: 'Long Spears', cost: 90, desc: 'Spears pierce 1 more enemy.', add: { pierce: 1 } },
        { name: 'Sheriff\'s Badge', cost: 130, desc: 'Detects Hidden enemies. +20 range.', set: { detect: true }, add: { range: 20 } },
        { name: 'Posse', cost: 320, desc: 'Throws 3 spears in a spread. +4 damage, pierces 1 more.', set: { count: 3, spread: 22 }, add: { dmg: 4, pierce: 1 } },
        { name: 'Long Arm of the Law', cost: 1300, desc: 'Throws 5 spears, +4 damage. Ability: every Pikeman fires 3× faster for 10s.', set: { count: 5, spread: 34 }, add: { dmg: 4 },
          ability: { id: 'longarm', name: 'Long Arm of the Law', cd: 50 } },
      ] },
      { name: 'Color Guard', tiers: [
        { name: 'Quick Hands', cost: 100, desc: 'Throws 30% faster.', mul: { rate: 1.3 } },
        { name: 'Iron Tips', cost: 160, desc: 'Shred: spears hurt Armored enemies. +3 damage.', set: { shred: true }, add: { dmg: 3 } },
        { name: 'Standard Bearer', cost: 360, desc: 'Throws 2.5× as fast, pierces 2 more.', mul: { rate: 2.5 }, add: { pierce: 2 } },
        { name: "Dillydally's Banner", cost: 1500, desc: 'Damage 24, 5 throws per second, pierces 4.', set: { dmg: 24, rate: 5, pierce: 4 } },
      ] },
    ],
  },
  keg: {
    name: 'Keg Catapult', short: 'Keg', key: '2', cost: 140, color: '#b0643a', unlock: { start: true },
    desc: 'Lobs kegs that explode on impact. Explosive: hurts Armored. Cannot see Hidden.',
    base: { kind: 'proj', proj: 'shell', dtype: 'explosive', range: 125, dmg: 26, rate: 0.7, splash: 42, projSpeed: 320 },
    paths: [
      { name: 'Bigger Kegs', tiers: [
        { name: 'Wide Blast', cost: 170, desc: 'Explosion radius +30%.', mul: { splash: 1.3 } },
        { name: 'Hogshead', cost: 260, desc: '+10 damage.', add: { dmg: 10 } },
        { name: 'Barrel Breaker', cost: 640, desc: '+35 damage and 4× damage to Bosses and Elites.', add: { dmg: 35 }, set: { bossMult: 4 } },
        { name: 'Keg Storm', cost: 2400, desc: '+30 damage. Ability: 24 kegs rain on random enemies for 300 damage each.', add: { dmg: 30 },
          ability: { id: 'kegstorm', name: 'Keg Storm', cd: 50 } },
      ] },
      { name: 'Rolling Barrels', tiers: [
        { name: 'Long Throw', cost: 140, desc: '+25 range.', add: { range: 25 } },
        { name: 'Knockback', cost: 200, desc: 'Blasts push enemies back along the road.', set: { knockback: 16 } },
        { name: 'Cluster Kegs', cost: 520, desc: 'Each blast throws 6 fragments that also explode.', set: { cluster: 6 } },
        { name: 'Brewery Avalanche', cost: 1850, desc: 'Clusters of clusters, and blasts stun for 1 second.', set: { cluster: 10, stun: 1 } },
      ] },
    ],
  },
  bow: {
    name: 'Guild Crossbowman', short: 'Crossbow', key: '3', cost: 160, color: '#8fa3b8', unlock: { start: true },
    desc: 'Very long range, hits instantly, one target at a time. Sharp damage.',
    base: { kind: 'beam', dtype: 'sharp', range: 300, dmg: 34, rate: 0.8 },
    paths: [
      { name: 'Deep Delvers', tiers: [
        { name: 'Bedrock Bolts', cost: 200, desc: 'Shred: hurts Armored. +6 damage.', set: { shred: true }, add: { dmg: 6 } },
        { name: 'Pick-Head Bolts', cost: 320, desc: 'Damage 50.', set: { dmg: 50 } },
        { name: 'Vein Splitter', cost: 1050, desc: 'Damage 170; double damage to Bosses.', set: { dmg: 170, bossMult: 2 } },
        { name: 'Guildmaster\'s Bolt', cost: 3400, desc: 'Damage 360 and stuns for 1 second.', set: { dmg: 360, stun: 1 } },
      ] },
      { name: 'Night Watch', tiers: [
        { name: 'Watch Glass', cost: 150, desc: 'Detects Hidden enemies.', set: { detect: true } },
        { name: 'Quick Crank', cost: 260, desc: 'Fires 60% faster.', mul: { rate: 1.6 } },
        { name: 'Guild Volley', cost: 940, desc: 'Fires 3.5 times per second.', set: { rate: 3.5 } },
        { name: 'Supply Drop', cost: 2900, desc: 'Fires 5 times per second. Ability: a crate of 400–700 gold.', set: { rate: 5 },
          ability: { id: 'supply', name: 'Supply Drop', cd: 60 } },
      ] },
    ],
  },
  tap: {
    name: 'Gilded Tankard Taproom', short: 'Taproom', key: '4', cost: 110, color: '#e0b93c', unlock: { start: true }, ale: true,
    desc: 'Splashes sticky ale that slows enemies by 50% for 5s. Prefers enemies that are not slowed yet. No damage.',
    base: { kind: 'proj', proj: 'dart', dtype: 'none', range: 110, dmg: 0, rate: 1.2, pierce: 1, projSpeed: 480, slow: 0.5, slowDur: 5, glue: true },
    paths: [
      { name: "Wepple's Stout", tiers: [
        { name: 'Stouter Ale', cost: 120, desc: 'Slow lasts 10 seconds.', set: { slowDur: 10 } },
        { name: 'Corrosive Stout', cost: 220, desc: 'Slowed enemies take 8 damage per second.', set: { acid: 8 } },
        { name: 'Last Call', cost: 680, desc: 'Ale splashes onto everything within 40px. Acid 20/s.', set: { splash: 40, acid: 20 } },
        { name: 'Drown the Room', cost: 2100, desc: 'Acid 45/s. Ability: every enemy is slowed 75% for 6s.', set: { acid: 45 },
          ability: { id: 'drown', name: 'Drown the Room', cd: 45 } },
      ] },
      { name: 'Double Pour', tiers: [
        { name: 'Wide Splash', cost: 100, desc: 'Each shot slows 2 enemies.', add: { pierce: 1 } },
        { name: 'Fast Taps', cost: 180, desc: 'Fires twice as fast.', mul: { rate: 2 } },
        { name: 'Heavy Stout', cost: 520, desc: 'Slows by 70% (Bosses 35%). Each shot slows 4.', set: { slow: 0.7 }, add: { pierce: 2 } },
        { name: 'Endless Tap', cost: 1750, desc: 'Slows every enemy in range each shot.', set: { kind: 'pulse' } },
      ] },
    ],
  },
  // ------------------------------------------------------------ unlocked during a run
  spinner: {
    name: 'Bilgrat Bottle Spinner', short: 'Spinner', key: '5', cost: 180, color: '#7fb35a', unlock: { wave: 4 },
    desc: 'Flings 8 bottles in every direction at once. Short range, great at corners. Sharp damage.',
    base: { kind: 'radial', proj: 'dart', dtype: 'sharp', range: 75, dmg: 10, rate: 1.0, pierce: 1, count: 8, projSpeed: 420 },
    paths: [
      { name: 'Grog Ring', tiers: [
        { name: 'Faster Spin', cost: 150, desc: 'Fires 35% faster.', mul: { rate: 1.35 } },
        { name: 'Even Faster', cost: 260, desc: 'Fires 50% faster again.', mul: { rate: 1.5 } },
        { name: 'Grog Ring', cost: 710, desc: 'Replaces bottles with a ring of fire: 30 fire damage to everything in range, burns.', set: { kind: 'pulse', dtype: 'fire', dmg: 30, burn: 10, burnDur: 2 } },
        { name: 'Bilgrat Inferno', cost: 2550, desc: '60 fire damage per pulse, +20 range, burns hotter.', set: { dmg: 60, burn: 30 }, add: { range: 20 } },
      ] },
      { name: 'Glass Shards', tiers: [
        { name: 'Long Throw', cost: 120, desc: '+15 range.', add: { range: 15 } },
        { name: 'Twelve Bottles', cost: 210, desc: 'Fires 12 bottles.', set: { count: 12 } },
        { name: 'Glass Shards', cost: 520, desc: 'Bottles pierce 4 enemies, +6 damage.', add: { pierce: 3, dmg: 6 } },
        { name: 'Bilgrat Whirlwind', cost: 2000, desc: '16 bottles. Ability: 5 seconds of 40 bottles per second.', set: { count: 16 },
          ability: { id: 'whirl', name: 'Bilgrat Whirlwind', cd: 40 } },
      ] },
    ],
  },
  cellar: {
    name: 'Hoegaarden Cold Cellar', short: 'Cellar', key: '6', cost: 240, color: '#9fd8ff', unlock: { wave: 10 },
    desc: 'Freezes every enemy nearby for 1 second. Bosses are slowed instead. Frozen enemies ignore sharp damage.',
    base: { kind: 'freeze', dtype: 'cold', range: 70, dmg: 2, rate: 0.55, freeze: 1 },
    paths: [
      { name: 'Deep Chill', tiers: [
        { name: 'Long Freeze', cost: 180, desc: 'Freezes for 1.6 seconds.', set: { freeze: 1.6 } },
        { name: 'Permafrost', cost: 300, desc: 'Enemies stay 50% slowed after thawing.', set: { frost: 0.5 } },
        { name: 'Icicle Burst', cost: 1000, desc: 'Each freeze deals 30 cold damage.', set: { dmg: 30 } },
        { name: 'Absolute Zero', cost: 2800, desc: '60 damage per freeze. Ability: freeze everything on the map for 4s.', set: { dmg: 60 },
          ability: { id: 'zero', name: 'Absolute Zero', cd: 55 } },
      ] },
      { name: 'Wide Cellar', tiers: [
        { name: 'Cold Draft', cost: 150, desc: '+20 range.', add: { range: 20 } },
        { name: 'Arctic Wind', cost: 260, desc: 'Everything in range is slowed 35% at all times.', set: { chill: 0.35 } },
        { name: 'Cold Snap', cost: 900, desc: 'Freezes twice as often.', mul: { rate: 2 } },
        { name: 'Hoegaarden Vault', cost: 2600, desc: '+40 range and freezes every second.', add: { range: 40 }, set: { rate: 1 } },
      ] },
    ],
  },
  light: {
    name: 'Lighthouse & Customs', short: 'Lighthouse', key: '7', cost: 200, color: '#7fd1d9', unlock: { wave: 8 },
    desc: 'Reveals Hidden enemies in its radius for every tower. Marks targets so they take +20% damage.',
    base: { kind: 'beam', dtype: 'magic', range: 170, dmg: 5, rate: 0.6, detect: true, reveal: true, mark: 0.2, markDur: 3, marks: 1 },
    paths: [
      { name: 'Customs Seizure', tiers: [
        { name: 'Inspection', cost: 150, desc: 'Marked enemies drop +50% gold.', set: { bountyBonus: 0.5 } },
        { name: 'Tariff', cost: 250, desc: 'Marks 3 enemies at once.', set: { marks: 3 } },
        { name: 'Contraband', cost: 800, desc: 'Marked enemies take +35% damage, drop +100% gold.', set: { mark: 0.35, bountyBonus: 1 } },
        { name: 'Grand Tariff', cost: 2500, desc: 'Marks 6 enemies; +45% damage taken.', set: { marks: 6, mark: 0.45 } },
      ] },
      { name: 'Beacon', tiers: [
        { name: 'Polished Lens', cost: 150, desc: '+40 range.', add: { range: 40 } },
        { name: 'Sweeping Beam', cost: 250, desc: '+40 range, marks 2.', add: { range: 40 }, set: { marks: 2 } },
        { name: 'Beacon of Aleforge', cost: 900, desc: 'Reveals Hidden enemies across the whole map.', set: { revealAll: true } },
        { name: 'Blinding Beacon', cost: 2400, desc: 'Ability: stun every non-Boss enemy for 2.5 seconds.',
          ability: { id: 'blind', name: 'Blinding Beacon', cd: 40 } },
      ] },
    ],
  },
  // ------------------------------------------------------------ unlocked with tower XP
  hook: {
    name: 'Sackbeard Hookman', short: 'Hookman', key: '8', cost: 260, color: '#c98a5c', unlock: { xp: { tower: 'pike', amount: 600 } },
    desc: 'Throws a hook that flies out and comes back, hitting up to 6 enemies each way. Sharp damage.',
    base: { kind: 'proj', proj: 'hook', dtype: 'sharp', range: 120, dmg: 12, rate: 0.9, pierce: 6, projSpeed: 380 },
    paths: [
      { name: 'Barbed Hooks', tiers: [
        { name: 'Barbs', cost: 170, desc: 'Hooks hit 10 enemies each way.', set: { pierce: 10 } },
        { name: 'Sharper Hooks', cost: 300, desc: '+6 damage.', add: { dmg: 6 } },
        { name: 'Ricochet', cost: 1100, desc: 'Hook bounces between 14 enemies instead.', set: { chain: 14 } },
        { name: "Sackbeard's Anchor", cost: 3000, desc: 'Damage 34, bounces 30 times, Shred.', set: { dmg: 34, chain: 30, shred: true } },
      ] },
      { name: 'Crew', tiers: [
        { name: 'Quick Crew', cost: 160, desc: 'Throws 40% faster.', mul: { rate: 1.4 } },
        { name: 'Ironhooks', cost: 260, desc: 'Shred: hurts Armored.', set: { shred: true } },
        { name: 'Red-Hot Hooks', cost: 950, desc: 'Hooks set enemies on fire (15/s).', set: { burn: 15, burnDur: 3 } },
        { name: 'Mutiny', cost: 2800, desc: 'Throws twice as fast. Ability: 30 hooks at once.', mul: { rate: 2 },
          ability: { id: 'mutiny', name: 'Mutiny', cd: 35 } },
      ] },
    ],
  },
  still: {
    name: 'Brewers Lane Still', short: 'Still', key: '9', cost: 330, color: '#d9512c', unlock: { xp: { tower: 'tap', amount: 600 } }, ale: true,
    desc: 'Throws acid flasks (fire damage over time, stops Regrow) and every 6s brews a tonic giving one nearby tower +40% damage.',
    base: { kind: 'proj', proj: 'shell', dtype: 'fire', range: 110, dmg: 4, rate: 0.8, splash: 30, projSpeed: 360, burn: 12, burnDur: 3,
      buff: { every: 6, count: 1, dmg: 0.4, dur: 6, range: 110 } },
    paths: [
      { name: 'Firewater', tiers: [
        { name: 'Stronger Acid', cost: 200, desc: 'Burn 20 per second.', set: { burn: 20 } },
        { name: 'Big Flasks', cost: 340, desc: 'Splash +50%.', mul: { splash: 1.5 } },
        { name: 'Unstable Brew', cost: 1100, desc: 'Burn 45 per second; burning enemies take +15% damage.', set: { burn: 45, burnVuln: 0.15 } },
        { name: 'Bootleg ClockHeart', cost: 3500, desc: 'Burn 110 per second, huge splash.', set: { burn: 110 }, mul: { splash: 1.5 } },
      ] },
      { name: 'Brew Master', tiers: [
        { name: 'Stronger Tonic', cost: 240, desc: 'Tonic gives +60% damage.', set: { buff: { dmg: 0.6 } } },
        { name: 'Faster Brewing', cost: 400, desc: 'Brews every 3 seconds for 2 towers.', set: { buff: { every: 3, count: 2 } } },
        { name: 'Tonic of Strength', cost: 1200, desc: 'Tonic also gives +20% range and Shred.', set: { buff: { rangeMul: 0.2, shred: true } } },
        { name: 'Grand Brewmaster', cost: 3800, desc: 'Tonics for 5 towers at once, +100% damage.', set: { buff: { count: 5, dmg: 1 } } },
      ] },
    ],
  },
  scout: {
    name: 'Veilwalker Scout', short: 'Scout', key: '0', cost: 300, color: '#5a8a5d', unlock: { xp: { tower: 'bow', amount: 600 } },
    desc: 'Always detects Hidden enemies. Throws fast blades that pierce 2. Sharp damage.',
    base: { kind: 'proj', proj: 'dart', dtype: 'sharp', range: 115, dmg: 8, rate: 2.2, pierce: 2, projSpeed: 620, detect: true },
    paths: [
      { name: 'Shadow Arts', tiers: [
        { name: 'Honed Blades', cost: 200, desc: 'Blades pierce 4.', set: { pierce: 4 } },
        { name: 'Seeking Blades', cost: 300, desc: 'Blades curve toward their target.', set: { homing: true } },
        { name: 'Double Throw', cost: 1000, desc: 'Throws 2 blades at a time, +3 damage.', set: { count: 2, spread: 8 }, add: { dmg: 3 } },
        { name: 'Veil Master', cost: 3000, desc: 'Damage 16, 5 throws per second, Shred.', set: { dmg: 16, rate: 5, shred: true } },
      ] },
      { name: 'Tricks', tiers: [
        { name: 'Distraction', cost: 180, desc: 'Hits have a 15% chance to knock enemies back.', set: { distract: 0.15, knockback: 40 } },
        { name: 'Flash Powder', cost: 320, desc: 'Every 4th throw stuns enemies within 50px for 1s.', set: { flash: 4 } },
        { name: 'Veil Snare', cost: 1100, desc: 'Hits slow enemies by 50% for 2s.', set: { slow: 0.5, slowDur: 2 } },
        { name: 'Sabotage the Supply', cost: 3200, desc: 'Ability: all enemies move 50% slower and take +30% damage for 12s.',
          ability: { id: 'sabotage', name: 'Sabotage the Supply', cd: 60 } },
      ] },
    ],
  },
  ship: {
    name: 'Jolly Rammer', short: 'Ship', key: '-', cost: 380, color: '#7a5a33', unlock: { xp: { tower: 'keg', amount: 600 } }, water: true,
    desc: 'Warship placed on WATER only. Fires a cannonball and grapeshot. Explosive + sharp.',
    base: { kind: 'proj', proj: 'dart', dtype: 'sharp', range: 150, dmg: 12, rate: 1.1, pierce: 3, count: 2, spread: 18, projSpeed: 520, cannon: 18 },
    paths: [
      { name: 'Man-o\'-War', tiers: [
        { name: 'Faster Crew', cost: 240, desc: 'Fires 40% faster.', mul: { rate: 1.4 } },
        { name: 'Double Cannons', cost: 350, desc: 'Fires 4 shots each volley.', set: { count: 4, spread: 30 } },
        { name: 'Destroyer', cost: 1400, desc: 'Fires 3 times as fast.', mul: { rate: 3 } },
        { name: "The Alemaster's Mortar", cost: 4200, desc: 'Damage 26, cannon 60, even faster.', set: { dmg: 26, cannon: 60 }, mul: { rate: 1.5 } },
      ] },
      { name: 'Merchant Fleet', tiers: [
        { name: 'Grapeshot', cost: 200, desc: '+5 extra pellets each volley.', set: { grape: 5 } },
        { name: "Crow's Nest", cost: 300, desc: 'Detects Hidden enemies.', set: { detect: true } },
        { name: 'Merchantman', cost: 1300, desc: '+220 gold at the end of every wave.', set: { income: 220 } },
        { name: 'Coors Golden Clipper', cost: 4000, desc: '+550 gold per wave. Ability: tear 40% of health off the strongest Boss on the map.', set: { income: 550 },
          ability: { id: 'board', name: 'Boarding Hook', cd: 70 } },
      ] },
    ],
  },
  caltrop: {
    name: 'Caltrop Smithy', short: 'Smithy', key: '=', cost: 480, color: '#9a9a9a', unlock: { xp: { tower: 'spinner', amount: 800 } },
    desc: 'Drops caltrop piles on the road in range. Each pile hits 10 enemies for 10 sharp damage.',
    base: { kind: 'spikes', dtype: 'sharp', range: 100, rate: 0.6, dmg: 10, pile: { hits: 10, life: 30 } },
    paths: [
      { name: 'Iron Works', tiers: [
        { name: 'Bigger Piles', cost: 300, desc: 'Piles hit 16 enemies.', set: { pile: { hits: 16 } } },
        { name: 'White-Hot Iron', cost: 400, desc: 'Shred: hurts Armored. +6 damage.', set: { shred: true }, add: { dmg: 6 } },
        { name: 'Spiked Kegs', cost: 1400, desc: 'Each pile explodes for 60 when used up.', set: { pile: { explode: 60 } } },
        { name: 'Spiked Mines', cost: 4000, desc: 'Explosions deal 300, +10 damage per hit.', set: { pile: { explode: 300 } }, add: { dmg: 10 } },
      ] },
      { name: 'Production Line', tiers: [
        { name: 'Faster Forge', cost: 250, desc: 'Makes piles 40% faster.', mul: { rate: 1.4 } },
        { name: 'Smart Placement', cost: 400, desc: 'Places piles near the end of the road in range.', set: { smart: true } },
        { name: 'Long-Life Piles', cost: 1200, desc: 'Piles never rust away; 50% faster.', set: { pile: { life: 9999 } }, mul: { rate: 1.5 } },
        { name: 'Caltrop Storm', cost: 3500, desc: 'Ability: covers the entire road in caltrops.',
          ability: { id: 'storm', name: 'Caltrop Storm', cd: 45 } },
      ] },
    ],
  },
  farm: {
    name: 'Cumstead Barley Farm', short: 'Farm', key: 'q', cost: 450, color: '#e0c060', unlock: { xp: { tower: 'tap', amount: 1500 } },
    desc: 'Does not attack. Pays 80 gold at the end of every wave.',
    base: { kind: 'farm', range: 0, income: 80 },
    paths: [
      { name: 'More Barley', tiers: [
        { name: 'Extra Rows', cost: 250, desc: '+40 gold per wave.', add: { income: 40 } },
        { name: 'Irrigation', cost: 460, desc: '+60 gold per wave.', add: { income: 60 } },
        { name: 'Barley Road', cost: 1600, desc: '+150 gold per wave.', add: { income: 150 } },
        { name: 'Cumstead Empire', cost: 4500, desc: '+400 gold per wave.', add: { income: 400 } },
      ] },
      { name: 'Bonds Office', tiers: [
        { name: 'Ale Cellar', cost: 350, desc: '+12 ale per wave.', set: { aleIncome: 12 } },
        { name: 'Ledger Clerk', cost: 550, desc: 'Interest cap +15 gold.', set: { interestCap: 15 } },
        { name: 'Bond Office', cost: 1800, desc: 'New bonds cost 15% less interest; +80 gold per wave.', set: { bondDiscount: 0.15 }, add: { income: 80 } },
        { name: 'Aleforge Treasury', cost: 5000, desc: 'Interest cap +100 gold; +200 gold per wave.', set: { interestCap: 100 }, add: { income: 200 } },
      ] },
    ],
  },
  garrison: {
    name: 'Color Guard Garrison', short: 'Garrison', key: 'w', cost: 550, color: '#d45a5a', unlock: { xp: { tower: 'pike', amount: 1500 } },
    desc: 'Does not attack. Towers within its radius get +10% range and attack 10% faster.',
    base: { kind: 'aura', range: 120, aura: { rangeMul: 0.1, rate: 0.1 } },
    paths: [
      { name: 'Drill Yard', tiers: [
        { name: 'Drills', cost: 400, desc: 'Towers in radius attack 25% faster (instead of 10%).', set: { aura: { rate: 0.25 } } },
        { name: 'Watchtowers', cost: 500, desc: 'Towers in radius can see Hidden enemies.', set: { aura: { detect: true } } },
        { name: 'Iron Rations', cost: 1900, desc: 'Towers in radius pierce 1 more and gain Shred.', set: { aura: { pierce: 1, shred: true } } },
        { name: 'Old Aleforge Muster', cost: 5500, desc: 'Ability: every tower attacks twice as fast for 10s.',
          ability: { id: 'muster', name: 'Old Aleforge Muster', cd: 60 } },
      ] },
      { name: 'Quartermaster', tiers: [
        { name: 'Discount', cost: 400, desc: 'Towers and upgrades in radius cost 10% less.', set: { aura: { discount: 0.1 } } },
        { name: 'Bulk Orders', cost: 500, desc: 'Discount rises to 20%.', set: { aura: { discount: 0.2 } } },
        { name: 'Militia Levy', cost: 1900, desc: '+180 gold per wave.', set: { income: 180 } },
        { name: 'Royal Warrant', cost: 4800, desc: 'Towers in radius deal +2 damage; discount 25%.', set: { aura: { dmgAdd: 2, discount: 0.25 } } },
      ] },
    ],
  },
  mortar: {
    name: "Alemaster's Mortar", short: 'Mortar', key: 'e', cost: 550, color: '#6e7480', unlock: { xp: { tower: 'keg', amount: 1500 } },
    desc: 'Shells a target spot you choose anywhere on the map (tap the tower, then Set Target). Explosive, slightly inaccurate.',
    base: { kind: 'mortar', dtype: 'explosive', range: 9999, dmg: 18, rate: 0.5, splash: 50, inaccuracy: 30, projSpeed: 380 },
    paths: [
      { name: 'Heavy Shells', tiers: [
        { name: 'Wide Shells', cost: 300, desc: 'Explosion radius +40%.', mul: { splash: 1.4 } },
        { name: 'Heavy Powder', cost: 500, desc: '+20 damage.', add: { dmg: 20 } },
        { name: 'Shell Shock', cost: 1500, desc: 'Blasts stun for 1 second. +20 damage.', set: { stun: 1 }, add: { dmg: 20 } },
        { name: 'Pop and Awe', cost: 5000, desc: 'Ability: every enemy is stunned for 3s and takes 150 damage.',
          ability: { id: 'awe', name: 'Pop and Awe', cd: 55 } },
      ] },
      { name: 'Rapid Reload', tiers: [
        { name: 'Quick Load', cost: 300, desc: 'Fires 60% faster.', mul: { rate: 1.6 } },
        { name: 'Burning Shells', cost: 420, desc: 'Shells set enemies on fire (15/s).', set: { burn: 15, burnDur: 3 } },
        { name: 'Signal Flare', cost: 1300, desc: 'Reveals Hidden enemies where shells land. +50% speed.', set: { flare: true }, mul: { rate: 1.5 } },
        { name: 'Artillery Battery', cost: 4200, desc: 'Fires 3 times per second, damage 45.', set: { rate: 3, dmg: 45 } },
      ] },
    ],
  },
  repeater: {
    name: 'Orchenk Repeater', short: 'Repeater', key: 'r', cost: 750, color: '#8a8a5a', unlock: { xp: { tower: 'bow', amount: 1500 } },
    desc: 'Rapid-fire gun that shoots toward its aim point (auto-aims at the first enemy until you set one). Sharp damage.',
    base: { kind: 'repeater', proj: 'dart', dtype: 'sharp', range: 420, dmg: 5, rate: 8, pierce: 1, spread: 10, projSpeed: 700 },
    paths: [
      { name: 'Heavy Rounds', tiers: [
        { name: 'Focused Barrel', cost: 400, desc: 'Tighter spread, rounds pierce 3.', set: { spread: 4, pierce: 3 } },
        { name: 'Shredder Rounds', cost: 600, desc: 'Shred: hurts Armored. +2 damage.', set: { shred: true }, add: { dmg: 2 } },
        { name: 'Hydra Rounds', cost: 2200, desc: 'Rounds explode (explosive, 30px). +4 damage.', set: { dtype: 'explosive', splash: 30 }, add: { dmg: 4 } },
        { name: 'Manufactory Death Ray', cost: 6000, desc: 'A continuous beam that pierces 100 enemies. Damage 30.', set: { dmg: 30, pierce: 100, ray: true } },
      ] },
      { name: 'Belt Feed', tiers: [
        { name: 'Bigger Belt', cost: 400, desc: 'Fires 50% faster.', mul: { rate: 1.5 } },
        { name: 'Spinning Barrels', cost: 600, desc: 'Fires 30% faster again.', mul: { rate: 1.3 } },
        { name: 'Rocket Storm', cost: 2400, desc: 'Ability: fires 3 rockets per shot for 10s.',
          ability: { id: 'rockets', name: 'Rocket Storm', cd: 45 } },
        { name: 'Factory Overdrive', cost: 5500, desc: 'Fires twice as fast again.', mul: { rate: 2 } },
      ] },
    ],
  },
  // ------------------------------------------------------------ long-term unlocks
  cloud: {
    name: 'Cloudrunner', short: 'Cloudrunner', key: 't', cost: 900, color: '#d9b36a', unlock: { milestone: 'waves400' },
    desc: 'Flying machine that circles the map, dropping 8 darts in all directions every second. Hits anywhere.',
    base: { kind: 'orbit', proj: 'dart', dtype: 'sharp', range: 60, dmg: 9, rate: 1, pierce: 3, count: 8, projSpeed: 480 },
    paths: [
      { name: 'Bomber', tiers: [
        { name: 'Rapid Drop', cost: 500, desc: 'Fires 50% faster.', mul: { rate: 1.5 } },
        { name: 'Seeking Darts', cost: 700, desc: 'Darts home in on enemies.', set: { homing: true } },
        { name: 'Spectre', cost: 2600, desc: 'Fires 3× faster and drops kegs (explosive 40).', mul: { rate: 3 }, set: { bombs: 40 } },
        { name: 'Ground Zero', cost: 8000, desc: 'Ability: 800 damage to every enemy on the map.',
          ability: { id: 'groundzero', name: 'Ground Zero', cd: 60 } },
      ] },
      { name: 'Pursuit', tiers: [
        { name: 'Keg Drop', cost: 400, desc: 'Drops a keg (explosive 30) every lap.', set: { bombs: 30 } },
        { name: 'Spy Glass', cost: 600, desc: 'Detects Hidden enemies.', set: { detect: true } },
        { name: 'Flying Fortress', cost: 2400, desc: '16 darts per volley, +6 damage.', set: { count: 16 }, add: { dmg: 6 } },
        { name: 'Cloudrunner Armada', cost: 7000, desc: '24 darts, Shred, twice as fast.', set: { count: 24, shred: true }, mul: { rate: 2 } },
      ] },
    ],
  },
  clock: {
    name: 'CockPower Clock Tower', short: 'Clock', key: 'y', cost: 700, color: '#b58cd9', unlock: { milestone: 'plinket' },
    desc: 'Chimes every 7s: slows every enemy on the map by 30% for 1.5s.',
    base: { kind: 'global', dtype: 'magic', range: 0, dmg: 0, rate: 1 / 7, slow: 0.3, slowDur: 1.5 },
    paths: [
      { name: 'Tick', tiers: [
        { name: 'Quarter Chime', cost: 400, desc: 'Chimes every 5 seconds.', set: { rate: 1 / 5 } },
        { name: 'Heavy Pendulum', cost: 600, desc: 'Slow 45% for 2s.', set: { slow: 0.45, slowDur: 2 } },
        { name: 'Stopped Clock', cost: 2000, desc: 'Chimes every 3.5s for 2.5s.', set: { rate: 1 / 3.5, slowDur: 2.5 } },
        { name: 'Time Stop', cost: 6000, desc: 'Ability: freezes everything, Bosses slowed 50%, for 5s.',
          ability: { id: 'timestop', name: 'Time Stop', cd: 60 } },
      ] },
      { name: 'Tock', tiers: [
        { name: 'Tolling', cost: 400, desc: 'Each chime deals 40 magic damage to everything.', set: { dmg: 40 } },
        { name: 'Great Bell', cost: 700, desc: 'Chime damage 90.', set: { dmg: 90 } },
        { name: 'Rewind', cost: 2500, desc: 'Damage 200, pushes enemies back 40px.', set: { dmg: 200, knockback: 40 } },
        { name: 'Midnight Toll', cost: 7000, desc: 'Damage 600.', set: { dmg: 600 } },
      ] },
    ],
  },
  witch: {
    name: "Witch Doctor's Tower", short: 'Witch Doctor', key: 'u', cost: 3000, color: '#a060d0', unlock: { milestone: 'maps3' },
    desc: 'Lady Edgermire. Fires magic bolts 10 times a second that hurt everything and see Hidden.',
    base: { kind: 'proj', proj: 'dart', dtype: 'magic', range: 150, dmg: 12, rate: 10, pierce: 2, projSpeed: 700, detect: true },
    paths: [
      { name: 'Hexes', tiers: [
        { name: 'Hex Bolts', cost: 1500, desc: 'Bolts pierce 5.', set: { pierce: 5 } },
        { name: 'Plasma Hex', cost: 2500, desc: 'Damage 25.', set: { dmg: 25 } },
        { name: 'Sun Hex', cost: 9000, desc: 'Damage 60 with a small explosion.', set: { dmg: 60, splash: 25 } },
        { name: "Edgermire's Avatar", cost: 25000, desc: 'Damage 200.', set: { dmg: 200 } },
      ] },
      { name: 'Curses', tiers: [
        { name: 'Far Sight', cost: 1200, desc: '+50 range.', add: { range: 50 } },
        { name: 'Voodoo', cost: 2000, desc: '2% chance per hit to instantly kill a non-Elite, non-Boss enemy.', set: { voodoo: 0.02 } },
        { name: 'Curse of Weakness', cost: 8000, desc: 'Enemies in range take +50% damage from everything.', set: { curse: 0.5 } },
        { name: 'The Strange Price', cost: 22000, desc: 'Ability: every non-Boss enemy loses 80% of its health.',
          ability: { id: 'price', name: 'The Strange Price', cd: 60 } },
      ] },
    ],
  },
};

export const TOWER_ORDER = ['pike', 'keg', 'bow', 'tap', 'spinner', 'cellar', 'light', 'hook', 'still', 'scout', 'ship', 'caltrop', 'farm', 'garrison', 'mortar', 'repeater', 'cloud', 'clock', 'witch'];
export const SELL_REFUND = 0.7;
export const TIER_XP = [0, 0, 0, 1000, 3000]; // XP with a tower needed to buy tier N
export const MAX_SECOND_PATH = 2; // BTD5: the other path stops at tier 2 once one goes past it

export const DTYPE_TEXT = {
  sharp: 'Sharp', explosive: 'Explosive', fire: 'Fire', cold: 'Cold', magic: 'Magic', none: 'No damage',
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Full stat block for a tower with path tiers [a, b].
export function towerStats(type, tiers = [0, 0]) {
  const def = TOWERS[type];
  const s = structuredClone(def.base);
  const abilities = [];
  for (let p = 0; p < 2; p++) {
    for (let t = 0; t < tiers[p]; t++) {
      const up = def.paths[p].tiers[t];
      if (up.set) for (const k in up.set) s[k] = isObj(up.set[k]) && isObj(s[k]) ? { ...s[k], ...up.set[k] } : structuredClone(up.set[k]);
      if (up.add) for (const k in up.add) s[k] = (s[k] || 0) + up.add[k];
      if (up.mul) for (const k in up.mul) s[k] = (s[k] || 0) * up.mul[k];
      if (up.ability) abilities.push(up.ability);
    }
  }
  s.abilities = abilities;
  return s;
}

// BTD5 crosspath rule: one path may go past tier 2, the other then caps at 2.
export function canCrosspath(tiers, path) {
  const next = tiers[path] + 1;
  if (next > 4) return false;
  const other = tiers[1 - path];
  if (next > MAX_SECOND_PATH && other > MAX_SECOND_PATH) return false;
  if (other > MAX_SECOND_PATH && next > MAX_SECOND_PATH) return false;
  return true;
}
