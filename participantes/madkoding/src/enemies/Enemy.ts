// ─── Enemy: a pilot flying an authored manoeuvre ─────────────────────────────
//
// Flight model
//   • The enemy samples its FlightPlan (a spline in rail-local space) and maps
//     it into the world through the current rail frame.
//   • Heading comes from the resulting WORLD velocity (so it includes the
//     rail's forward motion): ships point where they actually travel.
//   • Bank is driven by lateral acceleration — they roll into every turn —
//     plus scripted/evasive barrel rolls and hit wobble.
//   • While firing, the pilot swings the nose toward the player, charges the
//     cannons (visible glow) and fires short bursts with muzzle flashes.
//
// Personality: interceptors and scouts juke incoming lasers, bombers lumber,
// drones spin their blade ring. Everything is per-instance and allocation-free
// in the hot path.

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { EnemyMeshFactory, type EnemyRig } from './EnemyMeshFactory';
import { EnemyTrail } from './EnemyTrail';
import { buildPlan, type FlightPlan, type PlanName, type PlanSlot } from './FlightPlans';
import { getSoftParticleTexture } from '../fx/softTexture';
import type { Projectile } from '../weapons/Projectile';

export interface EnemyConfig {
  name: string; health: number; speed: number; damage: number;
  score: number; size: number; color: number;
}

/** Rail frame shared by all enemies each frame (set by EnemyManager). */
export interface RailFrame {
  position: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
}

const CHARGE_TIME = 0.38;
const BURST_GAP = 0.11;

// Scratch
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qAim = new THREE.Quaternion();
const _qRoll = new THREE.Quaternion();
const _zAxis = new THREE.Vector3(0, 0, 1);
const _white = new THREE.Color(1, 1, 1);

export class Enemy {
  protected group: THREE.Group;
  protected body: THREE.Group;
  protected rig: EnemyRig;
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
  protected trail: EnemyTrail;
  /** Manoeuvre to fly on the next init() (set by EnemyManager). */
  planName: PlanName = 'SWEEP';

  // Flight state
  private plan: FlightPlan | null = null;
  private _t = 0;                         // seconds into the plan
  private _local = new THREE.Vector3();   // rail-local position
  private _juke = new THREE.Vector3();    // evasive offset (rail-local)
  private _jukeVel = new THREE.Vector3();
  private _prevWorld = new THREE.Vector3();
  private _vel = new THREE.Vector3();
  private _prevVel = new THREE.Vector3();
  private _bank = 0;
  private _rollSpin = 0;                  // remaining scripted roll (rad)
  private _rollDir = 1;
  private _rollsDone = 0;
  private _jukeCooldown = 0;
  private _wobble = 0;
  private _firstFrame = true;
  private _age = 0;

  // Combat
  private _charge = 0;        // 0..1 cannon charge glow
  private _burstLeft = 0;
  private _burstTimer = 0;
  private _cooldown = 0;
  private _muzzleIdx = 0;
  private _muzzleFlash = 0;
  private muzzleSprite: THREE.Sprite;
  private chargeSprite: THREE.Sprite;

  // Motion juice
  private _spawnAnim = 1;
  private _hitPunch = 0;
  protected _damageFlashTimer = 0;
  protected _damageFlashDuration = 0.12;

  // Health bar (only shown once damaged)
  protected _healthBar: THREE.Mesh;
  protected _healthBarBg: THREE.Mesh;

  // Tunnel confinement (cave/ice): radius around the rail in local x/y.
  private _tunnelRadius = 0;

  /** Set when this enemy rams the player this frame (read by the manager). */
  rammed = false;

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
    this.rig = this.body.userData.rig as EnemyRig;
    this.group.add(this.body);
    this.trail = new EnemyTrail(scene, this._color, this._size * 0.5);

