import { DepGraph } from "dependency-graph";

function moduleClass(descriptor) {
  return descriptor.default || descriptor;
}

export function createModulePlan(descriptors, instance) {
  const byName = new Map(
    descriptors.map((descriptor) => [moduleClass(descriptor).name, descriptor]),
  );
  const requested = descriptors
    .filter((descriptor) => moduleClass(descriptor).shouldStart(instance))
    .map((descriptor) => moduleClass(descriptor).name);
  const selected = new Set();

  function include(name, path = []) {
    if (path.includes(name)) {
      throw new Error(`Submodule dependency cycle: ${[...path, name].join(" -> ")}`);
    }
    if (selected.has(name)) return;
    const descriptor = byName.get(name);
    if (!descriptor) {
      throw new Error(`Missing submodule dependency '${name}'`);
    }
    const nextPath = [...path, name];
    for (const dependency of moduleClass(descriptor).moduleDependencies) {
      include(dependency, nextPath);
    }
    selected.add(name);
  }

  requested.forEach((name) => include(name));

  const graph = new DepGraph();
  selected.forEach((name) => graph.addNode(name));
  selected.forEach((name) => {
    for (const dependency of moduleClass(byName.get(name)).moduleDependencies) {
      graph.addDependency(name, dependency);
    }
  });

  return {
    descriptors: graph.overallOrder().map((name) => byName.get(name)),
    graph,
    byName,
  };
}

export function loadModules(instance, descriptors) {
  return descriptors.map((descriptor) => {
    const Module = moduleClass(descriptor);
    const module = new Module(instance);
    instance.modules[Module.name] = module;
    return module;
  });
}

export function readyModules(modules, onError = () => {}) {
  for (const module of modules) {
    try {
      module.ready();
    } catch (error) {
      onError(module, error);
    }
  }
}

export function reloadModules(instance, plan, moduleName, onReadyError = () => {}) {
  if (!plan.byName.has(moduleName)) {
    throw new Error(`Cannot reload unknown submodule '${moduleName}'`);
  }
  const names = new Set([moduleName, ...plan.graph.dependantsOf(moduleName)]);
  const loadOrder = plan.graph.overallOrder().filter((name) => names.has(name));

  for (const name of [...loadOrder].reverse()) {
    instance.modules[name].unhook();
    delete instance.modules[name];
  }
  const instances = loadModules(
    instance,
    loadOrder.map((name) => plan.byName.get(name)),
  );
  readyModules(instances, onReadyError);
  return instances;
}
