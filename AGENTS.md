# Button Field development standards

These standards apply to every major gameplay phase and to redesigns of existing systems.

## One red button, many interconnected games

- Give players one obvious action when they start the game. Pressing the red button gradually reveals new places and activities through changes in the field, such as a growing trail, an arriving companion, or an opening gate.
- Give each destination its own way to play and a clear way back to the field. Use the field and its interactive objects as the main route between activities. Menus support setup, reference, and management.
- Design connections in both directions. An existing activity should help players discover or prepare for the new one, and the new activity should reward something that changes what players can do elsewhere. Use rewards that open new interactions, tools, and routes.
- Playtest from a fresh save. Discover an activity from the field, learn its core action, earn a reward, and use it in another part of the game. Check that the red button remains useful throughout.

## Design the expansion first

- Inspect the current game and the systems the expansion will connect to. Identify which recent features fall short of these standards and schedule their redesign one phase at a time.
- Before implementing a major expansion, show the user what the experience will look like, what the player will do moment to moment, which decisions and discoveries will matter, and what changes from early to late progression.
- Define a complete playable loop and a clear visual direction for the phase. A new menu entry, statistics panel, or upgrade list alone does not constitute an expansion.

## Build a playable world

- Give each major system a large, dedicated, visually distinct play space. Use original pixel-art environments, interactive objects, sprites, icons, animations, and effects. Let interacting with the scene drive play. Use text and controls for instructions, accessibility, and precise feedback.
- Show progress in the world through visible changes, new spaces, and new interactions. Keep palettes, pixel scale, typography, and motion consistent with Button Field while giving each system its own identity.
- Introduce new ways to play through choices, discoveries, challenges, and rewards. Connect the new loop to existing systems and unlock new experiences as players progress.
- Preserve the central red button, field identity, chest animations, sound, existing mechanics, and save compatibility. Back up the current build and representative saves before major changes. Obtain the user's permission for changes outside the announced redesign scope.

## Playtest before release

- Ship complete experiences with final art and interaction. Technical correctness is one part of the release check alongside depth, readability, pacing, and enjoyment.
- Play the actual browser build from the first unlock through a developed state and a late-game state. Inspect screenshots at desktop and mobile sizes, including active gameplay, rewards, and visible progression changes. Check touch, keyboard, and reduced motion.
- Verify old save migration, save and reload, economy, performance, and JavaScript errors. Record concrete observations and resolve issues before marking the phase complete. Complete and test one expansion before beginning the next.
