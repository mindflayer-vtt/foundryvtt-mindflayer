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
import Key from "./Key";
import * as TokenUtil from "../../utils/tokenUtil";
import MindFlayer from "../../MindFlayer";

/**
 * Keypad class representing a keypad
 */
export default class Keypad {
  /**
   * @type {MindFlayer}
   */
  #instance;
  #controllerId;
  #rawState = {
    Q: new Key(),
    W: new Key(),
    E: new Key(),
    A: new Key(),
    S: new Key(),
    D: new Key(),
    Z: new Key(),
    X: new Key(),
    C: new Key(),
    SHI: new Key(),
    SPC: new Key(),
  };
  /**
   * @returns {boolean}
   */
  #ledChanged = false;
  /**
   * @returns {[string, string]}
   */
  #ledState = ["#000000", "#000000"];

  constructor(instance, controllerId) {
    this.#instance = instance;
    this.#controllerId = controllerId;
    this.setDefaultLEDColor();
    console.debug(
      LOG_PREFIX + "Initialized keypad for controller " + this.#controllerId
    );
  }

  /**
   * @returns {string}
   */
  get controllerId() {
    return this.#controllerId;
  }

  /**
   * @returns {number} rotation in degrees
   */
  get rotation() {
    let r = game.user.getFlag(
      VTT_MODULE_NAME,
      "controllerRotation_" + this.#controllerId
    );
    if (r === undefined) {
      r = 0;
      this.rotation = r;
    }
    return r;
  }

  /**
   * @param {number} amount the new rotation in degrees
   */
  set rotation(amount) {
    if (typeof amount !== "number") {
      throw new TypeError("Rotation has to be numerical");
    }
    amount = amount % 360;
    if (amount < 0) {
      amount += 360;
    }
    game.user.setFlag(
      VTT_MODULE_NAME,
      "controllerRotation_" + this.#controllerId,
      amount
    );
  }

  /**
   * Returns an assigned player for this keypad.
   *
   * @returns {User | null} the assigned player
   */
  get player() {
    const settings = this.#instance.settings.settings;
    const playerId = Object.keys(settings.mappings).find(
      (key) => settings.mappings[key] == this.#controllerId
    );
    const selectedPlayer = game.users.contents.find(
      (player) => player.id == playerId
    );
    if (!selectedPlayer) {
      return null;
    }
    return selectedPlayer;
  }

  /**
   * Returns the currently selected Token for this keypad
   *
   * @returns {Token | null} the assinged token
   */
  get token() {
    const player = this.player;
    if (!game.canvas.initialized || !player) return null;
    return TokenUtil.getTokenFor(player, true);
  }

  /**
   * @returns {string[]}
   */
  get keys() {
    return Object.getOwnPropertyNames(this.#rawState);
  }

  registerKeyEvent(data) {
    if (!this.#rawState.hasOwnProperty(data.key)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].registerKeyEvent() called with unknown key:`,
        data
      );
      return;
    }
    this.#rawState[data.key].down = `${data.state}`.toLowerCase() === "down";
  }

  isDown(wantedKey) {
    if (!this.#rawState.hasOwnProperty(wantedKey)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].isDown() called with unknown key: ${wantedKey}`
      );
      return false;
    }
    return this.#rawState[wantedKey].down;
  }

  isJustDown(wantedKey, currentTime) {
    if (!this.#rawState.hasOwnProperty(wantedKey)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].isDown() called with unknown key: ${wantedKey}`
      );
      return false;
    }
    return this.#rawState[wantedKey].isJustDown(currentTime);
  }

  isRepeatedDown(wantedKey, currentTime) {
    if (!this.#rawState.hasOwnProperty(wantedKey)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].isDown() called with unknown key: ${wantedKey}`
      );
      return false;
    }
    return this.#rawState[wantedKey].isRepeatedDown(currentTime);
  }

  syncRepetitions(keys = [], currentTime) {
    if (!Array.isArray(keys) || keys.length < 2) {
      return;
    }
    keys = keys.map((name) => this.#rawState[name]).filter((key) => key.down);
    if (keys.length < 2) {
      return;
    }
    const latestTrigger = keys
      .map((key) => key.lastTrigger || currentTime)
      .reduce((lastMax, currentValue) => Math.max(lastMax, currentValue), 0);
    keys.forEach((key) => (key.lastTrigger = latestTrigger));
  }

  setDefaultLEDColor() {
    try {
      const player = this.player;
      if (player) {
        const playerColor = player.color || player.data.color;
        this.setLED(0, playerColor);
        this.setLED(1, playerColor);
      } else {
        this.setLED(0, "#00FF00");
        this.setLED(1, "#000000");
      }
      this.#ledChanged = true;
    } catch (err) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].setDefaultLEDColor() could not determine associated player`,
        err
      );
    }
  }

  setLED(index, color) {
    if (!this.#ledState[index]) {
      console.error(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].setLED() tried to set unknown led at '${index}'`
      );
      return;
    }
    if (this.#ledState[index] !== color) {
      this.#ledChanged = true;
    }
    this.#ledState[index] = color;
  }

  /**
   * Get the current LED state, if they were changed since the last call to this method
   *
   * @returns {string[] | null} null if the values have not changed
   */
  getLEDsIfChanged() {
    if (this.#ledChanged) {
      this.#ledChanged = false;
      return this.#ledState;
    }
    return null;
  }

  /**
   * Get the current LED state
   *
   * @returns {string[]}
   */
  peekLEDs() {
    return this.#ledState;
  }
}
