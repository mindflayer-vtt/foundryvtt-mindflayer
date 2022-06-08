import { COLORS } from "../../utils/color";
import AbstractSubModule from "../AbstractSubModule";
import ControllerManager from "../ControllerManager";
import Keypad from "../ControllerManager/Keypad";
import Timer from "../timer";

const COMBAT_DURATION_TACTICAL_DISCUSSION = 60000; //ms
const COMBAT_DURATION_FORCED_DODGE = 7000; //ms

export default class CombatIndicator extends AbstractSubModule {
  #updateLEDsTimer = null;
  #running = false;

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
    const currentTurn = combat.current.turn;
    if (this.#running === false) {
      if (combat.started === true) {
        this.#running = true;
        this.#startTacticalTimer(
          this.#handleCombatUpdate.bind(this, combat, { turn: update.turn }),
          this.instance.settings.combatIndicator.tacticalDiscussionDuration *
            1000
        );
      }
      return;
    }
    if (update.hasOwnProperty("round") && currentTurn === 0) {
      this.#startTacticalTimer(
        this.#handleCombatUpdate.bind(this, combat, { turn: update.turn }),
        this.instance.settings.combatIndicator.tacticalDiscussionDuration * 1000
      );
      return;
    } else if (update.hasOwnProperty("turn") && update.turn !== null) {
      const turns = combat.turns;
      /** @type {Map<string, Keypad>} */
      const keypads = new Map();
      this.controllerManager.keypads.forEach((keypad) => {
        const player = keypad.player;
        if (player) {
          keypads.set(player.id, keypad);
        }
      });
      let hasNext = false;
      /** @type {Keypad} */
      let firstKeypad = null;
      for (let i = 0; i < turns.length; i++) {
        if (this.instance.settings.skipDefeated && turns[i].isDefeated) {
          continue;
        }
        turns[i].players.forEach((player) => {
          if (!keypads.has(player.id)) {
            return;
          }
          /** @type {Keypad} */
          const keypad = keypads.get(player.id);
          if (!firstKeypad) {
            firstKeypad = keypad;
          }
          if (i == currentTurn) {
            // keyboard with turn active colored red
            keypad.setLED(1, COLORS.RED);
            this.#startTacticalTimer(() => {},
            this.instance.settings.combatIndicator.playerReactionTime * 1000);
          } else if (i > currentTurn) {
            if (!hasNext) {
              // keyboard who is up next colored yellow
              keypad.setLED(1, COLORS.YELLOW);
              hasNext = true;
            } else {
              // keyboards with outstanding turn colored green
              keypad.setLED(1, COLORS.GREEN);
            }
          } else {
            // keypads that had their turn colored player.color
            keypad.setDefaultLEDColor();
          }
        });
      }
      if (!hasNext && firstKeypad) {
        // next player is in the next round
        firstKeypad.setLED(1, "#FFFF00");
      }
    }
  }

  async #startTacticalTimer(updateCombatCallback, timeInMS) {
    if (timeInMS <= 0) {
      return updateCombatCallback();
    }
    const start = new Date().valueOf();
    return this.timer.addTimer({
      start: start,
      end: start + timeInMS,
      options: {
        onDone: updateCombatCallback,
      },
    });
  }
}
