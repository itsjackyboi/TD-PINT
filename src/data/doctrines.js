// Offered 3-at-a-time after waves 5/10/15/20/25. Each is a trade-off.
// `mods` are read by the world; `now(world)` runs once when picked.
export const DOCTRINES = {
  barleyRoad: { name: 'Barley Road Initiative', text: '+35% wave income. Enemies move 8% faster.', mods: { incomeMult: 0.35, enemySpeed: 0.08 } },
  gdcAudit: { name: 'GDC Audit', text: 'All Hidden enemies are revealed for the rest of the run. Interest cap halved.', mods: { revealAll: true, interestCapMult: -0.5 } },
  legalizeTonic: { name: 'Legalize the Tonic', text: '+20 ale per wave. District morale recovers at half speed.', mods: { aleIncome: 20, moraleRegenMult: -0.5 } },
  craftsmenCharter: { name: "Craftsmen's Guild Charter", text: 'Towers and upgrades cost 12% less. Selling refunds 45% instead of 70%.', mods: { costMult: -0.12, sellRefund: 0.45 } },
  miningCharter: { name: 'Mining Guild Charter', text: 'Crossbowmen and Repeaters deal +20% damage. Wave income −10%.', mods: { typeDmg: { bow: 0.2, repeater: 0.2 }, incomeMult: -0.1 } },
  hallOfAle: { name: 'Hall of Ale Feast', text: 'All districts +25 morale now; morale recovers 50% faster. −10 ale per wave.', mods: { moraleRegenMult: 0.5, aleIncome: -10 }, now: (w) => w.addMoraleAll(25) },
  conscription: { name: 'Militia Conscription', text: 'Pikemen and Hookmen deal +30% damage. All districts −10 morale now.', mods: { typeDmg: { pike: 0.3, hook: 0.3 } }, now: (w) => w.addMoraleAll(-10) },
  refinance: { name: 'Roto Bond Refinancing', text: 'All outstanding debt reduced 30%. Future bonds +10% interest.', mods: { bondRate: 0.1 }, now: (w) => { for (const b of w.bonds) b.due = Math.round(b.due * 0.7); } },
  colorGuardRally: { name: 'Color Guard Rally', text: '+3 Resolve now. Enemies have +8% health for the rest of the run.', mods: { enemyHp: 0.08 }, now: (w) => { w.resolve += 3; } },
  tankardGrant: { name: 'Gilded Tankard Grant', text: '+250 gold now. No interest for the next 5 waves.', mods: {}, now: (w) => { w.gold += 250; w.noInterestUntil = w.wave + 5; } },
  historicAct: { name: 'Old Aleforge Historic Act', text: 'All towers +12% range. Towers can no longer be sold.', mods: { rangeMult: 0.12, noSell: true } },
  freakyHogs: { name: "Freddy Hog's Freaky Hogs", text: 'Kill bounties +25%. Every third leak costs 1 extra Resolve.', mods: { bountyMult: 0.25, leakTax: true } },
  alchemy: { name: 'Hoegaarden Manuscripts', text: 'Fire and cold damage +25%. Explosive damage −10%.', mods: { dtypeDmg: { fire: 0.25, cold: 0.25, explosive: -0.1 } } },
  shantyPact: { name: 'Shanty Town Pact', text: 'Ships and Farms pay +50% income. Bonds cost +10% interest.', mods: { incomeTypes: 0.5, bondRate: 0.1 } },
};
