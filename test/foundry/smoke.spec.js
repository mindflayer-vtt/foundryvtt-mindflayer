import { expect, test } from "@playwright/test";
import fs from "node:fs";

const wrapperBoundaries = JSON.parse(
  fs.readFileSync("test/fixtures/libwrapper-boundaries.json", "utf8"),
);

const configured = Boolean(process.env.FOUNDRY_URL);

test.describe("real Foundry compatibility", () => {
  test.skip(!configured, "FOUNDRY_URL is not configured");

  test("Mindflayer and its critical Foundry 12 boundaries are available", async ({ page }) => {
    const startupErrors = [];
    page.on("pageerror", (error) => startupErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") startupErrors.push(`console: ${message.text()}`);
    });
    const target = new URL(process.env.FOUNDRY_URL);
    if (process.env.FOUNDRY_TEST_WORLD) {
      target.pathname = "/join";
      target.searchParams.set("world", process.env.FOUNDRY_TEST_WORLD);
    }
    await page.goto(target.toString());

    if (process.env.FOUNDRY_TEST_PASSWORD) {
      const user = process.env.FOUNDRY_TEST_USER;
      if (user) {
        await page.locator('select[name="userid"], select[name="user"]').selectOption({
          label: user,
        });
      }
      await page.locator("input[name=password]").fill(process.env.FOUNDRY_TEST_PASSWORD);
      await page.locator("button[name=join]").click();
    }

    await expect
      .poll(() => page.evaluate(() => globalThis.game?.ready === true), {
        message: `Foundry did not reach game.ready at ${page.url()}`,
        timeout: 30_000,
      })
      .toBe(true);
    const state = await page.evaluate((boundaries) => {
      const resolve = (path) => {
        const [root, ...parts] = path.split(".");
        // Foundry 12 exposes core classes as global lexical bindings rather
        // than properties of window/globalThis.
        return parts.reduce((value, part) => value?.[part], globalThis.eval(root));
      };
      return {
        foundryVersion: game.version,
        world: { id: game.world.id, title: game.world.title, system: game.system.id },
        user: { name: game.user.name, isGM: game.user.isGM },
        moduleActive: game.modules.get("mindflayer-token-controller")?.active,
        moduleVersion: game.modules.get("mindflayer-token-controller")?.version,
        instanceLoaded: Boolean(game.modules.get("mindflayer-token-controller")?.instance),
        dependencies: Object.fromEntries(
          ["lib-wrapper", "socketlib"].map((id) => [
            id,
            { version: game.modules.get(id)?.version, active: game.modules.get(id)?.active },
          ]),
        ),
        canvasReady: game.canvas?.initialized === true,
        settingsReadable: game.settings.get("mindflayer-token-controller", "enabled") !== undefined,
        globals: ["game", "canvas", "Hooks", "foundry"].every((name) => globalThis[name]),
        targets: boundaries.map(({ target, maximumFoundry }) => ({
          target,
          applicable: maximumFoundry === undefined || Number(game.version.split(".")[0]) <= maximumFoundry,
          exists: typeof resolve(target) === "function",
        })),
      };
    }, wrapperBoundaries);
    expect(state).toMatchObject({
      moduleActive: true,
      instanceLoaded: true,
      canvasReady: true,
      settingsReadable: true,
      globals: true,
    });
    expect(state.targets).toHaveLength(wrapperBoundaries.length);
    expect(state.targets.filter(({ applicable, exists }) => applicable && !exists)).toEqual([]);
    expect(startupErrors).toEqual([]);
    console.log(JSON.stringify(state, null, 2));
  });
});
