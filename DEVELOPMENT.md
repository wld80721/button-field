# Button Field · Treasure Grove

Keep the extracted folder together. Open `index.html` in a browser that allows local pages. To play over HTTP, run `python3 -m http.server 8765` inside the extracted folder and visit `http://localhost:8765`.

## Continue an existing save

Existing saves load automatically when both versions share the same browser storage. If you move to a new URL, browser, or device, open **Save & settings** in the original game and select **Export**. Copy the code, paste it into **Save & settings** in this version, and select **Import**.

## Build and extend the game

Install development dependencies with `npm ci`, then run `npm run build`. Commit the resulting root `index.html` alongside source changes. The release file is self-contained and GitHub Pages serves it from `main` at the repository root. `npm run check:build` verifies that the committed file matches the source.

- **Content.** `src/js/data.js` holds chapters, milestone values, gear slots, rarities, and upgrades. `world-data.js` gives each field a stable ID and defines its scenery, unlock threshold, and gear. Add a field there, then add any distinct rules to `gameplay.js` and matching equipment effects to `gear.js`. World travel, progression, and save initialization all read the catalog.
- **Rules and resources.** `gameplay.js`, `gear.js`, and `prestige.js` take a run and return action outcomes. The controller translates these into sound, effects, and saves. New resources belong in the registry in `resources.js`, which supplies defaults, normalizes imported balances, and handles gains and spending. Keep any persisted resource, equipment, or prestige IDs stable.
- **Progression and saves.** `progression.js` provides selectors for existing gates and the next milestone previews. Future systems can own a rule module and add a gate there. Add minimal persisted state in the model and explicit compatibility handling in `saves.js` when new mechanics need it. Keep presentation state in the UI. A new prestige rule should explicitly define which run resources reset and which lifetime records carry over.
- **Verification.** `npm test` runs fast rule tests. `npm run test:browser` runs the standalone page in Chromium with networking disabled. See [browser test instructions](tests/README.md) for Chromium configuration and baseline comparison.

Older exports remain supported. The first migration keeps an unmodified local copy, available in **Save & settings** as **Export pre-foundation backup**. If a local save cannot be read or backed up, the game pauses autosave to protect it.

## Worlds

Open **Worlds** in the dock to travel. Unlocks use coins earned during the current run, so spending coins leaves your unlocks available. Chests and bonus charge stay in their own field while you travel. The reward wheel follows you, and Auto Chest opens chests in the field you’re visiting.

| Field           | Coins earned this run | Field bonus                                                                                                                      |
| --------------- | --------------------: | -------------------------------------------------------------------------------------------------------------------------------- |
| Grasslands      |                     0 | Every 25 presses guarantees a chest when there’s room.                                                                           |
| Desert          |                10,000 | Every 12th press pays 4× coins. Desert gear adds 0.5× per equipped piece.                                                        |
| Frozen Lands    |                50,000 | Every 10 presses grants 5 seconds of automatic income. Frozen gear adds one second per piece.                                    |
| Volcano         |               250,000 | Opening a chest doubles the next 8 presses in Volcano. Volcano gear adds two presses per piece.                                  |
| Celestial Realm |             1,000,000 | After 20 presses, the next chest from pressing gains a rarity tier. Two Celestial pieces raise it by two tiers, up to Legendary. |

Each field has 20 gear designs. The collection and gear bag have world filters. Gear keeps its usual slot stat in every world and grants its field bonus in its home world. Existing items, chests, and discoveries belong to Grasslands when loaded from an older save. Ascension starts the next run in Grasslands and resets world unlocks, bonuses, and field chests.

## Equipment forge

Open **Gear → Forge** on an item after earning 150 coins in the current run. Each of its three ranks adds 12% of the original stat. Manual salvage still pays the original coins and now yields 1–5 scrap depending on rarity. Equipped items are protected. Forge ranks do not increase the salvage reward. The forge and scrap reset on Ascension.

Open **Equipped world sets** in Gear to see the two- and four-piece thresholds. Set bonuses apply in the matching field. Any rarity and forge rank count as one piece. See all bonuses in the **Worlds** menu.

The first time this version loads an older local save, it keeps a pre-forge copy when browser storage is available. Use **Save & settings → Export pre-forge backup** to copy it.

## Development roadmap

### Current build audit

