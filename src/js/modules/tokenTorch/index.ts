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
import Keypad from "../ControllerManager/Keypad";
import { LOG_PREFIX } from "../../settings/constants";
import type MindFlayer from "../../MindFlayer";

const SUB_LOG_PREFIX = LOG_PREFIX + "TokenMovement: ";

export default class TokenTorch extends AbstractSubModule {
  #tickHandlerFun: (now: number, keypads: Record<string, Keypad>) => void;

  constructor(instance: MindFlayer) {
    super(instance);

    this.#tickHandlerFun = this.#tickHandler.bind(this);
  }

  ready() {
    this.controllerManager.registerTickListener(
      this.#tickHandlerFun,
    );
  }

  unhook() {
    this.controllerManager.unregisterTickListener(this.#tickHandlerFun);
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, ControllerManager.name];
  }

  get controllerManager(): ControllerManager {
    return Reflect.get(this.instance!.modules, ControllerManager.name) as ControllerManager;
  }

  /**
   * Called once per Keypad tick/frame to handle interaction with the keypad
   *
   * @param {number} now the timestamp of the current Keypad "frame"
   * @param {Record<string,Keypad>} keypads an array of all connected Keypads
   */
  #tickHandler(now: number, keypads: Record<string, Keypad>) {
    for (const keypad of Object.values(keypads)) {
      if (keypad.isJustDown("X", now)) {
        this.#toggleTorch(keypad);
      }
    }
  }

  /**
   * Toggle the light arround the currently selected token of the given keypad
   *
   * @param {Keypad} keypad keypad which initiated the torch request
   * @private
   */
  async #toggleTorch(keypad: Keypad): Promise<void> {
    const token = keypad.token;
    if (!token) {
      return;
    }

    if (!token.emitsLight) {
      console.debug(
        `${SUB_LOG_PREFIX}${keypad.player?.name}: Turn on torch for ${token.name}`,
      );
      await token.document.update({
        light: {
          bright: 20,
          dim: 40,
          alpha: 0.4,
          color: "#ffad58",
          animation: {
            type: "flame",
            speed: 5,
            intensity: 5,
          },
        },
      });
    } else {
      console.debug(
        LOG_PREFIX + keypad.player?.name + ": Turn off torch for " + token.name,
      );

      await token.document.update({
        light: {
          bright: 0,
          dim: 0,
        },
      });
    }
  }
}
