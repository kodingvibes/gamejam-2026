// ─── Player Life Manager: 3 lives, death sequence, ENGAGE text ──────────────
// Death: small explosions → ship vanishes → big explosion → fade black → respawn → ENGAGE
// Game Over (0 lives): explosions → ship vanishes → fade black → GAME_OVER screen

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { GameState } from '../core/StateManager';
import { ExplosionSystem } from '../fx/ExplosionSystem';
import { AudioManager } from '../audio/AudioManager';
import { CameraRig } from '../camera/CameraRig';
import { PlayerShip } from './PlayerShip';

type Phase = 'playing' | 'dying' | 'fading' | 'spawning' | 'gameover';

export class PlayerLifeManager {
  private eventBus: EventBus;
  private explosionSystem: ExplosionSystem;
  private audioManager: AudioManager;
  private cameraRig: CameraRig;
  private playerShip: PlayerShip;
  private stateManager: { transition: (s: GameState) => boolean };

  private _lives = 3;
  private _phase: Phase = 'playing';
  private _timer = 0;
  private _scoreAtDeath = 0;
  private _waveAtDeath = 0;
  private _gameOverPending = false;

  onPhaseChange: ((phase: Phase) => void) | null = null;
  onLivesChange: ((lives: number) => void) | null = null;

  constructor(deps: {
    explosionSystem: ExplosionSystem;
    audioManager: AudioManager;
    cameraRig: CameraRig;
    playerShip: PlayerShip;
    stateManager: { transition: (s: GameState) => boolean };
  }) {
    this.explosionSystem = deps.explosionSystem;
    this.audioManager = deps.audioManager;
    this.cameraRig = deps.cameraRig;
    this.playerShip = deps.playerShip;
    this.stateManager = deps.stateManager;
    this.eventBus = EventBus.getInstance();
  }

  get lives(): number { return this._lives; }
  get phase(): Phase { return this._phase; }

  // Ship visibility is fully controlled here, so Game.ts must not override it.
  onDeath(score: number, wave: number): void {
    if (this._phase !== 'playing') return;
    this._scoreAtDeath = score;
    this._waveAtDeath = wave;
    this._lives--;
    if (this.onLivesChange) this.onLivesChange(this._lives);

    this._phase = this._lives <= 0 ? 'gameover' : 'dying';
    this._timer = 0;
    if (this.onPhaseChange) this.onPhaseChange(this._phase);
  }

  update(dt: number): void {
    switch (this._phase) {
      case 'dying':    this.updateDying(dt); break;
      case 'fading':   this.updateFading(dt); break;
      case 'spawning': this.updateSpawning(dt); break;
      case 'gameover': this.updateGameOver(dt); break;
    }
  }

  // ── Death sequence (lives remain) ──
  private updateDying(dt: number): void {
    this._timer += dt;
    const shipPos = this.playerShip.position.clone();

    // Small explosions for 1s
    if (this._timer < 1.0 && Math.random() < 0.4) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 2.5,
        (Math.random() - 0.5) * 2.5
      );
      this.explosionSystem.spawn(shipPos.clone().add(offset), 2.5, 0xff6600);
      if (Math.random() < 0.25) this.audioManager.playSmallExplosion();
    }

    // Hide ship at 1.0s, BEFORE the big explosion
    if (this._timer >= 1.0 && this._timer < 1.0 + dt) {
      this.playerShip.setVisible(false);
    }

    // Big explosion at 1.2s
    if (this._timer >= 1.2 && this._timer < 1.2 + dt) {
      this.explosionSystem.spawnEpic(shipPos, 0xff4400);
      this.audioManager.playDeathExplosion();
      this.cameraRig.shake(1.2, 0.8);
    }

    // Fade to black at 2.0s
    if (this._timer >= 2.0) {
      this._phase = 'fading';
      this._timer = 0;
      if (this.onPhaseChange) this.onPhaseChange('fading');
    }
  }

  // ── Fade to black ──
  private updateFading(dt: number): void {
    this._timer += dt;
    if (this._gameOverPending) {
      // Game over: fade long enough, then show the GAME_OVER screen
      if (this._timer >= 1.5) this.showGameOver();
    } else if (this._timer >= 1.0) {
      this.respawn();
    }
  }

  // ── Respawn: ship back + ENGAGE text ──
  private respawn(): void {
    this.playerShip.reset();
    this._phase = 'spawning';
    this._timer = 0;
    if (this.onPhaseChange) this.onPhaseChange('spawning');
  }

  private updateSpawning(dt: number): void {
    this._timer += dt;
    if (this._timer >= 3.0) {
      this._phase = 'playing';
      if (this.onPhaseChange) this.onPhaseChange('playing');
    }
  }

  // ── Game Over sequence (0 lives) ──
  private updateGameOver(dt: number): void {
    this._timer += dt;
    const shipPos = this.playerShip.position.clone();

    // Small explosions for 0.8s
    if (this._timer < 0.8 && Math.random() < 0.4) {
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 4
      );
      this.explosionSystem.spawn(shipPos.clone().add(offset), 4, 0xff4400);
      if (Math.random() < 0.25) this.audioManager.playSmallExplosion();
    }

    // Hide ship at 0.8s, BEFORE the big explosion
    if (this._timer >= 0.8 && this._timer < 0.8 + dt) {
      this.playerShip.setVisible(false);
    }

    // Mega explosion at 1.0s
    if (this._timer >= 1.0 && this._timer < 1.0 + dt) {
      this.explosionSystem.spawnEpic(shipPos, 0xff2200);
      this.explosionSystem.spawnEpic(shipPos.clone().add(new THREE.Vector3(2, 0, 0)), 0xff6600);
      this.explosionSystem.spawnEpic(shipPos.clone().add(new THREE.Vector3(-2, 0, 0)), 0xff8800);
      this.audioManager.playDeathExplosion();
      this.cameraRig.shake(1.5, 1.0);
    }

    // Fade to black at 2.5s
    if (this._timer >= 2.5) {
      this._phase = 'fading';
      this._gameOverPending = true;
      this._timer = 0;
      if (this.onPhaseChange) this.onPhaseChange('fading');
    }
  }

  private showGameOver(): void {
    this._gameOverPending = false;
    this._phase = 'playing';
    if (this.onPhaseChange) this.onPhaseChange('playing'); // hide fade overlay
    this.audioManager.playGameOver();
    this.stateManager.transition(GameState.GAME_OVER);
    this.eventBus.emit(GameEvent.GAME_OVER, {
      score: this._scoreAtDeath,
      wave: this._waveAtDeath,
    });
  }

  reset(): void {
    this._lives = 3;
    this._phase = 'playing';
    this._timer = 0;
    this._gameOverPending = false;
    this.playerShip.setVisible(true);
    if (this.onLivesChange) this.onLivesChange(this._lives);
  }
}