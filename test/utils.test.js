import { describe, expect, test } from "vitest";
import { deg2rad, Rectangle, Vector } from "../src/js/utils/2d-geometry";
import { hexToRgb } from "../src/js/utils/color";
import Key from "../src/js/modules/ControllerManager/Key";
import {
  createAmbilightMessage,
  createControllerConfiguration,
  createReceiverRegistration,
} from "../src/js/utils/protocol";
import protocol from "./fixtures/protocol.json";

describe("controller geometry", () => {
  test("rotates and combines movement vectors", () => {
    const direction = new Vector(0, -1).rotate(deg2rad(90));
    expect(direction.x).toBeCloseTo(1);
    expect(direction.y).toBeCloseTo(0);
    const diagonal = direction.add(new Vector(0, 1));
    expect(diagonal.x).toBeCloseTo(1);
    expect(diagonal.y).toBeCloseTo(1);
    expect(new Vector(3, 4).length()).toBe(5);
  });

  test("normalizes rectangle bounds and detects intersections", () => {
    const rectangle = new Rectangle(new Vector(10, 10), new Vector(0, 0));
    expect(rectangle.center).toEqual(new Vector(5, 5));
    expect(rectangle.intersect(new Rectangle(new Vector(9, 9), new Vector(12, 12)))).toBe(true);
    expect(rectangle.intersect(new Rectangle(new Vector(11, 11), new Vector(12, 12)))).toBe(false);
  });
});

describe("protocol color conversion", () => {
  test("serializes valid LED colors and rejects invalid input", () => {
    expect(hexToRgb("#00ff7F")).toEqual({ r: 0, g: 255, b: 127 });
    expect(hexToRgb("invalid")).toBeNull();
  });
});

describe("outbound protocol messages", () => {
  test("creates the canonical receiver registration", () => {
    expect(
      createReceiverRegistration(protocol.receiverRegistration.players),
    ).toEqual(protocol.receiverRegistration);
  });

  test("creates the canonical controller configuration", () => {
    expect(
      createControllerConfiguration(
        protocol.configuration["controller-id"],
        protocol.configuration.led1,
        protocol.configuration.led2,
      ),
    ).toEqual(protocol.configuration);
  });

  test("creates the canonical numeric ambilight slots", () => {
    expect(
      createAmbilightMessage(
        protocol.ambilight.target,
        protocol.ambilight.universe,
        new Uint32Array(protocol.ambilight.colors),
      ),
    ).toEqual(protocol.ambilight);
  });
});

describe("key state", () => {
  test("reports initial and repeated presses with the existing 250ms interval", () => {
    const key = new Key();
    key.down = true;
    expect(key.isJustDown(100)).toBe(true);
    expect(key.isJustDown(101)).toBe(false);
    expect(key.isRepeatedDown(100)).toBe(true);
    expect(key.isRepeatedDown(350)).toBe(false);
    expect(key.isRepeatedDown(351)).toBe(true);
    key.down = false;
    expect(key.isRepeatedDown(1000)).toBe(false);
  });
});
