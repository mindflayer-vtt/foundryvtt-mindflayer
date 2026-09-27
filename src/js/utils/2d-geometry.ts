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

export class Vector {
  x = 0;
  y = 0;

  /**
   * @param {number} x
   * @param {number} y
   */
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  length() {
    return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
  }

  normalize() {
    const length = this.length();
    this.x /= length;
    this.y /= length;
    return this;
  }

  /**
   * @param {number} fact factor by which to scale
   * @returns this object
   */
  scale(fact) {
    this.x *= fact;
    this.y *= fact;
    return this;
  }

  rotate(rad) {
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const x = cos * this.x - sin * this.y;
    this.y = sin * this.x + cos * this.y;
    this.x = x;
    return this;
  }

  subtract(vector) {
    return new Vector(this.x - vector.x, this.y - vector.y);
  }

  add(vector) {
    return new Vector(this.x + vector.x, this.y + vector.y);
  }
}

export class Rectangle {
  p0 = null;
  p1 = null;
  center = null;

  constructor(p0, p1) {
    this.p0 = new Vector(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y));
    this.p1 = new Vector(Math.max(p0.x, p1.x), Math.max(p0.y, p1.y));
    this.center = this.p1.subtract(this.p0).scale(0.5).add(this.p0);
  }

  static fromBounds(bounds) {
    return new Rectangle(
      new Vector(bounds.left, bounds.bottom),
      new Vector(bounds.right, bounds.top),
    );
  }

  intersectionFromCenter(direction) {
    if (direction.y != 0) {
      const interFact = Math.abs((this.p1.y - this.center.y - 1) / direction.y);
      const interX = direction.x * interFact + this.center.x;
      if (interX >= this.p0.x && interX <= this.p1.x) {
        return interFact;
      }
    }
    if (direction.x != 0) {
      const interFact = Math.abs((this.p1.x - this.center.x - 1) / direction.x);
      const interY = direction.y * interFact + this.center.y;
      if (interY >= this.p0.y && interY <= this.p1.y) {
        return interFact;
      }
    }
    console.error("(0,0) vector?", direction);
    return 1;
  }

  /**
   * Check if this Rectangle intersects another Rectangle
   *
   * @param {Rectangle} rect2 the second Rectangle
   * @returns true if the given Rectangle intersect with this one
   */
  intersect(rect2) {
    return !(
      rect2.p0.x > this.p1.x ||
      rect2.p1.x < this.p0.x ||
      rect2.p1.y < this.p0.y ||
      rect2.p0.y > this.p1.y
    );
  }
}

export function deg2rad(degrees) {
  return (degrees * Math.PI) / 180;
}
