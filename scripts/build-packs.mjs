import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const sourceDirectory = "src/packs/macros";
const devDomain = fs.existsSync(".devDomain")
  ? fs.readFileSync(".devDomain", "utf8")
  : "localhost";
const outputRoot =
  process.env.NODE_ENV === "production"
    ? "dist"
    : path.join("chrome-overrides", devDomain, "modules/mindflayer-token-controller");
const outputDirectory = path.join(outputRoot, "packs", "macros");
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "mindflayer-macros-"));
const validationDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "mindflayer-macros-validation-"),
);
const expectedIds = [];

try {
  for (const filename of fs.readdirSync(sourceDirectory)) {
    if (!filename.endsWith(".macro.json")) continue;
    const macroName = filename.slice(0, -".macro.json".length);
    const macro = JSON.parse(
      fs.readFileSync(path.join(sourceDirectory, filename), "utf8"),
    );

    for (const variableFilename of fs.readdirSync(sourceDirectory)) {
      const prefix = `${macroName}.`;
      const marker = ".macrovar.";
      if (!variableFilename.startsWith(prefix) || !variableFilename.includes(marker)) continue;
      const variableName = variableFilename.slice(prefix.length, variableFilename.indexOf(marker));
      macro[variableName] = fs.readFileSync(
        path.join(sourceDirectory, variableFilename),
        "utf8",
      );
    }

    macro._key = `!macros!${macro._id}`;
    expectedIds.push(macro._id);
    fs.writeFileSync(
      path.join(temporaryDirectory, `${macroName}.json`),
      `${JSON.stringify(macro, null, 2)}\n`,
    );
  }

  await compilePack(temporaryDirectory, outputDirectory, { log: true });
  await extractPack(outputDirectory, validationDirectory, { clean: true });
  const extractedIds = fs
    .readdirSync(validationDirectory, { recursive: true })
    .filter((filename) => filename.endsWith(".json"))
    .map((filename) =>
      JSON.parse(fs.readFileSync(path.join(validationDirectory, filename), "utf8")),
    )
    .map((macro) => macro._id)
    .sort();
  if (JSON.stringify(extractedIds) !== JSON.stringify(expectedIds.sort())) {
    throw new Error(
      `Macro pack validation failed: expected ${expectedIds.join(", ")}, extracted ${extractedIds.join(", ")}`,
    );
  }
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  fs.rmSync(validationDirectory, { recursive: true, force: true });
}

for (const entry of fs.readdirSync(outputRoot, { recursive: true, withFileTypes: true })) {
  const entryPath = path.join(entry.parentPath, entry.name);
  fs.chmodSync(entryPath, entry.isDirectory() ? 0o775 : 0o664);
}
fs.chmodSync(outputRoot, 0o775);
