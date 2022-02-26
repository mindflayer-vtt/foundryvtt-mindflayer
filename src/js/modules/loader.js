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
import { DepGraph } from "dependency-graph";
import MindFlayer from "../MindFlayer";

function importAll(contextRequire) {
  return contextRequire.keys().map((module) => contextRequire(module));
}
const subModules = importAll(require.context("./", true, /\/index\.js$/));

/**
 * @var {DepGraph} dependencyGraph
 */
let dependencyGraph = null;

/**
 * Load all submodules in the order in which they are dependent on one another
 *
 * @param {MindFlayer} instance
 */
export default function init(instance) {
  console.debug(LOG_PREFIX + "Sorting submodules");
  subModules.sort((a, b) => {
    const bDeps = b.default.moduleDependencies;
    if (bDeps.includes(a.default.name)) {
      return -1;
    }
    const aDeps = a.default.moduleDependencies;
    if (aDeps.includes(b.default.name)) {
      return 1;
    }
    return aDeps.length - bDeps.length;
  });
  console.info(LOG_PREFIX + "Starting submodules");

  __loadModules(instance, subModules);

  console.info(LOG_PREFIX + "Submodules ready");
}

function buildDependencyGraph() {
  if (dependencyGraph !== null) {
    return;
  }
  dependencyGraph = new DepGraph();
  subModules.forEach((mod) => {
    dependencyGraph.addNode(mod.default.name);
  });
  subModules.forEach((mod) => {
    mod.default.moduleDependencies.forEach((dependency) => {
      dependencyGraph.addDependency(mod.default.name, dependency);
    });
  });
}

function __loadModules(instance, modules) {
  modules.forEach((element) => {
    console.debug(`${LOG_PREFIX}Starting Module: ${element.default.name}`);
    instance.modules[element.default.name] = new element.default(instance);
  });
}

function __unloadModules(instance, modules) {
  for (let i = modules.length - 1; i >= 0; i--) {
    const mod = modules[i];
    instance.modules[mod].unhook();
    delete instance.modules[mod];
  }
}

/**
 * Restarts the given Module and all its dependants
 *
 * @param {MindFlayer} instance
 * @param {string} module
 */
function _reload(instance, module) {
  buildDependencyGraph();
  const moduleNamesToReload = [
    module,
    ...dependencyGraph.dependantsOf(module, false),
  ];
  const loadOrderNames = dependencyGraph
    .overallOrder(false)
    .filter(moduleNamesToReload.includes);

  __unloadModules(instance, loadOrderNames);

  const modules = loadOrderNames.map((name) =>
    subModules.find((mod) => mod.default.name === name)
  );
  __loadModules(instance, modules);

  modules.forEach(mod => {
    instance.modules[mod.default.name].ready();
  });
}

export const reload = foundry.utils.debounce(_reload, 500);
