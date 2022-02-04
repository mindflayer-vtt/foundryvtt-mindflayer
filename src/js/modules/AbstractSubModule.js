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
import MindFlayer from "../MindFlayer";

export default class AbstractSubModule {
  #loaded = false;
  /**
   * @type {MindFlayer | null}
   */
  #instance = null;

  static get moduleDependencies() {
    return [];
  }

  constructor(instance) {
    this.#instance = instance;
    this.#loaded = true;
  }
  /**
   * @returns {MindFlayer}
   */
  get instance() {
    return this.#instance;
  }
  /**
   * @returns {boolean}
   */
  get loaded() {
    return this.#loaded;
  }
  unhook() {
    this.#loaded = false;
    this.#instance = null;
  }

  /**
   * @throws {ReferenceError} if the function is called while the module is unloaded
   */
  ensureLoaded() {
    if (!this.#loaded) {
      throw new ReferenceError(
        `the module ${this.name} needs to be loaded to use this functionality`
      );
    }
  }
}
