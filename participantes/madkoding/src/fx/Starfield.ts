// ─── Starfield: procedural stars that recycle relative to player ────────────

import * as THREE from 'three';
import { FX } from '../types/config';

const STAR_COLORS = [
  [1, 1, 1], [0.7, 0.8, 1], [1, 0.95, 0.7], [1, 0.7, 0.5], [0.6, 1, 1],
];

export class Starfield {
  private points: THREE.Points;

  constructor(scene: THREE.Scene) {
    const count = FX.STARFIELD_COUNT;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = THREE.MathUtils.randFloat(-300, 300);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(-300, 300);
      positions[i * 3 + 2] = THREE.MathUtils.randFloat(-FX.STARFIELD_DEPTH, 0);
      const c = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
      const b = THREE.MathUtils.randFloat(0.4, 1);
      colors[i * 3] = c[0] * b; colors[i * 3 + 1] = c[1] * b; colors[i * 3 + 2] = c[2] * b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 1.2, vertexColors: true, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    const pos = this.points.geometry.attributes.position;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length / 3; i++) {
      arr[i * 3 + 2] += dt * 30;
      const dx = arr[i * 3] - playerPos.x, dy = arr[i * 3 + 1] - playerPos.y;
      const dz = arr[i * 3 + 2] - playerPos.z;
      if (dz > 20 || Math.abs(dx) > 300 || Math.abs(dy) > 300) {
        arr[i * 3] = playerPos.x + THREE.MathUtils.randFloat(-300, 300);
        arr[i * 3 + 1] = playerPos.y + THREE.MathUtils.randFloat(-300, 300);
        arr[i * 3 + 2] = playerPos.z - THREE.MathUtils.randFloat(20, FX.STARFIELD_DEPTH);
      }
    }
    pos.needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}