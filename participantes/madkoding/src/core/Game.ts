// ─── Game Orchestrator (slim, delegates to subcomponents) ───────────────────

import * as THREE from 'three';
import { RAIL, PLAYER } from '../types/config';
import { GameState } from './StateManager';
import { EventBus } from './EventBus';
import { GameEvent } from '../types/events';
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
import { InputMapper, type InputState } from '../player/InputMapper';
import { PlayerShip } from '../player/PlayerShip';
import { WeaponSystem } from '../weapons/WeaponSystem';
import { EnemyManager } from '../enemies/EnemyManager';
import { WaveManager } from '../waves/WaveManager';
import { ExplosionSystem } from '../fx/ExplosionSystem';
import { ParticleManager } from '../fx/ParticleManager';
import { HitSpark } from '../fx/HitSpark';
import { ScreenEffects } from '../fx/ScreenEffects';
import { BackgroundShips } from '../fx/BackgroundShips';
import { FxDirector } from '../fx/FxDirector';
import { LavaEruptions } from '../environment/LavaEruptions';
import { SpaceScenery } from '../environment/SpaceScenery';
import { setRailShape } from '../environment/RailShape';
import { hasGround } from '../environment/TerrainField';
import { FOG_NEAR, FOG_FAR } from '../environment/TerrainManager';
import { TerrainManager } from '../environment/TerrainManager';
import { TerrainDecorations } from '../environment/TerrainDecorations';
import { Skybox, getEnvironmentColors } from '../environment/Skybox';
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
import { Announcer } from '../ui/Announcer';
import { ScorePopups } from '../ui/ScorePopups';
import { RailFactory } from '../rail/RailFactory';
import { LevelManager } from '../levels/LevelManager';
import type { LevelDefinition, TerrainType } from '../levels/LevelData';

// Cinematic sequences that run on GAME time (so pausing freezes them too —
// the old level transition was a setTimeout that kept running while paused).
type SequenceKind = 'none' | 'clear' | 'warpOut' | 'warpIn';

