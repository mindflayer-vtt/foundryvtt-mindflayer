import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/js/MindFlayer", () => ({ default: class MindFlayer {} }));

import Socket from "../src/js/modules/socket";
import protocol from "./fixtures/protocol.json";

class FakeWebSocket {
  static instances = [];
  OPEN = 1;
  readyState = 0;
  listeners = {};
  send = vi.fn();
  close = vi.fn();

  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type, callback) {
    this.listeners[type] = callback;
  }

  emit(type, data = {}) {
    if (type === "open") this.readyState = this.OPEN;
    this.listeners[type](data);
  }
}

describe("Foundry WebSocket boundary", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    globalThis.WebSocket = FakeWebSocket;
    globalThis.ui = { notifications: { info: vi.fn(), error: vi.fn() } };
    globalThis.game = {
      users: { players: protocol.receiverRegistration.players },
      i18n: { format: vi.fn(() => "connected"), localize: vi.fn(() => "closed") },
    };
  });

  test("connects to configured URL and registers the receiver with players", () => {
    const socket = new Socket({
      settings: {
        enabled: true,
        websocket: { url: "wss://server/ws", host: "server", port: 10443, path: "/ws" },
      },
    });
    socket.ready();
    const connection = FakeWebSocket.instances[0];
    expect(connection.url).toBe("wss://server/ws");
    connection.emit("open");
    expect(JSON.parse(connection.send.mock.calls[0][0])).toEqual(
      protocol.receiverRegistration,
    );
  });

  test("dispatches parsed messages, isolates handler errors, and ignores unsupported messages", () => {
    const socket = new Socket({ settings: { enabled: false } });
    const first = vi.fn(() => { throw new Error("handler failure"); });
    const second = vi.fn();
    socket.registerListener("key-event", first);
    socket.registerListener("key-event", second);
    expect(() => socket._onmessage({
      data: JSON.stringify(protocol.keyEvent),
    })).not.toThrow();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(() => socket._onmessage({ data: "{}" })).not.toThrow();
    expect(() => socket._onmessage({ data: JSON.stringify({ type: "unknown" }) })).not.toThrow();
  });

  test("preserves canonical payloads for every message crossing the Foundry socket", () => {
    const socket = new Socket({ settings: { enabled: false } });
    for (const message of [
      protocol.controllerRegistration,
      protocol.keyEvent,
      protocol.configuration,
      protocol.keyboardLogin,
      protocol.ambilight,
    ]) {
      const handler = vi.fn();
      socket.registerListener(message.type, handler);
      socket._onmessage({ data: JSON.stringify(message) });
      expect(handler).toHaveBeenCalledWith(message);
      expect(Object.isFrozen(handler.mock.calls[0][0])).toBe(true);
    }
  });

  test("propagates malformed JSON as the existing implementation does", () => {
    const socket = new Socket({ settings: { enabled: false } });
    expect(() => socket._onmessage({ data: "{" })).toThrow(SyntaxError);
  });

  test("registers, unregisters, and isolates multiple listeners", () => {
    const socket = new Socket({ settings: { enabled: false } });
    const first = vi.fn();
    const second = vi.fn();
    socket.registerListener("key-event", first);
    socket.registerListener("key-event", second);
    socket.unregisterListener("key-event", first);
    socket._dispatch(protocol.keyEvent);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  test("sends only while connected and reports connection state", () => {
    const socket = new Socket({
      settings: { enabled: true, websocket: { url: "wss://server/ws" } },
    });
    socket.ready();
    const connection = FakeWebSocket.instances[0];
    expect(socket.isConnected).toBe(false);
    expect(() => socket.send("payload")).toThrow(ReferenceError);
    connection.emit("open");
    expect(socket.isConnected).toBe(true);
    socket.send("payload");
    expect(connection.send).toHaveBeenLastCalledWith("payload");
  });

  test("reconnects after close but not after unload", () => {
    vi.useFakeTimers();
    const socket = new Socket({
      settings: { enabled: true, websocket: { url: "wss://server/ws" } },
    });
    socket.ready();
    FakeWebSocket.instances[0].emit("close");
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(4999);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1].emit("close");
    socket.unhook();
    vi.advanceTimersByTime(5000);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  test("closes on connection error and cleans up on unhook", () => {
    const socket = new Socket({
      settings: { enabled: true, websocket: { url: "wss://server/ws" } },
    });
    socket.ready();
    const connection = FakeWebSocket.instances[0];
    connection.emit("error", new Error("network"));
    expect(connection.close).toHaveBeenCalledOnce();
    connection.readyState = connection.OPEN;
    socket.unhook();
    expect(connection.send).toHaveBeenCalledWith(expect.stringContaining('"status":"disconnected"'));
    expect(connection.close).toHaveBeenCalledTimes(2);
    expect(socket.loaded).toBe(false);
  });
});
