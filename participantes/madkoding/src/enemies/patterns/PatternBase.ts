// ─── Pattern Base Interface ──────────────────────────────────────────────────

import type * as THREE from 'three';
import type { Enemy } from '../Enemy';
import type { Projectile } from '../../weapons/Projectile';

export interface PatternBase {
  name: string;
  update(
    enemy: Enemy,
    dt: number,
    playerPos: THREE.Vector3,
    playerProjectiles?: Projectile[]
  ): void;
}
