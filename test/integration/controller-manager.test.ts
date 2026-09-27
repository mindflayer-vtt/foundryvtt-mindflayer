import { describe, expect, test, vi } from "vitest";
import Socket from "../../src/js/modules/socket";
import ControllerManager from "../../src/js/modules/ControllerManager";

function createSystem() {
  const instance = {
    settings: { enabled: false, settings: { mappings: { p1: "one", p2: "two" } } },
    modules: {},
  };
  const socket = new Socket(instance);
  vi.spyOn(socket, "send").mockImplementation(() => {});
  instance.modules[Socket.name] = socket;
  const manager = new ControllerManager(instance);
  instance.modules[ControllerManager.name] = manager;
  return { instance, socket, manager };
}

describe("Socket to ControllerManager flow", () => {
  test("registration creates isolated keypads and key events reach only their controller", () => {
    const { socket, manager } = createSystem();
    game.users.contents = [{ id: "p1", name: "One", color: "#112233" }, { id: "p2", name: "Two", color: "#445566" }];
    socket._dispatch({ type: "registration", receiver: true, status: "connected" });
    expect(manager.keypads).toHaveLength(0);
    socket._dispatch({ type: "key-event", "controller-id": "one", key: "Q", state: "down" });
    expect(manager.keypads).toHaveLength(0);
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "one" });
    expect(ui.notifications.info).toHaveBeenCalledWith("Mind Flayer: MindFlayer.Notifications.NewClient");
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "two" });
    socket._dispatch({ type: "key-event", "controller-id": "one", key: "Q", state: "down" });
    expect(manager.keypads[0].player.id).toBe("p1");
    expect(manager.keypads[0].isDown("Q")).toBe(true);
    expect(manager.keypads[1].isDown("Q")).toBe(false);
    socket._dispatch({ type: "registration", receiver: false, status: "disconnected", "controller-id": "one" });
    expect(ui.notifications.warn).toHaveBeenCalledWith("Mind Flayer: MindFlayer.Notifications.ClientDisconnected");
    expect(manager.keypads.map((keypad) => keypad.controllerId)).toEqual(["two"]);
  });

  test("re-registration replaces keypad state and unknown statuses are ignored", () => {
    const { socket, manager } = createSystem();
    game.users.contents = [{ id: "p1", name: "One", color: "#112233" }];
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "one" });
    const original = manager.keypads[0];
    socket._dispatch({ type: "key-event", "controller-id": "one", key: "Q", state: "down" });
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "one" });
    expect(manager.keypads).toHaveLength(1);
    expect(manager.keypads[0]).not.toBe(original);
    expect(manager.keypads[0].isDown("Q")).toBe(false);
    socket._dispatch({ type: "registration", receiver: false, status: "unexpected", "controller-id": "one" });
    expect(manager.keypads).toHaveLength(1);
  });

  test("routes LED acknowledgements to the matching keypad and reads registration snapshots", () => {
    const { socket, manager } = createSystem();
    game.users.contents = [{ id: "p1", name: "One", color: "#112233" }, { id: "p2", name: "Two", color: "#445566" }];
    const appliedLeds = {
      led1: { r: 17, g: 34, b: 51 },
      led2: { r: 68, g: 85, b: 102 },
    };
    socket._dispatch({ type: "led-state", "controller-id": "unknown", deviceAuthenticated: true, appliedLeds });
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "one", deviceAuthenticated: true, appliedLeds });
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "two" });
    expect(manager.keypads[0].getLEDState()).toEqual({
      wanted: ["#112233", "#112233"], current: ["#112233", "#445566"], matches: false,
    });
    expect(manager.keypads[1].getLEDState().current).toBeNull();
    socket._dispatch({ type: "led-state", "controller-id": "one", deviceAuthenticated: true, appliedLeds: null });
    expect(manager.keypads[0].getLEDState().current).toBeNull();
    socket._dispatch({ type: "led-state", "controller-id": "one", deviceAuthenticated: false, appliedLeds });
    expect(manager.keypads[0].getLEDState().current).toBeNull();
    socket._dispatch({ type: "led-state", "controller-id": "two", deviceAuthenticated: true, appliedLeds });
    expect(manager.keypads[1].getLEDState().current).toEqual(["#112233", "#445566"]);
    expect(manager.keypads[0].getLEDState().current).toBeNull();
    manager.unhook();
    expect(() => socket._dispatch({ type: "led-state", "controller-id": "two", deviceAuthenticated: true, appliedLeds })).not.toThrow();
  });

  test("ticks listeners, removes a throwing listener, sends LEDs, and cleans up", () => {
    vi.useFakeTimers();
    const { socket, manager } = createSystem();
    const unregister = vi.spyOn(socket, "unregisterListener");
    game.users.contents = [{ id: "p1", name: "One", color: "#112233" }];
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "one" });
    const throwing = vi.fn(() => { throw new Error("listener"); });
    const healthy = vi.fn();
    manager.registerTickListener(throwing);
    manager.registerTickListener(healthy);
    manager.ready();
    vi.advanceTimersByTime(17);
    expect(throwing).toHaveBeenCalledOnce();
    expect(healthy).toHaveBeenCalledOnce();
    expect(JSON.parse((socket.send as any).mock.calls[0][0])).toEqual({
      type: "configuration", "controller-id": "one",
      led1: { r: 17, g: 34, b: 51 }, led2: { r: 17, g: 34, b: 51 },
    });
    vi.advanceTimersByTime(17);
    expect(throwing).toHaveBeenCalledOnce();
    expect(healthy).toHaveBeenCalledTimes(2);
    manager.unregisterTickListener(healthy);
    manager.unhook();
    expect(unregister.mock.calls.map((call) => call[0])).toEqual(["registration", "key-event", "led-state"]);
    vi.advanceTimersByTime(100);
    expect(healthy).toHaveBeenCalledTimes(2);
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "late" });
    expect(manager.keypads.map((keypad) => keypad.controllerId)).not.toContain("late");
  });
});
