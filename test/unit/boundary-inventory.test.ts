import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import inventory from "../fixtures/libwrapper-boundaries.json";

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(item) : entry.name.endsWith(".ts") ? [item] : [];
  });
}

describe("libWrapper boundary inventory", () => {
  test("lists every v14 wrapper target declared in production source", () => {
    const targets = sourceFiles("src/js").flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return [...source.matchAll(/const (?:WRAP|REF)_[^=]+\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
    });
    const v14Targets = inventory
      .filter(({ maximumFoundry }) => maximumFoundry === undefined || maximumFoundry >= 14)
      .map((item) => item.target);
    expect([...new Set(targets)].sort()).toEqual(v14Targets.sort());
  });
});