- **Core loop.** The red button earns coins and rolls chests. The first chest is guaranteed by press 8 if one hasn’t landed. Four equipment slots affect tap income, passive income, or chest odds. Chests drop five rarities, and equipped gear is protected from manual salvage.
- **Worlds.** The five fields currently unlock at 0, 10K, 50K, 250K, and 1M run earnings. Terrain, local chest queues, 100 collection entries, and field-specific bonuses are already in place. Chest placement and the reward wheel share the same drop rules and capacity checks.
- **Progression.** Ten chapter thresholds and four coin upgrades drive runs. The shard tree has 12 purchasable skills plus its starting node. Auto Chest opens local chests while the field is visible. The milestone wheel advances every 50 presses after the last claim. Ascension offers six permanent upgrades and resets run gear, worlds, skills, and wheel progress.
- **Persistence and presentation.** Saves use the `treasure-grove-v3` browser key with JSON import and export. Passive coin income currently runs while the game is open. CSS and canvas render the field and chest effects, and Web Audio generates the existing sounds with a persistent mute toggle. There are no external runtime dependencies.
- **Economy risk.** Gear duplicates have tended to become bag clutter. Run earnings and spendable coins are separate, so buying upgrades should never relock content. Multiplicative prestige bonuses already stack quickly. Review the interaction of new prestige layers and loadouts before increasing global multipliers.

### Phases and release checks

| Phase                           | Work                                                                                                                                                                     | Release check                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1 · Worlds                      | **Already shipped.** Keep the five fields, regional gear, travel, and mechanics.                                                                                         | Recheck travel, terrain, world unlocks, and original-to-current save migration.                                                          |
| 2 · Equipment                   | **Already shipped.** Added a forge, salvage materials, and two- and four-piece world sets.                                                                               | Verify the cost curve, no salvage refunds on forge upgrades, all five set effects, and older saves.                                      |
| 3 · Return and buy              | Add offline coin income with a visible cap. Start tuning at 4 hours at 50% of the last saved passive rate. Add Buy 1, 10, 100, and MAX to the coin Workshop.             | Test missing timestamps, clock changes, capped absence, repeated reloads, and bulk purchases against single-buy math.                    |
| 4 · Automation                  | Add opt-in Auto Equip with a choice of priorities and a way to protect a loadout. Add configurable Auto Salvage by rarity, world, and duplicate status.                  | Protect equipped and explicitly kept items, show what rules do before enabling them, and test conflicts with set bonuses and Auto Chest. |
| 5 · Collection and achievements | Expand the existing 100-entry collection into an equipment book. Add achievements for discoveries, worlds, builds, and prestige.                                         | Check migrated discoveries, one-time rewards, and which records survive each prestige layer.                                             |
| 6 · Pets                        | Add in-game companions with distinct passives that support active, idle, and treasure builds. Make players choose which passive to use.                                  | Compare each pet’s niche at the same investment and test unlocks, swapping, and prestige behavior.                                       |
| 7 · Ascension constellation     | Expand the six existing permanent upgrades into at least 50 distinct purchasable nodes across active income, automation, treasure, worlds, and companions.               | Map the six current upgrades to compatible nodes. Verify prerequisites, valid paths, costs, and multiple builds with similar investment. |
| 8 · Transcendence               | Add a later prestige layer that unlocks new play options and makes its reset boundaries explicit.                                                                        | Simulate several Ascensions, ensure the first Transcendence is reachable, and verify exactly which records and unlocks carry forward.    |
| 9 · Challenges                  | Add optional runs with different rules, clear objectives, and a safe way to exit back to the main save.                                                                  | Test completion and abandonment, ensure rewards are earned once, and check that no optional run blocks normal progress.                  |
| 10 · Presentation and stats     | Expand sound effects, optional ambient music, and pixel particles and animations. Add detailed run and lifetime statistics, effect density settings, and audio controls. | Check reduced motion, mute and music preferences, mobile layouts, and frame pacing with full fields and bags.                            |

Before each phase, archive the working build and keep representative saves from early, mid, and late game. Run browser checks for new actions, JavaScript errors, save/export/import, and affected older features. Compare an active, idle, and treasure-focused route at similar investment before shipping an economy change. Lucky drops can speed up progress, but deterministic milestones and crafting must keep typical runs moving. Review time to the first useful item, the first Ascension, and the reason to revisit each field after each release.

## Equipment expansion

**Gear → Set recipes** opens at 2,500 coins earned this run. You can craft any of 16 Rare pieces for 800 coins, 10 scrap, and 4 shards each. Hammerhand opens chests through presses, Clockwork makes chests from active-field passive time, Forager yields crafting materials, and Pathfinder boosts eligible drops. A signature piece grants its ability, and matching two- and four-piece bonuses work in every field. Ordinary regional sets keep their home-field bonuses.

Use **Forge** on Rare or better equipment to see its evolution path. Evolution requires Forge rank 3 and carries forward the item's identity, build, lock, and rank. Mythic and Celestial are evolution tiers. Chests still roll the original five rarities.

Gear includes a comparison control, inventory filters, item locks, and **Loot automation**. Auto Equip and Auto Salvage start off and affect incoming chest gear. The strongest-stat mode can break a set. Use the default build-protection mode to keep matching gear together. Settings can export the pre-expansion save backup. Ascension carries loot preferences into the next run.
