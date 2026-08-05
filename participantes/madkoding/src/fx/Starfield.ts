// ─── Starfield: procedural stars with parallax layers ─────────────────────

import * as THREE from 'three';
import { FX } from '../types/config';

const STAR_COLORS = [
  [1, 1, 1], [0.7, 0.8, 1], [1, 0.95, 0.7], [1, 0.7, 0.5], [0.6, 1, 1],
];

// Two layers: distant (slow, small, cool) and near (fast, big, warm)
const LAYERS = [
  { count: 800, depth: 500, speed: 15, size: 0.8, opacity: 0.7 },
  { count: 200, depth: 200, speed: 50, size: 2.0, opacity: 0.9 },
];

export class Starfield {
  private layers: { points: THREE.Points; config: typeof LAYERS[0] }[] = [];

  constructor(scene: THREE.Scene) {
    for (const cfg of LAYERS) {
      const count = cfg.count;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);

      for (let i = 0; i < count; i++) {
        positions[i * 3] = THREE.MathUtils.randFloat(-300, 300);
        positions[i * 3 + 1] = THREE.MathUtils.randFloat(-300, 300);
        positions[i * 3 + 2] = THREE.MathUtils.randFloat(-cfg.depth, 0);
        const c = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
        const b = THREE.MathUtils.randFloat(0.4, 1);
        colors[i * 3] = c[0] * b; colors[i * 3 + 1] = c[1] * b; colors[i * 3 + 2] = c[2] * b;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: cfg.size, vertexColors: true, transparent: true, opacity: cfg.opacity,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      }));
      points.frustumCulled = false;
      scene.add(points);
      this.layers.push({ points, config: cfg });
    }
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    for (const layer of this.layers) {
      const pos = layer.points.geometry.attributes.position;
      const count = pos.count;
      const px = playerPos.x, py = playerPos.y, pz = playerPos.z;
      const step = dt * layer.config.speed;
      for (let i = 0; i < count; i++) {
        pos.setZ(i, pos.getZ(i) + step);
        const dx = pos.getX(i) - px;
        const dy = pos.getY(i) - py;
        const dz = pos.getZ(i) - pz;
        if (dz > 20 || Math.abs(dx) > 300 || Math.abs(dy) > 300) {
          pos.setX(i, px + THREE.MathUtils.randFloat(-300, 300));
          pos.setY(i, py + THREE.MathUtils.randFloat(-300, 300));
          pos.setZ(i, pz - THREE.MathUtils.randFloat(20, layer.config.depth));
        }
      }
      pos.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const layer of this.layers) {
      layer.points.geometry.dispose();
      (layer.points.material as THREE.Material).dispose();
    }
  }
}
