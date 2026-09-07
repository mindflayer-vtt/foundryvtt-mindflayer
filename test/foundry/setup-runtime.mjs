import { chromium } from "@playwright/test";

const packages = [
  {
    type: "system",
    id: "worldbuilding",
    version: "0.8.2",
    manifest:
      "https://raw.githubusercontent.com/foundryvtt/worldbuilding/release-082/system.json",
  },
  {
    type: "module",
    id: "lib-wrapper",
    version: "1.12.15.0",
    manifest:
      "https://github.com/ruipin/fvtt-lib-wrapper/releases/download/v1.12.15.0/module.json",
  },
  {
    type: "module",
    id: "socketlib",
    version: "1.1.0",
    manifest:
      "https://github.com/manuelVo/foundryvtt-socketlib/raw/v1.1.0/module.json",
  },
];

const required = ["lib-wrapper", "socketlib", "mindflayer-token-controller"];
const foundryUrl = process.env.FOUNDRY_URL;
const worldId = process.env.FOUNDRY_TEST_WORLD;
const userName = process.env.FOUNDRY_TEST_USER;
const userPassword = process.env.FOUNDRY_TEST_PASSWORD;

for (const [name, value] of Object.entries({
  FOUNDRY_URL: foundryUrl,
  FOUNDRY_ADMIN_KEY: process.env.FOUNDRY_ADMIN_KEY,
  FOUNDRY_TEST_WORLD: worldId,
  FOUNDRY_TEST_USER: userName,
  FOUNDRY_TEST_PASSWORD: userPassword,
})) {
  if (!value) throw new Error(`${name} is required to prepare the Foundry smoke runtime`);
}

async function authenticateSetup(page) {
  await page.goto(new URL("/setup", foundryUrl).toString());
  if (new URL(page.url()).pathname !== "/auth") return;
  await page.locator('input[name="adminPassword"]').fill(process.env.FOUNDRY_ADMIN_KEY);
  await page.locator('button[name="action"]').click();
  await page.waitForURL((url) => url.pathname === "/setup");
}

async function dismissTour(page) {
  const exit = page.locator('.tour a[data-action="exit"]');
  if (await exit.isVisible()) await exit.click();
}

async function preparePackagesAndWorld(page) {
  await authenticateSetup(page);
  await page.locator('button[data-action="worldCreate"]').waitFor({
    state: "attached",
    timeout: 60_000,
  });

  for (const dependency of packages) {
    const installed = await page.evaluate(
      ({ type, id }) => game[`${type}s`].has(id),
      dependency,
    );
    if (!installed) {
      console.log(`Installing ${dependency.id} ${dependency.version}`);
      await page.evaluate(
        ({ type, manifest }) => Setup.installPackage({ type, manifest }).then(() => null),
        dependency,
      );
      await page.waitForFunction(
        ({ type, id }) => game[`${type}s`].has(id),
        dependency,
        { timeout: 120_000 },
      );
    }
  }

  const worldExists = await page.evaluate((id) => game.worlds.has(id), worldId);
  if (!worldExists) {
    console.log(`Creating disposable world ${worldId}`);
    await page.locator('button[data-action="worldCreate"]').waitFor({
      state: "visible",
      timeout: 60_000,
    });
    await dismissTour(page);
    await page.locator('button[data-action="worldCreate"]').click();
    const form = page.locator('form:has(input[name="id"])');
    await form.locator('input[name="title"]').fill("Mindflayer Smoke Test");
    await form.locator('input[name="id"]').fill(worldId);
    await form.locator('select[name="system"]').selectOption("worldbuilding");
    await form.locator('button[type="submit"]').click();
    await page.waitForFunction((id) => game.worlds.has(id), worldId, {
      timeout: 60_000,
    });
  }

  await dismissTour(page);
  const world = page.locator(`[data-package-id="${worldId}"]`);
  await world.hover();
  await world.locator('[data-action="worldLaunch"]').click();
  await page.waitForURL((url) => url.pathname === "/join", { timeout: 60_000 });
  return !worldExists;
}

async function joinWorld(page, password) {
  const target = new URL("/join", foundryUrl);
  target.searchParams.set("world", worldId);
  if (new URL(page.url()).pathname !== "/join") await page.goto(target.toString());
  await page.locator('select[name="userid"], select[name="user"]').selectOption({
    label: userName,
  });
  if (password) await page.locator('input[name="password"]').fill(password);
  await page.locator('button[name="join"]').click();
  await page.waitForFunction(() => globalThis.game?.ready === true, null, {
    timeout: 60_000,
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const target = new URL("/join", foundryUrl);
  target.searchParams.set("world", worldId);
  await page.goto(target.toString());

  await page.waitForFunction(
    () =>
      Boolean(document.querySelector('select[name="userid"], select[name="user"]')) ||
      document.body.textContent.includes("There is currently no active game session"),
  );

  const noActiveWorld = await page.getByText("There is currently no active game session").isVisible();
  const freshWorld = noActiveWorld ? await preparePackagesAndWorld(page) : false;

  await page.locator('select[name="userid"], select[name="user"]').waitFor({
    state: "visible",
    timeout: 60_000,
  });
  const existingWorld = await page.locator('select[name="userid"], select[name="user"]').isVisible();
  if (!existingWorld) throw new Error(`Foundry did not expose the ${worldId} join form`);

  let configuredPassword = !freshWorld;
  if (freshWorld) await joinWorld(page, "");
  else {
    try {
      await joinWorld(page, userPassword);
    } catch {
      configuredPassword = false;
      await page.goto(target.toString());
      await joinWorld(page, "");
    }
  }

  const state = await page.evaluate(
    async ({ required, userPassword, configuredPassword }) => {
      const configuration = game.settings.get("core", "moduleConfiguration");
      for (const id of required) configuration[id] = true;
      await game.settings.set("core", "moduleConfiguration", configuration);
      if (!configuredPassword) await game.user.update({ password: userPassword });

      let scene = game.scenes.active;
      if (!scene) {
        scene =
          game.scenes.contents[0] ??
          (await Scene.create({
            name: "Mindflayer Smoke Scene",
            width: 2000,
            height: 2000,
          }));
        await scene.activate();
      }

      return {
        foundry: game.version,
        world: game.world.id,
        user: game.user.name,
        scene: scene.name,
        modules: required,
      };
    },
    { required, userPassword, configuredPassword },
  );
  console.log("Foundry smoke runtime prepared:", JSON.stringify(state));
} finally {
  await browser.close();
}
