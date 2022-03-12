import { hexToRgb } from "../../utils/color";
import AbstractSubModule from "../AbstractSubModule";
import Ambilight from "../ambilight";
import ControllerManager from "../ControllerManager";
import Keypad from "../ControllerManager/Keypad";
import Timer from "../timer";
import TimerRunner from "../timer/TimerRunner";

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
    return [...super.moduleDependencies, ControllerManager.name, Timer.name];
  }

  /**
   * @returns {ControllerManager}
   */
  get controllerManager() {
    return this.instance.modules[ControllerManager.name];
  }

  /**
   * @returns {Timer}
   */
  get timer() {
    return this.instance.modules[Timer.name];
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
      /** @type {Map<string, Keypad>} */
      const keypads = {};
      this.controllerManager.keypads.forEach((keypad) => {
        const player = keypad.player;
        if (player) {
          keypads[player.id] = keypad;
        }
      });
      let state = -1;
      for (let i = 0; i < turns.length; i++) {
        if (this.instance.settings.skipDefeated && turns[i].isDefeated) {
          continue;
        }
        turns[i].players.forEach((player) => {
          if (!(player.id in keypads)) {
            return;
          }
          /** @type {Keypad} */
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
    const start = new Date().valueOf();
    this.timer.addTimer({
      start: start,
      end: start + timeInMS,
      options: {
        onDone: updateCombatCallback,
      },
    });
  }
}
