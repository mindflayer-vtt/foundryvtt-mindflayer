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
import type { SocketListener, SocketMessage } from "../socket";
import Keypad from "./Keypad";
import { createControllerConfiguration } from "../../utils/protocol";
import type MindFlayer from "../../MindFlayer";

const SUB_LOG_PREFIX = LOG_PREFIX + "ControllerManager: ";
const CONTROLLER_FPS = 60;
type TickListener = (frameTime: number, keypads: Record<string, Keypad>) => void;

export default class ControllerManager extends AbstractSubModule {
  static shouldStart(instance: MindFlayer): boolean {
    return Socket.shouldStart(instance);
  }

  /**
   * @var {Record<string, Keypad>} #keypads.*
   */
  #keypads: Record<string, Keypad> = {};

  #tickThread: number | null = null;
  #tickListeners: TickListener[] = [];

  #onRegisterFun: SocketListener;
  #onKeyEventFun: SocketListener;
  #onLEDStateFun: SocketListener;

  constructor(instance: MindFlayer) {
    super(instance);
    this.#onRegisterFun = this.#onRegisterHandler.bind(this);
    this.#onKeyEventFun = this.#onKeyEventHandler.bind(this);
    this.#onLEDStateFun = this.#onLEDStateHandler.bind(this);
    this.socket.registerListener("registration", this.#onRegisterFun);
    this.socket.registerListener("key-event", this.#onKeyEventFun);
    this.socket.registerListener("led-state", this.#onLEDStateFun);
  }

  ready() {
    this.#tickThread = window.setInterval(
      this.#tick.bind(this),
      Math.round(1000 / CONTROLLER_FPS),
    );
  }

  unhook() {
    if (this.#tickThread !== null) window.clearInterval(this.#tickThread);
    this.#tickThread = null;
    this.socket.unregisterListener("registration", this.#onRegisterFun);
    this.socket.unregisterListener("key-event", this.#onKeyEventFun);
    this.socket.unregisterListener("led-state", this.#onLEDStateFun);
    this.#tickListeners = [];
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, Socket.name];
  }

  /**
   * @returns {Socket}
   */
  get socket(): Socket {
    const instance = this.instance;
    if (!instance) throw new ReferenceError("ControllerManager has been unloaded");
    return (instance.modules as unknown as Record<string, Socket>)[Socket.name];
  }

  /**
   * @type {Keypad[]}
   */
  get keypads() {
    return Object.values(this.#keypads);
  }

  #onRegisterHandler(msg: SocketMessage): void {
    if (msg.receiver) {
      console.debug(
        SUB_LOG_PREFIX +
          "Got registration message from other receiver, ignoring!",
      );
      return;
    }
    const controllerId = msg["controller-id"];
    if (typeof controllerId !== "string") return;
    if (msg.status === "connected") {
      const instance = this.instance;
      if (!instance) return;
      this.#keypads[controllerId] = new Keypad(instance, controllerId);
      if (msg.deviceAuthenticated === true && Object.hasOwn(msg, "appliedLeds")) {
        this.#keypads[controllerId].registerLEDState({ appliedLeds: msg.appliedLeds });
      }
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
            player: this.#keypads[controllerId]?.player?.name || "unassigned",
          }),
      );
      delete this.#keypads[controllerId];
    }
  }

  #onKeyEventHandler(msg: SocketMessage): void {
    const controllerId = msg["controller-id"];
    if (typeof controllerId !== "string" || !Object.hasOwn(this.#keypads, controllerId)) {
      console.warn(
        SUB_LOG_PREFIX +
          `Keypad '${controllerId}' sent key-event before registration, ignoring!`,
      );
      return;
    }
    if (typeof msg.key !== "string" || typeof msg.state !== "string") return;
    this.#keypads[controllerId].registerKeyEvent({ key: msg.key, state: msg.state });
  }

  #onLEDStateHandler(msg: SocketMessage): void {
    if (msg.deviceAuthenticated !== true) return;
    const controllerId = msg["controller-id"];
    if (typeof controllerId !== "string") return;
    const keypad = this.#keypads[controllerId];
    keypad?.registerLEDState({ appliedLeds: msg.appliedLeds });
  }

  #tick() {
    const frameTime = new Date().getTime();
    for (const [i, callback] of [...this.#tickListeners].entries()) {
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
        const led1 = hexToRgb(leds[0]);
        const led2 = hexToRgb(leds[1]);
        if (!led1 || !led2) {
          console.warn(`${SUB_LOG_PREFIX}Invalid LED color for keypad '${keypad.controllerId}'`);
          continue;
        }
        console.debug(
          `${SUB_LOG_PREFIX}Sending updated LEDs to keypad '${keypad.controllerId}'`,
        );
        const data = JSON.stringify(
          createControllerConfiguration(
            keypad.controllerId,
            led1,
            led2,
          ),
        );
        this.socket.send(data);
      }
    }
  }

  registerTickListener(callback: TickListener): void {
    this.#tickListeners.push(callback);
  }

  unregisterTickListener(callback: TickListener): void {
    this.#tickListeners = this.#tickListeners.filter((c) => c !== callback);
  }
}
