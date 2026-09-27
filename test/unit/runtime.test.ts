import { beforeEach, describe, expect, test, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  settings: { init: vi.fn(() => ({ enabled: true })) },
  dependencies: { warnIfAnyMissing: vi.fn(() => true) },
  loader: { init: vi.fn(), ready: vi.fn() },
}));

vi.mock("../../src/js/settings", () => ({ settings: runtimeMocks.settings }));
vi.mock("../../src/js/dependencies", () => runtimeMocks.dependencies);
vi.mock("../../src/js/modules/loader", () => runtimeMocks.loader);

import MindFlayer from "../../src/js/MindFlayer";
import { getModuleInstance, setModuleInstance } from "../../src/js/utils/module";
import { isCombatActive } from "../../src/js/utils/combat";

describe("MindFlayer runtime", () => {
  beforeEach(() => {
    runtimeMocks.settings.init.mockClear();
    runtimeMocks.dependencies.warnIfAnyMissing.mockReset().mockReturnValue(true);
    runtimeMocks.loader.init.mockClear();
    runtimeMocks.loader.ready.mockClear();
  });

  test("initializes settings immediately and exposes stable module storage", () => {
    const instance = new MindFlayer();
    expect(runtimeMocks.settings.init).toHaveBeenCalledOnce();
    expect(instance.settings).toEqual({ enabled: true });
    expect(instance.modules).toEqual([]);
    expect(instance.modules).toBe(instance.modules);
  });

  test("loads and readies submodules only while required dependencies exist", () => {
    const instance = new MindFlayer();
    instance.init();
    instance.ready();
    expect(runtimeMocks.dependencies.warnIfAnyMissing.mock.calls).toEqual([[], [false]]);
    expect(runtimeMocks.loader.init).toHaveBeenCalledWith(instance);
    expect(runtimeMocks.loader.ready).toHaveBeenCalledWith(instance);

    runtimeMocks.dependencies.warnIfAnyMissing.mockReturnValue(false);
    runtimeMocks.loader.init.mockClear();
    runtimeMocks.loader.ready.mockClear();
    instance.init();
    instance.ready();
    expect(runtimeMocks.loader.init).not.toHaveBeenCalled();
    expect(runtimeMocks.loader.ready).not.toHaveBeenCalled();
  });

  test("normalizes a text-root application fragment before core listeners run", () => {
    const jquery = vi.fn((node) => ({ jqueryNode: node }));
    vi.stubGlobal("jQuery", jquery);
    vi.stubGlobal("Node", { ELEMENT_NODE: 1 });
    const instance = new MindFlayer();
    instance._vttBugFixes();
    const registration = libWrapper.register.mock.calls[0];
    expect(registration.slice(0, 2)).toEqual([
      "mindflayer-token-controller",
      "foundry.appv1.api.Application.prototype._activateCoreListeners",
    ]);
    expect(registration[3]).toBe("MIXED");
    const wrapper = registration[2];
    const element = { nodeType: 1 };
    const text = { nodeType: 3, nextElementSibling: element };
    const wrapped = vi.fn(() => "activated");
    expect(wrapper(wrapped, [text])).toBe("activated");
    expect(jquery).toHaveBeenCalledWith(element);
    expect(wrapped).toHaveBeenCalledWith({ jqueryNode: element });
  });
});

describe("runtime utility boundaries", () => {
  test("stores and retrieves the singleton on the Foundry module record", () => {
    const record = { active: true, instance: null as any };
    game.modules.set("mindflayer-token-controller", record);
    const instance = { id: "runtime" };
    setModuleInstance(instance as any);
    expect(record.instance).toBe(instance);
    expect(getModuleInstance()).toBe(instance);
  });

  test("reports only a started combat as active", () => {
    game.combat = null;
    expect(isCombatActive()).toBeUndefined();
    game.combat = { started: false };
    expect(isCombatActive()).toBe(false);
    game.combat.started = true;
    expect(isCombatActive()).toBe(true);
  });
});
