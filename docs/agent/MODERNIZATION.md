# Deferred modernization

The Foundry 14 migration intentionally preserves the existing architecture and
limits dependency changes to migration requirements. The next modernization
phase may evaluate the items below independently of the v14 compatibility work.

## Runtime and editor dependencies

- `jquery` 3.7 remains unchanged. Foundry 14 still supplies jQuery to the
  ApplicationV1 interfaces used by the two existing forms; jQuery 4 is not part
  of this migration.
- `pixi.js` 5 and `@types/pixi.js` 5 remain development/editor dependencies.
  Production code does not import them, so webpack does not bundle a second
  PIXI runtime. Runtime rendering uses Foundry 14's global PIXI classes, whose
  required constructors are checked by the real smoke test.
- ApplicationV2 conversion is deferred. Foundry 14.367 still supports the
  existing FormApplication screens. Foundry marks ApplicationV1 deprecated
  since v13 and scheduled for removal in v16, so conversion is required before
  targeting Foundry 16.
- Broad upgrades of Vitest, webpack, ESLint, semantic-release, jQuery, or PIXI
  should be reviewed separately from this behavior-preserving migration.

## Optional feature follow-up

Automated v14 validation proves Ambilight, table LED, timer, combat helper,
fullscreen, token-border, and wake-lock modules construct and reach `ready`
without relevant errors. Timer render-container and hook cleanup is also tested
through repeated selective reload. Physical Ambilight output, table LEDs,
projector smoothness, and keypad LEDs remain hardware validation work.
