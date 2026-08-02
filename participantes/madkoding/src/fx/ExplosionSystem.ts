// ─── Explosion System ────────────────────────────────────────────────────────
// Particle-based explosions. Epic = more particles, bigger spread, brighter.

import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool';

const PARTICLE_COUNT = 80;
const COLOR_MID = new THREE.Color(0xffcc44);
const COLOR_TIP = new THREE.Color(0x330011);
const _scratchBase = new THREE.Color();
const _scratchC = new THREE.Color();

interface Explosion {
  points: THREE.Points;
  velocities: Float32Array;
  timer: number;
  duration: number;
  active: boolean;
  color: THREE.Color;
}

export class ExplosionSystem {
  private scene: THREE.Scene;
  private explosions: Explosion[] = [];
  private pool: ObjectPool<THREE.Points>;

  constructor(scene: THREE.Scene, poolSize = 30) {
    this.scene = scene;
    this.pool = new ObjectPool<THREE.Points>(
      () => {
        const count = 80;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        const mat = new THREE.PointsMaterial({
          size: 0.6, vertexColors: true, transparent: true, opacity: 1,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const points = new THREE.Points(geo, mat);
        points.visible = false; points.frustumCulled = false;
        return points;
      },
      (points) => { points.visible = false; },
      poolSize
    );
  }

  spawn(position: THREE.Vector3, size: number = 3, color: number = 0xff8844): void {
    this.spawnParticles(position, size, color, 1.0);
  }

  // Epic explosion: same 80 particles but bigger spread + brighter
  spawnEpic(position: THREE.Vector3, color: number = 0xff6600): void {
    this.spawnParticles(position, 8, color, 1.5);
  }

  private spawnParticles(pos: THREE.Vector3, size: number, color: number, duration: number): void {
    const points = this.pool.acquire();
    const geo = points.geometry;

    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const colorAttr = geo.attributes.color as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;
    const baseColor = _scratchBase.setHex(color);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const t = Math.random();
      const c = _scratchC;
      if (t < 0.3) {
        c.setRGB(1, 1, 0.8);
      } else if (t < 0.7) {
        c.lerpColors(COLOR_MID, baseColor, (t - 0.3) / 0.4);
      } else {
        c.lerpColors(baseColor, COLOR_TIP, (t - 0.7) / 0.3);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;

      const pSpeed = THREE.MathUtils.randFloat(10, size * 8);
      velocities[i * 3]     = Math.sin(phi) * Math.cos(theta) * pSpeed;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * pSpeed;
      velocities[i * 3 + 2] = Math.cos(phi) * pSpeed;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    points.position.set(0, 0, 0);
    points.visible = true;
    this.scene.add(points);

    this.explosions.push({ points, velocities, timer: 0, duration, active: true, color: baseColor });
  }

  update(dt: number): void {
    // Particles only (no shockwaves/flashes to avoid GC pressure)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      if (!exp.active) continue;
      exp.timer += dt;
      const progress = exp.timer / exp.duration;

      if (progress >= 1) {
        exp.active = false; exp.points.visible = false;
        this.pool.release(exp.points);
        this.explosions.splice(i, 1);
        continue;
      }

      const posAttr = exp.points.geometry.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const count = posAttr.count;
      const velocities = exp.velocities;

      for (let j = 0; j < count; j++) {
        positions[j * 3]     += velocities[j * 3] * dt;
        positions[j * 3 + 1] += velocities[j * 3 + 1] * dt;
        positions[j * 3 + 2] += velocities[j * 3 + 2] * dt;
        velocities[j * 3] *= 0.96;
        velocities[j * 3 + 1] *= 0.96;
        velocities[j * 3 + 2] *= 0.96;
        velocities[j * 3] += (Math.random() - 0.5) * dt * 4;
        velocities[j * 3 + 1] += (Math.random() - 0.5) * dt * 4;
      }
      posAttr.needsUpdate = true;

      const mat = exp.points.material as THREE.PointsMaterial;
      mat.opacity = (1 - progress) * (1 - progress); // quadratic fade
      mat.size = 0.6 * (1 - progress * 0.3);
    }

  }

  reset(): void {
    for (const exp of this.explosions) {
      exp.points.visible = false; this.pool.release(exp.points);
    }
    this.explosions = [];
  }

  dispose(): void {
    this.reset();
    this.pool.dispose();
  }
}