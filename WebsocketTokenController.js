//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//
// Hooks
//
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Init hook
 */
Hooks.once("init", () => {

    game.settings.register("websocket-token-controller", "enabled", {
        scope: "world",
        type: Boolean,
        default: true,
        config: false
    })

    game.settings.register("websocket-token-controller", "websocketHost", {
        name: "WebsocketTokenController.websocketHost",
        hint: "WebsocketTokenController.websocketHostHint",
        scope: "world",
        type: String,
        default: "node-red.home.viromania.com",
        config: true,
        onChange: () => {
            location.reload()
        }
    })

    game.settings.register("websocket-token-controller", "websocketPort", {
        name: "WebsocketTokenController.websocketPort",
        hint: "WebsocketTokenController.websocketPortHint",
        scope: "world",
        type: String,
        default: "443",
        config: true,
        onChange: () => {
            location.reload()
        }
    })

    game.settings.registerMenu("websocket-token-controller", "websocket-token-controller", {
        name: "WebsocketTokenController.config",
        label: "WebsocketTokenController.configTitle",
        hint: "WebsocketTokenController.configHint",
        icon: "fas fa-keyboard",
        type: TokenControllerConfig,
        restricted: false
    })

    console.log("WebsocketTokenController | Loaded settings")
})

/**
 * Ready hook
 */
Hooks.once("ready", () => {
    if (game.settings.get("websocket-token-controller", "enabled")) {
        console.log("WebsocketTokenController | Starting websocket connection")
        game.wstokenctrl = new TokenController()
    }
})

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
        Hooks.call("websocketTokenControllerInit", this)
        this._initializeWebsocket()
    }

    /**
     * Setup the websocket.
     *
     * @private
     */
    _initializeWebsocket() {
        const $this = this
        let wsInterval // Interval timer to detect disconnections
        let ip = game.settings.get("websocket-token-controller", "websocketHost")
        let port = game.settings.get("websocket-token-controller", "websocketPort")
        let socket = new WebSocket("wss://" + ip + ":" + port + "/ws/vtt")

        socket.onmessage = function (message) {
            console.log("WebsocketTokenController | Received message: ")
            const data = JSON.parse(message.data)
            console.dir(data)
            $this._handleMovement(data)
        }

        socket.onopen = function () {
            ui.notifications.info("Websocket Token Controller: " + game.i18n.localize("WebsocketTokenController.Notifications.Connected") + ip + ":" + port)
            // do stuff
        }

        socket.onerror = function (error) {
            ui.notifications.error("Websocket Token Controller: " + game.i18n.localize("WebsocketTokenController.Notifications.Error"))
            console.error("WebsocketTokenController | Error: ", error)
        }
    }

    _handleMovement(message) {
        if (!message.key) return
        if (message.state != 'down') return

        // Get controlled objects
        //TODO: find currently selected token for the keyboard that sent the command

        // Define movement offsets and get moved directions
        const directions = message.key.split('')
        let dx = 0
        let dy = 0

        // Assign movement offsets
        if (directions.includes('N')) dy -= 1
        if (directions.includes('E')) dx += 1
        if (directions.includes('S')) dy += 1
        if (directions.includes('W')) dx -= 1

        // Perform the shift or rotation
        canvas.tokens.moveMany({ dx, dy })
    }
}

/**
 * Form application to assign keyboards to players.
 */
class TokenControllerConfig extends FormApplication {

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: game.i18n.localize("WebsocketTokenController.configTitle"),
            id: "websocket-token-controller-config",
            template: "/home/ths/Projects/FoundryVTT-Websocket-Token-Controller/chrome-overrides/modules/websocket-token-controller/templates/keyboard-config.html",
            width: 500,
            height: "auto",
            closeOnSubmit: true,
            tabs: [{ navSelector: ".tabs", contentSelector: "form", initial: "general" }]
        })
    }

    // we can get users via "game.users.entities" (returns all users) or "game.users.players" (returns only non-GM users)

    // check if a token can be controlled by a player example:
    // var timo = game.users.entities[1]
    // var alex = game.users.entities[2]
    // var thilando = canvas.tokens.objects.children[0]
    // var vlad = canvas.tokens.objects.children[1]
    // thilando.can(timo, "control") = true
    // thilando.can(alex, "control") = false
    // vlad.can(alex, "control") = true
    // vlad.can(timo, "control") = false
    //
    // if timo is gm it will always return true
}