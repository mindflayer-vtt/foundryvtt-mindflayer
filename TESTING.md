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

### Local Foundry 14 smoke instance

The local Compose setup defaults to `ghcr.io/felddy/foundryvtt:14.367`, the
exact migration target. `FOUNDRY_VERSION` is the single exact-build override;
the harness never falls back to `latest`. It copies the production build into
the disposable Foundry module directory and keeps all disposable
Foundry state under the ignored `.foundry-test-data/` directory.

1. Copy `.env.example` to `.env` and fill in either `FOUNDRY_RELEASE_URL` or
   `FOUNDRY_USERNAME` and `FOUNDRY_PASSWORD`. The former is a time-limited
   Node.js download URL from the Foundry licenses page; the latter are the
   credentials for an account with a Foundry license. After reviewing Foundry's
   EULA, set `FOUNDRY_EULA_ACCEPT=true` to let the local harness accept it on
   first startup. It remains opt-in and defaults to `false`.
2. Install the browser once with `npx playwright install chromium` (or
   `npx playwright install --with-deps chromium` on a minimal Linux host).
3. Run `npm run test:foundry:setup`. It builds the exact checkout, starts
   Foundry, applies the explicit EULA opt-in, installs libWrapper 1.13.5.1 and
   socketlib 1.1.4, creates and launches the
   configured disposable world, sets the Gamemaster access key, enables all
   three modules, and creates an active scene using the repository's minimal
   v14-only smoke-test system. The command is idempotent.
4. Run `npm run test:foundry:local` to perform setup, execute the smoke test,
   and stop the container even when the test fails. Use `test:foundry:up`,
   `test:foundry:prepare`, `test:foundry`, and `test:foundry:down` separately
   when debugging and you want to control each stage yourself.

A successful run executes one test (it does not skip) and prints a sanitized
runtime record containing Foundry, world, module and dependency versions plus
the result of every inventoried libWrapper boundary. Seven inventory targets
apply and must be callable through their v14 namespaces. The eighth,
`KeyboardManager.prototype._handleKeys`, is explicitly a Foundry 9-or-older
boundary and does not apply on Foundry 14.

The smoke opens the DM configuration UI, reads the shipped Macro compendium,
enables Mindflayer, and uses a narrowly scoped in-browser WebSocket double only
for `wss://localhost:443/`. Foundry's own Socket.IO connection remains native.
It registers a synthetic controller and uses a disposable token and wall to
verify keypad movement, camera pan invocation, door open, and torch on/off. It
restores settings and document state and removes both documents afterwards.
It then changes the WebSocket path three times and verifies the complete Socket
dependant closure is unloaded, recreated, readied, and free of accumulating
canvas hooks or WebSocket connections.

Known harmless output in this headless setup is limited to Foundry's hardware
acceleration warning and Chromium WebGL performance warnings. The v14-supported
but deprecated ApplicationV1 warning is explicitly classified because the
unchanged controller-mapping FormApplication is exercised successfully and Foundry declares
support through v15. Other manifest/module warnings are migration failures.
The smoke fails on browser console errors and uncaught page errors. A real
Mindflayer server is not required because wire-level protocol behavior remains
covered by the ordinary regression suite and the browser double drives the real
module's Socket and ControllerManager paths.

To use another disposable location, set `FOUNDRY_TEST_DATA` in `.env`. To
discard the default instance completely, run `npm run test:foundry:down` and
remove `.foundry-test-data/`. The directory is
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
  ownership, token refresh/update/document update and light documents,
  `canvas.walls.doors`, door-control `_onMouseDown`, `canvas.animatePan`, scene/grid
  dimensions, active-layer release, stage/controls/app renderer;
- UI/framework: `ui.notifications`, `FormApplication`, `Application`, jQuery,
  `foundry.utils.debounce/mergeObject`, PIXI containers, graphics,
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
- Socket reconnect uses a tracked five-second timeout. `unhook()` cancels it,
  and the loaded-state guard prevents reconnection after asynchronous close.
- the top-level Application listener wrapper has module/page lifetime; every
  selectively reloaded wrapper has explicit cleanup as recorded in the inventory;
- camera padding is six grid squares and center clamping can dominate the raw
  bounding-box center on small scenes;
- torch uses the v14 TokenDocument light contract; historical token-data and
  manual light-source initialization branches were removed.

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
