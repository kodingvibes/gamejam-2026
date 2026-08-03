// ─── Enemy Trail: Homeworld-style wide glowing ribbon ────────────────────────
// Lives in WORLD space (added to scene, not the enemy group) so positions
// are absolute. Renders a wide, bright ribbon (with a softer glow halo) that
// fades out toward the tail, like the ship trajectories in Homeworld.

import * as THREE from 'three';

const MAX_TRAIL_POINTS = 20;
const TRAIL_INTERVAL = 0.06;

export class EnemyTrail {
  private ribbon: THREE.Mesh;
  private glow: THREE.Mesh;
  // Ring buffer of the actual trajectory points (one per sample).
  private ringPositions: Float32Array;
  // Ribbon vertex buffers (two vertices per point: left + right of the path).
  private positions: Float32Array;
  private glowPositions: Float32Array;
  private colors: Float32Array;
  private glowColors: Float32Array;
  private indices: Uint16Array;
  private readonly _scratchPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
  private head = 0;
  private count = 0;
  private timer = 0;
  private color: THREE.Color;
  private active = false;
  private scene: THREE.Scene;
  private width: number;
  private fadeTimer = 0;
  private fadeDuration = 0.25;
  private fading = false;

  constructor(scene: THREE.Scene, color: number, width: number) {
    this.scene = scene;
    this.color = new THREE.Color(color);
    this.width = width;

    const vertexCount = MAX_TRAIL_POINTS * 2;
    this.ringPositions = new Float32Array(MAX_TRAIL_POINTS * 3);
    this.positions = new Float32Array(vertexCount * 3);
    this.glowPositions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 3);
    this.glowColors = new Float32Array(vertexCount * 3);
    this.indices = new Uint16Array((MAX_TRAIL_POINTS - 1) * 6);

    // Static index buffer: two triangles per segment (a quad ribbon).
    // Segment i uses vertices [2i, 2i+1, 2i+2, 2i+3].
    for (let i = 0; i < MAX_TRAIL_POINTS - 1; i++) {
      const base = i * 6;
      const a = i * 2;
      this.indices[base] = a;
      this.indices[base + 1] = a + 1;
      this.indices[base + 2] = a + 2;
      this.indices[base + 3] = a + 1;
      this.indices[base + 4] = a + 3;
      this.indices[base + 5] = a + 2;
    }

