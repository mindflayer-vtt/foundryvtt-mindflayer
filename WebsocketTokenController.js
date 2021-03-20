(function () {
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Constants
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const VTT_MODULE_NAME = 'websocket-token-controller'
    const LOG_PREFIX = 'WebsocketTokenController | '

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Hooks
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Init hook
     */
    Hooks.once('init', () => {

        game.settings.register(VTT_MODULE_NAME, 'enabled', {
            name: 'WebsocketTokenController.moduleEnabled',
            hint: 'WebsocketTokenController.moduleEnabledHint',
            scope: 'client',
            type: Boolean,
            default: false,
            config: true,
            restricted: false,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(VTT_MODULE_NAME, 'websocketHost', {
            name: 'WebsocketTokenController.websocketHost',
            hint: 'WebsocketTokenController.websocketHostHint',
            scope: 'world',
            type: String,
            default: 'node-red.home.viromania.com',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(VTT_MODULE_NAME, 'websocketPort', {
            name: 'WebsocketTokenController.websocketPort',
            hint: 'WebsocketTokenController.websocketPortHint',
            scope: 'world',
            type: String,
            default: '443',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.registerMenu(VTT_MODULE_NAME, VTT_MODULE_NAME, {
            name: 'WebsocketTokenController.config',
            label: 'WebsocketTokenController.configTitle',
            hint: 'WebsocketTokenController.configHint',
            icon: 'fas fa-keyboard',
            type: TokenControllerConfig
        })

        game.settings.register(VTT_MODULE_NAME, 'settings', {
            name: 'WebsocketTokenController.settings',
            scope: 'world',
            type: Object,
            config: false,
            default: {
                'mappings': {}
            }
        });

        console.log(LOG_PREFIX + 'Loaded settings')
    })

    /**
     * Ready hook
     */
    Hooks.once('ready', () => {
        if (game.settings.get(VTT_MODULE_NAME, 'enabled')) {
            console.log(LOG_PREFIX + 'Starting websocket connection')
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
    class TokenController {

        /**
         * Constructor. Initialize LOCALIZATION_NAMESPACE.
         */
        constructor() {
            Hooks.call('WebsocketTokenControllerInit', this)

            this.setDefaultTokens()
            
            this._initializeWebsocket()
        }

        setDefaultTokens() {
            const $this = this
            game.users.entities.forEach(user => {
                let selectedToken = null
                if (user.character) {
                    selectedToken = $this._findAllTokensFor(user, true).find(token => token.actor.id == user.character.id)
                    if(selectedToken) {
                        selectedToken = selectedToken.id
                    }
                }
                game.user.setFlag(VTT_MODULE_NAME, 'selectedToken_' + user.id, selectedToken)
            })
        }

        /**
         * Setup the websocket.
         *
         * @private
         */
        _initializeWebsocket() {
            const $this = this
            let wsInterval // Interval timer to detect disconnections
            let ip = game.settings.get(VTT_MODULE_NAME, 'websocketHost')
            let port = game.settings.get(VTT_MODULE_NAME, 'websocketPort')
            let socket = new WebSocket('wss://' + ip + ':' + port + '/ws/vtt')

            socket.onmessage = function (message) {
                console.log(LOG_PREFIX + 'Received message: ')
                const data = JSON.parse(message.data)
                console.dir(data)
                try {
                    $this._handleTokenSelect(data)
                    $this._handleMovement(data)
                } catch (error) {
                    console.error(LOG_PREFIX + 'KeyParseError: ', error)
                }
            }

            socket.onopen = function () {
                ui.notifications.info('Websocket Token Controller: ' + game.i18n.localize('WebsocketTokenController.Notifications.Connected') + ip + ':' + port)
                // do stuff
            }

            socket.onerror = function (error) {
                ui.notifications.error('Websocket Token Controller: ' + game.i18n.localize('WebsocketTokenController.Notifications.Error'))
                console.error(LOG_PREFIX + 'Error: ', error)
            }
        }

        _handleTokenSelect(message) {
            if (message.key != 'TAB') return
            if (message.state != 'down') return

            const player = this._getPlayerFor(message['controller-id'])
            const tokens = this._findAllTokensFor(player)

            if (!game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id)) {
                let selectedToken = tokens[0].id
                if(player.character) {
                    selectedToken = tokens.find(token => token.actor.id == player.character.id)
                }
                game.user.setFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id, selectedToken);
            } else {
                let i = 0
                for (; i < tokens.length; i++) {
                    if (game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id) == tokens[i].id) {
                        break
                    }
                }
                i = (i + 1) % tokens.length
                game.user.setFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id, tokens[i].id);
                console.debug(LOG_PREFIX + 'Selected token ' + tokens[i].name + ' for player ' + player.name)
            }
        }

        _handleMovement(message) {
            if (!message.key) return
            if (message.state != 'down') return

            // Get controlled objects
            const player = this._getPlayerFor(message['controller-id'])
            let token = this._getTokenFor(player)
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

        _getPlayerFor(controllerId) {
            const settings = game.settings.get(VTT_MODULE_NAME, 'settings')
            const playerId = Object.keys(settings.mappings).find(key => settings.mappings[key] === controllerId)
            const selectedPlayer = game.users.entities.find(player => player.id == playerId)
            if (!selectedPlayer) {
                throw new Error('Could not find any player with id ' + playerId)
            }
            return selectedPlayer
        }

        _getTokenFor(player) {
            const selectedToken = game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id)
            return canvas.tokens.placeables.find(token => token.id == selectedToken)
        }

        _findAllTokensFor(player, ignoreEmpty) {
            const tokens = canvas.tokens.placeables.filter(token => token.actor.data.permission[player.id] >= 3).sort((a, b) => a.id.localeCompare(b.id))
            if (!ignoreEmpty && !tokens.length) {
                throw new Error('Could not find any tokens for player ' + player.name)
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
                title: game.i18n.localize('WebsocketTokenController.configTitle'),
                id: 'websocket-token-controller-config',
                template: 'modules/websocket-token-controller/templates/keyboard-config.html',
                width: 500,
                height: 'auto',
                closeOnSubmit: true,
                tabs: [{ navSelector: '.tabs', contentSelector: 'form', initial: 'general' }]
            })
        }

        getData(options) {
            const existingSettings = game.settings.get(VTT_MODULE_NAME, 'settings')
            let data = mergeObject({
                playerList: game.users.entities.reduce((acc, user) => {
                    acc[user.id] = user.name
                    return acc
                }, {})
            }, existingSettings)
            return data
        }

        async _updateObject(event, formData) {
            formData = this._parseInputs(formData)

            const existingSettings = game.settings.get(VTT_MODULE_NAME, 'settings')
            let settings = mergeObject(existingSettings, formData)

            await game.settings.set(VTT_MODULE_NAME, 'settings', settings)

            game.socket.emit('module.websocket-token-controller', { type: 'update', user: game.user.id })
            ui.notifications.info(game.i18n.localize('WebsocketTokenController.saveMessage'))

            game.wstokenctrl.setDefaultTokens()
        }

        _parseInputs(data) {
            var ret = {};
            retloop:
            for (var input in data) {
                var val = data[input];

                var parts = input.split('[');
                var last = ret;

                for (var i in parts) {
                    var part = parts[i];
                    if (part.substr(-1) == ']') {
                        part = part.substr(0, part.length - 1);
                    }

                    if (i == parts.length - 1) {
                        last[part] = val;
                        continue retloop;
                    } else if (!last.hasOwnProperty(part)) {
                        last[part] = {};
                    }
                    last = last[part];
                }
            }
            return ret;
        }

    }
})()