import { describe, expect, test, vi } from "vitest";
import {
  createModulePlan,
  loadModules,
  readyModules,
  reloadModules,
} from "../../src/js/modules/lifecycle";

function module(name, dependencies = [], starts = true, events = []) {
  return {
    [name]: class {
      static get moduleDependencies() {
        return dependencies;
      }
      static shouldStart() {
        return starts;
      }
      constructor() {
        events.push(`load:${name}`);
      }
      ready() {
        events.push(`ready:${name}`);
      }
      unhook() {
        events.push(`unhook:${name}`);
      }
    },
  }[name];
}

describe("submodule lifecycle planning", () => {
  test("loads required dependencies first across multiple levels", () => {
    const events = [];
    const Base = module("Base", [], false, events);
    const Middle = module("Middle", ["Base"], false, events);
    const Feature = module("Feature", ["Middle"], true, events);
    const Disabled = module("Disabled", [], false, events);
    const instance = { modules: {} };
    const plan = createModulePlan([Feature, Disabled, Base, Middle], instance);
    const instances = loadModules(instance, plan.descriptors);
    readyModules(instances);

    expect(plan.descriptors.map((item) => item.name)).toEqual([
      "Base",
      "Middle",
      "Feature",
    ]);
    expect(instance.modules.Disabled).toBeUndefined();
    expect(events).toEqual([
      "load:Base",
      "load:Middle",
      "load:Feature",
      "ready:Base",
      "ready:Middle",
      "ready:Feature",
    ]);
  });

  test("reloads a module and dependants in dependency-safe order only", () => {
    const events = [];
    const Base = module("Base", [], true, events);
    const Feature = module("Feature", ["Base"], true, events);
    const Child = module("Child", ["Feature"], true, events);
    const Unrelated = module("Unrelated", [], true, events);
    const instance = { modules: {} };
    const plan = createModulePlan([Child, Unrelated, Feature, Base], instance);
    readyModules(loadModules(instance, plan.descriptors));
    const old = { ...instance.modules };
    events.length = 0;

    reloadModules(instance, plan, "Feature");

    expect(events).toEqual([
      "unhook:Child",
      "unhook:Feature",
      "load:Feature",
      "load:Child",
      "ready:Feature",
      "ready:Child",
    ]);
    expect(instance.modules.Base).toBe(old.Base);
    expect(instance.modules.Unrelated).toBe(old.Unrelated);
    expect(instance.modules.Feature).not.toBe(old.Feature);
    expect(instance.modules.Child).not.toBe(old.Child);
  });

  test("continues readying modules after an error", () => {
    const first = { ready: vi.fn(() => { throw new Error("boom"); }) };
    const second = { ready: vi.fn() };
    const onError = vi.fn();
    readyModules([first, second], onError);
    expect(onError).toHaveBeenCalledWith(first, expect.any(Error));
    expect(second.ready).toHaveBeenCalledOnce();
  });

  test("fails clearly for missing dependencies and cycles", () => {
    const Missing = module("Missing", ["Absent"]);
    expect(() => createModulePlan([Missing], {})).toThrow(
      "Missing submodule dependency 'Absent'",
    );
    const Left = module("Left", ["Right"]);
    const Right = module("Right", ["Left"]);
    expect(() => createModulePlan([Left, Right], {})).toThrow(
      "Submodule dependency cycle",
    );
  });
});
