import { hexToRgb } from "../../utils/color";
import AbstractSubModule from "../AbstractSubModule";
import Ambilight from "../ambilight";
import ControllerManager from "../ControllerManager";

const COMBAT_DURATION_TACTICAL_DISCUSSION = 60000; //ms
const COMBAT_DURATION_FORCED_DODGE = 7000; //ms

export default class CombatIndicator extends AbstractSubModule {
  #updateLEDsTimer = null;
  #running = false;
  #currentLED = 0;

  constructor(instance) {
    super(instance);

    Hooks.on("updateCombat", this.#handleCombatUpdate.bind(this));
  }

  unhook() {
    if (this.#updateLEDsTimer !== null) {
      window.clearInterval(this.#updateLEDsTimer);
      this.#updateLEDsTimer = null;
    }
    this.#running = false;
    super.unhook();
  }

  static get moduleDependencies() {
    return [
      ...super.moduleDependencies,
      ControllerManager.name,
      AmbientLight.name,
    ];
  }

  /**
   * @returns {ControllerManager}
   */
  get controllerManager() {
    return this.instance.modules[ControllerManager.name];
  }

  /**
   * @returns {Ambilight}
   */
  get ambilight() {
    return this.instance.modules[Ambilight.name];
  }

  /**
   *
   * @param {Combat} combat
   * @param {Combat} update
   */
  async #handleCombatUpdate(combat, update) {
    if (this.#running === false) {
      if (combat.started === true) {
        this.#startTacticalTimer(
          this.#handleCombatUpdate.bind(this, combat, {}),
          COMBAT_DURATION_TACTICAL_DISCUSSION
        );
        this.#running = true;
      }
      return;
    }
    if (update.hasOwnProperty("round") && update.turn === 0) {
      this.#startTacticalTimer(
        this.#handleCombatUpdate.bind(this, combat, { turn: update.turn }),
        COMBAT_DURATION_TACTICAL_DISCUSSION
      );
      return;
    } else if (update.hasOwnProperty("turn") && update.turn !== null) {
      const turn = combat.turn;
      const turns = combat.turns;
      const keypads = {};
      this.controllerManager.keypads.forEach((keypad) => {
        const player = keypad.player;
        if(player) {
          keypads[player.id] = keypad;
        }
      });
      let state = -1;
      for (let i = 0; i < turns.length; i++) {
        if (this.instance.settings.skipDefeated && turns[i].isDefeated) {
          continue;
        }
        turns[i].players.forEach((player) => {
          if(!(player.id in keypads)) {
            return;
          }
          const keypad = keypads[player.id];
          switch (state) {
            case -1:
              // keypads that had their turn colored green
              keypad.setLED(1, "#00FF00");
              state++;
              break;
            case 0:
              // keyboard with turn active colored red
              keypad.setLED(1, "#FF0000");
              state++;
              break;
            case 1:
              // keyboard who is up next colored yellow
              keypad.setLED(1, "#FFFF00");
              this.#startTacticalTimer(() => {}, COMBAT_DURATION_FORCED_DODGE);
              state++;
              break;
            default:
              // keyboards with outstanding turn colored player.color
              keypads[player.id]?.setLED(1, player.data.color);
              break;
          }
        });
      }
    }
  }
  async #startTacticalTimer(updateCombatCallback, timeInMS) {
    const totalLEDs = this.instance.settings.ambilight.led.count;
    if (this.#updateLEDsTimer !== null) {
      window.clearInterval(this.#updateLEDsTimer);
    }
    if (totalLEDs <= 0) {
      window.setTimeout(updateCombatCallback, timeInMS);
    } else {
      this.ambilight.enabled = false;
      this.#updateLEDsTimer = window.setInterval(
        this.#updateLEDs.bind(this, updateCombatCallback),
        Math.floor(timeInMS / totalLEDs)
      );
      this.#currentLED = 0;
      this.#updateLEDs(updateCombatCallback);
    }
  }

  async #finishTacticalTimer(callback) {
    this.ambilight.enabled = true;
    window.clearInterval(this.#updateLEDsTimer);
    this.#updateLEDsTimer = null;
    callback();
  }

  #updateLEDs(callback) {
    const total = this.instance.settings.ambilight.led.count;
    const totalValues = total * 3;
    const offset = this.instance.settings.ambilight.led.offset;
    const minBright = this.instance.settings.ambilight.brightness.min;
    const remaining = total - this.#currentLED;
    const completion = remaining / total;
    const leds = [];
    let color;
    this.#currentLED++;
    if (completion > 2 / 3) {
      color = hexToRgb("#00FF00");
    } else if (completion > 1 / 3) {
      color = hexToRgb("#FFFF00");
    } else if (remaining <= 0) {
      return this.#finishTacticalTimer(callback);
    } else {
      color = hexToRgb("#FF0000");
    }
    for (let i = 0; i < total; i++) {
      if (i < remaining) {
        leds[(offset + i * 3 + 0) % totalValues] = color.r;
        leds[(offset + i * 3 + 1) % totalValues] = color.g;
        leds[(offset + i * 3 + 2) % totalValues] = color.b;
      } else {
        leds[(offset + i * 3 + 0) % totalValues] = minBright;
        leds[(offset + i * 3 + 1) % totalValues] = minBright;
        leds[(offset + i * 3 + 2) % totalValues] = minBright;
      }
    }
    this.ambilight.sendAmbilightData(leds);
  }
}
