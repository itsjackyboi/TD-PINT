# Siege of Aleforge

A Bloons-style tower defense game set in the Pintland Isles. MAMA marches on Aleforge. Hold the keep for 30 waves, with a boss every 10, then keep going in endless **Freeplay**. Your record is the highest wave you reach.

## Running it

It runs in any browser with no build step and no dependencies. ES modules need a local server:

```sh
python3 -m http.server 8080      # then open http://localhost:8080
```

- **`?seed=123`** fixes the run seed. It affects doctrine offers and Freeplay waves; the 30 campaign waves are always the same.
- **`?debug`** adds a tuning panel:
  - +gold/ale/Resolve, invincibility, speed up to 8×
  - jump to any wave, spawn any enemy
  - an autoplay bot
  - per-tower DPS, a leak log, and a 300-enemy stress test

  A game that uses any debug cheat doesn't count toward progress or the leaderboard.
- **`?touch`** forces the phone/tablet controls on a desktop browser.

## The game

**Title screen.**
- Enter your name for the leaderboard.
- Pick **Beginner** or **Experienced**. Beginner pauses the game on a short card the first time you meet a new tower, enemy, trait, hero or road item. Experienced shows no cards. Both modes have the same difficulty.
- The **Notes** scrap in the corner has the rules.
- **Play** leads to map select, then hero select.
- **Tutorial** is a guided 5-wave game. It's offered automatically before your first game.

**Maps.** Enemy waves are the same on every map. Maps differ in road length, build space and water.

| Map | Tier | Layout |
|---|---|---|
| Cumstead Fields | Beginner | One long winding road, lots of room |
| Aleforge Isles | Intermediate | Two roads over the bridges, merging before the castle |
| Shanty Town Docks | Advanced | Short roads, mostly water. Ships shine here |
| The Cloister | Expert | Three gates, a short twisting road, stone walls |

A **Random** card picks one for you.

**Towers.** There are 19 towers, BTD5-style. Each has two upgrade paths of four tiers. One path can go to tier 4; the other then stops at tier 2. Tiers 3–4 need **XP** with that tower, earned by dealing damage with it in any game (XP = damage ÷ 40). Some tier 4s add an activated ability.

| Unlock | Towers |
|---|---|
| From the start | Militia Pikeman, Keg Catapult, Guild Crossbowman, Gilded Tankard Taproom |
| During every game | Bilgrat Bottle Spinner (wave 4), Lighthouse & Customs (wave 8), Hoegaarden Cold Cellar (wave 10) |
| 600 XP with a starter | Sackbeard Hookman (Pikeman), Brewers Lane Still (Taproom), Veilwalker Scout (Crossbow), Jolly Rammer ship (Keg; on water) |
| More XP | Caltrop Smithy (800 Spinner), Barley Farm (1,500 Taproom), Color Guard Garrison (1,500 Pikeman), Alemaster's Mortar (1,500 Keg), Orchenk Repeater (1,500 Crossbow) |
| Long-term milestones | Cloudrunner (survive 400 waves in total), CockPower Clock Tower (beat Susan Plinket), Witch Doctor's Tower (clear 3 maps, or reach Freeplay wave 50) |

**Enemies and traits.** Enemy mechanics are traits, shown as badges above each enemy and explained in the enemy panel. Waves can add traits to any unit as modifiers, e.g. Hidden Zealots or Fortified Widows.

| Trait | What it means | Counter |
|---|---|---|
| Hidden | Can't be targeted without detection | Lighthouse, Scout, Crossbow *Watch Glass*, Pikeman *Sheriff's Badge*, Garrison |
| Armored | Sharp damage does nothing | Explosive, fire, cold or magic damage, or Shred upgrades |
| Regrow | Heals after 1.5 s without being hit | Keep hitting it, or burn it |
| Fortified | Double health | — |
| Splits | Breaks into smaller enemies | Kill it early |
| Shield-Bearer | Shields nearby enemies | Focus it down |
| Sobering | Strips tower buffs; ale towers fire at half speed | Range |
| Saboteur | Disables towers it walks past unseen | Detection |
| Explodes | Disables nearby towers when it dies | Kill it away from your towers |
| Boss | Can't be frozen, stunned or knocked back; slows halved | Big damage |

The bosses:
- **Wave 10:** MAMA War Wagon.
- **Wave 20:** Picket Fortress.
- **Wave 30:** Susan Plinket, in 3 phases.

Freeplay rotates the bosses and keeps compounding health and numbers.

**Heroes.** You take one Liquor King per game and place them like a tower. They level up from 1 to 10 and unlock abilities at levels 3 and 7. Seamus and Buke are available from the start; the others unlock through progress.

| Hero | Level 3 ability | Level 7 ability |
|---|---|---|
| Seamus | Barrel Avalanche | Keg Party |
| Buke | Chug! | Barrel Dive |
| Jagerbauhm | Angel's Barricade | Hallowed Ground |
| Guinnie | Old Grudge | Never Forgets a Face |
| Jack | Read the Ledger | Aggressive Mercantilism |
| JP | Whiskey & Beer | The Great Spill |

**Road items** are Caltrops, Powder Keg and Sticky Ale. They're bought with ale and dropped on the road, up to 3 per wave.

**Economy.**
- **Gold:** comes from kills and from pay at the end of each wave. Unspent gold earns 5% interest, up to a cap.
- **Morale:** each district has a morale meter. Low morale cuts your pay, and under the line insurgents rise inside your defences.
- **Aleforge Bonds:** 150 gold now, repaid later with interest.
- **Doctrines:** every 5 waves you pick one of three trade-offs.
- **Plinket's Mandates:** optional extra-difficulty modifiers, unlocked after a clear.

