// ─── Camera Rig (On-Rails Chase with Free Screen-Space Ship) ───────────────
//
// The camera rides the rail path independently of the player's screen-space
// movement. It only knows the rail base position, not the ship's lateral/vertical
// screen offset. This lets the ship slide freely around the viewport while the
// camera stays smooth and forward-looking, exactly like Starfox.

import * as THREE from 'three';
import { CAMERA } from '../types/config';

export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private shakeOffset = new THREE.Vector3();
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  private _chasePos = new THREE.Vector3();
  private _chaseLook = new THREE.Vector3();
  private _initialized = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
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

  // `railPos` is the base rail position WITHOUT the player's screen offset.
  // `shipOffset` is the player's world-space offset from the rail, used only
  // for subtle banking feedback.
  setTarget(railPos: { position: THREE.Vector3; forward: THREE.Vector3; up: THREE.Vector3 }, shipOffsetX = 0, shipOffsetY = 0): void {
    // Camera stays on the rail path, slightly above and behind.
    const desired = new THREE.Vector3()
      .copy(railPos.position)
      .addScaledVector(railPos.up, CAMERA.CHASE_UP)
      .addScaledVector(railPos.forward, -CAMERA.CHASE_BACK);

    // Look ahead along the rail, never at the ship's screen offset.
    const desiredLook = new THREE.Vector3()
      .copy(railPos.position)
      .addScaledVector(railPos.forward, CAMERA.LOOK_AHEAD)
      .addScaledVector(railPos.up, CAMERA.LOOK_UP);

    if (!this._initialized) {
      this._chasePos.copy(desired);
      this._chaseLook.copy(desiredLook);
      this._initialized = true;
    } else {
      const k = Math.min(1, CAMERA.CHASE_LAG * 0.016);
      this._chasePos.lerp(desired, k);
      this._chaseLook.lerp(desiredLook, k);
    }

    this.camera.position.copy(this._chasePos);
    this.camera.lookAt(this._chaseLook);

    // Gentle banking based on the ship's offset so the frame leans slightly
    // toward where the player is on screen, reinforcing the parallax.
    this.camera.rotation.z = THREE.MathUtils.clamp(shipOffsetX * 0.02, -0.2, 0.2);
    this.camera.rotation.x = THREE.MathUtils.clamp(shipOffsetY * 0.02, -0.12, 0.12);
  }

  shake(intensity: number, duration: number): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
    this.shakeTimer = 0;
  }

  update(dt: number): void {
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
