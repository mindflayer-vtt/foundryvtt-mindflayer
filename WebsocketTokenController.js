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

    LOG_PREFIX

    /**
     * Constructor. Initialize websocketTokenController.
     */
    constructor() {
        this.LOG_PREFIX = 'WebsocketTokenController | '
        Hooks.call("websocketTokenControllerInit", this)
        game.users.entities.forEach(user => {
            user.data.flags['websocket-token-controller'] = {
                currentTokenId: user.character? user.character.id : null
            }
        })
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
            console.log(this.LOG_PREFIX + "Received message: ")
            const data = JSON.parse(message.data)
            console.dir(data)
            try {
                $this._handleTokenSelect(data)
                $this._handleMovement(data)
            } catch (error) {
                console.error(this.LOG_PREFIX + 'KeyParseError: ', error)
            }
        }

        socket.onopen = function () {
            ui.notifications.info("Websocket Token Controller: " + game.i18n.localize("WebsocketTokenController.Notifications.Connected") + ip + ":" + port)
            // do stuff
        }

        socket.onerror = function (error) {
            ui.notifications.error("Websocket Token Controller: " + game.i18n.localize("WebsocketTokenController.Notifications.Error"))
            console.error(this.LOG_PREFIX + "Error: ", error)
        }
    }

    _handleTokenSelect(message) {
        if (message.key != 'TAB') return
        if (message.state != 'down') return

        const player = this._getCurrentPlayer(message['controller-id'])
        const tokens = this._findAllTokensFor(player)
        if (!player.data.flags['websocket-token-controller'].currentTokenId) {
            player.data.flags['websocket-token-controller'].currentTokenId = tokens[0].id
        } else {
            let i = 0
            for (; i < tokens.length; i++) {
                if (player.data.flags['websocket-token-controller'].currentTokenId == tokens[i].id) {
                    break
                }
            }
            i = (i + 1) % tokens.length
            player.data.flags['websocket-token-controller'].currentTokenId = tokens[i].id
            console.debug(this.LOG_PREFIX + 'Selected token ' + tokens[i].name + ' for player ' + player.name)
        }
    }

    _handleMovement(message) {
        if (!message.key) return
        if (message.state != 'down') return

        // Get controlled objects
        const player = this._getCurrentPlayer(message['controller-id'])
        let token = this._getCurrentToken(player)
        if (!token) {
            return
        }
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
        canvas.tokens.moveMany({ dx, dy, ids: [token.id] })
    }

    _getCurrentPlayer(controllerId) {
        //TODO: add mapping
        return game.users.players.find(player => player.name == 'Beamer')
    }

    _getCurrentToken(currentPlayer) {
        return canvas.tokens.placeables.find(token => token.id == currentPlayer.data.flags['websocket-token-controller'].currentTokenId)
    }

    _findAllTokensFor(player) {
        const tokens = canvas.tokens.placeables.filter(token => token.actor.data.permission[player.id] >= 3).sort((a, b) => a.id.localeCompare(b.id))
        if (!tokens.length) {
            throw new Error('no tokens for player: "' + player.name + '"')
        }
        return tokens
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
            template: "modules/websocket-token-controller/templates/keyboard-config.html",
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

    // to check who owns the token
    // token.actor.data.permission
}