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

import Timer from ".";
import { LOG_PREFIX } from "../../settings/constants";
import { getModuleInstance } from "../../utils/module";

const LOG_SUB_PREFIX = `${LOG_PREFIX}TimerRunner: `;

export const TIMER_RADIUS = 50;
export const TIMER_ANGLE_START = -Math.PI / 2;

/**
 * @property {object} options
 * @property {number} options.neededRole the CONST.USER_ROLES needed to see the timer, TRUSTED or lower will utilise the ambilight LEDs
 * @property {callback} options.onDone optional callback function to be called
 */
export default class TimerRunner extends PIXI.Container {
  #start = new Date().valueOf();
  #end;
  /** @type {PIXI.Graphics} */
  #background;
  /** @type {PIXI.Graphics} */
  #indicator;
  /** @type {PIXI.Text} */
  #text;
  #timeout;

  constructor(start, end, options = {}) {
    super();
    this.options = mergeObject(this.defaultOptions, options);
    if (start != null) {
      this.#start = start;
    }
    this.#end = end;
    this.#timeout = window.setTimeout(
      this.#handleDone.bind(this),
      this.durationMS
    );
    this.initDisplay();
    this.name = LOG_SUB_PREFIX + (end - start) / 1000 + "s";
    this.x = 0;
    this.y = 0;
    this.height = TIMER_RADIUS * 2;
    this.width = this.height;
    console.debug(`${LOG_SUB_PREFIX} Started Timer`, this);
  }

  async abort() {
    if (this.#timeout) {
      window.clearTimeout(this.#timeout);
    }
    this.#timeout = null;
  }

  /**
   * @type {Timer}
   */
  get timer() {
    return getModuleInstance().modules[Timer.name];
  }

  get start() {
    return this.#start;
  }

  get end() {
    return this.#end;
  }

  get durationMS() {
    return this.#end - this.#start;
  }

  get defaultOptions() {
    return {
      onDone: null,
      neededRole: CONST.USER_ROLES.PLAYER,
    };
  }

  /**
   * Calculate the completed percentage of the timer
   *
   * @param {number} now current timestamp in milliseconds
   * @returns the percentage (0 to 1) of completion or -1 if not started yet
   */
  completion(now = new Date().valueOf()) {
    if (now < this.#start) {
      return -1;
    } else if (now >= this.#end) {
      return 1;
    } else {
      return (now - this.#start) / (this.#end - this.#start);
    }
  }

  async initDisplay() {
    if (!canvas.initialized) return Promise.reject("Canvas not ready!");
    this.#background = new PIXI.Graphics();
    this.#background.beginFill(0xff0000);
    this.#background.drawCircle(0, 0, TIMER_RADIUS);
    this.#background.alpha = 0.6;
    this.addChild(this.#background);

    this.#indicator = new PIXI.LegacyGraphics();
    canvas.controls.hud.addChild(this);
    this.addChild(this.#indicator);

    this.#text = new PIXI.Text("--s", {
      fontFamily: "Verdana, Geneva, sans-serif",
      fontSize: 40,
      stroke: "white",
      strokeThickness: 2,
    });
    this.#text.anchor.set(0.5);
    this.addChild(this.#text);

    return this.update(this.#start);
  }

  async update(now = new Date().valueOf()) {
    if (!canvas.initialized) return Promise.reject("Canvas not ready!");
    const completed = this.completion(now);

    const endAngle = Math.PI * 2 * completed + TIMER_ANGLE_START;
    this.#indicator.clear();
    this.#indicator.beginFill(0x88ff20);
    this.#indicator.lineStyle(2, 0xffffff);
    this.#indicator.moveTo(0, 0);
    this.#indicator.lineTo(0, -TIMER_RADIUS);
    this.#indicator.arc(0, 0, TIMER_RADIUS, TIMER_ANGLE_START, endAngle, true); // cx, cy, radius, startAngle, endAngle
    this.#indicator.lineTo(0, 0);

    this.#text.text =
      Math.round((1 - completed) * ((this.#end - this.#start) / 1000)) + "s";
    this.#text.updateText();
    return Promise.resolve();
  }

  async #handleDone() {
    console.debug(`${LOG_SUB_PREFIX} Finished Timer`, this);
    this.timer.removeTimer(this);
    if (
      this.options &&
      Object.hasOwn(this.options, "onDone") &&
      typeof this.options.onDone === "function"
    ) {
      this.options.onDone();
    }
  }
}
