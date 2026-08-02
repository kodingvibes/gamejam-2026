// ─── Nebulae: colored cloud clusters that recycle relative to player ────────

import * as THREE from 'three';

const NEBULA_COLORS = [0x4422aa, 0xaa2266, 0x226699];

export class Nebulae {
  private clouds: THREE.Points[] = [];

  constructor(scene: THREE.Scene, count = 3) {
    for (let i = 0; i < count; i++) {
      const points = this.createCloud(NEBULA_COLORS[i]);
      points.position.set(THREE.MathUtils.randFloat(-150, 150), THREE.MathUtils.randFloat(-100, 100), -THREE.MathUtils.randFloat(50, 350));
      scene.add(points);
      this.clouds.push(points);
    }
  }

  private createCloud(color: number): THREE.Points {
    const count = 400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const base = new THREE.Color(color);
    const radius = THREE.MathUtils.randFloat(40, 80);

    for (let j = 0; j < count; j++) {
      const r = Math.abs(THREE.MathUtils.randFloat(-1, 1)) * radius;
      const a = Math.random() * Math.PI * 2;
      positions[j * 3] = Math.cos(a) * r;
      positions[j * 3 + 1] = Math.sin(a) * r;
      positions[j * 3 + 2] = THREE.MathUtils.randFloat(-1, 1) * radius * 0.5;
      const fade = 1 - r / radius;
      const c = base.clone().multiplyScalar(fade * THREE.MathUtils.randFloat(0.3, 0.7));
      colors[j * 3] = c.r; colors[j * 3 + 1] = c.g; colors[j * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const points = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 3, vertexColors: true, transparent: true, opacity: 0.18,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    points.frustumCulled = false;
    return points;
  }

  update(_dt: number, playerPos: THREE.Vector3): void {
    for (const c of this.clouds) {
      if (c.position.z > playerPos.z + 20) {
        c.position.set(
          playerPos.x + THREE.MathUtils.randFloat(-150, 150),
          playerPos.y + THREE.MathUtils.randFloat(-100, 100),
          playerPos.z - THREE.MathUtils.randFloat(200, 450),
        );
      }
    }
  }

  dispose(): void {
    for (const c of this.clouds) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
    this.clouds = [];
  }
}