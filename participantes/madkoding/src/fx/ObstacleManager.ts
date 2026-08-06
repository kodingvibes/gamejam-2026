// ─── Obstacle Manager: asteroid debris the player must dodge ────────────────
// Deformed icosahedrons that drift along the rail and recycle past the player.

import * as THREE from 'three';
import { PLAYER } from '../types/config';

interface Obstacle {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  radius: number;
  rotSpeed: THREE.Vector3;
  active: boolean;
}

export class ObstacleManager {
  private scene: THREE.Scene;
  private obstacles: Obstacle[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1.0;
  private _minRadius = 0.5;
  private _maxRadius = 1.5;

  constructor(scene: THREE.Scene, poolSize = 24) {
    this.scene = scene;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6a5a4a, roughness: 0.95, metalness: 0.1,
      emissive: 0x1a1410, emissiveIntensity: 0.2,
    });
    for (let i = 0; i < poolSize; i++) {
      const geo = this.makeAsteroidGeo();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.castShadow = false;
      this.scene.add(mesh);
      this.obstacles.push({
        mesh, position: new THREE.Vector3(),
        radius: 1, rotSpeed: new THREE.Vector3(), active: false,
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

  // Returns true if the player hit an obstacle this frame (sphere check).
  // On hit, pushes the player away from the asteroid (bounce).
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
      // Spin.
      o.mesh.rotation.x += o.rotSpeed.x * dt;
      o.mesh.rotation.y += o.rotSpeed.y * dt;
      o.mesh.rotation.z += o.rotSpeed.z * dt;

      // Sphere collision with player hitbox.
      const dist = o.position.distanceTo(playerPos);
      if (!hit && dist < o.radius + PLAYER.HITBOX_RADIUS) {
        hit = true;
        // Push direction: away from asteroid center.
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

  reset(): void {
    for (const o of this.obstacles) { o.active = false; o.mesh.visible = false; }
    this.spawnTimer = 0;
  }

  dispose(): void {
    for (const o of this.obstacles) {
      this.scene.remove(o.mesh);
      o.mesh.geometry.dispose();
    }
    (this.obstacles[0]?.mesh.material as THREE.Material | undefined)?.dispose?.();
    this.obstacles = [];
  }

  setConfig(config: { spawnInterval: number; minRadius: number; maxRadius: number }): void {
    this.spawnInterval = config.spawnInterval;
    this._minRadius = config.minRadius;
    this._maxRadius = config.maxRadius;
  }
}

