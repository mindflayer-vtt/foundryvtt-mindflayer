import { afterEach, expect, test, vi } from "vitest";
import { isBeamerUser, beamerCameraMode } from "../../src/js/utils/beamer";

afterEach(() => vi.unstubAllGlobals());
test("only the selected Beamer specializes the default camera mode", () => {
  vi.stubGlobal("game", { user: { id: "display" }, settings: { get: () => "display" } });
  expect(isBeamerUser()).toBe(true);
  expect(beamerCameraMode("default")).toBe("focusPlayers");
  expect(beamerCameraMode("off")).toBe("off");
  expect(beamerCameraMode("focusPlayers")).toBe("focusPlayers");
  game.user.id = "ordinary-player";
  expect(isBeamerUser()).toBe(false);
  expect(beamerCameraMode("default")).toBe("default");
  game.user = null;
  expect(isBeamerUser()).toBe(false);
  game.userId = "display";
  expect(isBeamerUser()).toBe(true);
  expect(beamerCameraMode("default")).toBe("focusPlayers");
});
