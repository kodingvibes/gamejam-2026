// ─── Sweep Pattern: constant-speed approach toward player center ───────────

import * as THREE from 'three';
import type { Enemy } from '../Enemy';
import type { Projectile } from '../../weapons/Projectile';
import type { PatternBase } from './PatternBase';
import { dodgeLasers, moveToward, clampToPlayArea } from './movement';

const STANDOFF_Z = 5;

export class SweepPattern implements PatternBase {
  name = 'SWEEP';
  private swayAngle = Math.random() * Math.PI * 2;

  update(enemy: Enemy, dt: number, playerPos: THREE.Vector3, playerProjectiles?: Projectile[]): void {
    const pos = enemy.position;
    const speed = enemy.speed;

    dodgeLasers(pos, playerProjectiles, speed, dt);

    // Approach toward the player's X/Y position (center of screen where
    // the crosshair can reach). Small sway for visual movement.
    this.swayAngle += dt * 0.6;
    const target = new THREE.Vector3(
      playerPos.x + Math.sin(this.swayAngle) * 2,  // small sway
      playerPos.y + Math.cos(this.swayAngle * 0.7) * 1.5,
      playerPos.z - STANDOFF_Z,
    );

    moveToward(pos, target, speed, dt);

    // Clamp to the play area around the player so enemies stay reachable
    clampToPlayArea(pos, playerPos);
  }
}
