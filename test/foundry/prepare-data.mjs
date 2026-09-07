import fs from "node:fs";
import path from "node:path";

const dataPath = path.resolve(process.env.FOUNDRY_TEST_DATA ?? ".foundry-test-data");

for (const directory of ["Data/modules", "Data/systems", "Data/worlds"]) {
  fs.mkdirSync(path.join(dataPath, directory), { recursive: true });
}

console.log(`Prepared disposable Foundry data directories under ${dataPath}`);
