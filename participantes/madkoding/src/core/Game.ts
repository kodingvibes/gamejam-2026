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
import { PlayerLifeManager } from '../player/PlayerLifeManager';
import { AudioManager } from '../audio/AudioManager';
import { MusicPlayer } from '../audio/MusicPlayer';
import { HUD } from '../ui/HUD';
import { MenuScreen } from '../ui/MenuScreen';
import { PauseOverlay } from '../ui/PauseOverlay';
import { GameOverScreen } from '../ui/GameOverScreen';
import { VictoryScreen } from '../ui/VictoryScreen';
import { LivesDisplay } from '../ui/LivesDisplay';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { RailFactory } from '../rail/RailFactory';

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

    this.explosionSystem = new ExplosionSystem(this.scene);
    this.particleManager = new ParticleManager(this.scene);
    this.hitSpark = new HitSpark(this.scene);
    this.screenEffects = new ScreenEffects();
    this.backgroundShips = new BackgroundShips(this.scene);
    this.powerUpManager = new PowerUpManager(this.scene);
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

    // Bomb auto-explosion: AOE damage + epic explosion
    this.weaponSystem.onBombExplode = (pos: THREE.Vector3) => {
      this.explosionSystem.spawnEpic(pos, 0xff6600);
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

    this.lifeManager.onPhaseChange = (phase) => this.livesDisplay.setPhase(phase);
    this.lifeManager.onLivesChange = (lives) => this.livesDisplay.setLives(lives);

    this.eventBinder = new GameEventBinder({
      stateManager: this.stateManager,
      scoreSystem: this.scoreSystem,
      audioManager: this.audioManager,
      explosionSystem: this.explosionSystem,
      hitSpark: this.hitSpark,
      weaponSystem: this.weaponSystem,
      waveManager: this.waveManager,
      callbacks: {
        startLevel: (l: number) => this.startLevel(l),
        onPlayerDeath: (score, wave) => this.lifeManager.onDeath(score, wave),
      },
    });
    this.eventBinder.bindAll();

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
    this.startLevel(0);
  }

  private resumeGame(): void {
    if (this.stateManager.current !== GameState.PAUSED) return;
    this.pauseOverlay.hide();
    this.stateManager.transition(GameState.PLAYING);
  }

  private startLevel(levelIndex: number): void {
    this.eventBinder.currentLevel = levelIndex;
    this.railController = new RailController(RailFactory.create(), RAIL.RAIL_SPEED);
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
    this.lifeManager.reset();
  }

  private onResize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.cameraRig.setAspect(w / h);
    this.postProcessing.setSize(w, h);
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
    this.updateRailSpeed(dt);
    this.railController.update(dt);
    this.applyInputToRail(input, dt);

    const railPos = this.railController.getWorldPosition();

    // Update crosshair position in HUD
    this.hud.updateCrosshair(input.aimX, input.aimY);

    // Calculate fire/aim direction from crosshair
    const fireDir = this.computeAimDirection(input.aimX, input.aimY, railPos);

    // Position ship and rotate it toward the aim direction.
    // Visibility is owned by PlayerLifeManager (death/game-over sequences hide it).
    this.playerShip.setPosition(railPos.position, railPos.forward, fireDir);
    this.playerShip.update(dt);
    this.cameraRig.setTarget(railPos.position, railPos.forward, railPos.up);
    this.cameraRig.update(dt);

    if (input.fire && this.lifeManager.phase === 'playing') this.weaponSystem.fireLaser(railPos.position.clone(), fireDir.clone());
    if (input.bomb && this.lifeManager.phase === 'playing') this.weaponSystem.fireBomb(railPos.position.clone(), fireDir.clone());

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

    this.scoreSystem.update(dt);
  }

  // Convert mouse NDC (-1..1) to a world-space direction from the ship.
  // Uses camera unproject to find a point in front of the camera at the
  // crosshair location, then computes direction from ship to that point.
  private _raycaster = new THREE.Raycaster();
  private _ndc = new THREE.Vector2();
  private _aimPoint = new THREE.Vector3();

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

  private updateRailSpeed(_dt: number): void {
    // Constant speed — no lerp, no acceleration changes
    this.railController.speed = this.waveManager.bossActive ? RAIL.RAIL_SPEED_BOSS : RAIL.RAIL_SPEED;
  }

  private applyInputToRail(input: ReturnType<InputMapper['update']>, dt: number): void {
    if (input.left || input.horizontalAxis < -0.2) this.railController.addLateralInput(-PLAYER.LATERAL_SPEED * dt);
    if (input.right || input.horizontalAxis > 0.2) this.railController.addLateralInput(PLAYER.LATERAL_SPEED * dt);
    if (input.up || input.verticalAxis < -0.2) this.railController.addVerticalInput(PLAYER.VERTICAL_SPEED * dt);
    if (input.down || input.verticalAxis > 0.2) this.railController.addVerticalInput(-PLAYER.VERTICAL_SPEED * dt);
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
