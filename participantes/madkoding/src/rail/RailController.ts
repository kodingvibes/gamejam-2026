// ─── Rail Controller ──────────────────────────────────────────────────────────

import * as THREE from 'three';
import { RAIL } from '../types/config';

export interface RailPosition {
  position: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  tangent: THREE.Vector3;
}

export class RailController {
  private curve: THREE.CatmullRomCurve3;
  private _progress = 0;
  private _lateralOffset = 0;
  private _targetLateral = 0;
  private _verticalOffset = 0;
  private _targetVertical = 0;
  private _speed: number;
  private totalLength: number;

  constructor(waypoints: THREE.Vector3[], speed = RAIL.RAIL_SPEED) {
    this.curve = new THREE.CatmullRomCurve3(waypoints);
    this.totalLength = this.curve.getLength();
    this._speed = speed;
  }

  get speed(): number {
    return this._speed;
  }

  set speed(value: number) {
    this._speed = value;
  }

  addLateralInput(delta: number): void {
    this._targetLateral = THREE.MathUtils.clamp(
      this._targetLateral + delta,
      -RAIL.LATERAL_LIMIT,
      RAIL.LATERAL_LIMIT
    );
  }

  addVerticalInput(delta: number): void {
    this._targetVertical = THREE.MathUtils.clamp(
      this._targetVertical + delta,
      -RAIL.VERTICAL_LIMIT,
      RAIL.VERTICAL_LIMIT
    );
  }

  update(dt: number): void {
    this._progress += (this._speed * dt) / this.totalLength;
    this._progress = THREE.MathUtils.clamp(this._progress, 0, 1);
    this._lateralOffset = THREE.MathUtils.lerp(this._lateralOffset, this._targetLateral, RAIL.LATERAL_LERP_SPEED * dt);
    this._verticalOffset = THREE.MathUtils.lerp(this._verticalOffset, this._targetVertical, RAIL.VERTICAL_LERP_SPEED * dt);
  }

  getWorldPosition(): RailPosition {
    const point = this.curve.getPoint(this._progress);
    const tangent = this.curve.getTangent(this._progress).normalize();

    // Calculate right vector from tangent and world up
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();

    // Apply lateral offset along the right vector and vertical offset along the up vector
    const position = point
      .clone()
      .add(right.clone().multiplyScalar(this._lateralOffset))
      .add(up.clone().multiplyScalar(this._verticalOffset));

    return {
      position,
      forward: tangent.clone(), // Direction of travel
      up,
      tangent,
    };
  }

  reset(): void {
    this._progress = 0;
    this._lateralOffset = 0;
    this._targetLateral = 0;
    this._verticalOffset = 0;
    this._targetVertical = 0;
  }
}