const BOOST_DRAIN = 0.45;   // meter per second while boosting
const BOOST_REGEN = 0.16;   // meter per second while cruising
const BOOST_MIN_START = 0.2;

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraRig: CameraRig;
  private postProcessing: PostProcessingPipeline;
  private fx: FxDirector;
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
  private lavaEruptions: LavaEruptions;
  private spaceScenery: SpaceScenery;
  private terrainManager: TerrainManager;
  private terrainDecorations: TerrainDecorations;
  private skybox: Skybox;
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
  private announcer: Announcer;
  private scorePopups: ScorePopups;
  private scoreSystem: ScoreSystem;
  private collisionSystem: CollisionSystem;
  private enemyProjectileMgr: EnemyProjectileManager;
  private eventBinder: GameEventBinder;
  private offScreenIndicator: OffScreenIndicator;
  private levelManager: LevelManager;

  private pmrem!: THREE.PMREMGenerator;
  private envCache = new Map<THREE.Texture, THREE.Texture>();
  private _shadowScan = 0;
  private _sunOffset = new THREE.Vector3(10, 20, 10).normalize().multiplyScalar(260);

  private _animFrameId = 0;
  private _running = false;

  // Sequence state
  private _seq: SequenceKind = 'none';
  private _seqTime = 0;
  private _seqNextLevel = 0;
  private _seqFlags = new Set<string>();
  private _speedMult = 1;
  private _speedMultTarget = 1;

  // Boost / movement
  private _boostMeter = 1;
  private _boosting = false;
  private _knockX = 0;
  private _knockY = 0;
  private _locked = false;

  private readonly onVisibility = () => {
    if (document.hidden && this.stateManager.current === GameState.PLAYING) this.pauseGame();
  };
  private readonly onResizeRef = () => this.onResize();

  constructor(canvas: HTMLCanvasElement) {
    this.eventBus = EventBus.getInstance();
    // Recreating the Game (HMR / reinit) must not stack listeners from the
    // previous instance on the global singleton bus.
    this.eventBus.clear();
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
    this.fx = new FxDirector(this.postProcessing, this.cameraRig.camera3D);

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
    this.terrainManager = new TerrainManager(this.scene);
    this.terrainDecorations = new TerrainDecorations(this.scene);
    this.skybox = new Skybox(this.scene, this.cameraRig.camera3D);
    this.lavaEruptions = new LavaEruptions(this.scene);
    this.spaceScenery = new SpaceScenery(this.scene, this.cameraRig.camera3D);
    // Keep fog + water reflections in sync with the active sky photo.
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.skybox.onSkyChange = (tex, horizon) => {
      this.terrainManager.setHorizon(horizon, tex);
      // Image-based lighting from the same photo: metals and hulls reflect
      // the actual sky of the biome.
      if (tex) {
        let env = this.envCache.get(tex);
        if (!env) {
          env = this.pmrem.fromEquirectangular(tex).texture;
          this.envCache.set(tex, env);
        }
        this.scene.environment = env;
      }
      if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(this.terrainManager.horizonColor);
    };
    this.powerUpManager = new PowerUpManager(this.scene);
    this.obstacleManager = new ObstacleManager(this.scene);
    this.obstacleManager.onDestroyed = (center, color, size) => {
      this.explosionSystem.spawn(center, Math.max(2.5, size * 1.6), color);
      this.hitSpark.spawn(center, color, 1.8);
      this.audioManager.playSmallExplosion();
      this.cameraRig.addTrauma(0.12);
      this.scorePopups.spawn(center, 50, 1);
      this.scoreSystem.addBonus(50);
    };
    this.audioManager = new AudioManager();
    this.musicPlayer = new MusicPlayer();

    this.hud = new HUD();
    this.livesDisplay = new LivesDisplay();
    this.announcer = new Announcer();
    this.scorePopups = new ScorePopups(this.cameraRig.camera3D);
    this.menuScreen = new MenuScreen(() => this.startGame());
    this.pauseOverlay = new PauseOverlay({
      resume: () => this.resumeGame(),
      quit: () => this.returnToMenu(),
    });
    this.gameOverScreen = new GameOverScreen(() => this.startGame(), () => this.returnToMenu());
    this.victoryScreen = new VictoryScreen(() => this.returnToMenu());

    this.scoreSystem = new ScoreSystem();
    this.collisionSystem = new CollisionSystem(
      this.enemyManager, this.weaponSystem, this.hitSpark, this.obstacleManager,
    );
    this.collisionSystem.onHit = (_pos, killed) => this.hud.hitMarker(killed);
    this.enemyProjectileMgr = new EnemyProjectileManager(this.audioManager, this.scene);

    // Bomb auto-explosion: AOE damage + nuclear explosion
    this.weaponSystem.onBombExplode = (pos: THREE.Vector3) => {
      this.explosionSystem.spawnNuclear(pos, 0xffffff);
      this.audioManager.playExplosion();
      this.cameraRig.addTrauma(0.7);
      this.fx.flash(0.75, 0xfff4dd, 2.2);
      this.fx.slowMo(0.35, 0.55, 0.35);
      this.fx.kickFov(-9);
      this.fx.bloomPulse(1.6);
      this.fx.aberrate(1.2);
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
      // Bombs also wipe incoming fire — a panic button, Star Fox style.
      this.enemyProjectileMgr.clear();
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
      if (phase === 'dying' || phase === 'gameover') {
        // Player died — despawn all enemies immediately
        this.waveManager.despawnAll();
        this.enemyProjectileMgr.clear();
        if (phase === 'gameover') this.fx.setSaturation(0.15);
      } else if (phase === 'spawning') {
        // ENGAGE shown — block enemy spawning, ship is untouchable meanwhile
        this.waveManager.setEngageMode(true);
        this.playerShip.grantInvincibility(3.6);
        this.fx.setSaturation(1);
      } else if (phase === 'playing') {
        // ENGAGE gone — release enemy spawning (unless a warp is running)
        if (this._seq === 'none') this.waveManager.setEngageMode(false);
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
        onLevelComplete: (next: number) => this.beginStageClear(next),
        onPlayerDeath: (score, wave) => this.lifeManager.onDeath(score, wave),
        onEnemyKilled: (pos, gained, combo) => {
          this.scorePopups.spawn(pos, gained, combo);
          this.fx.hitStop(0.028);
          this.fx.aberrate(0.18);
          this.cameraRig.addTrauma(0.08);
        },
      },
    });
    this.eventBinder.bindAll();
    this.bindMotionFx();

    this.offScreenIndicator = new OffScreenIndicator(
      this.cameraRig.camera3D, this.enemyManager,
    );

    this.levelManager = new LevelManager();

    window.addEventListener('resize', this.onResizeRef);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.stateManager.transition(GameState.MENU);
    // Menu backdrop: first level's environment with the ship on display.
    this.applyEnvironment(this.levelManager.loadLevel(0));
    this.enterMenuPose();
    this.menuScreen.show();
    this.hud.setVisible(false);
    this.livesDisplay.setVisible(false);
  }

  // ── Event-driven motion design ────────────────────────────────────────────
  private bindMotionFx(): void {
    const bus = this.eventBus;
    bus.on(GameEvent.STATE_CHANGE, (p) => {
      document.body.classList.toggle('in-game', p.to === GameState.PLAYING);
    });
    bus.on(GameEvent.PLAYER_DAMAGED, () => {
      this.fx.hurt(0.9);
      this.fx.hitStop(0.06);
      this.cameraRig.addTrauma(0.35);
    });
    bus.on(GameEvent.PLAYER_SHIELD_LOST, (p) => {
      this.fx.aberrate(0.7);
      this.fx.flash(0.16, 0x44ddff, 5);
      this.cameraRig.addTrauma(0.25);
      this.announcer.toast(p.shields > 0 ? `ESCUDO ${p.shields}` : 'SIN ESCUDOS', p.shields > 0 ? 'cyan' : 'red');
    });
    bus.on(GameEvent.PLAYER_DEATH, () => {
      this.fx.slowMo(0.3, 1.1, 0.6);
      this.fx.hurt(1);
    });
    bus.on(GameEvent.BOSS_SPAWNED, (p) => {
      this.announcer.warning('WARNING', `${p.name} SE ACERCA`);
      this.audioManager.playAlarm();
      this.fx.flash(0.22, 0xff2244, 2);
    });
    bus.on(GameEvent.BOSS_PHASE, (p) => {
      this.announcer.toast(`FASE ${p.phase}`, 'red');
      this.fx.flash(0.3, 0xff3344, 3);
      this.fx.aberrate(0.9);
      this.cameraRig.addTrauma(0.45);
      this.audioManager.playDeathExplosion();
    });
    bus.on(GameEvent.BOSS_DESTROYED, () => {
      this.fx.hitStop(0.14);
      this.fx.slowMo(0.22, 2.6, 1.2);
      this.fx.flash(1, 0xffffff, 1.1);
      this.fx.kickFov(14);
      this.fx.bloomPulse(2);
      this.fx.aberrate(1.8);
      this.enemyProjectileMgr.clear();
      this.enemyManager.reset();
    });
  }

  private enterMenuPose(): void {
    this.playerShip.reset();
    this.playerShip.setPosition(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1));
    this.playerShip.setBankInput(0, 0);
    this.cameraRig.reset();
  }

  private startGame(): void {
    const state = this.stateManager.current;
    if (state !== GameState.MENU && state !== GameState.GAME_OVER) return;
    this.scoreSystem.reset();
    this.resetAllSystems();
    this.timekeeper.reset();
    this.menuScreen.hide();
    this.pauseOverlay.hide();
    this.gameOverScreen.hide();
    this.victoryScreen.hide();
    this.stateManager.transition(GameState.PLAYING);
    this.hud.setVisible(true);
    this.livesDisplay.setVisible(true);
    this.musicPlayer.stop();
    this.musicPlayer.play();
    this.levelManager.reset();
    // Random first level so the player can preview the different terrain /
    // skybox types available across the 20 levels on each new run.
    const randomLevel = Math.floor(Math.random() * this.levelManager.totalLevels);
    this.startLevel(randomLevel);
    // Warp-in intro: arrive out of hyperspace, then ENGAGE.
    this.beginWarpIn(true);
  }

  private pauseGame(): void {
    if (this.stateManager.current !== GameState.PLAYING) return;
    this.stateManager.transition(GameState.PAUSED);
    this.pauseOverlay.show();
    this.musicPlayer.pause();
  }

  private resumeGame(): void {
    if (this.stateManager.current !== GameState.PAUSED) return;
    this.pauseOverlay.hide();
    this.musicPlayer.resume();
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
    this.terrainManager.setCurve(this.railController.getCurve());
    this.obstacleManager.reset();
    this.lavaEruptions.reset();
    this.obstacleManager.setConfig(level.obstacles);
    this.obstacleManager.setTerrain(level.environment.terrain);
    this.enemyManager.reset();
    this.enemyManager.setTunnel(this.railController.getCurve(), this.tunnelRadius(level.environment.terrain));
    this.waveManager.reset();
    this.waveManager.setRail(this.railController.getCurve(), this.tunnelRadius(level.environment.terrain));
    this.waveManager.startLevel(levelIndex);
    this.enemyProjectileMgr.clear();
    this.weaponSystem.clearProjectiles();
    // New rail: jump the camera instead of swooping across the old level.
    this.cameraRig.snap();
  }

  // Tunnel radius for wave spawning: cave/ice have tunnel walls, everything
  // else is open space (no clamping).
  private tunnelRadius(terrain: TerrainType): number {
    if (terrain === 'cave') return 16;
    if (terrain === 'ice') return 18;
    return 0;
  }

  // Apply the level's environment: sky/fog color, starfield + nebulae config,
  // ambient light intensity, and whether background corvettes are visible.
  private applyEnvironment(level: LevelDefinition): void {
    const env = level.environment;
    const envColors = getEnvironmentColors(env.terrain);
    // Photo skybox: 360° hyperrealistic backdrop matching the terrain's context.
    this.skybox.apply(env.terrain);
    this.scene.background = null;
    // The rail shape drives the terrain valley and the liquid levels, so it
    // must be set before the terrain is (re)built.
    setRailShape(level.rail);
    this.particleManager.reconfigure(env.starfield, env.nebulae);
    const ambient = this.scene.userData.ambientLight as THREE.AmbientLight | undefined;
    // Flat ambient is lower than before: IBL from the sky + baked/screen AO
    // now carry the fill light, which keeps contact shadows readable.
    if (ambient) ambient.intensity = 1.6 + env.ambientLight * 2.4;
    // Tint the hemisphere + directional lights with the zone's sky/ground
    // colors so ships and props are lit by the environment (not pasted on top).
    const hemi = this.scene.userData.hemisphereLight as THREE.HemisphereLight | undefined;
    if (hemi) {
      hemi.color.copy(envColors.sky).lerp(new THREE.Color(0xffffff), 0.5);
      hemi.groundColor.copy(envColors.ground).lerp(new THREE.Color(0xffffff), 0.5);
      hemi.intensity = 1.8 + env.ambientLight * 1.4;
    }
    const dirLight = this.scene.userData.dirLight as THREE.DirectionalLight | undefined;
    if (dirLight) {
      dirLight.color.copy(envColors.sky).lerp(new THREE.Color(0xffffff), 0.5);
      dirLight.intensity = 1.8 + env.ambientLight * 1.8;
    }
    const fillLight = this.scene.userData.fillLight as THREE.DirectionalLight | undefined;
    if (fillLight) {
      fillLight.color.copy(envColors.ground).lerp(new THREE.Color(0xffffff), 0.4);
    }
    // Under-rim light (below-behind +Z): tint with the ground color so the
    // back/bottom faces of objects stay lit in the biome's palette.
    const underLight = this.scene.userData.underLight as THREE.DirectionalLight | undefined;
    if (underLight) {
      underLight.color.copy(envColors.ground).lerp(new THREE.Color(0xffffff), 0.5);
    }
    this.backgroundShips.setVisible(env.backgroundShips);
    // Space-like biomes have no ground — hide the terrain so the skybox and
    // starfield read as open space. Terrain biomes keep the ground visible.
    const spaceLike = env.terrain === 'space' || env.terrain === 'nebula' ||
                      env.terrain === 'void' || env.terrain === 'aurora';
    this.terrainManager.apply(env.terrain);
    this.terrainManager.setVisible(!spaceLike && hasGround());
    this.terrainManager.setHorizon(this.skybox.horizon, this.skybox.texture);
    // Distance fog only where there is ground to fade into the horizon.
    this.scene.fog = hasGround() ? new THREE.Fog(this.terrainManager.horizonColor.clone(), FOG_NEAR, FOG_FAR) : null;
    this.terrainDecorations.apply(env.terrain);
    this.lavaEruptions.setEnabled(env.terrain === 'lava');
    this.spaceScenery.apply(env.terrain, this.cameraRig.camera3D.position);
  }

  private returnToMenu(): void {
    const state = this.stateManager.current;
    if (state !== GameState.PAUSED && state !== GameState.VICTORY && state !== GameState.GAME_OVER) return;
    this.hud.setVisible(false);
    this.livesDisplay.setVisible(false);
    this.menuScreen.show();
    this.pauseOverlay.hide();
    this.gameOverScreen.hide();
    this.victoryScreen.hide();
    this.musicPlayer.stop();
    this.resetAllSystems();
    this.stateManager.transition(GameState.MENU);
    this.enterMenuPose();
  }

  private resetAllSystems(): void {
    this._seq = 'none';
    this._seqTime = 0;
    this._seqFlags.clear();
    this._speedMult = this._speedMultTarget = 1;
    this._boostMeter = 1;
    this._boosting = false;
    this._knockX = this._knockY = 0;
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
    this.lavaEruptions.reset();
    this.lifeManager.reset();
    this.terrainManager.reset();
    this.terrainDecorations.reset();
    this.offScreenIndicator.reset();
    this.announcer.clear();
    this.scorePopups.reset();
    this.fx.reset();
    this.livesDisplay.setPhase('playing');
  }

  private onResize(): void {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.postProcessing.setSize(w, h);
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
    this.timekeeper.update(timestamp);

    const dt = this.timekeeper.delta;
    const rawDt = this.timekeeper.rawDelta;
    const state = this.stateManager.current;
    const input = this.inputMapper.update();

    this.handlePauseToggle(input, state);

    if (state === GameState.PLAYING) {
      this.updatePlaying(dt, input);
      // Life manager always updates (handles death sequence, fade, ENGAGE)
      this.lifeManager.update(dt);
      this.updateSequence(dt);
    } else if (state === GameState.MENU) {
      this.playerShip.update(rawDt);
      this.cameraRig.updateOrbit(rawDt, this.playerShip.position);
    }

    if (state !== GameState.PAUSED) {
      this.explosionSystem.update(dt);
      this.hitSpark.update(dt);
    }
    // Freeze ambient particles while paused (they used to keep drifting).
    const ambientDt = state === GameState.PAUSED ? 0 : dt;
    this.particleManager.update(ambientDt, this.playerShip.position);
    this.skybox.update();
    this.spaceScenery.update(ambientDt);
    this.updateSunShadows();
    this.fx.update(rawDt, state === GameState.PAUSED);
    this.postProcessing.render(rawDt);
  };

  // Keep the shadow box on the ship, and flag new solid meshes as casters
  // (ships, enemies, obstacles spawn over time; GLBs load asynchronously).
  private updateSunShadows(): void {
    const sun = this.scene.userData.dirLight as THREE.DirectionalLight | undefined;
    if (!sun) return;
    const p = this.playerShip.position;
    sun.position.copy(p).add(this._sunOffset);
    sun.target.position.copy(p);
    sun.target.updateMatrixWorld();
    if (++this._shadowScan % 30 !== 0) return;
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || o.userData.noCast || m.castShadow) return;
      const mat = m.material as THREE.MeshStandardMaterial;
      if (!mat || mat.transparent || mat.blending === THREE.AdditiveBlending || mat.side === THREE.BackSide) return;
      if (!(mat.isMeshStandardMaterial || (mat as unknown as THREE.MeshPhongMaterial).isMeshPhongMaterial)) return;
      m.castShadow = true;
      m.receiveShadow = true;
    });
  }

  private handlePauseToggle(input: InputState, state: GameState): void {
    if (input.pause && state === GameState.PLAYING) {
      this.pauseGame();
    } else if (input.pause && state === GameState.PAUSED) {
      this.resumeGame();
    }
  }

  // ── Cinematic sequences ───────────────────────────────────────────────────

  private beginStageClear(nextLevel: number): void {
    this._seq = 'clear';
    this._seqTime = 0;
    this._seqNextLevel = nextLevel;
    this._seqFlags.clear();
    this.waveManager.setEngageMode(true);
  }

  private beginWarpIn(first: boolean): void {
    this._seq = 'warpIn';
    this._seqTime = 0;
    this._seqFlags.clear();
    if (first) this._seqFlags.add('first');
    this.waveManager.setEngageMode(true);
    this.fx.setWarp(1.15);
    this._speedMult = this._speedMultTarget = 4;
    this.fx.flash(1, 0xffffff, 1.4);
    this.audioManager.playWarpArrive();
    const lvl = this.levelManager.currentLevel;
    this.announcer.stageIntro(lvl.id, lvl.name, this.levelManager.totalLevels);
  }

  private get sequenceActive(): boolean {
    return this._seq !== 'none';
  }

  private once(flag: string): boolean {
    if (this._seqFlags.has(flag)) return false;
    this._seqFlags.add(flag);
    return true;
  }

  private updateSequence(dt: number): void {
    if (this._seq === 'none') return;
    this._seqTime += dt;
    const t = this._seqTime;

    switch (this._seq) {
      case 'clear': {
        if (t >= 1.4 && this.once('tally')) {
          const level = this.levelManager.currentIndex + 1;
          const bonus = 1000 * level + Math.round(this.playerShip.health) * 20 + this.weaponSystem.bombs * 500;
          this.scoreSystem.addBonus(bonus);
          this.announcer.stageClear(bonus);
          this.audioManager.playVictory();
        }
        if (t >= 4.6) {
          this._seq = 'warpOut';
          this._seqTime = 0;
          this.fx.setWarp(1);
          this._speedMultTarget = 6;
          this.audioManager.playWarp();
        }
        break;
      }
      case 'warpOut': {
        this.cameraRig.addTrauma(dt * 0.6);
        if (t >= 1.5) {
          this.startLevel(this._seqNextLevel);
          this.beginWarpIn(false);
        }
        break;
      }
      case 'warpIn': {
        if (t >= 0.35 && this.once('decel')) {
          this.fx.setWarp(0);
          this._speedMultTarget = 1;
          this.fx.kickFov(-6);
        }
        if (t >= 1.1 && this.once('engage')) {
          this.lifeManager.forceEngage();
        }
        if (t >= 1.6) this._seq = 'none';
        break;
      }
    }
  }

  // ── Gameplay frame ────────────────────────────────────────────────────────

  private updatePlaying(dt: number, input: InputState): void {
    const alive = this.lifeManager.phase === 'playing' || this.lifeManager.phase === 'spawning';

    // ── Boost meter ─────────────────────────────────────────────────────────
    const wantBoost = input.boost && alive && !this.sequenceActive &&
      this._boostMeter > (this._boosting ? 0.01 : BOOST_MIN_START);
    if (wantBoost && !this._boosting) {
      this.audioManager.playBoost();
      this.fx.kickFov(7);
      this.fx.aberrate(0.4);
    }
    this._boosting = wantBoost;
    this._boostMeter = THREE.MathUtils.clamp(
      this._boostMeter + (this._boosting ? -BOOST_DRAIN : BOOST_REGEN) * dt, 0, 1,
    );
    this.fx.setBoost(this._boosting);
    this.playerShip.setBoost(this.fx.boostAmount);

    // ── Rail speed (boss slow-down × boost × warp) ─────────────────────────
    this._speedMult = THREE.MathUtils.lerp(this._speedMult, this._speedMultTarget, 1 - Math.exp(-2.5 * dt));
    const base = this.waveManager.bossActive ? RAIL.RAIL_SPEED_BOSS : RAIL.RAIL_SPEED;
    const boostMult = 1 + (RAIL.BOOST_MULT - 1) * this.fx.boostAmount;
    this.railController.speed = base * boostMult * this._speedMult;
    this.railController.update(dt);

    // Base rail position: what the camera follows. It ignores the player's
    // screen-space movement so the ship can slide freely around the frame.
    const railCameraPos = this.railController.getRailPosition();

    // ── Starfox-style screen-space ship movement ────────────────────────────
    let targetScreenX: number;
    let targetScreenY: number;

    if (input.mouseMode) {
      targetScreenX = input.moveX;
      targetScreenY = input.moveY;
    } else {
      targetScreenX = this.playerShip.screenX + input.horizontalAxis * PLAYER.SCREEN_DRIFT_SPEED * dt;
      targetScreenY = this.playerShip.screenY + input.verticalAxis * PLAYER.SCREEN_DRIFT_SPEED * dt;
    }
    // Obstacle knockback impulse (decays). The old code pushed the ship's
    // world position, which setPosition() overwrote the very next frame.
    targetScreenX += this._knockX;
    targetScreenY += this._knockY;
    const knockDecay = Math.exp(-6 * dt);
    this._knockX *= knockDecay;
    this._knockY *= knockDecay;

    targetScreenX = THREE.MathUtils.clamp(targetScreenX, -PLAYER.SCREEN_LIMIT, PLAYER.SCREEN_LIMIT);
    targetScreenY = THREE.MathUtils.clamp(targetScreenY, -PLAYER.SCREEN_LIMIT, PLAYER.SCREEN_LIMIT);

    const follow = 1 - Math.exp(-PLAYER.SCREEN_LAG * dt);
    const newScreenX = THREE.MathUtils.lerp(this.playerShip.screenX, targetScreenX, follow);
    const newScreenY = THREE.MathUtils.lerp(this.playerShip.screenY, targetScreenY, follow);
    this.playerShip.setScreenPosition(newScreenX, newScreenY, dt);

    // Convert screen NDC to a world-space offset on the rail plane. The ship
    // rests slightly below centre (Star Fox framing) so the reticle ahead of
    // it never sits on top of the hull.
    const shipNdcX = newScreenX;
    const shipNdcY = newScreenY * 0.85 - 0.2;
    const screenOffset = this.ndcToWorldOffset(shipNdcX, shipNdcY, railCameraPos);
    this.railController.setScreenOffset(screenOffset.x, screenOffset.y);

    // True ship world position: rail base + screen offset.
    const shipWorldPos = this.railController.getWorldPosition();

    // Banking based on actual screen velocity so the ship leans into movement.
    this.playerShip.setBankInput(
      THREE.MathUtils.clamp(this.playerShip.screenVelocityX * 2, -1, 1),
      THREE.MathUtils.clamp(-this.playerShip.screenVelocityY * 2, -1, 1),
    );

    // Barrel roll (Q/E, LB/RB)
    if (alive && (input.rollLeft || input.rollRight)) {
      if (this.playerShip.barrelRoll(input.rollLeft ? -1 : 1)) {
        this.audioManager.playRoll();
        this.fx.aberrate(0.3);
        this.cameraRig.addTrauma(0.08);
        this.cameraRig.addRoll(input.rollLeft ? 0.12 : -0.12);
      }
    }

    // ── Aim ──────────────────────────────────────────────────────────────────
    // Mouse: aim through the pointer. Keys/pad: aim ahead of the ship, with
    // the reticle leading slightly in the steering direction.
    let aimScreenX: number;
    let aimScreenY: number;
    if (input.mouseMode) {
      aimScreenX = input.moveX;
      aimScreenY = input.moveY;
    } else {
      this._keyboardAimX += input.horizontalAxis * this.AIM_DRIFT_SPEED * dt;
      this._keyboardAimY += input.verticalAxis * this.AIM_DRIFT_SPEED * dt;
      if (input.horizontalAxis === 0 && input.verticalAxis === 0) {
        const settle = Math.exp(-5 * dt);
        this._keyboardAimX *= settle;
        this._keyboardAimY *= settle;
      }
      this._keyboardAimX = THREE.MathUtils.clamp(this._keyboardAimX, -0.3, 0.3);
      this._keyboardAimY = THREE.MathUtils.clamp(this._keyboardAimY, -0.25, 0.25);
      aimScreenX = THREE.MathUtils.clamp(shipNdcX + this._keyboardAimX, -0.95, 0.95);
      aimScreenY = THREE.MathUtils.clamp(shipNdcY + 0.22 + this._keyboardAimY, -0.95, 0.95);
    }

    // Fire direction through the aim point (+ soft lock-on assist).
    let fireDir = this.computeAimDirection(aimScreenX, aimScreenY, shipWorldPos);
    const target = this.findLockTarget(aimScreenX, aimScreenY);
    this._locked = target !== null;
    if (target) {
      const toTarget = target.clone().sub(shipWorldPos.position).normalize();
      fireDir = fireDir.lerp(toTarget, 0.7).normalize();
    }

    // Reticle = where the shots actually go: a point 40u down the fire line,
    // projected to the screen. Lock-on visibly magnetises it to the target.
    const reticle = this._reticle.copy(shipWorldPos.position).addScaledVector(fireDir, 40).project(this.cameraRig.stable);
    this._reticleX = THREE.MathUtils.lerp(this._reticleX, reticle.x, 1 - Math.exp(-18 * dt));
    this._reticleY = THREE.MathUtils.lerp(this._reticleY, reticle.y, 1 - Math.exp(-18 * dt));
    this.hud.updateCrosshair(this._reticleX, this._reticleY);

    // Position ship and rotate it toward the aim direction.
    this.playerShip.setPosition(shipWorldPos.position, shipWorldPos.forward, fireDir);
    this.playerShip.update(dt);

    // Camera rides the rail, not the ship. It only banks slightly with the
    // ship's offset so the frame leans toward the player's position.
    this.cameraRig.setTarget(railCameraPos, screenOffset.x, screenOffset.y);
    this.cameraRig.update(dt);

    const canFire = this.lifeManager.phase === 'playing' && this._seq !== 'warpOut';
    if (input.fire && canFire) this.weaponSystem.fireLaser(shipWorldPos.position.clone(), fireDir.clone(), shipWorldPos.forward.clone());
    if (input.bomb && canFire) this.weaponSystem.fireBomb(shipWorldPos.position.clone(), fireDir.clone());

    this.weaponSystem.update(dt, this.playerShip.position);
    this.backgroundShips.update(dt, this.playerShip.position);
    this.terrainManager.update(dt, this.playerShip.position, this.cameraRig.camera3D.position);
    this.terrainDecorations.update(dt, this.playerShip.position);
    this.waveManager.corvettePositions = this.backgroundShips.positions;
    this.waveManager.update(dt, this.playerShip.position, this.railController.stageProgress, this.railController.progress);

    const playerProjectiles = this.weaponSystem.projectilesList.filter(p => p.active && p.isPlayerProjectile);
    this.enemyManager.setFrame(railCameraPos);
    this.enemyManager.update(dt, this.playerShip.position, playerProjectiles);
    // Kamikaze contact: enemies that fly into the ship explode on it.
    for (const e of this.enemyManager.rams) {
      e.takeDamage(9999);
      if (this.lifeManager.phase === 'playing' && !this.sequenceActive) {
        if (this.playerShip.isRolling) this.playerShip.pulseShield(0x66ffff, 1);
        else this.playerShip.takeDamage(20);
        this.cameraRig.addTrauma(0.5);
      }
    }

    this.spawnPendingEnemyProjectiles();
    this.collisionSystem.checkProjectilesVsEnemies();
    this.collisionSystem.checkProjectilesVsObstacles();
    if (this.waveManager.bossActive && this.waveManager.bossInstance) {
      this.collisionSystem.checkProjectilesVsBoss(this.waveManager.bossInstance);
    }
    this.handleBossAttacks();

    // Untouchable while dying / respawning / warping.
    const invulnerable = this.lifeManager.phase !== 'playing' || this.sequenceActive;
    const { hit } = this.enemyProjectileMgr.update(dt, this.playerShip.position, this.playerShip.isRolling, invulnerable);
    if (hit) {
      this.playerShip.takeDamage(10);
      this.hitSpark.spawn(this.playerShip.position.clone(), 0xff4444, 1.2);
    }
    for (const d of this.enemyProjectileMgr.deflections) {
      this.hitSpark.spawn(d, 0x66ffff, 0.9);
      this.audioManager.playDeflect();
      this.playerShip.pulseShield(0x66ffff, 0.9);
    }

    // Power-ups
    const { healthGained, bombsGained } = this.powerUpManager.update(dt, this.playerShip.position);
    if (healthGained > 0) {
      this.playerShip.heal(healthGained);
      this.announcer.toast(`CASCO +${healthGained}`, 'green');
      this.audioManager.playPickup();
      this.fx.flash(0.12, 0x44ff99, 4);
    }
    if (bombsGained > 0) {
      this.weaponSystem.addBombs(bombsGained);
      this.announcer.toast(`BOMBA +${bombsGained}`, 'amber');
      this.audioManager.playPickup();
      this.fx.flash(0.12, 0xffaa33, 4);
    }

    // Obstacles (asteroids the player must dodge) — on hit, damage + sparks +
    // knockback push away from the asteroid.
    const railAhead = (d: number) => this.railController.frameAhead(d);
    const obs = this.obstacleManager.update(dt, this.playerShip.position, this.railController.frameAhead(0), railAhead);
    const lava = this.lavaEruptions.update(dt, this.playerShip.position, railAhead, invulnerable);
    if (lava.hit) {
      this.playerShip.takeDamage(12);
      this.hitSpark.spawn(this.playerShip.position.clone(), 0xff6622, 1.4);
      this.cameraRig.addTrauma(0.45);
      this.fx.flash(0.2, 0xff5500, 4);
    }
    if (obs.hit && !invulnerable) {
      this.playerShip.takeDamage(15);
      this.hitSpark.spawn(this.playerShip.position.clone(), 0xff8800, 1.3);
      this.cameraRig.addTrauma(0.4);
      const right = shipWorldPos.forward.clone().cross(shipWorldPos.up).normalize();
      this._knockX += obs.push.dot(right) * 0.08;
      this._knockY += obs.push.dot(shipWorldPos.up) * 0.08;
    }

    this.scoreSystem.update(dt);

    // Low hull → heartbeat vignette.
    const hp = this.playerShip.health;
    this.fx.setDanger(alive && hp <= 35 ? 1 - hp / 35 * 0.6 : 0);

    this.hud.update(dt, {
      health: hp,
      shields: this.playerShip.shields,
      boost: this._boostMeter,
      boosting: this._boosting,
      comboRatio: this.scoreSystem.comboRatio,
      locked: this._locked,
    });

    // Off-screen enemy indicators
    this.offScreenIndicator.update(this.playerShip.position);
  }

  // Closest enemy (or the boss) whose screen position sits under the
  // crosshair. Uses the stable camera so shake doesn't jitter the lock.
  private _reticle = new THREE.Vector3();
  private _reticleX = 0;
  private _reticleY = 0;
  private _lockV = new THREE.Vector3();
  private _lockBest = new THREE.Vector3();
  private findLockTarget(aimX: number, aimY: number): THREE.Vector3 | null {
    const cam = this.cameraRig.stable;
    let bestD = Infinity;
    let found = false;
    const test = (pos: THREE.Vector3, radius: number) => {
      const v = this._lockV.copy(pos).project(cam);
      if (v.z > 1 || v.z < -1) return;
      const dx = (v.x - aimX) * cam.aspect;
      const dy = v.y - aimY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < radius && d < bestD) {
        bestD = d;
        this._lockBest.copy(pos);
        found = true;
      }
    };
    for (const e of this.enemyManager.activeEnemies) if (e.active) test(e.position, 0.16);
    const boss = this.waveManager.bossInstance;
    if (this.waveManager.bossActive && boss?.active) test(boss.position, 0.35);
    return found ? this._lockBest : null;
  }

  // Convert mouse NDC (-1..1) to a world-space direction from the ship.
  // Uses camera unproject to find a point in front of the camera at the
  // crosshair location, then computes direction from ship to that point.
  private _raycaster = new THREE.Raycaster();
  private _ndc = new THREE.Vector2();
  private _aimPoint = new THREE.Vector3();
  private _keyboardAimX = 0;
  private _keyboardAimY = 0;

  // Keyboard crosshair drift speed in NDC units/sec.
  private readonly AIM_DRIFT_SPEED = 1.6;

  // Convert a screen NDC position into a world-space offset relative to the
  // current rail position. Uses the STABLE camera (no shake / FOV kicks), so
  // juice effects never shove the ship around.
  private _ndcToWorldOffset = new THREE.Vector3();
  private _offsetRight = new THREE.Vector3();
  private _offsetUp = new THREE.Vector3();
  private _worldPoint = new THREE.Vector3();
  private ndcToWorldOffset(x: number, y: number, railPos: { position: THREE.Vector3; forward: THREE.Vector3; up: THREE.Vector3 }): THREE.Vector2 {
    const cam = this.cameraRig.stable;
    this._ndcToWorldOffset.set(x, y, 0.5).unproject(cam);
    this._ndcToWorldOffset.sub(cam.position);
    const dist = railPos.position.distanceTo(cam.position);
    this._ndcToWorldOffset.multiplyScalar(dist / this._ndcToWorldOffset.length());
    const projected = this._worldPoint.copy(cam.position).add(this._ndcToWorldOffset).sub(railPos.position);
    this._offsetRight.copy(railPos.forward).cross(railPos.up).normalize();
    this._offsetUp.copy(railPos.up).normalize();
    return new THREE.Vector2(projected.dot(this._offsetRight), projected.dot(this._offsetUp));
  }

  private computeAimDirection(aimX: number, aimY: number, railPos: { position: THREE.Vector3; forward: THREE.Vector3 }): THREE.Vector3 {
    // Unproject a point at the crosshair screen position, at a distance ahead
    this._ndc.set(aimX, aimY);
    this._raycaster.setFromCamera(this._ndc, this.cameraRig.stable);

    // Project a point 60 units ahead along the ray
    this._aimPoint.copy(this._raycaster.ray.origin).addScaledVector(this._raycaster.ray.direction, 60);

    // Direction from ship position to the aim point
    const dir = this._aimPoint.clone().sub(railPos.position).normalize();

    // Blend with forward so lasers always go generally forward even if aiming sideways
    return dir.lerp(railPos.forward, 0.2).normalize();
  }

  private spawnPendingEnemyProjectiles(): void {
    const pending = this.enemyManager.pendingProjectiles;
    if (this.lifeManager.phase === 'playing' && !this.sequenceActive) {
      for (const pp of pending) {
        const speed = pp.velocity.length();
        this.enemyProjectileMgr.spawn(pp.position, pp.velocity.normalize(), speed);
      }
    }
    this.enemyManager.clearPendingProjectiles();
  }

  private handleBossAttacks(): void {
    if (!this.waveManager.bossActive || !this.waveManager.bossInstance) return;
    if (this.lifeManager.phase !== 'playing') return;
    const boss = this.waveManager.bossInstance;
    if (!boss.canAttack()) return;

    for (const { position, dir } of boss.computeVolley(this.playerShip.position)) {
      this.enemyProjectileMgr.spawn(position, dir, 26);
    }
    boss.resetAttackTimer();
  }

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.onResizeRef);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.eventBinder.dispose();
    this.inputMapper.dispose();
    this.weaponSystem.dispose();
    this.enemyManager.dispose();
    this.waveManager.dispose();
    this.explosionSystem.dispose();
    this.particleManager.dispose();
    this.hitSpark.dispose();
    this.screenEffects.dispose();
    this.backgroundShips.dispose();
    this.terrainManager.dispose();
    this.terrainDecorations.dispose();
    this.skybox.dispose();
    this.lavaEruptions.dispose();
    this.spaceScenery.dispose();
    this.powerUpManager.dispose();
    this.obstacleManager.dispose();
    this.audioManager.dispose();
    this.musicPlayer.dispose();
    this.hud.dispose();
    this.menuScreen.dispose();
    this.pauseOverlay.dispose();
    this.gameOverScreen.dispose();
    this.victoryScreen.dispose();
    this.offScreenIndicator.dispose();
    this.announcer.clear();
    this.scorePopups.dispose();
    this.postProcessing.dispose();
    this.playerShip.dispose();
    this.enemyProjectileMgr.dispose();
    this.renderer.dispose();
    EventBus.getInstance().clear();
  }
}
