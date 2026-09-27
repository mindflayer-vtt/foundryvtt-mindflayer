import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const events: string[] = [];

class Infrastructure {
  static moduleDependencies: string[] = [];
  static shouldStart() { return false; }
  constructor(_instance: any) { events.push("load:Infrastructure"); }
  ready() { events.push("ready:Infrastructure"); }
  unhook() { events.push("unhook:Infrastructure"); }
}

class Feature {
  static moduleDependencies = [Infrastructure.name];
  static shouldStart() { return true; }
  constructor(_instance: any) { events.push("load:Feature"); }
  ready() { events.push("ready:Feature"); }
  unhook() { events.push("unhook:Feature"); }
}

let readyFeatureEnabled = false;
class DeferredFeature {
  static moduleDependencies = [Infrastructure.name];
  static shouldStart() { return readyFeatureEnabled; }
  constructor(_instance: any) { events.push("load:DeferredFeature"); }
  ready() { events.push("ready:DeferredFeature"); }
  unhook() { events.push("unhook:DeferredFeature"); }
}

let loader: typeof import("../../src/js/modules/loader.js");

beforeAll(async () => {
  const context: any = (key: string) => ({
    default: key === "./feature/index.ts" ? Feature :
      key === "./deferred/index.ts" ? DeferredFeature : Infrastructure,
  });
  context.keys = () => ["./feature/index.ts", "./infrastructure/index.ts", "./deferred/index.ts"];
  (globalThis as any).__webpackRequireContext = context;
  loader = await import("../../src/js/modules/loader.js");
});

beforeEach(() => {
  events.splice(0);
  readyFeatureEnabled = false;
});

describe("submodule loader facade", () => {
  test("loads role-dependent modules when the role becomes available at ready", () => {
    const instance: any = { modules: {} };
    loader.init(instance);
    expect(instance.modules.DeferredFeature).toBeUndefined();
    readyFeatureEnabled = true;
    loader.ready(instance);
    expect(events).toEqual([
      "load:Infrastructure", "load:Feature", "load:DeferredFeature",
      "ready:Infrastructure", "ready:Feature", "ready:DeferredFeature",
    ]);
  });

  test("discovers modules, includes required infrastructure, and readies in order", () => {
    const instance: any = { modules: {} };
    loader.init(instance);
    expect(events).toEqual(["load:Infrastructure", "load:Feature"]);
    loader.ready(instance);
    expect(events).toEqual([
      "load:Infrastructure", "load:Feature",
      "ready:Infrastructure", "ready:Feature",
    ]);
  });

  test("selectively reloads a dependency and all of its dependants", () => {
    const instance: any = { modules: {} };
    loader.init(instance);
    loader.ready(instance);
    events.splice(0);
    const previous = { ...instance.modules };
    loader.reload(instance, Infrastructure.name);
    expect(events).toEqual([
      "unhook:Feature", "unhook:Infrastructure",
      "load:Infrastructure", "load:Feature",
      "ready:Infrastructure", "ready:Feature",
    ]);
    expect(instance.modules.Infrastructure).not.toBe(previous.Infrastructure);
    expect(instance.modules.Feature).not.toBe(previous.Feature);
  });

  test("accepts an explicit module subset for readying", () => {
    const instance: any = { modules: {} };
    loader.init(instance);
    events.splice(0);
    const explicit = { constructor: { name: "Explicit" }, ready: vi.fn() };
    loader.ready(instance, [explicit] as any);
    expect(explicit.ready).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
  });
});
