# Goo

A liquid snake game. The snake is a single blob of goo: it melts around corners, bulges as it swallows, and splats when it bites itself. Edges wrap around, so only your own tail can stop you.

Pick a viscosity before each game. Each one keeps its own best score.

| Viscosity | Speed | |
|---|---|---|
| Honey | 210 ms per move | Slow and thick |
| Syrup | 145 ms per move | A steady ooze |
| Water | 105 ms, down to 68 ms | Gets faster with every drop |

## Play

Steer with the arrow keys or WASD, or swipe anywhere on a phone. Space, Escape or P pauses.

## Run locally

There is no build step. Serve the folder over HTTP (service workers and ES modules don't run from `file://`):

```sh
npm start              # npx serve on http://localhost:5173
# or
python -m http.server 5173
```

## Test

The game rules in `js/game.js` are pure and tested with Node's built-in runner (no dependencies):

```sh
npm test
```

Open the game with `?debug` to get `window.goo.game` in the console.

## Install as an app

Goo is a Progressive Web App. Once it is served over HTTPS (or from localhost), Chromium browsers show an **Install app** link on the start screen; on iOS use Share › Add to Home Screen. After the first visit it works offline.

When you change any file listed in `sw.js`, bump `VERSION` there so installed copies pick up the update.

## Layout

```
index.html            page, SVG goo filter, screens
css/styles.css        tokens (light + dark), layout, motion
js/main.js            screens, game loop, wiring
js/game.js            rules: movement, wrapping, collisions, food, speed
js/autopilot.js       self-driving snake shown behind the start screen
js/renderer.js        canvas drawing: interpolation, goo body, eyes, droplets
js/input.js           keyboard and swipe
js/audio.js           synthesised sound effects and vibration
js/storage.js         best scores and settings in localStorage
sw.js                 offline cache
```

## Credits

[Fredoka](https://fonts.google.com/specimen/Fredoka) by Milena Brandão, under the SIL Open Font License 1.1, bundled in `fonts/` for offline use.
