// ─── Movement Helpers shared by enemy patterns ───────────────────────────────

import * as THREE from 'three';
import type { Projectile } from '../../weapons/Projectile';

export function dodgeLasers(pos: THREE.Vector3, projectiles: Projectile[] | undefined, speed: number, dt: number): void {
  if (!projectiles) return;
  for (const proj of projectiles) {
    if (!proj.active) continue;
    if (pos.distanceTo(proj.position) < 3) {
      const away = pos.clone().sub(proj.position).normalize();
      pos.x += away.x * speed * dt;
      pos.y += away.y * speed * dt;
      break;
    }
  }
}

export function moveToward(pos: THREE.Vector3, target: THREE.Vector3, speed: number, dt: number): void {
  const dir = target.clone().sub(pos);
  const dist = dir.length();
  if (dist > 0.1) {
    dir.normalize();
    pos.addScaledVector(dir, Math.min(speed * dt, dist));
  }
}

export function clampToPlayArea(pos: THREE.Vector3, playerPos: THREE.Vector3): void {
  pos.x = THREE.MathUtils.clamp(pos.x, playerPos.x - 12, playerPos.x + 12);
  pos.y = THREE.MathUtils.clamp(pos.y, playerPos.y - 7, playerPos.y + 7);
}
