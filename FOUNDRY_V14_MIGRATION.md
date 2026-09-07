# Foundry VTT 14 migration

## Scope

- Source baseline: `baseline-foundry-v12.331` (`764af1de3edbf8da73d92590b7d7fce287448445`)
- Starting branch SHA: `764af1de3edbf8da73d92590b7d7fce287448445`
- Target runtime: Foundry VTT 14.367
- Physical-table validation: not performed; it remains required after automated migration.

The requested `PRE_UPGRADE_BASELINE.md` and `MODERNIZATION.md` files were not
present at the migration starting SHA. `TESTING.md` and `AGENTS.md` contained
the available baseline guidance; `MODERNIZATION.md` has now been created for
explicitly deferred work.

## Unchanged-module diagnostic

The production module was built without source changes and mounted into a fresh,
licensed `ghcr.io/felddy/foundryvtt:14.367` runtime.

Observed before migration fixes:

- Foundry 14.367 itself downloaded, licensed, and reached its setup view.
- The v12 harness initially exposed a fresh-data permissions issue: Docker
  created `Data/modules` as root while resolving the module bind mount, and
  Foundry 14 needs to create sibling directories and README files. The harness
  now pre-creates the disposable data directory structure.
- Setup stopped at package installation because the v12 global
  `Setup.installPackage` API is removed. In v14 the initialized setup `game`
  object is a `foundry.setup.Setup` instance and provides `installPackage`.
- The baseline Simple World-Building 0.8.2 system declares compatibility only
  through Foundry 11. The smoke harness now uses a minimal local v14-only test
  system so an unrelated abandoned system does not determine module migration
  results.

- After those harness-only blockers were corrected, the unchanged production
  bundle initialized and reached ready in Foundry 14.367. The canvas initialized,
  settings were readable, and all seven v12-applicable wrapper target names
  still resolved as functions. This proves startup compatibility only; it does
  not prove that the private targets retain the required v14 semantics.
- The baseline smoke emitted no uncaught page error or browser console error.

Configuration UI, camera, door, torch, macro-pack, and selective reload behavior
were not exercised by that unchanged-code diagnostic. They are covered by the
post-migration smoke described below.

## Migration log

### Manifest, dependencies, and macro pack

- Removed the unsupported legacy `name` and `author` manifest keys; the existing
  structured `authors` metadata remains authoritative.
- Declared the currently tested compatibility range as minimum and verified
  Foundry 14.367. No claim is made for 14.359 until that build is tested.
- Updated libWrapper to 1.13.5.1, the release declaring Foundry 14 compatibility.
- Updated socketlib to 1.1.4 and its maintained `farling42` manifest lineage.
- Removed obsolete `entity` and `module` pack declaration fields.
- Replaced the generated NeDB `packs/macro.db` file with a LevelDB
  `packs/macros` directory built by `@foundryvtt/foundryvtt-cli` 3.0.4.
- Updated the macro source's legacy `permission` field to `ownership`.
- Builds compile and then extract the pack with the official CLI, validating
  the expected Macro IDs before succeeding. Real Foundry 14.367 indexed the
  pack with one entry and loaded the `Start Timer` document and its command.

### Application and token contracts

- The DM controller-assignment UI renders and closes successfully in real
  Foundry 14.367. It remains on deprecated Application v1/FormApplication
  because v14 still provides that compatibility API and no behavioral rewrite
  is required.
- Token ownership lookup now uses the public
  `Actor.testUserPermission(user, "OWNER")` API instead of reading raw ownership
  data.
- Combatant hidden/defeated filtering now reads current Combatant document
  properties rather than the removed v12-era `.data` path.
- Camera framing and door proximity geometry now use the v14 Token placeable's
  scene-space `bounds`. Runtime probing showed direct `x`/`y` values are local
  while `bounds` contains the disposable token's scene coordinates.
- Torch toggling now exclusively updates `TokenDocument.light`; the obsolete
  pre-document token update branches were removed. Document updates drive the
  v14 canvas refresh without manually reinitializing the light source.
- With the external Mindflayer WebSocket endpoint narrowly stubbed, all feature
  submodules initialize and reach ready without an uncaught page or console
  error in Foundry 14.367.

### Runtime boundaries and cleanup

- Token and PlaceableObject wrapper targets use
  `foundry.canvas.placeables`; Notifications uses
  `foundry.applications.ui`. This removes v13-deprecated global-alias access.
