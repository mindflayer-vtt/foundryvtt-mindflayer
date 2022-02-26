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
import { settings } from "./settings";
import * as dependencies from "./dependencies";
import loader from "./modules/loader";
import AbstractSubModule from "./modules/AbstractSubModule";
import ControllerManager from "./modules/ControllerManager";
import { VTT_MODULE_NAME } from "./settings/constants";

const WRAP_Application__activateCoreListeners = "Application.prototype._activateCoreListeners";

export default class MindFlayer {
  #settings = null;
  #modules = [];

  constructor() {
    this.#settings = settings.init();
  }

  /**
   * @type {settings}
   */
  get settings() {
    return this.#settings;
  }

  /**
   * @type {AbstractSubModule[]}
   */
  get modules() {
    return this.#modules;
  }

  init() {
    if (this.#settings.enabled && dependencies.warnIfAnyMissing()) {
      this._vttBugFixes();
      loader(this);
    }
  }

  ready() {
    if (this.#settings.enabled && dependencies.warnIfAnyMissing(false)) {
      this.#modules.forEach(mod => mod.ready());
    }
  }

  _vttBugFixes() {
    libWrapper.register(
      VTT_MODULE_NAME,
      WRAP_Application__activateCoreListeners,
      function _activateCoreListeners(wrapped, html) {
        /** @type {Node} */
        let node = html[0];
        if(node.nodeType !== Node.ELEMENT_NODE) {
          node = node.nextElementSibling
        }
        return wrapped(jQuery(node));
      },
      libWrapper.MIXED
    );
  }
}
