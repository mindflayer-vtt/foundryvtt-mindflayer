import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "test-webpack-require-context",
      enforce: "pre",
      transform(code, id) {
        if (id.endsWith("/src/js/modules/loader.js")) {
          return code.replace(
            'require.context("./", true, /\\/index\\.js$/)',
            "globalThis.__webpackRequireContext",
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
