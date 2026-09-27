import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  { ignores: ["dist/**", "coverage/**", "node_modules/**", "chrome-overrides/**"] },
  {
    ...eslint.configs.recommended,
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        canvas: "readonly",
        game: "readonly",
        foundry: "readonly",
        Hooks: "readonly",
        libWrapper: "readonly",
        PIXI: "readonly",
        FormApplication: "readonly",
        isNewerVersion: "readonly",
        jQuery: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-prototype-builtins": "off",
    },
  },
  {
    files: ["test/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["test/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
      globals: {
        ...globals.browser,
        ...globals.node,
        canvas: "readonly",
        game: "readonly",
        foundry: "readonly",
        Hooks: "readonly",
        libWrapper: "readonly",
        PIXI: "readonly",
        FormApplication: "readonly",
        CONST: "readonly",
        ui: "readonly",
      },
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
