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
import MindFlayer from "../../MindFlayer";
import { LOG_PREFIX, TABLE_LED_PRIORITY } from "../../settings/constants";
import { hexToRgb } from "../../utils/color";
import AbstractSubModule from "../AbstractSubModule";
import SocketlibWrapper from "../socketlib";
import TableLEDRing from "../tableLedRing";
import { TableLEDRingHandlerMixin } from "../tableLedRing/TableLEDRingHandlerMixin";
import StartTimerDialog from "./StartTimerDialog";
import { TimerRenderContainer } from "./TimerRenderContainer";
import TimerRunner from "./TimerRunner";

const LOG_SUB_PREFIX = LOG_PREFIX + "Timer: ";

export const SOCKETLIB_TIMER_ADD = "Timer_addTimerInternal";

export default class Timer extends TableLEDRingHandlerMixin(AbstractSubModule) {
  /** @type {TimerRunner[]} */
  #timers = [];
  /** @type {PIXI.Container} */
  #renderingContainer = null;
  #timerUpdateInterval = null;

  ready() {
    if (!this.instance.settings.core.noCanvas) {
      this.#renderingContainer = new TimerRenderContainer();
      canvas.stage.addChild(this.#renderingContainer);
      this.#timerUpdateInterval = window.setInterval(
        this.#updateTimers.bind(this),
        200
      );
    }
    if (this.instance.settings.ambilight.enabled) {
      this.tableLEDRing.registerHandler(this);
    }
    this.socketlib.provide(
      SOCKETLIB_TIMER_ADD,
      this.#addTimerInternal.bind(this)
    );
  }

  unhook() {
    this.socketlib.remove(SOCKETLIB_TIMER_ADD);
    this.tableLEDRing.unregisterHandler(this);
    if (this.#timerUpdateInterval) {
      window.clearInterval(this.#timerUpdateInterval);
    }
    this.#timerUpdateInterval = null;
    if (!this.instance.settings.core.noCanvas) {
      game.canvas.controls.removeChild(this.#renderingContainer);
    }
    this.#renderingContainer = null;
    for (const t of this.timers) {
      t.abort();
    }
    this.#timers = [];
    super.unhook();
  }

  static get moduleDependencies() {
    return [
      ...super.moduleDependencies,
      TableLEDRing.name,
      SocketlibWrapper.name,
    ];
  }

  /**
   * The Timer GUI may be used from any GM or Assistant seat
   * @param {MindFlayer} instance
   * @returns {boolean}
   */
  static shouldStart(instance) {
    return true;
  }

  /** @returns {TableLEDRing} */
  get tableLEDRing() {
    return this.instance.modules[TableLEDRing.name];
  }

  /** @returns {SocketlibWrapper} */
  get socketlib() {
    return this.instance.modules[SocketlibWrapper.name];
  }

  /**
   * @override
   */
  get priority() {
    if (this.#timers.length > 0) {
      return TABLE_LED_PRIORITY.TIMER;
    } else {
      return TABLE_LED_PRIORITY.OFF;
    }
  }

  #updateTimers() {
    this.ensureLoaded();
    const now = new Date().valueOf();
    for (const timer of this.#timers) {
      if (timer.end >= now) {
        timer.update(now);
      }
    }
  }

  async updateLEDs(count) {
    const leds = await super.updateLEDs(count);
    if (this.#timers.length > 0) {
      const now = new Date().valueOf();
      for (const t1 of this.#timers) {
        if(t1.end < now && t1.options?.onDone) {
          t1.options?.onDone();
        }
      }
      const timers = this.#timers
        .filter((t) => t.end >= now)
        .sort((a, b) => {
          return a.end >= b.end ? -1 : 1;
        });
      this.#timers = timers;
      const ledTimer = timers.find(
        (t) => t.options.neededRole <= CONST.USER_ROLES.TRUSTED
      );
      this.#displayTimer(ledTimer, leds, now);
    }
    return leds;
  }

  #displayTimer(timer, leds, now) {
    if (timer === undefined) return;
    const timerCompletion = timer.completion(now);
    const color = this.#getColor(timerCompletion);
    const totalLEDs = Math.floor(leds.length / 3);
    const totalValues = leds.length;
    const offset = this.instance.settings.ambilight.led.offset;
    const minBright = this.instance.settings.ambilight.brightness.min;
    const completion = Math.floor(totalLEDs * timerCompletion);
    for (let i = 0; i < totalLEDs; i++) {
      if (i > completion) {
        leds[(offset + i * 3 + 0) % totalValues] = color.r;
        leds[(offset + i * 3 + 1) % totalValues] = color.g;
        leds[(offset + i * 3 + 2) % totalValues] = color.b;
      } else {
        leds[(offset + i * 3 + 0) % totalValues] = minBright;
        leds[(offset + i * 3 + 1) % totalValues] = minBright;
        leds[(offset + i * 3 + 2) % totalValues] = minBright;
      }
    }
  }

  #getColor(completion) {
    if (completion > 2 / 3) {
      return hexToRgb("#FF0000");
    } else if (completion > 1 / 3) {
      return hexToRgb("#FFFF00");
    } else {
      return hexToRgb("#00FF00");
    }
  }

  async dialog() {
    try {
      const timer = await StartTimerDialog.getTimer();
      if (timer) {
        this.addTimer(timer);
        return timer;
      }
    } catch (err) {
      console.warn(`${LOG_SUB_PREFIX} error while starting a timer`, err);
    }
    return null;
  }

  #addTimerInternal(start, end, options) {
    if(options.neededRole <= game.user.role) {
      const timer = new TimerRunner(start, end, options);
      if (this.#renderingContainer) {
        this.#renderingContainer.addChild(timer);
      }
      this.#timers.push(timer);
    }
  }

  /**
   * Add a timerrunner to be displayed and handled
   *
   * @param {TimerRunner} timer
   */
  async addTimer(timer) {
    if (!this.#timers.includes(timer)) {
      this.#addTimerInternal(timer.start, timer.end, timer.options);
      await this.socketlib.executeForOthers(
        SOCKETLIB_TIMER_ADD,
        timer.start,
        timer.end,
        {
          ...timer.options,
          onDone: null,
        }
      );
    }
  }

  /**
   * Remove a timerrunner from display
   *
   * @param {TimerRunner} timer
   */
  async removeTimer(timer) {
    timer.abort();
    this.#timers = this.#timers.filter((t) => t !== timer);
    if (this.#renderingContainer) {
      this.#renderingContainer.removeChild(timer);
    }
  }
}
