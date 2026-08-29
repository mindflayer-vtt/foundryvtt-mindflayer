# Dependency modernization

## 2026-08-29 baseline and upgrade

- Runtime target: Node.js 22 -> 24; verified with Node 24.16.0 and npm 11.13.0 via fnm.
- Webpack: 5.99.9 -> 5.110.1; webpack-cli: 6.0.1 -> 7.2.3.
- copy-webpack-plugin: 13.0.0 -> 14.0.0; terser-webpack-plugin: 5.3.14 -> 5.6.1.
- Sharp: 0.34.2 -> 0.35.4; generated WebP output remained byte-for-byte identical.
- semantic-release: 24.2.5 -> 25.0.9, with its release plugins updated to compatible current majors.
- Prettier: 3.5.3 -> 3.9.6; glob: 11.0.2 -> 13.0.6. Unused direct `greensock` and `handlebars` dependencies were removed.
- GitHub Actions now use Node 24 and current major action releases, and run clean install, tests, and build before release.

The npm audit result changed from 2 low, 8 moderate, 37 high, and 2 critical findings to zero. A clean install, all 11 tests, and the production webpack build pass without webpack warnings.

Reproduce with:

```sh
fnm use
npm ci
npm test -- --run
npm run build
npm audit
```

`jquery` 3.7.1 and `pixi.js` 5.3.12 remain intentionally pinned because their next majors require Foundry/runtime migration. The deprecated `@types/pixi.js` stub remains aligned with Pixi 5. Foundry API modernization and release behavior changes are deferred.
