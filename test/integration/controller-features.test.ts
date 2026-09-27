import { beforeEach, describe, expect, test, vi } from "vitest";
import CombatEndTurn from "../../src/js/modules/combatEndTurn";
import ControllerManager from "../../src/js/modules/ControllerManager";
import Fullscreen from "../../src/js/modules/fullscreen";
import Socket from "../../src/js/modules/socket";
import TokenBorder from "../../src/js/modules/tokenBorder";
import TokenMovement from "../../src/js/modules/tokenMovement";
import TokenSelect from "../../src/js/modules/tokenSelect";
import type MindFlayer from "../../src/js/MindFlayer";

function managerHarness() {
  let listener: any;
  return {
    keypads: [],
    registerTickListener: vi.fn((callback) => { listener = callback; }),
    unregisterTickListener: vi.fn(),
    tick: (now: number, keypads: Record<string, any>) => listener(now, keypads),
  };
}

function featureInstance(manager: ReturnType<typeof managerHarness>) {
  return {
    modules: {
      [ControllerManager.name]: manager,
      [Socket.name]: { isConnected: true },
      [Fullscreen.name]: {},
    },
  };
}

describe("controller-driven token movement", () => {
  test("moves and then faces a token using the keypad orientation", async () => {
    const manager = managerHarness();
    const movement = new TokenMovement(featureInstance(manager) as unknown as MindFlayer);
    const keypad = {
      token: { id: "hero", name: "Hero" },
      player: { name: "Player" },
      rotation: 90,
      syncRepetitions: vi.fn(),
      isDown: vi.fn(() => false),
      isJustDown: vi.fn(() => false),
      isRepeatedDown: vi.fn((key) => key === "W"),
    };
    movement.ready();
    manager.tick(100, { controller: keypad });
    await vi.waitFor(() => expect(canvas.tokens.moveMany).toHaveBeenCalledTimes(2));
    expect(keypad.syncRepetitions).toHaveBeenCalledWith(["W", "A", "S", "D"], 100);
    expect(canvas.tokens.moveMany.mock.calls[0][0]).toMatchObject({
      dx: 1, rotate: false, ids: ["hero"],
    });
    expect(canvas.tokens.moveMany.mock.calls[0][0].dy).toBeCloseTo(0);
    expect(canvas.tokens.moveMany.mock.calls[1][0]).toMatchObject({
      dx: 1, rotate: true, ids: ["hero"],
    });
    expect(canvas.tokens.moveMany.mock.calls[1][0].dy).toBeCloseTo(0);
    movement.unhook();
    expect(manager.unregisterTickListener).toHaveBeenCalledOnce();
  });

  test("shift rotates in place and shift-C rotates the keypad orientation", async () => {
    const manager = managerHarness();
    const movement = new TokenMovement(featureInstance(manager) as unknown as MindFlayer);
    const keypad = {
      token: { id: "hero", name: "Hero" },
      player: { name: "Player" },
      rotation: 0,
      syncRepetitions: vi.fn(),
      isDown: vi.fn((key) => key === "SHI"),
      isJustDown: vi.fn((key) => key === "C"),
      isRepeatedDown: vi.fn((key) => key === "D"),
    };
    movement.ready();
    manager.tick(200, { controller: keypad });
    await vi.waitFor(() => expect(canvas.tokens.moveMany).toHaveBeenCalledTimes(2));
    for (const [call] of canvas.tokens.moveMany.mock.calls) {
      expect(call).toMatchObject({ dx: 1, rotate: true, ids: ["hero"] });
      expect(call.dy).toBeCloseTo(0);
    }
    expect(keypad.rotation).toBe(90);
    expect(game.i18n.format).toHaveBeenCalledWith(
      "MindFlayer.Notifications.ChangeDirection",
      { player: "Player", orientation: 90 },
    );
    expect(ui.notifications.info).toHaveBeenCalledOnce();
  });

  test("does not subscribe when the canvas is disabled", () => {
    game.canvas.initialized = false;
    const manager = managerHarness();
    new TokenMovement(featureInstance(manager) as unknown as MindFlayer).ready();
    expect(manager.registerTickListener).not.toHaveBeenCalled();
  });

  test("ignores movement input without a selected token or direction", async () => {
    const manager = managerHarness();
    const movement = new TokenMovement(featureInstance(manager) as unknown as MindFlayer);
    movement.ready();
    const withoutToken = {
      token: null, isDown: vi.fn(() => false), isJustDown: vi.fn(() => false),
      syncRepetitions: vi.fn(), isRepeatedDown: vi.fn(() => false),
    };
    manager.tick(1, { withoutToken });
    expect(withoutToken.syncRepetitions).not.toHaveBeenCalled();
    const stationary = {
      ...withoutToken,
      token: { id: "hero", name: "Hero" }, player: { name: "Player" }, rotation: 0,
      syncRepetitions: vi.fn(),
    };
    manager.tick(2, { stationary });
    await Promise.resolve();
    expect(stationary.syncRepetitions).toHaveBeenCalled();
    expect(canvas.tokens.moveMany).not.toHaveBeenCalled();
  });
});

