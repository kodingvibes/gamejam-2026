// ─── Camera Rig (Third-Person Chase) ────────────────────────────────────────

import * as THREE from 'three';

export class CameraRig {
  private camera: THREE.PerspectiveCamera;
  private shakeOffset = new THREE.Vector3();
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;

  private _offset = new THREE.Vector3();

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
    // Third-person chase: camera behind & above the ship.
    // forward is the direction of travel (tangent), so -forward is "back".
    // Ship should appear in the LOWER part of the screen, so we look at a
    // point slightly above the ship (so the ship sits low in frame).
    this._offset.set(0, 0, 0)
      .addScaledVector(up, 4.0)       // up above the ship
      .addScaledVector(forward, -10); // behind the ship

    this.camera.position.copy(position).add(this._offset);

    // Look at a point well ahead and slightly above the ship → ship is low
    this.camera.lookAt(
      position.x + forward.x * 20,
      position.y + forward.y * 20 + up.y * 2.0,
      position.z + forward.z * 20
    );
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
  }
}