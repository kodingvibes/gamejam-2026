// ─── Enemy Manager ──────────────────────────────────────────────────────────

import * as THREE from 'three';
import { ENEMIES } from '../types/config';
import { Enemy } from './Enemy';
import type { EnemyConfig } from './Enemy';
import { SweepPattern } from './patterns/SweepPattern';
import { DiveBombPattern } from './patterns/DiveBombPattern';
import { CirclePattern } from './patterns/CirclePattern';
import type { PatternBase } from './patterns/PatternBase';
import type { Projectile } from '../weapons/Projectile';

const ENEMY_CONFIGS: Record<string, EnemyConfig> = {
  DRONE: ENEMIES.DRONE,
  SCOUT: ENEMIES.SCOUT,
  FIGHTER: ENEMIES.FIGHTER,
  INTERCEPTOR: ENEMIES.INTERCEPTOR,
  BOMBER: ENEMIES.BOMBER,
};

export interface EnemyProjectileDef {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
}

export class EnemyManager {
  private scene: THREE.Scene;
  private enemies: Enemy[] = [];
  private patterns: Map<string, PatternBase> = new Map();
  private _activeEnemies: Enemy[] = [];
  private _pendingProjectiles: EnemyProjectileDef[] = [];

  constructor(scene: THREE.Scene, poolSize = 30) {
    this.scene = scene;

    // Register patterns
    this.patterns.set('SWEEP', new SweepPattern());
    this.patterns.set('DIVE_BOMB', new DiveBombPattern());
    this.patterns.set('CIRCLE', new CirclePattern());

    // Pre-create enemy pool
    for (let idx = 0; idx < poolSize; idx++) {
      const enemy = new Enemy(ENEMIES.DRONE, 'DRONE', this.scene);
      this.enemies.push(enemy);
      this.scene.add(enemy.mesh);
    }
  }

  get activeEnemies(): Enemy[] {
    return this._activeEnemies;
  }

  get pendingProjectiles(): EnemyProjectileDef[] {
    return this._pendingProjectiles;
  }

  clearPendingProjectiles(): void {
    this._pendingProjectiles = [];
  }

  spawn(
    type: string,
    position: THREE.Vector3,
    targetPosition: THREE.Vector3,
    patternName = 'SWEEP'
  ): Enemy | null {
    // Find an inactive enemy of the same type, then any inactive one
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
    enemy.pattern = this.patterns.get(patternName) ?? null;
    enemy.init(position, targetPosition);
    this._activeEnemies.push(enemy);
    return enemy;
  }

  update(dt: number, playerPos: THREE.Vector3, playerProjectiles?: Projectile[]): void {
    this._activeEnemies = [];
    this._pendingProjectiles = [];

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      enemy.updateCombat(dt, playerPos, playerProjectiles, this.onEnemyShoot);
      if (enemy.active) this._activeEnemies.push(enemy);
    }
  }

  // Collect enemy laser fire so the owner can spawn projectile meshes later
  private onEnemyShoot = (shootPos: THREE.Vector3, dir: THREE.Vector3): void => {
    this._pendingProjectiles.push({
      position: shootPos,
      velocity: dir.clone().multiplyScalar(200),
    });
  };

  reset(): void {
    for (const enemy of this.enemies) {
      enemy.reset();
    }
    this._activeEnemies = [];
    this._pendingProjectiles = [];
  }

  dispose(): void {
    for (const enemy of this.enemies) {
      enemy.dispose();
    }
    this.enemies = [];
    this._activeEnemies = [];
  }
}
