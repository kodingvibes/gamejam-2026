import Phaser from "phaser";
import { Player, MovementKeys } from "../entities/Player";
import { Enemy } from "../entities/Enemy";
import { Weapon } from "../weapons/Weapon";
import { PlasmaGun } from "../weapons/PlasmaGun";
import { PulseRifle } from "../weapons/PulseRifle";
import { Flamethrower } from "../weapons/Flamethrower";
import { GrenadeLauncher } from "../weapons/GrenadeLauncher";
import { ElectricBeam } from "../weapons/ElectricBeam";
import { MapGenerator } from "../systems/MapGenerator";
import { WaveManager } from "../systems/WaveManager";
import { LevelUpManager } from "../systems/LevelUpManager";
import { MetaProgress, applyMetaBonuses } from "../store/MetaProgress";
import { HUD } from "../ui/HUD";
import { AudioManager } from "../audio/AudioManager";
import { SettingsPanel } from "../ui/SettingsPanel";
import { EventBus, SPECTACLE_ENTRANCE, SPECTACLE_ACTION, SPECTACLE_HIT } from "../core/EventBus";
import { GAME } from "../core/Constants";
import { VirtualJoystick } from "../systems/VirtualJoystick";
import { FireButton } from "../systems/FireButton";
import { MobileBootstrap } from "../systems/MobileBootstrap";
import { RotateOverlay } from "../systems/RotateOverlay";

