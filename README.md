# Siege of Aleforge

A punishing, permadeath tower defense game set in the Pintland Isles. It retells the MAMA uprising from the Stewards of Aleforge storyline. Susan Plinket, publicly the Minister of Foreign Relations and secretly "J.R.", marches MAMA on the Liquor Kings' castle. The Aleforge Militia is "only strong enough to deter small groups."

The game has one difficulty, and it is hard. There are no continues.

## Running it

It runs in any browser with no build step and no dependencies. ES modules need a local server:

```sh
python3 -m http.server 8080      # then open http://localhost:8080
```

- `?seed=123` fixes the run seed. Wave compositions never change; the seed only varies doctrine offers and which letters are forged.
- `?debug` adds the tuning panel: speed up to 8x, extra gold/ale/Resolve, invincibility, jump to any wave, spawn any enemy, an autoplay bot, per-tower DPS over the last 10s, a leak log, a 300-enemy stress test, and an FPS/frame-time readout. A run that uses any debug cheat isn't recorded in the Ledger.

## Art and sound

The pixel art, UI frames, fonts and sound effects all come from Kenney's free **CC0** packs: Tiny Town, Tiny Dungeon, Tiny Battle, UI Pack Pixel Adventure, Kenney Fonts, and several sound packs. They're committed under `assets/`, and [CREDITS.md](CREDITS.md) lists every pack and its licence.

- **Rebuild the assets:** `node tools/fetch-assets.mjs && node tools/convert-audio.mjs && node tools/cut-ui.mjs`
- **Sprite reference:** open `/tools/atlas.html` from a local server to see every named sprite.
- **Code:** `src/ui/sprites.js` is the atlas, and `src/ui/pixelart.js` draws the map, towers, enemies and effects. If the art fails to load, the game falls back to the plain geometric renderer. Presentation is fully separate from the simulation.
- **Sound:** toggle it with the Sound button or `M`.

## Playing on a phone or tablet

Touch controls switch on automatically on phones and tablets (mobile Safari and Chrome). To force them on a desktop browser, add `?touch` to the URL. Landscape works best; portrait works too.

- **Build:** tap a tower in the build bar, tap open land to preview it with its range, then tap the same spot again (or press ✓) to build.
- **Upgrade or sell:** tap a built tower. Its panel opens with the upgrade, targeting and sell buttons.
- **Inspect an enemy:** tap it or long-press it.
- **Zoom:** pinch, or double-tap empty ground. Drag with one finger to pan. ⤢ resets the view.
- **Panels:** ☰ opens the drawer with the Tower, Kings, Bonds, Letter and Log tabs. In portrait the panels sit below the map instead.
- **Jagerbauhm's barricade:** tap the road to preview it, then ✓.
- **Fullscreen:** "Add to Home Screen" launches it fullscreen. On Android Chrome the ⛶ button also works.
- **Auto-pause:** the siege pauses when you lock the phone or switch apps.

## How it plays

- **Resolve (20):** your life total. It never regenerates. Most leaks cost 1–3. If Plinket reaches the keep, the run is over.
- **Gold:** comes from kills and a payout after each wave:
  - tithes, scaled by the average district morale
  - 5% interest on banked gold, capped
  - Magic Spring taprooms
- **Ale:** builds the Taproom and Still towers and pays for Liquor King abilities.
- **Aleforge Bonds:** +150 gold now, repaid 5 waves later. The interest rate rises by 15% with every bond you issue. If you can't repay, you default and every district loses 40 morale.
- **District morale:** four districts, each with its own meter. Pamphleteers walking through, leaks, and Bootleg ClockHeart all drain it. Below 30%, insurgent cells spawn *inside* your defenses. This follows the canon: Plinket "will organize any revolts if morale drops below 30% in any sector."
- **Intercepted J.R. letters:** each previews the next wave. From wave 10 on, about a third are forgeries. Genuine letters are signed "J.R." with the dots. Jack Anqoak can authenticate them.
- **Doctrines:** after waves 5, 10, 15, 20 and 25 you pick one policy from three. Each one is a trade-off.
- **Boss, wave 30 — Susan Plinket:**
  - **Minister (phase 1):** untargetable. She buffs your towers and secretly marks them.
  - **J.R. Unmasked (phase 2):** she has a shield. Marked towers turn against you and she summons insurgents.
  - **MAMA (phase 3):** she moves faster and calls in True Believers.

