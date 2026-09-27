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
    game.settings.get.mockImplementation((_scope, key) =>
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
    expect(form.getData({})).toEqual({
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
});
