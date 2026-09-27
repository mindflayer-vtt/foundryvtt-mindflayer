import { describe, expect, test, vi } from "vitest";
import CameraControl from "../../src/js/modules/cameraControl";
import ControllerManager from "../../src/js/modules/ControllerManager";
import DoorHandler from "../../src/js/modules/doorHandler";
import Fullscreen from "../../src/js/modules/fullscreen";
import TokenTorch from "../../src/js/modules/tokenTorch";
import type MindFlayer from "../../src/js/MindFlayer";

function managerWith(keypads) {
  for (const keypad of keypads) {
    const token = keypad.token;
    if (token && !token.bounds && [token.x, token.y, token.w, token.h].every(Number.isFinite)) {
      token.bounds = {
        left: token.x,
        right: token.x + token.w,
        top: token.y,
        bottom: token.y + token.h,
      };
    }
  }
  let listener;
  return {
    keypads,
    registerTickListener: vi.fn((callback) => { listener = callback; }),
    unregisterTickListener: vi.fn(),
    tick: (now) => listener(now, Object.fromEntries(keypads.map((keypad, i) => [i, keypad]))),
  };
}

function instanceWith(manager, extraSettings = {}) {
  return {
    settings: { core: { noCanvas: false }, camera: { control: "focusPlayers" }, ...extraSettings },
    modules: { [ControllerManager.name]: manager },
  };
}

