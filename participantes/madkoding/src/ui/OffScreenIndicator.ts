// ─── Off-Screen Enemy Indicators ────────────────────────────────────────────
// Arrows at the screen edge pointing toward enemies outside the viewport.

import * as THREE from 'three';
import { EnemyManager } from '../enemies/EnemyManager';
import { CameraRig } from '../camera/CameraRig';

const INDICATOR_COUNT = 8;
const INDICATOR_SIZE = 24; // px

export class OffScreenIndicator {
  private container: HTMLElement;
  private indicators: HTMLElement[] = [];
  private camera: THREE.PerspectiveCamera;
  private enemyManager: EnemyManager;

  constructor(camera: THREE.PerspectiveCamera, enemyManager: EnemyManager) {
    this.camera = camera;
    this.enemyManager = enemyManager;

    this.container = document.createElement('div');
    this.container.id = 'off-screen-indicators';
    this.container.style.cssText = `
      position: absolute; inset: 0; pointer-events: none; z-index: 15;
    `;
    document.getElementById('game-container')?.appendChild(this.container);

    for (let i = 0; i < INDICATOR_COUNT; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: absolute; width: ${INDICATOR_SIZE}px; height: ${INDICATOR_SIZE}px;
        background: rgba(255, 200, 50, 0.85);
        clip-path: polygon(50% 0, 100% 100%, 0 100%);
        opacity: 0; transition: opacity 0.15s;
        transform: translate(-50%, -50%);
      `;
      this.container.appendChild(el);
      this.indicators.push(el);
    }
  }

  update(playerPos: THREE.Vector3): void {
    const enemies = this.enemyManager.activeEnemies;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const margin = 50; // px from edge

    // Project each enemy to screen space, show arrow if outside viewport
    let idx = 0;
    for (const enemy of enemies) {
      if (!enemy.active || idx >= INDICATOR_COUNT) break;

      const vec = enemy.position.clone();
      vec.project(this.camera);

      // NDC: -1..1
      const nx = vec.x;
      const ny = vec.y;

      // Check if outside viewport (with small tolerance)
      const tol = 0.05;
      if (nx > -1 - tol && nx < 1 + tol && ny > -1 - tol && ny < 1 + tol) {
        continue; // on screen, skip
      }

      // Clamp to screen edge
      const clampedX = THREE.MathUtils.clamp(nx, -1, 1);
      const clampedY = THREE.MathUtils.clamp(ny, -1, 1);

      // Convert to pixel coords
      let px = (clampedX * 0.5 + 0.5) * w;
      let py = (-clampedY * 0.5 + 0.5) * h;

      // Push inside margin
      px = THREE.MathUtils.clamp(px, margin, w - margin);
      py = THREE.MathUtils.clamp(py, margin, h - margin);

      // Arrow rotation: point toward the enemy's direction
      const angle = Math.atan2(ny - clampedY, nx - clampedX);

      const el = this.indicators[idx];
      el.style.left = `${px}px`;
      el.style.top = `${py}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      el.style.opacity = '1';

      idx++;
    }

    // Hide remaining indicators
    for (let i = idx; i < INDICATOR_COUNT; i++) {
      this.indicators[i].style.opacity = '0';
    }
  }

  dispose(): void {
    this.container.remove();
  }
}
