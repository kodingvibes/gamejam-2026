// ─── PowerUp Manager: spawns and updates power-up drops ─────────────────────

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { PowerUp, PowerUpType } from './PowerUp';

const DROP_CHANCE = 0.15; // 15% chance per enemy destroyed

export class PowerUpManager {
  private scene: THREE.Scene;
  private pool: PowerUp[] = [];
  private _active: PowerUp[] = [];

  constructor(scene: THREE.Scene, poolSize = 15) {
    this.scene = scene;
    EventBus.getInstance().on(GameEvent.ENEMY_DESTROYED, (p) => {
      this.maybeDrop(new THREE.Vector3(p.position.x, p.position.y, p.position.z));
    });
    for (let i = 0; i < poolSize; i++) {
      const p = new PowerUp();
      this.pool.push(p);
      this.scene.add(p.mesh);
    }
  }

  // Called when an enemy is destroyed — may drop a power-up
  maybeDrop(position: THREE.Vector3): void {
    if (Math.random() > DROP_CHANCE) return;
    const type: PowerUpType = Math.random() < 0.6 ? 'HEALTH' : 'BOMB';
    const p = this.pool.find(pu => !pu.active);
    if (!p) return;
    p.init(position, type);
    this._active.push(p);
  }

  update(dt: number, playerPos: THREE.Vector3): { healthGained: number; bombsGained: number } {
    let healthGained = 0;
    let bombsGained = 0;
    for (let i = this._active.length - 1; i >= 0; i--) {
      const p = this._active[i];
      const { collected } = p.update(dt, playerPos);
      if (collected) {
        if (p.type === 'HEALTH') healthGained += 20;
        else bombsGained += 1;
        this._active.splice(i, 1);
      } else if (!p.active) {
        this._active.splice(i, 1);
      }
    }
    return { healthGained, bombsGained };
  }

  reset(): void {
    for (const p of this._active) p.reset();
    this._active = [];
  }

  dispose(): void {
    for (const p of this.pool) p.dispose();
    this.pool = [];
    this._active = [];
  }
}