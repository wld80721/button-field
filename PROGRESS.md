# Button Field progress

## Handoff · 2026-11-27

The latest shipped gameplay commit is `b78f443` (The Living Field). GitHub Pages publishes the standalone root `index.html` from `main`. Boss Arenas remains at the proposal stage and follows this expansion. Resume from the [development plan](DEVELOPMENT_PLAN.md) and [project rules](AGENTS.md).

## Shipped

- **Core and foundation.** Red-button income, treasure chests, reward wheel, Workshop, skill tree, passive income and Auto Chest, and Ascension. Five regional fields have their own scenery, gear, and effects. The Guide previews nearby unlocks.
- **Equipment.** Forge ranks, salvage and material recipes, regional and crafted set bonuses, Mythic and Celestial evolution, comparison, filters, item locking, and configurable Auto Equip and Auto Salvage.
- **Field activities.** Farming and mining unlock at 600 and 2,500 run earnings. Crops and ore feed the Forge. Fifteen companions work in the field, gain XP, train, evolve, and use artifacts. Three expeditions finish offline and require a manual claim.
- **Combat.** The Boss Board unlocks at 5,000 run earnings. Ten optional bosses use timed warnings and Guard. Presses still earn normal rewards. Gear, skills, and active pets affect combat. Trophies and best times survive Ascension. Combat gear and unclaimed rewards reset.

## Technical handoff

- Edit `src/` and run `npm run build` to regenerate the root `index.html`. The output embeds CSS, scripts, art, and synthesized sound.
- Use the existing progression selectors and shared resource ledger. Run earnings are separate from spendable coins. Combat rules are in `src/js/combat.js`, boss definitions in `boss-data.js`, and presentation in `combat-view.js`. Continue using the existing field, sites, and companion rules.
- The combat release used schema **5** under `treasure-grove-v3`. The Living Field uses schema **6** with the same key and saves only the three new discovery IDs. Local migration preserves the raw save in an exportable backup and pauses autosave if backup fails. Resumed combat has no offline damage. Keep saved IDs stable and define reset and carry-over rules for every new system.

## The Living Field · release verification

- Grasslands landmarks and scenery derive from existing run milestones. Local scenes share existing screens and actions. The trade gate and the return route use the existing world travel rules.
- The three discoveries add one scrap, one Glowleaf, and one Copper Ore respectively. Keepsakes survive Ascension. The materials reset with the existing resource balances.
- The shipped HTML and representative saves were backed up before implementation. Schema 5 migrates with a byte-exact backup and autosave protection. Local scenes and environmental animations do not add another gameplay clock.
- The standalone build check, all **36 unit tests**, and all **41 offline Chromium checks** passed. The shipped baseline comparison showed zero linear bag scans and zero stable HUD mutations in both builds.
- Played from a fresh save through the Workshop purchase, then used seeded midgame and advanced saves to exercise garden growth and harvest, mining, crafting, boss entry and reload, travel with populated chest fields, and Ascension. Inspected early, middle, and advanced screenshots at 1280 × 800 and 390 × 844. Also exercised touch at 320 × 568 and 844 × 390, keyboard return focus, reduced motion, and hidden-tab pausing.
- The managed browser blocked direct `file://` loading with `ERR_BLOCKED_BY_ADMINISTRATOR`. The standalone HTML passed through an offline Chromium context with no external assets. Physical devices, Safari, and Firefox were outside this test pass.

## Published baseline verification

- **Current standalone:** `npm run check:build` and all **35 unit tests** passed on the handoff checkout. The published HTML matched the local build byte for byte.
- **Browser regression:** All **36 offline Chromium checks** passed on this gameplay build. They cover migration, saves, desktop and emulated mobile controls, reduced motion, reward claims, and effects under rapid input. See [how to rerun the suite](tests/README.md#combat-release-baseline).
- **Balance:** With seeded gear at unlock and 2.5 presses/sec, Mossguard took **10.1 seconds** and the final three fights took **26.5–31.7 seconds**. The baseline comparison with the companion release measured zero linear inventory scans and zero stable HUD mutations in both builds.
- **Playtest:** In seeded walkthroughs, planted and harvested Glowleaf on mobile, mined copper and crafted with it on desktop, claimed a Grove Trail expedition, and defeated the late-game Astral Orrery. Inspected screenshots of the growing crop, copper vein, recipe screen, active expedition, and Orrery fight and victory.
- **Coverage gaps:** Managed Chromium blocked direct `file://` loading with `ERR_BLOCKED_BY_ADMINISTRATOR`. Offline play was verified by routing the standalone document in an offline browser context. Browser checks used Chromium with emulated mobile. Physical devices, Safari, and Firefox remain untested in this pass.

## Known issues

The Living Field gives farm growth and mining damage visible changes. The later Farming and Mining phase will deepen their interactions. Forge crafting still uses dropdowns, and expeditions are countdowns. Bosses have distinct rules, but steady tapping and Guard can win the Orrery while the field barely reacts. These are the priority redesigns. General offline coin earnings and the other long-term backlog items remain open.
