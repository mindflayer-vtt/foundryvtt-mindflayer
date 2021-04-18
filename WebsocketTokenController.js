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
            scope: 'client',
            type: String,
            default: 'localhost',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(VTT_MODULE_NAME, 'websocketPort', {
            name: 'WebsocketTokenController.websocketPort',
            hint: 'WebsocketTokenController.websocketPortHint',
            scope: 'client',
            type: String,
            default: '443',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(VTT_MODULE_NAME, 'websocketPath', {
            name: 'WebsocketTokenController.websocketPath',
            hint: 'WebsocketTokenController.websocketPathHint',
            scope: 'client',
            type: String,
            default: '/ws/vtt',
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
            name: 'WebsocketTokenController.config',
            scope: 'world',
            type: Object,
            config: false,
            default: {
                'mappings': {}
            }
        })

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

    /**
     * Main class
     */
    class TokenController {

        /**
         * Constructor. Initialize WebsocketTokenController.
         */
        constructor() {
            Hooks.call('WebsocketTokenControllerInit', this)
            this.setDefaultTokens()
            this._initializeWebsocket()
        }

        /**
         * Sets the users default characters as preselected tokens.
         */
        setDefaultTokens() {
            const $this = this
            game.users.entities.forEach(user => {
                let selectedToken = null
                if (user.character) {
                    selectedToken = $this._findAllTokensFor(user, true).find(token => token.actor.id == user.character.id)
                    if (selectedToken) {
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
            let host = game.settings.get(VTT_MODULE_NAME, 'websocketHost')
            let port = game.settings.get(VTT_MODULE_NAME, 'websocketPort')
            let path = game.settings.get(VTT_MODULE_NAME, 'websocketPath')
            let socket = new WebSocket('wss://' + host + ':' + port + path)

            socket.onmessage = function (message) {
                const data = JSON.parse(message.data)
                console.debug(LOG_PREFIX + 'Received message: ', data)
                try {
                    $this._handleStatus(data)
                    $this._handleTokenSelect(data)
                    $this._handleMovement(data)
                    $this._handleTorch(data)
                } catch (error) {
                    console.error(LOG_PREFIX + 'Error: ', error)
                }
            }

            socket.onopen = function (data) {
                ui.notifications.info('Websocket Token Controller: ' + game.i18n.format('WebsocketTokenController.Notifications.Connected', { host: host, port: port, path: path }))
                console.log(LOG_PREFIX + 'Connected to websocket: ', data)
                socket.send(JSON.stringify({receiver: true}));
            }

            socket.onclose = function (e) {
                ui.notifications.error('Websocket Token Controller: ' + game.i18n.localize('WebsocketTokenController.Notifications.ConnectionClosed'))
                console.warn(LOG_PREFIX + 'Websocket connection closed, attempting to reconnect in 5 seconds...', data)
                setTimeout(function () {
                    $this._initializeWebsocket()
                }, 5000)
            }

            socket.onerror = function (error) {
                ui.notifications.error('Websocket Token Controller: ' + game.i18n.localize('WebsocketTokenController.Notifications.Error'))
                console.error(LOG_PREFIX + 'Error: ', error)
                socket.close()
            }
        }

        /**
         * Handles status messages from other clients.
         * 
         * @param {*} message the data object from the websocket message
         * @private
         */
        _handleStatus(message) {
            if (message.status == undefined) return

            if (message.status == 'connected') {
                const controllerId = message['controller-id']
                const player = this._getPlayerFor(controllerId)
                ui.notifications.info('Websocket Token Controller: ' + game.i18n.format('WebsocketTokenController.Notifications.NewClient', { controller: controllerId, player: player.name }))
            }
        }

        /**
         * Handles token selection by cycling through the available tokens for the player assigned to the controller.
         * 
         * @param {*} message a data object from the websocket message containing the TAB kay and state down
         * @private 
         */
        _handleTokenSelect(message) {
            if (message.key != 'TAB') return
            if (message.state != 'down') return

            const player = this._getPlayerFor(message['controller-id'])
            const tokens = this._findAllTokensFor(player)

            if (!game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id)) {
                let selectedToken = tokens[0].id
                if (player.character) {
                    selectedToken = tokens.find(token => token.actor.id == player.character.id)
                }
                game.user.setFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id, selectedToken)
                console.debug(LOG_PREFIX + 'Selected token ' + selectedToken.name + ' for player ' + player.name)
            } else {
                let i = 0
                for (; i < tokens.length; i++) {
                    if (game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id) == tokens[i].id) {
                        break
                    }
                }
                i = (i + 1) % tokens.length
                game.user.setFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id, tokens[i].id)
                console.debug(LOG_PREFIX + 'Selected token ' + tokens[i].name + ' for player ' + player.name)
            }
        }

        /**
         * Handles token movement and rotation.
         * 
         * @param {*} message a data object from the websocket message containing a direction key and state down
         * @private 
         */
        _handleMovement(message) {
            if (!message.key) return
            if (!message.key.match(/^[NESW]+$/g)) return
            if (message.state != 'down') return

            // Get controlled objects
            const player = this._getPlayerFor(message['controller-id'])
            let token = this._getTokenFor(player)

            // Logging movement action
            console.debug(LOG_PREFIX + player.name + ': ' + (message.modifier ? 'Rotating ' : 'Moving ') + token.name + ' to direction ' + message.key)

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
            canvas.tokens.moveMany({ dx, dy, rotate: message.modifier, ids: [token.id] })
        }

        /**
         * Handles torch enabling or disabling depending on whether the token already emits light or not.
         * 
         * @param {*} message a data object from the websocket message containing the T key and state down
         * @private
         */
        _handleTorch(message) {
            if (!message.key) return
            if (!message.key.match(/^[T]+$/g)) return
            if (message.state != 'down') return

            let player = this._getPlayerFor(message['controller-id'])
            let token = this._getTokenFor(player)

            if (!token.emitsLight) {
                console.debug(LOG_PREFIX + player.name + ': Turn on torch for ' + token.name)
                token.update({ brightLight: 20, dimLight: 40, lightAlpha: 0.12, lightColor: '#ffad58', lightAnimation: { type: 'torch', speed: 5, intensity: 5 } })
            } else {
                console.debug(LOG_PREFIX + player.name + ': Turn off torch for ' + token.name)
                token.update({ brightLight: 0, dimLight: 0 })
            }
        }

        /**
         * Returns an assigned player for the given controller id.
         * 
         * @param {*} controllerId an id matching a controller that is assigned to a player
         * @returns the assigned player
         * @throws an Error object if no assigned player could be found
         * @private
         */
        _getPlayerFor(controllerId) {
            const settings = game.settings.get(VTT_MODULE_NAME, 'settings')
            const playerId = Object.keys(settings.mappings).find(key => settings.mappings[key] == controllerId)
            const selectedPlayer = game.users.entities.find(player => player.id == playerId)
            if (!selectedPlayer) {
                throw new Error('Could not find any player with id ' + playerId)
            }
            return selectedPlayer
        }

        /**
         * Returns the currently selected token of the given player.
         * 
         * @param {*} player the player to search through
         * @throws an Error object if no selected token could be found
         * @private
         */
        _getTokenFor(player) {
            const selectedToken = game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id)
            const token = canvas.tokens.placeables.find(token => token.id == selectedToken)
            if (!token) {
                throw new Error('Could not find token ' + selectedToken + ' for player ' + player.name)
            }
            return token
        }

        /**
         * Returns all controllable tokens of a player.
         * 
         * @param {*} player the player to search through
         * @param {*} ignoreEmpty if no exception should be thrown (necessary for initialization)
         * @returns all controllable tokens of a player
         * @throws an Error object if no tokens could be found and ignoreEmpty is false
         * @private
         */
        _findAllTokensFor(player, ignoreEmpty) {
            const tokens = canvas.tokens.placeables.filter(token => token.actor.data.permission[player.id] >= 3).sort((a, b) => a.id.localeCompare(b.id))
            if (!ignoreEmpty && !tokens.length) {
                throw new Error('Could not find any tokens for player ' + player.name)
            }
            return tokens
        }
    }

    /**
     * Form application to assign controllers to players.
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
            }, this.reset ? { 'mappings': {} } : existingSettings)
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

        activateListeners(html) {
            super.activateListeners(html)
            html.find('button[name="reset"]').click(this._onReset.bind(this))
            this.reset = false
        }

        _onReset() {
            this.reset = true
            this.render()
        }

        _parseInputs(data) {
            var ret = {}
            retloop:
            for (var input in data) {
                var val = data[input]

                var parts = input.split('[')
                var last = ret

                for (var i in parts) {
                    var part = parts[i]
                    if (part.substr(-1) == ']') {
                        part = part.substr(0, part.length - 1)
                    }

                    if (i == parts.length - 1) {
                        last[part] = val
                        continue retloop
                    } else if (!last.hasOwnProperty(part)) {
                        last[part] = {}
                    }
                    last = last[part]
                }
            }
            return ret
        }

    }
})()