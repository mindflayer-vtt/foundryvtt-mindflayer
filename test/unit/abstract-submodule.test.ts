import { describe, expect, test } from "vitest";
import AbstractSubModule from "../../src/js/modules/AbstractSubModule";

describe("AbstractSubModule", () => {
  test("retains its instance while loaded and releases it on unhook", () => {
    const owner = { settings: { enabled: true } };
    const module = new AbstractSubModule(owner);
    expect(module.loaded).toBe(true);
    expect(module.instance).toBe(owner);
    expect(() => module.ensureLoaded()).not.toThrow();

    module.unhook();
    expect(module.loaded).toBe(false);
    expect(module.instance).toBeNull();
    expect(() => module.ensureLoaded()).toThrow(ReferenceError);
  });
});
