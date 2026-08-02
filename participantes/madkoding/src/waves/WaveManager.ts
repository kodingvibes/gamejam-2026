// ─── Wave Manager (formation-based spawning) ─────────────────────────────────

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { EnemyManager } from '../enemies/EnemyManager';
import { BossMothership } from '../enemies/bosses/BossMothership';
import { WaveDefinition, LevelDefinition, LEVELS, EnemyType, PatternType } from './WaveDefinition';

interface FormationEnemy {
  type: EnemyType;
  pattern: PatternType;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
}

export class WaveManager {
  private eventBus: EventBus;
  private enemyManager: EnemyManager;
  private boss: BossMothership | null = null;
  private scene: THREE.Scene;
  // Positions of background corvettes — some formations spawn behind them
  corvettePositions: THREE.Vector3[] = [];

  private _currentLevel = 0;
  private _currentWave = 0;
  private _totalWaves = 0;
  private _levelComplete = false;
  private _bossActive = false;
  private _levelDefinitions: LevelDefinition[];

  // Formation queue: a list of formations to spawn, each containing several
  // enemies positioned in a shape (V, line, diamond).
  private _formations: FormationEnemy[][] = [];
  private _formationIndex = 0;
  private _intraFormationTimer = 0;
  private _intraFormationDelay = 0.12;
  private _enemyIndexInFormation = 0;
  private _interFormationTimer = 0;
  private _interFormationDelay = 1.5;
  private _waitingForFormation = false;

  private _lastPlayerZ = 0;
  private _totalEnemies = 0;
  private _enemiesSpawned = 0;