/** Battle-track pool. Keys are mirrored in the preload() loader below. */
const BATTLE_TRACK_KEYS = [
  "battle-1",
  "battle-2",
  "battle-3",
  "battle-4",
] as const;

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies!: Phaser.Physics.Arcade.Group;
  private projectiles!: Phaser.Physics.Arcade.Group;
  private enemyProjectiles!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: MovementKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private waveManager!: WaveManager;
  private levelUpManager!: LevelUpManager;
  private hud!: HUD;
  private pauseOverlay: Phaser.GameObjects.Container | null = null;
  private isPaused: boolean = false;
  private runCoins: number = 0;
  /** Per-scene audio wrapper. Owns the active battle-music BaseSound. */
  private audio!: AudioManager;
  /** Settings overlay. Created lazily on first pause. */
  private settingsPanel: SettingsPanel | null = null;
  /** Virtual joystick for mobile movement (left side). */
  private moveJoystick: VirtualJoystick | null = null;
  /** Virtual joystick for mobile aim (right side). */
  private aimJoystick: VirtualJoystick | null = null;
  /** Fire button for mobile. */
  private fireButton: FireButton | null = null;
  /** Mobile bootstrap (fullscreen latch, orientation lock). */
  private mobileBootstrap: MobileBootstrap | null = null;
  /** Rotate overlay for portrait orientation. */
  private rotateOverlay: RotateOverlay | null = null;
  /**
   * Weapon IDs chosen by the player in MenuScene. Defaults to Plasma + Pulse
   * if MenuScene didn't pass any (e.g. restart from GameOverScene with no
   * selection).
   */
  private selectedWeaponIds: string[] = ["PlasmaGun", "PulseRifle"];

  /**
   * Pulsing cyan glow behind the player. Created once in `create()` and
   * repositioned each frame so it follows the sprite without allocating.
   */
  private playerGlow: Phaser.GameObjects.Arc | null = null;

  /** Track keyboard handlers for cleanup in shutdown(). */
  private keydownQHandler!: (event: KeyboardEvent) => void;
  private keydownEscHandler!: (event: KeyboardEvent) => void;

  /** Resize handler reference for cleanup. */
  private resizeHandler: ((gameSize: Phaser.Structs.Size) => void) | null = null;

  /**
   * Current arena dimensions (world bounds). Grown dynamically to fill the
   * viewport on wide screens so the play area never leaves empty margins.
   * Rebuilt on every resize.
   */
  private arenaWidth: number = GAME.WIDTH;
  private arenaHeight: number = GAME.HEIGHT;

  /** Colliders tied to the current obstacles group, recreated on rebuild. */
  private obstacleColliders: Phaser.Physics.Arcade.Collider[] = [];

  /** Screen-space background grid, redrawn when the viewport resizes. */
  private bgGrid: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super("GameScene");
  }

  /**
   * Preload battle tracks. Each entry maps to `assets/music/neon_drift_battle_N.mp3`.
   * All four are queued up-front so the random pick below never blocks on
   * a fresh load.
   */
  preload(): void {
    for (let i = 0; i < BATTLE_TRACK_KEYS.length; i++) {
      const key = BATTLE_TRACK_KEYS[i];
      this.load.audio(key, `assets/music/neon_drift_battle_${i + 1}.mp3`);
    }
  }

  /**
   * Receives the weapon selection from MenuScene. Phaser calls this BEFORE
   * `create()`, so the values are available when entities are built.
   */
  init(data: { weaponIds?: string[] }): void {
    if (data && Array.isArray(data.weaponIds) && data.weaponIds.length > 0) {
      this.selectedWeaponIds = data.weaponIds;
    }
  }

  /**
   * Maps a weapon ID string (matching the class name) to a fresh Weapon
   * instance. Unknown IDs fall back to PlasmaGun so we never end up with
   * an empty loadout.
   */
  private createWeaponFromId(id: string): Weapon {
    switch (id) {
      case "PlasmaGun":
        return new PlasmaGun();
      case "GrenadeLauncher":
        return new GrenadeLauncher();
      case "PulseRifle":
        return new PulseRifle();
      case "ElectricBeam":
        return new ElectricBeam();
      case "Flamethrower":
        return new Flamethrower();
      default:
        return new PlasmaGun();
    }
  }

  create(): void {
    const { width, height } = this.scale;

    // World bounds: grow beyond the 1280x960 baseline so the play area
    // fills the viewport (no empty side margins on wide screens).
    this.arenaWidth = Math.max(GAME.WIDTH, Math.ceil(width));
    this.arenaHeight = Math.max(GAME.HEIGHT, Math.ceil(height));
    this.physics.world.setBounds(0, 0, this.arenaWidth, this.arenaHeight);
    this.cameras.main.setBounds(0, 0, this.arenaWidth, this.arenaHeight);

    // Generate textures before creating any sprite that needs them
    this.generatePlayerTexture();
    this.generateEnemyTextures();
    this.generateProjectileTextures();

    // Map (border walls + pillars) — must exist before we spawn anything
    // that needs to collide with it.
    this.obstacles = MapGenerator.generate(this, this.arenaWidth, this.arenaHeight);

    // Subtle background grid (drawn first so everything else sits on top).
    this.drawBackgroundGrid();

    // Player
    this.player = new Player(this, width / 2, height / 2);

    // Pulsing cyan glow behind the player. Sits at a depth below the player
    // so the sprite stays crisp on top.
    this.playerGlow = this.add.circle(
      this.player.x,
      this.player.y,
      16,
      0x00ffff,
      0.15,
    );
    this.playerGlow.setDepth(this.player.depth - 1);
    this.tweens.add({
      targets: this.playerGlow,
      alpha: 0.25,
      scale: 1.15,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Camera follows the player so the arena feels bigger than the viewport.
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Battle music — randomly pick one track per run. AudioManager's
    // `crossFadeTo` fades out whatever was playing (e.g. menu music) and
    // fades the new track in over 1000 ms.
    this.audio = new AudioManager(this);
    const pick = BATTLE_TRACK_KEYS[
      Math.floor(Math.random() * BATTLE_TRACK_KEYS.length)
    ];
    this.audio.crossFadeTo(pick, { loop: true, fadeInMs: 1000 });

    // Enemy group
    this.enemies = this.physics.add.group({ maxSize: 80 });
    this.data.set("enemyGroup", this.enemies);

    // Projectile group (used by every weapon that emits a physics bullet)
    this.projectiles = this.physics.add.group({ maxSize: 60 });
    this.data.set("projectileGroup", this.projectiles);

    // Enemy projectile group (ShooterEnemy projectiles)
    this.enemyProjectiles = this.physics.add.group({ maxSize: 30 });
    this.data.set("enemyProjectiles", this.enemyProjectiles);

    // Player-enemy contact damage (real damage now, not just a log)
    this.physics.add.overlap(this.player, this.enemies, (_player, enemy) => {
      const p = _player as Player;
      const e = enemy as Enemy;
      if (p.isAlive && e.isAlive) {
        if (p.tempShieldActive === true) {
          // Temp shield absorbs one hit then breaks.
          p.tempShieldActive = false;
          return;
        }
        p.takeDamage(e.damage, this.time.now);
      }
    });

    // Enemy projectile-on-player collision
    this.physics.add.overlap(this.player, this.enemyProjectiles, (_player, proj) => {
      const p = _player as Player;
      if (!p.isAlive) return;
      p.takeDamage(8, this.time.now);
      const body = (proj as Phaser.GameObjects.Arc).body as Phaser.Physics.Arcade.Body;
      if (body) body.enable = false;
      (proj as Phaser.GameObjects.Arc).destroy();
    });

    // Projectile-on-enemy collision
    this.physics.add.overlap(
      this.projectiles,
      this.enemies,
      this.onProjectileHitEnemy,
      undefined,
      this,
    );

    // Static world collision: player & enemies bounce off walls and pillars
    this.obstacleColliders.push(
      this.physics.add.collider(this.player, this.obstacles),
      this.physics.add.collider(this.enemies, this.obstacles),
    );

    // Listen for enemy deaths so we can drive wave/level progress and drop
    // loot. We attach a listener to the scene so it fires regardless of
    // which enemy subtype emits the event.
    this.events.on("enemy-killed", this.onEnemyKilled, this);

    // Persist this run's coins when the player dies, then hand off to the
    // game-over scene with a snapshot of the run summary.
    this.player.on("player-died", this.onPlayerDied, this);

    // Systems
    this.waveManager = new WaveManager(this, this.enemies);
    this.waveManager.start();

    this.levelUpManager = new LevelUpManager(this, this.player);

    // Equip the player with the weapons selected in MenuScene (Q to switch).
    // The factory falls back to PlasmaGun on unknown IDs so an empty/garbled
    // payload still produces a playable loadout.
    const weapons = this.selectedWeaponIds.map((id) =>
      this.createWeaponFromId(id),
    );
    this.player.equip(weapons);

    // Apply persistent meta-progression bonuses (damage/speed/shield/regen/cadence)
    applyMetaBonuses(this.player, MetaProgress.load());

    // Input
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keydownQHandler = (): void => {
      this.player.switchWeapon();
    };
    this.input.keyboard!.on("keydown-Q", this.keydownQHandler);

    this.keydownEscHandler = (): void => {
      this.togglePause();
    };
    this.input.keyboard!.on("keydown-ESC", this.keydownEscHandler);

    // Mobile controls
    this.moveJoystick = new VirtualJoystick(this, 120, height - 120, 50, { side: "left" });
    this.aimJoystick = new VirtualJoystick(this, width - 120, height - 120, 50, { side: "right" });
    this.fireButton = new FireButton(this, width - 60, height - 200, 40);
    this.mobileBootstrap = new MobileBootstrap(this);
    this.rotateOverlay = new RotateOverlay(this);

    // HUD (replaces the old debug text labels).
    this.hud = new HUD(this);
    this.hud.coins = this.runCoins;

    // Spectacle: entrance — player and enemies are now in the arena
    EventBus.emit(SPECTACLE_ENTRANCE, { x: this.player.x, y: this.player.y });

    // Subscribe to resize events
    this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
      this.handleResize(gameSize.width, gameSize.height);
    };
    this.scale.on("resize", this.resizeHandler);
  }

  /**
   * Reposition mobile controls when the canvas resizes.
   */
  private handleResize(w: number, h: number): void {
    this.moveJoystick?.setPosition(120, h - 120);
    this.aimJoystick?.setPosition(w - 120, h - 120);
    this.fireButton?.setPosition(w - 60, h - 200);

    // Rebuild the arena when the viewport grows beyond the current world so
    // the play area keeps filling the whole window (no empty margins).
    const nextW = Math.max(GAME.WIDTH, Math.ceil(w));
    const nextH = Math.max(GAME.HEIGHT, Math.ceil(h));
    if (nextW === this.arenaWidth && nextH === this.arenaHeight) {
      return;
    }
    this.arenaWidth = nextW;
    this.arenaHeight = nextH;
    this.physics.world.setBounds(0, 0, this.arenaWidth, this.arenaHeight);
    this.cameras.main.setBounds(0, 0, this.arenaWidth, this.arenaHeight);

    // Rebuild walls + pillars and rewire the colliders.
    for (const c of this.obstacleColliders) {
      c.destroy();
    }
    this.obstacleColliders = [];
    this.obstacles?.destroy(true);
    this.obstacles = MapGenerator.generate(this, this.arenaWidth, this.arenaHeight);
    this.obstacleColliders.push(
      this.physics.add.collider(this.player, this.obstacles),
      this.physics.add.collider(this.enemies, this.obstacles),
    );

    // Redraw the fixed background grid to span the new viewport.
    this.drawBackgroundGrid();
  }

  shutdown(): void {
    this.input.keyboard?.off("keydown-Q", this.keydownQHandler);
    this.input.keyboard?.off("keydown-ESC", this.keydownEscHandler);
    this.events.off("enemy-killed", this.onEnemyKilled, this);
    this.player.off("player-died", this.onPlayerDied, this);
    this.waveManager?.stop();
    this.audio?.destroy();
    this.settingsPanel?.destroy();
    this.settingsPanel = null;
    this.hud?.destroy();
    this.moveJoystick?.destroy();
    this.aimJoystick?.destroy();
    this.fireButton?.destroy();
    this.mobileBootstrap?.destroy();
    this.rotateOverlay?.destroy();
    if (this.resizeHandler) {
      this.scale.off("resize", this.resizeHandler);
      this.resizeHandler = null;
    }
    // Clean up persistent electric beam graphics
    const beamGfx = this.data.get("electricBeamGraphics") as Phaser.GameObjects.Graphics | undefined;
    if (beamGfx) {
      beamGfx.destroy();
      this.data.set("electricBeamGraphics", undefined);
    }
    // Clean up any active fire zone timers
    const fireTimers: Phaser.Time.TimerEvent[] = this.data.get("fireZoneTimers") ?? [];
    for (const t of fireTimers) {
      t.remove(false);
    }
    this.data.set("fireZoneTimers", []);
  }

  /**
   * Draws a faint fixed grid in screen space. Thin lines every 40px at
   * very low alpha — just enough to give the floor a tech feel without
   * competing with foreground elements. `setScrollFactor(0)` keeps it
   * pinned to the camera while the world scrolls underneath.
   */
  private drawBackgroundGrid(): void {
    // Tear down the previous grid (if any) before drawing a fresh one so a
    // resize doesn't leave stale lines behind.
    if (this.bgGrid) {
      this.bgGrid.destroy();
      this.bgGrid = null;
    }

    const grid = this.add.graphics();
    this.bgGrid = grid;
    grid.setScrollFactor(0);
    grid.setDepth(-10);
    grid.lineStyle(1, 0x00ffff, 0.03);

    const { width, height } = this.scale;
    const step = 40;
    for (let x = 0; x <= width; x += step) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += step) {
      grid.lineBetween(0, y, width, y);
    }
  }

  /**
   * Adds a quick fading cyan circle behind a newly spawned projectile so
   * the trail reads as motion without spawning a real particle system.
   * Cheap: one circle + one tween per shot, auto-destroyed on completion.
   */
  public static spawnProjectileTrail(
    scene: Phaser.Scene,
    proj: Phaser.Physics.Arcade.Image,
  ): void {
    const trail = scene.add.circle(proj.x, proj.y, 4, 0x00ffff, 0.5);
    scene.tweens.add({
      targets: trail,
      alpha: 0,
      scale: 2,
      duration: 180,
      onComplete: () => {
        if (trail.active) {
          trail.destroy();
        }
      },
    });
  }

  private generatePlayerTexture(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x00ffff, 1);
    g.fillCircle(12, 12, 10);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(22, 12, 12, 4, 12, 20); // arrow tip
    g.generateTexture("player", 24, 24);
    g.destroy();
  }

  private generateEnemyTextures(): void {
    // Chaser — 20x20 red circle with a small triangle tip pointing right
    const chaser = this.make.graphics({ x: 0, y: 0 }, false);
    chaser.fillStyle(0xff0000, 1);
    chaser.fillCircle(10, 10, 8);
    chaser.fillStyle(0xffffff, 1);
    chaser.fillTriangle(20, 10, 10, 4, 10, 16);
    chaser.generateTexture("enemy-chaser", 20, 20);
    chaser.destroy();

    // Shooter — 20x20 yellow circle
    const shooter = this.make.graphics({ x: 0, y: 0 }, false);
    shooter.fillStyle(0xffff00, 1);
    shooter.fillCircle(10, 10, 8);
    shooter.generateTexture("enemy-shooter", 20, 20);
    shooter.destroy();

    // Tank — 32x32 magenta circle
    const tank = this.make.graphics({ x: 0, y: 0 }, false);
    tank.fillStyle(0xff00ff, 1);
    tank.fillCircle(16, 16, 14);
    tank.generateTexture("enemy-tank", 32, 32);
    tank.destroy();
  }

  private generateProjectileTextures(): void {
    // Plasma — 6px cyan circle on a 12x12 canvas (origin centered)
    const plasma = this.make.graphics({ x: 0, y: 0 }, false);
    plasma.fillStyle(0x00ffff, 1);
    plasma.fillCircle(6, 6, 5);
    plasma.generateTexture("projectile-plasma", 12, 12);
    plasma.destroy();

    // Grenade — 8px magenta circle on a 16x16 canvas
    const grenade = this.make.graphics({ x: 0, y: 0 }, false);
    grenade.fillStyle(0xff00ff, 1);
    grenade.fillCircle(8, 8, 7);
    grenade.generateTexture("projectile-grenade", 16, 16);
    grenade.destroy();

    // Pulse — 4px cyan circle on a 8x8 canvas
    const pulse = this.make.graphics({ x: 0, y: 0 }, false);
    pulse.fillStyle(0x00ffff, 1);
    pulse.fillCircle(4, 4, 3);
    pulse.generateTexture("projectile-pulse", 8, 8);
    pulse.destroy();

    // Fire — 8px orange circle on a 16x16 canvas
    const fire = this.make.graphics({ x: 0, y: 0 }, false);
    fire.fillStyle(0xff5500, 1);
    fire.fillCircle(8, 8, 7);
    fire.generateTexture("projectile-fire", 16, 16);
    fire.destroy();
  }

  private onProjectileHitEnemy(
    _projectile: unknown,
    enemy: unknown,
  ): void {
    const e = enemy as Enemy;
    if (!e.isAlive) {
      return;
    }
    const proj = _projectile as Phaser.Physics.Arcade.Image;

    // Grenades explode on direct contact (overrides the fuse timer).
    const kind = proj.getData("kind") as string | undefined;
    if (kind === "grenade") {
      GrenadeLauncher.explode(this, proj);
      return;
    }

    const damage = (proj.getData("damage") as number | undefined) ?? 0;
    e.takeDamage(damage);
    EventBus.emit(SPECTACLE_HIT, { x: proj.x, y: proj.y, enemy: e });

    const piercing = this.data.get("piercing-shots-active") === true;
    const bouncing = this.player.bouncingShots === true;

    if (proj.active) {
      if (bouncing) {
        // Bounce: bump the projectile's expiry by re-arming origin so range
        // culling doesn't immediately kill it, and flip a "bounced" flag so
        // it dies at the second hit.
        if (proj.getData("bounced") === true) {
          proj.disableBody(true, false);
          proj.setActive(false);
          proj.setVisible(false);
          proj.destroy();
        } else {
          proj.setData("bounced", true);
          proj.setData("originX", proj.x);
          proj.setData("originY", proj.y);
        }
      } else if (!piercing) {
        proj.disableBody(true, false);
        proj.setActive(false);
        proj.setVisible(false);
        proj.destroy();
      }
      // Piercing: leave the projectile alone so it can hit the next enemy.
    }
  }

  /**
   * Listens to the scene-level `enemy-killed` event so every enemy subtype
   * counts. Drives wave progress, level-up progress, loot drops, and the
   * optional explosion-on-kill chain reaction.
   */
  private onEnemyKilled(payload: {
    x: number;
    y: number;
    enemy: Enemy;
  }): void {
    const { x, y, enemy } = payload;

    this.waveManager.onEnemyKilled(x, y);
    this.levelUpManager.onEnemyKilled();

    this.dropLoot(x, y, enemy);
    this.maybeExplode(x, y);
  }

  private dropLoot(x: number, y: number, enemy: Enemy): void {
    const loot = enemy.dropLoot();

    // Track coins earned this run; they're committed to MetaProgress when the
    // player dies (see onPlayerDied).
    if (loot.coins > 0) {
      this.runCoins += loot.coins;

      // Brief floating visual so the player can see they picked something up.
      const coin = this.add.circle(x, y, 4, 0xffd700);
      this.tweens.add({
        targets: coin,
        y: y - 20,
        alpha: 0,
        duration: 600,
        onComplete: () => {
          if (coin.active) {
            coin.destroy();
          }
        },
      });
    }

    if (Math.random() < loot.healChance && this.player.hp < this.player.maxHp) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 10);
    }
  }

  private onPlayerDied(): void {
    // Persist coins earned this run before leaving the scene.
    if (this.runCoins > 0) {
      MetaProgress.addCoins(this.runCoins);
    }

    // Let the battle music keep playing in the background on the game-over
    // screen — detach instead of destroying it. MenuScene's cross-fade will
    // fade it out when the player returns to the menu.
    this.audio?.detach();

    this.scene.start("GameOverScene", {
      runCoins: this.runCoins,
      waveReached: this.waveManager.waveNumber,
      levelReached: this.levelUpManager.level,
    });
  }

  private maybeExplode(x: number, y: number): void {
    if (this.data.get("explosion-on-kill-active") !== true) {
      return;
    }
    const RADIUS = 40;
    const DAMAGE = 10;
    const fx = this.add.circle(x, y, RADIUS, 0xff5522, 0.6);
    fx.setStrokeStyle(2, 0xffaa00, 1);
    this.tweens.add({
      targets: fx,
      radius: RADIUS * 1.2,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        if (fx.active) {
          fx.destroy();
        }
      },
    });

    const children = this.enemies.getChildren() as Enemy[];
    for (const enemy of children) {
      if (!enemy.isAlive) {
        continue;
      }
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      if (dx * dx + dy * dy <= RADIUS * RADIUS) {
        enemy.takeDamage(DAMAGE);
      }
    }
  }

  private togglePause(): void {
    if (this.isPaused) {
      this.isPaused = false;
      this.time.paused = false;
      this.anims.paused = false;
      this.physics.world.isPaused = false;
      if (this.pauseOverlay) {
        this.pauseOverlay.destroy(true);
        this.pauseOverlay = null;
      }
      if (this.settingsPanel) {
        this.settingsPanel.hide();
      }
    } else {
      this.isPaused = true;
      this.time.paused = true;
      this.anims.paused = true;
      this.physics.world.isPaused = true;

      // Build a container so the PAUSED text and the SettingsPanel share
      // one depth and one scroll factor. Container sits above the HUD.
      const overlay = this.add.container(0, 0);
      overlay.setDepth(2000);
      overlay.setScrollFactor(0);

      const { width, height } = this.scale;

      // Semi-transparent backdrop to dim the scene while paused.
      const backdrop = this.add.rectangle(
        width / 2,
        height / 2,
        width,
        height,
        0x000000,
        0.55,
      );
      backdrop.setScrollFactor(0);
      overlay.add(backdrop);

      const pauseText = this.add
        .text(width / 2, height / 2 - 130, "PAUSED\nPress ESC to resume", {
          fontFamily: "monospace",
          fontSize: "32px",
          color: "#00ffff",
          align: "center",
        })
        .setOrigin(0.5)
        .setScrollFactor(0);
      overlay.add(pauseText);

      this.pauseOverlay = overlay;

      // Mount the settings panel — it lives inside the pause overlay's
      // visual hierarchy so it shares the depth/scale. ESC closes both.
      if (!this.settingsPanel) {
        this.settingsPanel = new SettingsPanel(this, this.audio);
      }
      this.settingsPanel.show();
    }
  }

  update(time: number, delta: number): void {
    this.cursors = {
      up: this.keyW.isDown,
      down: this.keyS.isDown,
      left: this.keyA.isDown,
      right: this.keyD.isDown,
    };

    // Merge virtual joystick input for mobile movement
    if (this.moveJoystick && this.moveJoystick.isActive()) {
      const dir = this.moveJoystick.getDirection();
      this.cursors.left = dir.x < -0.2;
      this.cursors.right = dir.x > 0.2;
      this.cursors.up = dir.y < -0.2;
      this.cursors.down = dir.y > 0.2;
    }

    // Get aim vector from right joystick (mobile) or null (desktop mouse)
    let aimVec: { x: number; y: number } | null = null;
    if (this.aimJoystick && this.aimJoystick.isActive()) {
      aimVec = this.aimJoystick.getDirection();
    }

    this.player.update(time, delta, this.cursors, this.input.activePointer, aimVec);

    // Keep the player glow anchored to the player (the tween handles alpha
    // and scale, we only need to follow position).
    if (this.playerGlow && this.player.isAlive) {
      this.playerGlow.setPosition(this.player.x, this.player.y);
    }

    // Drive every enemy in the group toward the player and follow their glow
    const children = this.enemies.getChildren() as Enemy[];
    for (const enemy of children) {
      enemy.update(time, delta, this.player.x, this.player.y);
      const glow = enemy.glow as Phaser.GameObjects.Arc | null;
      if (glow) {
        if (enemy.isAlive) {
          glow.setPosition(enemy.x, enemy.y);
        } else if (glow.active) {
          glow.destroy();
          enemy.glow = null;
        }
      }
    }

    // Clear the ElectricBeam graphics from the previous frame so the beam
    // doesn't leave a permanent line when not firing.
    const beamGfx = this.data.get("electricBeamGraphics") as Phaser.GameObjects.Graphics | undefined;
    if (beamGfx) {
      beamGfx.clear();
    }

    // Fire: use fireButton on mobile, fall back to pointer click on desktop
    if (this.fireButton && this.fireButton.consumePressed()) {
      this.player.tryFire(time);
    } else if (this.input.activePointer.isDown) {
      this.player.tryFire(time);
    }

    // Cull projectiles that have flown past their weapon's range.
    this.cullOutOfRangeProjectiles();

    this.waveManager.update(time, delta);
    this.levelUpManager.update(time);

    // Emit spectacle:action on every frame the player is firing
    if (this.input.activePointer.isDown) {
      EventBus.emit(SPECTACLE_ACTION, { x: this.player.x, y: this.player.y });
    }

    // HUD last — it reads the latest state from the systems.
    this.hud.coins = this.runCoins;
    this.hud.update(this.player, this.waveManager, this.levelUpManager, time);
  }

  private cullOutOfRangeProjectiles(): void {
    const children = this.projectiles.getChildren() as Phaser.Physics.Arcade.Image[];
    for (const proj of children) {
      if (!proj.active) {
        continue;
      }
      const originX = proj.getData("originX") as number | undefined;
      const originY = proj.getData("originY") as number | undefined;
      const range = proj.getData("range") as number | undefined;
      if (originX === undefined || originY === undefined || range === undefined) {
        continue;
      }
      const dx = proj.x - originX;
      const dy = proj.y - originY;
      if (dx * dx + dy * dy > range * range) {
        const kind = proj.getData("kind") as string | undefined;
        if (kind === "fire") {
          // Land the fire zone at the projectile's current position
          Flamethrower.spawnFireZone(this, proj.x, proj.y);
        }
        proj.disableBody(true, false);
        proj.setActive(false);
        proj.setVisible(false);
        proj.destroy();
      }
    }
  }
}
