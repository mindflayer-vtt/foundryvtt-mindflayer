import { vi } from "vitest";

class HookBus {
  handlers = new Map();
  once(type, callback) { const wrapper = (...args) => { this.off(type, wrapper); return callback(...args); }; return this.on(type, wrapper); }
  on(type, callback) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(callback); return callback; }
  off(type, callback) { this.handlers.get(type)?.delete(callback); }
  call(type, ...args) { for (const callback of this.handlers.get(type) || []) callback(...args); }
  clear() { this.handlers.clear(); }
}

export const hooks = new HookBus();

export function installFoundryFakes() {
  globalThis.window = globalThis;
  globalThis.FormApplication = class {};
  globalThis.Hooks = hooks;
  resetFoundryFakes();
}

export function resetFoundryFakes() {
  hooks.clear();
  const flags = new Map();
  const registrations = new Map();
  globalThis.foundry = { utils: {
    debounce: (callback) => callback,
    isNewerVersion: (current, target) => Number(current) > Number(target),
    mergeObject: (left, right) => ({ ...left, ...right }),
  } };
  globalThis.game = {
    version: "12", canvas: { initialized: true }, combat: null,
    users: { contents: [], players: [] }, scenes: { active: null },
    modules: new Map([["mindflayer", { active: true, instance: null }]]),
    user: {
      id: "gm", isGM: true, role: 4,
      getFlag: vi.fn((scope, key) => flags.get(`${scope}.${key}`)),
      setFlag: vi.fn((scope, key, value) => { flags.set(`${scope}.${key}`, value); return Promise.resolve(value); }),
    },
    i18n: { format: vi.fn((key) => key), localize: vi.fn((key) => key) },
    settings: {
      get: vi.fn(), set: vi.fn(),
      register: vi.fn((scope, key, options) => registrations.set(`${scope}.${key}`, options)),
      registerMenu: vi.fn(), registrations,
    },
    socket: { on: vi.fn(), emit: vi.fn() }, keybindings: { register: vi.fn() },
  };
  globalThis.canvas = {
    initialized: true,
    tokens: { placeables: [], controlled: [], moveMany: vi.fn() },
    walls: { doors: [] }, grid: { size: 100 },
    activeLayer: { releaseAll: vi.fn() }, animatePan: vi.fn(),
  };
  globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), clear: vi.fn() } };
  const wrappers = new Map();
  globalThis.libWrapper = {
    MIXED: "MIXED", WRAPPER: "WRAPPER",
    register: vi.fn((owner, target, callback, mode) => wrappers.set(`${owner}:${target}`, { callback, mode })),
    unregister: vi.fn((owner, target) => wrappers.delete(`${owner}:${target}`)), wrappers,
  };
  globalThis.PIXI = { FederatedMouseEvent: class {}, Container: class {} };
  Object.defineProperty(globalThis.window, "innerWidth", { configurable: true, value: 1920 });
  Object.defineProperty(globalThis.window, "innerHeight", { configurable: true, value: 1080 });
}
