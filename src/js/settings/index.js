/**
 * This file is part of the Foundry VTT Module Mindflayer.
 *
 * The Foundry VTT Module Mindflayer is free software: you can redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * The Foundry VTT Module Mindflayer is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even
 * the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with the Foundry VTT Module Mindflayer. If not,
 * see <https://www.gnu.org/licenses/>.
 */
"use strict";
import CameraControl from "../modules/cameraControl";
import { reload } from "../modules/loader";
import Socket from "../modules/socket";
import { getModuleInstance } from "../utils/module";
import { LOG_PREFIX, VTT_MODULE_NAME } from "./constants";
import { TokenControllerConfig } from "./TokenControllerConfig";

const SETT_MODULE_ENABLED = "enabled";

const SETT_WEBSOCKET_HOST = "websocketHost";
const SETT_WEBSOCKET_PORT = "websocketPort";
const SETT_WEBSOCKET_PATH = "websocketPath";

const SETT_CAMERA_CONTROL = "cameraControl";

const SETT_AMBILIGHT_ENABLE = "ambilightEnabled";
const SETT_AMBILIGHT_TARGET = "ambilightTarget";
const SETT_AMBILIGHT_UNIVERSE = "ambilightUniverse";
const SETT_AMBILIGHT_FPS = "ambilightFPS";
const SETT_AMBILIGHT_LED_COUNT = "ambilightLEDCount";
const SETT_AMBILIGHT_LED_OFFSET = "ambilightOffset";
const SETT_AMBILIGHT_BRIGHTNESS_MIN = "ambilightBrightnessMin";
const SETT_AMBILIGHT_BRIGHTNESS_MAX = "ambilightBrightnessMax";

const SETT_COMBAT_SKIP_DEFEATED = "combatSkipDefeated";

const SETT_COMBAT_INDICATOR_TACTICAL_DURATION =
  "combatIndicatorTacticalDuration";
const SETT_COMBAT_INDICATOR_PLAYER_REACTION_DURATION =
  "combatIndicator.playerReactionTime";

const SETT_SETTINGS = "settings";

