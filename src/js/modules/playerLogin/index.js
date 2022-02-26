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
import { default as Socket } from "../socket";

export default class PlayerLogin extends AbstractSubModule {
  #messageHandlerFun;

  constructor(instance) {
    super(instance);
    this.#messageHandlerFun = this.#messageHandler.bind(this);
  }

  ready() {
    this.socket.registerListener("keyboard-login", this.#messageHandlerFun);
  }

  unhook() {
    this.socket.unregisterListener("keyboard-login", this.#messageHandlerFun);
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

  #messageHandler(message) {
    const settings = this.instance.settings.settings;

    settings.mappings[message["player-id"]] = message["controller-id"];

    this.instance.settings.settings = settings;
  }
}
