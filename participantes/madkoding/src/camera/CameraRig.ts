// ─── Camera Rig (On-Rails Chase with Free Screen-Space Ship) ───────────────
//
// The camera rides the rail path independently of the player's screen-space
// movement. It only knows the rail base position, not the ship's lateral/vertical
// screen offset. This lets the ship slide freely around the viewport while the
// camera stays smooth and forward-looking, exactly like Starfox.
//
// Shake is trauma-based (Squirrel Eiserloh's GDC talk): trauma 0..1 decays
// linearly, the visible shake is trauma² driven by smooth noise, applied as
// both translation and rotation so hits feel physical instead of jittery.

import * as THREE from 'three';
import { CAMERA } from '../types/config';

// Cheap smooth 1D noise: sum of sines with irrational frequencies.
function smoothNoise(t: number, seed: number): number {
  return (
    Math.sin(t * 1.0 + seed) * 0.5 +
    Math.sin(t * 2.3 + seed * 1.7) * 0.3 +
    Math.sin(t * 5.1 + seed * 2.9) * 0.2
  );
}

export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  // Same pose as the render camera but without shake / FOV kicks. Gameplay
  // (screen→world mapping, aiming) uses this so effects never move the ship.
  readonly stable: THREE.PerspectiveCamera;
  private trauma = 0;
  private shakeTime = 0;

  private _chasePos = new THREE.Vector3();
  private _chaseLook = new THREE.Vector3();
  private _desired = new THREE.Vector3();
  private _desiredLook = new THREE.Vector3();
  private _right = new THREE.Vector3();
  private _initialized = false;
  private _roll = 0;
  private _rollTarget = 0;
  private _pitch = 0;
  private _pitchTarget = 0;

  // Attract-mode orbit (menu)
  private _orbitAngle = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);
    this.camera.position.set(0, 4, 10);
    this.camera.lookAt(0, 0, -10);
    this.stable = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);
    this.syncStable();
  }

  private syncStable(): void {
    this.stable.position.copy(this.camera.position);
    this.stable.quaternion.copy(this.camera.quaternion);
    this.stable.updateMatrixWorld(true);
  }

  get camera3D(): THREE.PerspectiveCamera {
    return this.camera;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.stable.aspect = aspect;
    this.stable.updateProjectionMatrix();
  }

  // `railPos` is the base rail position WITHOUT the player's screen offset.
  // `shipOffset` is the player's world-space offset from the rail, used only
  // for subtle banking feedback.
  setTarget(railPos: { position: THREE.Vector3; forward: THREE.Vector3; up: THREE.Vector3 }, shipOffsetX = 0, shipOffsetY = 0): void {
    // Camera stays on the rail path, slightly above and behind. It also drifts
    // a little toward the ship so big lateral moves feel like the frame follows.
    this._right.crossVectors(railPos.forward, railPos.up).normalize();
    this._desired
      .copy(railPos.position)
      .addScaledVector(railPos.up, CAMERA.CHASE_UP + shipOffsetY * 0.18)
      .addScaledVector(this._right, shipOffsetX * 0.22)
      .addScaledVector(railPos.forward, -CAMERA.CHASE_BACK);

    // Look ahead along the rail, never at the ship's screen offset.
    this._desiredLook
      .copy(railPos.position)
      .addScaledVector(railPos.forward, CAMERA.LOOK_AHEAD)
      .addScaledVector(this._right, shipOffsetX * 0.12)
      .addScaledVector(railPos.up, CAMERA.LOOK_UP + shipOffsetY * 0.08);

    this._rollTarget = THREE.MathUtils.clamp(-shipOffsetX * 0.012, -0.16, 0.16);
    this._pitchTarget = THREE.MathUtils.clamp(shipOffsetY * 0.006, -0.06, 0.06);
  }

  /** Add trauma (0..1). Kept for API compatibility as shake(intensity, _). */
  shake(intensity: number, _duration = 0): void {
    this.addTrauma(intensity * 0.6);
  }

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** Bank the camera into the player's roll (barrel roll / hard turns). */
  addRoll(radians: number): void {
    this._roll += radians;
  }

  update(dt: number): void {
    if (!this._initialized) {
      this._chasePos.copy(this._desired);
      this._chaseLook.copy(this._desiredLook);
      this._initialized = true;
    } else {
      const k = 1 - Math.exp(-CAMERA.CHASE_LAG * dt);
      this._chasePos.lerp(this._desired, k);
      this._chaseLook.lerp(this._desiredLook, Math.min(1, k * 1.4));
    }

    this._roll = THREE.MathUtils.lerp(this._roll, this._rollTarget, 1 - Math.exp(-4 * dt));
    this._pitch = THREE.MathUtils.lerp(this._pitch, this._pitchTarget, 1 - Math.exp(-4 * dt));

    this.camera.position.copy(this._chasePos);
    this.camera.lookAt(this._chaseLook);
    this.camera.rotateZ(this._roll);
    this.camera.rotateX(this._pitch);
    this.syncStable();
    this.applyShake(dt);
  }

  /** Slow cinematic orbit around a point — used behind the menu. */
  updateOrbit(dt: number, focus: THREE.Vector3): void {
    this._orbitAngle += dt * 0.18;
    const r = 11;
    this.camera.position.set(
      focus.x + Math.sin(this._orbitAngle) * r,
      focus.y + 2.2 + Math.sin(this._orbitAngle * 0.7) * 1.2,
      focus.z + Math.cos(this._orbitAngle) * r,
    );
    // Look a little to the ship's left so it sits right-of-centre, leaving
    // the left half of the frame for the menu panel on wide screens.
    const wide = this.camera.aspect > 1.3;
    this._desiredLook.set(focus.x, focus.y + 0.6, focus.z);
    if (wide) {
      this._right.subVectors(this._desiredLook, this.camera.position).normalize()
        .cross(this.camera.up).normalize();
      this._desiredLook.addScaledVector(this._right, -4.2);
    }
    this.camera.lookAt(this._desiredLook);
    this.syncStable();
    this.applyShake(dt);
    this._initialized = false;
  }

  private applyShake(dt: number): void {
    if (this.trauma <= 0) return;
    this.shakeTime += dt * 28;
    const s = this.trauma * this.trauma;
    const t = this.shakeTime;
    this.camera.translateX(smoothNoise(t, 1.3) * s * 1.1);
    this.camera.translateY(smoothNoise(t, 7.1) * s * 0.9);
    this.camera.rotateZ(smoothNoise(t, 3.7) * s * 0.09);
    this.camera.rotateX(smoothNoise(t, 5.3) * s * 0.03);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
  }

  /** Jump straight to the current target next update (level loads). */
  snap(): void {
    this._initialized = false;
  }

  reset(): void {
    this.camera.position.set(0, 4, 10);
    this.camera.lookAt(0, 0, -10);
    this.trauma = 0;
    this._roll = this._rollTarget = 0;
    this._pitch = this._pitchTarget = 0;
    this._initialized = false;
  }
}
