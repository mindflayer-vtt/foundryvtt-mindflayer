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
import { Rectangle, Vector } from "../../utils/2d-geometry";
import { LOG_PREFIX } from "../../settings/constants";
import { isCombatActive } from "../../utils/combat";

const SUB_LOG_PREFIX = `${LOG_PREFIX}CombatEndTurn: `;

export default class CombatEndTurn extends AbstractSubModule {
  #tickHandlerFun;

  constructor(instance) {
    super(instance);
    this.#tickHandlerFun = this.#tickHandler.bind(this);
  }

  ready() {
    this.controllerManager.registerTickListener(this.#tickHandlerFun);
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
   * @param {Record<string,Keypad>} keypads an array of all connected Keypads
   */
  #tickHandler(now, keypads) {
    if (!isCombatActive()) {
      return;
    }
    for (const keypad of Object.values(keypads)) {
      if (keypad.isJustDown("SPC", now)) {
        if (this.#endTurnFor(keypad)) {
          // it does not make sense to advance more than one turn per frame
          // (e.g. if there are multiple keypads connected)
          // so we break out of the loop
          break;
        }
      }
    }
  }

  /**
   * @param {Keypad} keypad
   */
  #endTurnFor(keypad) {
    const currentActor = game.combat.turns[game.combat.turn].actor;
    const player = keypad.player;
    if (!player) {
      return false;
    }
    if (
      !currentActor?.hasPlayerOwner ||
      (currentActor.ownership[player.id] ?? 0) < 3
    ) {
      ui.notifications.warn(
        `Hey ${player.name}, You can only end your own turn!`,
      );
      return false;
    }

    game.combat.nextTurn();
    return true;
  }
}
