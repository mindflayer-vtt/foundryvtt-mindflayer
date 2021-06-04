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

    class Key {

        state
        id

        constructor(id, state) {
            this.id = id
            this.state = state
        }
    }

    class Keypad {

        controllerId
        tokenController
        callbacks // TODO: Refactor this stuff, I think there is a better way than having to pass tokenController and callbacks

        keys = [
            new Key('Q', 'up'), new Key('W', 'up'), new Key('E', 'up'),
            new Key('A', 'up'), new Key('S', 'up'), new Key('D', 'up'),
            new Key('Z', 'up'), new Key('X', 'up'), new Key('C', 'up'),
            new Key('SHI', 'up'), new Key('SPA', 'up')
        ]

        directionKeyMap = {
            'W': 'N',
            'A': 'W',
            'S': 'S',
            'D': 'E'
        }

        constructor(data, tokenController, ...callbacks) {
            this.tokenController = tokenController
            this.controllerId = data['controller-id']
            console.debug(LOG_PREFIX + 'Initialized keypad for controller ' + this.controllerId)
            this.callbacks = callbacks
            callbacks.forEach(callback => console.debug(LOG_PREFIX + 'Registered callback ' + callback.name))
        }

        _registerKeyEvent(data) {
            let key = this.keys.find(key => key.id === data.key)
            key.state = data.state
            if (data.state === 'down') this._handleKeyPress()
        }

        _handleKeyPress() {
            if (this.keys.filter(key => key.state === 'down' && key.id.match(/^[WASD]+$/g)).length <= 1) {
                let _handleMovement = this.callbacks.find(callback => callback.name === '_handleMovement')
                if (_handleMovement) {
                    console.debug(LOG_PREFIX + 'Handling movement key event...')
                    setTimeout(_handleMovement, 50, this, this.tokenController)
                }
            }
        }

    }

    /**
     * Main class
     */
    class TokenController {

        isConnected = false

        /**
         * Constructor. Initialize WebsocketTokenController.
         */
        constructor() {
            Hooks.call('WebsocketTokenControllerInit', this)
            this.setDefaultTokens()
            this._initializeWebsocket()
            this._overrideGetBorderColorOnTokens()
            this._overrideHandleKeysOnKeyboardToHideUI()
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
            let seenKeypads = new Array()

            socket.onmessage = function (message) {
                const data = JSON.parse(message.data)
                console.debug(LOG_PREFIX + 'Received message: ', data)
                try {
                    $this._handleStatus(socket, data)
                    if (data.type === "key-event") {
                        let keypad = seenKeypads.find(keypad => keypad.controllerId === data['controller-id'])
                        if (keypad) {
                            keypad._registerKeyEvent(data)
                        } else {
                            keypad = new Keypad(data, $this, $this._handleMovement, $this._handleTokenSelect, $this._handleTorch)
                            keypad._registerKeyEvent(data)
                            seenKeypads.push(keypad)
                        }
                    }
                } catch (error) {
                    console.error(LOG_PREFIX + 'Error: ', error)
                }
            }

            socket.onopen = function (data) {
                ui.notifications.info('Websocket Token Controller: ' + game.i18n.format('WebsocketTokenController.Notifications.Connected', { host: host, port: port, path: path }))
                console.log(LOG_PREFIX + 'Connected to websocket: ', data)
                $this.isConnected = true
                socket.send(JSON.stringify({
                    type: 'registration',
                    status: 'connected',
                    receiver: true
                }));
            }

            socket.onclose = function (e) {
                ui.notifications.error('Websocket Token Controller: ' + game.i18n.localize('WebsocketTokenController.Notifications.ConnectionClosed'))
                console.warn(LOG_PREFIX + 'Websocket connection closed, attempting to reconnect in 5 seconds...')
                $this.isConnected = false
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

        _overrideGetBorderColorOnTokens() {
            console.debug(LOG_PREFIX + "overriding Token Border Color to add display user select.")
            let $this = this
            let originalFunction = Token.prototype._getBorderColor
            Token.prototype._getBorderColor = function WTC_getBorderColor() {
                if($this.isConnected && this.actor && this.actor.hasPlayerOwner) {
                    const userInfo = $this._getUserForSelectedToken(this)
                    if(userInfo.selected) {
                        const color = $this._hexToRgb(userInfo.player.data.color);
                        return (color.r & 0xff) << 16 | (color.g & 0xff) << 8 | (color.b & 0xff)
                    }
                }
                return originalFunction.apply(this)
            }
            $this._refreshTokenPlaceables()
        }

        _overrideHandleKeysOnKeyboardToHideUI() {
            console.debug(LOG_PREFIX + "overriding Key handling to add F10 to hide UI.")
            let originalFunction = KeyboardManager.prototype._handleKeys
            KeyboardManager.prototype._handleKeys = function WTC_handleKeys(event, key, state) {
                originalFunction.call(this, event, key, state)
                if(key == "F10" && state == false) {
                    event.preventDefault()
                    jQuery(document.body).toggleClass('hide-ui')
                }
            }
        }

        _getUserForSelectedToken(token) {
            let result = {selected: false}
            game.users.entities.forEach(player => {
                if (game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id) == token.id) {
                    result = {player, selected: true};
                }
            })
            return result
        }

        _refreshTokenPlaceables = debounce(this._WTC_refreshTokens.bind(this), 100)
        
        _WTC_refreshTokens() {
            console.debug(LOG_PREFIX + "refreshing tokens")
            canvas.tokens.placeables.forEach(t => t.refresh({}))
            canvas.triggerPendingOperations()
        }

        /**
         * Convert a hex color string to json color object
         * @param {string} hex the color as hex string in the format '#ffffff'
         * @returns a javascript object representing the color
         */
        _hexToRgb(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result !== null ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        /**
         * Handles status messages from other clients.
         * 
         * @param {WebSocket} socket the websocket to which to send response
         * @param {*} message the data object from the websocket message
         * @private
         */
        _handleStatus(socket, message) {
            if (message.type != "registration" || message.status == undefined) return

            if (message.status == 'connected') {
                const controllerId = message['controller-id']
                const player = this._getPlayerFor(controllerId)
                ui.notifications.info('Websocket Token Controller: ' + game.i18n.format('WebsocketTokenController.Notifications.NewClient', { controller: controllerId, player: player.name }))
                socket.send(JSON.stringify({
                    type: 'configuration',
                    "controller-id": controllerId,
                    led1: this._hexToRgb(player.data.color),
                    led2: this._hexToRgb(player.data.color)
                }))
            }
        }

        /**
         * Handles token selection by cycling through the available tokens for the player assigned to the controller.
         * 
         * @param {*} message a data object from the websocket message containing the TAB kay and state down
         * @private 
         */
        _handleTokenSelect(message) {
            return // TODO: Reimplement for keypad
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
            this._refreshTokenPlaceables()
        }

        /**
         * Handles token movement and rotation.
         * 
         * @param {*} keypad a keypad client that has been mapped from the websocket message data
         * @private 
         */
         _handleMovement(keypad, tokenController) {
            let shiftKey = keypad.keys.find(key => key.id === 'SHI')
            let pressedMovementKeys = keypad.keys.filter(key => key.state === 'down' && key.id.match(/^[WASD]+$/g))
            if (!pressedMovementKeys.length) return

            // Get controlled objects
            const player = tokenController._getPlayerFor(keypad.controllerId)
            let token = tokenController._getTokenFor(player)

            // Map keys to directions
            const directions = pressedMovementKeys.map(key => keypad.directionKeyMap[key.id])

            // Define movement offsets and get moved directions
            let dx = 0
            let dy = 0

            // Assign movement offsets
            if (directions.includes('N')) dy -= 1
            if (directions.includes('E')) dx += 1
            if (directions.includes('S')) dy += 1
            if (directions.includes('W')) dx -= 1

            // Logging movement action
            console.debug(LOG_PREFIX + player.name + ': ' + (shiftKey.state === 'down' ? 'Rotating ' : 'Moving ') + token.name + ' to direction ' + directions, { 'dx': dx , 'dy': dy})

            // Perform the shift or rotation
            canvas.tokens.moveMany({ dx, dy, rotate: shiftKey.state === 'down', ids: [token.id] })

            // Repeat movement until all movement keys are released
            setTimeout(tokenController._handleMovement, 250, keypad, tokenController)
        }

        /**
         * Handles torch enabling or disabling depending on whether the token already emits light or not.
         * 
         * @param {*} message a data object from the websocket message containing the T key and state down
         * @private
         */
        _handleTorch(message) {
            return // TODO: Reimplement for keypad
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