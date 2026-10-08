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
  protected _velocity = new THREE.Vector3();
  protected _shootTimer = 0;
  protected _shootCooldown = 1.5;
  protected _rollSpeed = 0;
  protected _yawSpeed = 0;
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
  protected _overflyDir = new THREE.Vector3(0, 0, 1);

  // The player flies forward along -Z at rail speed. Enemies must fly faster
  // than the rail to actually reach and pass the player (like a plane).
  // Constant flight speed for all states — never reduces. Must exceed the rail
  // speed so enemies actually catch up to the player instead of falling behind.
  private _flightSpeed = RAIL.RAIL_SPEED * 1.3;
  // Random per-enemy aim offset so enemies don't all converge on the exact
  // same point — each one picks its own approach target.
  private _approachOffset = new THREE.Vector3();
  // Fixed target point for the current flight state — set once on state entry
  // so the enemy flies a straight line like a plane, not a homing missile.
  private _approachTarget = new THREE.Vector3();

  // ── Tunnel confinement ──
  // Optional rail curve + tunnel radius so enemies in cave/ice biomes stay
  // inside the tunnel instead of flying through the walls.
  private _tunnelCurve: THREE.CatmullRomCurve3 | null = null;
  private _tunnelRadius = 0;

  private static nextId = 0;

  // ── Motion: warp-in pop on spawn + squash punch on hit ──
  private _spawnAnim = 1;
  private _hitPunch = 0;

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

  // ── AI queries ──
  canShoot(): boolean { return this._shootTimer >= this._shootCooldown; }

  resetShootTimer(): void { this._shootTimer = 0; this._shootCooldown = 1.0 + Math.random() * 1.5; }

  getShootPosition(): THREE.Vector3 {
    // lookAt orients +Z toward the player (regular Object3D), so +Z is the front
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.group.quaternion);
    return this.group.position.clone().add(fwd.multiplyScalar(this._size * 0.8));
  }

  /** Optional tunnel confinement: keep the enemy inside the rail tunnel. */
  setTunnel(curve: THREE.CatmullRomCurve3 | null, radius: number): void {
    this._tunnelCurve = curve;
    this._tunnelRadius = radius;
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
    this._active = true;
    this._age = 0;
    this._velocity.set(0, 0, 0);
    this._shootTimer = Math.random() * this._shootCooldown;
    this.group.visible = true;
    this._rollSpeed = (Math.random() - 0.5) * 4;
    this._yawSpeed = (Math.random() - 0.5) * 2;
    this._telegraphTimer = 0;
    this._isTelegraphing = false;
    this._burstCount = 0;
    this._burstTimer = 0;
    this._burstShotIndex = 0;
    this._emerging = false;
    this._flightState = 'EMERGING';
    this._stateTimer = 0;
    this._emergenceProgress = 0;
    this._approachTarget.set(0, 0, 0);
    this._overflyDir.set(0, 0, 1);
    this._spawnAnim = 0;
    this._hitPunch = 0;
    this._damageFlashTimer = 0;
    this.group.scale.setScalar(0.01);
    this.applyTint(1);

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
      this._emergenceDuration = 0.8 + Math.random() * 0.6;
      this._emergencePhase = Math.random() * Math.PI * 2;
      this._stateTimer = 0;
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
    this._hitPunch = 1;
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
  //
  // Key design: each state picks a FIXED target on entry and flies toward it
  // without recalculating every frame. This prevents the "homing missile"
  // effect where enemies snap toward the player each frame.
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
          // Fix approach target: a point ahead of the player with offset.
          this._approachTarget.copy(playerPos).add(this._approachOffset);
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
        // Fly toward the FIXED approach target at constant speed.
        // No per-frame recalculation — the enemy flies a straight line.
        const dir = this._approachTarget.clone().sub(this.group.position);
        const dist = dir.length();
        if (dist > 0.1) {
          dir.normalize();
          this._velocity.copy(dir).multiplyScalar(this._flightSpeed);
        } else {
          this._velocity.set(0, 0, 0);
        }
        this.body.rotation.z = Math.sin(this._stateTimer * 2) * 0.3;

        // Once close enough — or after a max approach time — switch to attack.
        if (dist < 50 || this._stateTimer > 3) {
          this._flightState = 'ATTACK';
          this._stateTimer = 0;
        }
        break;
      }

      case 'ATTACK': {
        // Continue flying forward at constant speed. Don't home — just fly
        // straight past the player like a plane. The enemy is already heading
        // toward the player area from the approach phase.
        this.body.rotation.z = Math.sin(this._stateTimer * 4) * 0.3;

        // Fire at the player in 3-shot bursts.
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

        // After the attack window, keep flying straight past the player.
        if (this._stateTimer > 2.5) {
          this._flightState = 'OVERFLY';
          this._stateTimer = 0;
          this._overflyDir.copy(this._velocity).normalize();
        }
        break;
      }

      case 'OVERFLY': {
        // Keep flying forward at constant speed.
        if (this.pattern) {
          this.pattern.update(this, dt, playerPos, projectiles);
          this._velocity.set(0, 0, 0);
          this.group.position.addScaledVector(this._overflyDir, this._flightSpeed * dt);
        } else {
          this._velocity.copy(this._overflyDir).multiplyScalar(this._flightSpeed);
        }
        this.body.rotation.z = Math.sin(this._stateTimer * 3) * 0.3;

        // Fire while overflying in 3-shot bursts.
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
        // Fly back toward the hangar at constant speed.
        const dir = this._hangarPos.clone().sub(this.group.position);
        const dist = dir.length();
        if (dist > 0.1) {
          dir.normalize();
          this._velocity.copy(dir).multiplyScalar(this._flightSpeed);
        } else {
          this._velocity.set(0, 0, 0);
        }
        this.body.rotation.z = Math.sin(this._stateTimer * 3) * 0.3;

        // Reached the hangar (or gave up after a while) → recycle.
        if (dist < 4 || this._stateTimer > 12) {
          this.reset();
          return;
        }
        break;
      }
    }

    // Integrate the constant velocity.
    this.group.position.addScaledVector(this._velocity, dt);

    // Keep the enemy inside the tunnel (cave/ice) if a curve is provided.
    this.confineToTunnel();

    this.performAcrobatics(dt);
    this.trail.update(dt, this.position);
    this.mesh.lookAt(playerPos);

    // Spawn pop (easeOutBack) + hit punch
    if (this._spawnAnim < 1) {
      this._spawnAnim = Math.min(1, this._spawnAnim + dt * 2.2);
      const t = this._spawnAnim - 1;
      const back = 1 + 2.7 * t * t * t + 1.7 * t * t;
      this.group.scale.setScalar(Math.max(0.01, back));
      if (this._damageFlashTimer <= 0) this.applyTint(1 - this._spawnAnim);
    } else if (this._hitPunch > 0) {
      this._hitPunch = Math.max(0, this._hitPunch - dt * 7);
      const k = Math.sin(this._hitPunch * Math.PI) * 0.22;
      this.group.scale.set(1 + k, 1 - k * 0.6, 1 + k);
    } else if (this.group.scale.x !== 1) {
      this.group.scale.setScalar(1);
    }

    // Damage flash
    this.updateDamageFlash(dt);

    // Health bar: always face camera, update width
    this.updateHealthBar(playerPos);

    // Telegraph visual
    this.updateTelegraph(dt);

    // Fade out when outside the firing range.
    this.updateRangeFade(playerPos);

    // Safety: deactivate if behind the player — no damage from behind.
    if (this._active && this.position.z > playerPos.z + 2) {
      this.reset();
    }
  }

  // Keep the enemy inside the rail tunnel (cave/ice). Projects the enemy's
  // current Z onto the curve, finds the nearest point on the path, and if the
  // enemy has drifted beyond the tunnel radius, pulls it back toward the path.
  private confineToTunnel(): void {
    if (!this._tunnelCurve || this._tunnelRadius <= 0) return;
    const curve = this._tunnelCurve;
    // Find the curve progress nearest to the enemy's Z via binary search.
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      if (curve.getPointAt(mid).z > this.position.z) lo = mid; else hi = mid;
    }
    const center = curve.getPointAt((lo + hi) / 2);
    const dx = this.position.x - center.x;
    const dy = this.position.y - center.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this._tunnelRadius) {
      const scale = this._tunnelRadius / dist;
      this.position.x = center.x + dx * scale;
      this.position.y = center.y + dy * scale;
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
    // Normalize BEFORE adding spread — on the raw (~50 unit) vector the
    // "warning shot" spread was negligible and every shot was a sniper shot.
    const dir = playerPos.clone().sub(shootPos).normalize();
    // First two shots in a burst are warning shots (wide miss). Only the 3rd
    // (burstShotIndex === 2) is accurate and can hit the player.
    const isFinalShot = this._burstShotIndex >= 2;
    const spread = isFinalShot ? 0.02 : 0.12;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.normalize();
    onShoot(shootPos, dir);
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
  // Tints toward white from each material's ORIGINAL color (cached in
  // userData) — the old version restored every part to the enemy's accent
  // color, permanently repainting grey hulls and white engine cores.
  private updateDamageFlash(dt: number): void {
    if (this._damageFlashTimer > 0) {
      this._damageFlashTimer = Math.max(0, this._damageFlashTimer - dt);
      this.applyTint(this._damageFlashTimer / this._damageFlashDuration);
    }
  }

  private static readonly _white = new THREE.Color(1, 1, 1);
  private applyTint(amount: number): void {
    this.body.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      if (!mat.color) return;
      const ud = mat.userData as { baseColor?: THREE.Color; baseEmissive?: THREE.Color; baseEI?: number };
      if (!ud.baseColor) {
        ud.baseColor = mat.color.clone();
        if (mat.emissive) { ud.baseEmissive = mat.emissive.clone(); ud.baseEI = mat.emissiveIntensity; }
      }
      mat.color.copy(ud.baseColor).lerp(Enemy._white, amount);
      if (mat.emissive && ud.baseEmissive) {
        mat.emissive.copy(ud.baseEmissive).lerp(Enemy._white, amount);
        mat.emissiveIntensity = (ud.baseEI ?? 0) + amount * 2.5;
      }
    });
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
      if (this._damageFlashTimer <= 0) this.applyTint(pulse * 0.5);
      if (this._telegraphTimer <= 0) { this.stopTelegraph(); this.applyTint(0); }
    }
  }

  reset(): void {
    this._active = false; this._age = 0;
    this._health = this._maxHealth;
    this._shootTimer = 0;
    this._emerging = false;
    this._flightState = 'EMERGING';
    this._stateTimer = 0;
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
