import { beforeEach, describe, expect, test, vi } from "vitest";
import BeamerUsers from "../../src/js/modules/beamerUsers";
import type MindFlayer from "../../src/js/MindFlayer";

describe("world Beamer users", () => {
  let selected: string;
  let users: Array<ReturnType<typeof player>>;
  let service: BeamerUsers;
  let create: ReturnType<typeof vi.fn>;
  const player = (id: string, name = "Beamer") => ({ id, name, role: 1, isGM: false, character: null, can: () => false, update: vi.fn() });
  beforeEach(() => {
    selected = "";
    users = [];
    vi.stubGlobal("CONST", { USER_ROLES: { PLAYER: 1, TRUSTED: 2 }, USER_PERMISSIONS: { FILES_UPLOAD: {}, MACRO_SCRIPT: {} }, DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 3 } });
    vi.stubGlobal("game", { user: { isGM: true }, world: { id: "world-one" }, collections: new Map(),
      users: { contents: users, get: (id: string) => users.find(user => user.id === id) },
      settings: { get: () => selected, set: vi.fn(async (_namespace: string, _key: string, id: string) => { selected = id; }) } });
    create = vi.fn(async (data: { name: string }) => { const user = player("created", data.name); users.push(user); return user; });
    vi.stubGlobal("foundry", { documents: { User: { create } } });
    service = new BeamerUsers({} as MindFlayer);
  });

  test("creates a Player with denied capabilities and stores only its ID", async () => {
    const result = await service.create({ password: "test-only-long-password" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ role: 1, permissions: { FILES_UPLOAD: false, MACRO_SCRIPT: false } }));
    expect(selected).toBe("created");
    expect(result.state).toBe("configured");
    expect(JSON.stringify(result)).not.toContain("test-only-long-password");
    await expect(service.create({ password: "test-only-long-password" })).rejects.toThrow("already selected");
  });

  test("name collisions never reset or reuse an existing user's credentials", async () => {
    const existing = player("existing", "BEAMER"); users.push(existing);
    await expect(service.create({ name: " Beamer ", password: "test-only-long-password" })).rejects.toThrow("exists");
    expect(create).not.toHaveBeenCalled();
    expect(existing.update).not.toHaveBeenCalled();
  });

  test("explicit adoption selects an already restricted user without changing it", async () => {
    const existing = player("existing"); users.push(existing);
    await expect(service.adopt({ userId: existing.id })).rejects.toThrow("Explicit");
    await service.adopt({ userId: existing.id, confirm: true });
    expect(selected).toBe(existing.id);
    expect(existing.update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  test("explicit adoption accepts a Trusted Player and its role capabilities", async () => {
    const existing = { ...player("trusted"), role: 2, can: () => true }; users.push(existing);
    await service.adopt({ userId: existing.id, confirm: true });
    expect(selected).toBe(existing.id);
    expect(existing.update).not.toHaveBeenCalled();
  });

  test("GM roles, assigned characters, capabilities and document ownership require review", async () => {
    const user = player("existing"); users.push(user);
    for (const change of [{ role: 4, isGM: true }, { character: {} }, { can: () => true }]) {
      Object.assign(user, player("existing"), change);
      await expect(service.adopt({ userId: user.id, confirm: true })).rejects.toThrow();
      expect(selected).toBe("");
    }
    Object.assign(user, player("existing"));
    game.collections.set("Actor", { contents: [{ ownership: { existing: 3 } }] });
    await expect(service.adopt({ userId: user.id, confirm: true })).rejects.toThrow("ownership");
    expect(user.update).not.toHaveBeenCalled();
  });

  test("non-GM and unloaded module instances cannot mutate user selection", async () => {
    game.user.isGM = false;
    await expect(service.create({ password: "test-only-long-password" })).rejects.toThrow("GM");
    game.user.isGM = true;
    service.unhook();
    await expect(service.adopt({ userId: "existing", confirm: true })).rejects.toThrow("GM");
    expect(game.settings.set).not.toHaveBeenCalled();
  });
});
