import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../../src/js/modules/loader", () => ({ reload: vi.fn() }));

import { BeamerUserConfig } from "../../src/js/settings/BeamerUserConfig";
import { TokenControllerConfig } from "../../src/js/settings/TokenControllerConfig";
import * as TokenUtil from "../../src/js/utils/tokenUtil";

describe("token/controller configuration form", () => {
  beforeEach(() => {
    game.users.contents = [
      { id: "p1", name: "One" },
      { id: "p2", name: "Two" },
    ];
    game.settings.get.mockImplementation((_scope: string, key: string) =>
      key === "settings" ? { mappings: { p1: "controller-a" }, nested: { keep: true } } : undefined,
    );
  });

  test("declares the Foundry form contract and supplies players with saved mappings", () => {
    expect(TokenControllerConfig.defaultOptions).toMatchObject({
      id: "mindflayer-token-controller-config",
      width: 500,
      height: "auto",
      closeOnSubmit: true,
    });
    const form = new TokenControllerConfig();
    expect(form.getData({})).toMatchObject({
      playerList: { p1: "One", p2: "Two" },
      mappings: { p1: "controller-a" },
      nested: { keep: true },
    });
    (form as any).reset = true;
    expect(form.getData({}).mappings).toEqual({});
  });

  test("parses bracketed names into the persisted nested settings shape", () => {
    const form = new TokenControllerConfig();
    expect((form as any)._parseInputs({
      "mappings[p1]": "controller-a",
      "mappings[p2]": "controller-b",
      "options[led][enabled]": true,
      plain: "value",
    })).toEqual({
      mappings: { p1: "controller-a", p2: "controller-b" },
      options: { led: { enabled: true } },
      plain: "value",
    });
  });

  test("saves, broadcasts, notifies, and selects default tokens", async () => {
    const defaults = vi.spyOn(TokenUtil, "setDefaultTokens").mockImplementation(() => {});
    const form = new TokenControllerConfig();
    await (form as any)._updateObject(null, { "mappings[p1]": "controller-a" });
    expect(game.settings.set).toHaveBeenCalledWith(
      "mindflayer-token-controller", "settings", { mappings: { p1: "controller-a" } },
    );
    expect(game.socket.emit).toHaveBeenCalledWith(
      "module.mindflayer-token-controller", { type: "update", user: "gm" },
    );
    expect(ui.notifications.info).toHaveBeenCalledWith("MindFlayer.saveMessage");
    expect(defaults).toHaveBeenCalledOnce();
  });

  test("wires the reset control and resets the flag after listener activation", () => {
    const click = vi.fn();
    const form = new TokenControllerConfig();
    const render = vi.spyOn(form as any, "render");
    form.activateListeners({ find: vi.fn(() => ({ click })) } as any);
    expect(click).toHaveBeenCalledOnce();
    const resetHandler = click.mock.calls[0][0];
    resetHandler();
    expect((form as any).reset).toBe(true);
    expect(render).toHaveBeenCalledOnce();
  });

  test("assigns distinct, stable colors to connected controllers and lights their right LEDs when opened", async () => {
    const keypads = ["controller-c", "controller-a", "controller-b"].map((controllerId) => ({
      controllerId,
      setLED: vi.fn(),
      setDefaultLEDColor: vi.fn(),
    }));
    game.modules.set("mindflayer-token-controller", {
      instance: { modules: { ControllerManager: { keypads } } },
    });
    const form = new TokenControllerConfig();
    const first = form.getData({}) as any;
    const colors = first.controllerOptions.map((option: any) => option.color);
    expect(first.controllerOptions.map((option: any) => option.id)).toEqual([
      "controller-a", "controller-b", "controller-c",
    ]);
    expect(new Set(colors).size).toBe(3);
    expect(colors).toEqual(["#FF0000", "#00FF00", "#0000FF"]);
    expect(colors.every((color: string) => /^#[0-9A-F]{6}$/.test(color))).toBe(true);
    expect(form.getData({}).controllerOptions).toEqual(first.controllerOptions);
    form.activateListeners({ find: vi.fn(() => ({ click: vi.fn() })) } as any);
    for (const keypad of keypads) {
      const color = first.controllerOptions.find((option: any) => option.id === keypad.controllerId).color;
      expect(keypad.setLED).toHaveBeenCalledWith(1, color);
      expect(keypad.setLED).not.toHaveBeenCalledWith(0, expect.anything());
    }
    await form.close();
    for (const keypad of keypads) expect(keypad.setDefaultLEDColor).toHaveBeenCalledOnce();
  });

  test("offers a dropdown row for each user with the selected controller color", () => {
    game.modules.set("mindflayer-token-controller", {
      instance: { modules: { ControllerManager: { keypads: [
        { controllerId: "controller-b", setLED: vi.fn() },
        { controllerId: "controller-a", setLED: vi.fn() },
      ] } } },
    });
    const data = new TokenControllerConfig().getData({}) as any;
    expect(data.playerRows).toHaveLength(2);
    expect(data.playerRows[0]).toMatchObject({ id: "p1", name: "One" });
    expect(data.playerRows[0].options).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "controller-a", selected: true, color: data.controllerOptions[0].color }),
      expect.objectContaining({ id: "controller-b", selected: false, color: data.controllerOptions[1].color }),
    ]));
    expect(data.playerRows[0].selectedColor).toBe(data.controllerOptions[0].color);
    expect(data.playerRows[1].selectedColor).toBeNull();
  });

  test("keeps a saved offline controller available in the dropdown", () => {
    const data = new TokenControllerConfig().getData({}) as any;
    expect(data.playerRows[0].options).toContainEqual({
      id: "controller-a", color: null, label: "controller-a (offline)", selected: true,
    });
  });

  test("removes another user's previous assignment when a controller is selected", async () => {
    const form = new TokenControllerConfig();
    await (form as any)._updateObject(null, {
      "mappings[p1]": "controller-a",
      "mappings[p2]": "controller-a",
    });
    expect(game.settings.set).toHaveBeenCalledWith(
      "mindflayer-token-controller", "settings", { mappings: { p2: "controller-a" } },
    );
  });

  test("a newly changed selection wins over a later unchanged dropdown", async () => {
    game.settings.get.mockImplementation((_scope: string, key: string) =>
      key === "settings" ? { mappings: { p1: "controller-a", p2: "controller-b" } } : undefined,
    );
    const form = new TokenControllerConfig();
    await (form as any)._updateObject(null, {
      "mappings[p1]": "controller-b",
      "mappings[p2]": "controller-b",
    });
    expect(game.settings.set).toHaveBeenCalledWith(
      "mindflayer-token-controller", "settings", { mappings: { p1: "controller-b" } },
    );
  });

  test("uses the new owner's default LED color after saving a reassignment", async () => {
    const keypad = {
      controllerId: "controller-a",
      peekLEDs: vi.fn(() => ["#123456", "#123456"]),
      setLED: vi.fn(),
      setDefaultLEDColor: vi.fn(),
    };
    game.modules.set("mindflayer-token-controller", {
      instance: { modules: { ControllerManager: { keypads: [keypad] } } },
    });
    const form = new TokenControllerConfig();
    form.activateListeners({ find: vi.fn(() => ({ click: vi.fn() })) } as any);
    await (form as any)._updateObject(null, {
      "mappings[p1]": "",
      "mappings[p2]": "controller-a",
    });
    keypad.setLED.mockClear();
    await form.close();
    expect(keypad.setDefaultLEDColor).toHaveBeenCalledOnce();
    expect(keypad.setLED).not.toHaveBeenCalledWith(1, "#123456");
  });

  test("clears another dropdown immediately and updates the visible swatch on reassignment", () => {
    const listeners = new Map<string, () => void>();
    const swatches = [
      { style: { backgroundColor: "" }, hidden: false },
      { style: { backgroundColor: "" }, hidden: false },
    ];
    const selects = [
      { value: "controller-a", dataset: {}, addEventListener: vi.fn((event, callback) => listeners.set(`p1:${event}`, callback)), closest: () => ({ querySelector: () => swatches[0] }) },
      { value: "", dataset: {}, addEventListener: vi.fn((event, callback) => listeners.set(`p2:${event}`, callback)), closest: () => ({ querySelector: () => swatches[1] }) },
    ];
    game.modules.set("mindflayer-token-controller", {
      instance: { modules: { ControllerManager: { keypads: [
        { controllerId: "controller-a", setLED: vi.fn() },
      ] } } },
    });
    const form = new TokenControllerConfig();
    const html = { find: vi.fn(() => ({ click: vi.fn() })), 0: { querySelectorAll: () => selects } };
    form.activateListeners(html as any);
    selects[1].value = "controller-a";
    listeners.get("p2:change")!();
    expect(selects[0].value).toBe("");
    expect(swatches[0].hidden).toBe(true);
    expect(swatches[1].style.backgroundColor).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe("Beamer-user configuration form", () => {
  function installService(overrides: Record<string, any> = {}) {
    const service = {
      loaded: true,
      selectedId: "beamer",
      status: vi.fn(() => ({ state: "configured" })),
      review: vi.fn((user) => user.id === "unsafe" ? ["GM role", "owns actor"] : []),
      create: vi.fn(async () => ({})),
      adopt: vi.fn(async () => ({})),
      ...overrides,
    };
    game.modules.set("mindflayer-token-controller", {
      instance: { modules: { BeamerUsers: service } },
    });
    return service;
  }

  test("returns availability, status, and reviewed adoption candidates", () => {
    game.users.contents = [
      { id: "safe", name: "Display" },
      { id: "unsafe", name: "GM" },
    ];
    const service = installService();
    const form = new BeamerUserConfig();
    expect(form.getData()).toEqual({
      status: { state: "configured" },
      selected: true,
      candidates: [
        { id: "safe", name: "Display", eligible: true, review: "" },
        { id: "unsafe", name: "GM", eligible: false, review: "GM role; owns actor" },
      ],
    });
    expect(service.review).toHaveBeenCalledTimes(2);
    game.user.isGM = false;
    expect(form.getData()).toEqual({ unavailable: true });
  });

  test("switches form modes, selects pairing IDs, and safely reveals the password", () => {
    installService();
    const events = (target: any) => {
      target.listeners = new Map<string, () => void>();
      target.addEventListener = (name: string, callback: () => void) => target.listeners.set(name, callback);
      return target;
    };
    const pairing = events({ select: vi.fn() });
    const mode = events({ value: "create" });
    const createGroup: any = { dataset: { mode: "create" }, hidden: true, disabled: true };
    const adoptGroup: any = { dataset: { mode: "adopt" }, hidden: true, disabled: true };
    const error = { textContent: "previous error" };
    const focusTarget = { focus: vi.fn() };
    const name = { focus: vi.fn() };
    const secret: any = { type: "password" };
    const reveal = events({ textContent: "Show password", setAttribute: vi.fn() });
    const formElement = {
      querySelectorAll: (selector: string) => selector === "[data-pairing-id]"
        ? [pairing]
        : selector === "[data-mode]" ? [createGroup, adoptGroup] : [],
      querySelector: (selector: string) => ({
        '[name="mode"]': mode,
        "[data-error]": error,
        'fieldset:not([hidden]) input, fieldset:not([hidden]) select': focusTarget,
        '[name="password"]': secret,
        "[data-reveal]": reveal,
        '[name="name"]': name,
      })[selector] ?? null,
    };
    const form = new BeamerUserConfig();
    const position = vi.spyOn(form as any, "setPosition");
    form.activateListeners([formElement] as any);
    expect(createGroup).toMatchObject({ hidden: false, disabled: false });
    expect(adoptGroup).toMatchObject({ hidden: true, disabled: true });
    pairing.listeners.get("click")();
    pairing.listeners.get("focus")();
    expect(pairing.select).toHaveBeenCalledTimes(2);
    reveal.listeners.get("click")();
    expect(secret.type).toBe("text");
    expect(reveal.textContent).toBe("Hide password");
    expect(reveal.setAttribute).toHaveBeenCalledWith("aria-pressed", "true");
    mode.value = "adopt";
    mode.listeners.get("change")();
    expect(createGroup.hidden).toBe(true);
    expect(adoptGroup.hidden).toBe(false);
    expect(error.textContent).toBe("");
    expect(focusTarget.focus).toHaveBeenCalledOnce();
    expect(position).toHaveBeenCalledWith({ height: "auto" });
    expect(name.focus).toHaveBeenCalledOnce();
  });

  test.each([
    ["create", { mode: "create", name: "Display", password: "long-password" }],
    ["adopt", { mode: "adopt", userId: "existing", confirm: true }],
  ])("submits %s operations without retaining the password", async (mode, data) => {
    const service = installService();
    const password = { value: "secret" };
    const submit = { disabled: false };
    const formElement = {
      querySelector: vi.fn((selector) => {
        if (selector === '[type="submit"]') return submit;
        if (selector === '[name="password"]') return password;
        return { textContent: "", focus: vi.fn() };
      }),
    };
    const form = new BeamerUserConfig();
    (form as any).form = formElement;
    vi.spyOn(form as any, "render").mockResolvedValue(undefined);
    await (form as any)._updateObject(null, data);
    if (mode === "create") {
      expect(service.create).toHaveBeenCalledWith({ name: "Display", password: "long-password" });
    } else {
      expect(service.adopt).toHaveBeenCalledWith({ userId: "existing", confirm: true });
    }
    expect(password.value).toBe("");
    expect(submit.disabled).toBe(false);
  });

  test("shows a fixed safe error and re-enables submit after service failures", async () => {
    installService({ create: vi.fn(async () => { throw new Error("secret password leaked"); }) });
    const submit = { disabled: false };
    const error = { textContent: "", focus: vi.fn() };
    const form = new BeamerUserConfig();
    (form as any).form = {
      querySelector: (selector: string) => selector === '[type="submit"]' ? submit : error,
    };
    await (form as any)._updateObject(null, {
      mode: "create", name: "Display", password: "secret password leaked",
    });
    expect(error.textContent).toContain("Could not configure Beamer");
    expect(error.textContent).not.toContain("secret password leaked");
    expect(error.focus).toHaveBeenCalledOnce();
    expect(submit.disabled).toBe(false);
  });

  test("ignores submissions outside an available GM service and handles invalid modes", async () => {
    game.user.isGM = false;
    const unavailable = new BeamerUserConfig();
    await expect((unavailable as any)._updateObject(null, { mode: "create" })).resolves.toBeUndefined();

    game.user.isGM = true;
    installService();
    const submit = { disabled: false };
    const error = { textContent: "", focus: vi.fn() };
    const form = new BeamerUserConfig();
    (form as any).form = {
      querySelector: (selector: string) => selector === '[type="submit"]' ? submit : error,
    };
    await (form as any)._updateObject(null, { mode: "unexpected" });
    expect(error.textContent).toContain("Could not configure Beamer");
    expect(submit.disabled).toBe(false);
  });
});
