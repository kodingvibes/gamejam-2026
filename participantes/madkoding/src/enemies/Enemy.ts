// ─── Enemy Base Class ────────────────────────────────────────────────────────

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { EnemyMeshFactory } from './EnemyMeshFactory';
import { EnemyTrail } from './EnemyTrail';
import type { Projectile } from '../weapons/Projectile';
import type { PatternBase } from './patterns/PatternBase';

export interface EnemyConfig {
  name: string; health: number; speed: number; damage: number;
  score: number; size: number; color: number;
}

export class Enemy {
  protected group: THREE.Group;
  protected body: THREE.Group;
  protected _health: number;
  protected _maxHealth: number;
  protected _speed: number;
  protected _damage: number;
  protected _score: number;
  protected _size: number;
  protected _color: number;
  protected _name: string;
  protected _active = false;
  protected _id: number;
  protected _type: string;
  protected eventBus: EventBus;
  protected _age = 0;
  protected _maxAge = 90;
  protected _velocity = new THREE.Vector3();
  protected _shootTimer = 0;
  protected _shootCooldown = 1.5;
  protected _ramTimer = 0;
  protected _ramCooldown = 5;
  protected _ramDuration = 0.5;
  protected _ramming = false;
  protected _ramVelocity = new THREE.Vector3();
  protected _rollSpeed = 0;
  protected _yawSpeed = 0;
  protected _retreatTimer = 0;
  protected _telegraphTimer = 0;
  protected _isTelegraphing = false;
  protected _burstCount = 0;   // remaining shots in a burst
  protected _burstTimer = 0;   // time between burst shots
  protected trail: EnemyTrail;
  pattern: PatternBase | null = null;

  private static nextId = 0;

  constructor(config: EnemyConfig, type: string, scene: THREE.Scene) {
    this._name = config.name;
    this._health = config.health;
    this._maxHealth = config.health;
    this._speed = config.speed;
    this._damage = config.damage;
    this._score = config.score;
    this._size = config.size;
    this._color = config.color;
    this._type = type;
    this._id = Enemy.nextId++;
    this.eventBus = EventBus.getInstance();
    this.group = new THREE.Group();
    this.body = EnemyMeshFactory.create(type, this._size, this._color);
    this.group.add(this.body);
    this.trail = new EnemyTrail(scene, this._color);
    this.group.visible = false;
  }

  // ── Getters ──
  get mesh(): THREE.Group { return this.group; }
  get position(): THREE.Vector3 { return this.group.position; }
  get active(): boolean { return this._active; }
  get type(): string { return this._type; }
  get id(): number { return this._id; }
  get damage(): number { return this._damage; }
  get score(): number { return this._score; }
  get speed(): number { return this._speed; }
  get size(): number { return this._size; }
  get ramming(): boolean { return this._ramming; }
  get ramVelocity(): THREE.Vector3 { return this._ramVelocity; }

  // ── AI queries ──
  canShoot(): boolean { return this._shootTimer >= this._shootCooldown; }
  canRam(): boolean { return this._ramTimer >= this._ramCooldown && !this._ramming; }

  resetShootTimer(): void { this._shootTimer = 0; this._shootCooldown = 1.0 + Math.random() * 1.5; }
  resetRamTimer(): void { this._ramTimer = 0; this._ramCooldown = 4.0 + Math.random() * 3.0; }

  startRam(targetPos: THREE.Vector3): void {
    this._ramming = true; this._ramTimer = 0;
    this._ramDuration = 0.5 + Math.random() * 0.3;
    const dir = targetPos.clone().sub(this.group.position).normalize();
    this._ramVelocity.copy(dir).multiplyScalar(this._speed * 2.5);
  }

  endRam(): void { this._ramming = false; this._ramVelocity.set(0, 0, 0); }

  getShootPosition(): THREE.Vector3 {
    // lookAt orients +Z toward the player, so +Z is the front of the enemy
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
    return this.group.position.clone().add(fwd.multiplyScalar(this._size * 0.8));
  }

  // ── Lifecycle ──
  configure(config: EnemyConfig, type: string): void {
    const typeChanged = type !== this._type;
    this._name = config.name;
    this._maxHealth = config.health;
    this._health = config.health;
    this._speed = config.speed;
    this._damage = config.damage;
    this._score = config.score;
    this._size = config.size;
    this._color = config.color;
    this._type = type;
    if (typeChanged) {
      this.group.remove(this.body);
      this.body.traverse((child) => {
        if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
      });
      this.body = EnemyMeshFactory.create(type, this._size, this._color);
      this.group.add(this.body);
    }
  }

