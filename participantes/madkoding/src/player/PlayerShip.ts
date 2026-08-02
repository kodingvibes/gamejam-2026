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