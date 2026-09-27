import { expect, test } from "@playwright/test";
import fs from "node:fs";

const wrapperBoundaries = JSON.parse(
  fs.readFileSync("test/fixtures/libwrapper-boundaries.json", "utf8"),
);

const configured = Boolean(process.env.FOUNDRY_URL);

test.describe("real Foundry compatibility", () => {
  test.skip(!configured, "FOUNDRY_URL is not configured");

  test("Mindflayer and its critical Foundry 14 boundaries are available", async ({ page }) => {
    const startupErrors: string[] = [];
    const consoleWarnings: Array<{ text: string; url: string }> = [];
    await page.addInitScript(() => {
      globalThis.__mindflayerWindowErrors = [];
      globalThis.addEventListener("error", (event) => {
        globalThis.__mindflayerWindowErrors.push(event.error?.stack ?? event.message);
      });
      globalThis.addEventListener("unhandledrejection", (event) => {
        globalThis.__mindflayerWindowErrors.push(event.reason?.stack ?? String(event.reason));
      });
      const NativeWebSocket = globalThis.WebSocket;
      class MindflayerSocket {
        OPEN = 1;
        readyState = 1;
        listeners = new Map();
        sent = [];
        constructor() {
          (globalThis.__mindflayerSockets ??= []).push(this);
          queueMicrotask(() => this.listeners.get("open")?.forEach((fn) => fn(new Event("open"))));
        }
        addEventListener(type, listener) {
          if (!this.listeners.has(type)) this.listeners.set(type, []);
          this.listeners.get(type).push(listener);
        }
        send(data) {
          this.sent.push(data);
        }
        close() {
          this.readyState = 3;
        }
      }
      (globalThis as any).WebSocket = class WebSocketProxy {
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;
        constructor(url, protocols) {
          if (String(url).startsWith("wss://localhost:443/")) return new MindflayerSocket();
          return new NativeWebSocket(url, protocols);
        }
      };
    });
    page.on("pageerror", (error) => startupErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") startupErrors.push(`console: ${message.text()}`);
      if (message.type() === "warning") {
        consoleWarnings.push({ text: message.text(), url: message.location().url });
      }
    });
    const target = new URL(process.env.FOUNDRY_URL);
    if (process.env.FOUNDRY_TEST_WORLD) {
      target.pathname = "/join";
      target.searchParams.set("world", process.env.FOUNDRY_TEST_WORLD);
    }
    await page.goto(target.toString());

    if (process.env.FOUNDRY_TEST_PASSWORD) {
      const user = process.env.FOUNDRY_TEST_USER;
      if (user) {
        const userSelect = page.locator('select[name="userid"], select[name="user"]');
        if (await userSelect.count()) await userSelect.selectOption({ label: user });
        else await page.locator('input[name="username"]').fill(user);
      }
      await page.locator("input[name=password]").fill(process.env.FOUNDRY_TEST_PASSWORD);
      await page.locator("button[name=join]").click();
    }

    await expect
      .poll(() => page.evaluate(() => (globalThis as any).game?.ready === true), {
        message: `Foundry did not reach game.ready at ${page.url()}`,
        timeout: 30_000,
      })
      .toBe(true);
    if (await page.evaluate(() => game.settings.get("mindflayer-token-controller", "enabled"))) {
      await page
        .evaluate(() => game.settings.set("mindflayer-token-controller", "enabled", false))
        .catch(() => {});
      await page.waitForLoadState("domcontentloaded");
      await expect
        .poll(
          () => page.evaluate(() => (globalThis as any).game?.ready === true).catch(() => false),
          { timeout: 30_000 },
        )
        .toBe(true);
    }

    const disabledModules = await page.evaluate(() => {
      const instance = game.modules.get("mindflayer-token-controller").instance;
      return {
        isGM: game.user.isGM,
        names: Object.keys(instance.modules),
        connected: instance.modules.Socket?.isConnected,
      };
    });
    expect(disabledModules.isGM).toBe(true);
    expect(disabledModules.names).toEqual(expect.arrayContaining(["Socket", "ControllerManager"]));
    expect(disabledModules.names).not.toEqual(expect.arrayContaining([
      "DoorHandler", "TokenMovement", "TokenTorch", "CameraControl",
    ]));
    expect(disabledModules.connected).toBe(true);

    await page.evaluate(() => {
      game.modules.get("mindflayer-token-controller").instance.modules.Socket._dispatch({
        type: "registration",
        receiver: false,
        status: "connected",
        "controller-id": "disabled-gm-controller",
      });
    });

    await page.evaluate(() => {
      const menu = game.settings.menus.get(
        "mindflayer-token-controller.mindflayer-token-controller",
      );
      globalThis.__mindflayerSmokeConfig = new menu.type();
      globalThis.__mindflayerSmokeConfig.render(true);
    });
    const config = page.locator("#mindflayer-token-controller-config");
    await expect(config).toBeVisible();
    await expect(config.locator('select[name^="mappings"]')).toHaveCount(1);
    await expect(config.locator('input[name^="mappings"]')).toHaveCount(0);
    await expect(config.locator('select[name^="mappings"] option[value="disabled-gm-controller"]')).toHaveCount(1);
    await page.evaluate(() => globalThis.__mindflayerSmokeConfig.close());

    const state = await page.evaluate(async (boundaries) => {
      const resolve = (path) => {
        const [root, ...parts] = path.split(".");
        // Foundry 12 exposes core classes as global lexical bindings rather
        // than properties of window/globalThis.
        return parts.reduce((value, part) => value?.[part], globalThis.eval(root));
      };
      const macroPack = game.packs.get(
        "mindflayer-token-controller.mindflayer-token-controller-macros",
      );
      const macroIndex = await macroPack?.getIndex();
      const timerMacro = macroPack
        ? await macroPack.getDocument("g6tqix26wcRSjOBR")
        : null;
      return {
        foundryVersion: game.version,
        world: { id: game.world.id, title: game.world.title, system: game.system.id },
        user: { name: game.user.name, isGM: game.user.isGM },
        moduleActive: game.modules.get("mindflayer-token-controller")?.active,
        moduleVersion: game.modules.get("mindflayer-token-controller")?.version,
        instanceLoaded: Boolean(game.modules.get("mindflayer-token-controller")?.instance),
        dependencies: Object.fromEntries(
          ["lib-wrapper", "socketlib"].map((id) => [
            id,
            { version: game.modules.get(id)?.version, active: game.modules.get(id)?.active },
          ]),
        ),
        canvasReady: game.canvas?.initialized === true,
        settingsReadable: game.settings.get("mindflayer-token-controller", "enabled") !== undefined,
        macroPack: {
          available: Boolean(macroPack),
          size: macroIndex?.size,
          timerName: timerMacro?.name,
          timerCommand: timerMacro?.command,
        },
        globals: ["game", "canvas", "Hooks", "foundry"].every((name) => globalThis[name]),
        pixiGlobals: ["Container", "Graphics", "LegacyGraphics", "Text", "Point"].every(
          (name) => typeof PIXI[name] === "function",
        ),
        targets: boundaries.map(({ target, maximumFoundry }) => {
          const applicable =
            maximumFoundry === undefined ||
            Number(game.version.split(".")[0]) <= maximumFoundry;
          return {
            target,
            applicable,
            exists: applicable ? typeof resolve(target) === "function" : false,
          };
        }),
      };
    }, wrapperBoundaries);
    expect(state).toMatchObject({
      foundryVersion: "14.367",
      moduleActive: true,
      instanceLoaded: true,
      canvasReady: true,
      settingsReadable: true,
      macroPack: {
        available: true,
        size: 1,
        timerName: "Start Timer",
      },
      globals: true,
      pixiGlobals: true,
    });
    expect(state.targets).toHaveLength(wrapperBoundaries.length);
    expect(state.targets.filter(({ applicable, exists }) => applicable && !exists)).toEqual([]);
    expect(state.macroPack.timerCommand).toContain(".instance.modules.Timer.dialog()");
    await page
      .evaluate(() => game.settings.set("mindflayer-token-controller", "enabled", true))
      .catch(() => {});
    await page.waitForLoadState("domcontentloaded");
    await expect
      .poll(
        () => page.evaluate(() => (globalThis as any).game?.ready === true).catch(() => false),
        { timeout: 30_000 },
      )
      .toBe(true);
    const loadedSubmodules = await page.evaluate(() =>
      Object.keys(game.modules.get("mindflayer-token-controller").instance.modules),
    );
    expect(loadedSubmodules).toEqual(
      expect.arrayContaining(["Socket", "ControllerManager", "CameraControl", "DoorHandler", "TokenTorch"]),
    );
    const receiverProtocol = await page.evaluate(() =>
      globalThis.__mindflayerSockets.flatMap((socket) =>
        socket.sent.map((payload) => JSON.parse(payload)),
      ),
    );
    expect(receiverProtocol).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "registration",
          receiver: true,
          status: "connected",
          players: expect.any(Array),
        }),
      ]),
    );

    const behavior = await page.evaluate(async () => {
      const moduleId = "mindflayer-token-controller";
      const controllerId = "smoke-controller";
      const scene = canvas.scene;
      const priorMappings = structuredClone(game.settings.get(moduleId, "settings"));
      const selectedTokenFlag = `selectedToken_${game.user.id}`;
      const priorSelectedToken = game.user.getFlag(moduleId, selectedTokenFlag);
      let tokenDocument;
      let wallDocument;

      const waitFor = async (predicate, message, timeout = 5000) => {
        const started = Date.now();
        while (!predicate()) {
          if (Date.now() - started > timeout) throw new Error(message);
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      };

      try {
        [tokenDocument] = await scene.createEmbeddedDocuments("Token", [
          { name: "Mindflayer Smoke Token", x: 500, y: 500, width: 1, height: 1 },
        ]);
        [wallDocument] = await scene.createEmbeddedDocuments("Wall", [
          {
            c: [550, 500, 550, 600],
            door: CONST.WALL_DOOR_TYPES.DOOR,
            ds: CONST.WALL_DOOR_STATES.CLOSED,
          },
        ]);
        await game.settings.set(moduleId, "settings", {
          ...priorMappings,
          mappings: { ...priorMappings.mappings, [game.user.id]: controllerId },
        });
        await game.user.setFlag(moduleId, selectedTokenFlag, tokenDocument.id);

        const instance = game.modules.get(moduleId).instance;
        const socket = instance.modules.Socket;
        socket._dispatch({
          type: "registration",
          receiver: false,
          status: "connected",
          "controller-id": controllerId,
        });
        await waitFor(
          () => instance.modules.ControllerManager.keypads.length === 1,
          "ControllerManager did not register the disposable keypad",
        );
        const keypad = instance.modules.ControllerManager.keypads[0];
        const menu = game.settings.menus.get(`${moduleId}.${moduleId}`);
        const dialog = new menu.type();
        let controllerDialog;
        try {
          dialog.render(true);
          await waitFor(
            () => document.querySelector(`#mindflayer-token-controller-config select[name="mappings[${game.user.id}]"]`),
            "Controller assignment dropdown did not render",
          );
          const select = document.querySelector(`#mindflayer-token-controller-config select[name="mappings[${game.user.id}]"]`) as HTMLSelectElement;
          const option = select.querySelector(`option[value="${controllerId}"]`);
          const swatch = select.closest(".form-group").querySelector("[data-controller-color]") as HTMLElement;
          controllerDialog = {
            selected: select.value,
            optionLabel: option?.textContent.trim(),
            optionStyle: option?.getAttribute("style"),
            swatchColor: swatch?.style.backgroundColor,
            rightLED: keypad.peekLEDs()[1],
          };
          await waitFor(
            () => globalThis.__mindflayerSockets.some((connection) =>
              connection.sent.some((payload) => {
                const message = JSON.parse(payload);
                return message.type === "configuration" &&
                  message["controller-id"] === controllerId &&
                  message.led2?.r === 255 && message.led2?.g === 0 && message.led2?.b === 0;
              })),
            "Controller color was not sent to the right LED",
          );
        } finally {
          await dialog.close();
        }
        controllerDialog.restoredRightLED = keypad.peekLEDs()[1];

        const originalPosition = { x: tokenDocument.x, y: tokenDocument.y };
        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "W",
          state: "down",
        });
        await waitFor(
          () => tokenDocument.x !== originalPosition.x || tokenDocument.y !== originalPosition.y,
          "TokenMovement did not move the disposable token",
        );
        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "W",
          state: "up",
        });
        const movedPosition = { x: tokenDocument.x, y: tokenDocument.y };
        await tokenDocument.update(originalPosition);

        const originalAnimatePan = canvas.animatePan;
        let cameraAction;
        canvas.animatePan = (options) => {
          cameraAction = structuredClone(options);
          return Promise.resolve();
        };
        try {
          instance.modules.CameraControl.panCamera();
        } finally {
          canvas.animatePan = originalAnimatePan;
        }

        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "E",
          state: "down",
        });
        await waitFor(
          () => wallDocument.ds === CONST.WALL_DOOR_STATES.OPEN,
          "DoorHandler did not open the disposable door",
        );
        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "E",
          state: "up",
        });

        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "X",
          state: "down",
        });
        await waitFor(
          () => tokenDocument.light.bright === 20 && tokenDocument.light.dim === 40,
          "TokenTorch did not enable the disposable token light",
        );
        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "X",
          state: "up",
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "X",
          state: "down",
        });
        await waitFor(
          () => tokenDocument.light.bright === 0 && tokenDocument.light.dim === 0,
          "TokenTorch did not disable the disposable token light",
        );
        socket._dispatch({
          type: "key-event",
          "controller-id": controllerId,
          key: "X",
          state: "up",
        });

        return {
          cameraAction,
          doorOpened: wallDocument.ds === CONST.WALL_DOOR_STATES.OPEN,
          torchDisabled:
            tokenDocument.light.bright === 0 && tokenDocument.light.dim === 0,
          tokenMoved:
            movedPosition.x !== originalPosition.x || movedPosition.y !== originalPosition.y,
          keypadCount: instance.modules.ControllerManager.keypads.length,
          controllerDialog,
          outboundMessages: globalThis.__mindflayerSockets.flatMap((socket) =>
            socket.sent.map((payload) => JSON.parse(payload)),
          ),
        };
      } finally {
        if (wallDocument) await wallDocument.update({ ds: CONST.WALL_DOOR_STATES.CLOSED });
        if (tokenDocument) await scene.deleteEmbeddedDocuments("Token", [tokenDocument.id]);
        if (wallDocument) await scene.deleteEmbeddedDocuments("Wall", [wallDocument.id]);
        await game.settings.set(moduleId, "settings", priorMappings);
        if (priorSelectedToken === undefined) {
          await game.user.unsetFlag(moduleId, selectedTokenFlag);
        } else {
          await game.user.setFlag(moduleId, selectedTokenFlag, priorSelectedToken);
        }
      }
    });
    expect(behavior).toMatchObject({
      cameraAction: { duration: 1000 },
      doorOpened: true,
      torchDisabled: true,
      tokenMoved: true,
      keypadCount: 1,
      controllerDialog: {
        selected: "smoke-controller",
        optionLabel: "● smoke-controller",
        optionStyle: "color: #FF0000",
        rightLED: "#FF0000",
      },
    });
    expect(behavior.controllerDialog.swatchColor).toBe("rgb(255, 0, 0)");
    expect(behavior.controllerDialog.restoredRightLED).toMatch(/^#[0-9a-f]{6}$/i);
    expect(behavior.controllerDialog.restoredRightLED).not.toBe(behavior.controllerDialog.rightLED);
    expect(behavior.cameraAction.x).toEqual(expect.any(Number));
    expect(behavior.cameraAction.y).toEqual(expect.any(Number));
    expect(behavior.cameraAction.scale).toBeGreaterThan(0);
    expect(behavior.outboundMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "configuration",
          "controller-id": "smoke-controller",
          led1: expect.objectContaining({ r: expect.any(Number), g: expect.any(Number), b: expect.any(Number) }),
          led2: expect.objectContaining({ r: expect.any(Number), g: expect.any(Number), b: expect.any(Number) }),
        }),
      ]),
    );

    const reload = await page.evaluate(async () => {
      const moduleId = "mindflayer-token-controller";
      const originalPath = game.settings.get(moduleId, "websocketPath");
      const snapshots = [];
      const affectedNames = [
        "Socket",
        "TableLEDRing",
        "Ambilight",
        "ControllerManager",
        "CameraControl",
        "CombatEndTurn",
        "CombatIndicator",
        "DoorHandler",
        "PlayerLogin",
        "TokenBorder",
        "TokenMovement",
        "TokenSelect",
        "TokenTorch",
        "Timer",
      ];
      const unaffectedNames = ["SocketlibWrapper", "WakeLock", "Fullscreen"];
      const hookCount = (name) => Hooks.events[name]?.length ?? 0;
      const waitFor = async (predicate, message, timeout = 5000) => {
        const started = Date.now();
        while (!predicate()) {
          if (Date.now() - started > timeout) {
            const modules = game.modules.get(moduleId).instance.modules;
            throw new Error(
              `${message}: ${JSON.stringify({
                enabled: game.settings.get(moduleId, "enabled"),
                moduleNames: Object.keys(modules),
                errors: globalThis.__mindflayerWindowErrors,
              })}`,
            );
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
      };
      for (const path of [`${originalPath}?smoke=1`, `${originalPath}?smoke=2`, originalPath]) {
        const before = { ...game.modules.get(moduleId).instance.modules };
        const canvasPanHooksBefore = hookCount("canvasPan");
        await game.settings.set(moduleId, "websocketPath", path);
        await waitFor(() => {
          const modules = game.modules.get(moduleId).instance.modules;
          return (
            affectedNames.every((name) => modules[name] !== before[name]) &&
            modules.Socket.isConnected
          );
        }, "The websocket setting did not selectively reload Socket and its dependants");
        const after = game.modules.get(moduleId).instance.modules;
        snapshots.push({
          replaced: affectedNames.every((name) => after[name] !== before[name]),
          unloaded: affectedNames.every((name) => before[name].loaded === false),
          unaffected: unaffectedNames.every((name) => after[name] === before[name]),
          hookCountsStable: hookCount("canvasPan") === canvasPanHooksBefore,
          ready: after.Socket.isConnected,
        });
      }
      return {
        snapshots,
        socketCount: globalThis.__mindflayerSockets.length,
        closedSocketCount: globalThis.__mindflayerSockets.filter(
          (socket) => socket.readyState === 3,
        ).length,
      };
    });
    expect(reload.snapshots).toEqual([
      { replaced: true, unloaded: true, unaffected: true, hookCountsStable: true, ready: true },
      { replaced: true, unloaded: true, unaffected: true, hookCountsStable: true, ready: true },
      { replaced: true, unloaded: true, unaffected: true, hookCountsStable: true, ready: true },
    ]);
    expect(reload.closedSocketCount).toBe(reload.socketCount - 1);

    await page
      .evaluate(() => game.settings.set("mindflayer-token-controller", "enabled", false))
      .catch(() => {});
    await page.waitForLoadState("domcontentloaded");
    expect(startupErrors).toEqual([]);
    const relevantWarnings = consoleWarnings.filter(({ text, url }) => {
      const source = `${url}\n${text}`;
      return (
        !text.includes("hardware acceleration") &&
        !text.includes("GL Driver Message") &&
        !text.includes("performance warning: READ-usage buffer") &&
        !text.includes("The V1 Application framework is deprecated") &&
        !source.includes("/modules/lib-wrapper/") &&
        !source.includes("/systems/worldbuilding/")
      );
    });
    expect(relevantWarnings).toEqual([]);
    console.log(JSON.stringify(state, null, 2));
  });
});
