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
import { TABLE_LED_PRIORITY } from "../../settings/constants";
import { Rectangle, Vector } from "../../utils/2d-geometry";
import { hexToRgb } from "../../utils/color";
import AbstractSubModule from "../AbstractSubModule";
import TableLEDRing from "../tableLedRing";
import { TableLEDRingHandlerMixin } from "../tableLedRing/TableLEDRingHandlerMixin";

export default class Ambilight extends TableLEDRingHandlerMixin(
  AbstractSubModule
) {
  #enabled = true;
  #updateLEDsTimer = null;

  ready() {
    this.#enabled = game.canvas.initialized;
    this.tableLEDRing.registerHandler(this);
  }

  unhook() {
    this.#enabled = false;
    this.tableLEDRing.unregisterHandler(this);
    window.clearInterval(this.#updateLEDsTimer);
    super.unhook();
  }

  static get moduleDependencies() {
    return [...super.moduleDependencies, TableLEDRing.name];
  }

  /** @returns {TableLEDRing} */
  get tableLEDRing() {
    return this.instance.modules[TableLEDRing.name];
  }

  set enabled(value) {
    this.#enabled = game.canvas.initialized && value;
  }

  get priority() {
    if (this.#enabled) {
      return TABLE_LED_PRIORITY.AMBILIGHT;
    } else {
      return TABLE_LED_PRIORITY.OFF;
    }
  }

  async updateLEDs(count) {
    this.ensureLoaded();
    if (!this.#enabled || !this.instance.settings.ambilight.enabled) {
      return;
    }
    const pixelsRaw = await this.loadPixels();
    if (pixelsRaw !== null) {
      return this._compileLEDData(pixelsRaw, count);
    }
  }

  loadPixels() {
    return new Promise((resolve, reject) => {
      requestAnimationFrame(this._loadPixels.bind(this, resolve, reject));
    });
  }

  /**
   * Will only function correctly if called from within requestAnimationFrame()
   * @protected
   */
  _loadPixels(resolve, reject) {
    try {
      const gl = game.canvas.app.renderer.gl;
      const pixelsRaw = {
        image: new Uint8Array(
          gl.drawingBufferWidth * gl.drawingBufferHeight * 4 +
            gl.drawingBufferHeight
        ),
        drawingBufferWidth: gl.drawingBufferWidth,
        drawingBufferHeight: gl.drawingBufferHeight,
      };
      // bottom left of the screen is the origin
      gl.readPixels(
        0,
        0,
        gl.drawingBufferWidth,
        gl.drawingBufferHeight,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixelsRaw.image
      );
      resolve(pixelsRaw);
    } catch (e) {
      reject(e);
    }
  }

  /**
   * @protected
   */
  _compileLEDData(pixelsRaw, ledCount) {
    const brightMin = this.instance.settings.ambilight.brightness.min;
    const brightRange =
      (this.instance.settings.ambilight.brightness.max - brightMin) / 255;
    const ledState = new Uint32Array(ledCount * 3);
    const bounds = new Rectangle(
      new Vector(0, 0),
      new Vector(pixelsRaw.drawingBufferWidth, pixelsRaw.drawingBufferHeight)
    );
    const direction = new Vector(0, 1);
    let ledOffset = this.instance.settings.ambilight.led.offset % ledCount;
    if (ledOffset < 0) {
      ledOffset = ledOffset + ledCount;
    }
    const angle = -(2 * Math.PI) / ledCount;
    direction.rotate(angle * ledOffset);
    let totalColor = 0;
    for (let i = 0; i < ledCount; i++) {
      const ledIndex = i * 3;
      const imageIndex = this._findColorAlongVector(
        pixelsRaw.image,
        bounds,
        direction
      );
      totalColor +=
        pixelsRaw.image[imageIndex] +
        pixelsRaw.image[imageIndex + 1] +
        pixelsRaw.image[imageIndex + 2];
      ledState[ledIndex] =
        pixelsRaw.image[imageIndex] * brightRange + brightMin;
      ledState[ledIndex + 1] =
        pixelsRaw.image[imageIndex + 1] * brightRange + brightMin;
      ledState[ledIndex + 2] =
        pixelsRaw.image[imageIndex + 2] * brightRange + brightMin;
      direction.rotate(angle);
    }
    if (totalColor == 0) {
      return null;
    }
    return ledState;
  }

  /**
   * @protected
   */
  _findColorAlongVector(image, bounds, direction) {
    // scale vector so longer direction is length 1
    let backgroundColor;
    if (isNewerVersion(game.version, "10")) {
      backgroundColor = hexToRgb(game.scenes.active.backgroundColor);
    } else {
      backgroundColor = hexToRgb(game.scenes.active.data.backgroundColor);
    }
    direction.scale(1 / Math.max(Math.abs(direction.x), Math.abs(direction.y)));
    const scale = Math.floor(bounds.intersectionFromCenter(direction));
    for (let i = scale; i >= 0; i--) {
      const x = Math.floor(bounds.center.x + direction.x * i);
      const y = Math.floor(bounds.center.y + direction.y * i);
      const baseIndex = (x + y * bounds.p1.x) * 4;
      if (
        image[baseIndex] == backgroundColor.r &&
        image[baseIndex + 1] == backgroundColor.g &&
        image[baseIndex + 2] == backgroundColor.b
      ) {
        continue;
      } else if (
        image[baseIndex] != 0 ||
        image[baseIndex + 1] != 0 ||
        image[baseIndex + 2] != 0
      ) {
        return baseIndex;
      }
    }
    return Math.floor(bounds.center.x + bounds.center.y * bounds.p1.x) * 4;
  }
}
