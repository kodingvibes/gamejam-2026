// ─── Obstacle Manager: obstacles the player must dodge ──────────────────────
// In space: deformed asteroid debris that drifts along the rail.
// In terrain levels: columns and pillars rising from the ground — some are
// fixed (indestructible, dark stone) and some are destructible (glowing,
// different color) that shatter when hit by a laser.

import * as THREE from 'three';
import { PLAYER } from '../types/config';
import type { TerrainType } from '../levels/LevelData';
import { terrainHeightAt } from '../environment/TerrainManager';

interface Obstacle {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  rotSpeed: THREE.Vector3;
  active: boolean;
  destructible: boolean;
  kind: 'asteroid' | 'column';
}

export class ObstacleManager {
  private scene: THREE.Scene;
  obstacles: Obstacle[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1.0;
  private _minRadius = 0.5;
  private _maxRadius = 1.5;
  private terrain: TerrainType = 'space';
  private asteroidMat: THREE.MeshStandardMaterial;
  private columnMat: THREE.MeshStandardMaterial;
  private columnDestructibleMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, poolSize = 24) {
    this.scene = scene;
    this.asteroidMat = new THREE.MeshStandardMaterial({
      color: 0x6a5a4a, roughness: 0.95, metalness: 0.1,
      emissive: 0x1a1410, emissiveIntensity: 0.2,
    });
    // Fixed columns: dark stone, no glow.
    this.columnMat = new THREE.MeshStandardMaterial({
      color: 0x4a4a55, roughness: 0.9, metalness: 0.2,
    });
    // Destructible columns: glowing accent color so they read as breakable.
    this.columnDestructibleMat = new THREE.MeshStandardMaterial({
      color: 0xcc8844, roughness: 0.6, metalness: 0.3,
      emissive: 0xffaa44, emissiveIntensity: 0.6,
    });
    for (let i = 0; i < poolSize; i++) {
      const geo = this.makeAsteroidGeo();
      const mesh = new THREE.Mesh(geo, this.asteroidMat);
      mesh.visible = false;
      mesh.castShadow = false;
      this.scene.add(mesh);
      this.obstacles.push({
        mesh, position: new THREE.Vector3(),
        radius: 1, rotSpeed: new THREE.Vector3(), active: false,
        destructible: false, kind: 'asteroid',
      });
    }
  }

