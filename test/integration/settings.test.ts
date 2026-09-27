import { beforeEach, describe, expect, test, vi } from "vitest";

const { reload } = vi.hoisted(() => ({ reload: vi.fn() }));
vi.mock("../../src/js/modules/loader", () => ({ reload }));
vi.mock("../../src/js/utils/module", () => ({ getModuleInstance: () => ({ id: "instance" }) }));

import { settings } from "../../src/js/settings";

describe("settings reconfiguration boundaries", () => {
  beforeEach(() => {
    (globalThis as any).location = { reload: vi.fn() };
    settings.init();
  });

  test("the master enable setting intentionally performs a full-page reload", () => {
    game.settings.registrations.get("mindflayer-token-controller.enabled").onChange();
    expect(location.reload).toHaveBeenCalledOnce();
    expect(reload).not.toHaveBeenCalled();
  });

  test("all websocket settings selectively reload Socket and its dependants", () => {
    for (const key of ["websocketHost", "websocketPort", "websocketPath"]) {
      game.settings.registrations.get(`mindflayer-token-controller.${key}`).onChange();
    }
    expect(reload).toHaveBeenCalledTimes(3);
    for (const call of reload.mock.calls) expect(call[1]).toBe("Socket");
  });

  test("camera mode selectively reloads CameraControl", () => {
    const camera = game.settings.registrations.get("mindflayer-token-controller.cameraControl");
    expect(camera.scope).toBe("client");
    camera.onChange();
    expect(reload).toHaveBeenCalledWith({ id: "instance" }, "CameraControl");
  });

  test("registers the complete persistent settings contract", () => {
    const registrations = game.settings.registrations;
    expect(registrations.size).toBe(18);
    expect(registrations.get("mindflayer-token-controller.settings")).toMatchObject({
      scope: "world", type: Object, config: false, default: { mappings: {} },
    });
    expect(registrations.get("mindflayer-token-controller.beamerUserId")).toMatchObject({
      scope: "world", type: String, default: "", config: false, restricted: true,
    });
    expect(registrations.get("mindflayer-token-controller.ambilightUniverse").range)
      .toEqual({ min: 1, max: 255, step: 1 });
    expect(registrations.get("mindflayer-token-controller.ambilightLEDCount").range)
      .toEqual({ min: 1, max: 170, step: 1 });
    expect(registrations.get("mindflayer-token-controller.combatIndicator.playerReactionTime"))
      .toMatchObject({ default: 6, range: { min: 0, max: 60, step: 1 } });
    expect(game.settings.registerMenu).toHaveBeenCalledTimes(2);
  });

  test("projects registered values through the nested runtime settings facade", () => {
    const values: Record<string, any> = {
      enabled: true,
      settings: { mappings: { player: "controller" } },
      combatSkipDefeated: false,
      websocketHost: "broker.example",
      websocketPort: "10443",
      websocketPath: "/table",
      cameraControl: "off",
      ambilightEnabled: true,
      ambilightTarget: "10.0.0.2",
      ambilightUniverse: 2,
      ambilightFPS: 12.5,
      ambilightLEDCount: 42,
      ambilightOffset: -3,
      ambilightBrightnessMin: 4,
      ambilightBrightnessMax: 200,
      combatIndicatorTacticalDuration: 20,
      "combatIndicator.playerReactionTime": 8,
    };
    game.settings.get.mockImplementation((scope: string, key: string) =>
      scope === "core" && key === "noCanvas" ? true : values[key as keyof typeof values],
    );
    expect(settings.enabled).toBe(true);
    expect(settings.settings).toEqual({ mappings: { player: "controller" } });
    expect(settings.skipDefeated).toBe(false);
    expect(settings.core.noCanvas).toBe(true);
    expect(settings.websocket).toMatchObject({
      host: "broker.example", port: "10443", path: "/table",
      url: "wss://broker.example:10443/table",
    });
    expect(settings.camera.control).toBe("off");
    expect(settings.ambilight.enabled).toBe(true);
    expect(settings.ambilight.target).toBe("10.0.0.2");
    expect(settings.ambilight.universe).toBe(2);
    expect(settings.ambilight.fps).toBe(12.5);
    expect(settings.ambilight.led).toMatchObject({ count: 42, offset: -3 });
    expect(settings.ambilight.brightness).toMatchObject({ min: 4, max: 200 });
    expect(settings.combatIndicator).toMatchObject({
      tacticalDiscussionDuration: 20, playerReactionTime: 8,
    });
  });
});
