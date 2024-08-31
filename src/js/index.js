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
(function () {
  "use strict";
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Imports
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  const { default: MindFlayer } = require("./MindFlayer");
  const { setModuleInstance } = require("./utils/module");

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Globals
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /**
   * @type {MindFlayer}
   */
  let instance = null;

  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //
  // Hooks
  //
  //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

  /**
   * Init hook
   */
  Hooks.once("init", () => {
    instance = new MindFlayer();
    setModuleInstance(instance);

    instance.init();
  });

  /**
   * Ready hook
   */
  Hooks.once("ready", () => {
    instance.ready();
  });
})();
