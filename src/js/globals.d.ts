interface MindflayerLibWrapper {
  readonly MIXED: "MIXED";
  readonly WRAPPER: "WRAPPER";
  register(owner: string, target: string, wrapper: Function, mode: "MIXED" | "WRAPPER"): void;
  unregister(owner: string, target: string, silent?: boolean): void;
}
declare var libWrapper: MindflayerLibWrapper;
declare var socketlib: Socketlib;
interface MindflayerHooks {
  on(event: string, callback: Function): unknown;
  once(event: string, callback: Function): unknown;
  off(event: string, callback: Function): void;
  call(event: string, ...args: unknown[]): void;
  events: Record<string, unknown[]>;
}
declare var Hooks: MindflayerHooks;
declare var foundry: any;
declare var ui: {
  notifications: {
    info(message: string): unknown;
    warn(message: string): unknown;
    error(message: string): unknown;
    clear(): void;
  };
};
interface MindflayerConstants {
  USER_ROLES: { PLAYER: number; TRUSTED: number };
  USER_PERMISSIONS: Record<string, unknown>;
  DOCUMENT_OWNERSHIP_LEVELS: { OWNER: number };
  KEYBINDING_PRECEDENCE: { NORMAL: number };
  WALL_DOOR_TYPES: { DOOR: number };
  WALL_DOOR_STATES: { CLOSED: number; OPEN: number };
}
declare var CONST: MindflayerConstants;
interface MindflayerJQueryCollection {
  hasClass(className: string): boolean;
  addClass(className: string): MindflayerJQueryCollection;
  removeClass(className: string): MindflayerJQueryCollection;
  click(): MindflayerJQueryCollection;
}
declare function jQuery(selector: Element | string): MindflayerJQueryCollection;
declare function mergeObject<T extends object, U extends object>(
  original: T,
  other?: U,
  options?: unknown,
): T & U;
declare class FormApplication {
  static get defaultOptions(): any;
  options: any;
  object: any;
  form: HTMLFormElement;
  constructor(...args: any[]);
  activateListeners(...args: any[]): void;
  _onSubmit(...args: any[]): Promise<unknown>;
  close(...args: any[]): Promise<unknown>;
  render(...args: any[]): this;
  setPosition(...args: any[]): any;
}
declare var canvas: Canvas & {
  tokens: TokenLayer;
  activeLayer: PlaceablesLayer | null;
  controls: ControlsLayer | null;
  walls: WallsLayer | null;
};
declare var PIXI: any;
declare var game: Game & {
  users: {
    contents: User[];
  };
};

interface Window {
  CONST: MindflayerConstants;
}

interface NodeRequire {
  context(directory: string, useSubdirectories?: boolean, regExp?: RegExp): unknown;
}
