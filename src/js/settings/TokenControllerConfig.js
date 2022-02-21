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
import { settings } from ".";
import * as TokenUtil from "../utils/tokenUtil";
import { VTT_MODULE_NAME } from "./constants";

/**
 * Form application to assign controllers to players.
 */
export class TokenControllerConfig extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      title: game.i18n.localize("MindFlayer.configTitle"),
      id: "mindflayer-token-controller-config",
      template:
        "modules/mindflayer-token-controller/templates/keyboard-config.html",
      width: 500,
      height: "auto",
      closeOnSubmit: true,
      tabs: [
        { navSelector: ".tabs", contentSelector: ".content", initial: "general" },
      ],
    });
  }

  getData(options) {
    const existingSettings = settings.settings;
    let data = mergeObject(
      {
        playerList: game.users.contents.reduce((acc, user) => {
          acc[user.id] = user.name;
          return acc;
        }, {}),
      },
      this.reset ? { mappings: {} } : existingSettings
    );
    return data;
  }

  async _updateObject(event, formData) {
    formData = this._parseInputs(formData);

    const existingSettings = settings.settings;
    let newSettings = mergeObject(existingSettings, formData);

    await game.settings.set(VTT_MODULE_NAME, "settings", newSettings);

    game.socket.emit("module.mindflayer-token-controller", {
      type: "update",
      user: game.user.id,
    });
    ui.notifications.info(game.i18n.localize("MindFlayer.saveMessage"));

    TokenUtil.setDefaultTokens();
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find('button[name="reset"]').click(this._onReset.bind(this));
    this.reset = false;
  }

  _onReset() {
    this.reset = true;
    this.render();
  }

  _parseInputs(data) {
    var ret = {};
    retloop: for (var input in data) {
      var val = data[input];

      var parts = input.split("[");
      var last = ret;

      for (var i in parts) {
        var part = parts[i];
        if (part.substr(-1) == "]") {
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
