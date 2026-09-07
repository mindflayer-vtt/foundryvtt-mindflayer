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
import { LOG_PREFIX } from "../settings/constants";
import {
  createModulePlan,
  loadModules,
  readyModules,
  reloadModules,
} from "./lifecycle";

function importAll(contextRequire) {
  return contextRequire.keys().map((module) => contextRequire(module));
}
/** @type {({default: AbstractSubModule})[]} */
let subModules = importAll(require.context("./", true, /\/index\.js$/));

/**
 * @type {ReturnType<typeof createModulePlan> | null}
 */
let modulePlan = null;

/**
 * Load all submodules in the order in which they are dependent on one another
 *
 * @param {import("../MindFlayer").default} instance
 */
export function init(instance) {
  console.debug(LOG_PREFIX + "Sorting submodules");

  console.debug(LOG_PREFIX + "Filtering unnecessary modules");
  modulePlan = createModulePlan(subModules, instance);
  subModules = modulePlan.descriptors;

  console.info(LOG_PREFIX + "Starting submodules");

  loadModules(instance, subModules);

  console.info(LOG_PREFIX + "Submodules initialized");
}

/**
 * Ready all submodules in the order in which they are dependent on one another
 *
 * @param {import("../MindFlayer").default} instance
 * @param {import("./AbstractSubModule").default[]|null} modules
 */
export function ready(instance, modules = null) {
  if (!modules) {
    modules = subModules
      .map((mod) => instance.modules[mod.default.name])
      .filter((mod) => mod !== undefined && mod !== null);
  }
  for (const mod of modules) {
    console.debug(`${LOG_PREFIX}Readying Module: ${mod.constructor.name}`);
  }
  readyModules(modules, (mod, e) => {
    console.warn(
      `${LOG_PREFIX}Failed to ready module '${mod.constructor.name}', continuing...`,
      e,
    );
  });
}

/**
 * Restarts the given Module and all its dependants
 *
 * @param {MindFlayer} instance
 * @param {string} module
 */
function _reload(instance, module) {
  reloadModules(instance, modulePlan, module, (mod, e) => {
    console.warn(
      `${LOG_PREFIX}Failed to ready module '${mod.constructor.name}', continuing...`,
      e,
    );
  });
}

export const reload = foundry.utils.debounce(_reload, 500);
