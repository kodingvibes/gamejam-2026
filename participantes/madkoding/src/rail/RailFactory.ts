// ─── Rail Factory: generates waypoint paths ─────────────────────────────────

import * as THREE from 'three';
import type { LevelRailConfig } from '../levels/LevelData';
import { RAIL } from '../types/config';
import { setRailShape, railX, railY } from '../environment/RailShape';

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

  /** Stage path + boss arena tail (RAIL.ARENA_EXTENSION × the stage length). */
  static createFromConfig(config: LevelRailConfig): THREE.Vector3[] {
    setRailShape(config);
    const segments = Math.round(60 * RAIL.ARENA_EXTENSION);
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * RAIL.ARENA_EXTENSION;
      points.push(new THREE.Vector3(railX(t, config), railY(t, config), -t * config.length));
    }
    return points;
  }
}
