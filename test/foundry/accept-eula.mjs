import { chromium } from "@playwright/test";

if (process.env.FOUNDRY_EULA_ACCEPT !== "true") process.exit(0);

const foundryUrl = process.env.FOUNDRY_URL;
if (!foundryUrl) throw new Error("FOUNDRY_URL is required to accept the Foundry EULA");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(new URL("/license", foundryUrl).toString());

  const agreement = page.locator("#eula-agree");
  const requiresAcceptance = new URL(page.url()).pathname === "/license";
  if (requiresAcceptance) {
    await agreement.waitFor({ state: "visible", timeout: 10_000 });
    await agreement.check();
    await page.locator('button[data-action="accept"]').click();
    await page.waitForURL((url) => url.pathname !== "/license");
    console.log("Accepted the Foundry EULA because FOUNDRY_EULA_ACCEPT=true");
  }
} finally {
  await browser.close();
}
