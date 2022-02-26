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
import { deg2rad, Vector } from "../../utils/2d-geometry";
import Keypad from "../ControllerManager/Keypad";
import { LOG_PREFIX } from "../../settings/constants";

const SUB_LOG_PREFIX = LOG_PREFIX + "TokenMovement: ";

export default class TokenMovement extends AbstractSubModule {
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
      this.#handleMovement(now, keypad);
      if (keypad.isDown("SHI") && keypad.isJustDown("C", now)) {
        this.#rotateKeypad(keypad);
      }
    });
  }

  /**
   * Rotates the keypad so that the movements are rotated clockwise by 90 deg
   * @param {Keypad} keypad a keypad client that has been mapped from the websocket message data
   */
  #rotateKeypad(keypad) {
    const newRotation = keypad.rotation + 90;
    const token = keypad.token;
    if (token) {
      const north = new Vector(0, -1);
      north.rotate(deg2rad(newRotation));
      canvas.tokens.moveMany({
        dx: Math.round(north.x),
        dy: Math.round(north.y),
        rotate: true,
        ids: [token.id],
      });
    }
    ui.notifications.info(
      "Mind Flayer: " +
        game.i18n.format("MindFlayer.Notifications.ChangeDirection", {
          player: keypad.player?.name || "unassigned",
          orientation: newRotation,
        })
    );
    keypad.rotation = newRotation;
  }

  /**
   * Handles token movement and rotation.
   *
   * @param {number} now the timestamp of the current Keypad "frame"
   * @param {Keypad} keypad a keypad client that has been mapped from the websocket message data
   * @private
   */
  async #handleMovement(now, keypad) {
    const token = keypad.token;
    if (!token) {
      return;
    }

    keypad.syncRepetitions(["W", "A", "S", "D"], now);
    const rotateOnly = keypad.isDown("SHI");
    const direction = new Vector(0, 0);
    // Track the movement set
    if (keypad.isRepeatedDown("W", now)) {
      direction.y -= 1;
    }
    if (keypad.isRepeatedDown("D", now)) {
      direction.x += 1;
    }
    if (keypad.isRepeatedDown("S", now)) {
      direction.y += 1;
    }
    if (keypad.isRepeatedDown("A", now)) {
      direction.x -= 1;
    }
    if (direction.length() >= 1) {
      direction.rotate(deg2rad(keypad.rotation));
      direction.x = Math.round(direction.x);
      direction.y = Math.round(direction.y);

      // Logging movement action
      console.debug(
        SUB_LOG_PREFIX +
          `${keypad.player.name}: ${rotateOnly ? "Rotating" : "Moving"} ${
            token.name
          } to direction`,
        direction
      );

      // Perform the shift or rotation
      await canvas.tokens.moveMany({
        dx: direction.x,
        dy: direction.y,
        rotate: rotateOnly,
        ids: [token.id],
      });

      if (!rotateOnly) {
        await canvas.tokens.moveMany({
          dx: direction.x,
          dy: direction.y,
          rotate: true,
          ids: [token.id],
        });
      }
    }
  }
}
