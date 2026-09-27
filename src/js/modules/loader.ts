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
import type MindFlayer from "../MindFlayer";
import {
  createModulePlan,
  loadModules,
  readyModules,
  reloadModules,
  type LifecycleHost,
  type LifecycleModule,
  type ModuleClass,
  type ModulePlan,
} from "./lifecycle";

interface ContextRequire {
  (path: string): { default: ModuleClass };
  keys(): string[];
}

function importAll(contextRequire: ContextRequire): Array<{ default: ModuleClass }> {
  return contextRequire.keys().map((module: string) => contextRequire(module));
}
const subModules = importAll((require as unknown as NodeRequire).context("./", true, /\/index\.ts$/) as ContextRequire);

let modulePlan: ModulePlan<{ default: ModuleClass }> | null = null;

/**
 * Load all submodules in the order in which they are dependent on one another
 *
 * @param {import("../MindFlayer").default} instance
 */
export function init(instance: MindFlayer): void {
  console.debug(LOG_PREFIX + "Sorting submodules");

  console.debug(LOG_PREFIX + "Filtering unnecessary modules");
  modulePlan = createModulePlan(subModules, instance);

  console.info(LOG_PREFIX + "Starting submodules");

  loadModules(instance as unknown as LifecycleHost, modulePlan.descriptors);

  console.info(LOG_PREFIX + "Submodules initialized");
}

/**
 * Ready all submodules in the order in which they are dependent on one another
 *
 * @param {import("../MindFlayer").default} instance
 * @param {import("./AbstractSubModule").default[]|null} modules
 */
export function ready(instance: MindFlayer, modules: LifecycleModule[] | null = null): void {
  if (!modules) {
    // Foundry may not expose game.user until ready. Add modules whose
    // shouldStart policy becomes true once the current user's role is known.
    modulePlan = createModulePlan(subModules, instance);
    const host = instance as unknown as LifecycleHost;
    loadModules(
      host,
      modulePlan.descriptors.filter((mod) => !host.modules[mod.default.name]),
    );
    modules = modulePlan.descriptors
      .map((mod) => host.modules[mod.default.name])
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
function _reload(instance: MindFlayer, module: string): void {
  if (!modulePlan) throw new Error("Cannot reload submodules before initialization");
  reloadModules(instance as unknown as LifecycleHost, modulePlan, module, (mod, e) => {
    console.warn(
      `${LOG_PREFIX}Failed to ready module '${mod.constructor.name}', continuing...`,
      e,
    );
  });
}

export const reload = foundry.utils.debounce(_reload, 500);
