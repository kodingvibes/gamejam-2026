// ─── Enemy Manager ──────────────────────────────────────────────────────────

import * as THREE from 'three';
import { ENEMIES } from '../types/config';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { Enemy, type RailFrame } from './Enemy';
import type { EnemyConfig } from './Enemy';
import type { PlanName, PlanSlot } from './FlightPlans';
import type { Projectile } from '../weapons/Projectile';

const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  DRONE: ENEMIES.DRONE,
  SCOUT: ENEMIES.SCOUT,
  FIGHTER: ENEMIES.FIGHTER,
  INTERCEPTOR: ENEMIES.INTERCEPTOR,
  BOMBER: ENEMIES.BOMBER,
};

const PLAN_NAMES: PlanName[] = ['SWEEP', 'DIVE_BOMB', 'CIRCLE', 'ZIGZAG', 'DIVE'];

export interface EnemyProjectileDef {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

export class EnemyManager {
  private scene: THREE.Scene;
  private eventBus = EventBus.getInstance();
  private enemies: Enemy[] = [];
  private _activeEnemies: Enemy[] = [];
  private _pendingProjectiles: EnemyProjectileDef[] = [];
  private _rams: Enemy[] = [];
  private _tunnelRadius = 0;
  // Rail frame every enemy flies relative to (updated each frame by Game).
  private frame: RailFrame = {
    position: new THREE.Vector3(),
    forward: new THREE.Vector3(0, 0, -1),
    up: new THREE.Vector3(0, 1, 0),
    right: new THREE.Vector3(1, 0, 0),
  };

  constructor(scene: THREE.Scene, poolSize = 30) {
    this.scene = scene;
    for (let idx = 0; idx < poolSize; idx++) {
      const enemy = new Enemy(ENEMIES.DRONE, 'DRONE', this.scene);
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
    }
  }

  get activeEnemies(): Enemy[] { return this._activeEnemies; }
  get pendingProjectiles(): EnemyProjectileDef[] { return this._pendingProjectiles; }
  /** Enemies that crashed into the player this frame. */
  get rams(): Enemy[] { return this._rams; }

  clearPendingProjectiles(): void {
    this._pendingProjectiles = [];
  }

  /** Rail frame (camera rail point + basis) that flight plans are flown in. */
  setFrame(rail: { position: THREE.Vector3; forward: THREE.Vector3; up: THREE.Vector3 }): void {
    const f = this.frame;
    f.position.copy(rail.position);
    f.forward.copy(rail.forward).normalize();
    f.up.copy(rail.up).normalize();
    f.right.crossVectors(f.forward, f.up).normalize();
  }

  spawn(type: string, pattern: string, slot: PlanSlot, playerPos: THREE.Vector3): Enemy | null {
    let enemy =
      this.enemies.find(e => !e.active && e.type === type) ??
      this.enemies.find(e => !e.active);

    if (!enemy) {
      const config = ENEMY_CONFIGS[type] || ENEMIES.DRONE;
      enemy = new Enemy(config, type, this.scene);
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
    }

    const config = ENEMY_CONFIGS[type] || ENEMIES.DRONE;
    enemy.configure(config, type);
    enemy.planName = (PLAN_NAMES as string[]).includes(pattern) ? pattern as PlanName : 'SWEEP';
    enemy.setTunnel(null, this._tunnelRadius);
    enemy.init(slot, this.frame, playerPos);
    return enemy;
  }

  /** Tunnel confinement for cave/ice biomes (radius around the rail). */
  setTunnel(_curve: THREE.CatmullRomCurve3 | null, radius: number): void {
    this._tunnelRadius = radius;
  }

  update(dt: number, playerPos: THREE.Vector3, playerProjectiles?: Projectile[]): void {
    this._activeEnemies = [];
    this._pendingProjectiles = [];
    this._rams = [];

    for (const enemy of this.enemies) {
      if (!enemy.active) {
        enemy.updateTrailFade(dt);
        continue;
      }
      enemy.updateCombat(dt, playerPos, this.frame, playerProjectiles, this.onEnemyShoot);
      if (enemy.active && enemy.rammed) {
        enemy.rammed = false;
        this._rams.push(enemy);
      }
      if (enemy.active) this._activeEnemies.push(enemy);
    }
  }

  // Collect enemy laser fire so the owner can spawn projectile meshes later
  private onEnemyShoot = (shootPos: THREE.Vector3, dir: THREE.Vector3): void => {
    this._pendingProjectiles.push({
      position: shootPos,
      velocity: dir.clone().multiplyScalar(170),
    });
    this.eventBus.emit(GameEvent.ENEMY_FIRED, {});
  };

  reset(): void {
    for (const enemy of this.enemies) enemy.reset();
    this._activeEnemies = [];
    this._pendingProjectiles = [];
    this._rams = [];
  }

  dispose(): void {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    this._activeEnemies = [];
  }
}
