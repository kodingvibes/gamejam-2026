import Phaser from "phaser";
import { Enemy } from "../entities/Enemy";
import { ChaserEnemy } from "../entities/ChaserEnemy";
import { ShooterEnemy } from "../entities/ShooterEnemy";
import { TankEnemy } from "../entities/TankEnemy";

/**
 * Coordinates enemy spawning: a continuous trickle plus periodic 30-second
 * horde waves. Spawn positions are picked outside the visible camera so
 * enemies feel like they're closing in from the edges of the map.
 *
 * Difficulty curve: each horde increments `waveNumber`, which tightens the
 * trickle spawn interval down to a 1500ms floor.
 */
export class WaveManager {
  public waveNumber: number = 0;
  public enemiesKilledThisWave: number = 0;
  public isHordeActive: boolean = false;
  public difficultyMultiplier: number = 1.0;

  public spawnTimer: Phaser.Time.TimerEvent | null = null;
  public hordeTimer: Phaser.Time.TimerEvent | null = null;
  public hordeActiveTimer: Phaser.Time.TimerEvent | null = null;

  private readonly spawnMargin: number = 100;
  private readonly hordeDurationMs: number = 10_000;
  private readonly hordeIntervalMs: number = 25_000; // first horde at 25s

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly enemies: Phaser.Physics.Arcade.Group,
  ) {}

  /**
   * Starts the trickle timer and the recurring horde timer.
   */
  public start(): void {
    this.spawnTimer = this.scene.time.addEvent({
      delay: this.getSpawnInterval(),
      callback: () => this.spawnEnemy(),
      callbackScope: this,
      loop: true,
    });

    this.hordeTimer = this.scene.time.addEvent({
      delay: this.hordeIntervalMs,
      callback: () => this.triggerHorde(),
      callbackScope: this,
      loop: true,
    });
  }

  /**
   * Tears down timers. Call from scene shutdown if you swap scenes.
   */
  public stop(): void {
    this.spawnTimer?.remove(false);
    this.spawnTimer = null;
    this.hordeTimer?.remove(false);
    this.hordeTimer = null;
    this.hordeActiveTimer?.remove(false);
    this.hordeActiveTimer = null;
  }

  /**
   * Spawns one random enemy at a random edge of the visible camera, clamped
   * to the arena. Mix: 60% Chaser / 40% Shooter.
   */
  public spawnEnemy(): void {
    const pick = Phaser.Math.Between(1, 100);
    let enemy: Enemy;
    if (pick <= 60) {
      enemy = new ChaserEnemy(this.scene, 0, 0);
    } else {
      enemy = new ShooterEnemy(this.scene, 0, 0);
    }
    this.enemies.add(enemy);

    const pos = this.pickSpawnPosition();
    enemy.setPosition(pos.x, pos.y);
  }

  /**
   * Spawns a burst of enemies (8-12 mixed + 1-2 Tanks), bumps the wave
   * counter, and marks the horde window active for 10 seconds.
   */
  public triggerHorde(): void {
    this.waveNumber += 1;
    this.enemiesKilledThisWave = 0;
    this.difficultyMultiplier = 1.0 + this.waveNumber * 0.1;
    this.isHordeActive = true;

    const mixedCount = Phaser.Math.Between(6, 10);
    for (let i = 0; i < mixedCount; i++) {
      const enemy =
        Phaser.Math.Between(1, 100) <= 60
          ? new ChaserEnemy(this.scene, 0, 0)
          : new ShooterEnemy(this.scene, 0, 0);
      this.enemies.add(enemy);
      const pos = this.pickSpawnPosition();
      enemy.setPosition(pos.x, pos.y);
    }

    const tankCount = 1;
    for (let i = 0; i < tankCount; i++) {
      const tank = new TankEnemy(this.scene, 0, 0);
      this.enemies.add(tank);
      const pos = this.pickSpawnPosition();
      tank.setPosition(pos.x, pos.y);
    }

    // Clear the horde-active flag after the window elapses.
    this.hordeActiveTimer?.remove(false);
    this.hordeActiveTimer = this.scene.time.addEvent({
      delay: this.hordeDurationMs,
      callback: () => {
        this.isHordeActive = false;
        this.hordeActiveTimer = null;
      },
      callbackScope: this,
    });
  }

  /**
   * Called when an enemy dies. Increments the counter for the active wave
   * and returns the enemy's last position so callers can drop loot there.
   */
  public onEnemyKilled(x: number, y: number): { x: number; y: number } {
    this.enemiesKilledThisWave += 1;
    return { x, y };
  }

  /**
   * Returns the current trickle delay in ms. Drops linearly with each wave
   * down to a 1500ms floor so late-game pressure keeps ramping.
   */
  public getSpawnInterval(): number {
    const minMs = 1200;
    const maxMs = 3000;
    const base = maxMs - (maxMs - minMs) * Math.min(this.waveNumber, 6) / 6;
    return Phaser.Math.Between(minMs, Math.round(base));
  }

  /**
   * Per-frame hook. Currently a no-op (timers do the work) but kept so the
   * scene can `update()` the manager uniformly.
   */
  public update(_time: number, _delta: number): void {
    // Reserved for future per-frame logic (e.g., dynamic spawn rate).
  }

  /**
   * Picks a point just outside the camera viewport on a random edge, then
   * clamps it to arena bounds so we never spawn inside a wall.
   */
  private pickSpawnPosition(): { x: number; y: number } {
    const cam = this.scene.cameras.main;
    const camW = cam.width;
    const camH = cam.height;
    const camX = cam.scrollX;
    const camY = cam.scrollY;
    const edge = Phaser.Math.Between(0, 3);
    let spawnX = 0;
    let spawnY = 0;

    switch (edge) {
      case 0: // top
        spawnX = Phaser.Math.Between(camX, camX + camW);
        spawnY = camY - this.spawnMargin;
        break;
      case 1: // bottom
        spawnX = Phaser.Math.Between(camX, camX + camW);
        spawnY = camY + camH + this.spawnMargin;
        break;
      case 2: // left
        spawnX = camX - this.spawnMargin;
        spawnY = Phaser.Math.Between(camY, camY + camH);
        break;
      case 3: // right
      default:
        spawnX = camX + camW + this.spawnMargin;
        spawnY = Phaser.Math.Between(camY, camY + camH);
        break;
    }

    const arenaWidth = this.scene.physics.world.bounds.width;
    const arenaHeight = this.scene.physics.world.bounds.height;
    spawnX = Phaser.Math.Clamp(spawnX, 0, arenaWidth);
    spawnY = Phaser.Math.Clamp(spawnY, 0, arenaHeight);
    return { x: spawnX, y: spawnY };
  }
}