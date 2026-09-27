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
import type { LEDStateReport, RGBColor } from "../../utils/protocol";

interface KeypadPlayer {
  id: string;
  name: string;
  color?: string;
  data?: { color: string };
}

interface KeypadInstance {
  settings: { settings: { mappings: Record<string, string> } };
}

/**
 * Keypad class representing a keypad
 */
export default class Keypad {
  #instance: KeypadInstance;
  #controllerId: string;
  #rawState: Record<string, Key> = {
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
  #ledState: [string, string] = ["#000000", "#000000"];
  /** Confirmed by the server after device acknowledgement; null means unknown. */
  #currentLEDState: [string, string] | null = null;

  constructor(instance: KeypadInstance, controllerId: string) {
    this.#instance = instance;
    this.#controllerId = controllerId;
    this.setDefaultLEDColor();
    console.debug(
      LOG_PREFIX + "Initialized keypad for controller " + this.#controllerId,
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
      "controllerRotation_" + this.#controllerId,
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
  set rotation(amount: number) {
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
      amount,
    );
  }

  /**
   * Returns an assigned player for this keypad.
   *
   * @returns {User | null} the assigned player
   */
  get player(): KeypadPlayer | null {
    const settings = this.#instance.settings.settings;
    const playerId = Object.keys(settings.mappings).find(
      (key) => settings.mappings[key] == this.#controllerId,
    );
    const selectedPlayer = (game.users.contents as KeypadPlayer[]).find(
      (player) => player.id == playerId,
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

  registerKeyEvent(data: { key: string; state: string }): void {
    if (!Object.hasOwn(this.#rawState, data.key)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].registerKeyEvent() called with unknown key:`,
        data,
      );
      return;
    }
    this.#rawState[data.key].down = `${data.state}`.toLowerCase() === "down";
  }

  isDown(wantedKey: string): boolean {
    if (!Object.hasOwn(this.#rawState, wantedKey)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].isDown() called with unknown key: ${wantedKey}`,
      );
      return false;
    }
    return this.#rawState[wantedKey].down;
  }

  isJustDown(wantedKey: string, currentTime: number): boolean {
    if (!Object.hasOwn(this.#rawState, wantedKey)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].isDown() called with unknown key: ${wantedKey}`,
      );
      return false;
    }
    return this.#rawState[wantedKey].isJustDown(currentTime);
  }

  isRepeatedDown(wantedKey: string, currentTime: number): boolean {
    if (!Object.hasOwn(this.#rawState, wantedKey)) {
      console.warn(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].isDown() called with unknown key: ${wantedKey}`,
      );
      return false;
    }
    return this.#rawState[wantedKey].isRepeatedDown(currentTime);
  }

  syncRepetitions(keys: string[] = [], currentTime: number): void {
    if (!Array.isArray(keys) || keys.length < 2) {
      return;
    }
    const activeKeys = keys
      .map((name) => this.#rawState[name])
      .filter((key): key is Key => key !== undefined && key.down);
    if (activeKeys.length < 2) {
      return;
    }
    const latestTrigger = activeKeys
      .map((key) => key.lastTrigger || currentTime)
      .reduce((lastMax, currentValue) => Math.max(lastMax, currentValue), 0);
    for (const key of activeKeys) {
      key.lastTrigger = latestTrigger;
    }
  }

  setDefaultLEDColor() {
    try {
      const player = this.player;
      if (player) {
        const playerColor = player.color || player.data?.color;
        if (!playerColor) throw new Error("Assigned player has no color");
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
        err,
      );
    }
  }

  setLED(index: number, color: string): void {
    if (!this.#ledState[index]) {
      console.error(
        LOG_PREFIX +
          `Keypad[${
            this.#controllerId
          }].setLED() tried to set unknown led at '${index}'`,
      );
      return;
    }
    if (this.#ledState[index] !== color) {
      this.#ledChanged = true;
    }
    this.#ledState[index] = color;
  }

  /**
   * Get wanted LED colours, if changed since the last send.
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
   * Get wanted LED colours. Use getLEDState() to compare with confirmation.
   *
   * @returns {string[]}
   */
  peekLEDs() {
    return this.#ledState;
  }

  /**
   * Record the server's latest device-confirmed LED state. A null report
   * means the command is pending or the device cannot confirm it.
   */
  registerLEDState({ appliedLeds }: LEDStateReport): void {
    if (appliedLeds === null) {
      this.#currentLEDState = null;
      return;
    }
    const led1 = appliedLeds?.led1;
    const led2 = appliedLeds?.led2;
    const valid = (color: RGBColor | undefined): color is RGBColor =>
      color !== undefined && [color.r, color.g, color.b].every((channel) =>
        Number.isInteger(channel) && channel >= 0 && channel <= 255,
      );
    if (!valid(led1) || !valid(led2)) return;
    const toHex = (color: RGBColor) =>
      `#${[color.r, color.g, color.b]
        .map((channel) => channel.toString(16).padStart(2, "0"))
        .join("")}`.toUpperCase();
    this.#currentLEDState = [toHex(led1), toHex(led2)];
  }

  /**
   * Snapshot wanted colours and confirmed colours. `matches` is null while
   * the current physical state has not been confirmed by the server.
   */
  getLEDState(): { wanted: [string, string]; current: [string, string] | null; matches: boolean | null } {
    const wanted: [string, string] = [...this.#ledState];
    const current: [string, string] | null = this.#currentLEDState === null ? null : [...this.#currentLEDState];
    return {
      wanted,
      current,
      matches: current === null ? null :
        current.every((color, index) => color === wanted[index].toUpperCase()),
    };
  }
}
