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

function controllerColor(index: number, count: number): string {
  const hue = (index * 360) / count;
  const channel = (offset: number) => {
    const segment = (offset + hue / 30) % 12;
    return Math.round(255 * (0.5 - 0.5 * Math.max(-1, Math.min(segment - 3, 9 - segment, 1))));
  };
  return `#${[channel(0), channel(8), channel(4)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

/**
 * Form application to assign controllers to players.
 */
export class TokenControllerConfig extends FormApplication {
  reset = false;
  #saved = false;
  #colors = new Map<string, string>();
  #previousRightLEDs = new Map<any, string | null>();

  #connectedKeypads() {
    return game.modules.get(VTT_MODULE_NAME)?.instance?.modules?.ControllerManager?.keypads ?? [];
  }

  #controllerOptions(savedMappings: Record<string, string> = {}) {
    const connected = this.#connectedKeypads()
      .map((keypad) => keypad.controllerId as string)
      .sort((left, right) => left.localeCompare(right));
    this.#colors = new Map(
      connected.map((id, index) => [id, controllerColor(index, connected.length)]),
    );
    const ids = [...new Set([...connected, ...Object.values(savedMappings).filter(Boolean)])];
    return ids.map((id) => ({
      id,
      color: this.#colors.get(id) ?? null,
      label: this.#colors.has(id) ? id : `${id} (offline)`,
    }));
  }
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("MindFlayer.configTitle"),
      id: "mindflayer-token-controller-config",
      template:
        "modules/mindflayer-token-controller/templates/keyboard-config.html",
      width: 500,
      height: "auto",
      closeOnSubmit: true,
      tabs: [
        {
          navSelector: ".tabs",
          contentSelector: ".content",
          initial: "general",
        },
      ],
    });
  }

  getData(options) {
    const existingSettings = settings.settings;
    const data = foundry.utils.mergeObject(
      {
        playerList: game.users.contents.reduce((acc, user) => {
          acc[user.id] = user.name;
          return acc;
        }, {}),
      },
      this.reset ? { mappings: {} } : existingSettings,
    );
    const mappings = data.mappings ?? {};
    const controllerOptions = this.#controllerOptions(mappings);
    data.controllerOptions = controllerOptions;
    data.playerRows = game.users.contents.map((user) => ({
      id: user.id,
      name: user.name,
      selectedColor: this.#colors.get(mappings[user.id]) ?? null,
      options: controllerOptions.map((option) => ({
        ...option,
        selected: option.id === mappings[user.id],
      })),
    }));
    return data;
  }

  async _updateObject(event, formData) {
    const newSettings = this._parseInputs(formData);
    const previousMappings = settings.settings.mappings ?? {};
    const submitted = Object.entries(newSettings.mappings ?? {}).filter(([, id]) => id);
    submitted.sort(([leftUser, leftId], [rightUser, rightId]) =>
      Number(leftId !== previousMappings[leftUser]) - Number(rightId !== previousMappings[rightUser]),
    );
    newSettings.mappings = {};
    for (const [userId, controllerId] of submitted) {
      for (const [otherUser, assignedId] of Object.entries(newSettings.mappings)) {
        if (assignedId === controllerId) delete newSettings.mappings[otherUser];
      }
      newSettings.mappings[userId] = controllerId;
    }

    await game.settings.set(VTT_MODULE_NAME, "settings", newSettings);
    this.#saved = true;

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
    this.#controllerOptions(settings.settings.mappings);
    for (const keypad of this.#connectedKeypads()) {
      if (!this.#previousRightLEDs.has(keypad)) {
        this.#previousRightLEDs.set(keypad, keypad.peekLEDs?.()[1] ?? null);
      }
      keypad.setLED(1, this.#colors.get(keypad.controllerId));
    }
    const selects = Array.from(
      html[0]?.querySelectorAll('select[name^="mappings["]') ?? [],
    ) as HTMLSelectElement[];
    const updateSwatch = (select: HTMLSelectElement) => {
      const swatch = select.closest(".form-group")?.querySelector("[data-controller-color]") as HTMLElement | null;
      if (!swatch) return;
      const color = this.#colors.get(select.value);
      swatch.hidden = !color;
      swatch.style.backgroundColor = color ?? "";
    };
    for (const select of selects) {
      updateSwatch(select);
      select.addEventListener("change", () => {
        if (select.value) {
          for (const other of selects) {
            if (other !== select && other.value === select.value) other.value = "";
          }
        }
        for (const row of selects) updateSwatch(row);
      });
    }
    this.reset = false;
  }

  async close(options = {}) {
    for (const [keypad, color] of this.#previousRightLEDs) {
      if (this.#saved) keypad.setDefaultLEDColor();
      else if (color) keypad.setLED(1, color);
      else keypad.setDefaultLEDColor?.();
    }
    this.#previousRightLEDs.clear();
    return super.close(options);
  }

  _onReset() {
    this.reset = true;
    this.render();
  }

  _parseInputs(data): Record<string, any> {
    var ret: Record<string, any> = {};
    retloop: for (var input in data) {
      var val = data[input];

      var parts = input.split("[");
      var last = ret;

      for (var i in parts) {
        var part = parts[i];
        if (part.substring(part.length - 1) == "]") {
          part = part.substring(0, part.length - 1);
        }

        if (Number(i) === parts.length - 1) {
          last[part] = val;
          continue retloop;
        } else if (!Object.hasOwn(last, part)) {
          last[part] = {};
        }
        last = last[part];
      }
    }
    return ret;
  }
}
