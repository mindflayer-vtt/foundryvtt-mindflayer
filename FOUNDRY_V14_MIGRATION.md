# Foundry VTT 14 migration

## Scope

- Source baseline: `baseline-foundry-v12.331` (`764af1de3edbf8da73d92590b7d7fce287448445`)
- Starting branch SHA: `764af1de3edbf8da73d92590b7d7fce287448445`
- Target runtime: Foundry VTT 14.367
- Physical-table validation: not performed; it remains required after automated migration.

The requested `PRE_UPGRADE_BASELINE.md` and `MODERNIZATION.md` files were not
present at the migration starting SHA. `TESTING.md` and `AGENTS.md` contain the
available baseline and modernization guidance.

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
were not exercised by the baseline smoke and therefore remain unvalidated.

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
- Real Foundry 14.367 indexed the pack with one entry and loaded the `Start
  Timer` Macro document and its command successfully.

Production API boundaries and behavioral smoke coverage remain in progress.