describe("camera control characterization", () => {
  test("starts for enabled clients or the selected managed Beamer", () => {
    const instance = { settings: { enabled: false } };
    game.settings.get.mockReturnValue("display");
    game.user.id = "display";
    expect(CameraControl.shouldStart(instance)).toBe(true);
    game.user.id = "ordinary";
    expect(CameraControl.shouldStart(instance)).toBe(false);
    instance.settings.enabled = true;
    expect(CameraControl.shouldStart(instance)).toBe(true);
  });

  test.each([
    ["one player", [{ x: 500, y: 300, w: 100, h: 100 }], { x: 600, y: 600, scale: 1.08 }],
    ["two nearby players", [{ x: 500, y: 300, w: 100, h: 100 }, { x: 700, y: 300, w: 100, h: 100 }], { x: 700, y: 600, scale: 1.08 }],
    ["horizontal spread", [{ x: 100, y: 400, w: 100, h: 100 }, { x: 1600, y: 400, w: 100, h: 100 }], { x: 1000, y: 600, scale: 0.96 }],
    ["vertical spread", [{ x: 900, y: 0, w: 100, h: 100 }, { x: 900, y: 800, w: 100, h: 100 }], { x: 950, y: 600, scale: 1.08 }],
  ])("characterizes %s", (name, tokens, expected) => {
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    const control = new CameraControl(instanceWith(managerWith(tokens.map((token) => ({ token })))));
    control.panCamera();
    expect(canvas.animatePan.mock.calls[0][0]).toEqual({ ...expected, duration: 1000 });
  });

  test.each([
    ["scene larger than viewport", { width: 4000, height: 3000 }, { x: 2000, y: 1500, w: 100, h: 100 }, { x: 2050, y: 1550, scale: 1080 / 1300 }],
    ["scene smaller than viewport", { width: 1000, height: 800 }, { x: 400, y: 300, w: 100, h: 100 }, { x: 600, y: 600, scale: 1.35 }],
  ])("characterizes %s", (name, size, token, expected) => {
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, ...size }, size: 100 } };
    new CameraControl(instanceWith(managerWith([{ token }]))).panCamera();
    const actual = canvas.animatePan.mock.calls[0][0];
    expect(actual.x).toBeCloseTo(expected.x);
    expect(actual.y).toBeCloseTo(expected.y);
    expect(actual.scale).toBeCloseTo(expected.scale);
    expect(actual.duration).toBe(1000);
  });

  test("frames tokens with grid padding, clamps to the scene, and uses one-second animation", () => {
    const tokens = [
      { x: 0, y: 0, w: 100, h: 100 },
      { x: 1700, y: 800, w: 100, h: 100 },
    ];
    const manager = managerWith([{ token: tokens[0] }]);
    managerWith([{ token: tokens[1] }]);
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    canvas.tokens.controlled = [tokens[1]];
    const control = new CameraControl(instanceWith(manager));
    control.panCamera();
    expect(canvas.animatePan).toHaveBeenCalledWith({ x: 1000, y: 600, scale: 0.96, duration: 1000 });
  });

  test("includes visible combat and keypad tokens but excludes hidden/defeated combatants", () => {
    const visible = { x: 200, y: 200, w: 100, h: 100, bounds: { left: 200, right: 300, top: 200, bottom: 300 }, combatant: { hidden: false, defeated: false } };
    const hidden = { x: 1800, y: 800, w: 100, h: 100, bounds: { left: 1800, right: 1900, top: 800, bottom: 900 }, combatant: { hidden: true, defeated: false } };
    game.combat = { turns: [{ token: { object: visible } }, { token: { object: hidden } }] };
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    const control = new CameraControl(instanceWith(managerWith([])));
    control.panCamera();
    expect(canvas.animatePan.mock.calls[0][0].x).toBe(600);
    expect(canvas.animatePan.mock.calls[0][0].y).toBe(600);
  });

  test("duplicate references do not change the computed frame", () => {
    const token: any = { x: 500, y: 300, w: 100, h: 100 };
    token.bounds = { left: 500, right: 600, top: 300, bottom: 400 };
    game.combat = { turns: [{ token: { object: token } }] };
    canvas.tokens.controlled = [token];
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    new CameraControl(instanceWith(managerWith([{ token }]))).panCamera();
    expect(canvas.animatePan).toHaveBeenCalledWith({ x: 600, y: 600, scale: 1.08, duration: 1000 });
  });

  test("registers the Foundry wrapper, suppresses default pan, refocuses, and unregisters", async () => {
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    const control = new CameraControl(instanceWith(managerWith([{ token: { x: 500, y: 300, w: 100, h: 100 } }])));
    control.ready();
    expect(libWrapper.register).toHaveBeenCalledWith("mindflayer-token-controller", "foundry.canvas.placeables.Token.prototype._onUpdate", expect.any(Function), "MIXED");
    const wrapper = libWrapper.register.mock.calls[0][2];
    const wrapped = vi.fn();
    const options = { pan: true };
    await wrapper(wrapped, {}, options, "user");
    expect(options.pan).toBe(false);
    expect(canvas.animatePan).toHaveBeenCalledOnce();
    control.unhook();
    expect(libWrapper.unregister).toHaveBeenCalledWith("mindflayer-token-controller", "foundry.canvas.placeables.Token.prototype._onUpdate");
  });

  test("preserves default camera panning in default mode and suppresses it in off mode", async () => {
    const manager = managerWith([]);
    const instance = instanceWith(manager);
    const control = new CameraControl(instance);
    control.ready();
    const wrapper = libWrapper.register.mock.calls[0][2];
    const wrapped = vi.fn(() => "result");
    instance.settings.camera.control = "default";
    const defaults = { pan: true };
    await expect(wrapper(wrapped, {}, defaults, "user")).resolves.toBe("result");
    expect(defaults.pan).toBe(true);
    instance.settings.camera.control = "off";
    const disabled = { pan: true };
    await wrapper(wrapped, {}, disabled, "user");
    expect(disabled.pan).toBe(false);
    expect(canvas.animatePan).not.toHaveBeenCalled();
  });

  test("does not register the camera wrapper without an initialized canvas", () => {
    game.canvas.initialized = false;
    new CameraControl(instanceWith(managerWith([]))).ready();
    expect(libWrapper.register).not.toHaveBeenCalled();
  });

  test("does nothing when there are no relevant tokens", () => {
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    new CameraControl(instanceWith(managerWith([]))).panCamera();
    expect(canvas.animatePan).not.toHaveBeenCalled();
  });
});

