import { describe, expect, test, vi } from "vitest";
import CameraControl from "../../src/js/modules/cameraControl";
import ControllerManager from "../../src/js/modules/ControllerManager";
import DoorHandler from "../../src/js/modules/doorHandler";
import TokenTorch from "../../src/js/modules/tokenTorch";

function managerWith(keypads) {
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
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    canvas.tokens.controlled = [tokens[1]];
    const control = new CameraControl(instanceWith(manager));
    control.panCamera();
    expect(canvas.animatePan).toHaveBeenCalledWith({ x: 1000, y: 600, scale: 0.96, duration: 1000 });
  });

  test("includes visible combat and keypad tokens but excludes hidden/defeated combatants", () => {
    const visible = { x: 200, y: 200, w: 100, h: 100, combatant: { data: { hidden: false, defeated: false } } };
    const hidden = { x: 1800, y: 800, w: 100, h: 100, combatant: { data: { hidden: true, defeated: false } } };
    game.combat = { turns: [{ token: { object: visible } }, { token: { object: hidden } }] };
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    const control = new CameraControl(instanceWith(managerWith([])));
    control.panCamera();
    expect(canvas.animatePan.mock.calls[0][0].x).toBe(600);
    expect(canvas.animatePan.mock.calls[0][0].y).toBe(600);
  });

  test("duplicate references do not change the computed frame", () => {
    const token = { x: 500, y: 300, w: 100, h: 100 };
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
    expect(libWrapper.register).toHaveBeenCalledWith("mindflayer-token-controller", "Token.prototype._onUpdate", expect.any(Function), "MIXED");
    const wrapper = libWrapper.register.mock.calls[0][2];
    const wrapped = vi.fn();
    const options = { pan: true };
    await wrapper(wrapped, {}, options, "user");
    expect(options.pan).toBe(false);
    expect(canvas.animatePan).toHaveBeenCalledOnce();
    control.unhook();
    expect(libWrapper.unregister).toHaveBeenCalledWith("mindflayer-token-controller", "Token.prototype._onUpdate");
  });

  test("does nothing when there are no relevant tokens", () => {
    canvas.scene = { dimensions: { sceneRect: { x: 0, y: 0, width: 2000, height: 1000 }, size: 100 } };
    new CameraControl(instanceWith(managerWith([]))).panCamera();
    expect(canvas.animatePan).not.toHaveBeenCalled();
  });
});

describe("keypad feature integrations", () => {
  test("door input targets only an intersecting door and cleans up", () => {
    const player = { name: "One" };
    const token = { name: "Hero", x: 100, y: 100, width: 100, height: 100 };
    const keypad = { player, isJustDown: vi.fn(() => true) };
    game.user.getFlag.mockReturnValue("hero");
    canvas.tokens.placeables = [{ ...token, id: "hero" }];
    const nearby = { bounds: { x: 50, y: 50, width: 20, height: 20 }, doorControl: { _onMouseDown: vi.fn() } };
    const distant = { bounds: { x: 1000, y: 1000, width: 20, height: 20 }, doorControl: { _onMouseDown: vi.fn() } };
    canvas.walls.doors = [nearby, distant];
    const manager = managerWith([keypad]);
    const handler = new DoorHandler(instanceWith(manager));
    handler.ready();
    manager.tick(Date.now());
    expect(nearby.doorControl._onMouseDown).toHaveBeenCalledOnce();
    expect(distant.doorControl._onMouseDown).not.toHaveBeenCalled();
    handler.unhook();
    expect(manager.unregisterTickListener).toHaveBeenCalledOnce();
  });

  test("torch input toggles the selected token on and off and handles no token", async () => {
    const update = vi.fn(() => Promise.resolve());
    const token = { name: "Hero", emitsLight: false, document: { update }, initializeLightSource: vi.fn() };
    const keypad = { player: { name: "One" }, token, isJustDown: vi.fn(() => true) };
    const manager = managerWith([keypad]);
    const torch = new TokenTorch(instanceWith(manager));
    torch.ready();
    manager.tick(1);
    await Promise.resolve();
    expect(update).toHaveBeenCalledWith({ light: expect.objectContaining({ bright: 20, dim: 40 }) });
    token.emitsLight = true;
    token.update = vi.fn();
    manager.tick(2);
    expect(token.update).toHaveBeenCalledWith({ brightLight: 0, dimLight: 0 });
    keypad.token = null;
    expect(() => manager.tick(3)).not.toThrow();
    torch.unhook();
    expect(manager.unregisterTickListener).toHaveBeenCalledOnce();
  });

  test("preserves both legacy torch-on Foundry API branches", () => {
    const keypad = { player: { name: "One" }, isJustDown: vi.fn(() => true) };
    const manager = managerWith([keypad]);
    const torch = new TokenTorch(instanceWith(manager));
    torch.ready();

    keypad.token = { name: "Legacy", emitsLight: false, update: vi.fn() };
    manager.tick(1);
    expect(keypad.token.update).toHaveBeenCalledWith(expect.objectContaining({ brightLight: 20, dimLight: 40 }));

    const dataUpdate = vi.fn();
    keypad.token = { name: "Old", emitsLight: false, data: { update: dataUpdate }, updateSource: vi.fn() };
    manager.tick(2);
    expect(dataUpdate).toHaveBeenCalledWith({ light: expect.objectContaining({ bright: 20, dim: 40 }) });
  });
});
