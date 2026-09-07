import { expect, test } from "@playwright/test";

const configured = Boolean(process.env.FOUNDRY_URL);

test.describe("real Foundry compatibility", () => {
  test.skip(!configured, "FOUNDRY_URL is not configured");

  test("Mindflayer and its critical Foundry 12 boundaries are available", async ({ page }) => {
    const startupErrors = [];
    page.on("pageerror", (error) => startupErrors.push(error.message));
    const target = new URL(process.env.FOUNDRY_URL);
    if (process.env.FOUNDRY_TEST_WORLD) {
      target.pathname = "/join";
      target.searchParams.set("world", process.env.FOUNDRY_TEST_WORLD);
    }
    await page.goto(target.toString());

    if (process.env.FOUNDRY_TEST_PASSWORD) {
      const user = process.env.FOUNDRY_TEST_USER;
      if (user) await page.locator("select[name=user]").selectOption({ label: user });
      await page.locator("input[name=password]").fill(process.env.FOUNDRY_TEST_PASSWORD);
      await page.locator("button[name=join]").click();
    }

    await page.waitForFunction(() => globalThis.game?.ready === true);
    const state = await page.evaluate(() => {
      const resolve = (path) => path.split(".").reduce((value, part) => {
        const prototype = part === "prototype";
        return prototype ? value?.prototype : value?.[part];
      }, globalThis);
      return {
        moduleActive: game.modules.get("mindflayer-token-controller")?.active,
        instanceLoaded: Boolean(game.modules.get("mindflayer-token-controller")?.instance),
        canvasReady: game.canvas?.initialized === true,
        settingsReadable: game.settings.get("mindflayer-token-controller", "enabled") !== undefined,
        globals: ["game", "canvas", "Hooks", "foundry"].every((name) => globalThis[name]),
        targets: [
          "Application.prototype._activateCoreListeners",
          "Token.prototype._onUpdate",
          "Token.prototype._getBorderColor",
          "Token.prototype._refreshState",
          "KeyboardManager.prototype._handleKeys",
          "PlaceableObject.prototype.can",
          "Notifications.prototype.notify",
          "Combat.prototype.endCombat",
        ].map((target) => [target, typeof resolve(target) === "function"]),
      };
    });
    expect(state).toMatchObject({
      moduleActive: true,
      instanceLoaded: true,
      canvasReady: true,
      settingsReadable: true,
      globals: true,
    });
    expect(state.targets.filter(([, exists]) => !exists)).toEqual([]);
    expect(startupErrors).toEqual([]);
  });
});
