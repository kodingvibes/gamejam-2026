// ─── Projectile ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { WeaponKind } from './WeaponConfig';
import { getSoftParticleTexture } from '../fx/softTexture';

// Shared geometries: every shot used to allocate (and upload) a new cylinder.
const _laserGeoCache = new Map<string, THREE.BufferGeometry>();
function laserGeometry(radius: number, length: number): THREE.BufferGeometry {
  const key = `${radius}:${length}`;
  let geo = _laserGeoCache.get(key);
  if (!geo) {
    geo = new THREE.CapsuleGeometry(radius, length, 3, 8);
    geo.rotateX(Math.PI / 2);
    _laserGeoCache.set(key, geo);
  }
  return geo;
}
let _bombGeo: THREE.BufferGeometry | null = null;
function bombGeometry(): THREE.BufferGeometry {
  return _bombGeo ??= new THREE.SphereGeometry(0.45, 16, 12);
}
const _ringGeo = new THREE.TorusGeometry(1.1, 0.18, 8, 24);

export class Projectile {
  private mesh: THREE.Mesh;
  private glow: THREE.Mesh;     // soft outer halo around the laser core
  private bombRing: THREE.Mesh; // charged energy ring for bombs
  private bombHalo: THREE.Sprite;
  private static readonly _scratchStep = new THREE.Vector3();
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
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(laserGeometry(0.18, 3.0), mat);
    this.mesh.visible = false;
    this.mesh.renderOrder = 999;

    this.glow = new THREE.Mesh(laserGeometry(0.18, 3.0), new THREE.MeshBasicMaterial({
      color: 0x4488ff, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.glow.scale.set(2.6, 2.6, 1.15);
    this.glow.renderOrder = 998;
    this.mesh.add(this.glow);

    // Charged energy ring for bombs — a bright torus around the core that
    // reads as a circle of powerful, glowing mass.
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.bombRing = new THREE.Mesh(_ringGeo, ringMat);
    this.bombRing.visible = false;
    this.bombRing.renderOrder = 997;
    this.mesh.add(this.bombRing);

    this.bombHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSoftParticleTexture(), color: 0xffeeaa, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.bombHalo.scale.setScalar(7);
    this.bombHalo.visible = false;
    this.mesh.add(this.bombHalo);
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

    if (kind === 'BOMB') {
      this.mesh.geometry = bombGeometry();
      this.glow.visible = false;
      this.bombRing.visible = true;
      this.bombRing.scale.setScalar(1.5);
      this.bombHalo.visible = true;
      this.mesh.quaternion.identity();
    } else {
      const geo = laserGeometry(radius, length);
      this.mesh.geometry = geo;
      this.glow.geometry = geo;
      this.glow.visible = true;
      (this.glow.material as THREE.MeshBasicMaterial).color.setHex(color);
      this.bombRing.visible = false;
      this.bombHalo.visible = false;
    }

    this.mesh.position.copy(position);
    this._prevPosition.copy(position);
    this._velocity.copy(direction).multiplyScalar(speed);
    (this.mesh.material as THREE.MeshBasicMaterial).color.setHex(kind === 'BOMB' ? 0xffffff : 0xe8f4ff);
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
    Projectile._scratchStep.copy(this._velocity).multiplyScalar(dt);
    this.mesh.position.add(Projectile._scratchStep);

    // Bomb: pulse the energy ring and spin it for a charged, powerful look.
    if (this._kind === 'BOMB') {
      const pulse = 1 + Math.sin(this._lifetime * 12) * 0.25;
      this.bombRing.scale.setScalar(pulse);
      this.bombRing.rotation.z += dt * 4;
      this.bombRing.rotation.x += dt * 2;
      this.bombHalo.scale.setScalar(6 + Math.sin(this._lifetime * 18) * 1.5);
    }

    if (this._lifetime >= this._maxLifetime) this.deactivate();
  }

  explode(): void { this._exploded = true; this.deactivate(); }
  deactivate(): void { this._active = false; this.mesh.visible = false; this.bombRing.visible = false; this.bombHalo.visible = false; }

  dispose(): void {
    // Geometries are shared module-level caches; only free materials here.
    (this.mesh.material as THREE.Material).dispose();
    (this.glow.material as THREE.Material).dispose();
    (this.bombRing.material as THREE.Material).dispose();
    (this.bombHalo.material as THREE.Material).dispose();
  }
}
