// ─── Game Event Binder: wires all EventBus listeners ────────────────────────

import * as THREE from 'three';
import { GAME } from '../types/config';
import { GameEvent } from '../types/events';
import { EventBus } from './EventBus';
import { StateManager, GameState } from './StateManager';
import { ScoreSystem } from './ScoreSystem';
import { AudioManager } from '../audio/AudioManager';
import { ExplosionSystem } from '../fx/ExplosionSystem';
import { HitSpark } from '../fx/HitSpark';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { WaveManager } from '../waves/WaveManager';

interface GameCallbacks {
  startLevel: (level: number) => void;
  onPlayerDeath: (score: number, wave: number) => void;
}

export class GameEventBinder {
  private eventBus: EventBus;
  private stateManager!: StateManager;
  private scoreSystem!: ScoreSystem;
  private audioManager!: AudioManager;
  private explosionSystem!: ExplosionSystem;
  private hitSpark!: HitSpark;
  private weaponSystem!: WeaponSystem;
  private waveManager!: WaveManager;
  private callbacks!: GameCallbacks;
  private _currentLevel = 0;

  constructor(deps: {
    stateManager: StateManager;
    scoreSystem: ScoreSystem;
    audioManager: AudioManager;
    explosionSystem: ExplosionSystem;
    hitSpark: HitSpark;
    weaponSystem: WeaponSystem;
    waveManager: WaveManager;
    callbacks: GameCallbacks;
  }) {
    this.stateManager = deps.stateManager;
    this.scoreSystem = deps.scoreSystem;
    this.audioManager = deps.audioManager;
    this.explosionSystem = deps.explosionSystem;
    this.hitSpark = deps.hitSpark;
    this.weaponSystem = deps.weaponSystem;
    this.waveManager = deps.waveManager;
    this.callbacks = deps.callbacks;
    this.eventBus = EventBus.getInstance();
  }

  bindAll(): void {
    this.bindEnemyDestroyed();
    this.bindBossDestroyed();
    this.bindPlayerDeath();
    this.bindLevelComplete();
    this.bindPlayerFired();
    this.bindPlayerDamage();
  }

  get currentLevel(): number { return this._currentLevel; }
  set currentLevel(v: number) { this._currentLevel = v; }

  private bindEnemyDestroyed(): void {
    this.eventBus.on(GameEvent.ENEMY_DESTROYED, (p) => {
      this.scoreSystem.add(p.score);
      const pos = new THREE.Vector3(p.position.x, p.position.y, p.position.z);
      this.explosionSystem.spawnEpic(pos, 0xff8844);
      this.audioManager.playExplosion();
      this.hitSpark.spawn(pos, 0xff8844);
    });
  }

  private bindBossDestroyed(): void {
    this.eventBus.on(GameEvent.BOSS_DESTROYED, (p) => {
      this.scoreSystem.add(p.score);
      this.explosionSystem.spawn(new THREE.Vector3(0, 0, -30), 8, 0xff4444);
      this.audioManager.playExplosion();
    });
  }

  private bindPlayerDeath(): void {
    this.eventBus.on(GameEvent.PLAYER_DEATH, () => {
      // Delegate to PlayerLifeManager via callback
      this.callbacks.onPlayerDeath(this.scoreSystem.score, this.waveManager.currentWave);
    });
  }

  private bindLevelComplete(): void {
    this.eventBus.on(GameEvent.LEVEL_COMPLETE, () => {
      this._currentLevel++;
      if (this._currentLevel >= GAME.LEVEL_COUNT) {
        this.eventBus.emit(GameEvent.VICTORY, { score: this.scoreSystem.score });
        this.audioManager.playVictory();
        this.stateManager.transition(GameState.VICTORY);
      } else {
        setTimeout(() => this.callbacks.startLevel(this._currentLevel), 2000);
      }
    });
  }

  private bindPlayerFired(): void {
    this.eventBus.on(GameEvent.PLAYER_FIRED, () => {
      const w = this.weaponSystem.currentWeapon;
      if (w.name === 'LASER') this.audioManager.playLaser();
      else if (w.name === 'BOMB') this.audioManager.playMissile();
    });
  }

  private bindPlayerDamage(): void {
    this.eventBus.on(GameEvent.PLAYER_SHIELD_LOST, () => this.audioManager.playShieldHit());
    this.eventBus.on(GameEvent.PLAYER_DAMAGED, () => this.audioManager.playHit());
  }
}