**Keys:**
- **Towers:** `1`–`0` `-` `=` `Q`–`U`
- **Hero:** `H`
- **Road items:** `C` `V` `N`
- **Upgrades:** `Z` / `X` for the two paths
- **Sell:** `S`
- **Targeting:** `Tab`
- **Abilities:** `J` `K` `L`
- **Bond:** `B`
- **Send wave:** `Space`
- **Pause:** `P`
- **Speed:** `F`
- **Notes:** `?`
- **Cancel:** `Esc`

## Phones and tablets

Touch controls switch on automatically. Landscape works best; portrait works too.

- **Build:** tap a tower (or road item, or the hero) in the bar, tap the map to preview it, then tap again or press ✓.
- **Upgrade or sell:** tap a built tower. The drawer opens with its upgrade paths.
- **Inspect:** tap or long-press an enemy.
- **Zoom:** pinch, or double-tap empty ground. Drag to pan.
- **Panels:** ▤ opens the panels.
- **Auto-pause:** the game pauses when you switch apps.

## Leaderboard

Scores go to a Google Sheet through a small Apps Script web app, ranked by highest wave per map. Setup takes about five minutes; see [tools/leaderboard/SETUP.md](tools/leaderboard/SETUP.md).

Once it's deployed, paste the URL into `src/config.js` (for everyone) or **Settings** (for one browser). Until then, scores stay on each device. Scores that can't be sent are queued and retried.

## Art and sound

Everything comes from Kenney's free **CC0** packs: the Tiny Town, Tiny Dungeon and Tiny Battle sprites, the UI Pack Pixel Adventure frames, Kenney Fonts, and several sound packs. [CREDITS.md](CREDITS.md) lists them all.

- **Where it lives:** `src/ui/sprites.js` is the atlas, and `src/ui/pixelart.js` draws everything, including each map straight from its definition in `src/data/maps.js`.
- **Fallback:** if the art fails to load, a plain renderer takes over.
- **Rebuilding the assets:** `node tools/fetch-assets.mjs && node tools/convert-audio.mjs && node tools/cut-ui.mjs`.

## Balance tooling

```sh
node tools/sim.mjs --map=all --seeds=4                      # every build in tools/builds/ on every map
node tools/sim.mjs tools/builds/veteran.json --freeplay=80  # how far Freeplay goes
node tools/sim.mjs tools/builds/fresh.json --map=shanty --verbose   # per-wave table, damage share, leaks by type
node tools/bench.mjs --tiers="2,0;3,0;0,4" --only=keg,bow   # one tower alone vs a test wave: damage per gold
node tools/browser-test.mjs                                 # desktop Playwright test and screenshots
node tools/mobile-test.mjs                                  # touch test: emulated iPhone (landscape), Pixel (portrait)
node tools/leaderboard/test.mjs                             # Apps Script logic against stubbed Google services
```

The simulator runs the same `World` as the browser, headless, with a scripted bot (`src/core/bot.js`).

**How the bot plays:**
- Each build is a JSON plan: build steps, upgrades that spread across towers or deepen one tower (`"to": 3`), the hero, and road items.
- It reads the next-wave preview and buys Hidden detection or Armored damage when it needs them.
- `--profile=fresh` plays with starter unlocks and tier cap 2; `veteran` plays with everything unlocked.

Results with 4 seeds (bots are a floor, not a ceiling):

| Map | Fresh profile | Veteran profile |
|---|---|---|
| Cumstead (Beginner) | clears 3 of 4 | clears 4 of 4 |
| Aleforge (Intermediate) | clears 2 of 4 | clears 4 of 4 |
| Shanty (Advanced) | reaches Plinket (wave 30) in 3 of 4 | clears 2 of 4 |
| Cloister (Expert) | dies around wave 18 | clears 2 of 4 |
| Freeplay | — | reaches waves 38–50 |

**Where the numbers live:**

| File | What it tunes |
|---|---|
| `src/data/towers.js` | towers and upgrade trees |
| `src/data/enemies.js` | enemies, traits and the `hpMult` health curve |
| `src/data/waves.js` | the 30 campaign waves |
| `src/core/waves.js` | Freeplay generation |
| `src/data/maps.js` | maps, including a per-map `hpScale` |
| `src/core/progress.js` | unlock rules |
| top of `src/core/world.js` | economy constants |

## Layout

```
index.html, style.css
src/config.js   leaderboard URL
src/core/   world.js (the simulation, DOM-free), towers.js (tower behaviours), waves.js, map.js,
            progress.js (profile rules and unlocks), bot.js, spatial.js, rng.js
src/data/   towers, enemies (+ traits), waves, maps, heroes, items, doctrines, mandates
src/ui/     main.js (loop + input), hud.js (panels and bars), screens.js (menus), tips.js (beginner cards),
            tutorial.js, profile.js (localStorage), leaderboard.js, render.js + pixelart.js + sprites.js (art),
            touch.js (gestures), audio.js, debug.js
assets/     Kenney CC0 sprites, UI frames, fonts, audio + licenses/
tools/      sim.mjs, bench.mjs, builds/*.json, browser-test.mjs, mobile-test.mjs, leaderboard/ (Code.gs, SETUP.md, test)
```

**Performance.**
- The simulation runs on a fixed 60 Hz timestep.
- Entities and projectiles are pooled, and a spatial hash handles range queries.
- Auras recompute 4 times a second.
- In the stress test, 300 enemies take about 0.5 ms of simulation and 2.3 ms of drawing per frame.
