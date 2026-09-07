import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test/foundry",
  timeout: 30_000,
  use: {
    baseURL: process.env.FOUNDRY_URL,
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
});
