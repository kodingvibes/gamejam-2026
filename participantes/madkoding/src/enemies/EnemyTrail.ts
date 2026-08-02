// ─── Enemy Trail: fading trajectory trail behind each enemy ─────────────────
// Lives in WORLD space (added to scene, not the enemy group) so positions
// are absolute. Renders a bright fading line showing the enemy's path.

import * as THREE from 'three';

const MAX_TRAIL_POINTS = 40;
const TRAIL_INTERVAL = 0.06;

export class EnemyTrail {
  private line: THREE.Line;
  private positions: Float32Array;
  private colors: Float32Array;
  private readonly _scratchPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
  private readonly _scratchColors = new Float32Array(MAX_TRAIL_POINTS * 3);
  private head = 0;
  private count = 0;
  private timer = 0;
  private color: THREE.Color;
  private active = false;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene, color: number) {
    this.scene = scene;
    this.color = new THREE.Color(color);
    this.positions = new Float32Array(MAX_TRAIL_POINTS * 3);
    this.colors = new Float32Array(MAX_TRAIL_POINTS * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      linewidth: 2,
    });

    this.line = new THREE.Line(geo, mat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.scene.add(this.line);
  }

  start(startPos: THREE.Vector3): void {
    this.active = true;
    this.line.visible = true;
    this.timer = 0;
    // Pre-fill the ring with the start position so the trail begins immediately
    for (let idx = 0; idx < 3; idx++) {
      this.head = idx;
      this.count = idx + 1;
      this.positions[idx * 3] = startPos.x;
      this.positions[idx * 3 + 1] = startPos.y;
      this.positions[idx * 3 + 2] = startPos.z;
    }
  }

  stop(): void {
    this.active = false;
    this.line.visible = false;
    this.head = 0;
    this.count = 0;
  }

  update(dt: number, currentPos: THREE.Vector3): void {
    if (!this.active) return;
    this.timer += dt;
    if (this.timer < TRAIL_INTERVAL) return;
    this.timer = 0;

    // Push the current position into the ring (in place, no clone)
    this.head = (this.head + 1) % MAX_TRAIL_POINTS;
    this.positions[this.head * 3] = currentPos.x;
    this.positions[this.head * 3 + 1] = currentPos.y;
    this.positions[this.head * 3 + 2] = currentPos.z;
    if (this.count < MAX_TRAIL_POINTS) this.count++;

    const scratchPos = this._scratchPositions;
    const scratchCol = this._scratchColors;
    const oldestSlot = (this.head - this.count + 1 + MAX_TRAIL_POINTS) % MAX_TRAIL_POINTS;

    // Pass 1: copy ring → scratch in draw order (index 0 = newest)
    for (let idx = 0; idx < MAX_TRAIL_POINTS; idx++) {
      if (idx < this.count) {
        const ring = (this.head - idx + MAX_TRAIL_POINTS) % MAX_TRAIL_POINTS;
        scratchPos[idx * 3] = this.positions[ring * 3];
        scratchPos[idx * 3 + 1] = this.positions[ring * 3 + 1];
        scratchPos[idx * 3 + 2] = this.positions[ring * 3 + 2];
        // Fade: newest = bright, oldest = transparent
        const fade = 1 - (idx / MAX_TRAIL_POINTS);
        const fade2 = fade * fade; // quadratic fade for nicer tail
        scratchCol[idx * 3] = this.color.r * fade2;
        scratchCol[idx * 3 + 1] = this.color.g * fade2;
        scratchCol[idx * 3 + 2] = this.color.b * fade2;
      } else {
        scratchPos[idx * 3] = this.positions[oldestSlot * 3];
        scratchPos[idx * 3 + 1] = this.positions[oldestSlot * 3 + 1];
        scratchPos[idx * 3 + 2] = this.positions[oldestSlot * 3 + 2];
        scratchCol[idx * 3] = 0;
        scratchCol[idx * 3 + 1] = 0;
        scratchCol[idx * 3 + 2] = 0;
      }
    }

    // Pass 2: scratch → positions/colors (avoid read/write aliasing)
    this.positions.set(scratchPos);
    this.colors.set(scratchCol);

    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.geometry.attributes.color.needsUpdate = true;
    this.line.geometry.setDrawRange(0, this.count);
  }

  dispose(): void {
    this.scene.remove(this.line);
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}