describe("token selection and combat turns", () => {
  test("selects the default token and then cycles owned tokens in stable order", () => {
    const manager = managerHarness();
    const feature = new TokenSelect(featureInstance(manager) as unknown as MindFlayer);
    const player = { id: "player", name: "Player" };
    const keypad = { player, isJustDown: vi.fn(() => true) };
    canvas.tokens.placeables = ["b", "a"].map((id) => ({
      id,
      name: id.toUpperCase(),
      actor: { testUserPermission: () => true },
      refresh: vi.fn(),
    }));
    feature.ready();
    game.user.getFlag.mockReturnValueOnce(undefined);
    manager.tick(1, { controller: keypad });
    expect(game.user.setFlag).toHaveBeenLastCalledWith(
      "mindflayer-token-controller", "selectedToken_player", "a",
    );
    game.user.getFlag.mockReturnValueOnce("a");
    manager.tick(2, { controller: keypad });
    expect(game.user.setFlag).toHaveBeenLastCalledWith(
      "mindflayer-token-controller", "selectedToken_player", "b",
    );
    expect(canvas.activeLayer.releaseAll).toHaveBeenCalledTimes(2);
  });

  test("ignores unassigned keypads and wraps selection to the first token", () => {
    const manager = managerHarness();
    const feature = new TokenSelect(featureInstance(manager) as unknown as MindFlayer);
    feature.ready();
    manager.tick(1, { unassigned: { player: null, isJustDown: () => true } });
    expect(game.user.setFlag).not.toHaveBeenCalled();
    const player = { id: "player", name: "Player" };
    canvas.tokens.placeables = ["a", "b"].map((id) => ({
      id, name: id, actor: { testUserPermission: () => true }, refresh: vi.fn(),
    }));
    game.user.getFlag.mockReturnValue("b");
    manager.tick(2, { assigned: { player, isJustDown: () => true } });
    expect(game.user.setFlag).toHaveBeenCalledWith(
      "mindflayer-token-controller", "selectedToken_player", "a",
    );
  });

  test("only the owner of the active combatant can advance the turn", () => {
    const manager = managerHarness();
    const nextTurn = vi.fn();
    game.combat = {
      started: true,
      turn: 0,
      turns: [{ actor: { hasPlayerOwner: true, ownership: { owner: 3 } } }],
      nextTurn,
    };
    const feature = new CombatEndTurn(featureInstance(manager));
    feature.ready();
    const press = (id: string) => ({
      player: { id, name: id },
      isJustDown: vi.fn(() => true),
    });
    manager.tick(1, { denied: press("denied"), owner: press("owner") });
    expect(ui.notifications.warn).toHaveBeenCalledOnce();
    expect(nextTurn).toHaveBeenCalledOnce();
    game.combat.started = false;
    manager.tick(2, { owner: press("owner") });
    expect(nextTurn).toHaveBeenCalledOnce();
    feature.unhook();
    expect(manager.unregisterTickListener).toHaveBeenCalledOnce();
  });

  test("ignores end-turn input from an unassigned keypad", () => {
    const manager = managerHarness();
    const nextTurn = vi.fn();
    game.combat = {
      started: true, turn: 0,
      turns: [{ actor: { hasPlayerOwner: true, ownership: {} } }],
      nextTurn,
    };
    const feature = new CombatEndTurn(featureInstance(manager));
    feature.ready();
    manager.tick(1, { unassigned: { player: null, isJustDown: () => true } });
    expect(nextTurn).not.toHaveBeenCalled();
    expect(ui.notifications.warn).not.toHaveBeenCalled();
  });
});

describe("selected-token border integration", () => {
  beforeEach(() => {
    game.users.contents = [{ id: "player", color: { r: 1, g: 0.5, b: 0 } }];
    game.user.getFlag.mockReturnValue("hero");
    canvas.tokens.placeables = [];
  });

  test("uses the selected player's color and preserves fallback behavior", () => {
    const feature = new TokenBorder(featureInstance(managerHarness()));
    feature.ready();
    const borderRegistration = libWrapper.register.mock.calls.find(
      (call) => call[1].endsWith("._getBorderColor"),
    );
    const wrapper = borderRegistration[2];
    const fallback = vi.fn(() => 123);
    const selected = { id: "hero", actor: { hasPlayerOwner: true } };
    expect(wrapper.call(selected, fallback)).toBe(0xff7f00);
    selected.actor.hasPlayerOwner = false;
    expect(wrapper.call(selected, fallback, "argument")).toBe(123);
    expect(fallback).toHaveBeenCalledWith("argument");
    Hooks.call("updateScene");
    expect(canvas.activeLayer.releaseAll).toHaveBeenCalledOnce();
    feature.unhook();
    expect(libWrapper.unregister).toHaveBeenCalledTimes(2);
  });

  test("forces borders visible only for non-secret token documents", () => {
    const feature = new TokenBorder(featureInstance(managerHarness()));
    feature.ready();
    const refreshRegistration = libWrapper.register.mock.calls.find(
      (call) => call[1].endsWith("._refreshState"),
    );
    const wrapper = refreshRegistration[2];
    const token: any = { border: { visible: false }, document: { isSecret: false } };
    const wrapped = vi.fn(() => "result");
    expect(wrapper.call(token, wrapped)).toBe("result");
    expect(token.border.visible).toBe(true);
    token.document.isSecret = true;
    wrapper.call(token, wrapped);
    expect(token.border.visible).toBe(false);
  });
});