  init(position: THREE.Vector3, _target: THREE.Vector3): void {
    this.group.position.copy(position);
    this._health = this._maxHealth;
    this._active = true; this._age = 0;
    this._velocity.set(0, 0, 0);
    this._shootTimer = Math.random() * this._shootCooldown;
    this._ramTimer = Math.random() * this._ramCooldown;
    this._ramming = false; this._ramVelocity.set(0, 0, 0);
    this.group.visible = true;
    this._rollSpeed = (Math.random() - 0.5) * 4;
    this._yawSpeed = (Math.random() - 0.5) * 2;
    this._retreatTimer = 0;
    this._telegraphTimer = 0;
    this._isTelegraphing = false;
    this._burstCount = 0;
    this._burstTimer = 0;
    this.trail.start(position);
  }

  takeDamage(amount: number): boolean {
    this._health -= amount;
    if (this._health <= 0) { this._health = 0; this.destroy(); return true; }
    return false;
  }

  destroy(): void {
    this._active = false; this.group.visible = false;
    this.eventBus.emit(GameEvent.ENEMY_DESTROYED, {
      type: this._type, score: this._score,
      position: { x: this.group.position.x, y: this.group.position.y, z: this.group.position.z },
    });
  }

  // ── Combat update: telegraph → burst → retreat → pattern, plus evasion ──
  updateCombat(
    dt: number,
    playerPos: THREE.Vector3,
    projectiles?: Projectile[],
    onShoot?: (shootPos: THREE.Vector3, dir: THREE.Vector3) => void,
  ): void {
    if (!this._active) return;
    this._shootTimer += dt;

    if (this._isTelegraphing) {
      this._telegraphTimer -= dt;
      if (this._telegraphTimer <= 0) {
        // Telegraph ended → FIRE! 30% chance of burst (3 shots)
        if (Math.random() < 0.3) {
          this._burstCount = 3;
          this._burstTimer = 0;
          this.fireLaser(playerPos, onShoot);
          this._burstCount--;
        } else {
          this.fireLaser(playerPos, onShoot);
        }
        this.stopTelegraph();
        this.resetShootTimer();
        this._retreatTimer = 2.0;
      }
      // While telegraphing, drift slightly toward player
      const drift = this.position.clone().sub(playerPos).normalize();
      this.position.x -= drift.x * 2 * dt;
      this.position.y -= drift.y * 2 * dt;
    } else if (this.tickBurst(playerPos, dt, onShoot)) {
      // Burst in progress — movement handled below
    } else if (this._retreatTimer > 0) {
      this.updateRetreat(dt, playerPos);
    } else {
      this.dodgeIncomingLasers(projectiles, dt);
      if (this.pattern) {
        this.pattern.update(this, dt, playerPos, projectiles);
      } else {
        this.update(dt, playerPos);
      }
      // Check if should start telegraphing (about to attack)
      const distToPlayer = this.position.distanceTo(playerPos);
      if (distToPlayer < 45 && distToPlayer > 5 && this.canShoot()) {
        this.startTelegraph(0.8);
      }
    }

    this.performAcrobatics(dt);
    this.trail.update(dt, this.position);
    this.mesh.lookAt(playerPos);

    // Safety: deactivate if behind the player (no score — just remove)
    if (this._active && this.position.z > playerPos.z + 8) {
      this.reset();
    }
  }

  private tickBurst(playerPos: THREE.Vector3, dt: number, onShoot?: (s: THREE.Vector3, d: THREE.Vector3) => void): boolean {
    if (this._burstCount <= 0) return false;
    this._burstTimer -= dt;
    if (this._burstTimer <= 0) {
      this.fireLaser(playerPos, onShoot);
      this._burstCount--;
      this._burstTimer = 0.15; // 150ms between burst shots
    }
    return true;
  }

