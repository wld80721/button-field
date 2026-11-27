# Button Field progress

## Handoff · 2026-11-27

The latest shipped gameplay commit is `d476c42`. GitHub Pages publishes the standalone root `index.html` from `main`. Boss Arenas are the proposed next expansion. Start with the [development plan](DEVELOPMENT_PLAN.md) and [project rules](AGENTS.md).

## Shipped

- **Core and foundation.** Red-button income, treasure chests, reward wheel, Workshop, skill tree, passive income and Auto Chest, and Ascension. Five regional fields have their own scenery, gear, and effects. The Guide previews nearby unlocks.
- **Equipment.** Forge ranks, salvage and material recipes, regional and crafted set bonuses, Mythic and Celestial evolution, comparison, filters, item locking, and configurable Auto Equip and Auto Salvage.
- **Field activities.** Farming and mining unlock at 600 and 2,500 run earnings. Crops and ore feed the Forge. Fifteen companions work in the field, gain XP, train, evolve, and use artifacts. Three expeditions finish offline and require a manual claim.
- **Combat.** The Boss Board unlocks at 5,000 run earnings. Ten optional bosses use timed warnings and Guard. Presses still earn normal rewards. Gear, skills, and active pets affect combat. Trophies and best times survive Ascension. Combat gear and unclaimed rewards reset.

## Technical handoff

- Edit `src/` and run `npm run build` to regenerate the root `index.html`. The output embeds CSS, scripts, art, and synthesized sound.
- Use the existing progression selectors and shared resource ledger. Run earnings are separate from spendable coins. Combat rules are in `src/js/combat.js`, boss definitions in `boss-data.js`, and presentation in `combat-view.js`. Continue using the existing field, sites, and companion rules.
- Save schema **5** uses the existing `treasure-grove-v3` storage key. Local migration preserves the raw save in an exportable backup and pauses autosave if backup fails. Resumed combat has no offline damage. Keep saved IDs stable and define reset and carry-over rules for every new system.

## Verification

- **Current standalone:** `npm run check:build` and `npm test` passed. The gameplay suite has **35 unit tests**. All **36 offline Chromium checks** passed, covering migration, saves, desktop and mobile controls, reduced motion, reward claims, and effects under rapid input. The published HTML matched the local build.
- **Balance:** With seeded gear at unlock and 2.5 presses/sec, Mossguard took **10.1 seconds** and the final three fights took **26.5–31.7 seconds**. The baseline comparison with the companion release measured zero linear inventory scans and zero stable HUD mutations in both builds.
- **Playtest:** In seeded walkthroughs, planted and harvested Glowleaf on mobile, mined copper and crafted with it on desktop, claimed a Grove Trail expedition, and defeated the late-game Astral Orrery. Inspected screenshots of the growing crop, copper vein, recipe screen, active expedition, and Orrery fight and victory.
- **Coverage gaps:** Managed Chromium blocked direct `file://` loading with `ERR_BLOCKED_BY_ADMINISTRATOR`. Offline play was verified by routing the standalone document in an offline browser context. Browser checks used Chromium with emulated mobile. Physical devices, Safari, and Firefox remain untested in this pass.

## Known issues

Farm growth and mining damage read largely as numbers. Forge crafting uses dropdowns, and expeditions are countdowns. Bosses have distinct rules, but steady tapping and Guard can win the Orrery while the field barely reacts. These are the priority redesigns. General offline coin earnings and the other long-term backlog items remain open.
