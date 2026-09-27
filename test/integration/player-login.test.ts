import { describe, expect, test, vi } from "vitest";

vi.mock("../../src/js/modules/loader", () => ({ init: vi.fn(), ready: vi.fn(), reload: vi.fn() }));

import PlayerLogin from "../../src/js/modules/playerLogin";
import Socket from "../../src/js/modules/socket";
import SocketlibWrapper from "../../src/js/modules/socketlib";
import { SOCKETLIB_TIMER_ADD } from "../../src/js/modules/timer";
import type MindFlayer from "../../src/js/MindFlayer";

function createLogin() {
  const listeners = new Map<string, (message: any) => void>();
  const socket = {
    registerListener: vi.fn((type, callback) => listeners.set(type, callback)),
    unregisterListener: vi.fn((type, callback) => {
      if (listeners.get(type) === callback) listeners.delete(type);
    }),
  };
  const provided = new Map<string, (...args: any[]) => void>();
  const socketlib = {
    provide: vi.fn((name, callback) => provided.set(name, callback)),
    remove: vi.fn((name) => provided.delete(name)),
    executeAsGM: vi.fn(async () => {}),
  };
  const settings = { settings: { mappings: {} as Record<string, string> } };
  const instance = {
    settings,
    modules: { [Socket.name]: socket, [SocketlibWrapper.name]: socketlib },
  };
  return {
    login: new PlayerLogin(instance as unknown as MindFlayer), listeners, provided, socket, socketlib, settings,
  };
}

describe("legacy player self-login flow", () => {
  test("forwards keypad login messages to the GM registration RPC", () => {
    const { login, listeners, socketlib } = createLogin();
    login.ready();
    expect(socketlib.provide).toHaveBeenCalledWith(SOCKETLIB_TIMER_ADD, expect.any(Function));
    listeners.get("keyboard-login")?.({
      type: "keyboard-login", "controller-id": "controller-a", "player-id": "player-a",
    });
    expect(socketlib.executeAsGM).toHaveBeenCalledWith(
      "PlayerLogin_register", "controller-a", "player-a",
    );
    listeners.get("keyboard-login")?.({ type: "keyboard-login", "controller-id": "controller-b" });
    expect(socketlib.executeAsGM).toHaveBeenCalledOnce();
  });

  test("persists mappings only on the GM client", async () => {
    const { login, provided, settings } = createLogin();
    login.ready();
    const registration = provided.get(SOCKETLIB_TIMER_ADD)!;
    await registration("controller-a", "player-a");
    expect(game.settings.set).toHaveBeenCalledWith(
      "mindflayer-token-controller",
      "settings",
      { mappings: { "player-a": "controller-a" } },
    );
    expect(settings.settings.mappings).toEqual({});
    game.user.isGM = false;
    await registration("controller-b", "player-b");
    expect(game.settings.set).toHaveBeenCalledTimes(1);
  });

  test("unregisters the exact socket listener and RPC name on unload", () => {
    const { login, listeners, socket, socketlib } = createLogin();
    login.ready();
    const callback = listeners.get("keyboard-login");
    login.unhook();
    expect(socket.unregisterListener).toHaveBeenCalledWith("keyboard-login", callback);
    expect(socketlib.remove).toHaveBeenCalledWith(SOCKETLIB_TIMER_ADD);
    expect(listeners.has("keyboard-login")).toBe(false);
    expect(login.loaded).toBe(false);
  });
});
