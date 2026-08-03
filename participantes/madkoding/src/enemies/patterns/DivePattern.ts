// ─── Dive Pattern: steep vertical dive from above or below ───────────────

import * as THREE from 'three';
import type { Enemy } from '../Enemy';
import type { Projectile } from '../../weapons/Projectile';
import type { PatternBase } from './PatternBase';
import { dodgeLasers } from './movement';

export class DivePattern implements PatternBase {
  name = 'DIVE';
  private phase = Math.random() * Math.PI * 2;
  // Random vertical sign: +1 dives from above, -1 from below.
  private verticalDir = Math.random() < 0.5 ? 1 : -1;

  update(enemy: Enemy, dt: number, playerPos: THREE.Vector3, playerProjectiles?: Projectile[]): void {
    const pos = enemy.position;
    const speed = enemy.speed;

    dodgeLasers(pos, playerProjectiles, speed, dt);

    // Forward overflight with a steep vertical arcing dive.
    pos.z += speed * dt;
    const t = pos.z * 0.06 + this.phase;
    pos.x = playerPos.x + Math.sin(t) * 3;
    // Dive arc: start high (or low), curve toward player altitude.
    const arc = Math.cos(t) * 6 * this.verticalDir;
    pos.y = playerPos.y + arc;
  }
}