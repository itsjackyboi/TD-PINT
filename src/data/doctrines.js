// Offered 3-at-a-time after waves 5/10/15/20/25. Each is a trade, never a free lunch.
// `mods` are read by the world; `now(world)` runs once on pick.
export const DOCTRINES = {
  barleyRoad: {
    name: 'Barley Road Initiative', text: '+35% wave income. Enemies move 8% faster on the new roads.',
    flavor: '"F— that silk road sh-t, it\'s time for the Barley road now."',
    mods: { incomeMult: 0.35, enemySpeed: 0.08 },
  },
  gdcAudit: {
    name: 'GDC Audit', text: 'All infiltrators are permanently revealed. Interest cap halved.',
    flavor: 'Mr. BBL leads the Gideon Drake Commission "with quiet competence."',
    mods: { revealAll: true, interestCapMult: -0.5 },
  },
  legalizeTonic: {
    name: 'Legalize the Tonic', text: '+20 ale per wave. District morale regenerates at half rate.',
    flavor: 'Seamus signed it. Rump had the letters.',
    mods: { aleIncome: 20, moraleRegenMult: -0.5 },
  },
  craftsmenCharter: {
    name: "Craftsmen's Guild Charter", text: 'Towers and upgrades cost 12% less. Selling refunds 45% instead of 70%.',
    flavor: 'Unemployment eliminated in one stroke.',
    mods: { costMult: -0.12, sellRefund: 0.45 },
  },
  miningCharter: {
    name: 'Mining Guild Charter', text: 'Crossbows gain +4 armor pierce and +10% damage. Wave income −10%.',
    flavor: 'The mining guild answers only to the Kings. Mostly.',
    mods: { bowPierce: 4, bowDmg: 0.1, incomeMult: -0.1 },
  },
  hallOfAle: {
    name: 'Hall of Ale Feast', text: 'All districts +25 morale now; morale regen +50%. −10 ale per wave.',
    flavor: 'A different family hosts every month. This month, everyone.',
    mods: { moraleRegenMult: 0.5, aleIncome: -10 }, now: (w) => w.addMoraleAll(25),
  },
  conscription: {
    name: 'Militia Conscription', text: 'Pikelines +30% damage. All districts −10 morale now.',
    flavor: 'Volunteer militia. Volunteered by the Kings.',
    mods: { pikeDmg: 0.3 }, now: (w) => w.addMoraleAll(-10),
  },
  refinance: {
    name: 'Roto Bond Refinancing', text: 'All outstanding debt reduced 30%. Future bonds +10% interest.',
    flavor: 'The traders in Roto were especially happy to buy these bonds.',
    mods: { bondRate: 0.1 }, now: (w) => { for (const b of w.bonds) b.due = Math.round(b.due * 0.7); },
    locked: true,
  },
  colorGuardRally: {
    name: 'Color Guard Rally', text: '+3 Resolve now. Enemies have +8% HP for the rest of the siege.',
    flavor: 'The first ones to plant the flag of Aleforge on this island.',
    mods: { enemyHp: 0.08 }, now: (w) => { w.resolve += 3; },
  },
  tankardGrant: {
    name: 'Gilded Tankard Grant', text: '+220 gold now. No interest for the next 5 waves.',
    flavor: 'Some townsfolk are uneasy with the government investing directly into private business.',
    mods: {}, now: (w) => { w.gold += 220; w.noInterestUntil = w.wave + 5; },
  },
  historicAct: {
    name: 'Old Aleforge Historic Act', text: 'All towers +12% range. Towers can no longer be sold.',
    flavor: 'Protected, honorary, and utterly immovable.',
    mods: { rangeMult: 0.12, noSell: true }, locked: true,
  },
  freakyHogs: {
    name: "Freddy Hog's Freaky Hogs", text: 'Kill bounties +25%. Leaks cost +1 extra Resolve... per three leaks.',
    flavor: 'The best quality (and the freakiest) hogs in all of Pintland.',
    mods: { bountyMult: 0.25, leakTax: true },
  },
};
