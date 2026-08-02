import Phaser from "phaser";
import { Enemy } from "./Enemy";

/**
 * Ranged enemy. Maintains a preferred distance from the player and
 * periodically fires a yellow projectile at them.
 */
export class ShooterEnemy extends Enemy {
  public preferredDistance: number = 200;
  public fireInterval: number = 2500;
  public lastFiredAt: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "enemy-shooter", 12, 60, 8, 0xffff00);
  }

  public update(
    time: number,
    _delta: number,
    playerX: number,
    playerY: number,
  ): void {
    if (!this.isAlive) {
      return;
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Keep at preferredDistance: back off if too close, push in if too far.
    if (distance < this.preferredDistance - 20) {
      this.scene.physics.moveTo(this, this.x - dx, this.y - dy, this.speed);
    } else if (distance > this.preferredDistance + 20) {
      this.scene.physics.moveTo(this, playerX, playerY, this.speed);
    } else {
      body.setVelocity(0, 0);
    }

    // Always face the player.
    this.rotation = Math.atan2(dy, dx);

    // Fire on cadence.
    if (time - this.lastFiredAt >= this.fireInterval) {
      this.fire(playerX, playerY);
      this.lastFiredAt = time;
    }
  }

  private fire(playerX: number, playerY: number): void {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY);
    const vx = Math.cos(angle) * 200;
    const vy = Math.sin(angle) * 200;

    const projectile = this.scene.add.circle(this.x, this.y, 5, 0xffff00);

    // Add to the enemy projectiles group FIRST so the group owns the body.
    // Setting velocity after group.add() ensures the group doesn't reset it.
    const group = this.scene.data.get("enemyProjectiles") as Phaser.Physics.Arcade.Group | undefined;
    if (group && !group.isFull()) {
      group.add(projectile);
    } else {
      // Pool exhausted (or missing): skip the shot. group.add() silently
      // bails when full and never creates a body, so firing here would
      // crash on a null body. Dropping the shot is safe game behavior.
      projectile.destroy();
      return;
    }

    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(vx, vy);
    body.setCollideWorldBounds(true);
    body.onWorldBounds = true;

    projectile.once("worldbounds", () => {
      projectile.destroy();
    });
  }
}
