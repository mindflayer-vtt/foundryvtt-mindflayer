import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "test-webpack-boundaries",
      enforce: "pre",
      transform(code, id) {
        if (id.endsWith("/src/js/modules/loader.js")) {
          return code.replace(
            'require.context("./", true, /\\/index\\.js$/)',
            "globalThis.__webpackRequireContext",
          );
        }
        if (id.endsWith("/src/js/dependencies/index.js")) {
          return code.replace(
            'require("../../module.tmpl.json")',
            "globalThis.__moduleManifest",
          );
        }
        if (id.endsWith("/src/js/index.js")) {
          return code
            .replace(
              'require("./MindFlayer")',
              "globalThis.__mindFlayerEntryModule",
            )
            .replace(
              'require("./utils/module")',
              "globalThis.__moduleUtilityEntryModule",
            );
        }
      },
    },
  ],
  test: {
    setupFiles: ["./test/setup.ts"],
    exclude: ["test/foundry/**", "node_modules/**", "dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/js/**/*.js"],
    },
  },
});
