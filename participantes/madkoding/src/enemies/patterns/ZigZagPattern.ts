// ─── ZigZag Pattern: aggressive lateral weaving overflight ─────────────────

import * as THREE from 'three';
import type { Enemy } from '../Enemy';
import type { Projectile } from '../../weapons/Projectile';
import type { PatternBase } from './PatternBase';
import { dodgeLasers } from './movement';

export class ZigZagPattern implements PatternBase {
  name = 'ZIGZAG';
  private phase = Math.random() * Math.PI * 2;

  update(enemy: Enemy, dt: number, playerPos: THREE.Vector3, playerProjectiles?: Projectile[]): void {
    const pos = enemy.position;
    const speed = enemy.speed;

    dodgeLasers(pos, playerProjectiles, speed, dt);

    // Forward overflight with sharp lateral zig-zag.
    pos.z += speed * dt;
    const t = pos.z * 0.08 + this.phase;
    pos.x = playerPos.x + Math.sin(t * 2) * 7;
    pos.y = playerPos.y + Math.sin(t * 1.3) * 2;
  }
}