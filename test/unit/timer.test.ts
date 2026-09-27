import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/js/modules/loader", () => ({ init: vi.fn(), ready: vi.fn(), reload: vi.fn() }));

import SocketlibWrapper from "../../src/js/modules/socketlib";
import TableLEDRing from "../../src/js/modules/tableLedRing";
import Timer, { SOCKETLIB_TIMER_ADD } from "../../src/js/modules/timer";
import StartTimerDialog from "../../src/js/modules/timer/StartTimerDialog";
import { TimerRenderContainer } from "../../src/js/modules/timer/TimerRenderContainer";
import TimerRunner, { TIMER_ANGLE_START, TIMER_RADIUS } from "../../src/js/modules/timer/TimerRunner";

describe("timer runner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  test("tracks completion and renders the countdown arc and text", async () => {
    const runner = new TimerRunner(1_000, 11_000, { neededRole: 1 });
    await Promise.resolve();
    expect(runner.start).toBe(1_000);
    expect(runner.end).toBe(11_000);
    expect(runner.durationMS).toBe(10_000);
    expect(runner.completion(999)).toBe(-1);
    expect(runner.completion(1_000)).toBe(0);
    expect(runner.completion(6_000)).toBe(0.5);
    expect(runner.completion(11_000)).toBe(1);
    expect(runner.name).toBe("Mind Flayer | TimerRunner: 10s");
    expect(runner.width).toBe(TIMER_RADIUS * 2);
    const indicator: any = runner.children[1];
    const text: any = runner.children[2];
    await runner.update(6_000);
    expect(indicator.arc).toHaveBeenLastCalledWith(
      0, 0, TIMER_RADIUS, TIMER_ANGLE_START, Math.PI * 2 * 0.5 + TIMER_ANGLE_START, true,
    );
    expect(text.text).toBe("5s");
    expect(text.updateText).toHaveBeenCalled();
  });

  test("removes itself and invokes its callback at completion, unless aborted", async () => {
    const removeTimer = vi.fn();
    game.modules.set("mindflayer-token-controller", {
      instance: { modules: { [Timer.name]: { removeTimer } } },
    });
    const onDone = vi.fn();
    new TimerRunner(1_000, 2_000, { onDone });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removeTimer).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();

    removeTimer.mockClear();
    const aborted = new TimerRunner(2_000, 3_000, { onDone });
    await aborted.abort();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(removeTimer).not.toHaveBeenCalled();
  });

  test("rejects display updates while the canvas is unavailable", async () => {
    const runner = new TimerRunner(1_000, 2_000);
    await Promise.resolve();
    canvas.initialized = false;
    await expect(runner.update()).rejects.toBe("Canvas not ready!");
    await runner.abort();
  });
});

describe("start timer dialog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });

  test("parses duration fields, builds a role-scoped timer, and resolves on close", async () => {
    const resolve = vi.fn();
    const dialog = new StartTimerDialog({ callbackResolve: resolve });
    await (dialog as any)._updateObject(null, {
      durationHours: "1", durationMinutes: "2", durationSeconds: "3", neededRole: "2",
    });
    dialog.startTimer();
    await dialog.close();
    expect(resolve).toHaveBeenCalledWith({
      start: 10_000,
      end: 10_000 + 3_723_000,
      options: { neededRole: 2 },
    });
    expect(dialog.title).toBe("Start Timer");
    expect(StartTimerDialog.defaultOptions).toMatchObject({
      id: "mindflayer-token-controller__start-timer-dialog",
      closeOnSubmit: true,
      jQuery: true,
    });
  });

  test("normalizes invalid form values to zero", async () => {
    const resolve = vi.fn();
    const dialog = new StartTimerDialog({ callbackResolve: resolve });
    await (dialog as any)._updateObject(null, {
      durationHours: "bad", durationMinutes: "", durationSeconds: null, neededRole: undefined,
    });
    dialog.startTimer();
    await dialog.close();
    expect(resolve).toHaveBeenCalledWith({
      start: 10_000, end: 10_000, options: { neededRole: 0 },
    });
  });
});

describe("timer rendering container", () => {
  test("centers timers at the bottom of the viewport independent of stage scale", () => {
    const container = new TimerRenderContainer();
    canvas.stage.scale.x = 2;
    canvas.stage.worldTransform = {
      applyInverse: vi.fn((point) => ({ x: point.x / 2, y: point.y / 2 })),
    };
    canvas.app = {
      renderer: { screen: { left: 0, top: 0 } },
      screen: { width: 1000, height: 800 },
    };
    canvas.stage.addChild(container);
    const first: any = new PIXI.Container();
    const second: any = new PIXI.Container();
    container.addChild(first);
    container.addChild(second);
    container.onChildrenChange(2);
    expect(first.position).toEqual({ x: 197.5, y: 320 });
    expect(second.position).toEqual({ x: 417.5, y: 320 });
    expect(first.scale.set).toHaveBeenCalledWith(0.5, 0.5);
    Hooks.call("canvasPan");
    expect(canvas.stage.worldTransform.applyInverse).toHaveBeenCalledTimes(2);
    container.destroy({ children: true });
  });
});

