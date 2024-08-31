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

export default class StartTimerDialog extends FormApplication {
  #result = null;

  constructor(options = {}) {
    super(
      {
        roles: window.CONST.USER_ROLES,
        durationHours: 0,
        durationMinutes: 0,
        durationSeconds: 0,
        neededRole: 0,
      },
      options
    );
    this.options.buttons.start.callback = this.startTimer.bind(this);
  }

  /**
   * @override
   * @returns {StartTimerDialogOptions}
   */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      title: game.i18n.localize("module.MindFlayer.StartTimerDialog.title"),
      id: "mindflayer-token-controller__start-timer-dialog",
      template:
        "modules/mindflayer-token-controller/templates/timer-start.html",
      classes: ["mindflayer-token-controller__start-timer-dialog"],
      width: 500,
      height: "auto",
      closeOnSubmit: true,
      jQuery: true,
      buttons: {
        start: {
          icon: '<i class="fas fa-check"></i>',
          label: game.i18n.localize(
            "module.MindFlayer.StartTimerDialog.button.start"
          ),
        },
        abort: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize(
            "module.MindFlayer.StartTimerDialog.button.abort"
          ),
        },
      },
      callbackResolve: (result) => {},
      callbackReject: (error) => {},
    });
  }

  /** @inheritdoc */
  get title() {
    return "Start Timer";
  }

  async _onSubmit(evt, options) {
    const result = super._onSubmit(evt, options);
    this.startTimer();
    return result;
  }

  /**
   * @inheritdoc
   * @override
   * @param {FormDataExtended} formData
   */
  async _updateObject(_event, formData) {
    this.object.durationHours = parseInt(formData.durationHours) || 0;
    this.object.durationMinutes = parseInt(formData.durationMinutes) || 0;
    this.object.durationSeconds = parseInt(formData.durationSeconds) || 0;
    this.object.neededRole = parseInt(formData.neededRole) || 0;
  }

  /** @inheritdoc */
  async close(options = {}) {
    await super.close(options);
    this.options.callbackResolve(this.#result);
  }

  startTimer() {
    const duration =
      this.object.durationHours * 3600000 +
      this.object.durationMinutes * 60000 +
      this.object.durationSeconds * 1000;
    const options = {
      neededRole: this.object.neededRole,
    };
    const now = new Date().valueOf();
    this.#result = {
      start: now,
      end: now + duration,
      options: options,
    };
  }

  static async getTimer() {
    return new Promise((resolve, reject) => {
      const dialog = new this({
        callbackResolve: resolve,
        callbackReject: reject,
      });
      dialog.render(true);
    });
  }
}
