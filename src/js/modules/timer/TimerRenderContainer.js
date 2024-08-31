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
import { TIMER_RADIUS } from "./TimerRunner";

const TIMER_DIAMETER = TIMER_RADIUS * 2;
const MARGIN_BETWEEN_TIMERS = 10;
const MARGIN_BOTTOM = 60;

export class TimerRenderContainer extends PIXI.Container {
  constructor() {
    super();
    this.name = "Timer Renderer Container";
    Hooks.on("canvasPan", this.onChildrenChange.bind(this));
  }

  /**
   * Reposition children
   * @override
   */
  onChildrenChange(_count) {
    /** @type {PIXI.Transform} */
    const wt = canvas.stage.worldTransform;
    const invertedScale = 1 / this.parent.scale.x;
    let timerSize = TIMER_DIAMETER + MARGIN_BETWEEN_TIMERS;
    const totalSize = this.children.length * timerSize - MARGIN_BETWEEN_TIMERS;
    /** @type {PIXI.Rectangle} */
    const screen = canvas.app.renderer.screen;
    const screenSize = canvas.app.screen;
    const base = wt.applyInverse(
      new PIXI.Point(
        screen.left + (screenSize.width - totalSize) / 2,
        screen.top + screenSize.height - (MARGIN_BOTTOM + TIMER_DIAMETER)
      )
    );

    let i = 0;
    for (const timer of this.children) {
      timer.position.x = base.x + i * timerSize * this.parent.scale.x;
      timer.position.y = base.y;
      timer.scale.set(invertedScale, invertedScale);
      i++;
    }
  }
}