describe("timer module integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  function createTimer(overrides: Record<string, any> = {}) {
    const ring = { registerHandler: vi.fn(), unregisterHandler: vi.fn() };
    const socketlib = {
      provide: vi.fn(), remove: vi.fn(), executeForOthers: vi.fn(async () => {}),
    };
    const instance = {
      settings: {
        core: { noCanvas: false },
        ambilight: {
          enabled: true,
          led: { offset: 0 },
          brightness: { min: 3 },
        },
        ...overrides,
      },
      modules: {
        [TableLEDRing.name]: ring,
        [SocketlibWrapper.name]: socketlib,
      },
    };
    return { timer: new (Timer as any)(instance) as Timer, ring, socketlib };
  }

  test("registers rendering, table, and RPC resources and releases all of them", () => {
    const { timer, ring, socketlib } = createTimer();
    timer.ready();
    expect(canvas.stage.children).toContainEqual(expect.any(TimerRenderContainer));
    expect(ring.registerHandler).toHaveBeenCalledWith(timer);
    expect(socketlib.provide).toHaveBeenCalledWith(SOCKETLIB_TIMER_ADD, expect.any(Function));
    timer.unhook();
    expect(socketlib.remove).toHaveBeenCalledWith(SOCKETLIB_TIMER_ADD);
    expect(ring.unregisterHandler).toHaveBeenCalledWith(timer);
    expect(timer.loaded).toBe(false);
  });

  test("adds locally by role and broadcasts a callback-free representation", async () => {
    const { timer, socketlib } = createTimer();
    timer.ready();
    const onDone = vi.fn();
    const input = { start: 1_000, end: 11_000, options: { neededRole: 1, onDone } };
    await timer.addTimer(input as any);
    expect(timer.priority).toBe(200);
    expect(socketlib.executeForOthers).toHaveBeenCalledWith(
      SOCKETLIB_TIMER_ADD, 1_000, 11_000, { neededRole: 1, onDone: null },
    );
    const rpc = socketlib.provide.mock.calls[0][1];
    game.user.role = 0;
    rpc(1_000, 2_000, { neededRole: 1 });
    expect(timer.priority).toBe(200);
    timer.unhook();
  });

  test("renders trusted timers onto LEDs using green, yellow, and red thresholds", async () => {
    const { timer } = createTimer();
    timer.ready();
    const runner = new TimerRunner(1_000, 10_000, { neededRole: 1 });
    await timer.addTimer(runner);
    for (const [now, color] of [
      [2_000, [0, 255, 0]],
      [5_500, [255, 255, 0]],
      [7_300, [255, 0, 0]],
    ] as const) {
      vi.setSystemTime(now);
      const leds = await timer.updateLEDs(4);
      expect(Array.from(leds)).toEqual(expect.arrayContaining([...color]));
    }
    timer.unhook();
  });

  test("expires timers, runs callbacks, and returns to inactive priority", async () => {
    const { timer } = createTimer();
    timer.ready();
    const onDone = vi.fn();
    const runner = new TimerRunner(1_000, 2_000, { neededRole: 1, onDone });
    await timer.addTimer(runner);
    vi.setSystemTime(2_001);
    expect(await timer.updateLEDs(2)).toEqual(new Uint32Array(6));
    expect(onDone).toHaveBeenCalledOnce();
    expect(timer.priority).toBe(-100);
    await runner.abort();
    timer.unhook();
  });

  test("honors no-canvas and disabled-Ambilight startup while retaining RPC support", () => {
    const { timer, ring, socketlib } = createTimer({
      core: { noCanvas: true },
      ambilight: {
        enabled: false, led: { offset: 0 }, brightness: { min: 0 },
      },
    });
    timer.ready();
    expect(canvas.stage.children).toEqual([]);
    expect(ring.registerHandler).not.toHaveBeenCalled();
    expect(socketlib.provide).toHaveBeenCalledWith(SOCKETLIB_TIMER_ADD, expect.any(Function));
    timer.unhook();
  });

  test("removes active timers from the rendering container", async () => {
    const { timer } = createTimer();
    timer.ready();
    const runner = new TimerRunner(1_000, 5_000, { neededRole: 1 });
    await timer.addTimer(runner);
    const renderingContainer: any = canvas.stage.children[0];
    const internal = renderingContainer.children[0];
    expect(internal).toBeDefined();
    await timer.removeTimer(internal);
    expect(renderingContainer.children).not.toContain(internal);
    await runner.abort();
    timer.unhook();
  });
});
