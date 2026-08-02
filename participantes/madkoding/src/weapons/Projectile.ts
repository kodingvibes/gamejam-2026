// ─── Projectile ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { WeaponKind } from './WeaponConfig';

export class Projectile {
  private mesh: THREE.Mesh;
  private _velocity = new THREE.Vector3();
  private _damage = 10;
  private _speed = 60;
  private _kind: WeaponKind = 'LASER';
  private _lifetime = 0;
  private _maxLifetime = 3;
  private _active = false;
  private _isPlayerProjectile = true;
  private _color: number = 0x44ff44;
  private _radius = 0.18;
  private _exploded = false;
  private _prevPosition = new THREE.Vector3();
  private _fuse = -1; // < 0 = no fuse; > 0 = countdown to auto-explode

  constructor() {
    const geo = new THREE.CylinderGeometry(0.18, 0.18, 3.0, 8);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 999;
  }

  get object3D(): THREE.Mesh { return this.mesh; }
  get active(): boolean { return this._active; }
  get damage(): number { return this._damage; }
  get kind(): WeaponKind { return this._kind; }
  get isPlayerProjectile(): boolean { return this._isPlayerProjectile; }
  set isPlayerProjectile(v: boolean) { this._isPlayerProjectile = v; }
  get color(): number { return this._color; }
  get position(): THREE.Vector3 { return this.mesh.position; }
  get velocity(): THREE.Vector3 { return this._velocity; }
  get prevPosition(): THREE.Vector3 { return this._prevPosition; }
  get radius(): number { return this._radius; }
  get exploded(): boolean { return this._exploded; }

  init(
    position: THREE.Vector3, direction: THREE.Vector3, speed: number,
    damage: number, color: number, kind: WeaponKind = 'LASER',
    isPlayer = true, radius = 0.18, length = 3.0,
  ): void {
    this._kind = kind; this._damage = damage; this._speed = speed;
    this._color = color; this._radius = radius;
    this._lifetime = 0; this._active = true;
    this._isPlayerProjectile = isPlayer; this._exploded = false;
    this._fuse = -1;
    this._maxLifetime = kind === 'BOMB' ? 5 : 3;

    const oldGeo = this.mesh.geometry;
    if (kind === 'BOMB') {
      this.mesh.geometry = new THREE.SphereGeometry(radius, 12, 12);
    } else {
      const geo = new THREE.CylinderGeometry(radius, radius, length, 8);
      geo.rotateX(Math.PI / 2);
      this.mesh.geometry = geo;
    }
    oldGeo.dispose();

    this.mesh.position.copy(position);
    this._prevPosition.copy(position);
    this._velocity.copy(direction).multiplyScalar(speed);
    (this.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.mesh.visible = true;

    if (kind === 'LASER' && this._velocity.length() > 0.01) {
      this.mesh.lookAt(this.mesh.position.clone().add(this._velocity));
    }
  }

  setFuse(seconds: number): void { this._fuse = seconds; }

  // Returns true when the fuse countdown reaches zero (clamped to 0 in update)
  shouldExplode(): boolean { return this._fuse === 0; }

  update(dt: number): void {
    if (!this._active) return;
    this._lifetime += dt;
    if (this._fuse > 0) {
      this._fuse -= dt;
      if (this._fuse < 0) this._fuse = 0;
    }
    this._prevPosition.copy(this.mesh.position);
    this.mesh.position.add(this._velocity.clone().multiplyScalar(dt));
    if (this._lifetime >= this._maxLifetime) this.deactivate();
  }

  explode(): void { this._exploded = true; this._active = false; this.mesh.visible = false; }
  deactivate(): void { this._active = false; this.mesh.visible = false; }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}