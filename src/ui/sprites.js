// Sprite atlas over Kenney's CC0 "Tiny" sheets (16×16, packed, no margins).
// Everything is drawn with nearest-neighbour scaling. Tinted variants are baked
// once into offscreen canvases (ctx.filter isn't reliable on Safari).
const asset = (p) => new URL(`../../assets/${p}`, import.meta.url).href;
const SHEETS = {
  town: { src: asset('sprites/tiny-town.png'), cols: 12 },
  dungeon: { src: asset('sprites/tiny-dungeon.png'), cols: 12 },
  battle: { src: asset('sprites/tiny-battle.png'), cols: 18 },
};
export const PX = 16;

// name -> [sheet, index]
export const ATLAS = {
  // terrain
  grass: ['town', 0], grass2: ['town', 1], grassFlower: ['town', 2],
  dirt: ['town', 25], dirt2: ['town', 40], dirt3: ['town', 41],
  cobble: ['town', 43],
  water: ['battle', 37],
  shoreTL: ['battle', 18], shoreT: ['battle', 19], shoreTR: ['battle', 20],
  shoreL: ['battle', 36], shoreR: ['battle', 38],
  shoreBL: ['battle', 54], shoreB: ['battle', 55], shoreBR: ['battle', 56],
  // nature & props
  treePine: ['town', 16], treeRound: ['town', 4], treeAutumn: ['town', 3], treeSmall: ['town', 28], treeAutumnSmall: ['town', 27],
  bush: ['town', 5], mushrooms: ['town', 29], sprout: ['town', 17],
  fenceH: ['town', 81], fencePost: ['town', 47], sign: ['town', 83], tavernSign: ['town', 57],
  beehive: ['town', 94], coin: ['town', 93], target: ['town', 95], well: ['town', 104], bomb: ['town', 105],
  log: ['town', 106], barrel: ['town', 130], bucket: ['town', 131], pot: ['town', 107],
  pickaxe: ['town', 115], pitchfork: ['town', 116], key: ['town', 117], bow: ['town', 118], arrow: ['town', 119],
  axe: ['town', 127], hammer: ['town', 128], sickle: ['town', 129],
  // buildings (town)
  roofSlateL: ['town', 48], roofSlate: ['town', 49], roofSlateR: ['town', 50], chimneySlate: ['town', 51],
  roofSlateGableL: ['town', 60], roofSlateGable: ['town', 63],
  roofRedL: ['town', 52], roofRed: ['town', 53], roofRedR: ['town', 54], chimneyRed: ['town', 55],
  roofRedGable: ['town', 67], roofRedLow: ['town', 64],
  wallWoodL: ['town', 72], wallWood: ['town', 73], wallWoodDoor: ['town', 74], wallWoodR: ['town', 75],
  wallStoneL: ['town', 76], wallStone: ['town', 77], wallStoneDoor: ['town', 78], wallStoneR: ['town', 79],
  winWood: ['town', 84], doorWood: ['town', 85], doorWood2: ['town', 86], doorWood3: ['town', 87],
  winStone: ['town', 88], doorStone: ['town', 89],
  castleTL: ['town', 96], castleT: ['town', 97], castleTR: ['town', 98],
  castleL: ['town', 108], castleC: ['town', 109], castleR: ['town', 110],
  castleBL: ['town', 120], castleB: ['town', 121], castleBR: ['town', 122],
  battlementL: ['town', 99], battlement: ['town', 100], battlementR: ['town', 101], battlementEnd: ['town', 102],
  towerWindow: ['town', 103],
  gateTL: ['town', 111], gateTR: ['town', 112], archTL: ['town', 113], archTR: ['town', 114],
  gateBL: ['town', 123], gateBR: ['town', 124], wallDoor: ['town', 125], wallBrick: ['town', 126],
  // flags (battle)
  flagRed: ['battle', 70], flagOrange: ['battle', 88], flagBlue: ['battle', 52], flagGreen: ['battle', 34], flagGrey: ['battle', 16],
  heart: ['battle', 195], lock: ['battle', 193],
  // characters (dungeon)
  wizard: ['dungeon', 84], villager: ['dungeon', 85], baldman: ['dungeon', 86], viking: ['dungeon', 87], redhead: ['dungeon', 88],
  knight: ['dungeon', 96], knightVisor: ['dungeon', 97], youth: ['dungeon', 98], woman: ['dungeon', 99], matron: ['dungeon', 100],
  slime: ['dungeon', 108], brute: ['dungeon', 109], devil: ['dungeon', 110], hooded: ['dungeon', 111], ranger: ['dungeon', 112],
  bat: ['dungeon', 120], ghost: ['dungeon', 121], spider: ['dungeon', 122], rat: ['dungeon', 123],
  // items (dungeon)
  chest: ['dungeon', 89], chestOpen: ['dungeon', 90], crate: ['dungeon', 73], anvil: ['dungeon', 74],
  potionGrey: ['dungeon', 113], potionGreen: ['dungeon', 114], potionRed: ['dungeon', 115], potionBlue: ['dungeon', 116],
  vialGreen: ['dungeon', 126], vialRed: ['dungeon', 127], vialBlue: ['dungeon', 128],
  sword: ['dungeon', 104], dagger: ['dungeon', 103], hammerBig: ['dungeon', 117], axeBig: ['dungeon', 118], staff: ['dungeon', 129],
  shield: ['dungeon', 102], ring: ['dungeon', 101], brazier: ['dungeon', 7], torch: ['dungeon', 29],
};

