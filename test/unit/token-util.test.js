import { describe, expect, test, vi } from "vitest";
import * as TokenUtil from "../../src/js/utils/tokenUtil";

function token(id, owners = {}, actorId = id) {
  return { id, actor: { id: actorId, ownership: owners }, refresh: vi.fn() };
}

describe("token utilities at the Foundry 12 boundary", () => {
  test("finds owned controllable tokens in stable id order", () => {
    const player = { id: "p1", name: "Player" };
    canvas.tokens.placeables = [token("z", { p1: 3 }), token("a", { p1: 3 }), token("ignored", { p1: 2 }), { id: "actorless", actor: null }];
    expect(TokenUtil.findAllTokensFor(player).map((item) => item.id)).toEqual(["a", "z"]);
  });

  test("uses the selected token and falls back to the first owned token", () => {
    const player = { id: "p1", name: "Player" };
    canvas.tokens.placeables = [token("b", { p1: 3 }), token("a", { p1: 3 })];
    game.user.getFlag.mockReturnValueOnce("b");
    expect(TokenUtil.getTokenFor(player).id).toBe("b");
    game.user.getFlag.mockReturnValueOnce("missing");
    expect(TokenUtil.getTokenFor(player).id).toBe("a");
  });

  test("character default wins, otherwise the first token or null is stored", () => {
    const users = [
      { id: "p1", name: "One", character: { id: "actor-b" } },
      { id: "p2", name: "Two", character: null },
      { id: "p3", name: "Three", character: null },
    ];
    canvas.tokens.placeables = [token("a", { p1: 3, p2: 3 }, "actor-a"), token("b", { p1: 3 }, "actor-b")];
    users.forEach(TokenUtil.setDefaultToken);
    expect(game.user.setFlag.mock.calls.map((call) => call.slice(1))).toEqual([
      ["selectedToken_p1", "b"], ["selectedToken_p2", "a"], ["selectedToken_p3", null],
    ]);
  });

  test("reports no-token paths and selected-token ownership", () => {
    const player = { id: "p1", name: "Player" };
    expect(() => TokenUtil.findAllTokensFor(player)).toThrow("Could not find");
    expect(TokenUtil.findAllTokensFor(player, true)).toEqual([]);
    expect(TokenUtil.getTokenFor(player, true)).toBeUndefined();
    game.users.contents = [{ id: "p1" }, { id: "p2" }];
    game.user.getFlag.mockImplementation((scope, key) => key.endsWith("p2") ? "chosen" : "other");
    expect(TokenUtil.getUserIfSelectedTokenIs({ id: "chosen" })).toEqual({ id: "p2" });
  });

  test("returns combat tokens and guards refresh/release when canvas is disabled", () => {
    const combatToken = token("combat");
    game.combat = { turns: [{ token: { object: combatToken } }] };
    expect(TokenUtil.getAllCombatTokens()).toEqual([combatToken]);
    game.canvas.initialized = false;
    TokenUtil.deselectAllTokens();
    expect(canvas.activeLayer.releaseAll).not.toHaveBeenCalled();
    game.canvas.initialized = true;
    canvas.tokens.placeables = [combatToken];
    TokenUtil.deselectAllTokens();
    expect(canvas.activeLayer.releaseAll).toHaveBeenCalledOnce();
    expect(combatToken.refresh).toHaveBeenCalledWith({});
  });
});
