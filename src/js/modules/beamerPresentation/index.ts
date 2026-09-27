import AbstractSubModule from "../AbstractSubModule";
import CameraControl from "../cameraControl";
import Fullscreen from "../fullscreen";
import { isBeamerUser } from "../../utils/beamer";
import { LOG_PREFIX, VTT_MODULE_NAME } from "../../settings/constants";
import type MindFlayer from "../../MindFlayer";

const SUB_LOG_PREFIX = `${LOG_PREFIX}BeamerPresentation: `;

/** Apply presentation-only client settings after the selected Beamer user logs in. */
export default class BeamerPresentation extends AbstractSubModule {
  #canvasReady: null | (() => void) = null;

  static shouldStart(): boolean {
    return isBeamerUser();
  }

  static get moduleDependencies(): string[] {
    return [...super.moduleDependencies, CameraControl.name, Fullscreen.name];
  }

  constructor(instance: MindFlayer) {
    super(instance);
  }

  get fullscreen(): Fullscreen {
    return Reflect.get(this.instance!.modules, Fullscreen.name) as Fullscreen;
  }

  ready() {
    void this.#configure().catch(() => {
      console.warn(SUB_LOG_PREFIX + "could not apply the managed Beamer client settings");
    });
  }

  unhook() {
    if (this.#canvasReady !== null) Hooks.off("canvasReady", this.#canvasReady);
    this.#canvasReady = null;
    super.unhook();
  }

  async #configure() {
    if (!isBeamerUser()) return;
    if (game.settings.get(VTT_MODULE_NAME, "cameraControl") !== "focusPlayers") {
      await game.settings.set(VTT_MODULE_NAME, "cameraControl", "focusPlayers");
    }
    if (game.settings.get(VTT_MODULE_NAME, "enabled") !== true) {
      // Its existing onChange performs the one required reload. On the next
      // ready hook every enabled submodule is present before fullscreen starts.
      await game.settings.set(VTT_MODULE_NAME, "enabled", true);
      return;
    }
    this.#enableFullscreenWhenReady();
  }

  #enableFullscreenWhenReady() {
    if (game.canvas?.initialized) {
      this.fullscreen.enabled = true;
      return;
    }
    this.#canvasReady = () => {
      this.#canvasReady = null;
      if (this.loaded && isBeamerUser()) this.fullscreen.enabled = true;
    };
    Hooks.once("canvasReady", this.#canvasReady);
  }
}