    // Main bright ribbon.
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(this.indices, 1));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.ribbon = new THREE.Mesh(geo, mat);
    this.ribbon.frustumCulled = false;
    this.ribbon.visible = false;
    this.scene.add(this.ribbon);

    // Softer, wider glow halo underneath.
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(this.glowPositions, 3));
    glowGeo.setAttribute('color', new THREE.BufferAttribute(this.glowColors, 3));
    glowGeo.setIndex(new THREE.BufferAttribute(this.indices, 1));
    const glowMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.glow = new THREE.Mesh(glowGeo, glowMat);
    this.glow.frustumCulled = false;
    this.glow.visible = false;
    this.scene.add(this.glow);
  }

  start(startPos: THREE.Vector3): void {
    this.active = true;
    this.ribbon.visible = true;
    this.glow.visible = true;
    this.timer = 0;
    this.head = 0;
    this.count = 1;
    this.ringPositions[0] = startPos.x;
    this.ringPositions[1] = startPos.y;
    this.ringPositions[2] = startPos.z;
    this._scratchPositions[0] = startPos.x;
    this._scratchPositions[1] = startPos.y;
    this._scratchPositions[2] = startPos.z;
    this.buildRibbon(1);
    this.ribbon.geometry.setDrawRange(0, 0);
    this.glow.geometry.setDrawRange(0, 0);
  }

  stop(): void {
    this.active = false;
    this.ribbon.visible = false;
    this.glow.visible = false;
    this.head = 0;
    this.count = 0;
  }

  // Update the trail color (used when the enemy is recycled to a new type).
  setColor(color: number): void {
    this.color.setHex(color);
  }

  // Fade the trail out quickly (called when the enemy is destroyed).
  fadeOut(): void {
    if (!this.active && !this.fading) return;
    this.active = false;
    this.fading = true;
    this.fadeTimer = 0;
  }

  update(dt: number, currentPos: THREE.Vector3): void {
    if (this.fading) {
      this.fadeTimer += dt;
      const t = Math.min(1, this.fadeTimer / this.fadeDuration);
      const alpha = 1 - t;
      // Scale the whole ribbon down toward the tail as it fades.
      const scale = 1 - t;
      for (let i = 0; i < this.count; i++) {
        const v = i * 2;
        const fade = (1 - i / MAX_TRAIL_POINTS) * alpha;
        const fade2 = fade * fade;
        this.colors[v * 3] = this.color.r * fade2 * 0.3;
        this.colors[v * 3 + 1] = this.color.g * fade2 * 0.3;
        this.colors[v * 3 + 2] = this.color.b * fade2 * 0.3;
        this.colors[v * 3 + 3] = this.color.r * fade2 * 0.3;
        this.colors[v * 3 + 4] = this.color.g * fade2 * 0.3;
        this.colors[v * 3 + 5] = this.color.b * fade2 * 0.3;
        const glowFade = fade2 * 0.15 * scale;
        this.glowColors[v * 3] = this.color.r * glowFade;
        this.glowColors[v * 3 + 1] = this.color.g * glowFade;
        this.glowColors[v * 3 + 2] = this.color.b * glowFade;
        this.glowColors[v * 3 + 3] = this.color.r * glowFade;
        this.glowColors[v * 3 + 4] = this.color.g * glowFade;
        this.glowColors[v * 3 + 5] = this.color.b * glowFade;
      }
      this.ribbon.geometry.attributes.color.needsUpdate = true;
      this.glow.geometry.attributes.color.needsUpdate = true;
      if (t >= 1) {
        this.fading = false;
        this.ribbon.visible = false;
        this.glow.visible = false;
        this.head = 0;
        this.count = 0;
      }
      return;
    }
    if (!this.active) return;
    this.timer += dt;
    if (this.timer < TRAIL_INTERVAL) return;
    this.timer = 0;

    // Push the current position into the ring buffer.
    this.head = (this.head + 1) % MAX_TRAIL_POINTS;
    this.ringPositions[this.head * 3] = currentPos.x;
    this.ringPositions[this.head * 3 + 1] = currentPos.y;
    this.ringPositions[this.head * 3 + 2] = currentPos.z;
    if (this.count < MAX_TRAIL_POINTS) this.count++;

    // Copy ring → scratch in draw order (index 0 = newest).
    for (let idx = 0; idx < this.count; idx++) {
      const ring = (this.head - idx + MAX_TRAIL_POINTS) % MAX_TRAIL_POINTS;
      this._scratchPositions[idx * 3] = this.ringPositions[ring * 3];
      this._scratchPositions[idx * 3 + 1] = this.ringPositions[ring * 3 + 1];
      this._scratchPositions[idx * 3 + 2] = this.ringPositions[ring * 3 + 2];
    }

    this.buildRibbon(this.count);

    const indexCount = (this.count - 1) * 6;
    this.ribbon.geometry.setDrawRange(0, indexCount);
    this.glow.geometry.setDrawRange(0, indexCount);
    this.ribbon.geometry.attributes.position.needsUpdate = true;
    this.ribbon.geometry.attributes.color.needsUpdate = true;
    this.glow.geometry.attributes.position.needsUpdate = true;
    this.glow.geometry.attributes.color.needsUpdate = true;
  }

  // Build the ribbon (and glow) vertex buffers from the scratch points.
  private buildRibbon(count: number): void {
    if (count < 2) return;
    const halfW = this.width / 2;
    const glowHalfW = this.width * 2.2;

    for (let i = 0; i < count; i++) {
      // Tangent via central difference (fall back to a single neighbour).
      let tx: number;
      let ty: number;
      if (i === 0) {
        tx = this._scratchPositions[3] - this._scratchPositions[0];
        ty = this._scratchPositions[4] - this._scratchPositions[1];
      } else if (i === count - 1) {
        tx = this._scratchPositions[(i - 1) * 3] - this._scratchPositions[i * 3];
        ty = this._scratchPositions[(i - 1) * 3 + 1] - this._scratchPositions[i * 3 + 1];
      } else {
        tx = this._scratchPositions[(i + 1) * 3] - this._scratchPositions[(i - 1) * 3];
        ty = this._scratchPositions[(i + 1) * 3 + 1] - this._scratchPositions[(i - 1) * 3 + 1];
      }
      const len = Math.hypot(tx, ty);
      let px = 0;
      let py = 0;
      if (len > 1e-6) {
        px = -ty / len;
        py = tx / len;
      }

      const x = this._scratchPositions[i * 3];
      const y = this._scratchPositions[i * 3 + 1];
      const z = this._scratchPositions[i * 3 + 2];
      const v = i * 2;

      // Ribbon vertices (left + right).
      this.positions[v * 3] = x + px * halfW;
      this.positions[v * 3 + 1] = y + py * halfW;
      this.positions[v * 3 + 2] = z;
      this.positions[v * 3 + 3] = x - px * halfW;
      this.positions[v * 3 + 4] = y - py * halfW;
      this.positions[v * 3 + 5] = z;

      // Glow vertices (wider).
      this.glowPositions[v * 3] = x + px * glowHalfW;
      this.glowPositions[v * 3 + 1] = y + py * glowHalfW;
      this.glowPositions[v * 3 + 2] = z;
      this.glowPositions[v * 3 + 3] = x - px * glowHalfW;
      this.glowPositions[v * 3 + 4] = y - py * glowHalfW;
      this.glowPositions[v * 3 + 5] = z;

      // Quadratic fade: newest bright, oldest transparent. Overall dimmed
      // so the trail reads as a faint blurred streak, not a solid ribbon.
      const fade = 1 - i / MAX_TRAIL_POINTS;
      const fade2 = fade * fade;
      const r = this.color.r * fade2 * 0.3;
      const g = this.color.g * fade2 * 0.3;
      const b = this.color.b * fade2 * 0.3;
      this.colors[v * 3] = r;
      this.colors[v * 3 + 1] = g;
      this.colors[v * 3 + 2] = b;
      this.colors[v * 3 + 3] = r;
      this.colors[v * 3 + 4] = g;
      this.colors[v * 3 + 5] = b;

      // Glow is wider and dimmer — the blurred halo around the streak.
      const glowFade = fade2 * 0.15;
      const gr = this.color.r * glowFade;
      const gg = this.color.g * glowFade;
      const gb = this.color.b * glowFade;
      this.glowColors[v * 3] = gr;
      this.glowColors[v * 3 + 1] = gg;
      this.glowColors[v * 3 + 2] = gb;
      this.glowColors[v * 3 + 3] = gr;
      this.glowColors[v * 3 + 4] = gg;
      this.glowColors[v * 3 + 5] = gb;
    }
  }

  dispose(): void {
    this.scene.remove(this.ribbon);
    this.scene.remove(this.glow);
    this.ribbon.geometry.dispose();
    (this.ribbon.material as THREE.Material).dispose();
    this.glow.geometry.dispose();
    (this.glow.material as THREE.Material).dispose();
  }
}
