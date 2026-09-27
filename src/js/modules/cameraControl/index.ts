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
import { isBeamerUser } from "../../utils/beamer";
import type MindFlayer from "../../MindFlayer";

const SUB_LOG_PREFIX = `${LOG_PREFIX}CameraControl: `;

const WRAP_Token__onUpdate =
  "foundry.canvas.placeables.Token.prototype._onUpdate";

interface CameraToken {
  bounds: { left: number; right: number; top: number; bottom: number };
  combatant?: { hidden: boolean; defeated: boolean } | null;
}

export default class CameraControl extends AbstractSubModule {
  static shouldStart(instance: MindFlayer): boolean {
    return super.shouldStart(instance) || isBeamerUser();
  }

  constructor(instance: MindFlayer) {
    super(instance);
  }

  ready() {
    let $this = this;
    if (game.canvas.initialized) {
      console.info(
        SUB_LOG_PREFIX +
          "overriding camera pan to focus on all player tokens instead of the current moved one.",
      );
      libWrapper.register(
        VTT_MODULE_NAME,
        WRAP_Token__onUpdate,
        async function wrapperToken_onUpdate(
          wrapped: Function,
          changed: unknown,
          options: { pan?: boolean },
          userId: unknown,
        ) {
          let cameraControl = $this.instance!.settings.camera.control;
          if (cameraControl == "off" || cameraControl == "focusPlayers") {
            if (cameraControl == "focusPlayers") {
              $this.panCamera();
            }
            options.pan = false;
          }
          return wrapped(changed, options, userId);
        },
        libWrapper.MIXED,
      );
    } else {
      console.info(SUB_LOG_PREFIX + "canvas is disabled, so no camera control");
    }
  }

  unhook() {
    libWrapper.unregister(VTT_MODULE_NAME, WRAP_Token__onUpdate);
    super.unhook();
  }

  static get moduleDependencies(): string[] {
    return [...super.moduleDependencies, ControllerManager.name];
  }

  get controllerManager(): ControllerManager {
    return Reflect.get(this.instance!.modules, ControllerManager.name) as ControllerManager;
  }

  panCamera() {
    const sceneSize = canvas.scene.dimensions.sceneRect;
    const gridSize = canvas.scene.dimensions.size;
    const activeCharacterTokens: Array<CameraToken | null> =
      TokenUtil.getAllCombatTokens() as CameraToken[];
    activeCharacterTokens.push(
      ...this.controllerManager.keypads.map((keypad) => keypad.token),
    );
    activeCharacterTokens.push(...canvas.tokens.controlled);
    const nonNullTokens = activeCharacterTokens.filter(
      (token): token is CameraToken => token !== null,
    );
    if (nonNullTokens.length <= 0) {
      console.warn(
        LOG_PREFIX +
          "No active character tokens found. Automatic camera panning only works with active controllers that belong to a player with a character token in the same scene.",
      );
      return;
    }
    const includedTokens = nonNullTokens.filter(function (token) {
      if (!token) {
        return false;
      }
      if (!Object.hasOwn(token, "combatant")) {
        return true;
      }
      return !token.combatant!.hidden && !token.combatant!.defeated;
    });

    const pad = gridSize * (30 / 5);
    const lowestXCoordinate = Math.max(
      Math.min(...includedTokens.map((token) => token.bounds.left)) - pad,
      sceneSize.x,
    );
    const highestXCoordinate = Math.min(
      Math.max(...includedTokens.map((token) => token.bounds.right)) +
        pad,
      sceneSize.x + sceneSize.width,
    );

    const lowestYCoordinate = Math.max(
      Math.min(...includedTokens.map((token) => token.bounds.top)) - pad,
      sceneSize.y,
    );
    const highestYCoordinate = Math.min(
      Math.max(...includedTokens.map((token) => token.bounds.bottom)) +
        pad,
      sceneSize.y + sceneSize.height,
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
    targetXCoordinate = Math.max(
      sceneSize.x + pad,
      Math.min(targetXCoordinate, sceneSize.x + sceneSize.width - pad),
    );
    targetYCoordinate = Math.max(
      sceneSize.y + pad,
      Math.min(targetYCoordinate, sceneSize.y + sceneSize.height - pad),
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
      cameraSettings,
    );
    canvas.animatePan(cameraSettings);
  }
}
