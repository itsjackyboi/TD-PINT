// Liquor King ultimates. Pick 2 per run from those unlocked in the Ledger.
export const KINGS = {
  seamus: {
    name: 'Seamus Bonehardy', title: 'King of Kegs', ability: 'Barrel Avalanche', ale: 40, cd: 45,
    text: 'Every enemy on the map takes 220 damage and is knocked back 60px (heavies take damage only).',
  },
  buke: {
    name: 'Buke', title: 'No Middle, No Last Name', ability: 'Chug!', ale: 30, cd: 40,
    text: 'All towers +80% attack speed for 8s — then −40% for 6s while hungover. Sobered towers get neither.',
  },
  jagerbauhm: {
    name: 'Jagerbauhm', title: 'Drunken Angel', ability: 'Angel\'s Barricade', ale: 35, cd: 40, targeted: true, locked: true,
    text: 'Click the road: a barricade halts every non-boss enemy within 30px for 5s.',
  },
  guinnie: {
    name: "Steph 'Guinnie' O'Guinness", title: 'Never Forgets a Face', ability: 'Old Grudge', ale: 45, cd: 30, locked: true,
    text: 'Execute the highest-HP non-boss enemy on the map. Against Plinket: 6% of her max HP.',
  },
  jack: {
    name: 'Jack Anqoak', title: 'Oracle of Aleforge', ability: 'Read the Ledger', ale: 20, cd: 60, locked: true,
    text: 'Authenticates the next 3 intercepted letters and marks every enemy (+25% damage taken) for 6s.',
  },
  jp: {
    name: 'Jameson Pilsner', title: 'Born of the Spill', ability: 'Whiskey & Beer', ale: 60, cd: 0, once: true, locked: true,
    text: 'Once per run: +3 Resolve.',
  },
};
