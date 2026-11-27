# Button Field · Treasure Grove

Open the standalone `index.html` in a browser that permits local pages, or play via GitHub Pages. For the current roadmap and release status, see [Development plan](DEVELOPMENT_PLAN.md) and [Progress](PROGRESS.md).

## Continue an existing save

Existing saves load automatically when both versions share the same browser storage. If you move to a new URL, browser, or device, open **Save & settings** in the original game and select **Export**. Copy the code, paste it into **Save & settings** in this version, and select **Import**.

## Build and extend the game

Install development dependencies with `npm ci`, then run `npm run build`. Commit the resulting root `index.html` alongside source changes. The release file is self-contained and GitHub Pages serves it from `main` at the repository root. `npm run check:build` verifies that the committed file matches the source.

- **Content.** `src/js/data.js` holds chapters, milestone values, gear slots, rarities, and upgrades. `world-data.js` gives each field a stable ID and defines its scenery, unlock threshold, and gear. Add a field there, then add any distinct rules to `gameplay.js` and matching equipment effects to `gear.js`. World travel, progression, and save initialization all read the catalog.
- **Rules and resources.** `gameplay.js`, `gear.js`, and `prestige.js` take a run and return action outcomes. The controller translates these into sound, effects, and saves. New resources belong in the registry in `resources.js`, which supplies defaults, normalizes imported balances, and handles gains and spending. Keep any persisted resource, equipment, or prestige IDs stable.
- **Progression and saves.** `progression.js` provides selectors for existing gates and the next milestone previews. Future systems can own a rule module and add a gate there. Add minimal persisted state in the model and explicit compatibility handling in `saves.js` when new mechanics need it. Keep presentation state in the UI. A new prestige rule should explicitly define which run resources reset and which lifetime records carry over.
- **Verification.** `npm test` runs fast rule tests. `npm run test:browser` runs the standalone page in Chromium with networking disabled. See [browser test instructions](tests/README.md) for Chromium configuration and baseline comparison.

Older exports remain supported. The first migration keeps an unmodified local copy, available in **Save & settings** as the corresponding backup export, such as **Export pre-combat backup**. If a local save cannot be read or backed up, the game pauses autosave to protect it.

## The Living Field

Grasslands landmarks share the milestones in `progression.js` and the activity screens used by the dock. `field-view.js` owns the scene, landmark routing, and transitions. `field-art.js` draws the standalone pixel sprites. Add future local entrances to the scene registry and provide a route into the activity and back to the field. Use the existing world catalog and travel handler for regional destinations.

Schema 6 stores the IDs of claimed field discoveries. The locations, scenery, and construction are derived from the current run. Original saves remain exportable through **Save & settings**.

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

## Equipment expansion

**Gear → Set recipes** opens at 2,500 coins earned this run. You can craft any of 16 Rare pieces for 800 coins, 10 scrap, and 4 shards each. Hammerhand opens chests through presses, Clockwork makes chests from active-field passive time, Forager yields crafting materials, and Pathfinder boosts eligible drops. A signature piece grants its ability, and matching two- and four-piece bonuses work in every field. Ordinary regional sets keep their home-field bonuses.

Use **Forge** on Rare or better equipment to see its evolution path. Evolution requires Forge rank 3 and carries forward the item's identity, build, lock, and rank. Mythic and Celestial are evolution tiers. Chests still roll the original five rarities.

Gear includes a comparison control, inventory filters, item locks, and **Loot automation**. Auto Equip and Auto Salvage start off and affect incoming chest gear. The strongest-stat mode can break a set. Use the default build-protection mode to keep matching gear together. Settings can export the pre-expansion save backup. Ascension carries loot preferences into the next run.

## Farming and Mining

The two sites appear just below the playfield at 600 and 2,500 coins earned in the run. Each red-button press advances growing plants and recovering deposits by one second. The sites also progress on the visible page, including in menus. Travel preserves them and Ascension resets them.

Glowleaf boosts the next three growth presses, Ironroot advances mineral recovery, and Prismbloom saves an extra crystal for the next crystal vein. Research adds a plot, shortens new growth, or harvests ripe crops automatically. Mining upgrades improve damage or automate one selected deposit. Neither upgrade spends materials automatically on planting.

The Forge offers material payment buttons alongside the standard set recipes and rank upgrades. Existing equipment and evolution costs remain compatible. Settings can export the original save from before its first Farming and Mining migration.

## Companions and expeditions

**Companions** opens at 150 coins earned this run. Fifteen pets join when their roster requirements are met. Choose one field companion at first, then two at 50,000. Pets work on the visible field and earn XP when they complete an action. The field cooldown is saved through recall and reload. The red button, chest loot, gardening, and mining use their existing rules with pet actions alongside them.

At level 4, a pet at home can train as a Field Hand or Scout. At level 5 and 10,000 run earnings, it can evolve for 1,500 coins, eight shards, and three Root Fiber. The three expedition routes unlock through earnings, mining tools, and pet levels. Trips begin at 2,500 run earnings and a second slot opens at 250,000. Trips continue while the game is closed. Claim finished trips to receive materials, XP, and a first-clear artifact.

Ascension retains pets, XP, training, evolution, and artifacts. It clears assignments, expedition rewards, and field timers. The first local migration to schema 4 keeps the original save as a backup that players can export from **Save & settings**.

## Combat and field bosses

The **Boss Board** opens at 5,000 coins earned in the run. Each world has two optional fights. The second requires its local first boss and a higher earnings milestone in the current run. Combat presses also keep earning coins, rolling chests, progressing the wheel, and advancing field sites.

Read attack warnings and use **Guard** or **G** before the hit resolves. A successful Guard blocks the attack and empowers the next strike. The Boss Board previews the contribution of gear, Workshop reinforcement, skills, and assigned pets. Vanguard rewards aggressive combos, Wardweaver rewards Guard, and Starbound helps break through armor. Combat uses the loadout at the start of the fight.

Each first win earns a permanent trophy. The first win of each run also queues one equipment piece to claim from the Boss Board when there is room in the bag. Gear claims start locked. Fight timing pauses in menus and while the tab is hidden. Saving and reloading keeps the in-flight fight. Travel or Ascension ends it after confirmation. Ascension retains trophies, wins, and best times and resets combat gear and pending claims. Settings can export the original local save from before migration to schema 5.
