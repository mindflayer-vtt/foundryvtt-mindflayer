import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/js/modules/loader", () => ({ reload: vi.fn() }));

import CombatIndicator from "../../src/js/modules/combatIndicator";
import ControllerManager from "../../src/js/modules/ControllerManager";
import Socket from "../../src/js/modules/socket";
import TableLEDRing from "../../src/js/modules/tableLedRing";
import { TableLEDRingHandlerMixin } from "../../src/js/modules/tableLedRing/TableLEDRingHandlerMixin";
import Timer from "../../src/js/modules/timer";
import type MindFlayer from "../../src/js/MindFlayer";

describe("combat keypad LED feedback", () => {
  function keypad(playerId: string) {
    return {
      player: { id: playerId },
      setLED: vi.fn(),
      setDefaultLEDColor: vi.fn(),
    };
  }

  function createIndicator() {
    const keypads = [keypad("one"), keypad("two"), keypad("three")];
    const timer = { addTimer: vi.fn(async (data) => data) };
    const instance = {
      settings: {
        skipDefeated: true,
        combatIndicator: { tacticalDiscussionDuration: 5, playerReactionTime: 6 },
      },
      modules: {
        [ControllerManager.name]: { keypads },
        [Timer.name]: timer,
      },
    };
    return { indicator: new CombatIndicator(instance as unknown as MindFlayer), keypads, timer, instance };
  }

  test("starts tactical discussion and then marks current, next, and later turns", async () => {
    const { keypads, timer } = createIndicator();
    const combat: any = {
      started: true,
      current: { turn: 0 },
      turns: [
        { players: [{ id: "one" }], isDefeated: false },
        { players: [{ id: "two" }], isDefeated: false },
        { players: [{ id: "three" }], isDefeated: false },
      ],
    };
    Hooks.call("startCombat", combat, { turn: 0 });
    await vi.waitFor(() => expect(timer.addTimer).toHaveBeenCalledOnce());
    expect(timer.addTimer.mock.calls[0][0].end - timer.addTimer.mock.calls[0][0].start)
      .toBe(5000);
    Hooks.call("updateCombat", combat, { turn: 0 });
    await vi.waitFor(() => expect(keypads[0].setLED).toHaveBeenCalled());
    expect(keypads[0].setLED).toHaveBeenCalledWith(1, "#FF0000");
    expect(keypads[1].setLED).toHaveBeenCalledWith(1, "#FFFF00");
    expect(keypads[2].setLED).toHaveBeenCalledWith(1, "#00FF00");
    expect(timer.addTimer.mock.calls.at(-1)[0].end - timer.addTimer.mock.calls.at(-1)[0].start)
      .toBe(6000);
  });

  test("skips defeated combatants and wraps the next marker into the next round", async () => {
    const { keypads } = createIndicator();
    const combat: any = {
      started: true,
      current: { turn: 2 },
      turns: [
        { players: [{ id: "one" }], isDefeated: false },
        { players: [{ id: "two" }], isDefeated: true },
        { players: [{ id: "three" }], isDefeated: false },
      ],
    };
    Hooks.call("startCombat", combat, { turn: 2 });
    Hooks.call("updateCombat", combat, { turn: 2 });
    await vi.waitFor(() => expect(keypads[2].setLED).toHaveBeenCalledWith(1, "#FF0000"));
    expect(keypads[0].setLED).toHaveBeenLastCalledWith(1, "#FFFF00");
    expect(keypads[1].setLED).not.toHaveBeenCalled();
  });

  test("restores defaults only after successful combat completion and cleans up hooks", async () => {
    const { indicator, keypads } = createIndicator();
    const endWrapper = libWrapper.register.mock.calls.find(
      (call) => call[1] === "Combat.prototype.endCombat",
    )[2];
    await expect(endWrapper(vi.fn(async () => "ended"))).resolves.toBe("ended");
    for (const pad of keypads) expect(pad.setDefaultLEDColor).toHaveBeenCalledOnce();
    keypads.forEach((pad) => pad.setDefaultLEDColor.mockClear());
    await expect(endWrapper(vi.fn(async () => false))).resolves.toBe(false);
    for (const pad of keypads) expect(pad.setDefaultLEDColor).not.toHaveBeenCalled();
    indicator.unhook();
    expect(libWrapper.unregister).toHaveBeenCalledWith(
      "mindflayer-token-controller", "Combat.prototype.endCombat", false,
    );
  });

  test("restarts tactical discussion at the first turn of a new round", async () => {
    const { timer } = createIndicator();
    const combat: any = { started: true, current: { turn: 0 }, turns: [] };
    Hooks.call("startCombat", combat, { turn: 0 });
    Hooks.call("updateCombat", combat, { round: 2, turn: 0 });
    await vi.waitFor(() => expect(timer.addTimer).toHaveBeenCalledTimes(2));
    for (const [data] of timer.addTimer.mock.calls) {
      expect(data.end - data.start).toBe(5_000);
    }
  });

  test("stops updating the sequence when a combat player has no keypad", async () => {
    const { keypads } = createIndicator();
    const combat: any = {
      started: true,
      current: { turn: 0 },
      turns: [{ players: [{ id: "missing" }], isDefeated: false }],
    };
    Hooks.call("startCombat", combat, { turn: 0 });
    Hooks.call("updateCombat", combat, { turn: 0 });
    await Promise.resolve();
    for (const keypad of keypads) expect(keypad.setLED).not.toHaveBeenCalled();
  });

  test("executes zero-duration tactical and reaction callbacks immediately", async () => {
    const { keypads, timer, instance } = createIndicator();
    instance.settings.combatIndicator.tacticalDiscussionDuration = 0;
    instance.settings.combatIndicator.playerReactionTime = 0;
    const combat: any = {
      started: true,
      current: { turn: 0 },
      turns: [{ players: [{ id: "one" }], isDefeated: false }],
    };
    Hooks.call("startCombat", combat, { turn: 0 });
    await vi.waitFor(() => expect(keypads[0].setLED).toHaveBeenCalledWith(1, "#FF0000"));
    expect(timer.addTimer).not.toHaveBeenCalled();
  });
});

