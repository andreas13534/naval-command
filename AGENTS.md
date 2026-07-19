# Repository Guidelines

## Project Structure & Module Organization

NAVAL COMMAND is a framework-free browser game with a dependency-free Node.js multiplayer server. `index.html` defines the application screens. Browser JavaScript lives in `js/`; `server.js` serves static files and the HTTP/SSE API; and `server/` contains authoritative lobby and match rules. Styling is split between `css/styles.css`, `css/mobile-device.css`, and focused overrides. Store production images and audio under `assets/`. Logic tests are in `tests/`.

## Build, Test, and Development Commands

There is no package install or build step. Start the multiplayer-capable development server with:

```powershell
npm start
```

Then visit `http://localhost:8080`. Run the complete test suite with `npm test`. Before submitting changes, also run:

```powershell
node --check js/config.js
node --check js/game.js
node --check js/ui.js
node --check server.js
```

Run `node --check` for every JavaScript file you changed.

## Coding Style & Naming Conventions

Use two-space indentation, semicolons, single-quoted JavaScript strings, and strict mode inside the existing IIFE modules. Prefer `const`, descriptive camelCase functions, PascalCase classes, and kebab-case IDs such as `prometheus-last-revenge`. Keep game rules independent of the DOM; UI feedback belongs in `ui.js`. Register animations through the existing registry instead of hard-coding unrelated branches. When browser assets change, bump their cache-query value in `index.html`.

## Testing Guidelines

Tests use Node’s built-in `node:assert/strict`; no external framework is required. Name focused cases `testFeatureBehavior` and invoke them near the end of the test file. Cover successful actions, invalid targets, point spending, turn transitions, victory state, and animation registration. Visually verify desktop and 393×852 mobile layouts for UI or animation changes.

## Commit & Pull Request Guidelines

No usable Git history is currently available, so use concise imperative commits with a scope, for example `fix(layout): keep desktop grids visible`. Pull requests should explain player-visible behavior, list tests run, identify affected commanders or abilities, and include before/after screenshots for layout or animation work. Keep unrelated asset and gameplay changes separate.

## Security & Configuration

Do not commit secrets or machine-specific paths. Client settings use browser-local storage only; preserve that behavior and avoid adding remote dependencies without discussion.
