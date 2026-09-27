import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const runtime = globalThis as any;

describe("Foundry entry hook bootstrap", () => {
  const instances: any[] = [];
  const setModuleInstance = vi.fn();

  test("constructs, stores, initializes, and readies one singleton", async () => {
    class FakeMindFlayer {
      init = vi.fn();
      ready = vi.fn();
      constructor() { instances.push(this); }
    }
    runtime.__mindFlayerEntryModule = { default: FakeMindFlayer };
    runtime.__moduleUtilityEntryModule = { setModuleInstance };
    await import("../../src/js/index.js");
    expect(instances).toHaveLength(0);
    Hooks.call("init");
    expect(instances).toHaveLength(1);
    expect(setModuleInstance).toHaveBeenCalledWith(instances[0]);
    expect(instances[0].init).toHaveBeenCalledOnce();
    Hooks.call("ready");
    expect(instances).toHaveLength(1);
    expect(instances[0].ready).toHaveBeenCalledOnce();
    Hooks.call("init");
    Hooks.call("ready");
    expect(instances).toHaveLength(1);
    expect(instances[0].ready).toHaveBeenCalledOnce();
  });
});

describe("dependency availability checks", () => {
  let warnIfAnyMissing: (warn?: boolean) => boolean;

  beforeAll(async () => {
    runtime.__moduleManifest = {
      dependencies: [{ name: "lib-wrapper" }, { name: "socketlib" }],
    };
    ({ warnIfAnyMissing } = await import("../../src/js/dependencies/index.js"));
  });

  beforeEach(() => {
    game.modules.set("lib-wrapper", { active: true });
    game.modules.set("socketlib", { active: true });
  });

  test("returns true without warnings when every dependency is active", () => {
    expect(warnIfAnyMissing()).toBe(true);
    expect(ui.notifications.error).not.toHaveBeenCalled();
  });

  test("warns a GM for every missing or inactive dependency", () => {
    game.modules.delete("lib-wrapper");
    game.modules.set("socketlib", { active: false });
    expect(warnIfAnyMissing()).toBe(false);
    expect(ui.notifications.error).toHaveBeenCalledTimes(2);
    expect(ui.notifications.error).toHaveBeenCalledWith(
      expect.stringContaining("'lib-wrapper' module"),
    );
    expect(ui.notifications.error).toHaveBeenCalledWith(
      expect.stringContaining("'socketlib' module"),
    );
  });

  test("suppresses warnings when requested or when the current user is not a GM", () => {
    game.modules.delete("lib-wrapper");
    expect(warnIfAnyMissing(false)).toBe(false);
    expect(ui.notifications.error).not.toHaveBeenCalled();
    game.user.isGM = false;
    expect(warnIfAnyMissing()).toBe(false);
    expect(ui.notifications.error).not.toHaveBeenCalled();
  });
});
