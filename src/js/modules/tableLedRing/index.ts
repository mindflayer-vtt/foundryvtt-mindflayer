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
import { createAmbilightMessage } from "../../utils/protocol";
import type { TableLEDRingHandler } from "./TableLEDRingHandler";

const LOG_SUB_PREFIX = `${LOG_PREFIX}TableLEDRing: `;

export default class TableLEDRing extends AbstractSubModule {
  #updateLEDsTimer: ReturnType<typeof setInterval> | null = null;
  #handlers: TableLEDRingHandler[] = [];
  #tableLEDsLastSent = "";

  ready() {
    // A GM can connect to Socket for controller discovery while table
    // features remain disabled.
    if (!this.instance!.settings.enabled) return;
    this.#updateLEDsTimer = setInterval(
      this.#updateLEDs.bind(this),
      1000 / this.instance!.settings.ambilight.fps,
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

  get socket(): Socket {
    return Reflect.get(this.instance!.modules, Socket.name) as Socket;
  }

  async #updateLEDs(): Promise<void> {
    this.ensureLoaded();
    // Chill, we don't have a connection.
    if (!this.socket || !this.socket.isConnected) return;

    let handler: TableLEDRingHandler | null = null;
    let highestPriority = -1;
    for (const h of this.#handlers) {
      const prio = h.priority;
      if (prio > highestPriority) {
        handler = h;
        highestPriority = prio;
      }
    }

    if (!handler) return;
    this.#sendTableLEDData(
      await handler.updateLEDs(this.instance!.settings.ambilight.led.count),
    );
  }

  /**
   * @param {Uint32Array} ledState
   */
  #sendTableLEDData(ledState: Uint32Array | null | undefined): void {
    this.ensureLoaded();
    // Chill, we don't have a connection.
    if (!this.socket.isConnected) return;
    // enabled and we have data?
    if (ledState == null || !this.instance!.settings.ambilight.enabled) {
      return;
    }
    const data = JSON.stringify(
      createAmbilightMessage(
        this.instance!.settings.ambilight.target,
        this.instance!.settings.ambilight.universe,
        ledState,
      ),
    );
    if (this.#tableLEDsLastSent !== data) {
      try {
        this.socket.send(data);
        this.#tableLEDsLastSent = data;
      } catch (e) {
        console.warn(
          `${LOG_SUB_PREFIX}Socket threw an exception, may not be connected yet...`,
        );
        console.debug(e);
      }
    }
  }

  /**
   * @param {import("./TableLEDRingHandler").TableLEDRingHandler} handler
   */
  registerHandler(handler: TableLEDRingHandler): void {
    if (!this.#handlers.includes(handler)) {
      this.#handlers.push(handler);
    }
  }

  /**
   * @param {import("./TableLEDRingHandler").TableLEDRingHandler} handler
   */
  unregisterHandler(handler: TableLEDRingHandler): void {
    this.#handlers = this.#handlers.filter((h) => h !== handler);
  }
}
