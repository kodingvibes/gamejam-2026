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
  private _speed: number;
  private totalLength: number;
  // Camera-driven parallax offset in world units; set by Game from PlayerShip.
  private _screenOffsetX = 0;
  private _screenOffsetY = 0;
  private _scratchPoint = new THREE.Vector3();
  private _scratchTangent = new THREE.Vector3();
  private _scratchRight = new THREE.Vector3();
  private _scratchUp = new THREE.Vector3();
  private _scratchPos = new THREE.Vector3();
  private static readonly _worldUp = new THREE.Vector3(0, 1, 0);

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

  /** Rail travel progress, 0 (start) → 1 (end of the stage path + arena). */
  get progress(): number {
    return this._progress;
  }

  /** Progress through the STAGE portion only (boss arena excluded). */
  get stageProgress(): number {
    return Math.min(1, this._progress * RAIL.ARENA_EXTENSION);
  }

  get length(): number {
    return this.totalLength;
  }

  /** The underlying Catmull-Rom curve, so environment systems (e.g. tunnel
   *  walls) can follow the same winding path the ship flies. */
  getCurve(): THREE.CatmullRomCurve3 {
    return this.curve;
  }

  /**
   * Camera parallax offset in world units. This lets the ship appear to move
   * across the screen even though the rail curve is the true travel path.
   */
  setScreenOffset(x: number, y: number): void {
    this._screenOffsetX = x;
    this._screenOffsetY = y;
  }

  update(dt: number): void {
    this._progress += (this._speed * dt) / this.totalLength;
    this._progress = THREE.MathUtils.clamp(this._progress, 0, 1);
  }

  // Rail base position WITHOUT screen offset — used by the camera so it
  // advances smoothly and doesn't chase the player's screen movement.
  getRailPosition(): RailPosition {
    return this._getPosition(0, 0);
  }

  // Full ship world position WITH screen offset applied.
  getWorldPosition(): RailPosition {
    return this._getPosition(this._screenOffsetX, this._screenOffsetY);
  }

  private _getPosition(offsetX: number, offsetY: number): RailPosition {
    // Arc-length parameterisation: progress is distance-based, so use the
    // *At variants for constant speed along the whole curve.
    const point = this.curve.getPointAt(this._progress, this._scratchPoint);
    const tangent = this.curve.getTangentAt(this._progress, this._scratchTangent).normalize();

    // Calculate right vector from tangent and world up
    const worldUp = RailController._worldUp;
    const right = this._scratchRight.crossVectors(tangent, worldUp).normalize();
    const up = this._scratchUp.crossVectors(right, tangent).normalize();

    const position = this._scratchPos
      .copy(point)
      .addScaledVector(right, offsetX)
      .addScaledVector(up, offsetY);

    return {
      // Fresh vector: callers hold this across the frame and getRailPosition()
      // + getWorldPosition() both run in the same frame, so it must not alias
      // the shared scratch buffer.
      position: position.clone(),
      forward: tangent.clone(), // Direction of travel
      up: up.clone(),
      tangent: tangent.clone(),
    };
  }

  /** Rail frame `dist` world units ahead of the current progress. */
  frameAhead(dist: number): { position: THREE.Vector3; forward: THREE.Vector3; up: THREE.Vector3; right: THREE.Vector3 } {
    const t = THREE.MathUtils.clamp(this._progress + dist / this.totalLength, 0, 1);
    const position = this.curve.getPointAt(t, new THREE.Vector3());
    const forward = this.curve.getTangentAt(t, new THREE.Vector3()).normalize();
    const right = new THREE.Vector3().crossVectors(forward, RailController._worldUp).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    return { position, forward, up, right };
  }

  reset(): void {
    this._progress = 0;
    this._screenOffsetX = 0;
    this._screenOffsetY = 0;
  }
}
