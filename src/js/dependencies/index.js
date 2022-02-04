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
import { VTT_MODULE_NAME } from "../settings/constants";
const moduleJson = require("../module.tmpl.json");

/**
 * Warn the GM user about any missing dependencies
 *
 * @returns true if all dependencies are available
 */
export function warnIfAnyMissing() {
  let result = true;
  for (let i in moduleJson.dependencies) {
    if (!moduleJson.dependencies.hasOwnProperty(i)) {
      continue;
    }
    const dependency = moduleJson.dependencies[i].name;
    if (!game.modules.get(dependency)?.active) {
      if (!game.user.isGM) {
        ui.notifications.error(
          `Module '${VTT_MODULE_NAME}' requires the '${dependency}' module. Please install and activate it.`
        );
      }
      result = false;
    }
  }
  return result;
}
