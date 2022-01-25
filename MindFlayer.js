(function () {
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Constants
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const VTT_MODULE_NAME = 'mindflayer-token-controller'
    const LOG_PREFIX = 'Mind Flayer | '

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
            name: 'MindFlayer.moduleEnabled',
            hint: 'MindFlayer.moduleEnabledHint',
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
            name: 'MindFlayer.websocketHost',
            hint: 'MindFlayer.websocketHostHint',
            scope: 'client',
            type: String,
            default: 'localhost',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(VTT_MODULE_NAME, 'websocketPort', {
            name: 'MindFlayer.websocketPort',
            hint: 'MindFlayer.websocketPortHint',
            scope: 'client',
            type: String,
            default: '443',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(VTT_MODULE_NAME, 'websocketPath', {
            name: 'MindFlayer.websocketPath',
            hint: 'MindFlayer.websocketPathHint',
            scope: 'client',
            type: String,
            default: '/ws/vtt',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(VTT_MODULE_NAME, 'cameraControl', {
            name: 'MindFlayer.cameraControl',
            hint: 'MindFlayer.cameraControlhHint',
            default: 'default',
            type: String,
            isSelect: true,
            choices: {
                default: game.i18n.localize('MindFlayer.cameraControlDefault'),
                focusPlayers: game.i18n.localize('MindFlayer.cameraControlFocusPlayers'),
                off: game.i18n.localize('MindFlayer.cameraControlOff')
            },
            config: true
        })

        game.settings.registerMenu(VTT_MODULE_NAME, VTT_MODULE_NAME, {
            name: 'MindFlayer.config',
            label: 'MindFlayer.configTitle',
            hint: 'MindFlayer.configHint',
            icon: 'fas fa-keyboard',
            type: TokenControllerConfig
        })

        game.settings.register(VTT_MODULE_NAME, 'settings', {
            name: 'MindFlayer.config',
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
        if(!game.modules.get('lib-wrapper')?.active && game.user.isGM) {
            ui.notifications.error("Module " + VTT_MODULE_NAME + " requires the 'libWrapper' module. Please install and activate it.")
        } else if (game.settings.get(VTT_MODULE_NAME, 'enabled')) {
            console.log(LOG_PREFIX + 'Starting websocket connection')
            game.mindflayerctrl = new TokenController()
            document.addEventListener('visibilitychange', game.mindflayerctrl.ensureWakeLock.bind(game.mindflayerctrl));
        }
    });


    Hooks.on('updateCombat', async (combat, update) => {
        if (!combat.started) {
            await Marker.deleteStartMarker();
        }
        // SWADE has a special initiative
        if (game.system.id != "swade") {
            game.mindflayerctrl.handleCombatUpdate(combat, update);
        }
    });

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Classes
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /**
     * Main class
     */
    class TokenController {

        doorQueue = []
        doorChangeThread = null
        wakeLock = null
        isConnected = false
        seenKeypads = new Array()
        activeControllers = new Map()
        directions = {
            0: ['N', 'W', 'S', 'E'],
            90: ['E', 'N', 'W', 'S'],
            180: ['S', 'E', 'N', 'W'],
            270: ['W', 'S', 'E', 'N']
        }

        /**
         * Constructor. Initialize MindFlayer.
         */
        constructor() {
            Hooks.call('MindFlayerInit', this)
            this.setDefaultTokens()
            this._initializeWebsocket()
            this._overrideGetBorderColorOnTokens()
            this._overrideHandleKeysOnKeyboardToHideUI()
            this._overrideCameraPanForTokenMovement()
            this.doorChangeThread = setInterval(this._toggleDoorThread.bind(this), 150)
        }

        /**
         * Sets the users default characters as preselected tokens.
         */
        setDefaultTokens() {
            const $this = this
            game.users.contents.forEach(user => {
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
                    $this._handleStatus(socket, data)
                    if (data.type === "key-event") {
                        $this._handleKeyEvent(data)
                    } else if(data.type === "keyboard-login") {
                        $this._handleKeyboardLogin(data)
                    }
                } catch (error) {
                    console.error(LOG_PREFIX + 'Error: ', error)
                }
            }

            socket.onopen = function (data) {
                ui.notifications.info('Mind Flayer: ' + game.i18n.format('MindFlayer.Notifications.Connected', { host: host, port: port, path: path }))
                console.log(LOG_PREFIX + 'Connected to websocket: ', data)
                $this.isConnected = true
                socket.send(JSON.stringify({
                    type: 'registration',
                    status: 'connected',
                    receiver: true,
                    players: game.users.players.map(player => ({
                        id: player.id,
                        name: player.name
                    }))
                }));
            }

            socket.onclose = function (e) {
                ui.notifications.error('Mind Flayer: ' + game.i18n.localize('MindFlayer.Notifications.ConnectionClosed'))
                console.warn(LOG_PREFIX + 'Websocket connection closed, attempting to reconnect in 5 seconds...')
                $this.isConnected = false
                setTimeout(function () {
                    $this._initializeWebsocket()
                }, 5000)
            }

            socket.onerror = function (error) {
                ui.notifications.error('Mind Flayer: ' + game.i18n.localize('MindFlayer.Notifications.Error'))
                console.error(LOG_PREFIX + 'Error: ', error)
                socket.close()
            }
        }

        _overrideGetBorderColorOnTokens() {
            console.debug(LOG_PREFIX + "overriding Token Border Color to add display user select.")
            let $this = this
            libWrapper.register(VTT_MODULE_NAME, "Token.prototype._getBorderColor", function WTC_getBorderColor(wrapped, ...args) {
                if ($this.isConnected && this.actor && this.actor.hasPlayerOwner) {
                    const userInfo = $this._getUserForSelectedToken(this)
                    if (userInfo.selected) {
                        const color = $this._hexToRgb(userInfo.player.data.color);
                        return (color.r & 0xff) << 16 | (color.g & 0xff) << 8 | (color.b & 0xff)
                    }
                }
                return wrapped(...args)
            }, 'MIXED')
            $this._refreshTokenPlaceables()
        }

        _overrideHandleKeysOnKeyboardToHideUI() {
            console.debug(LOG_PREFIX + "overriding Key handling to add F10 to hide UI.")
            const $this = this
            libWrapper.register(VTT_MODULE_NAME, "KeyboardManager.prototype._handleKeys", function WTC_handleKeys(wrapped, event, key, state) {
                wrapped(event, key, state)
                if (key == "F10" && state == false) {
                    event.preventDefault()
                    const $body = jQuery(document.body)
                    $body.toggleClass('hide-ui')
                    $this.ensureWakeLock()
                }
            }, 'WRAPPER')
            libWrapper.register(VTT_MODULE_NAME, "PlaceableObject.prototype.can", function MF_can(wrapped, user, action) {
                if (action == "control" && jQuery(document.body).hasClass('hide-ui')) {
                    return false
                }
                return wrapped(user, action)
            }, 'MIXED')
        }

        async ensureWakeLock() {
            if(jQuery(document.body).hasClass('hide-ui') && this.wakeLock === null && document.visibilityState === 'visible') {
                try {
                    this.wakeLock = await navigator.wakeLock.request()
                    const $this = this
                    this.wakeLock.addEventListener('release', () => {
                        console.debug(LOG_PREFIX + "screen lock released")
                        $this.wakeLock = null
                    })
                    console.debug(LOG_PREFIX + "locked the screen awake")
                } catch(err) {
                    console.error(LOG_PREFIX + `WakeLock ${err.name}, ${err.message}`)
                }
            } else if(this.wakeLock != null) {
                this.wakeLock.release()
            }
        }

        _overrideCameraPanForTokenMovement() {
            let $this = this
            console.debug(LOG_PREFIX + "overriding camera pan to focus on all player tokens instead of the current moved one.")
            libWrapper.register(VTT_MODULE_NAME, "Token.prototype.setPosition", async function WTC_setPosition(wrapped, x, y, {animate=true}={}) {
                let cameraControl = game.settings.get(VTT_MODULE_NAME, 'cameraControl')
                if (cameraControl == 'off' || cameraControl == 'focusPlayers') {
                    // Create a Ray for the requested movement
                    let origin = this._movement ? this.position : this._validPosition,
                    target = {x: x, y: y},
                    isVisible = this.isVisible;

                    // Create the movement ray
                    let ray = new Ray(origin, target);

                    // Update the new valid position
                    this._validPosition = target;

                    // Record the Token's new velocity
                    this._velocity = this._updateVelocity(ray);

                    // Update visibility for a non-controlled token which may have moved into the controlled tokens FOV
                    this.visible = isVisible;

                    // Conceal the HUD if it targets this Token
                    if ( this.hasActiveHUD ) this.layer.hud.clear();

                    // Either animate movement to the destination position, or set it directly if animation is disabled
                    if ( animate ) await this.animateMovement(new Ray(this.position, ray.B));
                    else this.position.set(x, y);

                    // Re-center the view on all players if the moved token is visible
                    if (cameraControl == 'focusPlayers' && isVisible) {
                        const sceneSize = {
                            width: canvas.scene.dimensions.rect.width,
                            height: canvas.scene.dimensions.rect.height
                        }
                        let gridSize = canvas.scene.dimensions.size
                        let activeCharacterTokens = $this._getAllCombatTokens()
                        activeCharacterTokens.push(...$this._getAllActivePlayerCharacterTokens())
                        if (activeCharacterTokens.length == 0) {
                            console.warn(LOG_PREFIX + 'No active character tokens found. Automatic camera panning only works with active controllers that belong to a player with a character token in the same scene.')
                            return
                        }
                        activeCharacterTokens = activeCharacterTokens.filter(token => (token.combatant)? !token.combatant.data.hidden && !token.combatant.data.defeated: true)
                        
                        let lowestXCoordinate = Math.min(...activeCharacterTokens.map(token => token.x))
                        let highestXCoordinate = Math.max(...activeCharacterTokens.map(token => token.x + token.w))
                        let targetXCoordinate = (highestXCoordinate + lowestXCoordinate + gridSize) / 2

                        let lowestYCoordinate = Math.min(...activeCharacterTokens.map(token => token.y))
                        let highestYCoordinate = Math.max(...activeCharacterTokens.map(token => token.y + token.h))
                        let targetYCoordinate = (highestYCoordinate + lowestYCoordinate + gridSize) / 2

                        let boundingbox = { width: highestXCoordinate - lowestXCoordinate, height: highestYCoordinate - lowestYCoordinate }
                        let pad = gridSize*4
                        let scale = Math.min((window.innerWidth-pad)/(boundingbox.width+pad), (window.innerHeight-pad)/(boundingbox.height+pad), 0.7)
                        scale = Math.max(Math.min(window.innerWidth/sceneSize.width, window.innerHeight/sceneSize.height), scale)

                        let cameraSettings = {x: targetXCoordinate, y: targetYCoordinate, scale: scale, duration: 1000}
                        console.debug(LOG_PREFIX + 'Readjusting view to fit all player tokens on screen... Centering on: ', cameraSettings)
                        canvas.animatePan(cameraSettings);
                    }

                    return this;
                }

                // use default camera control behavior for token movement
                return wrapped(x, y, {animate=true}={})
            }, 'MIXED')
        }

        _getUserForSelectedToken(token) {
            let result = { selected: false }
            game.users.contents.forEach(player => {
                if (game.user.getFlag(VTT_MODULE_NAME, 'selectedToken_' + player.id) == token.id) {
                    result = { player, selected: true };
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
                this.activeControllers.set(controllerId, socket)
                ui.notifications.info('Mind Flayer: ' + game.i18n.format('MindFlayer.Notifications.NewClient', { controller: controllerId, player: player.name }))
                this._configurePlayerLEDs(controllerId)
            } else if (message.status == 'disconnected') {
                const controllerId = message['controller-id']
                this.activeControllers.delete(controllerId)
                const player = this._getPlayerFor(controllerId)
                ui.notifications.warn('Mind Flayer: ' + game.i18n.format('MindFlayer.Notifications.ClientDisconnected', { controller: controllerId, player: player.name }))
            }
        }

        /**
         * Handles keypresses sent through the websocket.
         * 
         * @param {*} message a data object from the websocket message containing a key-event representing a keypress on a client
         * @private 
         */
        _handleKeyEvent(message) {
            let $this = this
            let keypad = $this.seenKeypads.find(keypad => keypad.controllerId === message['controller-id'])
            if (!keypad) {
                keypad = new Keypad(message)
                keypad.onKeypress = function () {
                    if (this.keys.filter(key => key.state === 'down' && key.id.match(/^[WASD]+$/g)).length <= 1) {
                        
                        // Reset move keys after a delay of 50ms or greater
                        const now = Date.now()
                        const delta = now - this._moveTime
                        if ( delta > 50 ) this._moveKeys.clear()

                        if ( delta < 100 ) return; // Throttle keyboard movement once per 100ms
                        setTimeout($this._handleMovement.bind($this), 40, this)

                        this._moveTime = now
                    }
                    if (this.isDown('E')) {
                        $this._handleTorch(this)
                    }
                    if (this.isDown('Q')) {
                        $this._handleTokenSelect(this)
                    }
                    if (this.isDown('SPC')) {
                        $this._handleDoorUse(this)
                    }
                    if (this.isDown('C') && this.isDown('SHI')) {
                        $this._changeKeyboardAlignment(this)
                    }
                }
                $this.seenKeypads.push(keypad)
            }
            keypad.registerKeyEvent(message)
        }
        
        _changeKeyboardAlignment(keypad) {
            keypad.alignment = (keypad.alignment + 90) % 360
            let player = this._getPlayerFor(keypad.controllerId)
            ui.notifications.info('Mind Flayer: ' + game.i18n.format('MindFlayer.Notifications.ChangeDirection', { player: player.name, orientation: keypad.alignment }))
        }

        _handleKeyboardLogin(message) {
            let $this = this
            const settings = game.settings.get(VTT_MODULE_NAME, 'settings')
            
            settings.mappings[message['player-id']] = message['controller-id']

            game.settings.set(VTT_MODULE_NAME, 'settings', settings)
        }

        /**
         * Handles token selection by cycling through the available tokens for the player assigned to the controller.
         * 
         * @param {*} keypad a keypad client that has been mapped from the websocket message data
         * @private 
         */
        _handleTokenSelect(keypad) {
            const player = this._getPlayerFor(keypad.controllerId)
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
        _handleMovement(keypad) {
            let shiftKey = keypad.keys.find(key => key.id === 'SHI')
            // Track the movement set
            const pressedKeys = keypad.keys.filter(key => key.state === 'down' && key.id.match(/^[WASD]+$/g))
            for (let key of pressedKeys) {
                keypad._moveKeys.add(this.directions[keypad.alignment][key.directionId])
            }
            if (!keypad._moveKeys.size) return

            // Get controlled objects
            const player = this._getPlayerFor(keypad.controllerId)
            let token = this._getTokenFor(player)

            // Map keys to directions
            const directions = keypad._moveKeys

            // Define movement offsets and get moved directions
            let dx = 0
            let dy = 0

            // Assign movement offsets
            if (directions.has('N')) dy -= 1
            if (directions.has('E')) dx += 1
            if (directions.has('S')) dy += 1
            if (directions.has('W')) dx -= 1

            // Logging movement action
            console.debug(LOG_PREFIX + player.name + ': ' + (shiftKey.state === 'down' ? 'Rotating ' : 'Moving ') + token.name + ' to direction ' + directions, { 'dx': dx, 'dy': dy })

            // Perform the shift or rotation
            canvas.tokens.moveMany({ dx, dy, rotate: shiftKey.state === 'down', ids: [token.id] })

            // Reset move keys
            keypad._moveKeys.clear()
            // Repeat movement until all movement keys are released
            setTimeout(this._handleMovement.bind(this), 250, keypad)
        }

        /**
         * Handles torch enabling or disabling depending on whether the token already emits light or not.
         * 
         * @param {*} keypad a keypad client that has been mapped from the websocket message data
         * @private
         */
        _handleTorch(keypad) {
            const player = this._getPlayerFor(keypad.controllerId)
            let token = this._getTokenFor(player)

            if (!token.emitsLight) {
                console.debug(LOG_PREFIX + player.name + ': Turn on torch for ' + token.name)
                token.update({ brightLight: 20, dimLight: 40, lightAlpha: 0.12, lightColor: '#ffad58', lightAnimation: { type: 'torch', speed: 5, intensity: 5 } })
            } else {
                console.debug(LOG_PREFIX + player.name + ': Turn off torch for ' + token.name)
                token.update({ brightLight: 0, dimLight: 0 })
            }
        }

        _handleDoorUse(keypad) {
            const player = this._getPlayerFor(keypad.controllerId)
            const token = this._getTokenFor(player)

            
            const interactionBounds = {
                left: token.x - canvas.grid.size,
                top: token.y - canvas.grid.size,
                right: token.x + token.width + canvas.grid.size,
                bottom: token.y + token.height + canvas.grid.size
            }

            let delay = 0
            canvas.walls.doors.forEach((door) => {
                if(door.doorControl && this._intersectRect(interactionBounds, door.bounds) && !this.doorQueue.find(d => d.door === door)) {
                    this.doorQueue.push({
                        player, token, door
                    })
                }
            })
        }

        _toggleDoorThread() {
            const doorChangeRequest = this.doorQueue.shift()
            if(doorChangeRequest) {
                console.debug(LOG_PREFIX + doorChangeRequest.player.name + '[' + doorChangeRequest.token.name + ']: toggling the door ', doorChangeRequest.door)
                doorChangeRequest.door.doorControl._onMouseDown(new MouseEvent('mousedown'))
            }
        }

        _intersectRect(r1, r2) {
            return !(r2.left > r1.right || 
                    r2.right < r1.left || 
                    r2.top > r1.bottom ||
                    r2.bottom < r1.top);
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
            const selectedPlayer = game.users.contents.find(player => player.id == playerId)
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
            let token = canvas.tokens.placeables.find(token => token.id == selectedToken)
            if (!token) {
                const tokens = this._findAllTokensFor(player, true)
                if(tokens.length <= 0) {
                    throw new Error('Could not find token any tokens on current map for player ' + player.name)
                }
                token = tokens[0]
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
            const tokens = canvas.tokens.placeables.filter(token => token.actor && token.actor.data.permission[player.id] >= 3).sort((a, b) => a.id.localeCompare(b.id))
            if (!ignoreEmpty && !tokens.length) {
                throw new Error('Could not find any tokens for player ' + player.name)
            }
            return tokens
        }

        /**
         * Returns all currently selected tokens for active players.
         * 
         * @returns all currently selected player character tokens for active players, if there are any
         */
        _getAllActivePlayerCharacterTokens() {
            if (!this.activeControllers.size) return []
            const activePlayers = Array.from(this.activeControllers.keys()).map(controllerId => this._getPlayerFor(controllerId))
            const tokens = activePlayers.flatMap(player => this._findAllTokensFor(player, true)).filter(token => token.actor.type == 'character')
            return tokens
        }

        /**
         * Returns all tokens that are in combat
         * 
         * @returns TokenDocument[] the tokens in combat or empty array if no combat
         */
        _getAllCombatTokens() {
            if(game.combat == null) {
                return []
            }
            return game.combat.turns.map(combatant => combatant.token.object)
        }

        _configurePlayerLEDs(controllerId, color1Arg, color2Arg) {
            const color1 = color1Arg || this._hexToRgb(this._getPlayerFor(controllerId).data.color)
            const color2 = color2Arg || this._hexToRgb(this._getPlayerFor(controllerId).data.color)
            this.activeControllers.get(controllerId).send(JSON.stringify({
                type: 'configuration',
                "controller-id": controllerId,
                led1: color1,
                led2: color2
            }))
        }

        handleCombatUpdate(combat, update) {
            if(combat.combatant) {
                const activePlayerIds = combat.combatant.players.map(player => player.id)
                this.activeControllers.forEach((socket, controllerId) => {
                    const player = this._getPlayerFor(controllerId)
                    if(activePlayerIds.includes(player.id)) {
                        this._configurePlayerLEDs(controllerId, this._hexToRgb(player.data.color), this._hexToRgb("#FF0000"))
                    } else {
                        this._configurePlayerLEDs(controllerId, this._hexToRgb(player.data.color), this._hexToRgb(player.data.color))
                    }
                })
            }
        }
    }

    /**
     * Form application to assign controllers to players.
     */
    class TokenControllerConfig extends FormApplication {

        static get defaultOptions() {
            return mergeObject(super.defaultOptions, {
                title: game.i18n.localize('MindFlayer.configTitle'),
                id: 'mindflayer-token-controller-config',
                template: 'modules/mindflayer-token-controller/templates/keyboard-config.html',
                width: 500,
                height: 'auto',
                closeOnSubmit: true,
                tabs: [{ navSelector: '.tabs', contentSelector: 'form', initial: 'general' }]
            })
        }

        getData(options) {
            const existingSettings = game.settings.get(VTT_MODULE_NAME, 'settings')
            let data = mergeObject({
                playerList: game.users.contents.reduce((acc, user) => {
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

            game.socket.emit('module.mindflayer-token-controller', { type: 'update', user: game.user.id })
            ui.notifications.info(game.i18n.localize('MindFlayer.saveMessage'))

            game.mindflayerctrl.setDefaultTokens()
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

    /**
     * Key class representing a button on the Keypad
     */
    class Key {

        state
        id
        directionId

        constructor(id, directionId) {
            this.id = id
            this.state = 'up'
            this.directionId = directionId
        }
    }

    /**
     * Keypad class representing a keypad
     */
    class Keypad {

        controllerId

        _moveTime = 0
        _moveKeys = new Set()

        alignment = 0

        keys = [
            new Key('Q'), new Key('W', 0), new Key('E'),
            new Key('A', 1), new Key('S', 2), new Key('D', 3),
            new Key('Z'), new Key('X'), new Key('C'),
            new Key('SHI'), new Key('SPC')
        ]

        constructor(data) {
            this.controllerId = data['controller-id']
            console.debug(LOG_PREFIX + 'Initialized keypad for controller ' + this.controllerId)
        }

        registerKeyEvent(data) {
            let key = this.keys.find(key => key.id === data.key)
            if(key == null) {
                console.warn(LOG_PREFIX + 'unknown key:', data)
                return
            }
            key.state = data.state
            if (data.state === 'down') this.onKeypress()
        }

        onKeypress() {
            throw Error('onKeypress is not implemented')
        }

        isDown(wantedKey) {
            return this.keys.filter(key => key.state === 'down' && key.id === wantedKey).length > 0
        }

    }

})()
