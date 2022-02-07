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

const SETT_SETTINGS = "settings";

export const settings = {
  /**
   * @returns {Boolean}
   */
  get enabled() {
    return game.settings.get(VTT_MODULE_NAME, SETT_MODULE_ENABLED);
  },

  get settings() {
    return game.settings.get(VTT_MODULE_NAME, SETT_SETTINGS);
  },

  websocket: {
    get host() {
      return game.settings.get(VTT_MODULE_NAME, SETT_WEBSOCKET_HOST);
    },
    get port() {
      return game.settings.get(VTT_MODULE_NAME, SETT_WEBSOCKET_PORT);
    },
    get path() {
      return game.settings.get(VTT_MODULE_NAME, SETT_WEBSOCKET_PATH);
    },
    get url() {
      return "wss://" + this.host + ":" + this.port + this.path;
    },
  },

  camera: {
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
    get target() {
      return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_TARGET);
    },
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
      get count() {
        return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_LED_COUNT);
      },
      get offset() {
        return game.settings.get(VTT_MODULE_NAME, SETT_AMBILIGHT_LED_OFFSET);
      },
    },
    brightness: {
      get min() {
        return game.settings.get(
          VTT_MODULE_NAME,
          SETT_AMBILIGHT_BRIGHTNESS_MIN
        );
      },
      get max() {
        return game.settings.get(
          VTT_MODULE_NAME,
          SETT_AMBILIGHT_BRIGHTNESS_MAX
        );
      },
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

    console.log(LOG_PREFIX + "Loaded settings");
    return this;
  },
};
