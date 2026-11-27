# Button Field development standards

These requirements apply to every major expansion and to redesigns of existing systems. Button Field grows from a simple incremental button game into a large, interconnected world with distinct gameplay experiences.

## One red button, many interconnected games

- Give players one obvious action when they start the game. Pressing the red button gradually reveals new places and activities through changes in the field, such as a growing trail, an arriving companion, or an opening gate.
- Give each destination its own way to play and a clear way back to the field. Use the field and its interactive objects as the main route between activities. Menus support setup, reference, and management.
- Design connections in both directions. An existing activity should help players discover or prepare for the new one, and the new activity should reward something that changes what players can do elsewhere. Use rewards that open new interactions, tools, and routes.
- Playtest from a fresh save. Discover an activity from the field, learn its core action, earn a reward, and use it in another part of the game. Check that the red button remains useful throughout.

## Design the expansion first

- Read [PROGRESS.md](PROGRESS.md) and [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) before starting a phase. Update them with implementation status, test results, and remaining work.
- Inspect the current game and the systems the expansion will connect to. Identify which recent features fall short of these standards and schedule their redesign one phase at a time.
- Before implementing each expansion, describe its visual layout, gameplay loop, progression, player interactions, and connections to existing systems. Explain what the player does moment to moment and how that changes from early to late progression.
- Treat each major expansion as a substantial game update. A small tab, text panel, statistics display, or upgrade list alone is insufficient for a major gameplay system.

## Build a playable world

- Give each major system a dedicated interactive environment that occupies most of the playable area. Use original pixel-art graphics, objects, sprites, icons, animations, particles, and sound effects. Let interacting with the scene drive play. Use text and controls for instructions, accessibility, and precise feedback.
- Make progression visibly transform the world through changes to the scene, new spaces, and new interactions. Keep palettes, pixel scale, typography, and motion consistent across Button Field while giving each system its own identity.
- Give every major system new player actions, decisions, challenges, and rewards. Prioritize depth before expanding the feature count. Introduce new mechanics gradually so new players have time to learn each one.
- Preserve the central red button, field identity, chest animations, sound, existing mechanics, and save compatibility. Back up the current build and representative saves before major changes. Obtain the user's permission for changes outside the announced redesign scope.

## Keep the game maintainable and portable

- Inspect existing systems first and reuse their rules, data, and interfaces. Keep changes focused and avoid duplicated systems and unnecessary codebase rewrites.
- Keep the game optimized, compatible with GitHub Pages, and playable offline as a standalone build. Verify that animations, particles, and new gameplay remain responsive as the field and saves grow.

## Playtest before release

- Require polished, meaningful gameplay as well as working code. Ship complete mechanics, final art, and a purpose-built interface. Assess depth, readability, pacing, and enjoyment during playtesting.
- After implementation, play the actual browser build from the first unlock through a developed state and a late-game state. Inspect screenshots of the new environments at desktop and mobile sizes, including active gameplay, rewards, and visible progression changes. Check touch, keyboard, and reduced motion.
- Verify old save migration, save and reload, economy, performance, and JavaScript errors. Record concrete observations and resolve issues before marking the phase complete. Complete and test one expansion before beginning the next.
- Report what was tested and identify any tests that could not be performed, including the reason.

## Changelog and approval

- Maintain [CHANGELOG.md](CHANGELOG.md). Record player-facing changes and save or compatibility notes as part of each update. Keep pending changes under Unreleased until they ship.
- Prepare major updates on a separate branch for review. Push completed, verified Button Field updates to GitHub by default. The owner has given standing approval to merge verified updates into `main` when they ask to push or publish an update. Verify the GitHub Pages deployment after publishing.