  constructor(scene: THREE.Scene, enemyManager: EnemyManager) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.enemyManager = enemyManager;
    this._levelDefinitions = LEVELS;
  }

  get currentLevel(): number { return this._currentLevel; }
  get currentWave(): number { return this._currentWave; }
  get totalWaves(): number { return this._totalWaves; }
  get bossActive(): boolean { return this._bossActive; }
  get bossInstance(): BossMothership | null { return this.boss; }
  get levelComplete(): boolean { return this._levelComplete; }

  startLevel(levelIndex: number): void {
    this._currentLevel = levelIndex;
    this._currentWave = 0;
    this._levelComplete = false;
    this._bossActive = false;

    const levelDef = this._levelDefinitions[levelIndex];
    if (!levelDef) return;
    this._totalWaves = levelDef.waves.length;

    // Build formations from wave entries: group same-type enemies into
    // formations of 3-6, assigning formation offsets.
    this._formations = [];
    this._totalEnemies = 0;

    for (const wave of levelDef.waves) {
      for (const entry of wave.entries) {
        let remaining = entry.count;
        while (remaining > 0) {
          const squadSize = Math.min(remaining, 3 + Math.floor(Math.random() * 4));
          const formation = this.buildFormation(entry.enemyType, entry.pattern, squadSize);
          this._formations.push(formation);
          remaining -= squadSize;
        }
        this._totalEnemies += entry.count;
      }
    }

    // Create boss if needed
    if (levelDef.hasBoss) {
      if (this.boss) {
        this.scene.remove(this.boss.mesh);
        this.boss.dispose();
      }
      this.boss = new BossMothership();
      this.scene.add(this.boss.mesh);
    }

    this._formationIndex = 0;
    this._enemyIndexInFormation = 0;
    this._intraFormationTimer = 0;
    this._interFormationTimer = 0;
    this._waitingForFormation = false;
    this._enemiesSpawned = 0;

    this.eventBus.emit(GameEvent.WAVE_START, { wave: 1, totalWaves: this._totalWaves });
  }

  // Build a formation: V, line, or diamond with relative offsets
  private buildFormation(type: EnemyType, pattern: PatternType, count: number): FormationEnemy[] {
    const formationType = Math.floor(Math.random() * 4); // V, line, diamond, echelon
    const spacing = 3.0;
    const enemies: FormationEnemy[] = [];

    for (let i = 0; i < count; i++) {
      let dx = 0, dy = 0, dz = 0;

      switch (formationType) {
        case 0: // V formation
          dx = (i - (count - 1) / 2) * spacing;
          dz = Math.abs(i - (count - 1) / 2) * spacing * 0.6;
          break;
        case 1: // Line abreast
          dx = (i - (count - 1) / 2) * spacing;
          dy = THREE.MathUtils.randFloat(-0.5, 0.5);
          break;
        case 2: // Diamond
          {
            const half = (count - 1) / 2;
            const dist = Math.abs(i - half);
            dx = (i - half) * spacing;
            dy = (half - dist) * spacing * 0.4;
            dz = dist * spacing * 0.3;
          }
          break;
        default: // Echelon (staircase)
          dx = (i - (count - 1) / 2) * spacing;
          dy = i * spacing * 0.3;
          dz = i * spacing * 0.4;
          break;
      }

      enemies.push({ type, pattern, offsetX: dx, offsetY: dy, offsetZ: dz });
    }

    return enemies;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (this._levelComplete) return;
    this._lastPlayerZ = playerPos.z;

    // ── Formation spawning ──
    if (!this._bossActive && this._formationIndex < this._formations.length) {
      if (this._waitingForFormation) {
        // Wait a bit between formations
        this._interFormationTimer += dt;
        if (this._interFormationTimer >= this._interFormationDelay) {
          this._waitingForFormation = false;
          this._interFormationTimer = 0;
          this._formationIndex++;
          this._enemyIndexInFormation = 0;
          this._intraFormationTimer = 0;
        }
      } else {
        // Spawn enemies within the current formation quickly
        const formation = this._formations[this._formationIndex];
        this._intraFormationTimer += dt;
        if (this._enemyIndexInFormation < formation.length && this._intraFormationTimer >= this._intraFormationDelay) {
          this._intraFormationTimer = 0;
          const e = formation[this._enemyIndexInFormation];
          this.spawnFormationEnemy(e, playerPos);
          this._enemyIndexInFormation++;
          this._enemiesSpawned++;
        }
        // Formation fully spawned → wait
        if (this._enemyIndexInFormation >= formation.length) {
          this._waitingForFormation = true;
        }
      }
    }

    // Update wave counter for HUD
    if (!this._bossActive && this._totalEnemies > 0 && this._totalWaves > 0) {
      const progress = this._enemiesSpawned / this._totalEnemies;
      const wave = Math.min(this._totalWaves, Math.floor(progress * this._totalWaves) + 1);
      if (wave !== this._currentWave + 1) {
        this._currentWave = wave - 1;
        this.eventBus.emit(GameEvent.WAVE_START, { wave, totalWaves: this._totalWaves });
      }
    }

    // All formations spawned and no enemies left → spawn boss
    if (!this._bossActive && this._formationIndex >= this._formations.length &&
        this.enemyManager.activeEnemies.length === 0) {
      this.startBoss();
    }

    // Boss logic — attack volleys are fired by the orchestrator when canAttack
    if (this._bossActive && this.boss && this.boss.active) {
      this.boss.update(dt, playerPos);
      if (!this.boss.active) {
        this._bossActive = false;
        this._levelComplete = true;
        this.eventBus.emit(GameEvent.LEVEL_COMPLETE, {
          level: this._currentLevel + 1, score: 0,
        });
      }
    }
  }

  private spawnFormationEnemy(e: FormationEnemy, playerPos: THREE.Vector3): void {
    // All enemies spawn from behind a corvette. Pick the nearest corvette
    // that's ahead of the player.
    let baseZ = playerPos.z - THREE.MathUtils.randFloat(50, 70);
    let centerX = THREE.MathUtils.randFloat(-5, 5);
    let centerY = THREE.MathUtils.randFloat(-3, 3);

    const validCorvettes = this.corvettePositions.filter(c => c.z < playerPos.z - 30);
    if (validCorvettes.length > 0) {
      const corvette = validCorvettes[Math.floor(Math.random() * validCorvettes.length)];
      centerX = corvette.x;
      centerY = corvette.y;
      baseZ = corvette.z - THREE.MathUtils.randFloat(8, 20);
    }

    const spawnPos = new THREE.Vector3(
      centerX + e.offsetX,
      centerY + e.offsetY,
      baseZ + e.offsetZ
    );

    this.enemyManager.spawn(e.type, spawnPos, playerPos, e.pattern);
  }

  private startBoss(): void {
    if (!this.boss) return;
    this._bossActive = true;
    const bossPos = new THREE.Vector3(0, 0, this._lastPlayerZ - 60);
    this.boss.init(bossPos);
    this.eventBus.emit(GameEvent.BOSS_SPAWNED, {
      name: this.boss.name, maxHealth: this.boss.maxHealth,
    });
  }

  getBossTurretPositions(): THREE.Vector3[] {
    if (!this.boss || !this.boss.active) return [];
    return this.boss.getTurretPositions();
  }

  reset(): void {
    this._currentLevel = 0;
    this._currentWave = 0;
    this._levelComplete = false;
    this._bossActive = false;
    this._formations = [];
    this._formationIndex = 0;
    this._enemyIndexInFormation = 0;
    this._intraFormationTimer = 0;
    this._interFormationTimer = 0;
    this._waitingForFormation = false;
    this._enemiesSpawned = 0;
    this._lastPlayerZ = 0;
    if (this.boss) this.boss.reset();
  }

  dispose(): void {
    if (this.boss) { this.boss.dispose(); this.boss = null; }
  }
}