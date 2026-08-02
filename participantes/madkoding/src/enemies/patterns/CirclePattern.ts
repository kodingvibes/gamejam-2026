// ─── Circle Pattern: constant-speed tight orbit around player ──────────────

import * as THREE from 'three';
import type { Enemy } from '../Enemy';
import type { Projectile } from '../../weapons/Projectile';
import type { PatternBase } from './PatternBase';
import { dodgeLasers, moveToward, clampToPlayArea } from './movement';

const STANDOFF_Z = 4;

export class CirclePattern implements PatternBase {
  name = 'CIRCLE';
  private orbitAngle = Math.random() * Math.PI * 2;
  private orbitRadius = 4;

  update(enemy: Enemy, dt: number, playerPos: THREE.Vector3, playerProjectiles?: Projectile[]): void {
    const pos = enemy.position;
    const speed = enemy.speed;

    dodgeLasers(pos, playerProjectiles, speed, dt);

    // Tight orbit close to the player center
    this.orbitAngle += dt * 0.5;
    const target = new THREE.Vector3(
      playerPos.x + Math.cos(this.orbitAngle) * this.orbitRadius,
      playerPos.y + Math.sin(this.orbitAngle * 0.6) * this.orbitRadius * 0.4,
      playerPos.z - STANDOFF_Z + Math.sin(this.orbitAngle * 0.3) * 1.5,
    );

    moveToward(pos, target, speed, dt);

    // Clamp to play area around the player
    clampToPlayArea(pos, playerPos);
  }
}
