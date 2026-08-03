// ─── Camera Rig (Third-Person Chase with Parallax Lag) ─────────────────────
//
// The camera does NOT snap to the ship. It smoothly chases the ship's target
// position with a lag (CHASE_LAG). When the ship moves laterally/vertically,
// it shifts within the frame while the camera catches up — this produces the
// Starfox-style parallax feel (ship moves, background layers drift at
// different rates). The camera also banks slightly into turns for extra life.

import * as THREE from 'three';
import { CAMERA } from '../types/config';

export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private shakeOffset = new THREE.Vector3();
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  // Smoothed chase position (lags behind the ship target).
  private _chasePos = new THREE.Vector3();
  private _chaseLook = new THREE.Vector3();
  private _initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    this.camera.position.set(0, 4, 10);
    this.camera.lookAt(0, 0, -10);
  }

  get camera3D(): THREE.PerspectiveCamera {
    return this.camera;
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  setTarget(position: THREE.Vector3, forward: THREE.Vector3, up: THREE.Vector3): void {
    // Desired camera position: behind & above the ship.
    const desired = new THREE.Vector3()
      .copy(position)
      .addScaledVector(up, CAMERA.CHASE_UP)
      .addScaledVector(forward, -CAMERA.CHASE_BACK);

    // Desired look-at point: ahead & slightly above the ship.
    const desiredLook = new THREE.Vector3()
      .copy(position)
      .addScaledVector(forward, CAMERA.LOOK_AHEAD)
      .addScaledVector(up, CAMERA.LOOK_UP);

    if (!this._initialized) {
      // First frame: snap so there's no initial jump.
      this._chasePos.copy(desired);
      this._chaseLook.copy(desiredLook);
      this._initialized = true;
    } else {
      // Chase with lag → parallax. Higher CHASE_LAG = faster catch-up.
      const k = Math.min(1, CAMERA.CHASE_LAG * 0.016);
      this._chasePos.lerp(desired, k);
      this._chaseLook.lerp(desiredLook, k);
    }

    this.camera.position.copy(this._chasePos);
    this.camera.lookAt(this._chaseLook);

    // Bank the camera slightly into lateral turns for a dynamic feel.
    // Compute lateral drift from the ship's offset relative to the rail.
    // We approximate by looking at how far the ship is from the camera's
    // forward axis — a simple roll based on the ship's X offset.
    const lateral = THREE.MathUtils.clamp(position.x * 0.02, -0.25, 0.25);
    this.camera.rotation.z = lateral;
  }

  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = 0;
  }

  update(dt: number): void {
    // Screen shake only (position/lookAt are set directly in setTarget)
    if (this.shakeTimer < this.shakeDuration) {
      this.shakeTimer += dt;
      const decay = 1 - (this.shakeTimer / this.shakeDuration);
      const intensity = this.shakeIntensity * decay * 0.5;
      this.shakeOffset.set(
        THREE.MathUtils.randFloat(-1, 1) * intensity,
        THREE.MathUtils.randFloat(-1, 1) * intensity,
        THREE.MathUtils.randFloat(-1, 1) * intensity * 0.3
      );
      this.camera.position.add(this.shakeOffset);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }
  }

  reset(): void {
    this.camera.position.set(0, 4, 10);
    this.camera.lookAt(0, 0, -10);
    this.shakeOffset.set(0, 0, 0);
    this.shakeIntensity = 0;
    this.shakeTimer = 0;
    this._initialized = false;
  }
}
