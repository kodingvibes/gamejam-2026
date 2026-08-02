import Phaser from "phaser";
import { Weapon } from "../weapons/Weapon";
import { playWeaponSfx } from "../audio/WeaponSfx";

export interface MovementKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  public hp: number = 100;
  public maxHp: number = 100;
  public shield: number = 50;
  public maxShield: number = 50;
  public speed: number = 200;
  public aimAngle: number = 0;
  public weapons: Weapon[] = [];
  public activeWeaponIndex: number = 0;
  public shieldRechargeDelay: number = 2500;
  public shieldRechargeRate: number = 12;
  public lastDamageTime: number = 0;
  public invulnerableUntil: number = 0;
  public isAlive: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "player");

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);
    body.setSize(24, 24);
    body.setOffset(0, 0);
  }

  public update(
    time: number,
    delta: number,
    cursors: MovementKeys,
    pointer: Phaser.Input.Pointer,
    aimVec?: { x: number; y: number } | null,
  ): void {
    if (!this.isAlive) {
      return;
    }

    // Calculate movement from WASD keys
    let vx = 0;
    let vy = 0;
    if (cursors.left) {
      vx -= 1;
    }
    if (cursors.right) {
      vx += 1;
    }
    if (cursors.up) {
      vy -= 1;
    }
    if (cursors.down) {
      vy += 1;
    }

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      const len = Math.sqrt(vx * vx + vy * vy); // sqrt(2) for diagonal
      vx /= len;
      vy /= len;
    }

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(vx * this.speed, vy * this.speed);

    // Calculate aim angle:
    // - If aimVec is provided (mobile joystick), use it
    // - Otherwise fall back to pointer world position (desktop mouse)
    if (aimVec && (aimVec.x !== 0 || aimVec.y !== 0)) {
      this.aimAngle = Math.atan2(aimVec.y, aimVec.x);
    } else {
      this.aimAngle = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        pointer.worldX,
        pointer.worldY,
      );
    }
    this.rotation = this.aimAngle;

    // Shield regeneration
    if (time - this.lastDamageTime > this.shieldRechargeDelay) {
      if (this.shield < this.maxShield) {
        this.shield = Math.min(
          this.maxShield,
          this.shield + this.shieldRechargeRate * (delta / 1000),
        );
      }
    }
  }

  public takeDamage(amount: number, time: number): void {
    if (!this.isAlive) {
      return;
    }
    if (time < this.invulnerableUntil) {
      return;
    }

    let remaining = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, remaining);
      this.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining > 0) {
      this.hp -= remaining;
    }

    this.lastDamageTime = time;
    this.invulnerableUntil = time + 500; // 500ms i-frames

    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
      this.emit("player-died");
    }
  }

  public equip(weapons: Weapon[]): void {
    this.weapons = weapons;
    this.activeWeaponIndex = 0;
  }

  public switchWeapon(): void {
    if (this.weapons.length === 0) {
      return;
    }
    this.activeWeaponIndex = this.activeWeaponIndex === 0 ? 1 : 0;
  }

  public get activeWeapon(): Weapon | undefined {
    return this.weapons[this.activeWeaponIndex];
  }

  public tryFire(time: number): void {
    const weapon = this.activeWeapon;
    if (!weapon) {
      return;
    }
    if (!weapon.canFire(time)) {
      return;
    }
    weapon.fire(this.scene, this.x, this.y, this.aimAngle);
    weapon.lastFiredAt = time;
    playWeaponSfx(this.scene, weapon.name);
  }

  public get hpPercent(): number {
    return this.hp / this.maxHp;
  }

  public get shieldPercent(): number {
    return this.shield / this.maxShield;
  }
}