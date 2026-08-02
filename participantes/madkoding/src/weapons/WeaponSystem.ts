// ─── Weapon System ──────────────────────────────────────────────────────────
// Lasers: infinite, fired with SPACE (hold)
// Bombs: 5 total, fired with Z (edge-trigger), explode on timer or impact

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { Projectile } from './Projectile';
import { WeaponData, WEAPON_LIST } from './WeaponConfig';

const MAX_BOMBS = 5;
const BOMB_FUSE = 1.0;

export class WeaponSystem {
  private scene: THREE.Scene;
  private eventBus: EventBus;
  private projectiles: Projectile[] = [];
  private _laserTimer = 0;
  private _canLaser = true;
  private _bombTimer = 0;
  private _canBomb = true;
  private _bombs = MAX_BOMBS;

  onBombExplode: ((position: THREE.Vector3) => void) | null = null;

  constructor(scene: THREE.Scene, poolSize = 80) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();

    // Pre-create all projectiles upfront — fixed array, no dynamic growth
    for (let i = 0; i < poolSize; i++) {
      const p = new Projectile();
      this.projectiles.push(p);
      this.scene.add(p.object3D);
    }
  }

  get currentWeapon(): WeaponData { return WEAPON_LIST[0]; }
  get projectilesList(): Projectile[] { return this.projectiles; }
  get bombs(): number { return this._bombs; }
  get maxBombs(): number { return MAX_BOMBS; }

  addBombs(count: number): void {
    if (count <= 0) return;
    this._bombs = Math.min(this._bombs + count, MAX_BOMBS);
    this.eventBus.emit(GameEvent.BOMB_COUNT_CHANGED, { count: this._bombs });
  }

  // Find an inactive projectile to reuse
  private acquireProj(): Projectile | null {
    return this.projectiles.find(p => !p.active) ?? null;
  }

  fireLaser(position: THREE.Vector3, direction: THREE.Vector3): void {
    if (!this._canLaser) return;
    const weapon = WEAPON_LIST[0];
    this._laserTimer = weapon.fireRate;
    this._canLaser = false;

    const right = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    for (const side of [-1, 1]) {
      const proj = this.acquireProj();
      if (!proj) continue;
      const firePos = position.clone().add(right.clone().multiplyScalar(side * 1.8));
      proj.init(firePos, direction, weapon.speed, weapon.damage, weapon.color, 'LASER', true, weapon.radius, weapon.length);
      if (!proj.object3D.parent) this.scene.add(proj.object3D);
    }
    this.eventBus.emit(GameEvent.PLAYER_FIRED, { weapon: 'LASER' });
  }

  fireBomb(position: THREE.Vector3, direction: THREE.Vector3): void {
    if (!this._canBomb || this._bombs <= 0) return;
    const weapon = WEAPON_LIST[1];
    this._bombTimer = weapon.fireRate;
    this._canBomb = false;
    this._bombs--;
    this.eventBus.emit(GameEvent.BOMB_COUNT_CHANGED, { count: this._bombs });

    const proj = this.acquireProj();
    if (!proj) return;
    proj.init(position.clone(), direction, weapon.speed, weapon.damage, weapon.color, 'BOMB', true, weapon.radius, 0);
    proj.setFuse(BOMB_FUSE);
    if (!proj.object3D.parent) this.scene.add(proj.object3D);
    this.eventBus.emit(GameEvent.PLAYER_FIRED, { weapon: 'BOMB' });
  }

  update(dt: number, playerPos?: THREE.Vector3): void {
    if (!this._canLaser) {
      this._laserTimer -= dt;
      if (this._laserTimer <= 0) this._canLaser = true;
    }
    if (!this._canBomb) {
      this._bombTimer -= dt;
      if (this._bombTimer <= 0) this._canBomb = true;
    }

    for (const proj of this.projectiles) {
      if (!proj.active) continue;
      proj.update(dt);

      if (proj.active && proj.kind === 'BOMB' && proj.shouldExplode()) {
        this.explodeBomb(proj.position, proj);
        continue;
      }

      const p = proj.position;
      const baseZ = playerPos ? playerPos.z : 0;
      if (p.x < -60 || p.x > 60 || p.y < -60 || p.y > 60 ||
          p.z > baseZ + 20 || p.z < baseZ - 300) {
        proj.deactivate();
      }
    }
  }

  // Single bomb-explosion entry point (fuse expiry and direct impact).
  // The AOE callback owns visuals + damage so both paths behave identically.
  explodeBomb(position: THREE.Vector3, proj: Projectile): void {
    if (this.onBombExplode) this.onBombExplode(position.clone());
    proj.explode();
    this.releaseProjectile(proj);
  }

  releaseProjectile(proj: Projectile): void {
    proj.deactivate();
  }

  reset(): void {
    for (const p of this.projectiles) p.deactivate();
    this._laserTimer = 0; this._canLaser = true;
    this._bombTimer = 0; this._canBomb = true;
    this._bombs = MAX_BOMBS;
    this.eventBus.emit(GameEvent.BOMB_COUNT_CHANGED, { count: this._bombs });
  }

  dispose(): void {
    for (const p of this.projectiles) p.dispose();
    this.projectiles = [];
  }
}