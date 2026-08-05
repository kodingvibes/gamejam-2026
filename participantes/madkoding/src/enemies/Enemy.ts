// ─── Enemy Base Class ────────────────────────────────────────────────────────

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { RAIL } from '../types/config';
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
  protected _burstShotIndex = 0; // which shot in the burst (0,1,2...)
  protected trail: EnemyTrail;
  pattern: PatternBase | null = null;

  // ── Emergence from hangar (Homeworld-style launch) ──
  protected _emerging = false;
  protected _emergenceStart = new THREE.Vector3();
  protected _emergenceEnd = new THREE.Vector3();
  protected _emergenceProgress = 0;
  protected _emergenceDuration = 2;
  protected _emergencePhase = 0;

  // ── Damage flash ──
  protected _damageFlashTimer = 0;
  protected _damageFlashDuration = 0.12;

  // ── Health bar ──
  protected _healthBar: THREE.Mesh;
  protected _healthBarBg: THREE.Mesh;

  // ── Fade when outside the firing range (can't tell ahead/behind) ──
  protected _fadeAlpha = 1;
  protected _fadeTarget = 1;
  protected _fadeSpeed = 4;

  // ── Flight state machine: hangar → approach → attack → overfly → return ──
  protected _hangarPos = new THREE.Vector3();
  protected _flightState: 'EMERGING' | 'APPROACH' | 'ATTACK' | 'OVERFLY' | 'RETURN' = 'EMERGING';
  protected _stateTimer = 0;
  protected _pirouetteAngle = 0;
  protected _pirouetteDir = 1;
  protected _loiterCenter = new THREE.Vector3();
  protected _loiterPhase = 0;
  protected _overflyDir = new THREE.Vector3(0, 0, 1);

  // The player flies forward along -Z at rail speed. Enemies must fly faster
  // than the rail to actually reach and pass the player (like a plane).
  private _forwardDrift = RAIL.RAIL_SPEED;
  // Constant flight speed for all states — never reduces. Slightly above the
  // rail speed so enemies still catch up, but slower so they loiter longer.
  private _flightSpeed = RAIL.RAIL_SPEED * 0.85;
  // Random per-enemy aim offset so enemies don't all converge on the exact
  // same point — each one picks its own approach target.
  private _approachOffset = new THREE.Vector3();

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
    this.trail = new EnemyTrail(scene, this._color, this._size * 2 / 3);

    // Health bar: a thin bar above the enemy
    const barGeo = new THREE.PlaneGeometry(1.6, 0.12);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, depthWrite: false, depthTest: true, transparent: true });
    this._healthBar = new THREE.Mesh(barGeo, barMat);
    this._healthBar.position.set(0, this._size * 1.2, 0);
    this._healthBar.renderOrder = 998;

    const bgGeo = new THREE.PlaneGeometry(1.8, 0.16);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x222222, depthWrite: false, depthTest: true, transparent: true, opacity: 0.6 });
    this._healthBarBg = new THREE.Mesh(bgGeo, bgMat);
    this._healthBarBg.position.set(0, this._size * 1.2, -0.01);
    this._healthBarBg.renderOrder = 997;

    this.group.add(this._healthBarBg);
    this.group.add(this._healthBar);
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
      this.trail.setColor(this._color);
    }
  }

  init(position: THREE.Vector3, _target: THREE.Vector3, origin?: THREE.Vector3): void {
    this.group.position.copy(origin ? origin.clone() : position);
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
    this._burstShotIndex = 0;

    // Random per-enemy approach offset so each enemy aims at its own point
    // near the player instead of all converging on the exact same spot.
    this._approachOffset.set(
      (Math.random() - 0.5) * 16,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 8,
    );

    // Emergence from hangar: if an origin is given, fly a sweeping curve from
    // the corvette toward the player, then attack and return to the hangar.
    if (origin) {
      this._hangarPos.copy(origin);
      this._emerging = true;
      this._flightState = 'EMERGING';
      this._emergenceStart.copy(origin);
      this._emergenceEnd.copy(position);
      this._emergenceProgress = 0;
      this._emergenceDuration = 2.0 + Math.random() * 1.0;
      this._emergencePhase = Math.random() * Math.PI * 2;
      this._stateTimer = 0;
      this._pirouetteAngle = 0;
      this._pirouetteDir = Math.random() < 0.5 ? -1 : 1;
      this.trail.start(origin);
    } else {
      this._emerging = false;
      this._flightState = 'ATTACK';
      this._stateTimer = 0;
      this.trail.start(position);
    }
  }

  takeDamage(amount: number): boolean {
    this._health -= amount;
    this._damageFlashTimer = this._damageFlashDuration;
    if (this._health <= 0) { this._health = 0; this.destroy(); return true; }
    return false;
  }

  destroy(): void {
    this._active = false; this.group.visible = false;
    this.trail.fadeOut();
    this.eventBus.emit(GameEvent.ENEMY_DESTROYED, {
      type: this._type, score: this._score,
      position: { x: this.group.position.x, y: this.group.position.y, z: this.group.position.z },
    });
  }

  // ── Combat update: hangar → approach → attack → overfly → return ──
  // Velocity-based flight: each state sets a constant velocity vector and the
  // enemy integrates it. No rail-drift hack — the enemy flies like a plane at
  // its own constant speed, approaching, passing the player, and returning.
  updateCombat(
    dt: number,
    playerPos: THREE.Vector3,
    projectiles?: Projectile[],
    onShoot?: (shootPos: THREE.Vector3, dir: THREE.Vector3) => void,
  ): void {
    if (!this._active) return;

    this._stateTimer += dt;

    switch (this._flightState) {
      case 'EMERGING': {
        // Fly from the hangar toward the player with a sweeping, banking curve.
        this._emergenceProgress += dt / this._emergenceDuration;
        if (this._emergenceProgress >= 1) {
          this._emergenceProgress = 1;
          this._emerging = false;
          this._flightState = 'APPROACH';
          this._stateTimer = 0;
        } else {
          const p = this._emergenceProgress;
          const travel = this._emergenceEnd.distanceTo(this._emergenceStart);
          const amp = Math.min(6, travel * 0.35);
          const weave = Math.sin(p * Math.PI * 2 * 1.5 + this._emergencePhase) * (1 - p) * amp;
          const weaveY = Math.cos(p * Math.PI * 2 * 1.2 + this._emergencePhase) * (1 - p) * amp * 0.6;
          this.group.position.lerpVectors(this._emergenceStart, this._emergenceEnd, p);
          this.group.position.x += weave;
          this.group.position.y += weaveY;
          this.body.rotation.z = Math.sin(p * Math.PI * 2 * 1.5 + this._emergencePhase) * 0.6 * (1 - p);
        }
        break;
      }

      case 'APPROACH': {
        // Fly toward the player at constant speed with gentle pirouettes.
        this._pirouetteAngle += this._pirouetteDir * dt * 2.5;
        this.body.rotation.z = Math.sin(this._pirouetteAngle) * 0.6;
        this.body.rotation.y = Math.cos(this._pirouetteAngle) * 0.4;

        // Aim at a random offset point near the player, not the exact center.
        const aim = playerPos.clone().add(this._approachOffset);
        const dir = aim.sub(this.group.position);
        const dist = dir.length();
        if (dist > 0.1) {
          dir.normalize();
          // Constant flight speed — always exceeds the rail so the enemy
          // actually catches up to and passes the player.
          this._velocity.copy(dir).multiplyScalar(this._flightSpeed);
        } else {
          this._velocity.set(0, 0, 0);
        }

        // Once close enough — or after a max approach time — switch to attack.
        // Break off from a comfortable distance so the enemy doesn't fly right
        // on top of the player before starting its dive.
        if (dist < 60 || this._stateTimer > 2.5) {
          this._flightState = 'ATTACK';
          this._stateTimer = 0;
        }
        break;
      }

      case 'ATTACK': {
        // Dive at the player at constant speed, firing. After a short window,
        // keep flying straight past the player (like a plane) — never stop.
        const aim = playerPos.clone().add(this._approachOffset);
        const dir = aim.sub(this.group.position);
        const dist = dir.length();
        if (dist > 0.1) {
          dir.normalize();
          this._velocity.copy(dir).multiplyScalar(this._flightSpeed * 1.05);
        } else {
          this._velocity.set(0, 0, 0);
        }
        this.body.rotation.z = Math.sin(this._stateTimer * 4) * 0.4;

        // Fire at the player in 3-shot bursts. Only the 3rd shot is accurate;
        // the first two are warning shots (high inaccuracy).
        this._shootTimer += dt;
        if (this.canShoot() && dist < 30 && this._burstCount === 0) {
          this._burstCount = 3;
          this._burstShotIndex = 0;
          this._burstTimer = 0;
          this.resetShootTimer();
        }
        if (this._burstCount > 0) {
          this._burstTimer -= dt;
          if (this._burstTimer <= 0) {
            this.fireLaser(playerPos, onShoot);
            this._burstShotIndex++;
            this._burstCount--;
            this._burstTimer = 0.18;
          }
        }

        // After the attack window, keep flying straight past the player.
        if (this._stateTimer > 2.5 || dist < 6) {
          this._flightState = 'OVERFLY';
          this._stateTimer = 0;
          // Store the current heading so we keep flying straight.
          this._overflyDir.copy(this._velocity).normalize();
        }
        break;
      }

      case 'OVERFLY': {
        // Keep flying forward at constant speed. If a movement pattern is
        // assigned, let it shape the overflight trajectory (zigzag, dive,
        // circle, sweep); otherwise fly straight along the stored heading.
        if (this.pattern) {
          this.pattern.update(this, dt, playerPos, projectiles);
          this._velocity.set(0, 0, 0);
          this.group.position.addScaledVector(this._overflyDir, this._flightSpeed * dt);
        } else {
          this._velocity.copy(this._overflyDir).multiplyScalar(this._flightSpeed);
        }
        this.body.rotation.z = Math.sin(this._stateTimer * 3) * 0.4;

        // Fire while overflying in 3-shot bursts (only 3rd is accurate).
        this._shootTimer += dt;
        if (this.canShoot() && this._burstCount === 0) {
          this._burstCount = 3;
          this._burstShotIndex = 0;
          this._burstTimer = 0;
          this.resetShootTimer();
        }
        if (this._burstCount > 0) {
          this._burstTimer -= dt;
          if (this._burstTimer <= 0) {
            this.fireLaser(playerPos, onShoot);
            this._burstShotIndex++;
            this._burstCount--;
            this._burstTimer = 0.18;
          }
        }

        // After flying past, turn around and return to the hangar.
        if (this._stateTimer > 3) {
          this._flightState = 'RETURN';
          this._stateTimer = 0;
        }
        break;
      }

      case 'RETURN': {
        // Fly back toward the hangar at constant speed with a gentle weave.
        const dir = this._hangarPos.clone().sub(this.group.position);
        const dist = dir.length();
        if (dist > 0.1) {
          dir.normalize();
          this._velocity.copy(dir).multiplyScalar(this._flightSpeed);
        } else {
          this._velocity.set(0, 0, 0);
        }
        this.body.rotation.z = Math.sin(this._stateTimer * 3) * 0.5;

        // Reached the hangar (or gave up after a while) → recycle.
        if (dist < 4 || this._stateTimer > 12) {
          this.reset();
          return;
        }
        break;
      }
    }

    // Integrate the constant velocity. Enemies fly at a constant speed that
    // exceeds the rail speed, so they catch up to, pass, and return past the
    // player like planes — never stopping at a fixed point.
    this.group.position.addScaledVector(this._velocity, dt);

    this.performAcrobatics(dt);
    this.trail.update(dt, this.position);
    this.mesh.lookAt(playerPos);

    // Damage flash
    this.updateDamageFlash(dt);

    // Health bar: always face camera, update width
    this.updateHealthBar(playerPos);

    // Telegraph visual
    this.updateTelegraph(dt);

    // Fade out when outside the firing range (can't tell if ahead/behind).
    this.updateRangeFade(playerPos);

    // Safety: deactivate if behind the player — no damage from behind.
    if (this._active && this.position.z > playerPos.z + 2) {
      this.reset();
    }
  }

  // Fade the enemy's body out when it's outside the reachable firing range,
  // so the player can't tell if it's ahead or behind the ship.
  private updateRangeFade(playerPos: THREE.Vector3): void {
    const dx = this.position.x - playerPos.x;
    const dy = this.position.y - playerPos.y;
    const dz = this.position.z - playerPos.z;
    // Reachable firing box around the player — expanded for enemies coming
    // from all directions (including behind).
    const inRange =
      Math.abs(dx) <= 20 && Math.abs(dy) <= 12 && dz > -80 && dz < 30;
    this._fadeTarget = inRange ? 1 : 0.15;

    // Smoothly move current alpha toward the target.
    const diff = this._fadeTarget - this._fadeAlpha;
    if (Math.abs(diff) > 0.001) {
      this._fadeAlpha += diff * Math.min(1, this._fadeSpeed * 0.016);
      this.applyFade(this._fadeAlpha);
    }
  }

  private applyFade(alpha: number): void {
    this.body.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mat = child.material as THREE.Material;
        if (mat.transparent) {
          mat.opacity = alpha;
        }
      }
    });
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
    // First two shots in a burst are warning shots (wide miss). Only the 3rd
    // (burstShotIndex === 2) is accurate and can hit the player.
    const isFinalShot = this._burstShotIndex >= 2;
    const spread = isFinalShot ? 0.04 : 0.55;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * (isFinalShot ? 0.05 : 0.25);
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

  // ── Damage flash: white flash on hit ──
  private updateDamageFlash(dt: number): void {
    if (this._damageFlashTimer > 0) {
      this._damageFlashTimer -= dt;
      const flash = this._damageFlashTimer > 0;
      this.body.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = flash ? 2.0 : 0.3;
          }
        }
      });
    }
  }

  // ── Health bar: billboarded bar above the enemy ──
  private updateHealthBar(playerPos: THREE.Vector3): void {
    const ratio = this._health / this._maxHealth;
    this._healthBar.scale.x = ratio;
    // Shift bar left so it shrinks from the right
    this._healthBar.position.x = -(1 - ratio) * 0.8;
    // Color: green → yellow → red
    const hue = ratio * 0.33;
    (this._healthBar.material as THREE.MeshBasicMaterial).color.setHSL(hue, 1, 0.5);
    // Always face the camera (billboard)
    this._healthBar.lookAt(playerPos);
    this._healthBarBg.lookAt(playerPos);
  }

  // ── Telegraph: brief pause before shooting to give player reaction time ──
  startTelegraph(duration: number): void {
    this._isTelegraphing = true;
    this._telegraphTimer = duration;
  }

  stopTelegraph(): void {
    this._isTelegraphing = false;
    this._telegraphTimer = 0;
  }

  get isTelegraphing(): boolean { return this._isTelegraphing; }

  // ── Telegraph visual: glow pulse when about to shoot ──
  private updateTelegraph(dt: number): void {
    if (this._isTelegraphing) {
      this._telegraphTimer -= dt;
      const pulse = Math.sin(this._telegraphTimer * 20) * 0.5 + 0.5;
      this.body.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat.emissiveIntensity !== undefined) {
            mat.emissiveIntensity = 0.3 + pulse * 1.5;
          }
        }
      });
      if (this._telegraphTimer <= 0) this.stopTelegraph();
    }
  }

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
    this._emerging = false;
    this._flightState = 'EMERGING';
    this._stateTimer = 0;
    this._loiterPhase = 0;
    this._burstCount = 0; this._burstTimer = 0; this._burstShotIndex = 0;
    this.group.visible = false;
    this.trail.stop();
  }

  // Advance the trail fade for destroyed enemies (called by the manager).
  updateTrailFade(dt: number): void {
    this.trail.update(dt, this.position);
  }

  dispose(): void {
    this.trail.dispose();
    this._healthBar.geometry.dispose();
    (this._healthBar.material as THREE.Material).dispose();
    this._healthBarBg.geometry.dispose();
    (this._healthBarBg.material as THREE.Material).dispose();
    this.group.parent?.remove(this.group);
    this.body.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
}