class SpriteBank {
  constructor() {
    this.img = {};
    this.ready = false;
    this.failed = false;
    this.cache = new Map();
  }

  load() {
    if (this.promise) return this.promise;
    this.promise = Promise.all(Object.entries(SHEETS).map(([k, s]) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => { this.img[k] = im; res(); };
      im.onerror = () => rej(new Error(`sprite sheet failed: ${s.src}`));
      im.src = s.src;
    }))).then(() => { this.ready = true; }, (e) => { this.failed = true; console.warn(e.message, '— using the geometric fallback renderer'); });
    return this.promise;
  }

  rect(name) {
    const a = ATLAS[name];
    if (!a) throw new Error(`unknown sprite ${name}`);
    const cols = SHEETS[a[0]].cols;
    return { im: this.img[a[0]], sx: (a[1] % cols) * PX, sy: Math.floor(a[1] / cols) * PX };
  }

  // draw sprite with its top-left at (x, y), w×h world units
  draw(g, name, x, y, w = PX, h = PX, flip = false) {
    const r = this.rect(name);
    if (flip) {
      g.save(); g.translate(x + w, y); g.scale(-1, 1);
      g.drawImage(r.im, r.sx, r.sy, PX, PX, 0, 0, w, h);
      g.restore();
    } else g.drawImage(r.im, r.sx, r.sy, PX, PX, x, y, w, h);
  }

  // A baked 16×16 canvas of the sprite with a colour mapped over it.
  //   mode 'tint': multiply-ish recolour keeping shading (amount 0..1)
  //   mode 'solid': silhouette in the colour (hit flash, shadows)
  variant(name, color, amount = 0.6, mode = 'tint') {
    const key = `${name}|${color}|${amount}|${mode}`;
    let c = this.cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = PX; c.height = PX;
    const g = c.getContext('2d');
    const r = this.rect(name);
    g.drawImage(r.im, r.sx, r.sy, PX, PX, 0, 0, PX, PX);
    const d = g.getImageData(0, 0, PX, PX);
    const [cr, cg, cb] = hex(color);
    for (let i = 0; i < d.data.length; i += 4) {
      if (!d.data[i + 3]) continue;
      if (mode === 'solid') { d.data[i] = cr; d.data[i + 1] = cg; d.data[i + 2] = cb; continue; }
      const lum = (d.data[i] * 0.3 + d.data[i + 1] * 0.59 + d.data[i + 2] * 0.11) / 255;
      // keep the dark outline intact so sprites stay readable
      if (lum < 0.18) continue;
      d.data[i] = d.data[i] * (1 - amount) + cr * lum * 1.25 * amount;
      d.data[i + 1] = d.data[i + 1] * (1 - amount) + cg * lum * 1.25 * amount;
      d.data[i + 2] = d.data[i + 2] * (1 - amount) + cb * lum * 1.25 * amount;
    }
    g.putImageData(d, 0, 0);
    this.cache.set(key, c);
    return c;
  }

  drawVariant(g, name, color, amount, mode, x, y, w, h, flip) {
    const c = this.variant(name, color, amount, mode);
    if (flip) {
      g.save(); g.translate(x + w, y); g.scale(-1, 1);
      g.drawImage(c, 0, 0, PX, PX, 0, 0, w, h);
      g.restore();
    } else g.drawImage(c, 0, 0, PX, PX, x, y, w, h);
  }

  // data-URL of a sprite scaled up, for DOM icons (build bar, King portraits)
  dataURL(name, scale = 3, tint) {
    const key = `url|${name}|${scale}|${tint || ''}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const c = document.createElement('canvas');
    c.width = PX * scale; c.height = PX * scale;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (tint) g.drawImage(this.variant(name, tint[0], tint[1]), 0, 0, c.width, c.height);
    else this.draw(g, name, 0, 0, c.width, c.height);
    const url = c.toDataURL();
    this.cache.set(key, url);
    return url;
  }
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const sprites = new SpriteBank();
