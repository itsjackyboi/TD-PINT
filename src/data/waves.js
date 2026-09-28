// Campaign waves 1–30 (the same on every map; longer roads make a map easier).
// group: [type, count, gap seconds, start delay seconds, lane, modifiers?]
//   lane: '*' alternates over the map's lanes, or a lane index (wraps if the map has fewer)
//   modifiers: array of MODIFIERS keys, e.g. ['hidden'] or ['fortified', 'regrow']
// Traits are introduced one at a time; bosses arrive every 10 waves.
export const WAVES = [
  /* 1 */ [['zealot', 12, 0.9, 0, '*']],
  /* 2 */ [['zealot', 16, 0.7, 0, '*']],
  /* 3 */ [['zealot', 12, 0.7, 0, '*'], ['pamphleteer', 3, 2, 6, 1]],
  /* 4 */ [['matron', 2, 3, 0, 0], ['zealot', 16, 0.55, 2, '*']],
  /* 5 */ [['picket', 4, 2.5, 0, 1], ['zealot', 18, 0.5, 4, '*']],
  /* 6 */ [['widow', 3, 2.6, 0, '*'], ['zealot', 14, 0.6, 3, 1], ['martyr', 4, 1, 8, 0]],
  /* 7 */ [['revivalist', 4, 2, 0, '*'], ['martyr', 6, 0.9, 5, 0], ['pamphleteer', 4, 1.5, 7, 1]],
  /* 8 */ [['believer', 2, 3, 0, 0], ['picket', 4, 2, 1, 1], ['zealot', 22, 0.4, 3, '*']],
  /* 9 */ [['infiltrator', 5, 1.8, 0, '*'], ['widow', 4, 2, 3, '*'], ['matron', 3, 2.5, 6, 0]],
  /* 10 */ [['warwagon', 1, 0, 0, 0], ['zealot', 24, 0.4, 3, '*'], ['martyr', 6, 0.8, 8, 1]],
  /* 11 */ [['widow', 6, 1.8, 0, '*'], ['matron', 4, 2, 2, '*'], ['zealot', 16, 0.4, 8, '*', ['hidden']]],
  /* 12 */ [['believer', 3, 4, 0, 0], ['picket', 6, 2, 0, 1], ['infiltrator', 8, 1, 5, '*']],
  /* 13 */ [['zealot', 42, 0.22, 0, '*'], ['martyr', 10, 0.6, 5, '*'], ['revivalist', 4, 1.5, 9, '*']],
  /* 14 */ [['pamphleteer', 12, 0.9, 0, '*'], ['matron', 5, 2, 1, '*'], ['widow', 6, 1.5, 6, 0, ['fortified']]],
  /* 15 */ [['believer', 3, 3.5, 0, '*'], ['picket', 6, 1.8, 0, 0], ['bagman', 1, 0, 8, 1], ['zealot', 20, 0.35, 10, '*', ['hidden']]],
  /* 16 */ [['infiltrator', 14, 0.8, 0, '*'], ['martyr', 12, 0.6, 4, '*'], ['revivalist', 6, 1.2, 6, '*', ['fortified']]],
  /* 17 */ [['widow', 12, 1.2, 0, '*'], ['matron', 6, 1.8, 3, '*'], ['zealot', 30, 0.3, 8, '*', ['regrow']]],
  /* 18 */ [['believer', 6, 2.5, 0, '*'], ['picket', 10, 1.4, 0, '*', ['armored']], ['pamphleteer', 10, 1, 6, '*']],
  /* 19 */ [['martyr', 20, 0.5, 0, '*'], ['infiltrator', 12, 0.9, 3, '*'], ['matron', 6, 1.5, 5, 0], ['revivalist', 8, 1, 7, '*', ['hidden']]],
  /* 20 */ [['fortress', 1, 0, 0, 0], ['believer', 6, 2, 3, '*'], ['zealot', 40, 0.2, 6, '*']],
  /* 21 */ [['widow', 12, 1.2, 0, '*'], ['picket', 10, 1.3, 4, '*'], ['matron', 6, 1.6, 6, '*'], ['widow', 4, 2, 12, '*', ['fortified']]],
  /* 22 */ [['pamphleteer', 18, 0.7, 0, '*'], ['infiltrator', 16, 0.7, 3, '*'], ['martyr', 16, 0.5, 6, '*'], ['bagman', 1, 0, 9, 0]],
  /* 23 */ [['believer', 10, 1.8, 0, '*'], ['matron', 8, 1.5, 0, '*'], ['zealot', 40, 0.25, 5, '*', ['hidden', 'regrow']]],
  /* 24 */ [['widow', 20, 0.9, 0, '*'], ['martyr', 20, 0.5, 4, '*'], ['picket', 14, 1, 8, '*'], ['revivalist', 10, 0.8, 10, '*', ['fortified']]],
  /* 25 */ [['bagman', 3, 5, 0, '*'], ['believer', 12, 1.5, 2, '*'], ['infiltrator', 20, 0.6, 6, '*', ['fortified']]],
  /* 26 */ [['zealot', 80, 0.12, 0, '*'], ['matron', 10, 1.2, 3, '*'], ['martyr', 24, 0.4, 6, '*']],
  /* 27 */ [['believer', 12, 1.6, 0, '*', ['hidden']], ['picket', 16, 1, 0, '*'], ['pamphleteer', 20, 0.6, 4, '*']],
  /* 28 */ [['widow', 24, 0.8, 0, '*'], ['infiltrator', 24, 0.5, 3, '*'], ['matron', 12, 1, 6, '*'], ['revivalist', 12, 0.7, 8, '*', ['fortified', 'regrow']]],
  /* 29 */ [['believer', 20, 1.2, 0, '*'], ['martyr', 30, 0.4, 3, '*'], ['zealot', 60, 0.15, 6, '*', ['hidden']], ['matron', 12, 1, 8, '*']],
  /* 30 */ [['plinket', 1, 0, 0, 0], ['zealot', 30, 0.4, 4, '*'], ['picket', 10, 1.5, 10, '*'], ['matron', 6, 2, 16, '*']],
];
export const CAMPAIGN_WAVES = WAVES.length;
export const BOSS_TYPES = ['warwagon', 'fortress', 'plinket'];
