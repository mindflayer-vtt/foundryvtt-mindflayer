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
import { LOG_PREFIX } from "../../settings/constants";
import AbstractSubModule from "../AbstractSubModule";
import Socket from "../socket";

const LOG_SUB_PREFIX = `${LOG_PREFIX}TableLEDRing: `;

export default class TableLEDRing extends AbstractSubModule {
  #updateLEDsTimer = null;
  /** @type {import("./TableLEDRingHandler").TableLEDRingHandler[]} */
  #handlers = [];
  #tableLEDsLastSent = "";

  ready() {
    // The module may be asked to load as dependency
    // WebSocket to connect to elder brain will only start if enabled
    if (!Socket.shouldStart(this.instance)) return;
    this.#updateLEDsTimer = setInterval(
      this.#updateLEDs.bind(this),
      1000 / this.instance.settings.ambilight.fps
    );
  }

  unhook() {
    if (this.#updateLEDsTimer) {
      clearInterval(this.#updateLEDsTimer);
      this.#updateLEDsTimer = null;
    }
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

  async #updateLEDs() {
    this.ensureLoaded();
    // Chill, we don't have a connection.
    if (!this.socket.isConnected) return;

    /** @type {import("./TableLEDRingHandler").TableLEDRingHandler} */
    let handler = null;
    let highestPriority = -1;
    this.#handlers.forEach((h) => {
      const prio = h.priority;
      if (prio > highestPriority) {
        handler = h;
        highestPriority = prio;
      }
    });

    this.#sendTableLEDData(
      await handler.updateLEDs(this.instance.settings.ambilight.led.count)
    );
  }

  /**
   * @param {Uint32Array} ledState
   */
  #sendTableLEDData(ledState) {
    this.ensureLoaded();
    // Chill, we don't have a connection.
    if (!this.socket.isConnected) return;
    // enabled and we have data?
    if (ledState === null || !this.instance.settings.ambilight.enabled) {
      return;
    }
    const data = JSON.stringify({
      type: "ambilight",
      target: this.instance.settings.ambilight.target,
      universe: this.instance.settings.ambilight.universe,
      colors: Array.from(ledState),
    });
    if (this.#tableLEDsLastSent !== data) {
      try {
        this.socket.send(data);
        this.#tableLEDsLastSent = data;
      } catch (e) {
        console.warn(
          `${LOG_SUB_PREFIX}Socket threw an exception, may not be connected yet...`
        );
        console.debug(e);
      }
    }
  }

  /**
   * @param {import("./TableLEDRingHandler").TableLEDRingHandler} handler
   */
  registerHandler(handler) {
    if (!this.#handlers.includes(handler)) {
      this.#handlers.push(handler);
    }
  }

  /**
   * @param {import("./TableLEDRingHandler").TableLEDRingHandler} handler
   */
  unregisterHandler(handler) {
    this.#handlers = this.#handlers.filter((h) => h !== handler);
  }
}
