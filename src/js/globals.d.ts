declare var libWrapper;
declare var socketlib: Socketlib;
declare var canvas: Canvas & {
  tokens: TokenLayer;
  activeLayer: PlaceablesLayer | null;
  controls: ControlsLayer | null;
  walls: WallsLayer | null;
};
declare var PIXI = (await import("pixi.js")).default;
declare var game: Game & {
    users: {
        contents: User[]
    }
}