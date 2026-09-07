import { describe, expect, test } from "vitest";
import Keypad from "../../src/js/modules/ControllerManager/Keypad";

function keypad() {
  const instance = { settings: { settings: { mappings: { player: "controller" } } } };
  game.users.contents = [{ id: "player", name: "Player", color: "#123456" }];
  return new Keypad(instance, "controller");
}

describe("Keypad state", () => {
  test("tracks key down/up, repeat timing, and simultaneous states", () => {
    const pad = keypad();
    pad.registerKeyEvent({ key: "Q", state: "down" });
    pad.registerKeyEvent({ key: "W", state: "DOWN" });
    expect(pad.isDown("Q")).toBe(true);
    expect(pad.isDown("W")).toBe(true);
    expect(pad.isJustDown("Q", 100)).toBe(true);
    expect(pad.isJustDown("Q", 101)).toBe(false);
    expect(pad.isRepeatedDown("W", 100)).toBe(true);
    expect(pad.isRepeatedDown("W", 350)).toBe(false);
    expect(pad.isRepeatedDown("W", 351)).toBe(true);
    pad.registerKeyEvent({ key: "Q", state: "up" });
    expect(pad.isDown("Q")).toBe(false);
  });

  test("normalizes rotation and persists it as a Foundry flag", () => {
    const pad = keypad();
    pad.rotation = -90;
    expect(game.user.setFlag).toHaveBeenCalledWith(
      "mindflayer-token-controller",
      "controllerRotation_controller",
      270,
    );
    expect(() => { pad.rotation = "bad"; }).toThrow(TypeError);
  });

  test("associates player/token and reports changed LEDs only once", () => {
    const pad = keypad();
    game.user.getFlag.mockReturnValue("hero");
    canvas.tokens.placeables = [{ id: "hero" }];
    expect(pad.controllerId).toBe("controller");
    expect(pad.player.id).toBe("player");
    expect(pad.token.id).toBe("hero");
    expect(pad.getLEDsIfChanged()).toEqual(["#123456", "#123456"]);
    expect(pad.getLEDsIfChanged()).toBeNull();
    pad.setLED(1, "#abcdef");
    expect(pad.peekLEDs()).toEqual(["#123456", "#abcdef"]);
    expect(pad.getLEDsIfChanged()).toEqual(["#123456", "#abcdef"]);
  });
});
