import { beforeEach, describe, expect, test, vi } from "vitest";
import Ambilight from "../../src/js/modules/ambilight";
import TableLEDRing from "../../src/js/modules/tableLedRing";

describe("Ambilight table-ring handler", () => {
  function createAmbilight(overrides: Record<string, any> = {}) {
    const ring = { registerHandler: vi.fn(), unregisterHandler: vi.fn() };
    const instance = {
      settings: {
        ambilight: {
          enabled: true,
          led: { offset: -1 },
          brightness: { min: 10, max: 110 },
          ...overrides,
        },
      },
      modules: { [TableLEDRing.name]: ring },
    };
    return { ambilight: new (Ambilight as any)(instance) as Ambilight, ring };
  }

  test("registers only while loaded and exposes active/off priorities", () => {
    const { ambilight, ring } = createAmbilight();
    canvas.initialized = true;
    ambilight.ready();
    expect(ring.registerHandler).toHaveBeenCalledWith(ambilight);
    expect(ambilight.priority).toBe(100);
    ambilight.enabled = false;
    expect(ambilight.priority).toBe(-100);
    ambilight.enabled = true;
    expect(ambilight.priority).toBe(100);
    game.canvas.initialized = false;
    ambilight.enabled = true;
    expect(ambilight.priority).toBe(-100);
    ambilight.unhook();
    expect(ring.unregisterHandler).toHaveBeenCalledWith(ambilight);
  });

  test("captures the WebGL framebuffer on an animation frame", async () => {
    const { ambilight } = createAmbilight();
    const gl = {
      drawingBufferWidth: 2,
      drawingBufferHeight: 3,
      RGBA: 6408,
      UNSIGNED_BYTE: 5121,
      readPixels: vi.fn((_x, _y, _w, _h, _rgba, _type, image) => image.fill(7)),
    };
    game.canvas.app = { renderer: { gl } };
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    const result: any = await ambilight.loadPixels();
    expect(gl.readPixels).toHaveBeenCalledWith(0, 0, 2, 3, 6408, 5121, result.image);
    expect(result).toMatchObject({ drawingBufferWidth: 2, drawingBufferHeight: 3 });
    expect(result.image).toHaveLength(27);
    expect([...result.image]).toEqual(new Array(27).fill(7));
  });

  test("rejects framebuffer capture failures", async () => {
    const { ambilight } = createAmbilight();
    game.canvas.app = { renderer: { get gl() { throw new Error("context lost"); } } };
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    await expect(ambilight.loadPixels()).rejects.toThrow("context lost");
  });

  test("maps sampled RGB channels into the configured brightness range", () => {
    const { ambilight } = createAmbilight();
    const image = new Uint8Array([
      255, 0, 128, 255,
      64, 128, 255, 255,
    ]);
    const samples = [0, 4];
    const directions: Array<{ x: number; y: number }> = [];
    vi.spyOn(ambilight as any, "_findColorAlongVector").mockImplementation(
      (...args: unknown[]) => {
        const direction = args[2] as { x: number; y: number };
        directions.push({ x: direction.x, y: direction.y });
        return samples.shift();
      },
    );
    expect((ambilight as any)._compileLEDData({
      image, drawingBufferWidth: 2, drawingBufferHeight: 1,
    }, 2)).toEqual(new Uint32Array([110, 10, 60, 35, 60, 110]));
    expect(directions).toHaveLength(2);
    expect(directions[0].y).toBeCloseTo(-1);
  });

  test("searches inward from the framebuffer edge for non-background pixels", () => {
    const { ambilight } = createAmbilight();
    game.scenes.active = { backgroundColor: "#000000" };
    const image = new Uint8Array(10 * 10 * 4);
    const coloredIndex = (5 + 8 * 10) * 4;
    image.set([20, 40, 60, 255], coloredIndex);
    const bounds = {
      p0: { x: 0, y: 0 }, p1: { x: 10, y: 10 }, center: { x: 5, y: 5 },
      intersectionFromCenter: () => 4,
    };
    expect((ambilight as any)._findColorAlongVector(
      image, bounds, { x: 0, y: 1, scale(factor: number) { this.x *= factor; this.y *= factor; } },
    )).toBe(coloredIndex);
    image.fill(0);
    expect((ambilight as any)._findColorAlongVector(
      image, bounds, { x: 1, y: 0, scale(factor: number) { this.x *= factor; this.y *= factor; } },
    )).toBe((5 + 5 * 10) * 4);
  });

  test("suppresses all-black output and disabled updates", async () => {
    const { ambilight } = createAmbilight();
    vi.spyOn(ambilight as any, "_findColorAlongVector").mockReturnValue(0);
    expect((ambilight as any)._compileLEDData({
      image: new Uint8Array(4), drawingBufferWidth: 1, drawingBufferHeight: 1,
    }, 1)).toBeNull();
    ambilight.enabled = false;
    const load = vi.spyOn(ambilight, "loadPixels");
    await expect(ambilight.updateLEDs(3)).resolves.toBeUndefined();
    expect(load).not.toHaveBeenCalled();
  });

  test("returns compiled pixels when enabled", async () => {
    const { ambilight } = createAmbilight();
    ambilight.enabled = true;
    const raw = { image: new Uint8Array([1, 2, 3, 255]), drawingBufferWidth: 1, drawingBufferHeight: 1 };
    vi.spyOn(ambilight, "loadPixels").mockResolvedValue(raw);
    vi.spyOn(ambilight as any, "_compileLEDData").mockReturnValue(new Uint32Array([1, 2, 3]));
    await expect(ambilight.updateLEDs(1)).resolves.toEqual(new Uint32Array([1, 2, 3]));
  });
});
