//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Constants
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const socket;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Hooks
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Init hook
 */
Hooks.once("init", () => {
    // write init code (e.g. register settings for module menu)
    console.log("Loading WebsocketTokenController Module.");

    game.settings.registerMenu("websocket-token-controller", "websocketHost", {
        name: "WSTKNCTRL.websocketHost",
        label: "WSTKNCTRL.websocketHostTitle",
        hint: "WSTKNCTRL.websocketHostHint",
        scope: "world",
        type: String,
        default: "127.0.0.1",
        config: true,
        onChange: () => {
            location.reload();
        }
    });

    game.settings.registerMenu("websocket-token-controller", "websocketPort", {
        name: "WSTKNCTRL.websocketPort",
        label: "WSTKNCTRL.websocketPortTitle",
        hint: "WSTKNCTRL.websocketPortHint",
        scope: "world",
        type: String,
        default: "42069",
        config: true,
        onChange: () => {
            location.reload();
        }
    });
});

/**
 * Ready hook
 */
Hooks.once("ready", () => {
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
        let wsInterval; // Interval timer to detect disconnections
        let ip = game.settings.get("websocket-token-controller", "websocketHost");
        let port = game.settings.get("websocket-token-controller", "websocketPort");
        socket = new WebSocket("ws://" + ip + ":" + port + "/vtt");

        ws.onopen = function () {
            ui.notifications.info("Token Controller: " + game.i18n.localize("WebsocketTokenController.Notifications.Connected") + ip + ":" + port);
            // do stuff
        }
    }
}