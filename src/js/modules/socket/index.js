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

const SUB_LOG_PREFIX = LOG_PREFIX + "Socket: ";

export default class Socket extends AbstractSubModule {
  /** @type {WebSocket|null} */
  #connection = null;
  #onmessageFun = null;
  #onopenFun = null;
  #oncloseFun = null;
  #onerrorFun = null;
  #initializeWebsocketFun = null;
  #handlers = {};

  constructor(instance) {
    super(instance);

    this.#onmessageFun = this._onmessage.bind(this);
    this.#onopenFun = this._onopen.bind(this);
    this.#oncloseFun = this._onclose.bind(this);
    this.#onerrorFun = this._onerror.bind(this);
    this.#initializeWebsocketFun = this._initializeWebsocket.bind(this);
  }

  ready() {
    // The module may be asked to load as dependency
    // WebSocket to connect to elder brain will only start if enabled
    if (!Socket.shouldStart(this.instance)) return;
    this._initializeWebsocket();
  }

  unhook() {
    try {
      this.send(
        JSON.stringify({
          type: "registration",
          status: "disconnected",
          receiver: true,
          players: [],
        })
      );
    } catch (err) {
      console.debug(SUB_LOG_PREFIX + "Failed to send disconnect message", err);
    }
    if (this.#connection) {
      this.#connection.close();
    }
    this.#connection = null;
    super.unhook();
  }

  get isConnected() {
    return (
      this.#connection !== null &&
      this.#connection.readyState === this.#connection.OPEN
    );
  }

  registerListener(type, callback) {
    if (!Array.isArray(this.#handlers[type])) {
      this.#handlers[type] = [];
    }
    this.#handlers[type].push(callback);
  }

  unregisterListener(type, callback) {
    if (!Array.isArray(this.#handlers[type])) {
      return;
    }
    this.#handlers[type] = this.#handlers[type].filter((c) => c !== callback);
  }

  ensureConnected() {
    this.ensureLoaded();
    if (!this.isConnected) {
      throw new ReferenceError(
        `The module 'Socket' does not have a connection`
      );
    }
  }

  send(data) {
    this.ensureConnected();
    this.#connection.send(data);
  }

  _initializeWebsocket() {
    this.#connection = new WebSocket(this.instance.settings.websocket.url);
    this.#connection.addEventListener("open", this.#onopenFun);
    this.#connection.addEventListener("error", this.#onerrorFun);
    this.#connection.addEventListener("message", this.#onmessageFun);
    this.#connection.addEventListener("close", this.#oncloseFun);
  }

  /**
   * @param {MessageEvent<any>} message
   */
  _onmessage(message) {
    const data = JSON.parse(message.data);
    console.debug(SUB_LOG_PREFIX + "Received message: ", data);
    try {
      this._dispatch(data);
    } catch (error) {
      console.error(SUB_LOG_PREFIX + "Error dispatching: ", error);
    }
  }

  /**
   * @param {Event} data
   */
  _onopen(data) {
    ui.notifications.info(
      "Mind Flayer: " +
        game.i18n.format("MindFlayer.Notifications.Connected", {
          host: this.instance.settings.websocket.host,
          port: this.instance.settings.websocket.port,
          path: this.instance.settings.websocket.path,
        })
    );
    console.log(SUB_LOG_PREFIX + "Connected! ", data);
    this.send(
      JSON.stringify({
        type: "registration",
        status: "connected",
        receiver: true,
        players: game.users.players.map((player) => ({
          id: player.id,
          name: player.name,
        })),
      })
    );
  }

  /**
   * @param {CloseEvent} evt
   */
  _onclose(evt) {
    this.#connection = null;
    if (this.loaded) {
      ui.notifications.error(
        "Mind Flayer: " +
          game.i18n.localize("MindFlayer.Notifications.ConnectionClosed")
      );
      console.debug(SUB_LOG_PREFIX + "Websocket connection closed:", evt);
      console.warn(SUB_LOG_PREFIX + "Attempting to reconnect in 5 seconds...");
      setTimeout(this.#initializeWebsocketFun, 5000);
    }
  }

  /**
   * @param {Event} error
   */
  _onerror(error) {
    ui.notifications.error(
      "Mind Flayer: " + game.i18n.localize("MindFlayer.Notifications.Error")
    );
    console.error(SUB_LOG_PREFIX + "Error! ", error);
    this.#connection.close();
  }

  _dispatch(data) {
    Object.freeze(data);
    if (!data.hasOwnProperty("type")) {
      console.error(SUB_LOG_PREFIX + "Received message without type: ", data);
      return;
    }
    if (!Array.isArray(this.#handlers[data.type])) {
      console.warn(
        SUB_LOG_PREFIX + "Received message with unhandled type: ",
        data
      );
      return;
    }
    this.#handlers[data.type].forEach((callback, i) => {
      try {
        callback(data);
      } catch (err) {
        // ignore and log any errors
        console.warn(
          SUB_LOG_PREFIX + `Handler [${data.type}][${i}] threw an error: `,
          err
        );
      }
    });
  }
}
