// ─── Player Ship (logic only, mesh delegated to factory) ────────────────────

import * as THREE from 'three';
import { PLAYER } from '../types/config';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { PlayerShipMeshFactory } from './PlayerShipMeshFactory';
import { FoxTail } from './FoxTail';
import { getSoftParticleTexture } from '../fx/softTexture';

const ROLL_DURATION = 0.55;
const ROLL_COOLDOWN = 0.75;

// Fresnel energy bubble: invisible at the center, glowing at the rim.
const shieldVertex = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const shieldFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uTime;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  void main() {
    float f = pow(1.0 - abs(dot(vNormalV, vViewDir)), 2.2);
    float bands = 0.75 + 0.25 * sin(vNormalV.y * 40.0 + uTime * 12.0);
    gl_FragColor = vec4(uColor * (f * 2.2 * bands), f * uAlpha);
  }
`;

export class PlayerShip {
  private group: THREE.Group;
  private foxTail: FoxTail;
  private model: THREE.Object3D | null = null;
  private engineFlare: THREE.Sprite;
  private shieldBubble: THREE.Mesh;
  private shieldMat: THREE.ShaderMaterial;
  private _shieldFx = 0;
  private _health: number;
  private _shields: number;
  private _maxShields: number;
  private _invincible = false;
  private _invincibilityTimer = 0;
  private _disposed = false;
  private eventBus: EventBus;
  private _time = 0;

  // Starfox-style banking: ship rolls into lateral turns and pitches
  // slightly with vertical input. Lerped toward targets each frame.
  private _bankTarget = 0;
  private _pitchTarget = 0;
  private _bank = 0;
  private _pitch = 0;
  private _baseQuat = new THREE.Quaternion();
  private _tmpQuat = new THREE.Quaternion();
  private _euler = new THREE.Euler();

  // Barrel roll
  private _rollTimer = 0;
  private _rollDir = 1;
  private _rollCooldown = 0;
  private _boost = 0;

  // Exposed for camera parallax and collision.
  private _screenX = 0;
  private _screenY = 0;
  private _screenVelocityX = 0;
  private _screenVelocityY = 0;

  constructor(scene: THREE.Scene) {
    this.eventBus = EventBus.getInstance();
    this._health = PLAYER.STARTING_HEALTH;
    this._shields = PLAYER.STARTING_SHIELDS;
    this._maxShields = PLAYER.MAX_SHIELDS;

    const mesh = PlayerShipMeshFactory.create();
    this.group = mesh.group;
    this.foxTail = mesh.foxTail;
    scene.add(this.group);

    // Afterburner flare at the engine nozzle (re-anchored once the GLB loads).
    this.engineFlare = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSoftParticleTexture(), color: 0x66eeff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.engineFlare.position.set(0, 0, -1.5);
    this.engineFlare.scale.setScalar(1.6);
    this.engineFlare.renderOrder = 990;
    this.group.add(this.engineFlare);

    this.shieldMat = new THREE.ShaderMaterial({
      vertexShader: shieldVertex,
      fragmentShader: shieldFragment,
      uniforms: {
        uColor: { value: new THREE.Color(0x44ddff) },
        uAlpha: { value: 0 },
        uTime: { value: 0 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 20), this.shieldMat);
    this.shieldBubble.scale.set(1.25, 0.7, 1.1);
    this.shieldBubble.visible = false;
    this.shieldBubble.renderOrder = 995;
    this.group.add(this.shieldBubble);

    // Try to swap in the external GLB model. If it loads, replace the
    // procedural ship's meshes with the GLB (keeping the fox tail + glow).
    this.loadGLBModel();
  }

  private async loadGLBModel(): Promise<void> {
    const glb = await PlayerShipMeshFactory.loadGLB();
    if (!glb || this._disposed) return;

    glb.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.rotation.order = 'XYZ';
        c.rotation.set(-Math.PI / 2, 0, 0);
        // Swap basic materials for standard so they respond to scene lights.
        if (c.material instanceof THREE.Material) {
          const m = c.material as THREE.Material;
          if (m instanceof THREE.MeshBasicMaterial || m instanceof THREE.MeshPhongMaterial) {
            const std = new THREE.MeshStandardMaterial({
              color: (m as THREE.MeshBasicMaterial).color ?? 0xffffff,
              roughness: 0.5,
              metalness: 0.6,
              emissive: (m as THREE.MeshPhongMaterial).emissive ?? 0x000000,
              emissiveIntensity: (m as THREE.MeshPhongMaterial).emissiveIntensity ?? 0.1,
            });
            c.material = std;
          }
        }
      }
    });

    // Remove only the procedural hull meshes. Lights stay attached (removing
    // them changes the scene light count → every lit shader recompiles).
    const keep = new Set<THREE.Object3D>([this.foxTail.pointsObject, this.engineFlare, this.shieldBubble]);
    const toRemove: THREE.Object3D[] = [];
    for (const c of this.group.children) {
      if (c instanceof THREE.Mesh && !keep.has(c)) toRemove.push(c);
    }
    for (const c of toRemove) {
      this.group.remove(c);
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      }
    }

    // Attach the GLB model to the group (inherits position/rotation/banking).
    this.group.add(glb);
    this.model = glb;

    // Anchor the afterburner to the rear of the real model.
    const prevQuat = this.group.quaternion.clone();
    const prevPos = this.group.position.clone();
    this.group.quaternion.identity();
    this.group.position.set(0, 0, 0);
    this.group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(glb);
    this.group.quaternion.copy(prevQuat);
    this.group.position.copy(prevPos);
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3());
      this.engineFlare.position.set(c.x, c.y, box.min.z + 0.2);
      const size = box.getSize(new THREE.Vector3());
      this.shieldBubble.scale.set(size.x / 5.2 + 0.4, size.y / 5.2 + 0.35, size.z / 5.2 + 0.4);
    }
  }

  get position(): THREE.Vector3 { return this.group.position; }
  get health(): number { return this._health; }
  get shields(): number { return this._shields; }
  get screenX(): number { return this._screenX; }
  get screenY(): number { return this._screenY; }
  get screenVelocityX(): number { return this._screenVelocityX; }
  get screenVelocityY(): number { return this._screenVelocityY; }
  get isRolling(): boolean { return this._rollTimer > 0; }
  get isInvincible(): boolean { return this._invincible; }
  get object3D(): THREE.Group { return this.group; }

  setVisible(v: boolean): void { this.group.visible = v; }

  setPosition(pos: THREE.Vector3, forward: THREE.Vector3, aimDir?: THREE.Vector3): void {
    this.group.position.copy(pos);
    // Rotate toward aim direction if provided, otherwise just forward
    const target = aimDir ? pos.clone().add(aimDir) : pos.clone().add(forward);
    this.group.lookAt(target);
    // Capture the base orientation (before banking) so we can compose roll/pitch.
    this._baseQuat.copy(this.group.quaternion);
  }

  /**
   * Set the ship's desired position in screen NDC space (-1..1) and update
   * the internal velocity from the positional change. Used by the Game loop to
   * drive the rail offset with a Starfox-style all-screen movement feel.
   */
  setScreenPosition(screenX: number, screenY: number, dt: number): void {
    const prevX = this._screenX;
    const prevY = this._screenY;
    this._screenX = screenX;
    this._screenY = screenY;
    if (dt > 0) {
      this._screenVelocityX = (this._screenX - prevX) / dt;
      this._screenVelocityY = (this._screenY - prevY) / dt;
    }
  }

  // Set banking targets from lateral (-1..1) and vertical (-1..1) input.
  // Positive lateral = moving right → roll right (negative Z rotation).
  // Positive vertical = moving down → pitch nose down.
  setBankInput(lateral: number, vertical: number): void {
    this._bankTarget = THREE.MathUtils.clamp(-lateral * 0.6, -0.6, 0.6);
    this._pitchTarget = THREE.MathUtils.clamp(vertical * 0.35, -0.35, 0.35);
  }

  /** Start a barrel roll (dir -1 = left, 1 = right). Returns false on cooldown. */
  barrelRoll(dir: number): boolean {
    if (this._rollTimer > 0 || this._rollCooldown > 0) return false;
    this._rollDir = dir >= 0 ? 1 : -1;
    this._rollTimer = ROLL_DURATION;
    this._rollCooldown = ROLL_COOLDOWN;
    this.pulseShield(0x66ffff, 0.6);
    return true;
  }

  /** 0..1 afterburner intensity (visual only). */
  setBoost(amount: number): void {
    this._boost = amount;
  }

  /** Flash the fresnel shield bubble. */
  pulseShield(color = 0x44ddff, strength = 1): void {
    this.shieldMat.uniforms.uColor.value.setHex(color);
    this._shieldFx = Math.max(this._shieldFx, strength);
  }

  takeDamage(amount: number): boolean {
    if (this._invincible) return false;
    if (this._shields > 0) {
      this._shields--;
      this.eventBus.emit(GameEvent.PLAYER_SHIELD_LOST, { shields: this._shields });
      this._invincible = true;
      this._invincibilityTimer = PLAYER.INVINCIBILITY_TIME * 0.5;
      this.pulseShield(0x44ddff, 1.2);
      return false;
    }
    this._health = Math.max(0, this._health - amount);
    this.eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount, health: this._health, shields: this._shields });
    this._invincible = true;
    this._invincibilityTimer = PLAYER.INVINCIBILITY_TIME;
    this.pulseShield(0xff3344, 0.8);
    if (this._health <= 0) { this.eventBus.emit(GameEvent.PLAYER_DEATH, {}); return true; }
    return false;
  }

  /** Grant temporary invulnerability (respawn / ENGAGE). */
  grantInvincibility(seconds: number): void {
    this._invincible = true;
    this._invincibilityTimer = Math.max(this._invincibilityTimer, seconds);
  }

  private setHullVisible(v: boolean): void {
    if (this.model) { this.model.visible = v; return; }
    for (const c of this.group.children) {
      if (c instanceof THREE.Mesh && c !== this.shieldBubble) c.visible = v;
    }
  }

  update(dt: number): void {
    this._time += dt;
    if (this._invincible) {
      this._invincibilityTimer -= dt;
      if (this._invincibilityTimer <= 0) this._invincible = false;
      // Fast blink while invulnerable; always restore when it ends.
      this.setHullVisible(!this._invincible || Math.floor(this._invincibilityTimer * 14) % 2 === 0);
    } else {
      this.setHullVisible(true);
    }

    // Engine flare: idle flicker + afterburner swell.
    const flicker = 0.85 + Math.sin(this._time * 60) * 0.08 + Math.random() * 0.07;
    this.engineFlare.scale.setScalar((0.6 + this._boost * 2.2) * flicker);
    (this.engineFlare.material as THREE.SpriteMaterial).color.setHex(this._boost > 0.3 ? 0x88eeff : 0x2a8fbf);
    this.foxTail.setIntensity(1 + this._boost * 1.6);
    this.foxTail.update(dt);

    // Shield bubble
    if (this._shieldFx > 0) {
      this._shieldFx = Math.max(0, this._shieldFx - dt * 2.2);
      this.shieldBubble.visible = true;
      this.shieldMat.uniforms.uAlpha.value = this._shieldFx;
      this.shieldMat.uniforms.uTime.value = this._time;
    } else {
      this.shieldBubble.visible = false;
    }

    // Barrel roll timers
    this._rollCooldown = Math.max(0, this._rollCooldown - dt);
    let rollAngle = 0;
    if (this._rollTimer > 0) {
      this._rollTimer = Math.max(0, this._rollTimer - dt);
      const t = 1 - this._rollTimer / ROLL_DURATION;
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      rollAngle = -this._rollDir * eased * Math.PI * 2;
    }

    // Apply banking: lerp current bank/pitch toward targets, then compose
    // onto the base orientation (which already faces the aim direction).
    const k = 1 - Math.exp(-6 * dt);
    this._bank = THREE.MathUtils.lerp(this._bank, this._bankTarget, k);
    this._pitch = THREE.MathUtils.lerp(this._pitch, this._pitchTarget, k);
    this._euler.set(this._pitch, 0, this._bank + rollAngle, 'YXZ');
    this._tmpQuat.setFromEuler(this._euler);
    this.group.quaternion.copy(this._baseQuat).multiply(this._tmpQuat);
  }

  heal(amount: number): void {
    this._health = Math.min(PLAYER.MAX_HEALTH, this._health + amount);
    this.pulseShield(0x44ff99, 0.9);
  }

  reset(): void {
    this._health = PLAYER.STARTING_HEALTH;
    this._shields = PLAYER.STARTING_SHIELDS;
    this._invincible = false;
    this._invincibilityTimer = 0;
    this._screenX = 0;
    this._screenY = 0;
    this._screenVelocityX = 0;
    this._screenVelocityY = 0;
    this._rollTimer = 0;
    this._rollCooldown = 0;
    this._boost = 0;
    this._shieldFx = 0;
    this.group.visible = true;
    this.setHullVisible(true);
    this.foxTail.setVisible(true);
  }

  dispose(): void {
    this._disposed = true;
    this.foxTail.dispose();
    this.group.parent?.remove(this.group);
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
    (this.engineFlare.material as THREE.Material).dispose();
  }
}
