// ─── Enemy Projectile Manager: blue laser bolts + collision with player ──────

import * as THREE from 'three';
import { PLAYER } from '../types/config';
import { AudioManager } from '../audio/AudioManager';

const LASER_COLOR = 0x00aaff;
const LASER_RADIUS = 0.2;
const LASER_LENGTH = 5.0;
const LASER_SPEED = 200; // visible but threatening

interface EnemyProjectile {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  mesh: THREE.Mesh;
  active: boolean;
}

export class EnemyProjectileManager {
  private scene: THREE.Scene;
  private projectiles: EnemyProjectile[] = [];
  private pool: THREE.Mesh[] = [];

  constructor(private audio: AudioManager, scene: THREE.Scene, poolSize = 60) {
    this.scene = scene;
    this.createPool(poolSize);
  }

  private createPool(size: number): void {
    const geo = new THREE.CapsuleGeometry(LASER_RADIUS, LASER_LENGTH, 4, 8);
    geo.rotateX(Math.PI / 2); // align length along Z
    const mat = new THREE.MeshBasicMaterial({
      color: LASER_COLOR,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let idx = 0; idx < size; idx++) {
      const mesh = new THREE.Mesh(geo.clone(), mat.clone());
      mesh.visible = false;
      mesh.renderOrder = 999;
      this.pool.push(mesh);
      this.scene.add(mesh);
    }
  }

  spawn(position: THREE.Vector3, direction: THREE.Vector3, _speed?: number): void {
    const mesh = this.pool.find(m => !m.visible);
    if (!mesh) return;
    this.audio.playEnemyLaser();
    mesh.position.copy(position);
    mesh.visible = true;
    // Orient capsule along travel direction
    const dir = direction.clone().normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    this.projectiles.push({
      position: position.clone(),
      velocity: dir.multiplyScalar(LASER_SPEED),
      mesh, active: true,
    });
  }

  update(dt: number, playerPos: THREE.Vector3): { hit: boolean } {
    let hit = false;
    for (const p of this.projectiles) {
      if (!p.active) continue;
      // Move at constant speed
      p.position.addScaledVector(p.velocity, dt);
      p.mesh.position.copy(p.position);

      // Bounds (relative to player)
      if (p.position.z > playerPos.z + 50 || p.position.z < playerPos.z - 300 ||
          Math.abs(p.position.x - playerPos.x) > 80 ||
          Math.abs(p.position.y - playerPos.y) > 80) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      // Collision with player
      if (p.position.distanceTo(playerPos) < PLAYER.HITBOX_RADIUS) {
        p.active = false;
        p.mesh.visible = false;
        hit = true;
      }
    }
    return { hit };
  }

  clear(): void {
    for (const p of this.projectiles) { p.mesh.visible = false; p.active = false; }
    this.projectiles = [];
  }

  dispose(): void {
    for (const mesh of this.pool) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.pool = [];
    this.projectiles = [];
  }
}