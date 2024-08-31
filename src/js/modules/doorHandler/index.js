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
import { default as ControllerManager } from "../ControllerManager";
import * as TokenUtil from "../../utils/tokenUtil";
import Keypad from "../ControllerManager/Keypad";
import { Rectangle, Vector } from "../../utils/2d-geometry";
import { LOG_PREFIX } from "../../settings/constants";

const SUB_LOG_PREFIX = `${LOG_PREFIX}DoorHandler: `;

export default class DoorHandler extends AbstractSubModule {
  #nextDoorTimestamp;
  #doorQueue = [];
  #tickHandlerFun;

  constructor(instance) {
    super(instance);
    this.#tickHandlerFun = this.#tickHandler.bind(this);
  }

  ready() {
    if (this.instance.settings.core.noCanvas) {
      console.info(SUB_LOG_PREFIX + "canvas is disabled, cannot control doors");
      return;
    }
    this.#nextDoorTimestamp = new Date().getTime();
    this.controllerManager.registerTickListener(this.#tickHandlerFun);
  }

  unhook() {
    if (!this.instance.settings.core.noCanvas) {
      this.controllerManager.unregisterTickListener(this.#tickHandlerFun);
    }
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, ControllerManager.name];
  }

  /**
   * @returns {ControllerManager}
   */
  get controllerManager() {
    return this.instance.modules[ControllerManager.name];
  }

  /**
   * Called once per Keypad tick/frame to handle interaction with the keypad
   *
   * @param {number} now the timestamp of the current Keypad "frame"
   * @param {Record<string,Keypad>} keypads an array of all connected Keypads
   */
  #tickHandler(now, keypads) {
    for (const keypad of Object.values(keypads)) {
      if (keypad.isJustDown("E", now)) {
        this.#enqueueDoors(keypad);
      }
    }
    this.#processDoorQueue(now);
  }

  #processDoorQueue(now) {
    if (this.#nextDoorTimestamp <= now && this.#doorQueue.length > 0) {
      const doorCR = this.#doorQueue.shift();
      console.debug(
        SUB_LOG_PREFIX +
          `${doorCR.player.name}[${doorCR.token.name}]: toggling the door `,
        doorCR.door
      );
      const evt = new PIXI.FederatedMouseEvent();
      evt.button = 0;
      doorCR.door.doorControl._onMouseDown(evt);
      this.#nextDoorTimestamp = now + 150;
    }
  }

  /**
   * @param {Keypad} keypad
   */
  #enqueueDoors(keypad) {
    const player = keypad.player;
    const token = TokenUtil.getTokenFor(player);

    const interactionBounds = new Rectangle(
      new Vector(
        token.x - canvas.grid.size,
        token.y + token.height + canvas.grid.size
      ),
      new Vector(
        token.x + token.width + canvas.grid.size,
        token.y - canvas.grid.size
      )
    );

    for (const door of canvas.walls.doors) {
      if (
        door.doorControl &&
        interactionBounds.intersect(Rectangle.fromBounds(door.bounds)) &&
        !this.#doorQueue.find((d) => d.door === door)
      ) {
        this.#doorQueue.push({
          player,
          token,
          door,
        });
      }
    }
  }
}
