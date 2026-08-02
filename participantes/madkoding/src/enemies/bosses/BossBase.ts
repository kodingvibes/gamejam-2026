// ─── Boss Base Class ────────────────────────────────────────────────────────

import * as THREE from 'three';
import { EventBus } from '../../core/EventBus';
import { GameEvent } from '../../types/events';

export interface BossConfig {
  name: string;
  health: number;
  speed: number;
  damage: number;
  score: number;
  size: number;
  color: number;
  phases: number;
}

export class BossBase {
  protected group: THREE.Group;
  protected _health: number;
  protected _maxHealth: number;
  protected _speed: number;
  protected _damage: number;
  protected _score: number;
  protected _size: number;
  protected _color: number;
  protected _name: string;
  protected _currentPhase = 1;
  protected _totalPhases: number;
  protected _active = false;
  protected _age = 0;
  protected eventBus: EventBus;
  protected _velocity = new THREE.Vector3();

  constructor(config: BossConfig) {
    this._name = config.name;
    this._health = config.health;
    this._maxHealth = config.health;
    this._speed = config.speed;
    this._damage = config.damage;
    this._score = config.score;
    this._size = config.size;
    this._color = config.color;
    this._totalPhases = config.phases;
    this.eventBus = EventBus.getInstance();

    this.group = new THREE.Group();
    this.buildMesh();
    this.group.visible = false;
  }

  protected buildMesh(): void {
    // Override in subclasses
  }

  get mesh(): THREE.Group {
    return this.group;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get active(): boolean {
    return this._active;
  }

  get health(): number {
    return this._health;
  }

  get maxHealth(): number {
    return this._maxHealth;
  }

  get currentPhase(): number {
    return this._currentPhase;
  }

  get totalPhases(): number {
    return this._totalPhases;
  }

  get score(): number {
    return this._score;
  }

  get name(): string {
    return this._name;
  }

  get size(): number {
    return this._size;
  }

  init(position: THREE.Vector3): void {
    this.group.position.copy(position);
    this._health = this._maxHealth;
    this._currentPhase = 1;
    this._active = true;
    this._age = 0;
    this.group.visible = true;

    this.eventBus.emit(GameEvent.BOSS_SPAWNED, {
      name: this._name,
      maxHealth: this._maxHealth,
    });
  }

  takeDamage(amount: number): boolean {
    this._health -= amount;
    if (this._health <= 0) {
      this._health = 0;
      this.destroy();
      return true;
    }

    // Check phase transition
    const phaseThreshold = this._totalPhases - this._currentPhase;
    const healthRatio = this._health / this._maxHealth;
    const expectedPhase = Math.max(1, Math.ceil(healthRatio * this._totalPhases));

    if (expectedPhase !== this._currentPhase) {
      this._currentPhase = expectedPhase;
      this.onPhaseChange(this._currentPhase);
    }

    this.eventBus.emit(GameEvent.BOSS_DAMAGED, {
      health: this._health,
      maxHealth: this._maxHealth,
    });

    return false;
  }

  protected onPhaseChange(phase: number): void {
    // Override in subclasses
  }

  destroy(): void {
    this._active = false;
    this.group.visible = false;
    this.eventBus.emit(GameEvent.BOSS_DESTROYED, { score: this._score });
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this._active) return;
    this._age += dt;
  }

  reset(): void {
    this._active = false;
    this._health = this._maxHealth;
    this._currentPhase = 1;
    this._age = 0;
    this.group.visible = false;
  }

  dispose(): void {
    this.group.parent?.remove(this.group);
  }
}
