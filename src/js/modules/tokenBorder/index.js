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
import { LOG_PREFIX, VTT_MODULE_NAME } from "../../settings/constants";
import { hexToRgb } from "../../utils/color";
import * as TokenUtil from "../../utils/tokenUtil";
import AbstractSubModule from "../AbstractSubModule";
import { default as Socket } from "../socket";
const SUB_LOG_PREFIX = LOG_PREFIX + "TokenBorder: ";

const REF_Token_getBorderColor = "Token.prototype._getBorderColor";
export default class TokenBorder extends AbstractSubModule {
  constructor(instance) {
    super(instance);
  }

  ready() {
    const $this = this;
    console.debug(
      SUB_LOG_PREFIX +
        "overriding Token Border Color to add display user select."
    );
    libWrapper.register(
      VTT_MODULE_NAME,
      REF_Token_getBorderColor,
      function (wrapped, ...args) {
        return $this.#getBorderColorWrapper(wrapped, this, ...args);
      },
      libWrapper.MIXED
    );
    TokenUtil.refreshTokenPlaceables();
  }

  unhook() {
    libWrapper.unregister(VTT_MODULE_NAME, REF_Token_getBorderColor, false);
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, Socket.name];
  }

  /**
   * @returns {Socket}
   */
  get socket() {
    return this.instance.modules[Socket.name];
  }

  #getBorderColorWrapper(wrapped, token, ...args) {
    if (this.socket.isConnected && token.actor && token.actor.hasPlayerOwner) {
      const player = TokenUtil.getUserIfSelectedTokenIs(token);
      if (player) {
        const color = hexToRgb(player.data.color);
        return (
          ((color.r & 0xff) << 16) | ((color.g & 0xff) << 8) | (color.b & 0xff)
        );
      }
    }
    return wrapped(...args);
  }
}
