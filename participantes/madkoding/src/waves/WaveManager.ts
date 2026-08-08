// ─── Wave Manager (formation-based spawning) ─────────────────────────────────

import * as THREE from 'three';
import { EventBus } from '../core/EventBus';
import { GameEvent } from '../types/events';
import { EnemyManager } from '../enemies/EnemyManager';
import { BossMothership } from '../enemies/bosses/BossMothership';
import { WaveDefinition, EnemyType, PatternType } from './WaveDefinition';
import { LEVELS, type LevelDefinition } from '../levels/LevelData';

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
  private _enemiesKilled = 0;
  private _engageMode = false;
  // Rail curve so formations spawn ON the path (never inside tunnel walls).
  private _curve: THREE.CatmullRomCurve3 | null = null;
  // Tunnel radius (0 = open biome, no clamping).
  private _tunnelRadius = 0;
  // Stops formation spawning once the boss stage begins.
  private _spawningStopped = false;

  constructor(scene: THREE.Scene, enemyManager: EnemyManager) {
    this.scene = scene;
    this.eventBus = EventBus.getInstance();
    this.enemyManager = enemyManager;
    this._levelDefinitions = LEVELS;
    // Count kills so the wave counter reflects actual progress (enemies
    // defeated), not just how many have spawned.
    this.eventBus.on(GameEvent.ENEMY_DESTROYED, () => {
      this._enemiesKilled++;
    });
  }

  get currentLevel(): number { return this._currentLevel; }
  get currentWave(): number { return this._currentWave; }
  get totalWaves(): number { return this._totalWaves; }
  get bossActive(): boolean { return this._bossActive; }
  get bossInstance(): BossMothership | null { return this.boss; }
  get levelComplete(): boolean { return this._levelComplete; }

  /** Provide the rail curve + tunnel radius so formations spawn on the path. */
  setRail(curve: THREE.CatmullRomCurve3 | null, tunnelRadius = 0): void {
    this._curve = curve;
    this._tunnelRadius = tunnelRadius;
  }

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
    this._enemiesKilled = 0;

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

  update(dt: number, playerPos: THREE.Vector3, railProgress = 0): void {
    if (this._levelComplete) return;
    this._lastPlayerZ = playerPos.z;

    // ── Formation spawning ──
    // Stop spawning once the boss stage begins (railProgress near 1).
    if (!this._bossActive && !this._spawningStopped && this._formationIndex < this._formations.length && !this._engageMode) {
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

    // Update wave counter for HUD — based on enemies DEFEATED, not spawned,
    // so the wave only advances when the player actually clears enemies.
    if (!this._bossActive && this._totalEnemies > 0 && this._totalWaves > 0) {
      const progress = this._enemiesKilled / this._totalEnemies;
      const wave = Math.min(this._totalWaves, Math.floor(progress * this._totalWaves) + 1);
      if (wave !== this._currentWave + 1) {
        this._currentWave = wave - 1;
        this.eventBus.emit(GameEvent.WAVE_START, { wave, totalWaves: this._totalWaves });
      }
    }

    // Boss appears at the END of the stage path (rail progress near 1), not
    // when the waves are exhausted. The player must survive the whole run to
    // reach the boss. Once the rail is nearly done, stop spawning formations
    // and bring out the boss.
    if (!this._bossActive && railProgress >= 0.92) {
      this._spawningStopped = true;
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
    // Spawn enemies ON the rail path so they never appear inside tunnel walls.
    // If a curve is available, compute the spawn point ahead along the curve
    // (relative to the player's progress) and clamp lateral offsets to the
    // tunnel radius. Otherwise fall back to the old world-space box.
    let spawnPos: THREE.Vector3;
    let origin: THREE.Vector3 | undefined;

    if (this._curve) {
      // Approximate the player's progress by projecting its Z onto the curve.
      const prog = this._progressAtZ(playerPos.z);
      const ahead = THREE.MathUtils.randFloat(0.03, 0.06); // 3-6% of the path ahead
      const base = this._curve.getPointAt(Math.min(1, prog + ahead));
      // Lateral offset within the tunnel radius (or a generous open-space band).
      const maxOff = this._tunnelRadius > 0 ? this._tunnelRadius * 0.6 : 14;
      spawnPos = new THREE.Vector3(
        THREE.MathUtils.clamp(base.x + e.offsetX + THREE.MathUtils.randFloat(-3, 3), -maxOff, maxOff),
        THREE.MathUtils.clamp(base.y + e.offsetY + THREE.MathUtils.randFloat(-3, 3), -maxOff * 0.7, maxOff * 0.7),
        base.z,
      );
      // Origin = a bit further ahead on the same curve so enemies emerge flying
      // toward the player along the path.
      origin = this._curve.getPointAt(Math.min(1, prog + ahead + 0.04));
    } else {
      const dirs = [
        { x: 0, y: 1, z: -1 }, { x: 0, y: -1, z: -1 },
        { x: 1, y: 0, z: -1 }, { x: -1, y: 0, z: -1 },
        { x: 1, y: 1, z: -1 }, { x: -1, y: -1, z: -1 },
        { x: 0.5, y: 1, z: -1 }, { x: -0.5, y: -1, z: -1 },
      ];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      const dist = THREE.MathUtils.randFloat(35, 55);
      const spread = THREE.MathUtils.randFloat(3, 8);
      spawnPos = new THREE.Vector3(
        THREE.MathUtils.clamp(playerPos.x + dir.x * dist + e.offsetX + THREE.MathUtils.randFloat(-spread, spread), -18, 18),
        THREE.MathUtils.clamp(playerPos.y + dir.y * dist + e.offsetY + THREE.MathUtils.randFloat(-spread, spread), -10, 10),
        playerPos.z + dir.z * dist + e.offsetZ + THREE.MathUtils.randFloat(-10, 10),
      );
      origin = spawnPos.clone().add(new THREE.Vector3(dir.x * 20, dir.y * 20, dir.z * 20));
    }

    this.enemyManager.spawn(e.type, spawnPos, playerPos, e.pattern, origin);
  }

  // Estimate the rail progress (0..1) for a given world Z by sampling the curve.
  private _progressAtZ(z: number): number {
    if (!this._curve) return 0;
    const curve = this._curve;
    // Binary search for the point whose Z is closest to the given z.
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const pz = curve.getPointAt(mid).z;
      if (pz > z) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
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
    this._engageMode = false;
    this._formations = [];
    this._formationIndex = 0;
    this._enemyIndexInFormation = 0;
    this._intraFormationTimer = 0;
    this._interFormationTimer = 0;
    this._waitingForFormation = false;
    this._enemiesSpawned = 0;
    this._enemiesKilled = 0;
    this._lastPlayerZ = 0;
    this._spawningStopped = false;
    if (this.boss) this.boss.reset();
  }

  setEngageMode(active: boolean): void {
    this._engageMode = active;
  }

  despawnAll(): void {
    this.enemyManager.reset();
    if (this.boss) { this.boss.reset(); this._bossActive = false; }
  }

  get engageMode(): boolean { return this._engageMode; }

  dispose(): void {
    if (this.boss) { this.boss.dispose(); this.boss = null; }
  }
}