export const settings = {
  /**
   * @returns {Boolean}
   */
  get enabled() {
    return game.settings.get(VTT_MODULE_NAME, SETT_MODULE_ENABLED);
  },

  /**
   * @returns {({
   *  mappings: {}
   * })}
   */
  get settings() {
    return game.settings.get(VTT_MODULE_NAME, SETT_SETTINGS);
  },

  /**
   * @returns {Boolean}
   */
  get skipDefeated() {
    return game.settings.get(VTT_MODULE_NAME, SETT_COMBAT_SKIP_DEFEATED);
  },

  core: {
    /**
     * @returns {Boolean}
     */
    get noCanvas() {
      return game.settings.get("core", "noCanvas");
    },
  },

  websocket: {
    /**
     * @returns {string}
     */
    get host() {
      return game.settings.get(VTT_MODULE_NAME, SETT_WEBSOCKET_HOST);
    },
    /**
     * @returns {number}
     */
    get port() {
      return game.settings.get(VTT_MODULE_NAME, SETT_WEBSOCKET_PORT);
    },
    /**
     * @returns {string}
     */
    get path() {
      return game.settings.get(VTT_MODULE_NAME, SETT_WEBSOCKET_PATH);
    },
    /**
     * @returns {string}
     */
    get url() {
      return "wss://" + this.host + ":" + this.port + this.path;
    },
  },

  camera: {
    /**
     * @returns {"default"|"focusPlayers"|"off"},
      }}
     */
    get control() {
      return game.settings.get(VTT_MODULE_NAME, SETT_CAMERA_CONTROL);
    },
  },

  ambilight: {
    /**
     * @returns {Boolean}
     */
    get enabled() {
      return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_ENABLE);
    },
    /**
     * @returns {string}
     */
    get target() {
      return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_TARGET);
    },
    /**
     * @returns {number}
     */
    get universe() {
      return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_UNIVERSE);
    },
    /**
     * @var {float} fps Number of refreshes of the ambilight per second
     */
    get fps() {
      return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_FPS);
    },
    led: {
      /**
       * @returns {number}
       */
      get count() {
        return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_LED_COUNT);
      },
      /**
       * @returns {number}
       */
      get offset() {
        return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_LED_OFFSET);
      },
    },
    brightness: {
      /**
       * @returns {number}
       */
      get min() {
        return game.settings.get(
          VTT_MODULE_NAME,
          SETT_AMBILIGHT_BRIGHTNESS_MIN
        );
      },
      /**
       * @returns {number}
       */
      get max() {
        return game.settings.get(
          VTT_MODULE_NAME,
          SETT_AMBILIGHT_BRIGHTNESS_MAX
        );
      },
    },
  },

  combatIndicator: {
    /** @returns {number} */
    get tacticalDiscussionDuration() {
      return game.settings.get(
        VTT_MODULE_NAME,
        SETT_COMBAT_INDICATOR_TACTICAL_DURATION
      );
    },
    /** @returns {number} */
    get playerReactionTime() {
      return game.settings.get(
        VTT_MODULE_NAME,
        SETT_COMBAT_INDICATOR_PLAYER_REACTION_DURATION
      );
    },
  },

  init() {
    game.settings.register(VTT_MODULE_NAME, SETT_MODULE_ENABLED, {
      name: "MindFlayer.moduleEnabled",
      hint: "MindFlayer.moduleEnabledHint",
      scope: "client",
      type: Boolean,
      default: false,
      config: true,
      restricted: false,
      onChange: () => {
        location.reload();
      },
    });

    game.settings.register(VTT_MODULE_NAME, SETT_WEBSOCKET_HOST, {
      name: "MindFlayer.websocketHost",
      hint: "MindFlayer.websocketHostHint",
      scope: "client",
      type: String,
      default: "localhost",
      config: true,
      onChange: () => {
        reload(getModuleInstance(), Socket.name);
      },
    });

    game.settings.register(VTT_MODULE_NAME, SETT_WEBSOCKET_PORT, {
      name: "MindFlayer.websocketPort",
      hint: "MindFlayer.websocketPortHint",
      scope: "client",
      type: String,
      default: "443",
      config: true,
      onChange: () => {
        reload(getModuleInstance(), Socket.name);
      },
    });

    game.settings.register(VTT_MODULE_NAME, SETT_WEBSOCKET_PATH, {
      name: "MindFlayer.websocketPath",
      hint: "MindFlayer.websocketPathHint",
      scope: "client",
      type: String,
      default: "/ws/vtt",
      config: true,
      onChange: () => {
        reload(getModuleInstance(), Socket.name);
      },
    });

    game.settings.register(VTT_MODULE_NAME, SETT_CAMERA_CONTROL, {
      name: "MindFlayer.cameraControl",
      hint: "MindFlayer.cameraControlHint",
      default: "default",
      type: String,
      isSelect: true,
      choices: {
        default: game.i18n.localize("MindFlayer.cameraControlDefault"),
        focusPlayers: game.i18n.localize(
          "MindFlayer.cameraControlFocusPlayers"
        ),
        off: game.i18n.localize("MindFlayer.cameraControlOff"),
      },
      config: true,
      onChange: () => {
        reload(getModuleInstance(), CameraControl.name);
      },
    });

    game.settings.registerMenu(VTT_MODULE_NAME, VTT_MODULE_NAME, {
      name: "MindFlayer.config",
      label: "MindFlayer.configTitle",
      hint: "MindFlayer.configHint",
      icon: "fas fa-keyboard",
      type: TokenControllerConfig,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_ENABLE, {
      name: "MindFlayer.ambilightEnabled",
      hint: "MindFlayer.ambilightEnabledHint",
      scope: "client",
      type: Boolean,
      default: false,
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_TARGET, {
      name: "MindFlayer.ambilightTarget",
      hint: "MindFlayer.ambilightTargetHint",
      scope: "client",
      type: String,
      default: "",
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_UNIVERSE, {
      name: "MindFlayer.ambilightUniverse",
      hint: "MindFlayer.ambilightUniverseHint",
      scope: "client",
      type: Number,
      default: 0x01,
      range: {
        min: 1,
        max: 255,
        step: 1,
      },
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_FPS, {
      name: "MindFlayer.ambilightFPS",
      hint: "MindFlayer.ambilightFPSHint",
      scope: "client",
      type: Number,
      default: 0x01,
      range: {
        min: 0.1,
        max: 15,
        step: 0.1,
      },
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_LED_COUNT, {
      name: "MindFlayer.ambilightLEDCount",
      hint: "MindFlayer.ambilightLEDCountHint",
      scope: "client",
      type: Number,
      default: 0x01,
      range: {
        min: 1,
        max: 170,
        step: 1,
      },
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_LED_OFFSET, {
      name: "MindFlayer.ambilightOffset",
      hint: "MindFlayer.ambilightOffsetHint",
      scope: "client",
      type: Number,
      default: 0,
      range: {
        min: -170,
        max: 170,
        step: 1,
      },
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_BRIGHTNESS_MIN, {
      name: "MindFlayer.ambilightBrightnessMin",
      hint: "MindFlayer.ambilightBrightnessMinHint",
      scope: "client",
      type: Number,
      default: 0,
      range: {
        min: 0,
        max: 255,
        step: 1,
      },
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_AMBILIGHT_BRIGHTNESS_MAX, {
      name: "MindFlayer.ambilightBrightnessMax",
      hint: "MindFlayer.ambilightBrightnessMaxHint",
      scope: "client",
      type: Number,
      default: 255,
      range: {
        min: 0,
        max: 255,
        step: 1,
      },
      config: true,
      restricted: false,
    });

    game.settings.register(VTT_MODULE_NAME, SETT_SETTINGS, {
      name: "MindFlayer.config",
      scope: "world",
      type: Object,
      config: false,
      default: {
        mappings: {},
      },
    });

    game.settings.register(VTT_MODULE_NAME, SETT_COMBAT_SKIP_DEFEATED, {
      name: "MindFlayer.combatSkipDefeated",
      scope: "world",
      type: Boolean,
      config: false,
      default: true,
    });

    game.settings.register(
      VTT_MODULE_NAME,
      SETT_COMBAT_INDICATOR_TACTICAL_DURATION,
      {
        name: "module.MindFlayer.setting.combatIndicator.tacticalDuration.name",
        hint: "module.MindFlayer.setting.combatIndicator.tacticalDuration.hint",
        scope: "client",
        type: Number,
        default: 0,
        range: {
          min: 0,
          max: 120,
          step: 1,
        },
        config: true,
        restricted: false,
      }
    );

    game.settings.register(
      VTT_MODULE_NAME,
      SETT_COMBAT_INDICATOR_PLAYER_REACTION_DURATION,
      {
        name: "module.MindFlayer.setting.combatIndicator.playerReactionTime.name",
        hint: "module.MindFlayer.setting.combatIndicator.playerReactionTime.hint",
        scope: "client",
        type: Number,
        default: 6,
        range: {
          min: 0,
          max: 60,
          step: 1,
        },
        config: true,
        restricted: false,
      }
    );

    console.log(LOG_PREFIX + "Loaded settings");
    return this;
  },
};
