import { beforeEach, describe, expect, test, vi } from "vitest";
import BeamerPresentation from "../../src/js/modules/beamerPresentation";
import CameraControl from "../../src/js/modules/cameraControl";
import Fullscreen from "../../src/js/modules/fullscreen";

describe("managed Beamer presentation", () => {
  let values, fullscreen, instance;

  beforeEach(() => {
    values = { beamerUserId: "beamer", cameraControl: "default", enabled: false };
    fullscreen = { enabled: false };
    vi.stubGlobal("game", {
      user: { id: "beamer" }, canvas: { initialized: true },
      settings: {
        get: vi.fn((_namespace, key) => values[key]),
        set: vi.fn(async (_namespace, key, value) => { values[key] = value; }),
      },
    });
    instance = { modules: { [Fullscreen.name]: fullscreen } };
  });

  test("starts only for the selected Beamer and requests its dependencies", () => {
    expect(BeamerPresentation.shouldStart()).toBe(true);
    expect(BeamerPresentation.moduleDependencies).toEqual([CameraControl.name, Fullscreen.name]);
    game.user.id = "gm";
    expect(BeamerPresentation.shouldStart()).toBe(false);
  });

  test("sets client defaults before the enable-setting reload", async () => {
    const presentation = new BeamerPresentation(instance);
    presentation.ready();
    await vi.waitFor(() => expect(game.settings.set).toHaveBeenCalledTimes(2));
    expect(game.settings.set.mock.calls.map(call => call.slice(1))).toEqual([
      ["cameraControl", "focusPlayers"], ["enabled", true],
    ]);
    expect(fullscreen.enabled).toBe(false);
  });

  test("enables fullscreen once an already configured client is ready", async () => {
    values.cameraControl = "focusPlayers";
    values.enabled = true;
    const presentation = new BeamerPresentation(instance);
    presentation.ready();
    await vi.waitFor(() => expect(fullscreen.enabled).toBe(true));
    expect(game.settings.set).not.toHaveBeenCalled();
  });

  test("waits for the canvas and removes its listener when unloaded", async () => {
    values.cameraControl = "focusPlayers";
    values.enabled = true;
    game.canvas.initialized = false;
    const presentation = new BeamerPresentation(instance);
    presentation.ready();
    await Promise.resolve();
    expect(fullscreen.enabled).toBe(false);
    Hooks.call("canvasReady");
    expect(fullscreen.enabled).toBe(true);

    fullscreen.enabled = false;
    const unloaded = new BeamerPresentation(instance);
    unloaded.ready();
    await Promise.resolve();
    unloaded.unhook();
    Hooks.call("canvasReady");
    expect(fullscreen.enabled).toBe(false);
  });
});
