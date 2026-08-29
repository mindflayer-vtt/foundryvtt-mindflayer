import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../src/js/MindFlayer", () => ({ default: class MindFlayer {} }));

import Socket from "../src/js/modules/socket";

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
      users: { players: [{ id: "p1", name: "Player One" }] },
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
    expect(JSON.parse(connection.send.mock.calls[0][0])).toEqual({
      type: "registration",
      status: "connected",
      receiver: true,
      players: [{ id: "p1", name: "Player One" }],
    });
  });

  test("dispatches parsed messages, isolates handler errors, and ignores unsupported messages", () => {
    const socket = new Socket({ settings: { enabled: false } });
    const first = vi.fn(() => { throw new Error("handler failure"); });
    const second = vi.fn();
    socket.registerListener("key-event", first);
    socket.registerListener("key-event", second);
    expect(() => socket._onmessage({ data: JSON.stringify({
      type: "key-event", "controller-id": "controller1", key: "W", state: "down",
    }) })).not.toThrow();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    expect(() => socket._onmessage({ data: "{}" })).not.toThrow();
    expect(() => socket._onmessage({ data: JSON.stringify({ type: "unknown" }) })).not.toThrow();
  });

  test("propagates malformed JSON as the existing implementation does", () => {
    const socket = new Socket({ settings: { enabled: false } });
    expect(() => socket._onmessage({ data: "{" })).toThrow(SyntaxError);
  });
});
