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
import { createReceiverRegistration } from "../../utils/protocol";
import type MindFlayer from "../../MindFlayer";

const SUB_LOG_PREFIX = LOG_PREFIX + "Socket: ";
export type SocketMessage = Readonly<Record<string, unknown> & { type: string }>;
export type SocketListener = (message: SocketMessage) => void;

export default class Socket extends AbstractSubModule {
  static shouldStart(instance: MindFlayer): boolean {
    return super.shouldStart(instance) || game.user?.isGM === true;
  }

  #connection: WebSocket | null = null;
  #onmessageFun: (message: MessageEvent<string>) => void;
  #onopenFun: (event: Event) => void;
  #oncloseFun: (event: CloseEvent) => void;
  #onerrorFun: (event: Event) => void;
  #initializeWebsocketFun: () => void;
  #reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  #handlers: Record<string, SocketListener[]> = {};

  constructor(instance: MindFlayer) {
    super(instance);

    this.#onmessageFun = this._onmessage.bind(this);
    this.#onopenFun = this._onopen.bind(this);
    this.#oncloseFun = this._onclose.bind(this);
    this.#onerrorFun = this._onerror.bind(this);
    this.#initializeWebsocketFun = this._initializeWebsocket.bind(this);
  }

  ready() {
    // A dependency can load Socket even when controller discovery is inactive.
    if (!this.instance || !Socket.shouldStart(this.instance)) return;
    this._initializeWebsocket();
  }

  unhook() {
    if (this.#reconnectTimeout !== null) {
      clearTimeout(this.#reconnectTimeout);
      this.#reconnectTimeout = null;
    }
    try {
      this.send(
        JSON.stringify({
          type: "registration",
          status: "disconnected",
          receiver: true,
          players: [],
        }),
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

  get isConnected(): boolean {
    return (
      this.#connection !== null &&
      this.#connection.readyState === this.#connection.OPEN
    );
  }

  registerListener(type: string, callback: SocketListener): void {
    if (!Array.isArray(this.#handlers[type])) {
      this.#handlers[type] = [];
    }
    this.#handlers[type].push(callback);
  }

  unregisterListener(type: string, callback: SocketListener): void {
    if (!Array.isArray(this.#handlers[type])) {
      return;
    }
    this.#handlers[type] = this.#handlers[type].filter((c) => c !== callback);
  }

  ensureConnected(): WebSocket {
    this.ensureLoaded();
    const connection = this.#connection;
    if (!connection || connection.readyState !== connection.OPEN) {
      throw new ReferenceError(
        `The module 'Socket' does not have a connection`,
      );
    }
    return connection;
  }

  send(data: string): void {
    this.ensureConnected().send(data);
  }

  _initializeWebsocket(): void {
    const instance = this.instance;
    if (!this.loaded || !instance) return;
    this.#reconnectTimeout = null;
    const connection = new WebSocket(instance.settings.websocket.url);
    this.#connection = connection;
    connection.addEventListener("open", this.#onopenFun);
    connection.addEventListener("error", this.#onerrorFun);
    connection.addEventListener("message", this.#onmessageFun);
    connection.addEventListener("close", this.#oncloseFun);
  }

  /**
   * @param {MessageEvent<any>} message
   */
  _onmessage(message: MessageEvent<string>): void {
    const data: unknown = JSON.parse(message.data);
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
  _onopen(data: Event): void {
    const instance = this.instance;
    if (!instance) return;
    ui.notifications.info(
      "Mind Flayer: " +
        game.i18n.format("MindFlayer.Notifications.Connected", {
          host: instance.settings.websocket.host,
          port: instance.settings.websocket.port,
          path: instance.settings.websocket.path,
        }),
    );
    console.log(SUB_LOG_PREFIX + "Connected! ", data);
    this.send(JSON.stringify(createReceiverRegistration(game.users.players)));
  }

  /**
   * @param {CloseEvent} evt
   */
  _onclose(evt: CloseEvent): void {
    this.#connection = null;
    if (this.loaded) {
      ui.notifications.error(
        "Mind Flayer: " +
          game.i18n.localize("MindFlayer.Notifications.ConnectionClosed"),
      );
      console.debug(SUB_LOG_PREFIX + "Websocket connection closed:", evt);
      console.warn(SUB_LOG_PREFIX + "Attempting to reconnect in 5 seconds...");
      this.#reconnectTimeout = setTimeout(this.#initializeWebsocketFun, 5000);
    }
  }

  /**
   * @param {Event} error
   */
  _onerror(error: Event): void {
    ui.notifications.error(
      "Mind Flayer: " + game.i18n.localize("MindFlayer.Notifications.Error"),
    );
    console.error(SUB_LOG_PREFIX + "Error! ", error);
    this.#connection?.close();
  }

  _dispatch(data: unknown): void {
    if (data === null || typeof data !== "object") {
      console.error(SUB_LOG_PREFIX + "Received message without type: ", data);
      return;
    }
    Object.freeze(data);
    if (!Object.hasOwn(data, "type") || typeof (data as { type?: unknown }).type !== "string") {
      console.error(SUB_LOG_PREFIX + "Received message without type: ", data);
      return;
    }
    const message = data as SocketMessage;
    const handlers = this.#handlers[message.type];
    if (!Array.isArray(handlers)) {
      console.warn(
        SUB_LOG_PREFIX + "Received message with unhandled type: ",
        message,
      );
      return;
    }
    for (let i = 0; i < handlers.length; i++) {
      const callback = handlers[i];
      try {
        callback(message);
      } catch (err) {
        // ignore and log any errors
        console.warn(
          SUB_LOG_PREFIX + `Handler [${message.type}][${i}] threw an error: `,
          err,
        );
      }
    }
  }
}
