// Map definitions. All maps share the 32×18 tile grid (TILE = 40px).
// Everything is land unless carved out by `water`; `land` rects can re-add
// ground on top of water (islands, piers). Coordinates are in tiles, rects are
// [x0, y0, x1, y1) (end-exclusive).
//
// paths:     base lanes (ids A, B, C…) as waypoint polylines, spawn → keep
// extraPath: the lane the Owe Block Riots mandate opens (optional)
// districts: morale regions; `node` is where insurgents rise, on `nodePath`
// blocked:   land that can't take towers (landmark buildings)
// islets:    decorative land in water (never buildable, never ship water)
// keep:      the castle tiles (unbuildable); the road ends inside it
export const MAPS = {
  cumstead: {
    id: 'cumstead', name: 'Cumstead Fields', tier: 'Beginner', tierN: 1, keepName: 'Aleforge Keep',
    desc: 'One long road winding through barley fields. Plenty of room to build.',
    water: [[13, 0, 15, 18], [20, 7, 23, 11]],
    land: [],
    paths: {
      A: [[-1, 2], [11, 2], [11, 6], [3, 6], [3, 11], [11, 11], [11, 15], [18, 15], [18, 4], [25, 4], [25, 13], [31, 13]],
    },
    extraPath: { id: 'C', pts: [[16, 18], [16, 17], [18, 17], [18, 4], [25, 4], [25, 13], [31, 13]] },
    districts: [
      { name: 'West Fields', rect: [0, 0, 13, 18], node: [7, 6], nodePath: 'A' },
      { name: 'Barley Rows', rect: [15, 0, 24, 18], node: [18, 9], nodePath: 'A' },
      { name: 'Castle Hill', rect: [24, 0, 32, 18], node: [25, 8], nodePath: 'A' },
    ],
    keep: { x: 30, y: 12, w: 2, h: 3 },
    blocked: [{ rect: [0, 14, 3, 18], landmark: 'farmhouse' }, { rect: [27, 0, 30, 3], landmark: 'windmill' }, { rect: [15, 7, 17, 9], landmark: 'barn' }],
    islets: [],
    grade: '#efe0cc',
  },

  aleforge: {
    id: 'aleforge', name: 'Aleforge Isles', tier: 'Intermediate', tierN: 2, keepName: 'Aleforge Castle',
    desc: 'The island capital. Two roads over the bridges merge before the castle.',
    water: [[0, 0, 32, 18]],
    land: [[0, 0, 11, 8], [0, 10, 12, 18], [14, 2, 23, 13], [25, 0, 32, 18]],
    paths: {
      A: [[3, -1], [3, 3], [10, 3], [10, 7], [16, 7], [16, 9], [22, 9], [22, 4], [27, 4], [27, 14], [31, 14]],
      B: [[-1, 15], [7, 15], [7, 12], [15, 12], [15, 9], [16, 9], [22, 9], [22, 4], [27, 4], [27, 14], [31, 14]],
    },
    extraPath: { id: 'C', pts: [[20, 18], [20, 11], [22, 11], [22, 9], [22, 4], [27, 4], [27, 14], [31, 14]] },
    districts: [
      { name: 'Brewers Lane', rect: [0, 0, 11, 8], node: [7, 3], nodePath: 'A' },
      { name: 'Aleforge Bazaar', rect: [0, 10, 12, 18], node: [4, 15], nodePath: 'B' },
      { name: 'Tankard Square', rect: [14, 2, 23, 13], node: [19, 9], nodePath: 'A' },
      { name: 'Castle Hill', rect: [25, 0, 32, 18], node: [27, 9], nodePath: 'A' },
    ],
    keep: { x: 30, y: 13, w: 2, h: 3 },
    blocked: [],
    islets: [
      { rect: [13, 14, 17, 17], landmark: 'tankard' },
      { rect: [18, 15, 19, 17], landmark: 'clock' },
      { rect: [22, 14, 24, 17], landmark: 'lighthouse' },
      { rect: [12, 0, 19, 1], landmark: 'docks' },
    ],
    grade: '#e4d6ea',
  },

  shanty: {
    id: 'shanty', name: 'Shanty Town Docks', tier: 'Advanced', tierN: 3, hpScale: 0.65, keepName: "Sackbeard's Tavern",
    desc: 'Short roads along the piers and open harbour everywhere. Ships rule here; land is scarce.',
    water: [[0, 0, 32, 18]],
    land: [[0, 2, 16, 5], [0, 12, 16, 15], [14, 2, 20, 15], [24, 5, 32, 13]],
    paths: {
      A: [[-1, 3], [17, 3], [17, 9], [31, 9]],
      B: [[-1, 13], [17, 13], [17, 9], [31, 9]],
    },
    extraPath: { id: 'C', pts: [[24, -1], [24, 1], [22, 1], [22, 9], [31, 9]] },
    districts: [
      { name: 'North Pier', rect: [0, 2, 14, 5], node: [8, 3], nodePath: 'A' },
      { name: 'Grog Row', rect: [0, 12, 14, 15], node: [8, 13], nodePath: 'B' },
      { name: 'The Wharf', rect: [14, 2, 20, 15], node: [17, 7], nodePath: 'A' },
      { name: 'Tavern Isle', rect: [24, 5, 32, 13], node: [26, 9], nodePath: 'A' },
    ],
    keep: { x: 30, y: 8, w: 2, h: 3 },
    blocked: [],
    islets: [
      { rect: [5, 7, 8, 9], landmark: 'shipwreck' },
      { rect: [26, 15, 29, 17], landmark: 'docks' },
      { rect: [26, 1, 28, 3], landmark: 'lighthouse' },
    ],
    grade: '#d8dcea',
  },

  cloister: {
    id: 'cloister', name: 'The Cloister', tier: 'Expert', tierN: 4, hpScale: 0.95, keepName: 'The Reliquary',
    desc: 'Three gates, one short twisting road, and stone walls everywhere you want to build.',
    water: [[21, 6, 24, 13]],
    land: [],
    paths: {
      A: [[8, -1], [8, 4], [12, 4], [12, 9], [16, 9], [16, 5], [20, 5], [20, 14], [25, 14], [25, 9], [29, 9]],
      B: [[-1, 9], [12, 9], [16, 9], [16, 5], [20, 5], [20, 14], [25, 14], [25, 9], [29, 9]],
      C: [[8, 18], [8, 14], [12, 14], [12, 9], [16, 9], [16, 5], [20, 5], [20, 14], [25, 14], [25, 9], [29, 9]],
    },
    extraPath: null,
    districts: [
      { name: 'Cloister Gate', rect: [0, 0, 13, 18], node: [10, 9], nodePath: 'B' },
      { name: 'Courtyard', rect: [13, 0, 27, 18], node: [18, 5], nodePath: 'A' },
      { name: 'Reliquary', rect: [27, 0, 32, 18], node: [25, 11], nodePath: 'A' },
    ],
    keep: { x: 28, y: 8, w: 2, h: 3 },
    blocked: [
      { rect: [0, 0, 6, 6], landmark: 'wall' }, { rect: [14, 0, 20, 3], landmark: 'wall' }, { rect: [27, 0, 32, 5], landmark: 'wall' },
      { rect: [0, 12, 6, 18], landmark: 'wall' }, { rect: [27, 13, 32, 18], landmark: 'wall' }, { rect: [13, 16, 20, 18], landmark: 'wall' },
      { rect: [3, 7, 5, 8], landmark: 'pillar' }, { rect: [3, 10, 5, 11], landmark: 'pillar' }, { rect: [14, 12, 16, 14], landmark: 'pillar' },
    ],
    islets: [{ rect: [22, 9, 23, 10], landmark: 'fountain' }],
    grade: '#ddd6d0',
  },
};

export const MAP_ORDER = ['cumstead', 'aleforge', 'shanty', 'cloister'];
