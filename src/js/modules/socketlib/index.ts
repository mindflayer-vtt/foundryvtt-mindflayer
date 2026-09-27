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
import type MindFlayer from "../../MindFlayer";
import AbstractSubModule from "../AbstractSubModule";

const SUB_LOG_PREFIX = LOG_PREFIX + "SocketlibWrapper: ";

type RpcCallback = (...args: unknown[]) => unknown;

interface SocketlibConnection {
  register(name: string, callback: RpcCallback): void;
  executeAsGM(name: string, ...parameters: unknown[]): Promise<unknown>;
  executeForAllGMs(name: string, ...parameters: unknown[]): Promise<unknown>;
  executeForOtherGMs(name: string, ...parameters: unknown[]): Promise<unknown>;
  executeForEveryone(name: string, ...parameters: unknown[]): Promise<unknown>;
  executeForOthers(name: string, ...parameters: unknown[]): Promise<unknown>;
}

interface SocketlibApi {
  registerModule(name: string): SocketlibConnection;
}

/**
 * A simple wrapper for the socketlib library from
 * {@link https://github.com/manuelVo/foundryvtt-socketlib}
 */
export default class SocketlibWrapper extends AbstractSubModule {
  #socket!: SocketlibConnection;
  #mapping: Map<string, { callback: RpcCallback | null }>;

  constructor(instance: MindFlayer) {
    super(instance);
    this.#mapping = new Map();
  }

  ready() {
    this.#socket = (window.socketlib as SocketlibApi).registerModule(VTT_MODULE_NAME);
  }

  /**
   * Always start this module as it allows crosscommunication between all clients
   * @returns true
   */
  static shouldStart(): boolean {
    return true;
  }

  /**
   * Register or override a callback
   *
   * @param {string} name name of the function to register
   * @param {CallableFunction} callback the function to be called
   */
  provide<Args extends unknown[]>(name: string, callback: (...args: Args) => unknown): void {
    console.debug(`${SUB_LOG_PREFIX}registering callback for '${name}'`);
    if (!this.#mapping.has(name)) {
      this.#socket.register(name, this.#callFunc.bind(this, name));
    }
    // Socketlib supplies the arguments at runtime; individual registrations
    // retain their narrower callback signatures at the public boundary.
    this.#mapping.set(name, { callback: callback as RpcCallback });
  }

  /**
   * Removes a callback from registration
   *
   * @param {string} name name of the function to unregister
   */
  remove(name: string): void {
    const registration = this.#mapping.get(name);
    if (registration) registration.callback = null;
  }

  /**
   * Execute the given function for the GM
   *
   * @param {string} name name of the function to call
   * @param {...any} parameters parameters for the function
   * @returns {Promise<void>} finishes as soon as the command was sent
   */
  async executeAsGM(name: string, ...parameters: unknown[]): Promise<unknown> {
    return this.#socket.executeAsGM(name, ...parameters);
  }

  /**
   * Execute the given function for all GM-Players
   *
   * @param {string} name name of the function to call
   * @param  {...any} parameters parameters for the function
   * @returns {Promise<void>} finishes as soon as the command was sent
   */
  async executeForAllGMs(name: string, ...parameters: unknown[]): Promise<unknown> {
    return this.#socket.executeForAllGMs(name, ...parameters);
  }

  /**
   * Execute the given function for all other GM-Players
   *
   * @param {string} name name of the function to call
   * @param  {...any} parameters parameters for the function
   * @returns {Promise<void>} finishes as soon as the command was sent
   */
  async executeForOtherGMs(name: string, ...parameters: unknown[]): Promise<unknown> {
    return this.#socket.executeForOtherGMs(name, ...parameters);
  }

  /**
   * Execute the given function for all players
   *
   * @param {string} name name of the function to call
   * @param  {...any} parameters parameters for the function
   * @returns {Promise<void>} finishes as soon as the command was sent
   */
  async executeForEveryone(name: string, ...parameters: unknown[]): Promise<unknown> {
    return this.#socket.executeForEveryone(name, ...parameters);
  }

  /**
   * Execute the given function for all other players
   *
   * @param {string} name name of the function to call
   * @param  {...any} parameters parameters for the function
   * @returns {Promise<void>} finishes as soon as the command was sent
   */
  async executeForOthers(name: string, ...parameters: unknown[]): Promise<unknown> {
    return this.#socket.executeForOthers(name, ...parameters);
  }

  #callFunc(name: string, ...args: unknown[]): void {
    const callback = this.#mapping.get(name)?.callback;
    if (!callback) {
      console.warn(
        `${SUB_LOG_PREFIX}Tried to call unregistered method [${name}]`,
      );
      return;
    }

    console.debug(`${SUB_LOG_PREFIX}calling '${name}' with arguments: `, args);
    callback(...args);
  }
}
