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
import { ObstacleManager } from '../fx/ObstacleManager';

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
  /** Fired whenever a player shot connects (crosshair hit-marker, sfx). */
  onHit: ((position: THREE.Vector3, killed: boolean) => void) | null = null;

  constructor(
    private enemyManager: EnemyManager,
    private weaponSystem: WeaponSystem,
    private hitSpark: HitSpark,
    private obstacleManager?: ObstacleManager,
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

  /** Obstacles block shots: crystals / small asteroids shatter, bombs break anything. */
  checkProjectilesVsObstacles(): void {
    if (!this.obstacleManager) return;
    for (const proj of this.weaponSystem.projectilesList) {
      if (!proj.active || !proj.isPlayerProjectile) continue;
      const o = this.obstacleManager.projectileHit(proj.prevPosition, proj.position);
      if (!o) continue;
      if (proj.kind === 'BOMB') {
        this.weaponSystem.explodeBomb(proj.position, proj);
        this.obstacleManager.destroy(o);
        continue;
      }
      this.hitSpark.spawn(proj.position.clone(), o.destructible ? 0xffffff : 0xffaa44, o.destructible ? 1 : 0.6);
      if (o.destructible) this.obstacleManager.destroy(o);
      this.weaponSystem.releaseProjectile(proj);
    }
  }

  private handleLaser(proj: Projectile, enemy: Enemy): void {
    // ENEMY_DESTROYED event owns the explosion + sfx + drops (see GameEventBinder)
    const killed = enemy.takeDamage(proj.damage);
    this.hitSpark.spawn(proj.position.clone(), 0x88ccff, 0.8);
    this.onHit?.(proj.position, killed);
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
        const killed = boss.takeDamage(proj.damage);
        this.hitSpark.spawn(proj.position.clone(), 0xffaa66, 0.9);
        this.onHit?.(proj.position, killed);
        this.weaponSystem.releaseProjectile(proj);
        break;
      }
    }
  }
}
