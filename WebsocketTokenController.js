(function () {
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    //
    // Constants
    //
    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    const MODULE_NAME = 'websocket-token-constoller'
    const LOCALIZATION_NAMESPACE = 'WebsocketTokenController'
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

        game.settings.register(MODULE_NAME, 'enabled', {
            name: `${LOCALIZATION_NAMESPACE}.moduleEnabled`,
            hint: `${LOCALIZATION_NAMESPACE}.moduleEnabledHint`,
            scope: 'client',
            type: Boolean,
            default: false,
            config: true,
            restricted: false,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(MODULE_NAME, 'websocketHost', {
            name: `${LOCALIZATION_NAMESPACE}.websocketHost`,
            hint: `${LOCALIZATION_NAMESPACE}.websocketHostHint`,
            scope: 'world',
            type: String,
            default: 'node-red.home.viromania.com',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.register(MODULE_NAME, 'websocketPort', {
            name: `${LOCALIZATION_NAMESPACE}.websocketPort`,
            hint: `${LOCALIZATION_NAMESPACE}.websocketPortHint`,
            scope: 'world',
            type: String,
            default: '443',
            config: true,
            onChange: () => {
                location.reload()
            }
        })

        game.settings.registerMenu(MODULE_NAME, MODULE_NAME, {
            name: `${LOCALIZATION_NAMESPACE}.config`,
            label: `${LOCALIZATION_NAMESPACE}.configTitle`,
            hint: `${LOCALIZATION_NAMESPACE}.configHint`,
            icon: 'fas fa-keyboard',
            type: TokenControllerConfig,
            restricted: false
        })

        game.settings.register(MODULE_NAME, 'mappings', {
            name: 'Mappings',
            scope: 'world',
            type: Object,
            config: false
        });

        console.log(LOG_PREFIX + 'Loaded settings')
    })

    /**
     * Ready hook
     */
    Hooks.once('ready', () => {
        if (game.settings.get(MODULE_NAME, 'enabled')) {
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
            Hooks.call(`${LOCALIZATION_NAMESPACE}Init`, this)
            game.users.entities.forEach(user => {
                user.setFlag(MODULE_NAME, 'currentTokenId', user.character ? user.character.id : null)
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
            let ip = game.settings.get(MODULE_NAME, 'websocketHost')
            let port = game.settings.get(MODULE_NAME, 'websocketPort')
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
                ui.notifications.info('Websocket Token Controller: ' + game.i18n.localize(`${LOCALIZATION_NAMESPACE}.Notifications.Connected`) + ip + ':' + port)
                // do stuff
            }

            socket.onerror = function (error) {
                ui.notifications.error('Websocket Token Controller: ' + game.i18n.localize(`${LOCALIZATION_NAMESPACE}.Notifications.Error`))
                console.error(LOG_PREFIX + 'Error: ', error)
            }
        }

        _handleTokenSelect(message) {
            if (message.key != 'TAB') return
            if (message.state != 'down') return

            const player = this._getPlayerFor(message['controller-id'])
            const tokens = this._findAllTokensFor(player)


            if (!player.getFlag(MODULE_NAME, 'currentTokenId')) {
                player.setFlag(MODULE_NAME, 'currentTokenId', tokens[0].id);
            } else {
                let i = 0
                for (; i < tokens.length; i++) {
                    if (player.getFlag(MODULE_NAME, 'currentTokenId') == tokens[i].id) {
                        break
                    }
                }
                i = (i + 1) % tokens.length
                player.setFlag(MODULE_NAME, 'currentTokenId', tokens[i].id);
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
            //TODO: add mapping
            return game.users.players.find(player => player.name == 'Beamer')
        }

        _getTokenFor(player) {
            return canvas.tokens.placeables.find(token => token.id == player.getFlag(MODULE_NAME, 'currentTokenId'))
        }

        _findAllTokensFor(player) {
            const tokens = canvas.tokens.placeables.filter(token => token.actor.data.permission[player.id] >= 3).sort((a, b) => a.id.localeCompare(b.id))
            if (!tokens.length) {
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
                title: game.i18n.localize(`${LOCALIZATION_NAMESPACE}.configTitle`),
                id: `${MODULE_NAME}-config`,
                template: 'modules/websocket-token-controller/templates/keyboard-config.html',
                width: 500,
                height: 'auto',
                closeOnSubmit: true,
                tabs: [{ navSelector: '.tabs', contentSelector: 'form', initial: 'general' }]
            })
        }

        getData(options) {
            return {
                userList: game.users.entities.reduce((acc, user) => {
                    acc[user.id] = user.name
                    return acc;
                }, {}),
                controllerList: ['timo']
            };
        }

        async _updateObject(event, formData) {
            formData = this._parseInputs(formData);

            let mappings = mergeObject(TokenControllerConfig.CONFIG, formData, { insertKeys: false, insertValues: false });

            await game.settings.set(MODULE_NAME, 'mappings', mappings);

            game.socket.emit(`module.${MODULE_NAME}`, { type: 'update', user: game.user.id });
            ui.notifications.info(game.i18n.localize(`${LOCALIZATION_NAMESPACE}.saveMessage`));
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