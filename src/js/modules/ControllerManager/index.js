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
import { hexToRgb } from "../../utils/color";
import AbstractSubModule from "../AbstractSubModule";
import { default as Socket } from "../socket";
import Keypad from "./Keypad";

const SUB_LOG_PREFIX = LOG_PREFIX + "ControllerManager: ";
const CONTROLLER_FPS = 60;

export default class ControllerManager extends AbstractSubModule {
  /**
   * @var {Record<string, Keypad>} #keypads.*
   */
  #keypads = {};

  #tickThread = null;
  #tickListeners = [];

  #onRegisterFun = null;
  #onKeyEventFun = null;

  constructor(instance) {
    super(instance);
    this.#onRegisterFun = this.#onRegisterHandler.bind(this);
    this.#onKeyEventFun = this.#onKeyEventHandler.bind(this);
    this.socket.registerListener("registration", this.#onRegisterFun);
    this.socket.registerListener("key-event", this.#onKeyEventFun);
  }

  ready() {
    this.#tickThread = window.setInterval(
      this.#tick.bind(this),
      Math.round(1000 / CONTROLLER_FPS),
    );
  }

  unhook() {
    window.clearInterval(this.#tickThread);
    this.#tickThread = null;
    this.socket.unregisterListener("registration", this.#onRegisterFun);
    this.socket.unregisterListener("key-event", this.#onKeyEventFun);
    this.#tickListeners = [];
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

  /**
   * @type {Keypad[]}
   */
  get keypads() {
    return Object.values(this.#keypads);
  }

  #onRegisterHandler(msg) {
    if (msg.receiver) {
      console.debug(
        SUB_LOG_PREFIX +
          "Got registration message from other receiver, ignoring!",
      );
      return;
    }
    const controllerId = msg["controller-id"];
    if (msg.status === "connected") {
      this.#keypads[controllerId] = new Keypad(this.instance, controllerId);
      ui.notifications.info(
        "Mind Flayer: " +
          game.i18n.format("MindFlayer.Notifications.NewClient", {
            controller: controllerId,
            player: this.#keypads[controllerId].player?.name || "unassigned",
          }),
      );
    } else if (msg.status === "disconnected") {
      ui.notifications.warn(
        "Mind Flayer: " +
          game.i18n.format("MindFlayer.Notifications.ClientDisconnected", {
            controller: controllerId,
            player: this.#keypads[controllerId].player?.name || "unassigned",
          }),
      );
      delete this.#keypads[controllerId];
    }
  }

  #onKeyEventHandler(msg) {
    const controllerId = msg["controller-id"];
    if (!Object.hasOwn(this.#keypads, controllerId)) {
      console.warn(
        SUB_LOG_PREFIX +
          `Keypad '${controllerId}' sent key-event before registration, ignoring!`,
      );
      return;
    }
    this.#keypads[controllerId].registerKeyEvent(msg);
  }

  #tick() {
    const frameTime = new Date().getTime();
    for (let i = 0; i < this.#tickListeners.length; i++) {
      const callback = this.#tickListeners[i];
      try {
        callback(frameTime, this.#keypads);
      } catch (err) {
        console.error(
          SUB_LOG_PREFIX +
            `Keypad Tick Listener [${i}] threw an error, unregistering: `,
          err,
          callback,
        );
        this.unregisterTickListener(callback);
      }
    }
    this.#sendChangedLEDs();
  }

  #sendChangedLEDs() {
    for (let name in this.#keypads) {
      if (!Object.hasOwn(this.#keypads, name)) {
        continue;
      }
      /** @type {Keypad}  */
      const keypad = this.#keypads[name];
      const leds = keypad.getLEDsIfChanged();
      if (leds) {
        console.debug(
          `${SUB_LOG_PREFIX}Sending updated LEDs to keypad '${keypad.controllerId}'`,
        );
        const data = JSON.stringify({
          type: "configuration",
          "controller-id": keypad.controllerId,
          led1: hexToRgb(leds[0]),
          led2: hexToRgb(leds[1]),
        });
        this.socket.send(data);
      }
    }
  }

  registerTickListener(callback) {
    this.#tickListeners.push(callback);
  }

  unregisterTickListener(callback) {
    this.#tickListeners = this.#tickListeners.filter((c) => c !== callback);
  }
}