| Towers | Enemies |
|---|---|
| Militia Pikeline (Color Guard / Sheriff's Deputies) | Zealot Rusher |
| Keg Catapult (Alemaster's Mortar / Rolling Barrels) | Temperance Matron: sobers towers |
| Gilded Tankard Taproom (Wepple's Stout / Magic Spring) | Picket Line: shields allies |
| Brewers Lane Still (Firewater / Bootleg ClockHeart) | True Believer: elite, cleanses |
| Mining Guild Crossbows (Deep Delvers / Craftsmen's Ballista) | Infiltrator: invisible, sabotages towers |
| Lighthouse & Customs (Customs Seizure / Beacon) | Pamphleteer: drains morale |
| CockPower Clock Tower (Tick / Tock), unlocked in the Ledger | Martyr: disables towers on death |
| | Cave Widow: splits into Orphans |
| | Rump's Bagman: steals gold if he leaks |

**Liquor King abilities.** You choose two per run:
- Seamus: Barrel Avalanche
- Buke: Chug!
- Jagerbauhm: Angel's Barricade
- Guinnie: Old Grudge
- Jack: Read the Ledger
- JP: Whiskey & Beer

**Keys:**
- `1`–`7` build
- `Z` / `X` upgrade a branch
- `S` sell
- `T` change targeting
- `Q` / `W` use a King
- `B` issue a bond
- `Space` send or call the next wave
- `P` pause (you can build while paused)
- `F` change speed
- `Esc` cancel
- `H` help

**The Ledger (meta-progression).** Milestones unlock *sidegrades*: more Kings, the Clock Tower, and extra doctrines. They add options, never flat power. Beating Plinket unlocks **Plinket's Mandates**, stackable heat modifiers such as Amnesty Deal, Owe Block Riots and Wheat Blight.

## Balance tooling

```sh
node tools/sim.mjs                              # every build in tools/builds/, one seed, per-wave table
node tools/sim.mjs --seeds=8                    # spread across seeds
node tools/sim.mjs tools/builds/balanced.json --mandates=zeal,oweBlock --unlock-all
node tools/browser-test.mjs                     # desktop Playwright smoke test and screenshots (needs `playwright`)
node tools/mobile-test.mjs                      # touch test: emulated iPhone 13 (landscape) and Pixel 7 (portrait)
```

The simulator runs the same `World` as the browser, headless, with a scripted bot (`src/core/bot.js`). Each build is a JSON policy: an ordered build/upgrade plan, a gold reserve, which waves to issue bonds on, and doctrine preferences.

Current results, 8 seeds per build:

| Build | Target | Result |
|---|---|---|
| `balanced` (competent) | clear with a few Resolve left | wins about half; winners finish with 1–12 Resolve; losses on wave 17 or 27 |
| `greedy` (interest and bonds) | die mid-game | dies on wave 15 |
| `turtle` (no upgrades or economy) | stall mid-game | dies on waves 15–18 |

The bot plays a fixed script and never adapts, so treat its results as a floor, not a ceiling.

**Tuning knobs:** all numbers live in `src/data/*.js`:
- tower stats and upgrade trees: `towers.js`
- enemy stats and the `hpMult` HP curve: `enemies.js`
- the 30 fixed waves: `waves.js`
- doctrines, mandates and Kings: their own files

Economy constants are at the top of `src/core/world.js`.

## Layout

```
index.html, style.css
src/core/   world.js (the whole simulation, DOM-free), map.js, spatial.js, rng.js, bot.js
src/data/   towers, enemies, waves, doctrines, mandates, kings, lore
src/ui/     main.js (loop + input), touch.js (gestures), render.js (canvas + camera), pixelart.js + sprites.js (art),
            audio.js (SFX), hud.js, screens.js, meta.js (Ledger), debug.js
assets/     sprites, ui frames, fonts, audio (Kenney CC0) + licenses/
tools/      fetch-assets.mjs, convert-audio.mjs, cut-ui.mjs, atlas.html
tools/      sim.mjs, browser-test.mjs, builds/*.json
```

**Performance:** the simulation uses a fixed 60 Hz timestep. Entities and projectiles are pooled, a uniform-grid spatial hash handles range queries, and auras recompute 4 times a second. The stress test runs 340+ enemies at about 0.2 ms simulation and 0.5 ms drawing per frame.

## Lore

Lore is taken from the Master Lore Compendium and the Hoegaarden Hall of Records: the J.R.↔MAMA letters, Plinket's talking points, Mr. BBL's GDC, the Bond market, the guilds, Old Aleforge Municipal and CockPower's clock. In canon, MAMA's assault on the Kings failed and Plinket was sentenced to be Rollo's permanent girlfriend. The victory screen follows that ending.
