# Button Field development plan

## Direction

Start with one red button. As the field changes, paths and interactive objects lead to distinct playable spaces. Each space introduces its own actions and rewards that open options elsewhere. Keep the home field, central button, existing mechanics, and old saves playable throughout. [AGENTS.md](AGENTS.md) defines the expansion and approval requirements.

## Expansion 1 · The Living Field

**Status** · Released on `main`. Grasslands grows from a clearing into a settlement. Branching paths and illustrated landmarks open Workshop, Forge, companions, Farming, the skill tree, Mining, and the Boss Board at existing milestones. The trade gate connects to the four established regions. Three hidden finds award small, one-time material bundles and leave permanent decorations.

Local scenes use the shipped activity rules. The dedicated redesigns below will deepen the activities. See [Progress](PROGRESS.md) for verification and coverage.

## Next expansion after The Living Field · Boss Arenas

**Status** · Arena redesign proposed. The ten existing field bosses are live.

- **Discovery and layout.** At the existing 5,000 run-earnings gate, reveal a trail to Mossguard's clearing. Give fights most of the playable area, with a large boss sprite, visible lanes, readable attack cues, and an easy-to-reach red button. Use distinct terrain in each of the five worlds.
- **Play and progression.** Press the red button to attack, tap a lane or use arrow keys to move, and use Guard to hold ground and counter. Start with Mossguard breaking a marked lane. Later, Magma Weaver sends consecutive waves through lava channels and the Astral Orrery asks the player to align exposed rings while safe tiles shift.
- **Connections.** Open first-clear loot in the arena and display trophies back in the field. Prototype Mossguard opening a trail to an extra garden bed whose crop can feed a Forge tool for breaking armor in later fights. Keep existing routes into farming and the other systems available. Preserve the ten bosses, earned trophies and items, gear effects, normal press rewards, and optional combat.
- **Release check.** Back up the current build and representative saves. Play from a fresh save through discovery, the first fight, a midgame arena, the late-game Orrery, and use of a reward outside combat. Inspect desktop and mobile screenshots during attacks, victories, and visible field changes. Verify touch, keyboard, reduced motion, reload and migration, economy, and performance. Report any coverage gaps.

Start the expansion on a separate branch from the documented `main`. The first implementation slice is the entrance and a complete Mossguard fight, including movement, Guard, the reward, and the return to the field. Playtest that loop before extending it to the remaining arenas. Update [PROGRESS.md](PROGRESS.md) and the [changelog](CHANGELOG.md) with actual outcomes and follow the release instructions in [AGENTS.md](AGENTS.md).

## Later phases

1. **Farming and Mining.** Turn the plot and deposit screens into connected playable spaces. Grow and harvest visible crops and let players expose and extract veins. Reuse the existing crop effects, research, materials, and automation.
2. **Companion camp and expeditions.** Build a physical camp and route map with choices to make along expeditions. Keep the 15 companions, roles, progression, and offline trip timers.
3. **Forge.** Build an interactive workbench around material, recipe, and tempering decisions. Keep existing gear, set abilities, prices, and forge ranks compatible.

Revisit the wider backlog after the current systems feel like places to play. It includes capped offline coin income, Buy 1/10/100/MAX, achievements and a richer collection book, a 50-plus-upgrade Ascension tree, Transcendence, challenge runs, ambient music, detailed statistics, and performance settings. Scope and test each phase independently.
