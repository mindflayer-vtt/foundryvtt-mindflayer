declare var libWrapper;
declare var socketlib: Socketlib;
declare var canvas: Canvas & {
  tokens: TokenLayer;
  activeLayer: PlaceablesLayer | null;
};
declare var PIXI = (await import("pixi.js")).default;
declare var game: Game & {
    users: {
        contents: User[]
    }
}