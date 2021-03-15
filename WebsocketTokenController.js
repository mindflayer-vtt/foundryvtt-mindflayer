//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Hooks
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Init hook
 */
Hooks.once('init', () => {
    // write init code (e.g. register settings for module menu)
    console.log("Loading WebsocketTokenController Module.");
});

/**
 * Ready hook
 */
Hooks.once('ready', () => {
    console.log("Initializing WebsocketTokenController Module.");
    game.wstokenctrl = new TokenController();
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Classes
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Main class
 */
export class TokenController {

    /**
     * Constructor. Initialize websocketTokenController.
     */
    constructor() {
        Hooks.call("websocketTokenControllerInit", this);
        this._initializeWebsocket();
    }

    /**
     * Setup the websocket.
     *
     * @private
     */
    _initializeWebsocket() {
        // do websocket stuff
    }
}