describe("keypad feature integrations", () => {
  test("fullscreen releases its v14 wrappers, listener, and interval", () => {
    const fullscreen = new Fullscreen({ modules: {} });
    const shareImageListener = game.socket.on.mock.calls[0][1];

    fullscreen.unhook();

    expect(libWrapper.unregister).toHaveBeenCalledWith(
      "mindflayer-token-controller",
      "foundry.canvas.placeables.PlaceableObject.prototype.can",
      false,
    );
    expect(libWrapper.unregister).toHaveBeenCalledWith(
      "mindflayer-token-controller",
      "foundry.applications.ui.Notifications.prototype.notify",
      false,
    );
    expect(game.socket.off).toHaveBeenCalledWith("shareImage", shareImageListener);
    expect(fullscreen.loaded).toBe(false);
  });

  test("door input targets only an intersecting door and cleans up", () => {
    const player = { name: "One" };
    const token = { name: "Hero", x: 100, y: 100, w: 100, h: 100 };
    const keypad = { player, isJustDown: vi.fn(() => true) };
    game.user.getFlag.mockReturnValue("hero");
    canvas.tokens.placeables = [{
      ...token,
      id: "hero",
      bounds: { left: 100, right: 200, top: 100, bottom: 200 },
    }];
    const nearby = { bounds: { x: 50, y: 50, width: 20, height: 20 }, doorControl: { _onMouseDown: vi.fn() } };
    const distant = { bounds: { x: 1000, y: 1000, width: 20, height: 20 }, doorControl: { _onMouseDown: vi.fn() } };
    canvas.walls.doors = [nearby, distant];
    const manager = managerWith([keypad]);
    const handler = new DoorHandler(instanceWith(manager) as unknown as MindFlayer);
    handler.ready();
    manager.tick(Date.now());
    expect(nearby.doorControl._onMouseDown).toHaveBeenCalledOnce();
    expect(distant.doorControl._onMouseDown).not.toHaveBeenCalled();
    handler.unhook();
    expect(manager.unregisterTickListener).toHaveBeenCalledOnce();
  });

  test("queues multiple nearby doors and opens at most one every 150ms", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const token = { id: "hero", name: "Hero", bounds: { left: 100, right: 200, top: 100, bottom: 200 } };
    const keypad = { player: { id: "player", name: "One" }, isJustDown: vi.fn(() => true) };
    game.user.getFlag.mockReturnValue("hero");
    canvas.tokens.placeables = [{ ...token, actor: { testUserPermission: () => true } }];
    const doors = [0, 1].map(() => ({
      bounds: { left: 50, right: 70, top: 50, bottom: 70 },
      doorControl: { _onMouseDown: vi.fn() },
    }));
    canvas.walls.doors = doors;
    const manager = managerWith([keypad]);
    const handler = new DoorHandler(instanceWith(manager) as unknown as MindFlayer);
    handler.ready();
    manager.tick(1_000);
    expect(doors[0].doorControl._onMouseDown).toHaveBeenCalledOnce();
    expect(doors[1].doorControl._onMouseDown).not.toHaveBeenCalled();
    keypad.isJustDown.mockReturnValue(false);
    manager.tick(1_149);
    expect(doors[1].doorControl._onMouseDown).not.toHaveBeenCalled();
    manager.tick(1_150);
    expect(doors[1].doorControl._onMouseDown).toHaveBeenCalledOnce();
    handler.unhook();
  });

  test("ignores door input from an unassigned keypad", () => {
    const keypad = { player: null, isJustDown: vi.fn(() => true) };
    const manager = managerWith([keypad]);
    const handler = new DoorHandler(instanceWith(manager) as unknown as MindFlayer);
    handler.ready();
    expect(() => manager.tick(Date.now())).not.toThrow();
    handler.unhook();
  });

  test("door handling does not subscribe when Foundry canvas support is disabled", () => {
    const manager = managerWith([]);
    const handler = new DoorHandler(instanceWith(manager, { core: { noCanvas: true } }) as unknown as MindFlayer);
    handler.ready();
    expect(manager.registerTickListener).not.toHaveBeenCalled();
    handler.unhook();
    expect(manager.unregisterTickListener).not.toHaveBeenCalled();
  });

  test("torch input toggles the selected token on and off", async () => {
    const update = vi.fn(() => Promise.resolve());
    const token = { name: "Hero", emitsLight: false, document: { update } };
    const keypad = { player: { name: "One" }, token, isJustDown: vi.fn(() => true) };
    const manager = managerWith([keypad]);
    const torch = new TokenTorch(instanceWith(manager) as unknown as MindFlayer);
    torch.ready();
    manager.tick(1);
    await Promise.resolve();
    expect(update).toHaveBeenCalledWith({ light: expect.objectContaining({ bright: 20, dim: 40 }) });
    token.emitsLight = true;
    manager.tick(2);
    expect(update).toHaveBeenCalledWith({ light: { bright: 0, dim: 0 } });
    torch.unhook();
    expect(manager.unregisterTickListener).toHaveBeenCalledOnce();
  });

  test("torch input safely ignores a keypad without a selected token", () => {
    const keypad = {
      player: { name: "One" },
      token: null,
      isJustDown: vi.fn(() => true),
    };
    const manager = managerWith([keypad]);
    const torch = new TokenTorch(instanceWith(manager) as unknown as MindFlayer);
    torch.ready();
    expect(() => manager.tick(1)).not.toThrow();
  });

});