  private fireLaser(playerPos: THREE.Vector3, onShoot?: (s: THREE.Vector3, d: THREE.Vector3) => void): void {
    if (!onShoot) return;
    const shootPos = this.getShootPosition();
    const dir = playerPos.clone().sub(shootPos);
    // Moderate inaccuracy
    dir.x += (Math.random() - 0.5) * 0.4;
    dir.y += (Math.random() - 0.5) * 0.4;
    dir.z += (Math.random() - 0.5) * 0.15;
    dir.normalize();
    onShoot(shootPos, dir);
  }

  private updateRetreat(dt: number, playerPos: THREE.Vector3): void {
    this._retreatTimer -= dt;
    const away = this.position.clone().sub(playerPos).normalize();
    const retreatSpeed = this._speed * 1.5;
    this.position.x += away.x * retreatSpeed * dt;
    this.position.y += away.y * retreatSpeed * dt;
    this.position.z -= retreatSpeed * dt * 0.3;
    // Clamp retreat so enemies stay within reach of the crosshair
    const dx = this.position.x - playerPos.x;
    const dy = this.position.y - playerPos.y;
    if (Math.abs(dx) > 12) this.position.x = playerPos.x + Math.sign(dx) * 12;
    if (Math.abs(dy) > 7) this.position.y = playerPos.y + Math.sign(dy) * 7;
  }

  private dodgeIncomingLasers(projectiles: Projectile[] | undefined, dt: number): void {
    if (!projectiles) return;
    for (const proj of projectiles) {
      if (!proj.active) continue;
      const d = this.position.distanceTo(proj.position);
      if (d < 6) {
        // Check if laser is heading roughly toward the enemy
        const laserDir = proj.velocity.clone().normalize();
        const toEnemy = this.position.clone().sub(proj.position).normalize();
        if (laserDir.dot(toEnemy) > 0.7) {
          // Laser is coming at us — strafe perpendicular
          const perp = new THREE.Vector3(-laserDir.z, 0, laserDir.x).normalize();
          const side = Math.sign(perp.dot(this.position.clone().sub(proj.position)));
          this.position.x += perp.x * side * this._speed * 2 * dt;
          this.position.y += (Math.random() - 0.5) * this._speed * dt;
          break;
        }
      }
    }
  }

  // ── Acrobatics ──
  performAcrobatics(dt: number): void {
    this.body.rotation.z += this._rollSpeed * dt;
    this.body.rotation.y += this._yawSpeed * dt;
  }

  spinBody(angle: number): void {
    this.body.rotation.z += angle;
  }

  // ── Telegraph: glow red before shooting to give player reaction time ──
  startTelegraph(duration: number): void {
    this._isTelegraphing = true;
    this._telegraphTimer = duration;
    // Make the body glow red
    this.body.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
        (child.material as THREE.MeshPhongMaterial).emissive.setHex(0xff0000);
        (child.material as THREE.MeshPhongMaterial).emissiveIntensity = 1.5;
      }
    });
  }

  stopTelegraph(): void {
    this._isTelegraphing = false;
    this._telegraphTimer = 0;
    // Restore original color
    this.body.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhongMaterial) {
        (child.material as THREE.MeshPhongMaterial).emissive.setHex(this._color);
        (child.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.7;
      }
    });
  }

  get isTelegraphing(): boolean { return this._isTelegraphing; }

  // ── Default update (slow approach, no ram) ──
  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this._active) return;
    this._age += dt;
    this._shootTimer += dt;
    this.performAcrobatics(dt);

    // Constant-speed approach toward player center
    const targetZ = playerPos.z - 5;
    const target = new THREE.Vector3(playerPos.x, playerPos.y, targetZ);
    const dir = target.clone().sub(this.group.position);
    const dist = dir.length();
    if (dist > 0.1) {
      dir.normalize();
      const move = Math.min(this._speed * dt, dist);
      this.group.position.add(dir.multiplyScalar(move));
    }
    this.group.lookAt(playerPos);
    this.trail.update(dt, this.group.position);
    if (this._age > this._maxAge) { this._active = false; this.group.visible = false; }
  }

  reset(): void {
    this._active = false; this._age = 0;
    this._health = this._maxHealth;
    this._shootTimer = 0; this._ramTimer = 0;
    this._ramming = false; this._ramVelocity.set(0, 0, 0);
    this.group.visible = false;
    this.trail.stop();
  }

  dispose(): void {
    this.trail.dispose();
    this.group.parent?.remove(this.group);
    this.body.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
}
