/**
 * This file is part of the Foundry VTT Module Mindflayer.
 *
 * The Foundry VTT Module Mindflayer is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * The Foundry VTT Module Mindflayer is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with the Foundry VTT Module Mindflayer. If not,
 * see <https://www.gnu.org/licenses/>.
 */
"use strict";
import { LOG_PREFIX, VTT_MODULE_NAME } from "../settings/constants";

const SUB_LOG_PREFIX = LOG_PREFIX + "TokenUtil: ";

interface UserRef {
  id: string;
  name: string;
  character?: { id: string } | null;
}

interface TokenRef {
  id: string;
  actor?: {
    id: string;
    testUserPermission(user: UserRef, permission: string): boolean;
  } | null;
}

/**
 * Returns all controllable tokens of a player.
 *
 * @param {User} player the player to search through
 * @param {Boolean} ignoreEmpty if no exception should be thrown (necessary for initialization)
 * @returns {Token[]} all controllable tokens of a player
 * @throws an Error object if no tokens could be found and ignoreEmpty is false
 */
export function findAllTokensFor(player: UserRef, ignoreEmpty = false) {
  const tokens = canvas.tokens.placeables
    .filter(
      (token: TokenRef) => token.actor?.testUserPermission(player, "OWNER") === true,
    )
    .sort((a: TokenRef, b: TokenRef) => a.id.localeCompare(b.id));
  if (!ignoreEmpty && tokens.length <= 0) {
    console.warn(
      SUB_LOG_PREFIX + `Player '${player.name}' does not have any Tokens: `,
    );
    throw new Error("Could not find any tokens for player: " + player.name);
  }
  return tokens;
}

/**
 * Returns the currently selected token of the given player.
 *
 * @param {Player} player the player to search through
 * @param {boolean} ignoreNone if false an error will be thrown if no tokens are found
 * @throws {Error} if no selected token could be found and ignoreNone is false
 * @returns {Token}
 */
export function getTokenFor(player: UserRef, ignoreNone = false) {
  const selectedToken = game.user.getFlag(
    VTT_MODULE_NAME,
    "selectedToken_" + player.id,
  );
  /** @var {Token} token */
  let token = canvas.tokens.placeables.find(
    (token: TokenRef) => token.id == selectedToken,
  );
  if (!token) {
    const tokens = findAllTokensFor(player, true);
    if (tokens.length <= 0) {
      if (!ignoreNone) {
        throw new Error(
          "Could not find token any tokens on current map for player " +
            player.name,
        );
      }
    } else {
      token = tokens[0];
    }
  }
  return token;
}

/**
 * Sets the users default characters as preselected tokens.
 */
export function setDefaultTokens() {
  for (const user of game.users.contents) {
    setDefaultToken(user);
  }
}

export function setDefaultToken(user: UserRef) {
  let selectedToken = null;
  const allTokens = findAllTokensFor(user, true);
  const character = user.character;
  if (character) {
    selectedToken = allTokens.find(
      (token: TokenRef) => token.actor?.id == character.id,
    );
    if (selectedToken) {
      selectedToken = selectedToken.id;
    }
  } else if (allTokens.length > 0) {
    selectedToken = allTokens[0].id;
  }
  game.user.setFlag(VTT_MODULE_NAME, "selectedToken_" + user.id, selectedToken);
  console.debug(
    LOG_PREFIX +
      `Selected default token '${selectedToken?.name}' for player '${user.name}'`,
  );
}

/**
 * Get the User belonging to the token, if the token is currently selected
 *
 * @param {Token} token the token to check
 * @returns {Player|null} the player who is currently controlling the token or null if noone is controlling it
 */
export function getUserIfSelectedTokenIs(token: Pick<TokenRef, "id">) {
  let result = null;
  for (const player of game.users.contents) {
    if (
      game.user.getFlag(VTT_MODULE_NAME, "selectedToken_" + player.id) ==
      token.id
    ) {
      result = player;
    }
  }
  return result;
}

/**
 * Returns all tokens that are in combat
 *
 * @returns {Token[]} the tokens in combat or empty array if no combat
 */
export function getAllCombatTokens() {
  if (game.combat == null) {
    return [];
  }
  return game.combat.turns.map((combatant: { token: { object: TokenRef } }) => combatant.token.object);
}

function _refreshTokens() {
  if (!game.canvas.initialized) {
    console.info(
      SUB_LOG_PREFIX + "canvas is disabled, cannot manipulate tokens",
    );
    return;
  }
  console.debug(SUB_LOG_PREFIX + "refreshing tokens");
  for (const t of canvas.tokens.placeables) {
    t.refresh({});
  }
}

export const refreshTokenPlaceables = foundry.utils.debounce(
  _refreshTokens,
  100,
);

export function deselectAllTokens() {
  if (!game.canvas.initialized) {
    console.info(
      SUB_LOG_PREFIX + "canvas is disabled, cannot manipulate tokens",
    );
    return;
  }
  canvas.activeLayer?.releaseAll();
  refreshTokenPlaceables();
}