    const flashMat = () => new THREE.SpriteMaterial({
      map: getSoftParticleTexture(), color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.muzzleSprite = new THREE.Sprite(flashMat());
    this.chargeSprite = new THREE.Sprite(flashMat());
    this.chargeSprite.material.color.setHex(this._color);
    this.body.add(this.muzzleSprite, this.chargeSprite);

    const barGeo = new THREE.PlaneGeometry(1.6, 0.12);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, depthWrite: false, transparent: true });
    this._healthBar = new THREE.Mesh(barGeo, barMat);
    this._healthBar.renderOrder = 998;
    const bgGeo = new THREE.PlaneGeometry(1.8, 0.16);
    const bgMat = new THREE.MeshBasicMaterial({ color: 0x222222, depthWrite: false, transparent: true, opacity: 0.6 });
    this._healthBarBg = new THREE.Mesh(bgGeo, bgMat);
    this._healthBarBg.renderOrder = 997;
    this.group.add(this._healthBarBg, this._healthBar);
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

  setTunnel(_curve: THREE.CatmullRomCurve3 | null, radius: number): void {
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
      this.body.remove(this.muzzleSprite, this.chargeSprite);
      this.group.remove(this.body);
      this.body.traverse((child) => {
        if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
      });
      this.body = EnemyMeshFactory.create(type, this._size, this._color);
      this.rig = this.body.userData.rig as EnemyRig;
      this.body.add(this.muzzleSprite, this.chargeSprite);
      this.chargeSprite.material.color.setHex(this._color);
      this.group.add(this.body);
      this.trail.setColor(this._color);
    }
  }

  /** Start flying `planName` from the given formation slot. */
  init(slot: PlanSlot, frame: RailFrame, playerPos: THREE.Vector3): void {
    // Player position in rail-local space (attack legs aim at it).
    _v.subVectors(playerPos, frame.position);
    const playerLocal = _v2.set(_v.dot(frame.right), _v.dot(frame.up), _v.dot(frame.forward));
    const name: PlanName = this._type === 'BOMBER' ? 'CRUISE' : this.planName;
    this.plan = buildPlan(name, slot, playerLocal, 0.65 + this._speed * 0.55);

    this._health = this._maxHealth;
    this._active = true;
    this._t = 0;
    this._age = 0;
    this._juke.set(0, 0, 0);
    this._jukeVel.set(0, 0, 0);
    this._vel.set(0, 0, 0);
    this._prevVel.set(0, 0, 0);
    this._bank = 0;
    this._rollSpin = 0;
    this._rollsDone = 0;
    this._jukeCooldown = 1 + Math.random();
    this._wobble = 0;
    this._firstFrame = true;
    this._charge = 0;
    this._burstLeft = 0;
    this._burstTimer = 0;
    this._cooldown = Math.random() * 0.6;
    this._muzzleFlash = 0;
    this.rammed = false;

    this._spawnAnim = 0;
    this._hitPunch = 0;
    this._damageFlashTimer = 0;
    this.group.scale.setScalar(0.01);
    this.applyTint(0);
    for (const w of this.rig.wings) w.obj.rotation.z = w.closed;
    this._healthBar.visible = this._healthBarBg.visible = false;

    this.placeOnPlan(frame);
    this._prevWorld.copy(this.group.position);
    this.group.visible = true;
    this.trail.start(this.group.position);
  }

  takeDamage(amount: number): boolean {
    if (!this._active) return false;
    this._health -= amount;
    this._damageFlashTimer = this._damageFlashDuration;
    this._hitPunch = 1;
    this._wobble = 1;
    this._healthBar.visible = this._healthBarBg.visible = true;
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

  // ── Per-frame flight + combat ─────────────────────────────────────────────

  updateCombat(
    dt: number,
    playerPos: THREE.Vector3,
    frame: RailFrame,
    projectiles?: Projectile[],
    onShoot?: (shootPos: THREE.Vector3, dir: THREE.Vector3) => void,
  ): void {
    if (!this._active || !this.plan || dt <= 0) return;
    const plan = this.plan;
    this._t += dt;
    this._age += dt;
    const u = this._t / plan.duration;
    if (u >= 1) { this.reset(); return; }  // flew out of the fight

    this.updateJuke(dt, projectiles);
    this.placeOnPlan(frame);

    // World velocity → heading. Smoothed to kill spline jitter.
    _v.subVectors(this.group.position, this._prevWorld).divideScalar(dt);
    this._prevWorld.copy(this.group.position);
    if (this._firstFrame) { this._vel.copy(_v); this._prevVel.copy(_v); this._firstFrame = false; }
    this._prevVel.copy(this._vel);
    this._vel.lerp(_v, 1 - Math.exp(-10 * dt));

    // Bank from lateral acceleration (roll into the turn).
    const accel = _v.subVectors(this._vel, this._prevVel).divideScalar(dt);
    _m.lookAt(_v2.copy(this.group.position).add(this._vel), this.group.position, frame.up);
    _q.setFromRotationMatrix(_m);
    const rightE = _v2.set(1, 0, 0).applyQuaternion(_q);
    const lateral = accel.dot(rightE);
    const bankTarget = THREE.MathUtils.clamp(-lateral / 22, -1.25, 1.25);
    this._bank = THREE.MathUtils.lerp(this._bank, bankTarget, 1 - Math.exp(-6 * dt));

    // Scripted rolls from the plan.
    if (this._rollsDone < plan.rolls.length && u >= plan.rolls[this._rollsDone]) {
      this.startRoll(Math.random() < 0.5 ? -1 : 1);
      this._rollsDone++;
    }
    let extraRoll = 0;
    if (this._rollSpin > 0) {
      const step = Math.min(this._rollSpin, dt * Math.PI * 2 * 1.9);
      this._rollSpin -= step;
      extraRoll = (Math.PI * 2 - this._rollSpin) * this._rollDir;
    }
    this._wobble = Math.max(0, this._wobble - dt * 4);
    const wobbleRoll = Math.sin(this._age * 40) * this._wobble * 0.35;

    // Firing state: nose swings to the player inside fire windows.
    const inWindow = plan.fireWindows.some(([a, b]) => u >= a && u <= b);
    _v.subVectors(playerPos, this.group.position);
    const distToPlayer = _v.length();
    const toPlayer = _v.normalize();
    const aimW = inWindow ? plan.aimWeight : 0;
    if (aimW > 0) {
      _m.lookAt(_v2.copy(this.group.position).add(toPlayer), this.group.position, frame.up);
      _qAim.setFromRotationMatrix(_m);
      _q.slerp(_qAim, aimW);
    }
    _qRoll.setFromAxisAngle(_zAxis, this._bank + extraRoll + wobbleRoll);
    _q.multiply(_qRoll);
    this.group.quaternion.slerp(_q, 1 - Math.exp(-9 * dt));

    this.updateWeapons(dt, inWindow, toPlayer, distToPlayer, playerPos, plan, onShoot);
    this.animateRig(dt);
    this.updateMotionJuice(dt);
    this.updateHealthBar(frame);
    this.trail.update(dt, this.position);

    // Ram: dive bombers / jousters that don't pull up in time.
    if (distToPlayer < 1.6 + this._size * 0.8) this.rammed = true;
  }

  private placeOnPlan(frame: RailFrame): void {
    const plan = this.plan!;
    const u = THREE.MathUtils.clamp(this._t / plan.duration, 0, 1);
    plan.curve.getPointAt(u, this._local);
    this._local.add(this._juke);
    if (this._tunnelRadius > 0) {
      const r = Math.hypot(this._local.x, this._local.y);
      const max = this._tunnelRadius * 0.85;
      if (r > max) { this._local.x *= max / r; this._local.y *= max / r; }
    }
    this.group.position.copy(frame.position)
      .addScaledVector(frame.right, this._local.x)
      .addScaledVector(frame.up, this._local.y)
      .addScaledVector(frame.forward, this._local.z);
  }

  // Agile classes snap-roll sideways when a player laser closes in.
  private updateJuke(dt: number, projectiles?: Projectile[]): void {
    this._jukeCooldown -= dt;
    this._juke.addScaledVector(this._jukeVel, dt);
    this._jukeVel.multiplyScalar(Math.exp(-3.5 * dt));
    this._juke.multiplyScalar(Math.exp(-0.6 * dt));
    const agile = this._type === 'INTERCEPTOR' || this._type === 'SCOUT' || this._type === 'FIGHTER';
    if (!agile || this._jukeCooldown > 0 || !projectiles) return;
    for (const p of projectiles) {
      if (!p.active) continue;
      if (p.position.distanceToSquared(this.group.position) < 49) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this._jukeVel.set(dir * 26, (Math.random() - 0.3) * 14, 0);
        this.startRoll(-dir);
        this._jukeCooldown = this._type === 'INTERCEPTOR' ? 1.4 : 2.4;
        break;
      }
    }
  }

  private startRoll(dir: number): void {
    if (this._rollSpin > 0) return;
    this._rollDir = dir;
    this._rollSpin = Math.PI * 2;
  }

  private updateWeapons(
    dt: number, inWindow: boolean, toPlayer: THREE.Vector3, dist: number, playerPos: THREE.Vector3,
    plan: FlightPlan, onShoot?: (s: THREE.Vector3, d: THREE.Vector3) => void,
  ): void {
    this._cooldown -= dt;
    this._muzzleFlash = Math.max(0, this._muzzleFlash - dt * 12);

    // Only shoot when actually facing the player from in front of them.
    _v.set(0, 0, 1).applyQuaternion(this.group.quaternion);
    const facing = _v.dot(toPlayer);
    const canFire = inWindow && facing > 0.55 && dist > 8 && dist < 130 && this._spawnAnim >= 1;

    if (this._burstLeft > 0) {
      this._burstTimer -= dt;
      if (this._burstTimer <= 0) {
        this.fireShot(playerPos, plan.spread, onShoot);
        this._burstLeft--;
        this._burstTimer = BURST_GAP;
        if (this._burstLeft === 0) this._cooldown = 0.9 + Math.random() * 0.8;
      }
    } else if (canFire && this._cooldown <= 0) {
      // Charge up (visible), then release the burst.
      this._charge = Math.min(1, this._charge + dt / CHARGE_TIME);
      if (this._charge >= 1) {
        this._charge = 0;
        this._burstLeft = plan.spread ? 2 : 3;
        this._burstTimer = 0;
      }
    } else {
      this._charge = Math.max(0, this._charge - dt * 3);
    }

    const muzzle = this.rig.muzzles[this._muzzleIdx % this.rig.muzzles.length];
    this.chargeSprite.position.copy(muzzle);
    this.chargeSprite.material.opacity = this._charge * 0.95;
    this.chargeSprite.scale.setScalar(this._size * (0.4 + this._charge * 1.6) * (0.9 + Math.random() * 0.2));
    this.muzzleSprite.material.opacity = this._muzzleFlash;
    this.muzzleSprite.scale.setScalar(this._size * 2.2 * this._muzzleFlash);
  }

  private fireShot(playerPos: THREE.Vector3, spread: boolean, onShoot?: (s: THREE.Vector3, d: THREE.Vector3) => void): void {
    if (!onShoot) return;
    const muzzle = this.rig.muzzles[this._muzzleIdx++ % this.rig.muzzles.length];
    this.muzzleSprite.position.copy(muzzle);
    this._muzzleFlash = 1;
    const origin = muzzle.clone().applyMatrix4(this.body.matrixWorld);
    const dir = playerPos.clone().sub(origin).normalize();
    const shots = spread ? [-0.08, 0, 0.08] : [0];
    for (const off of shots) {
      const d = dir.clone();
      // Slight inaccuracy: the last shot of a burst is the dangerous one.
      const err = this._burstLeft > 1 ? 0.11 : 0.03;
      d.x += (Math.random() - 0.5) * err + off;
      d.y += (Math.random() - 0.5) * err;
      onShoot(origin.clone(), d.normalize());
    }
  }

  // Engines flicker and swell with speed, blades spin, nav lights strobe,
  // interceptor foils unfold into attack position.
  private animateRig(dt: number): void {
    const speed = this._vel.length();
    const throttle = THREE.MathUtils.clamp(speed / 40, 0.5, 1.6);
    for (const f of this.rig.flames) {
      const flick = 0.85 + Math.random() * 0.3;
      if (f instanceof THREE.Sprite) f.material.opacity = 0.6 + Math.random() * 0.35;
      else f.scale.set(1, 1, throttle * flick);
    }
    for (const sp of this.rig.spin) sp.obj.rotation[sp.axis] += sp.speed * dt;
    const blink = Math.sin(this._age * 9 + this._id) > 0.6;
    for (const l of this.rig.blink) (l.material as THREE.MeshBasicMaterial).opacity = blink ? 1 : 0.25;
    const open = Math.min(1, this._age / 0.8);
    for (const w of this.rig.wings) w.obj.rotation.z = THREE.MathUtils.lerp(w.closed, w.open, easeOutBack(open));
  }

  private updateMotionJuice(dt: number): void {
    if (this._spawnAnim < 1) {
      this._spawnAnim = Math.min(1, this._spawnAnim + dt * 2.4);
      this.group.scale.setScalar(Math.max(0.01, easeOutBack(this._spawnAnim)));
    } else if (this._hitPunch > 0) {
      this._hitPunch = Math.max(0, this._hitPunch - dt * 7);
      const k = Math.sin(this._hitPunch * Math.PI) * 0.22;
      this.group.scale.set(1 + k, 1 - k * 0.6, 1 + k);
    } else if (this.group.scale.x !== 1) {
      this.group.scale.setScalar(1);
    }
    if (this._damageFlashTimer > 0) {
      this._damageFlashTimer = Math.max(0, this._damageFlashTimer - dt);
      this.applyTint(this._damageFlashTimer / this._damageFlashDuration);
    } else {
      this.applyTint(this._charge * 0.25);
    }
  }

  // Tint toward white from each material's original colour (cached).
  private _lastTint = -1;
  private applyTint(amount: number): void {
    if (Math.abs(amount - this._lastTint) < 0.01) return;
    this._lastTint = amount;
    this.body.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mat = child.material as THREE.MeshStandardMaterial;
      if (!mat.color) return;
      const ud = mat.userData as { baseColor?: THREE.Color; baseEmissive?: THREE.Color; baseEI?: number };
      if (!ud.baseColor) {
        ud.baseColor = mat.color.clone();
        if (mat.emissive) { ud.baseEmissive = mat.emissive.clone(); ud.baseEI = mat.emissiveIntensity; }
      }
      mat.color.copy(ud.baseColor).lerp(_white, amount);
      if (mat.emissive && ud.baseEmissive) {
        mat.emissive.copy(ud.baseEmissive).lerp(_white, amount);
        mat.emissiveIntensity = (ud.baseEI ?? 0) + amount * 2.5;
      }
    });
  }

  // Billboarded bar above the ship, facing the camera side of the rail.
  private updateHealthBar(frame: RailFrame): void {
    if (!this._healthBar.visible) return;
    const ratio = this._health / this._maxHealth;
    this._healthBar.scale.x = ratio;
    (this._healthBar.material as THREE.MeshBasicMaterial).color.setHSL(ratio * 0.33, 1, 0.5);
    // Undo the group rotation so the bar stays upright and faces back down the rail.
    _q.copy(this.group.quaternion).invert();
    _m.lookAt(_v.set(0, 0, 0), _v2.copy(frame.forward), frame.up);
    _qAim.setFromRotationMatrix(_m);
    for (const bar of [this._healthBarBg, this._healthBar]) {
      bar.quaternion.copy(_q).multiply(_qAim);
      bar.position.copy(_v.copy(frame.up).multiplyScalar(this._size * 1.4)).applyQuaternion(_q);
    }
    this._healthBar.position.add(_v.set(-(1 - ratio) * 0.8, 0, 0.01).applyQuaternion(this._healthBar.quaternion));
  }

  reset(): void {
    this._active = false;
    this._health = this._maxHealth;
    this.plan = null;
    this.rammed = false;
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
    this.muzzleSprite.material.dispose();
    this.chargeSprite.material.dispose();
    this.group.parent?.remove(this.group);
    this.body.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
