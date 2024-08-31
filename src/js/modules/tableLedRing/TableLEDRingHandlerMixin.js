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

/**
 *
 * @mixin
 */
export const TableLEDRingHandlerMixin = (S) => {
  return class TableLEDRingHandler extends S {
    /**
     * @returns {number} >= 0
     */
    get priority() {
      return 0;
    }

    /**
     *
     * @param {number} count the number of leds in the table
     * @returns {Promise<Uint32Array>} with 3 entries per LED (red, green, blue)
     */
    async updateLEDs(count) {
      return new Uint32Array(count * 3);
    }
  };
};
