declare var libWrapper: any;
declare var socketlib: Socketlib;
declare var Hooks: any;
declare var foundry: any;
declare var ui: any;
declare var CONST: any;
declare var jQuery: any;
declare function mergeObject(original: any, other?: any, options?: any): any;
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
  CONST: any;
}

interface NodeRequire {
  context(directory: string, useSubdirectories?: boolean, regExp?: RegExp): any;
}
