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

const SUB_LOG_PREFIX = LOG_PREFIX + "WakeLock: ";

/**
 * Uses Navigator.wakeLock to keep the Screensaver from activating
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/wakeLock
 */
export default class WakeLock extends AbstractSubModule {
  enabled = false;
  #wakeLock = null;
  #wakeLockFun = null;

  constructor(instance) {
    super(instance);

    this.#wakeLockFun = this.ensureWakeLock.bind(this);
  }

  ready() {
    document.addEventListener("visibilitychange", this.#wakeLockFun);
  }

  unhook() {
    this.enabled = false;
    document.removeEventListener("visibilitychange", this.#wakeLockFun);
    super.unhook();
  }

  async ensureWakeLock() {
    if (this.enabled && document.visibilityState === "visible") {
      if (this.#wakeLock !== null && !this.#wakeLock.released) {
        return;
      }
      try {
        this.#wakeLock = await navigator.wakeLock.request();
        const $this = this;
        this.#wakeLock.addEventListener("release", () => {
          $this.#wakeLock = null;
          console.debug(SUB_LOG_PREFIX + "screen lock released");
        });
        console.debug(SUB_LOG_PREFIX + "locked the screen awake");
      } catch (err) {
        console.error(
          SUB_LOG_PREFIX + `Error locking ${err.name}, ${err.message}`
        );
      }
    } else if (this.#wakeLock != null) {
      if (this.#wakeLock.released) {
        this.#wakeLock = null;
      } else {
        this.#wakeLock.release();
      }
    }
  }
}
