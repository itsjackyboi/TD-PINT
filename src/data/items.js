// Road items (BTD5-style consumables), bought with ALE and dropped on the road.
export const ITEMS = {
  caltrops: { name: 'Caltrops', ale: 8, color: '#b0b0b0', desc: 'A pile on the road: the next 20 enemies to cross take 15 sharp damage.', hits: 20, dmg: 15, dtype: 'sharp', radius: 16, life: 60 },
  powderkeg: { name: 'Powder Keg', ale: 18, color: '#b0643a', desc: 'Explodes when an enemy reaches it: 200 explosive damage in a wide radius.', dmg: 200, dtype: 'explosive', radius: 18, blast: 70, life: 60 },
  stickyale: { name: 'Sticky Ale', ale: 12, color: '#e0b93c', desc: 'A 12-second puddle that slows everything on it by 60%.', slow: 0.6, radius: 42, life: 12 },
};
export const ITEM_ORDER = ['caltrops', 'powderkeg', 'stickyale'];
export const ITEMS_PER_WAVE = 3;
