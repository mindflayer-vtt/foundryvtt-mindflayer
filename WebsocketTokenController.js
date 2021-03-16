//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Constants
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let socket;

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

    /*game.settings.registerMenu("websocket-token-controller", "websocketHost", {
        name: "WSTKNCTRL.websocketHost",
        label: "WSTKNCTRL.websocketHostTitle",
        hint: "WSTKNCTRL.websocketHostHint",
        scope: "world",
        type: String,
        default: "192.168.0.8",
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
        default: "1880",
        config: true,
        onChange: () => {
            location.reload();
        }
    });*/
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

/*
Keyboard layout:

 NW | N  | NE
-------------
 W  | R  | E
-------------
 SW | S  | SE
*/

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
        const $this = this;
        let wsInterval; // Interval timer to detect disconnections
        let ip = "node-red.home.viromania.com"; // game.settings.get("websocket-token-controller", "websocketHost");
        let port = "443"; //game.settings.get("websocket-token-controller", "websocketPort");
        socket = new WebSocket("wss://" + ip + ":" + port + "/ws/vtt");

        socket.onmessage = function (message) {
            console.log("Token Controller: received message");
            const data = JSON.parse(message.data)
            console.dir(data);
            $this._handleMovement(data);
        }

        socket.onopen = function () {
            ui.notifications.info("Token Controller: " + game.i18n.localize("WebsocketTokenController.Notifications.Connected") + ip + ":" + port);
            // do stuff
        }
    }

    _handleMovement(message) {
        if ( !message.key ) return;
        if ( message.state != 'down') return;
    
        // Get controlled objects
        //TODO: find currently selected token for the keyboard that sent the command
    
        // Define movement offsets and get moved directions
        const directions = message.key.split('');
        let dx = 0;
        let dy = 0;
    
        // Assign movement offsets
        if ( directions.includes('W') ) dx -= 1;
        if ( directions.includes('S') ) dy += 1;
        if ( directions.includes('E') ) dx += 1;
        if ( directions.includes('N') ) dy -= 1;
    
        // Perform the shift or rotation
        canvas.tokens.moveMany({dx, dy});
      }
}