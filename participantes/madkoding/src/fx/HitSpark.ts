// ─── Hit Spark ──────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { FX } from '../types/config';

interface Spark {
  points: THREE.Points;
  timer: number;
  active: boolean;
}

export class HitSpark {
  private scene: THREE.Scene;
  private sparks: Spark[] = [];
  private particleCount = 8;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawn(position: THREE.Vector3, color: number = 0xffff44): void {
    const count = this.particleCount;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const baseColor = new THREE.Color(color);

    for (let idx = 0; idx < count; idx++) {
      positions[idx * 3] = position.x + THREE.MathUtils.randFloat(-0.1, 0.1);
      positions[idx * 3 + 1] = position.y + THREE.MathUtils.randFloat(-0.1, 0.1);
      positions[idx * 3 + 2] = position.z + THREE.MathUtils.randFloat(-0.1, 0.1);

      const c = baseColor.clone();
      c.multiplyScalar(THREE.MathUtils.randFloat(0.7, 1));
      colors[idx * 3] = c.r;
      colors[idx * 3 + 1] = c.g;
      colors[idx * 3 + 2] = c.b;

      sizes[idx] = THREE.MathUtils.randFloat(0.1, 0.3);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);

    this.sparks.push({
      points,
      timer: 0,
      active: true,
    });
  }

  update(dt: number): void {
    for (let idx = this.sparks.length - 1; idx >= 0; idx--) {
      const spark = this.sparks[idx];
      if (!spark.active) continue;

      spark.timer += dt;

      if (spark.timer >= FX.HIT_SPARK_DURATION) {
        spark.active = false;
        this.scene.remove(spark.points);
        spark.points.geometry.dispose();
        (spark.points.material as THREE.Material).dispose();
        this.sparks.splice(idx, 1);
        continue;
      }

      const progress = spark.timer / FX.HIT_SPARK_DURATION;
      (spark.points.material as THREE.PointsMaterial).opacity = 1 - progress;
    }
  }

  reset(): void {
    for (const spark of this.sparks) {
      this.scene.remove(spark.points);
      spark.points.geometry.dispose();
      (spark.points.material as THREE.Material).dispose();
    }
    this.sparks = [];
  }

  dispose(): void {
    this.reset();
  }
}
