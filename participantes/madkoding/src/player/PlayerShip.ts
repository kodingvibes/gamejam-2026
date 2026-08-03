// ─── Player Ship (logic only, mesh delegated to factory) ────────────────────

import * as THREE from 'three';
import { PLAYER } from '../types/config';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { PlayerShipMeshFactory } from './PlayerShipMeshFactory';
import { FoxTail } from './FoxTail';

export class PlayerShip {
  private group: THREE.Group;
  private fuselage: THREE.Mesh;
  private engineGlow: THREE.Mesh;
  private foxTail: FoxTail;
  private _health: number;
  private _shields: number;
  private _maxShields: number;
  private _invincible = false;
  private _invincibilityTimer = 0;
  private eventBus: EventBus;

  // Starfox-style banking: ship rolls into lateral turns and pitches
  // slightly with vertical input. Lerped toward targets each frame.
  private _bankTarget = 0;
  private _pitchTarget = 0;
  private _bank = 0;
  private _pitch = 0;
  private _baseQuat = new THREE.Quaternion();
  private _tmpQuat = new THREE.Quaternion();
  private _euler = new THREE.Euler();

  constructor(scene: THREE.Scene) {
    this.eventBus = EventBus.getInstance();
    this._health = PLAYER.STARTING_HEALTH;
    this._shields = PLAYER.STARTING_SHIELDS;
    this._maxShields = PLAYER.MAX_SHIELDS;

    const mesh = PlayerShipMeshFactory.create();
    this.group = mesh.group;
    this.fuselage = mesh.fuselage;
    this.engineGlow = mesh.engineGlow;
    this.foxTail = mesh.foxTail;
    scene.add(this.group);
  }

  get position(): THREE.Vector3 { return this.group.position; }
  get health(): number { return this._health; }
  get shields(): number { return this._shields; }

  setVisible(v: boolean): void { this.group.visible = v; }

  setPosition(pos: THREE.Vector3, forward: THREE.Vector3, aimDir?: THREE.Vector3): void {
    this.group.position.copy(pos);
    // Rotate toward aim direction if provided, otherwise just forward
    const target = aimDir ? pos.clone().add(aimDir) : pos.clone().add(forward);
    this.group.lookAt(target);
    // Capture the base orientation (before banking) so we can compose roll/pitch.
    this._baseQuat.copy(this.group.quaternion);
  }

  // Set banking targets from lateral (-1..1) and vertical (-1..1) input.
  // Positive lateral = moving right → roll right (negative Z rotation).
  // Positive vertical = moving down → pitch nose down.
  setBankInput(lateral: number, vertical: number): void {
    this._bankTarget = THREE.MathUtils.clamp(-lateral * 0.6, -0.6, 0.6);
    this._pitchTarget = THREE.MathUtils.clamp(vertical * 0.35, -0.35, 0.35);
  }

  takeDamage(amount: number): boolean {
    if (this._invincible) return false;
    if (this._shields > 0) {
      this._shields--;
      this.eventBus.emit(GameEvent.PLAYER_SHIELD_LOST, { shields: this._shields });
      this._invincible = true;
      this._invincibilityTimer = PLAYER.INVINCIBILITY_TIME * 0.5;
      return false;
    }
    this._health = Math.max(0, this._health - amount);
    this.eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount, health: this._health, shields: this._shields });
    this._invincible = true;
    this._invincibilityTimer = PLAYER.INVINCIBILITY_TIME;
    if (this._health <= 0) { this.eventBus.emit(GameEvent.PLAYER_DEATH, {}); return true; }
    return false;
  }

  update(dt: number): void {
    if (this._invincible) {
      this._invincibilityTimer -= dt;
      if (this._invincibilityTimer <= 0) this._invincible = false;
      const flash = Math.floor(this._invincibilityTimer * 10) % 2 === 0;
      (this.fuselage.material as THREE.MeshPhongMaterial).emissiveIntensity = flash ? 0.8 : 0.15;
    } else {
      (this.fuselage.material as THREE.MeshPhongMaterial).emissiveIntensity = 0.15;
    }
    const pulse = Math.sin(performance.now() * 0.01) * 0.2 + 0.6;
    (this.engineGlow.material as THREE.MeshBasicMaterial).opacity = pulse;
    this.foxTail.update(dt);

    // Apply banking: lerp current bank/pitch toward targets, then compose
    // onto the base orientation (which already faces the aim direction).
    this._bank = THREE.MathUtils.lerp(this._bank, this._bankTarget, 8 * dt);
    this._pitch = THREE.MathUtils.lerp(this._pitch, this._pitchTarget, 8 * dt);
    if (Math.abs(this._bank) > 0.001 || Math.abs(this._pitch) > 0.001) {
      this._euler.set(this._pitch, 0, this._bank, 'YXZ');
      this._tmpQuat.setFromEuler(this._euler);
      this.group.quaternion.copy(this._baseQuat).multiply(this._tmpQuat);
    }
  }

  heal(amount: number): void {
    this._health = Math.min(PLAYER.MAX_HEALTH, this._health + amount);
  }

  reset(): void {
    this._health = PLAYER.STARTING_HEALTH;
    this._shields = PLAYER.STARTING_SHIELDS;
    this._invincible = false;
    this._invincibilityTimer = 0;
    this.group.visible = true;
    this.foxTail.setVisible(true);
  }

  dispose(): void {
    this.foxTail.dispose();
    this.group.parent?.remove(this.group);
    this.group.traverse((c) => {
      if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    });
  }
}
