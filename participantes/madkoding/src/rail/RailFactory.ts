// ─── Rail Factory: generates waypoint paths ─────────────────────────────────

import * as THREE from 'three';

export class RailFactory {
  static create(segments = 40, length = 1200): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const z = -t * length;
      const x = Math.sin(t * Math.PI * 2) * 8;
      const y = Math.sin(t * Math.PI * 3) * 3;
      points.push(new THREE.Vector3(x, y, z));
    }
    return points;
  }
}