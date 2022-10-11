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
import { LOG_PREFIX, VTT_MODULE_NAME } from "../../settings/constants";
import AbstractSubModule from "../AbstractSubModule";
import { default as WakeLock } from "../wakeLock";
import { isFoundryNewerThan } from "../../utils/module";
const SUB_LOG_PREFIX = LOG_PREFIX + "Fullscreen: ";

const WRAP_KeyboardManager_handleKeys = "KeyboardManager.prototype._handleKeys";
const WRAP_PlaceableObject_can = "PlaceableObject.prototype.can";
const WRAP_Notifications_notify = "Notifications.prototype.notify";

export default class Fullscreen extends AbstractSubModule {
  #keyboardManagerHandleKeysWrapperFun = null;

  constructor(instance) {
    super(instance);
    console.debug(
      SUB_LOG_PREFIX + "overriding Key handling to add F10 to hide UI."
    );
    libWrapper.register(
      VTT_MODULE_NAME,
      WRAP_PlaceableObject_can,
      this.#placeableObjectCanWrapper.bind(this),
      libWrapper.MIXED
    );
    /* prevent permanent notifications in fullscreen */
    libWrapper.register(
      VTT_MODULE_NAME,
      WRAP_Notifications_notify,
      this.#notificationsNotifyWrapper.bind(this),
      libWrapper.MIXED
    );
    this.#keyboardManagerHandleKeysWrapperFun =
      this.#keyboardManagerHandleKeysWrapper.bind(this);
    if (isFoundryNewerThan(game.version || game.data.version, "9.0")) {
      game.keybindings.register(VTT_MODULE_NAME, "hideUI", {
        name: "Hide UI",
        hint: "When the key is released, the game UI is toggled invisible.",
        uneditable: [
          {
            key: "hideUI",
            modifiers: [],
          },
        ],
        editable: [
          {
            key: "F10",
          },
        ],
        onDown: () => {},
        onUp: () => {
          this.enabled = !this.enabled;
        },
        restricted: false, // Restrict this Keybinding to gamemaster only?
        reservedModifiers: [], // If the ALT modifier is pressed, the notification is permanent instead of temporary
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL,
      });
    } else {
      libWrapper.register(
        VTT_MODULE_NAME,
        WRAP_KeyboardManager_handleKeys,
        this.#keyboardManagerHandleKeysWrapperFun,
        libWrapper.MIXED
      );
    }
  }

  unhook() {
    libWrapper.unregister(VTT_MODULE_NAME, WRAP_KeyboardManager_handleKeys);
    libWrapper.unregister(VTT_MODULE_NAME, WRAP_PlaceableObject_can);
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, WakeLock.name];
  }

  /**
   * @returns {WakeLock}
   */
  get wakeLock() {
    return this.instance.modules[WakeLock.name];
  }

  get enabled() {
    return jQuery(document.body).hasClass("hide-ui");
  }

  set enabled(value) {
    const $body = jQuery(document.body);
    if (value) {
      $body.addClass("hide-ui");
    } else {
      $body.removeClass("hide-ui");
    }
    this.wakeLock.enabled = this.enabled;
    this.wakeLock.ensureWakeLock();
  }

  #placeableObjectCanWrapper(wrapped, user, action) {
    if (action == "control" && this.enabled) {
      return false;
    }
    return wrapped(user, action);
  }

  #notificationsNotifyWrapper(wrapped, message, type, options) {
    if (this.enabled) {
      options = {
        ...options,
        permanent: false,
      };
    }
    wrapped(message, type, options);
  }

  #keyboardManagerHandleKeysWrapper(wrapped, event, key, state) {
    const result = wrapped(event, key, state);
    if (key == "F10" && state == false) {
      event.preventDefault();
      this.enabled = !this.enabled;
    }
    return result;
  }
}
