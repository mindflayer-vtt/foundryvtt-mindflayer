import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "test-webpack-boundaries",
      enforce: "pre",
      transform(code, id) {
        if (id.endsWith("/src/js/modules/loader.ts")) {
          return code.replace(
            '(require as any).context("./", true, /\\/index\\.ts$/)',
            "globalThis.__webpackRequireContext",
          );
        }
        if (id.endsWith("/src/js/dependencies/index.ts")) {
          return code.replace(
            'require("../../module.tmpl.json")',
            "globalThis.__moduleManifest",
          );
        }
        if (id.endsWith("/src/js/index.ts")) {
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
      include: ["src/js/**/*.ts"],
    },
  },
});