  // Deformed dodecahedron: subdivide then displace each vertex along its
  // normal using a smooth value (sum of sines of position) so the surface
  // stays watertight and rounded — no spiky triangles.
  private makeAsteroidGeo(): THREE.BufferGeometry {
    const geo = new THREE.DodecahedronGeometry(1, 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const len = v.length() || 1;
      // Smooth noise: combination of sines gives rounded bumps, not spikes.
      const n = 1
        + Math.sin(v.x * 2.3) * 0.08
        + Math.sin(v.y * 1.7) * 0.08
        + Math.sin(v.z * 2.9) * 0.08
        + Math.sin((v.x + v.z) * 1.1) * 0.05;
      v.multiplyScalar(n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  // A column/pillar geometry: a cylinder with a slightly tapered top.
  private makeColumnGeo(): THREE.BufferGeometry {
    return new THREE.CylinderGeometry(0.8, 1.1, 1, 8);
  }

  // Returns true if the player hit an obstacle this frame (sphere check).
  // On hit, pushes the player away from the obstacle (bounce).
  update(dt: number, playerPos: THREE.Vector3): { hit: boolean; push: THREE.Vector3 } {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnInterval = 0.6 + Math.random() * 1.2;
      this.spawnOne(playerPos);
    }

    const push = new THREE.Vector3();
    let hit = false;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      // Drift toward the player (rail carries them forward).
      o.position.z += dt * 12;
      o.mesh.position.copy(o.position);
      // Spin (asteroids only; columns stay upright).
      if (o.kind === 'asteroid') {
        o.mesh.rotation.x += o.rotSpeed.x * dt;
        o.mesh.rotation.y += o.rotSpeed.y * dt;
        o.mesh.rotation.z += o.rotSpeed.z * dt;
      }

      // Sphere collision with player hitbox.
      const dist = o.position.distanceTo(playerPos);
      if (!hit && dist < o.radius + PLAYER.HITBOX_RADIUS) {
        hit = true;
        // Push direction: away from obstacle center.
        if (dist > 0.001) {
          push.copy(playerPos).sub(o.position).normalize().multiplyScalar(
            (o.radius + PLAYER.HITBOX_RADIUS - dist) + 2,
          );
        }
      }

      // Recycle when past the player.
      if (o.position.z > playerPos.z + 20) {
        o.active = false;
        o.mesh.visible = false;
      }
    }
    return { hit, push };
  }

  private spawnOne(playerPos: THREE.Vector3): void {
    const slot = this.obstacles.find(o => !o.active);
    if (!slot) return;

    if (this.terrain === 'space' || this.terrain === 'void') {
      this.spawnAsteroid(slot, playerPos);
    } else {
      this.spawnColumn(slot, playerPos);
    }
  }

  private spawnAsteroid(slot: Obstacle, playerPos: THREE.Vector3): void {
    slot.kind = 'asteroid';
    slot.destructible = false;
    slot.mesh.geometry = this.makeAsteroidGeo();
    slot.mesh.material = this.asteroidMat;
    // Random asteroid size (small: 0.8-2.0 units radius).
    const scale = this._minRadius + Math.random() * (this._maxRadius - this._minRadius);
    slot.mesh.scale.setScalar(scale);
    slot.radius = scale;
    slot.rotSpeed.set(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
    );
    slot.position.set(
      playerPos.x + THREE.MathUtils.randFloat(-12, 12),
      playerPos.y + THREE.MathUtils.randFloat(-6, 6),
      playerPos.z - THREE.MathUtils.randFloat(70, 110),
    );
    slot.mesh.position.copy(slot.position);
    slot.mesh.rotation.set(
      Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI,
    );
    slot.active = true;
    slot.mesh.visible = true;
  }

  private spawnColumn(slot: Obstacle, playerPos: THREE.Vector3): void {
    slot.kind = 'column';
    // ~30% of columns are destructible (glowing).
    slot.destructible = Math.random() < 0.3;
    slot.mesh.geometry = this.makeColumnGeo();
    slot.mesh.material = slot.destructible ? this.columnDestructibleMat : this.columnMat;
    // Column height scales with the terrain amplitude.
    const h = THREE.MathUtils.randFloat(6, 16);
    slot.mesh.scale.set(1, h, 1);
    slot.radius = 1.2;
    slot.rotSpeed.set(0, 0, 0);
    const x = playerPos.x + THREE.MathUtils.randFloat(-14, 14);
    const z = playerPos.z - THREE.MathUtils.randFloat(70, 110);
    // Base sits on the terrain surface; center the cylinder at half height.
    const groundY = terrainHeightAt(this.terrain, x, z);
    slot.position.set(x, groundY + h / 2, z);
    slot.mesh.position.copy(slot.position);
    slot.mesh.rotation.set(0, Math.random() * Math.PI, 0);
    slot.active = true;
    slot.mesh.visible = true;
  }

  /** Destroy a destructible column (called when a laser hits it). */
  destroyColumn(obstacle: Obstacle): void {
    obstacle.active = false;
    obstacle.mesh.visible = false;
  }

  reset(): void {
    for (const o of this.obstacles) { o.active = false; o.mesh.visible = false; }
    this.spawnTimer = 0;
  }

  dispose(): void {
    for (const o of this.obstacles) {
      this.scene.remove(o.mesh);
      o.mesh.geometry.dispose();
    }
    this.asteroidMat.dispose();
    this.columnMat.dispose();
    this.columnDestructibleMat.dispose();
    this.obstacles = [];
  }

  setConfig(config: { spawnInterval: number; minRadius: number; maxRadius: number }): void {
    this.spawnInterval = config.spawnInterval;
    this._minRadius = config.minRadius;
    this._maxRadius = config.maxRadius;
  }

  setTerrain(terrain: TerrainType): void {
    this.terrain = terrain;
  }
}
