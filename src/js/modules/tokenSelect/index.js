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
import AbstractSubModule from "../AbstractSubModule";
import { default as ControllerManager } from "../ControllerManager";
import * as TokenUtil from "../../utils/tokenUtil";
import Keypad from "../ControllerManager/Keypad";
import { LOG_PREFIX, VTT_MODULE_NAME } from "../../settings/constants";

export default class TokenSelect extends AbstractSubModule {
  #tickHandlerFun;

  constructor(instance) {
    super(instance);

    this.#tickHandlerFun = this.#tickHandler.bind(this);
  }

  ready() {
    this.instance.modules[ControllerManager.name].registerTickListener(
      this.#tickHandlerFun
    );
  }

  unhook() {
    this.controllerManager.unregisterTickListener(this.#tickHandlerFun);
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, ControllerManager.name];
  }

  /**
   * @returns {ControllerManager}
   */
  get controllerManager() {
    return this.instance.modules[ControllerManager.name];
  }

  /**
   * Called once per Keypad tick/frame to handle interaction with the keypad
   *
   * @param {number} now the timestamp of the current Keypad "frame"
   * @param {Keypad[]} keypads an array of all connected Keypads
   */
  #tickHandler(now, keypads) {
    Object.values(keypads).forEach((keypad) => {
      if (keypad.isJustDown("Q", now)) {
        this.#selectNextToken(keypad);
      }
    });
  }

  /**
   * Select the next Token associated with the player of the given keypad
   * @param {Keypad} keypad
   */
  #selectNextToken(keypad) {
    const player = keypad.player;
    if (player === null) {
      return;
    }
    const currentTokenId = game.user.getFlag(
      VTT_MODULE_NAME,
      "selectedToken_" + player.id
    );

    if (!currentTokenId) {
      TokenUtil.setDefaultToken(player);
    } else {
      const tokens = TokenUtil.findAllTokensFor(player);
      let i = 0;
      for (; i < tokens.length; i++) {
        if (currentTokenId == tokens[i].id) {
          break;
        }
      }
      i = (i + 1) % tokens.length;
      game.user.setFlag(
        VTT_MODULE_NAME,
        "selectedToken_" + player.id,
        tokens[i].id
      );
      console.debug(
        LOG_PREFIX +
          `selected token '${tokens[i].name}' for player '${player.name}'`
      );
    }
    TokenUtil.deselectAllTokens();
  }
}
