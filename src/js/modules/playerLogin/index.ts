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
import Socket, { type SocketMessage } from "../socket";
import SocketlibWrapper from "../socketlib";
import { SOCKETLIB_TIMER_ADD } from "../timer";
import { VTT_MODULE_NAME } from "../../settings/constants";
import type MindFlayer from "../../MindFlayer";

const SOCKETLIB_PLAYER_LOGIN_REGISTER = "PlayerLogin_register";

export default class PlayerLogin extends AbstractSubModule {
  #messageHandlerFun;

  constructor(instance: MindFlayer) {
    super(instance);
    this.#messageHandlerFun = this.#messageHandler.bind(this);
  }

  ready() {
    this.socket.registerListener("keyboard-login", this.#messageHandlerFun);
    this.socketlib.provide(SOCKETLIB_TIMER_ADD, this.#register.bind(this));
  }

  unhook() {
    this.socket.unregisterListener("keyboard-login", this.#messageHandlerFun);
    this.socketlib.remove(SOCKETLIB_TIMER_ADD);
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, Socket.name, SocketlibWrapper.name];
  }

  get socketlib(): SocketlibWrapper {
    return Reflect.get(this.instance!.modules, SocketlibWrapper.name) as SocketlibWrapper;
  }

  get socket(): Socket {
    return Reflect.get(this.instance!.modules, Socket.name) as Socket;
  }

  #messageHandler(message: SocketMessage): void {
    const controllerId = message["controller-id"];
    const playerId = message["player-id"];
    if (typeof controllerId !== "string" || typeof playerId !== "string") return;
    this.socketlib.executeAsGM(
      SOCKETLIB_PLAYER_LOGIN_REGISTER,
      controllerId,
      playerId,
    );
  }

  async #register(controllerId: string, playerId: string): Promise<void> {
    if (!game.user.isGM) {
      return;
    }
    const settings = this.instance!.settings.settings;
    await game.settings.set(VTT_MODULE_NAME, "settings", {
      ...settings,
      mappings: { ...settings.mappings, [playerId]: controllerId },
    });
  }
}
