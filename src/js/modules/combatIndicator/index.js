import { COLORS } from "../../utils/color";
import AbstractSubModule from "../AbstractSubModule";
import ControllerManager from "../ControllerManager";
import Timer from "../timer";
import { VTT_MODULE_NAME } from "../../settings/constants";

const WRAP_Combat_endCombat = "Combat.prototype.endCombat";

export default class CombatIndicator extends AbstractSubModule {
  #updateLEDsTimer = null;
  #running = false;

  #boundHandleCombatUpdate = this.#handleCombatUpdate.bind(this);

  constructor(instance) {
    super(instance);

    Hooks.on("startCombat", this.#boundHandleCombatUpdate);
    Hooks.on("updateCombat", this.#boundHandleCombatUpdate);

    libWrapper.register(
      VTT_MODULE_NAME,
      WRAP_Combat_endCombat,
      this.#endCombatWrapper.bind(this),
      libWrapper.WRAPPER
    );
  }

  unhook() {
    if (this.#updateLEDsTimer !== null) {
      window.clearInterval(this.#updateLEDsTimer);
      this.#updateLEDsTimer = null;
    }
    Hooks.off("updateCombat", this.#boundHandleCombatUpdate);
    Hooks.off("startCombat", this.#boundHandleCombatUpdate);
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
    if (Object.hasOwn(update,"round") && currentTurn === 0) {
      this.#startTacticalTimer(
        this.#handleCombatUpdate.bind(this, combat, { turn: update.turn }),
        this.instance.settings.combatIndicator.tacticalDiscussionDuration * 1000
      );
      return;
    } else if (Object.hasOwn(update, "turn") && update.turn !== null) {
      const turns = combat.turns;
      /** @type {Map<string, Keypad>} */
      const keypads = new Map();
      for(const keypad of this.controllerManager.keypads) {
        const player = keypad.player;
        if (player) {
          keypads.set(player.id, keypad);
        }
      }
      let hasNext = false;
      /** @type {Keypad} */
      let firstKeypad = null;
      for (let i = 0; i < turns.length; i++) {
        if (this.instance.settings.skipDefeated && turns[i].isDefeated) {
          continue;
        }
        for (const player of turns[i].players){
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
            keypad.setLED(1, COLORS.OFF);
          }
        }
      }
      if (!hasNext && firstKeypad) {
        // next player is in the next round
        firstKeypad.setLED(1, COLORS.YELLOW);
      }
    }
  }

  /**
   * Reset the keypad LEDs to their default color after combat ends.
   *
   * @param {Function} wrapped
   * @returns {Promise<string>}
   * @see: Combat.endCombat
   */
  async #endCombatWrapper(wrapped) {
    const result = await wrapped();
    if(result !== false) {
      for(const keypad of this.controllerManager.keypads) {
        keypad.setDefaultLEDColor();
      }
    }
    return result;
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
