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
  private history: THREE.Vector3[] = [];
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
    this.history = [];
    this.active = true;
    this.line.visible = true;
    this.timer = 0;
    // Pre-fill with the start position so the trail begins immediately
    for (let idx = 0; idx < 3; idx++) this.history.push(startPos.clone());
  }

  stop(): void {
    this.active = false;
    this.line.visible = false;
    this.history = [];
  }

  update(dt: number, currentPos: THREE.Vector3): void {
    if (!this.active) return;
    this.timer += dt;
    if (this.timer < TRAIL_INTERVAL) return;
    this.timer = 0;

    this.history.unshift(currentPos.clone());
    if (this.history.length > MAX_TRAIL_POINTS) this.history.pop();

    const count = this.history.length;
    for (let idx = 0; idx < MAX_TRAIL_POINTS; idx++) {
      if (idx < count) {
        const p = this.history[idx];
        this.positions[idx * 3] = p.x;
        this.positions[idx * 3 + 1] = p.y;
        this.positions[idx * 3 + 2] = p.z;
        // Fade: newest = bright, oldest = transparent
        const fade = 1 - (idx / MAX_TRAIL_POINTS);
        const fade2 = fade * fade; // quadratic fade for nicer tail
        this.colors[idx * 3] = this.color.r * fade2;
        this.colors[idx * 3 + 1] = this.color.g * fade2;
        this.colors[idx * 3 + 2] = this.color.b * fade2;
      } else if (count > 0) {
        const p = this.history[count - 1];
        this.positions[idx * 3] = p.x;
        this.positions[idx * 3 + 1] = p.y;
        this.positions[idx * 3 + 2] = p.z;
        this.colors[idx * 3] = 0; this.colors[idx * 3 + 1] = 0; this.colors[idx * 3 + 2] = 0;
      }
    }

    this.line.geometry.attributes.position.needsUpdate = true;
    this.line.geometry.attributes.color.needsUpdate = true;
    this.line.geometry.setDrawRange(0, count);
  }

  dispose(): void {
    this.scene.remove(this.line);
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}