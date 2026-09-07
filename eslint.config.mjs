import eslint from "@eslint/js";
import globals from "globals";

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
];
