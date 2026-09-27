import { describe, expect, test } from "vitest";
import Keypad from "../../src/js/modules/ControllerManager/Keypad";

function keypad() {
  const instance = { settings: { settings: { mappings: { player: "controller" } } } };
  game.users.contents = [{ id: "player", name: "Player", color: "#123456" }];
  return new Keypad(instance, "controller");
}

describe("Keypad state", () => {
  test("exposes the fixed physical key inventory and ignores unknown keys", () => {
    const pad = keypad();
    expect(pad.keys).toEqual(["Q", "W", "E", "A", "S", "D", "Z", "X", "C", "SHI", "SPC"]);
    expect(() => pad.registerKeyEvent({ key: "UNKNOWN", state: "down" })).not.toThrow();
    expect(pad.isDown("UNKNOWN")).toBe(false);
    expect(pad.isJustDown("UNKNOWN", 1)).toBe(false);
    expect(pad.isRepeatedDown("UNKNOWN", 1)).toBe(false);
  });

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
    expect(() => {
      // @ts-expect-error Deliberately exercises runtime validation of an invalid value.
      pad.rotation = "bad";
    }).toThrow(TypeError);
  });

  test("initializes missing rotation to zero and normalizes values above one turn", () => {
    const pad = keypad();
    game.user.getFlag.mockReturnValue(undefined);
    expect(pad.rotation).toBe(0);
    expect(game.user.setFlag).toHaveBeenLastCalledWith(
      "mindflayer-token-controller", "controllerRotation_controller", 0,
    );
    pad.rotation = 810;
    expect(game.user.setFlag).toHaveBeenLastCalledWith(
      "mindflayer-token-controller", "controllerRotation_controller", 90,
    );
  });

  test("synchronizes repeat timing across simultaneous movement keys", () => {
    const pad = keypad();
    pad.registerKeyEvent({ key: "W", state: "down" });
    pad.registerKeyEvent({ key: "D", state: "down" });
    expect(pad.isRepeatedDown("W", 100)).toBe(true);
    expect(pad.isRepeatedDown("D", 200)).toBe(true);
    pad.syncRepetitions(["W", "D"], 250);
    expect(pad.isRepeatedDown("W", 450)).toBe(false);
    expect(pad.isRepeatedDown("D", 450)).toBe(false);
    expect(pad.isRepeatedDown("W", 451)).toBe(true);
    expect(pad.isRepeatedDown("D", 451)).toBe(true);
    expect(() => pad.syncRepetitions("W" as any, 500)).not.toThrow();
    expect(() => pad.syncRepetitions(["W"], 500)).not.toThrow();
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

  test("uses legacy player colors, unassigned defaults, and rejects unknown LED indexes", () => {
    const instance = { settings: { settings: { mappings: { player: "controller" } } } };
    game.users.contents = [{ id: "player", name: "Player", data: { color: "#654321" } }];
    const assigned = new Keypad(instance, "controller");
    expect(assigned.peekLEDs()).toEqual(["#654321", "#654321"]);
    const unassigned = new Keypad(instance, "other");
    expect(unassigned.peekLEDs()).toEqual(["#00FF00", "#000000"]);
    unassigned.getLEDsIfChanged();
    unassigned.setLED(2, "#ffffff");
    expect(unassigned.peekLEDs()).toEqual(["#00FF00", "#000000"]);
    expect(unassigned.getLEDsIfChanged()).toBeNull();
  });

  test("returns no token without a player or initialized canvas", () => {
    const instance = { settings: { settings: { mappings: {} } } };
    const pad = new Keypad(instance, "controller");
    expect(pad.player).toBeNull();
    expect(pad.token).toBeNull();
    instance.settings.settings.mappings = { player: "controller" };
    game.users.contents = [{ id: "player", name: "Player" }];
    game.canvas.initialized = false;
    expect(pad.token).toBeNull();
  });
});
