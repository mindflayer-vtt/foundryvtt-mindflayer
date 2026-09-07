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
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "two" });
    socket._dispatch({ type: "key-event", "controller-id": "one", key: "Q", state: "down" });
    expect(manager.keypads[0].player.id).toBe("p1");
    expect(manager.keypads[0].isDown("Q")).toBe(true);
    expect(manager.keypads[1].isDown("Q")).toBe(false);
    socket._dispatch({ type: "registration", receiver: false, status: "disconnected", "controller-id": "one" });
    expect(manager.keypads.map((keypad) => keypad.controllerId)).toEqual(["two"]);
  });

  test("ticks listeners, removes a throwing listener, sends LEDs, and cleans up", () => {
    vi.useFakeTimers();
    const { socket, manager } = createSystem();
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
    expect(JSON.parse(socket.send.mock.calls[0][0])).toEqual({
      type: "configuration", "controller-id": "one",
      led1: { r: 17, g: 34, b: 51 }, led2: { r: 17, g: 34, b: 51 },
    });
    vi.advanceTimersByTime(17);
    expect(throwing).toHaveBeenCalledOnce();
    expect(healthy).toHaveBeenCalledTimes(2);
    manager.unregisterTickListener(healthy);
    manager.unhook();
    vi.advanceTimersByTime(100);
    expect(healthy).toHaveBeenCalledTimes(2);
    socket._dispatch({ type: "registration", receiver: false, status: "connected", "controller-id": "late" });
    expect(manager.keypads.map((keypad) => keypad.controllerId)).not.toContain("late");
  });
});
