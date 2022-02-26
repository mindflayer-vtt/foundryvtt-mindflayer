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
import AbstractSubModule from "../AbstractSubModule";
import * as TokenUtil from "../../utils/tokenUtil";
import { default as ControllerManager } from "../ControllerManager";
import { LOG_PREFIX, VTT_MODULE_NAME } from "../../settings/constants";

const WRAP_Token_setPosition = "Token.prototype.setPosition";
export default class CameraControl extends AbstractSubModule {
  constructor(instance) {
    super(instance);
  }

  ready() {
    let $this = this;
    console.debug(
      LOG_PREFIX +
        "overriding camera pan to focus on all player tokens instead of the current moved one."
    );
    libWrapper.register(
      VTT_MODULE_NAME,
      WRAP_Token_setPosition,
      async function wrapperTokenSetPosition(wrapped, ...args) {
        return await $this.#Token_setPosition(this, wrapped, ...args);
      },
      libWrapper.MIXED
    );
  }

  unhook() {
    libWrapper.unregister(VTT_MODULE_NAME, WRAP_Token_setPosition);
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, ControllerManager.name];
  }

  /**
   * @returns {ControllerManager}
   */
  get controllerManager() {
    return this.instance.modules[ControllerManager.name];
  }

  async #Token_setPosition(token, wrapped, x, y, { animate = true } = {}) {
    let cameraControl = this.instance.settings.camera.control;
    if (cameraControl == "off" || cameraControl == "focusPlayers") {
      // Create a Ray for the requested movement
      let origin = token._movement ? token.position : token._validPosition,
        target = { x: x, y: y },
        isVisible = token.isVisible;

      // Create the movement ray
      let ray = new Ray(origin, target);

      // Update the new valid position
      token._validPosition = target;

      // Record the Token's new velocity
      token._velocity = token._updateVelocity(ray);

      // Update visibility for a non-controlled token which may have moved into the controlled tokens FOV
      token.visible = isVisible;

      // Conceal the HUD if it targets this Token
      if (token.hasActiveHUD) token.layer.hud.clear();

      // Either animate movement to the destination position, or set it directly if animation is disabled
      if (animate) await token.animateMovement(new Ray(token.position, ray.B));
      else token.position.set(x, y);

      // Re-center the view on all players if the moved token is visible
      if (cameraControl == "focusPlayers" && isVisible) {
        this.panCamera();
      }

      return token;
    }

    // use default camera control behavior for token movement
    return await wrapped(x, y, ({ animate = true } = {}));
  }

  panCamera() {
    const sceneSize = canvas.scene.dimensions.sceneRect;
    const gridSize = canvas.scene.dimensions.size;
    let activeCharacterTokens = TokenUtil.getAllCombatTokens();
    activeCharacterTokens.push(
      ...this.controllerManager.keypads.map((keypad) => keypad.token)
    );
    activeCharacterTokens = activeCharacterTokens.filter(
      (token) => token !== null
    );
    if (activeCharacterTokens.length <= 0) {
      console.warn(
        LOG_PREFIX +
          "No active character tokens found. Automatic camera panning only works with active controllers that belong to a player with a character token in the same scene."
      );
      return;
    }
    activeCharacterTokens = activeCharacterTokens.filter((token) =>
      token.combatant
        ? !token.combatant.data.hidden && !token.combatant.data.defeated
        : true
    );

    const pad = gridSize * (30 / 5);
    const lowestXCoordinate = Math.max(
      Math.min(...activeCharacterTokens.map((token) => token.x)) - pad,
      sceneSize.x
    );
    const highestXCoordinate = Math.min(
      Math.max(...activeCharacterTokens.map((token) => token.x + token.w)) +
        pad,
      sceneSize.x + sceneSize.width
    );

    const lowestYCoordinate = Math.max(
      Math.min(...activeCharacterTokens.map((token) => token.y)) - pad,
      sceneSize.y
    );
    const highestYCoordinate = Math.min(
      Math.max(...activeCharacterTokens.map((token) => token.y + token.h)) +
        pad,
      sceneSize.y + sceneSize.height
    );

    const boundingbox = {
      width: highestXCoordinate - lowestXCoordinate,
      height: highestYCoordinate - lowestYCoordinate,
    };
    const boundingWidthScale = window.innerWidth / boundingbox.width;
    const boundingHeightScale = window.innerHeight / boundingbox.height;
    let scale = Math.min(boundingWidthScale, boundingHeightScale);
    const sceneWidthScale = window.innerWidth / sceneSize.width;
    const sceneHeightScale = window.innerHeight / sceneSize.height;
    const sceneScaleMin = Math.min(sceneWidthScale, sceneHeightScale);
    scale = Math.max(sceneScaleMin, scale);

    let targetXCoordinate =
      lowestXCoordinate + (highestXCoordinate - lowestXCoordinate) / 2;
    let targetYCoordinate =
      lowestYCoordinate + (highestYCoordinate - lowestYCoordinate) / 2;
    const minPadX = (window.innerWidth * scale) / 2;
    targetXCoordinate = Math.max(
      sceneSize.x + minPadX,
      Math.min(targetXCoordinate, sceneSize.x + sceneSize.width - minPadX)
    );
    const minPadY = (window.innerHeight * scale) / 2;
    targetYCoordinate = Math.max(
      sceneSize.y + minPadY,
      Math.min(targetYCoordinate, sceneSize.y + sceneSize.height - minPadY)
    );

    const cameraSettings = {
      x: targetXCoordinate,
      y: targetYCoordinate,
      scale: scale,
      duration: 1000,
    };
    console.debug(
      LOG_PREFIX +
        "Readjusting view to fit all player tokens on screen... Centering on: ",
      cameraSettings
    );
    canvas.animatePan(cameraSettings);
  }
}
