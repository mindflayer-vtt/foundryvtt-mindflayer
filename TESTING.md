# Pre-migration regression guide

## Test architecture and commands

`test/helpers/foundry.js` is the shared Foundry contract fake. It resets hooks,
settings, users, canvas, notifications, libWrapper registrations, and other
globals before every Vitest case. Unit tests cover pure or mostly-pure behavior;
integration tests cross module boundaries up to the fake Foundry API.

- `npm test`: all hardware-free and Foundry-free regression tests
- `npm run test:unit`: unit and existing utility characterization tests
- `npm run test:integration`: module integration and Socket tests
- `npm run test:coverage`: V8 text and HTML coverage (no vanity threshold)
- `npm run lint`: correctness-oriented ESLint flat configuration
- `npm run check`: lint, ordinary tests, and webpack build
- `npm run test:foundry`: opt-in real-runtime Playwright smoke test

The real-runtime suite skips cleanly unless `FOUNDRY_URL` is set. Point it at a
running, licensed, disposable Foundry installation. Optional variables are
`FOUNDRY_TEST_WORLD`, `FOUNDRY_TEST_USER`, and `FOUNDRY_TEST_PASSWORD`. Foundry
and browser binaries are never downloaded by the ordinary test or CI path.

### Local Foundry 12 smoke instance

The local Compose setup uses `ghcr.io/felddy/foundryvtt:12.331`, the exact
Foundry release declared as verified in `src/module.tmpl.json`. It bind-mounts
the production build into Foundry's module directory and keeps all disposable
Foundry state under the ignored `.foundry-test-data/` directory.

1. Copy `.env.example` to `.env` and fill in either `FOUNDRY_RELEASE_URL` or
   `FOUNDRY_USERNAME` and `FOUNDRY_PASSWORD`. The former is a time-limited
   Node.js download URL from the Foundry licenses page; the latter are the
   credentials for an account with a Foundry license.
2. Install the browser once with `npx playwright install chromium` (or
   `npx playwright install --with-deps chromium` on a minimal Linux host).
3. On the first run, start the setup screen without auto-launching the not-yet
   created world using `FOUNDRY_TEST_WORLD= npm run test:foundry:up`, then open
   `http://127.0.0.1:30000`. Create the world whose id is
   `FOUNDRY_TEST_WORLD`, set the Gamemaster access key to
   `FOUNDRY_TEST_PASSWORD`, install and enable `lib-wrapper`, `socketlib`, and
   `Mind Flayer - Token Controller`, and activate a scene.
4. Run `npm run test:foundry:local` for subsequent smoke runs. It builds the
   module, starts and waits for the Foundry container, runs Playwright, and
   stops the container even when the smoke test fails. Use
   `npm run test:foundry:up` and `npm run test:foundry:down` when debugging and
   you want to control the server lifetime yourself.

To discard the instance completely, run
`npm run test:foundry:down` and remove `.foundry-test-data/`. The directory is
deliberately not removed by the npm script because it contains the activated
Foundry license. Do not run multiple instances using the same license.

## Foundry API inventory

The exact call sites remain searchable with:

```sh
rg -n 'Hooks\.|game\.|canvas\.|ui\.|foundry\.|CONFIG|FormApplication|Application|PIXI|libWrapper' src/js
```

Current boundaries are:

- lifecycle: `Hooks.once(init|ready)`, `Hooks.on/off(startCombat|updateCombat|updateScene|canvasPan)`;
- state/services: `game.settings.get/set/register/registerMenu`, `game.modules.get`,
  `game.users`, `game.user` flags/role, `game.i18n`, `game.socket`, `game.keybindings`,
  `game.combat`, `game.scenes`, and `game.canvas`;
- canvas/documents: `canvas.tokens.placeables/controlled/moveMany`, token actor
  ownership, token refresh/update/document update/light-source initialization,
  `canvas.walls.doors`, door-control `_onMouseDown`, `canvas.animatePan`, scene/grid
  dimensions, active-layer release, stage/controls/app renderer;
- UI/framework: `ui.notifications`, `FormApplication`, `Application`, jQuery,
  `foundry.utils.debounce/mergeObject/isNewerVersion`, PIXI containers, graphics,
  text, points, rectangles, transforms, and `FederatedMouseEvent`;
- wrappers: the machine-checked list is in
  `test/fixtures/libwrapper-boundaries.json`, including registration conditions
  and whether current code unregisters each target.

Private Foundry methods are deliberately inventoried, not removed. The real
smoke suite resolves critical targets in a running Foundry runtime.

## Characterized uncertainties and intentional fixes

Protocol helper extraction is byte-semantics preserving relative to the prior
inline objects: receiver registration, controller LED configuration, and table
LED messages retain their known keys and values. The fixture is the known wire
contract.

Two production lifecycle bugs were fixed because they defeated the safety net:
selective reload now calls `ready()` on recreated instances (the old loader
passed descriptors), and removal of a throwing ControllerManager tick listener
no longer skips the next healthy listener. JSDoc-only runtime imports were
removed to break accidental circular coupling without changing behavior.

Known/suspicious current behavior intentionally retained:

- Socket malformed JSON escapes `_onmessage`; handler exceptions are isolated.
- Socket reconnect uses an untracked five-second timeout. The loaded-state guard
  prevents reconnection after normal asynchronous close-on-unhook.
- several libWrapper registrations have module-lifetime rather than explicit
  cleanup, as recorded in the inventory;
- camera padding is six grid squares and center clamping can dominate the raw
  bounding-box center on small scenes;
- torch code contains three historical Foundry API branches and preserves their
  differing animation/alpha payloads.

## Physical-table regression checklist

This checklist is manual and was not executed while building this baseline.

- Server/connection: Beamer connects; server restart reconnects; keypad
  connect/disconnect/reconnect works; multiple keypads work concurrently.
- DM configuration: bind keypad/player and selected token; change Socket,
  ControllerManager, and feature configuration; verify intended selective
  reloads need no page reload and repeated changes create no duplicates.
- Keypad: movement, press, hold/repeat, simultaneous input, LEDs, and independent
  multiple players.
- Camera: one/several players, moving apart/together, smooth pan/zoom, map edges,
  combat, controlled tokens, and bounded rapid movement.
- Doors: open/close the correct nearby door with no extra interaction.
- Torch: on/off affects the correct token for one and multiple players; check
  keypad feedback if configured.
- Deferred/non-blocking: Ambilight, table LED ring, and timers.