describe("table LED ring arbitration", () => {
  beforeEach(() => vi.useFakeTimers());

  function createRing(enabled = true, moduleEnabled = true) {
    const socket = { isConnected: true, send: vi.fn() };
    const instance = {
      settings: {
        enabled: moduleEnabled,
        ambilight: {
          enabled,
          fps: 10,
          target: "127.0.0.1",
          universe: 3,
          led: { count: 2 },
        },
      },
      modules: { [Socket.name]: socket },
    };
    return { ring: new TableLEDRing(instance as unknown as MindFlayer), socket };
  }

  test("does not start when a GM only connects for controller discovery", async () => {
    const { ring } = createRing(true, false);
    const priorUser = game.user;
    game.user = { isGM: true } as any;
    try {
      ring.ready();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      ring.unhook();
      game.user = priorUser;
    }
  });

  test("waits safely when no LED handler is registered", async () => {
    const { ring, socket } = createRing();
    ring.ready();
    await vi.advanceTimersByTimeAsync(100);
    expect(socket.send).not.toHaveBeenCalled();
    ring.unhook();
  });

  test("selects the highest-priority handler and sends only changed states", async () => {
    const { ring, socket } = createRing();
    const low = { priority: 1, updateLEDs: vi.fn(async () => new Uint32Array([1, 2, 3, 4, 5, 6])) };
    const high = { priority: 10, updateLEDs: vi.fn(async () => new Uint32Array([6, 5, 4, 3, 2, 1])) };
    ring.registerHandler(low);
    ring.registerHandler(high);
    ring.registerHandler(high);
    ring.ready();
    await vi.advanceTimersByTimeAsync(100);
    expect(low.updateLEDs).not.toHaveBeenCalled();
    expect(high.updateLEDs).toHaveBeenCalledWith(2);
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
      type: "ambilight", target: "127.0.0.1", universe: 3,
      colors: [6, 5, 4, 3, 2, 1],
    });
    await vi.advanceTimersByTimeAsync(100);
    expect(socket.send).toHaveBeenCalledOnce();
    ring.unregisterHandler(high);
    await vi.advanceTimersByTimeAsync(100);
    expect(low.updateLEDs).toHaveBeenCalledOnce();
    expect(socket.send).toHaveBeenCalledTimes(2);
    ring.unhook();
  });

  test("does not run without the module connection setting or send while unavailable", async () => {
    const { ring, socket } = createRing(false);
    const handler = { priority: 1, updateLEDs: vi.fn(async () => new Uint32Array([1, 2, 3, 4, 5, 6])) };
    ring.registerHandler(handler);
    ring.ready();
    await vi.advanceTimersByTimeAsync(100);
    expect(handler.updateLEDs).toHaveBeenCalledOnce();
    expect(socket.send).not.toHaveBeenCalled();
    socket.isConnected = false;
    await vi.advanceTimersByTimeAsync(100);
    expect(handler.updateLEDs).toHaveBeenCalledOnce();
    ring.unhook();
  });

  test("provides an all-off default handler with neutral priority", async () => {
    class Base {}
    const Handler = TableLEDRingHandlerMixin(Base);
    const handler = new Handler();
    expect(handler.priority).toBe(0);
    expect(await handler.updateLEDs(3)).toEqual(new Uint32Array(9));
  });

  test("contains socket send failures and retries unchanged LED data", async () => {
    const { ring, socket } = createRing();
    socket.send.mockImplementationOnce(() => { throw new Error("disconnected during send"); });
    const handler = {
      priority: 1,
      updateLEDs: vi.fn(async () => new Uint32Array([1, 2, 3, 4, 5, 6])),
    };
    ring.registerHandler(handler);
    ring.ready();
    await vi.advanceTimersByTimeAsync(100);
    expect(socket.send).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(100);
    expect(socket.send).toHaveBeenCalledTimes(2);
    ring.unhook();
  });
});
