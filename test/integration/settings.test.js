import { beforeEach, describe, expect, test, vi } from "vitest";

const { reload } = vi.hoisted(() => ({ reload: vi.fn() }));
vi.mock("../../src/js/modules/loader", () => ({ reload }));
vi.mock("../../src/js/utils/module", () => ({ getModuleInstance: () => ({ id: "instance" }) }));

import { settings } from "../../src/js/settings";

describe("settings reconfiguration boundaries", () => {
  beforeEach(() => {
    globalThis.location = { reload: vi.fn() };
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
    game.settings.registrations.get("mindflayer-token-controller.cameraControl").onChange();
    expect(reload).toHaveBeenCalledWith({ id: "instance" }, "CameraControl");
  });
});
