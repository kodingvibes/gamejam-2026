// ─── Dive Bomb: constant-speed circling, then dive toward player ───────────

import * as THREE from 'three';
import type { Enemy } from '../Enemy';
import type { Projectile } from '../../weapons/Projectile';
import type { PatternBase } from './PatternBase';
import { dodgeLasers, moveToward, clampToPlayArea } from './movement';

const STANDOFF_Z = 6;

export class DiveBombPattern implements PatternBase {
  name = 'DIVE_BOMB';
  private diveTimer = 0;
  private diving = false;
  private diveCooldown = 5.0;
  private circleAngle = Math.random() * Math.PI * 2;

  update(enemy: Enemy, dt: number, playerPos: THREE.Vector3, playerProjectiles?: Projectile[]): void {
    const pos = enemy.position;
    const speed = enemy.speed;

    dodgeLasers(pos, playerProjectiles, speed, dt);

    this.diveTimer += dt;
    if (!this.diving && this.diveTimer > this.diveCooldown) {
      this.diving = true; this.diveTimer = 0;
      this.diveCooldown = 4.0 + Math.random() * 4.0;
    }

    if (this.diving) {
      // Dive straight toward the player
      moveToward(pos, playerPos, speed * 1.5, dt);
      enemy.spinBody(dt * 8);
      if (this.diveTimer > 2.0 || pos.z > playerPos.z - 3) {
        this.diving = false; this.diveTimer = 0;
      }
    } else {
      // Circle close to the player center
      this.circleAngle += dt * 0.5;
      const target = new THREE.Vector3(
        playerPos.x + Math.cos(this.circleAngle) * 3,  // tight circle
        playerPos.y + Math.sin(this.circleAngle * 0.6) * 2,
        playerPos.z - STANDOFF_Z,
      );
      moveToward(pos, target, speed, dt);
    }

    // Clamp to play area around the player
    clampToPlayArea(pos, playerPos);
  }
}
