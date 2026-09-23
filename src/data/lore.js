// Flavor text drawn from the Pintland Isles canon (Stewards of Aleforge era).

export const INTRO = [
  'Aleforge, Stewards of Aleforge era. The Liquor Kings have ascended to the throne and the town is on its knees: John Cum is dead, the wheat is blighted, the Tankard\'s ale stock sits in Goldcoral\'s warehouse, and the national debt is a problem for someone else.',
  'MAMA — Mothers Against Maximilian\'s Assassination — have been writing letters. The Kings "slaughter anyone they see as even a slight threat to their power. First MAA, then Thatcher, then Maximilian." They mean to end it.',
  'The Aleforge Militia is "only strong enough to deter small groups. A large riot or attack would be a real problem."',
  'This is a large attack.',
];

// {types} {path} {count} filled by the letter generator
export const LETTER_TEMPLATES = [
  'Send {types} by {path}. The Liquor "Kings" will not see it coming. They never do.',
  'Our loyal MAMAists gather {types}. They march on {path} at the next bell.',
  'The Time is Right. {types}, {path}. Revolution is neigh.',
  'Do not fail me. {types} across {path}. Their militia is a joke — make them laugh.',
  'The Kings are drunk imposters, clowns pretending to rule. {types} will prove it on {path}.',
  'Treasurer Rump suspects nothing. Move {types} through {path}.',
  'We strike while they are down. {types}. {path}. No mercy for the unsober.',
];

export const BBL = {
  start: 'Chancellor Mr. BBL: "Your Majesties. I\'ve prepared the ledger. Please try not to spill on it this time."',
  firstLeak: 'Mr. BBL: "Something got through. The castle will remember that, even if you don\'t."',
  lowMorale: (d) => `Mr. BBL: "${d} is turning. Below thirty percent, the pamphlets start becoming pitchforks."`,
  insurgency: (d) => `Mr. BBL: "Insurgents rising in ${d}. They were our neighbors this morning."`,
  bondDue: 'Mr. BBL: "The Roto traders would like their money. With interest. Mostly interest."',
  default: 'Mr. BBL: "We have defaulted. Every district saw that. Every district."',
  forgery: 'Mr. BBL: "A note on the letters: our Treasurer\'s hand is… familiar. Not every J.R. is the J.R."',
  doctrine: 'Mr. BBL: "A decision of state, Majesties. I\'ve taken the liberty of narrowing it to three."',
  wave10: 'Mr. BBL: "The GDC has noticed the letters\' seals differ. I trust Your Majesties noticed as well."',
  bagman: 'Mr. BBL: "That man is carrying a great deal of Treasury gold. Rump says it\'s a coincidence."',
  preBoss: 'Mr. BBL: "Minister Plinket has asked to address the troops. How very… moderate of her."',
  bossP2: 'SUSAN PLINKET: "No longer JR. Hear my name, loyal MAMAists — the Liquor Kings will die at my hand!"',
  bossP3: 'Mr. BBL: "She has shed the shield. Kill her, Majesties. Kill her or kneel."',
  victory: 'Mr. BBL: "It is done. I\'ll draft the sentencing. I understand Rollo has… a proposal."',
};

export const DEATHS = [
  'The castle gates fell at dusk. Minister Plinket gave a very reasonable speech about it.',
  'MAMA hung a banner from CockPower\'s clock tower. The clock stopped. So did Aleforge.',
  'The Kings were last seen at the Gilded Tankard, drinking. The ale was free. Nothing else was.',
  '"Extremism alienates moderate and decent discourse." It also, it turns out, wins.',
  'The Drunken Trials are cancelled indefinitely. The Hall of Ale is a meeting house now. It serves water.',
  'Roto called in the bonds the same afternoon. Aleforge is a very sober town now.',
];

export const PLINKET_P1_LINES = [
  'MINISTER PLINKET: "Your Majesties, I\'ve come to reinforce the line. Strictly as a moderate."',
  'MINISTER PLINKET: "Free trade above all. Your towers look… so very trustworthy."',
  'MINISTER PLINKET: "The Kings did leave Thatcher to die. But they also saved the land. Nuance!"',
];
