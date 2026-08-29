# Pre-upgrade baseline

Verified with the locked dependencies under Node 22.13.1/npm 10.9.2. Tests and
webpack also pass unchanged under Node 24.16.0/npm 11.13.0.

## Commands and resolved direct dependencies

- Clean install: `npm ci`
- Tests: `npm test`
- Build: `npm run build`
- Vitest 4.1.11, webpack 5.99.9, webpack-cli 6.0.1,
  copy-webpack-plugin 13.0.0, terser-webpack-plugin 5.3.14,
  semantic-release 24.2.5, sharp 0.34.2

The eight tests cover receiver registration, canonical message dispatch,
malformed/unknown messages, handler isolation, key timing, LED color
serialization, and movement geometry without requiring Foundry.

## Existing warnings

- `npm ci` reports 49 audit findings: 2 low, 8 moderate, 37 high, 2 critical.
- The webpack development build completes without warnings.
- No Node runtime or TypeScript checks are configured.
