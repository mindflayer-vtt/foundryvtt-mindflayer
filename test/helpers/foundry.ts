import { vi } from "vitest";

class HookBus {
  handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();
  once(type: string, callback: (...args: unknown[]) => unknown) { const wrapper = (...args: unknown[]) => { this.off(type, wrapper); return callback(...args); }; return this.on(type, wrapper); }
  on(type: string, callback: (...args: unknown[]) => unknown) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type)!.add(callback); return callback; }
  off(type: string, callback: (...args: unknown[]) => unknown) { this.handlers.get(type)?.delete(callback); }
  call(type: string, ...args: unknown[]) { for (const callback of this.handlers.get(type) || []) callback(...args); }
  clear() { this.handlers.clear(); }
}

export const hooks = new HookBus();
const runtime = globalThis as any;

export function installFoundryFakes() {
  runtime.window = runtime;
  runtime.FormApplication = class {
    static defaultOptions = {};
    form: any;
    object: any;
    options: any;
    constructor(object = {}, options = {}) {
      this.object = object;
      this.options = { ...(this.constructor as any).defaultOptions, ...options };
    }
    activateListeners(_html: any) {}
    render(_force?: boolean) {}
    setPosition(_position: any) {}
    async close(_options?: any) {}
    async _onSubmit(_event?: any, _options?: any) {}
  };
  runtime.Hooks = hooks;
  resetFoundryFakes();
}

export function resetFoundryFakes() {
  hooks.clear();
  const flags = new Map<string, unknown>();
  const registrations = new Map<string, unknown>();
  runtime.foundry = { utils: {
    debounce: <T>(callback: T): T => callback,
    isNewerVersion: (current: string | number, target: string | number) => Number(current) > Number(target),
    mergeObject: (left: Record<string, unknown>, right: Record<string, unknown>) => ({ ...left, ...right }),
  } };
  runtime.mergeObject = runtime.foundry.utils.mergeObject;
  runtime.game = {
    version: "14.367", canvas: { initialized: true }, combat: null,
    users: { contents: [], players: [] }, scenes: { active: null },
    modules: new Map([["mindflayer", { active: true, instance: null }]]),
    user: {
      id: "gm", isGM: true, role: 4,
      getFlag: vi.fn((scope: string, key: string) => flags.get(`${scope}.${key}`)),
      setFlag: vi.fn((scope: string, key: string, value: unknown) => { flags.set(`${scope}.${key}`, value); return Promise.resolve(value); }),
    },
    i18n: { format: vi.fn((key: string) => key), localize: vi.fn((key: string) => key) },
    settings: {
      get: vi.fn(), set: vi.fn(),
      register: vi.fn((scope: string, key: string, options: unknown) => registrations.set(`${scope}.${key}`, options)),
      registerMenu: vi.fn(), registrations,
    },
    socket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() }, keybindings: { register: vi.fn() },
  };
  runtime.canvas = {
    initialized: true,
    tokens: { placeables: [], controlled: [], moveMany: vi.fn() },
    walls: { doors: [] }, grid: { size: 100 },
    activeLayer: { releaseAll: vi.fn() }, animatePan: vi.fn(),
  };
  runtime.CONST = {
    KEYBINDING_PRECEDENCE: { NORMAL: 0 },
    USER_ROLES: { TRUSTED: 2 },
  };
  runtime.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), clear: vi.fn() } };
  const wrappers = new Map<string, { callback: unknown; mode: string }>();
  runtime.libWrapper = {
    MIXED: "MIXED", WRAPPER: "WRAPPER",
    register: vi.fn((owner: string, target: string, callback: unknown, mode: string) => wrappers.set(`${owner}:${target}`, { callback, mode })),
    unregister: vi.fn((owner: string, target: string) => wrappers.delete(`${owner}:${target}`)), wrappers,
  };
  class Container {
    children: any[] = [];
    parent: any = null;
    position = { x: 0, y: 0 };
    scale = { x: 1, y: 1, set: vi.fn((x: number, y: number) => { this.scale.x = x; this.scale.y = y; }) };
    addChild(child: any) { child.parent = this; this.children.push(child); return child; }
    removeChild(child: any) { this.children = this.children.filter((item) => item !== child); child.parent = null; return child; }
    destroy = vi.fn();
  }
  class Graphics extends Container {
    beginFill = vi.fn();
    drawCircle = vi.fn();
    clear = vi.fn();
    lineStyle = vi.fn();
    moveTo = vi.fn();
    lineTo = vi.fn();
    arc = vi.fn();
    alpha = 1;
  }
  class Text extends Container {
    text: string;
    anchor = { set: vi.fn() };
    updateText = vi.fn();
    constructor(text: string) { super(); this.text = text; }
  }
  runtime.PIXI = {
    FederatedMouseEvent: class {}, Container, Graphics,
    LegacyGraphics: Graphics, Text,
    Point: class { constructor(public x: number, public y: number) {} },
  };
  runtime.canvas.controls = { hud: new Container() };
  runtime.canvas.stage = new Container();
  Object.defineProperty(globalThis.window, "innerWidth", { configurable: true, value: 1920 });
  Object.defineProperty(globalThis.window, "innerHeight", { configurable: true, value: 1080 });
}
