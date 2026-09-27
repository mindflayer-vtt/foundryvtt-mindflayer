import { beforeEach, describe, expect, test, vi } from "vitest";
import Fullscreen from "../../src/js/modules/fullscreen";
import SocketlibWrapper from "../../src/js/modules/socketlib";
import WakeLock from "../../src/js/modules/wakeLock";

describe("socketlib wrapper", () => {
  test("registers callbacks once, supports replacement/removal, and forwards executions", async () => {
    const handlers = new Map<string, (...args: any[]) => void>();
    const socket = {
      register: vi.fn((name, callback) => handlers.set(name, callback)),
      executeAsGM: vi.fn(async () => "gm"),
      executeForAllGMs: vi.fn(async () => "all-gms"),
      executeForOtherGMs: vi.fn(async () => "other-gms"),
      executeForEveryone: vi.fn(async () => "everyone"),
      executeForOthers: vi.fn(async () => "others"),
    };
    (window as any).socketlib = { registerModule: vi.fn(() => socket) };
    const wrapper = new SocketlibWrapper({});
    wrapper.ready();
    expect((window as any).socketlib.registerModule).toHaveBeenCalledWith(
      "mindflayer-token-controller",
    );

    const first = vi.fn();
    const replacement = vi.fn();
    wrapper.provide("action", first);
    wrapper.provide("action", replacement);
    expect(socket.register).toHaveBeenCalledOnce();
    handlers.get("action")?.(1, "two");
    expect(first).not.toHaveBeenCalled();
    expect(replacement).toHaveBeenCalledWith(1, "two");
    wrapper.remove("action");
    handlers.get("action")?.("ignored");
    expect(replacement).toHaveBeenCalledOnce();

    await expect(wrapper.executeAsGM("a", 1)).resolves.toBe("gm");
    await expect(wrapper.executeForAllGMs("b", 2)).resolves.toBe("all-gms");
    await expect(wrapper.executeForOtherGMs("c", 3)).resolves.toBe("other-gms");
    await expect(wrapper.executeForEveryone("d", 4)).resolves.toBe("everyone");
    await expect(wrapper.executeForOthers("e", 5)).resolves.toBe("others");
    expect(socket.executeAsGM).toHaveBeenCalledWith("a", 1);
    expect(socket.executeForOthers).toHaveBeenCalledWith("e", 5);
    expect(SocketlibWrapper.shouldStart()).toBe(true);
  });
});

describe("fullscreen client shell", () => {
  let hidden: boolean;
  let imageClose: ReturnType<typeof vi.fn>;
  let wakeLock: { enabled: boolean; ensureWakeLock: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    hidden = false;
    imageClose = vi.fn();
    wakeLock = { enabled: false, ensureWakeLock: vi.fn() };
    vi.stubGlobal("document", { body: {} });
    vi.stubGlobal("jQuery", vi.fn((target) => {
      if (target === document.body) {
        return {
          hasClass: () => hidden,
          addClass: () => { hidden = true; },
          removeClass: () => { hidden = false; },
        };
      }
      return { click: imageClose };
    }));
  });

  function createFullscreen() {
    return new Fullscreen({ modules: { [WakeLock.name]: wakeLock } });
  }

  test("toggles body state, wake lock, and notifications through its keybinding", () => {
    const fullscreen = createFullscreen();
    const binding = game.keybindings.register.mock.calls[0][2];
    expect(binding.editable).toEqual([{ key: "F10" }]);
    binding.onUp();
    expect(fullscreen.enabled).toBe(true);
    expect(wakeLock).toMatchObject({ enabled: true });
    expect(wakeLock.ensureWakeLock).toHaveBeenCalledOnce();
    expect(ui.notifications.clear).toHaveBeenCalledOnce();
    binding.onUp();
    expect(fullscreen.enabled).toBe(false);
    fullscreen.unhook();
  });

  test("blocks token control and downgrades permanent notifications only while hidden", () => {
    const fullscreen = createFullscreen();
    const controlWrapper = libWrapper.register.mock.calls.find(
      (call) => call[1].endsWith("PlaceableObject.prototype.can"),
    )[2];
    const notificationWrapper = libWrapper.register.mock.calls.find(
      (call) => call[1].endsWith("Notifications.prototype.notify"),
    )[2];
    const can = vi.fn(() => "allowed");
    const notify = vi.fn();
    expect(controlWrapper(can, { id: "user" }, "control")).toBe("allowed");
    fullscreen.enabled = true;
    expect(controlWrapper(can, { id: "user" }, "control")).toBe(false);
    expect(controlWrapper(can, { id: "user" }, "update")).toBe("allowed");
    notificationWrapper(notify, "message", "info", { permanent: true, localize: true });
    expect(notify).toHaveBeenLastCalledWith(
      "message", "info", { permanent: false, localize: true },
    );
    fullscreen.enabled = false;
    notificationWrapper(notify, "message", "info", { permanent: true });
    expect(notify).toHaveBeenLastCalledWith("message", "info", { permanent: true });
    fullscreen.unhook();
  });

  test("hides Foundry cursors and closes shared images after the retention delay", () => {
    const fullscreen = createFullscreen();
    const cursor = { constructor: { name: "Cursor" } };
    const control = { visible: true, children: [cursor] };
    canvas.controls = { children: [control, { visible: true, children: [] }] };
    fullscreen.enabled = true;
    vi.advanceTimersByTime(1000);
    expect(control.visible).toBe(false);
    const shareImage = game.socket.on.mock.calls[0][1];
    shareImage();
    vi.advanceTimersByTime(19_999);
    expect(imageClose).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(imageClose).toHaveBeenCalledOnce();
    fullscreen.unhook();
  });
});

describe("wake lock lifecycle", () => {
  test("acquires, reuses, releases, and reacquires browser wake locks", async () => {
    const listeners = new Map<string, () => void>();
    const documentFake = {
      visibilityState: "visible",
      addEventListener: vi.fn((name, callback) => listeners.set(name, callback)),
      removeEventListener: vi.fn(),
    };
    let releaseListener: () => void = () => {};
    const sentinel = {
      released: false,
      addEventListener: vi.fn((_name, callback) => { releaseListener = callback; }),
      release: vi.fn(async () => { sentinel.released = true; releaseListener(); }),
    };
    const request = vi.fn(async () => sentinel);
    vi.stubGlobal("document", documentFake);
    vi.stubGlobal("navigator", { wakeLock: { request } });
    const wake = new WakeLock({});
    wake.ready();
    expect(documentFake.addEventListener).toHaveBeenCalledWith(
      "visibilitychange", expect.any(Function),
    );
    wake.enabled = true;
    await wake.ensureWakeLock();
    await wake.ensureWakeLock();
    expect(request).toHaveBeenCalledOnce();
    wake.enabled = false;
    await wake.ensureWakeLock();
    expect(sentinel.release).toHaveBeenCalledOnce();
    sentinel.released = false;
    wake.enabled = true;
    await wake.ensureWakeLock();
    expect(request).toHaveBeenCalledTimes(2);
    wake.unhook();
    expect(documentFake.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange", listeners.get("visibilitychange"),
    );
  });
});