- The top-level Application wrapper now targets
  `foundry.appv1.api.Application`. It remains necessary to normalize the HTML
  passed to existing ApplicationV1 listeners. The controller mapping UI works
  in v14.367; its classified ApplicationV1 deprecation is deferred rather than
  triggering an unrelated UI rewrite.
- `Token._onUpdate` remains wrapped so camera-follow updates can remove Foundry's
  default `pan` option before core handles the update and then invoke the
  deliberately gradual Mindflayer camera. A post-update public hook cannot
  suppress the already-requested core pan.
- `Token._getBorderColor` and `Token._refreshState` remain wrapped to replace the
  computed border color for controller-associated players and force the border
  visible for non-secret tokens at the exact rendering phase. Foundry 14 has no
  public hook that can replace those return/state decisions with equivalent
  semantics.
- `PlaceableObject.can` remains wrapped to deny control while fullscreen mode is
  active, and `Notifications.notify` remains wrapped to turn permanent notices
  into temporary ones in that mode. Public hooks do not provide equivalent
  pre-call return/argument control. Both targets use their supported v14
  namespaces and unregister during Fullscreen cleanup.
- `Combat.prototype.endCombat` remains wrapped because its result determines
  whether controller LEDs should reset. Public combat hooks do not provide the
  same ability to condition behavior on the cancelled/completed call.
- Door interaction retains the contained DoorControl `_onMouseDown` call. A
  real v14 probe showed it performs the state transition while preserving
  Foundry's interaction, permission, socket, and hook semantics; Wall
  `_onClickLeft` did not provide equivalent behavior.
- Selective reload now unregisters every reloaded libWrapper target. Fullscreen
  also releases its `shareImage` socket listener, and its dead v9 keyboard
  wrapper branch was removed.
- Timer cleanup now aborts its private timer list, detaches and destroys its
  PIXI container from the same stage to which it was added, and unregisters its
  `canvasPan` hook.
- Ambilight reads the current Scene `backgroundColor` property; the obsolete
  `.data.backgroundColor` branch was removed.

### Automated v14 behavioral result

The real Foundry 14.367 smoke verifies:

- exact runtime build, active module, initialized canvas, readable settings,
  libWrapper 1.13.5.1, and socketlib 1.1.4;
- all seven v14-applicable wrapper targets resolve and the v9-only target is
  explicitly non-applicable;
- the DM mapping UI renders and closes;
- the generated Macro pack indexes and loads its `Start Timer` document;
- a synthetic controller drives reversible token movement, camera pan, door
  open, and torch off/on/off behavior against disposable documents;
- three WebSocket-path changes unload and replace all 14 modules in Socket's
  dependant closure, preserve three unrelated module instances, call `ready`
  on the new Socket, keep hook counts stable, and leave one live WebSocket;
- disposable token, wall, flags, mappings, and settings are restored or removed.

The warning policy permits only the classified ApplicationV1 deprecation and
headless Chromium/graphics warnings. Other browser warnings and all console or
page errors fail the smoke.

## Deferred validation

- Foundry 14.359 is not claimed or tested; manifest minimum and verified are
  both the exact tested build 14.367.
- No physical keypad, LED ring, Ambilight device, or projector was available.
  Those checks remain `REQUIRES HARDWARE` and are listed in `TESTING.md`.
- Broad npm/jQuery/PIXI upgrades are deferred in `MODERNIZATION.md`.

## Final automated validation

Run from a clean lockfile install on Node 24:

- `npm ci`: pass; 664 packages installed, 0 vulnerabilities reported.
- `npm run lint`: pass.
- `npm test`: pass; 10 files and 49 tests.
- `npm run test:coverage`: pass; statements 39.61% (509/1285),
  branches 28.07% (130/463), functions 40.05% (137/342), and lines
  39.82% (501/1258).
- `npm run build`: pass, including Macro pack round-trip validation.
- `npm run prod`: pass, including the minimized bundle and Macro pack
  round-trip validation.
- `npm audit`: pass; 0 vulnerabilities.
- `npm run test:foundry:local`: pass; one real Foundry 14.367 Playwright
  smoke test, followed by automatic container teardown.
- `git diff --check`: pass.

GitHub Actions runs `npm run check`, `npm run test:coverage`, and `npm audit`
on pushes and pull requests. The licensed real-Foundry smoke remains local
because credentials and explicit EULA acceptance are intentionally not stored
in CI.
