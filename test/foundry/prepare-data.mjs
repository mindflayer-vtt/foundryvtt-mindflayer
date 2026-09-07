import fs from "node:fs";
import path from "node:path";

const dataPath = path.resolve(process.env.FOUNDRY_TEST_DATA ?? ".foundry-test-data");

for (const directory of ["Data/modules", "Data/systems", "Data/worlds"]) {
  fs.mkdirSync(path.join(dataPath, directory), { recursive: true });
}

for (const [source, destination] of [
  ["dist", "Data/modules/mindflayer-token-controller"],
  ["test/foundry/system", "Data/systems/mindflayer-smoke-system"],
]) {
  const destinationPath = path.join(dataPath, destination);
  fs.rmSync(destinationPath, { recursive: true, force: true });
  fs.cpSync(path.resolve(source), destinationPath, {
    recursive: true,
    force: true,
  });
}

console.log(`Installed the current checkout into disposable Foundry data at ${dataPath}`);
