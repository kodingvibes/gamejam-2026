// ─── Game Orchestrator (slim, delegates to subcomponents) ───────────────────

import * as THREE from 'three';
import { RAIL, PLAYER } from '../types/config';
import { GameState } from './StateManager';
import { EventBus } from './EventBus';
import { Timekeeper } from './Timekeeper';
import { StateManager } from './StateManager';
import { GameSceneFactory } from './GameSceneFactory';
import { GameEventBinder } from './GameEventBinder';
import { ScoreSystem } from './ScoreSystem';
import { CollisionSystem } from './CollisionSystem';
import { EnemyProjectileManager } from './EnemyProjectileManager';
import { RailController } from '../rail/RailController';
import { CameraRig } from '../camera/CameraRig';
import { PostProcessingPipeline } from '../camera/PostProcessingPipeline';
import { InputMapper } from '../player/InputMapper';
import { PlayerShip } from '../player/PlayerShip';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { EnemyManager } from '../enemies/EnemyManager';
import { WaveManager } from '../waves/WaveManager';
import { ExplosionSystem } from '../fx/ExplosionSystem';
import { ParticleManager } from '../fx/ParticleManager';
import { HitSpark } from '../fx/HitSpark';
import { ScreenEffects } from '../fx/ScreenEffects';
import { BackgroundShips } from '../fx/BackgroundShips';
import { PowerUpManager } from '../fx/PowerUpManager';
import { ObstacleManager } from '../fx/ObstacleManager';
import { PlayerLifeManager } from '../player/PlayerLifeManager';
import { AudioManager } from '../audio/AudioManager';
import { MusicPlayer } from '../audio/MusicPlayer';
import { HUD } from '../ui/HUD';
import { MenuScreen } from '../ui/MenuScreen';
import { PauseOverlay } from '../ui/PauseOverlay';
import { GameOverScreen } from '../ui/GameOverScreen';
import { VictoryScreen } from '../ui/VictoryScreen';
import { LivesDisplay } from '../ui/LivesDisplay';
import { OffScreenIndicator } from '../ui/OffScreenIndicator';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { RailFactory } from '../rail/RailFactory';
import { LevelManager } from '../levels/LevelManager';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraRig: CameraRig;
  private postProcessing: PostProcessingPipeline;
  private eventBus: EventBus;
  private timekeeper: Timekeeper;
  private stateManager: StateManager;
  private inputMapper: InputMapper;
  private railController: RailController;
  private playerShip: PlayerShip;
  private weaponSystem: WeaponSystem;
  private enemyManager: EnemyManager;
  private waveManager: WaveManager;
  private explosionSystem: ExplosionSystem;
  private particleManager: ParticleManager;
  private hitSpark: HitSpark;
  private screenEffects: ScreenEffects;
  private backgroundShips: BackgroundShips;
  private powerUpManager: PowerUpManager;
  private obstacleManager: ObstacleManager;
  private lifeManager: PlayerLifeManager;
  private audioManager: AudioManager;
  private musicPlayer: MusicPlayer;
  private hud: HUD;
  private menuScreen: MenuScreen;
  private pauseOverlay: PauseOverlay;
  private gameOverScreen: GameOverScreen;
  private victoryScreen: VictoryScreen;
  private livesDisplay: LivesDisplay;
  private profiler: Stats;
  private scoreSystem: ScoreSystem;
  private collisionSystem: CollisionSystem;
  private enemyProjectileMgr: EnemyProjectileManager;
  private eventBinder: GameEventBinder;
  private offScreenIndicator: OffScreenIndicator;
  private levelManager: LevelManager;

  private _animFrameId = 0;
  private _running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.eventBus = EventBus.getInstance();
    this.timekeeper = Timekeeper.getInstance();
    this.stateManager = StateManager.getInstance();

    this.renderer = GameSceneFactory.createRenderer(canvas);
    this.scene = GameSceneFactory.create();
    GameSceneFactory.addLights(this.scene);

    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);
    this.postProcessing = new PostProcessingPipeline(
      this.renderer, this.scene, this.cameraRig.camera3D,
      window.innerWidth, window.innerHeight,
    );

    this.inputMapper = new InputMapper();
    this.railController = new RailController(RailFactory.create(), RAIL.RAIL_SPEED);
    this.playerShip = new PlayerShip(this.scene);
    this.weaponSystem = new WeaponSystem(this.scene, 60);
    this.enemyManager = new EnemyManager(this.scene, 40);
    this.waveManager = new WaveManager(this.scene, this.enemyManager);

    this.explosionSystem = new ExplosionSystem(this.scene, this.cameraRig.camera3D, this.cameraRig);
    this.particleManager = new ParticleManager(this.scene);
    this.hitSpark = new HitSpark(this.scene);
    this.screenEffects = new ScreenEffects();
    this.backgroundShips = new BackgroundShips(this.scene);
    this.powerUpManager = new PowerUpManager(this.scene);
    this.obstacleManager = new ObstacleManager(this.scene);
    this.audioManager = new AudioManager();
    this.musicPlayer = new MusicPlayer();

    this.hud = new HUD();
    this.livesDisplay = new LivesDisplay();
    this.menuScreen = new MenuScreen(() => this.startGame());
    this.pauseOverlay = new PauseOverlay({
      resume: () => this.resumeGame(),
      quit: () => this.returnToMenu(),
    });
    this.gameOverScreen = new GameOverScreen(() => this.startGame());
    this.victoryScreen = new VictoryScreen(() => this.returnToMenu());
    this.profiler = new Stats();

    this.scoreSystem = new ScoreSystem();
    this.collisionSystem = new CollisionSystem(
      this.enemyManager, this.weaponSystem, this.hitSpark,
    );
    this.enemyProjectileMgr = new EnemyProjectileManager(this.audioManager, this.scene);

    // Bomb auto-explosion: AOE damage + nuclear explosion
    this.weaponSystem.onBombExplode = (pos: THREE.Vector3) => {
      this.explosionSystem.spawnNuclear(pos, 0xffffff);
      this.audioManager.playExplosion();
      this.cameraRig.shake(1.0, 0.6);
      const blast = 50;
      for (const e of this.enemyManager.activeEnemies) {
        if (!e.active) continue;
        if (pos.distanceTo(e.position) < blast) e.takeDamage(200);
      }
      if (this.waveManager.bossActive && this.waveManager.bossInstance) {
        if (pos.distanceTo(this.waveManager.bossInstance.position) < blast) {
          this.waveManager.bossInstance.takeDamage(200);
        }
      }
    };

    // Player life manager (3 lives, death sequence, ENGAGE)
    this.lifeManager = new PlayerLifeManager({
      explosionSystem: this.explosionSystem,
      audioManager: this.audioManager,
      cameraRig: this.cameraRig,
      playerShip: this.playerShip,
      stateManager: this.stateManager,
    });

    this.lifeManager.onPhaseChange = (phase) => {
      this.livesDisplay.setPhase(phase);
      if (phase === 'dying') {
        // Player died — despawn all enemies immediately
        this.waveManager.despawnAll();
      } else if (phase === 'spawning') {
        // ENGAGE shown — block enemy spawning
        this.waveManager.setEngageMode(true);
      } else if (phase === 'playing') {
        // ENGAGE gone — release enemy spawning
        this.waveManager.setEngageMode(false);
      }
    };
    this.lifeManager.onLivesChange = (lives) => this.livesDisplay.setLives(lives);

    this.eventBinder = new GameEventBinder({
      stateManager: this.stateManager,
      scoreSystem: this.scoreSystem,
      audioManager: this.audioManager,
      explosionSystem: this.explosionSystem,
      hitSpark: this.hitSpark,
      screenEffects: this.screenEffects,
      cameraRig: this.cameraRig,
      weaponSystem: this.weaponSystem,
      waveManager: this.waveManager,
      callbacks: {
        startLevel: (l: number) => this.startLevel(l),
        onPlayerDeath: (score, wave) => this.lifeManager.onDeath(score, wave),
      },
    });
    this.eventBinder.bindAll();

    this.offScreenIndicator = new OffScreenIndicator(
      this.cameraRig.camera3D, this.enemyManager,
    );

    this.levelManager = new LevelManager();

    window.addEventListener('resize', () => this.onResize());
    this.stateManager.transition(GameState.MENU);
    this.menuScreen.show();
    this.hud.setVisible(false);
  }

  private startGame(): void {
    const state = this.stateManager.current;
    if (state !== GameState.MENU && state !== GameState.GAME_OVER) return;
    this.scoreSystem.reset();
    this.resetAllSystems();
    this.menuScreen.hide();
    this.pauseOverlay.hide();
    this.gameOverScreen.hide();
    this.victoryScreen.hide();
    this.stateManager.transition(GameState.PLAYING);
    this.hud.setVisible(true);
    this.musicPlayer.play();
    this.levelManager.reset();
    // First start: show ENGAGE before enemies spawn
    this.waveManager.setEngageMode(true);
    this.lifeManager.forceEngage();
    this.startLevel(0);
  }

  private resumeGame(): void {
    if (this.stateManager.current !== GameState.PAUSED) return;
    this.pauseOverlay.hide();
    this.stateManager.transition(GameState.PLAYING);
  }

  private startLevel(levelIndex: number): void {
    const level = this.levelManager.loadLevel(levelIndex);
    this.eventBinder.currentLevel = levelIndex;
    this.applyEnvironment(level);
    this.railController = new RailController(
      RailFactory.createFromConfig(level.rail),
      RAIL.RAIL_SPEED,
    );
    this.obstacleManager.setConfig(level.obstacles);
    this.enemyManager.reset();
    this.waveManager.reset();
    this.waveManager.startLevel(levelIndex);
    this.enemyProjectileMgr.clear();
  }

  private returnToMenu(): void {
    const state = this.stateManager.current;
    if (state !== GameState.PAUSED && state !== GameState.VICTORY) return;
    this.hud.setVisible(false);
    this.menuScreen.show();
    this.pauseOverlay.hide();
    this.gameOverScreen.hide();
    this.victoryScreen.hide();
    this.resetAllSystems();
    this.stateManager.transition(GameState.MENU);
  }

  private resetAllSystems(): void {
    this.playerShip.reset();
    this.weaponSystem.reset();
    this.enemyManager.reset();
    this.waveManager.reset();
    this.explosionSystem.reset();
    this.particleManager.reset();
    this.hitSpark.reset();
    this.screenEffects.reset();
    this.hud.reset();
    this.railController.reset();
    this.enemyProjectileMgr.clear();
    this.powerUpManager.reset();
    this.obstacleManager.reset();
    this.lifeManager.reset();
  }

  private onResize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraRig.setAspect(w / h);
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.loop(0);
  }

  stop(): void {
    this._running = false;
    if (this._animFrameId) cancelAnimationFrame(this._animFrameId);
    this._animFrameId = 0;
  }

  private loop = (timestamp: number): void => {
    if (!this._running) return;
    this._animFrameId = requestAnimationFrame(this.loop);
    this.profiler.begin();
    this.timekeeper.update(timestamp);

    const dt = this.timekeeper.delta;
    const state = this.stateManager.current;
    const input = this.inputMapper.update();

    this.handlePauseToggle(input, state);

    if (state === GameState.PLAYING) this.updatePlaying(dt, input);

    // Life manager always updates (handles death sequence, fade, ENGAGE)
    if (state === GameState.PLAYING) this.lifeManager.update(dt);

    this.explosionSystem.update(dt);
    this.particleManager.update(dt, this.playerShip.position);
    this.hitSpark.update(dt);
    this.postProcessing.render(dt);
    this.profiler.end();
  };

  private handlePauseToggle(input: ReturnType<InputMapper['update']>, state: GameState): void {
    if (input.pause && state === GameState.PLAYING) {
      this.stateManager.transition(GameState.PAUSED);
      this.pauseOverlay.show();
    } else if (input.pause && state === GameState.PAUSED) {
      this.resumeGame();
    }
  }

  private updatePlaying(dt: number, input: ReturnType<InputMapper['update']>): void {
    this.railController.speed = this.waveManager.bossActive ? RAIL.RAIL_SPEED_BOSS : RAIL.RAIL_SPEED;
    this.railController.update(dt);

    // Base rail position: what the camera follows. It ignores the player's
    // screen-space movement so the ship can slide freely around the frame.
    const railCameraPos = this.railController.getRailPosition();

    // ── Starfox-style screen-space ship movement ────────────────────────────
    // The player controls a point on the screen in NDC space (-1..1). That
    // point is converted to a world-space offset from the rail.
    let targetScreenX: number;
    let targetScreenY: number;

    if (document.body.classList.contains('cursor-hidden')) {
      targetScreenX = input.moveX;
      targetScreenY = input.moveY;
    } else {
      targetScreenX = this.playerShip.screenX + input.horizontalAxis * PLAYER.SCREEN_DRIFT_SPEED * dt;
      targetScreenY = this.playerShip.screenY + input.verticalAxis * PLAYER.SCREEN_DRIFT_SPEED * dt;
    }

    targetScreenX = THREE.MathUtils.clamp(targetScreenX, -PLAYER.SCREEN_LIMIT, PLAYER.SCREEN_LIMIT);
    targetScreenY = THREE.MathUtils.clamp(targetScreenY, -PLAYER.SCREEN_LIMIT, PLAYER.SCREEN_LIMIT);

    const newScreenX = THREE.MathUtils.lerp(this.playerShip.screenX, targetScreenX, PLAYER.SCREEN_LAG * dt);
    const newScreenY = THREE.MathUtils.lerp(this.playerShip.screenY, targetScreenY, PLAYER.SCREEN_LAG * dt);
    this.playerShip.setScreenPosition(newScreenX, newScreenY, dt);

    // Convert screen NDC to a world-space offset on the rail plane.
    const screenOffset = this.ndcToWorldOffset(newScreenX, newScreenY, railCameraPos);
    this.railController.setScreenOffset(screenOffset.x, screenOffset.y);

    // True ship world position: rail base + screen offset.
    const shipWorldPos = this.railController.getWorldPosition();

    // Banking based on actual screen velocity so the ship leans into movement.
    this.playerShip.setBankInput(
      THREE.MathUtils.clamp(this.playerShip.screenVelocityX * 2, -1, 1),
      THREE.MathUtils.clamp(-this.playerShip.screenVelocityY * 2, -1, 1),
    );

    // ── Crosshair / aim ──────────────────────────────────────────────────────
    // With mouse the crosshair is the pointer (ship position). With keyboard
    // the crosshair drifts from the ship center with the same axes.
    let aimScreenX: number;
    let aimScreenY: number;
    if (document.body.classList.contains('cursor-hidden')) {
      aimScreenX = newScreenX;
      aimScreenY = newScreenY;
    } else {
      this._keyboardAimX += input.horizontalAxis * this.AIM_DRIFT_SPEED * dt;
      this._keyboardAimY += input.verticalAxis * this.AIM_DRIFT_SPEED * dt;
      if (input.horizontalAxis === 0 && input.verticalAxis === 0) {
        this._keyboardAimX *= 0.92;
        this._keyboardAimY *= 0.92;
      }
      this._keyboardAimX = THREE.MathUtils.clamp(this._keyboardAimX, -0.6, 0.6);
      this._keyboardAimY = THREE.MathUtils.clamp(this._keyboardAimY, -0.5, 0.5);
      aimScreenX = newScreenX + this._keyboardAimX;
      aimScreenY = newScreenY + this._keyboardAimY;
    }

    this.hud.updateCrosshair(aimScreenX, aimScreenY);

    // Calculate fire/aim direction from crosshair.
    const fireDir = this.computeAimDirection(aimScreenX, aimScreenY, shipWorldPos);

    // Position ship and rotate it toward the aim direction.
    this.playerShip.setPosition(shipWorldPos.position, shipWorldPos.forward, fireDir);
    this.playerShip.update(dt);

    // Camera rides the rail, not the ship. It only banks slightly with the
    // ship's offset so the frame leans toward the player's position.
    this.cameraRig.setTarget(railCameraPos, screenOffset.x, screenOffset.y);
    this.cameraRig.update(dt);

    if (input.fire && this.lifeManager.phase === 'playing') this.weaponSystem.fireLaser(shipWorldPos.position.clone(), fireDir.clone(), shipWorldPos.forward.clone());
    if (input.bomb && this.lifeManager.phase === 'playing') this.weaponSystem.fireBomb(shipWorldPos.position.clone(), fireDir.clone());

    this.weaponSystem.update(dt, this.playerShip.position);
    this.backgroundShips.update(dt, this.playerShip.position);
    this.waveManager.corvettePositions = this.backgroundShips.positions;
    this.waveManager.update(dt, this.playerShip.position);

    const playerProjectiles = this.weaponSystem.projectilesList.filter(p => p.active && p.isPlayerProjectile);
    this.enemyManager.update(dt, this.playerShip.position, playerProjectiles);

    this.spawnPendingEnemyProjectiles();
    this.collisionSystem.checkProjectilesVsEnemies();
    if (this.waveManager.bossActive && this.waveManager.bossInstance) {
      this.collisionSystem.checkProjectilesVsBoss(this.waveManager.bossInstance);
    }
    this.handleBossAttacks();

    const { hit } = this.enemyProjectileMgr.update(dt, this.playerShip.position);
    if (hit) { this.playerShip.takeDamage(10); this.hitSpark.spawn(this.playerShip.position.clone(), 0xff4444); }

    // Power-ups
    const { healthGained, bombsGained } = this.powerUpManager.update(dt, this.playerShip.position);
    if (healthGained > 0) this.playerShip.heal(healthGained);
    if (bombsGained > 0) this.weaponSystem.addBombs(bombsGained);

    // Obstacles (asteroids the player must dodge) — on hit, damage + sparks +
    // knockback push away from the asteroid.
    const obs = this.obstacleManager.update(dt, this.playerShip.position);
    if (obs.hit) {
      this.playerShip.takeDamage(15);
      this.hitSpark.spawn(this.playerShip.position.clone(), 0xff8800);
      this.cameraRig.shake(0.5, 0.35);
      // Push the player away from the asteroid.
      this.playerShip.position.add(obs.push);
    }

    this.scoreSystem.update(dt);

    // Off-screen enemy indicators
    this.offScreenIndicator.update(this.playerShip.position);
  }

  // Convert mouse NDC (-1..1) to a world-space direction from the ship.
  // Uses camera unproject to find a point in front of the camera at the
  // crosshair location, then computes direction from ship to that point.
  private _raycaster = new THREE.Raycaster();
  private _ndc = new THREE.Vector2();
  private _aimPoint = new THREE.Vector3();
  private _projVec = new THREE.Vector3();
  private _keyboardAimX = 0;
  private _keyboardAimY = 0;

  // Convert a screen NDC position into a world-space offset relative to the
  // current rail position. Used to make the ship follow the mouse / arrows
  // across the whole viewport while staying inside the tunnel bounds.
  // Keyboard crosshair drift speed in NDC units/sec.
  private readonly AIM_DRIFT_SPEED = 1.6;

  private _ndcToWorldOffset = new THREE.Vector3();
  private _offsetRight = new THREE.Vector3();
  private _offsetUp = new THREE.Vector3();
  private ndcToWorldOffset(x: number, y: number, railPos: { position: THREE.Vector3; forward: THREE.Vector3; up: THREE.Vector3 }): THREE.Vector2 {
    this._ndcToWorldOffset.set(x, y, 0.5).unproject(this.cameraRig.camera3D);
    this._ndcToWorldOffset.sub(this.cameraRig.camera3D.position);
    const dist = railPos.position.distanceTo(this.cameraRig.camera3D.position);
    this._ndcToWorldOffset.multiplyScalar(dist / this._ndcToWorldOffset.length());
    const worldPoint = this.cameraRig.camera3D.position.clone().add(this._ndcToWorldOffset);

    const projected = worldPoint.clone().sub(railPos.position);
    this._offsetRight.copy(railPos.forward).cross(railPos.up).normalize();
    this._offsetUp.copy(railPos.up).normalize();
    return new THREE.Vector2(projected.dot(this._offsetRight), projected.dot(this._offsetUp));
  }

  // Project a world position to NDC (-1..1). Used to anchor the crosshair to
  // the ship's on-screen position so it follows the ship as it drifts within
  // the frame (camera parallax lag).
  private projectToNdc(worldPos: THREE.Vector3): THREE.Vector2 {
    this._projVec.copy(worldPos).project(this.cameraRig.camera3D);
    return new THREE.Vector2(this._projVec.x, this._projVec.y);
  }

  private computeAimDirection(aimX: number, aimY: number, railPos: { position: THREE.Vector3; forward: THREE.Vector3 }): THREE.Vector3 {
    // Unproject a point at the crosshair screen position, at a distance ahead
    this._ndc.set(aimX, aimY);
    this._raycaster.setFromCamera(this._ndc, this.cameraRig.camera3D);

    // Project a point 50 units ahead along the ray
    this._aimPoint.copy(this._raycaster.ray.origin).addScaledVector(this._raycaster.ray.direction, 50);

    // Direction from ship position to the aim point
    const dir = this._aimPoint.clone().sub(railPos.position).normalize();

    // Blend with forward so lasers always go generally forward even if aiming sideways
    const forward = railPos.forward.clone();
    const blended = dir.clone().lerp(forward, 0.3).normalize();
    return blended;
  }



  private spawnPendingEnemyProjectiles(): void {
    const pending = this.enemyManager.pendingProjectiles;
    for (const pp of pending) {
      this.enemyProjectileMgr.spawn(pp.position, pp.velocity.normalize(), pp.velocity.length());
    }
    this.enemyManager.clearPendingProjectiles();
  }

  private handleBossAttacks(): void {
    if (!this.waveManager.bossActive || !this.waveManager.bossInstance) return;
    const boss = this.waveManager.bossInstance;
    if (!boss.canAttack()) return;

    for (const { position, dir } of boss.computeVolley(this.playerShip.position)) {
      this.enemyProjectileMgr.spawn(position, dir, 22);
    }
    boss.resetAttackTimer();
  }

  dispose(): void {
    this.stop();
    this.inputMapper.dispose();
    this.weaponSystem.dispose();
    this.enemyManager.dispose();
    this.waveManager.dispose();
    this.explosionSystem.dispose();
    this.particleManager.dispose();
    this.hitSpark.dispose();
    this.screenEffects.dispose();
    this.backgroundShips.dispose();
    this.powerUpManager.dispose();
    this.obstacleManager.dispose();
    this.audioManager.dispose();
    this.hud.dispose();
    this.menuScreen.dispose();
    this.pauseOverlay.dispose();
    this.gameOverScreen.dispose();
    this.victoryScreen.dispose();
    this.postProcessing.dispose();
    this.playerShip.dispose();
    this.enemyProjectileMgr.dispose();
    this.renderer.dispose();
  }
}

