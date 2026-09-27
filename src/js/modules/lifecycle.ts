import { DepGraph } from "dependency-graph";

export interface LifecycleModule {
  ready(): void;
  unhook(): void;
}

export type ModuleClass = {
  new (instance: any): LifecycleModule;
  readonly name: string;
  readonly moduleDependencies: string[];
  shouldStart(instance: any): boolean;
};

export type ModuleDescriptor = ModuleClass | { default: ModuleClass };

export interface LifecycleHost {
  modules: Record<string, LifecycleModule>;
}

export interface ModulePlan<TDescriptor extends ModuleDescriptor = ModuleDescriptor> {
  descriptors: TDescriptor[];
  graph: DepGraph<string>;
  byName: Map<string, TDescriptor>;
}

export function moduleClass(descriptor: ModuleDescriptor): ModuleClass {
  return "default" in descriptor ? descriptor.default : descriptor;
}

export function createModulePlan<TDescriptor extends ModuleDescriptor>(
  descriptors: TDescriptor[],
  instance: unknown,
): ModulePlan<TDescriptor> {
  const byName = new Map<string, TDescriptor>(
    descriptors.map((descriptor) => [moduleClass(descriptor).name, descriptor]),
  );
  const requested = descriptors
    .filter((descriptor) => moduleClass(descriptor).shouldStart(instance))
    .map((descriptor) => moduleClass(descriptor).name);
  const selected = new Set<string>();

  function include(name: string, path: string[] = []) {
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

  const graph = new DepGraph<string>();
  selected.forEach((name) => graph.addNode(name));
  selected.forEach((name) => {
    for (const dependency of moduleClass(byName.get(name)!).moduleDependencies) {
      graph.addDependency(name, dependency);
    }
  });

  return {
    descriptors: graph.overallOrder().map((name) => byName.get(name)!),
    graph,
    byName,
  };
}

export function loadModules(instance: LifecycleHost, descriptors: ModuleDescriptor[]): LifecycleModule[] {
  return descriptors.map((descriptor) => {
    const Module = moduleClass(descriptor);
    const module = new Module(instance);
    instance.modules[Module.name] = module;
    return module;
  });
}

export function readyModules<T extends { ready(): void }>(
  modules: T[],
  onError: (module: T, error: unknown) => void = () => {},
): void {
  for (const module of modules) {
    try {
      module.ready();
    } catch (error) {
      onError(module, error);
    }
  }
}

export function reloadModules<TDescriptor extends ModuleDescriptor>(
  instance: LifecycleHost,
  plan: ModulePlan<TDescriptor>,
  moduleName: string,
  onReadyError: (module: LifecycleModule, error: unknown) => void = () => {},
): LifecycleModule[] {
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
    loadOrder.map((name) => plan.byName.get(name)!),
  );
  readyModules(instances, onReadyError);
  return instances;
}
