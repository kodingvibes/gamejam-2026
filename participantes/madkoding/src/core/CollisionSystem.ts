// ─── Collision System: projectile-enemy, enemy-player, boss ─────────────────
// Uses segment-based collision (prevPos → currentPos) to prevent tunneling
// when projectiles move very fast relative to enemy hitboxes.

import * as THREE from 'three';
import { Enemy } from '../enemies/Enemy';
import { EnemyManager } from '../enemies/EnemyManager';
import { Projectile } from '../weapons/Projectile';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { BossMothership } from '../enemies/bosses/BossMothership';
import { HitSpark } from '../fx/HitSpark';

// Distance from a point to a line segment (prev → current)
function distPointToSegment(point: THREE.Vector3, segStart: THREE.Vector3, segEnd: THREE.Vector3): number {
  const seg = segEnd.clone().sub(segStart);
  const segLen = seg.length();
  if (segLen < 0.001) return point.distanceTo(segStart);
  const t = THREE.MathUtils.clamp(point.clone().sub(segStart).dot(seg) / (segLen * segLen), 0, 1);
  const closest = segStart.clone().add(seg.multiplyScalar(t));
  return point.distanceTo(closest);
}

export class CollisionSystem {
  constructor(
    private enemyManager: EnemyManager,
    private weaponSystem: WeaponSystem,
    private hitSpark: HitSpark,
  ) {}

  checkProjectilesVsEnemies(): void {
    const enemies = this.enemyManager.activeEnemies;
    const projectiles = this.weaponSystem.projectilesList;

    for (const proj of projectiles) {
      if (!proj.active || !proj.isPlayerProjectile) continue;

      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const hitRadius = 1.5 + enemy.size * 0.5;

        // Segment-based collision: check if the projectile's path this frame
        // passed within hitRadius of the enemy (prevents tunneling at high speed)
        const dist = distPointToSegment(enemy.position, proj.prevPosition, proj.position);

        if (dist < hitRadius) {
          if (proj.kind === 'BOMB') {
            this.weaponSystem.explodeBomb(proj.position, proj);
          } else {
            this.handleLaser(proj, enemy);
          }
          break;
        }
      }
    }
  }

  private handleLaser(proj: Projectile, enemy: Enemy): void {
    // ENEMY_DESTROYED event owns the explosion + sfx + drops (see GameEventBinder)
    enemy.takeDamage(proj.damage);
    this.hitSpark.spawn(proj.position.clone(), 0xffff44);
    this.weaponSystem.releaseProjectile(proj);
  }

  checkProjectilesVsBoss(boss: BossMothership): void {
    const projectiles = this.weaponSystem.projectilesList;
    for (const proj of projectiles) {
      if (!proj.active || !proj.isPlayerProjectile) continue;
      const hitRadius = boss.size + 1;
      const dist = distPointToSegment(boss.position, proj.prevPosition, proj.position);
      if (dist < hitRadius) {
        // BOSS_DESTROYED event owns the explosion + sfx (see GameEventBinder)
        boss.takeDamage(proj.damage);
        this.hitSpark.spawn(proj.position.clone(), 0xff4444);
        this.weaponSystem.releaseProjectile(proj);
        break;
      }
    }
  }
}
