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

export class Key {
  #state = false;
  #lastUp = null;
  lastTrigger = null;
  get down() {
    return this.#state;
  }
  set down(isDown) {
    if (!isDown) {
      this.#lastUp = null;
      this.lastTrigger = null;
    }
    this.#state = isDown;
  }

  isJustDown(time) {
    if (!this.#state) {
      return false;
    }
    if (this.#lastUp === null || this.#lastUp === time) {
      this.#lastUp = time;
      return true;
    }
    return false;
  }

  isRepeatedDown(time) {
    if (!this.#state) {
      return false;
    }
    if (this.lastTrigger === null || this.lastTrigger === time) {
      this.lastTrigger = time;
      return true;
    }
    if (time > this.lastTrigger + 250) {
      // Last trigger is more than 250ms ago
      this.lastTrigger = time;
      return true;
    }
    return false;
  }
}
