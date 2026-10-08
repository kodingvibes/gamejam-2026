// ─── Hit Spark ──────────────────────────────────────────────────────────────
// Pooled impact bursts: stretched streak sparks flying outward with drag and
// gravity-free falloff, plus a short additive flash sprite at the impact.
// All geometry is preallocated — spawning never allocates GPU buffers.

import * as THREE from 'three';
import { getSoftParticleTexture } from './softTexture';

const SPARKS = 14;
const POOL = 32;
const LIFE = 0.32;

interface Burst {
  lines: THREE.LineSegments;
  flash: THREE.Sprite;
  pos: Float32Array;   // current spark heads
  vel: Float32Array;
  timer: number;
  scale: number;
  active: boolean;
}

export class HitSpark {
  private scene: THREE.Scene;
  private bursts: Burst[] = [];
  private cursor = 0;
  private static readonly _c = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    for (let i = 0; i < POOL; i++) this.bursts.push(this.createBurst());
  }

  private createBurst(): Burst {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 2 * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(SPARKS * 2 * 3), 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    lines.frustumCulled = false;
    lines.visible = false;
    lines.renderOrder = 1000;
    this.scene.add(lines);

    const flash = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSoftParticleTexture(), color: 0xffffff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    flash.visible = false;
    flash.renderOrder = 1001;
    this.scene.add(flash);

    return {
      lines, flash,
      pos: new Float32Array(SPARKS * 3),
      vel: new Float32Array(SPARKS * 3),
      timer: 0, scale: 1, active: false,
    };
  }

  spawn(position: THREE.Vector3, color: number = 0xffff44, scale = 1): void {
    const b = this.bursts[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;

    b.active = true;
    b.timer = 0;
    b.scale = scale;
    const c = HitSpark._c.setHex(color);
    const colors = (b.lines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array;

    for (let i = 0; i < SPARKS; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = THREE.MathUtils.randFloat(14, 38) * scale;
      b.pos[i * 3] = position.x;
      b.pos[i * 3 + 1] = position.y;
      b.pos[i * 3 + 2] = position.z;
      b.vel[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
      b.vel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
      b.vel[i * 3 + 2] = Math.cos(phi) * speed;
      // Head is hot white, tail takes the hit color.
      const o = i * 6;
      colors[o] = 1; colors[o + 1] = 1; colors[o + 2] = 0.9;
      colors[o + 3] = c.r; colors[o + 4] = c.g; colors[o + 5] = c.b;
    }
    (b.lines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    this.writeLines(b);
    b.lines.visible = true;

    b.flash.position.copy(position);
    (b.flash.material as THREE.SpriteMaterial).color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.5);
    (b.flash.material as THREE.SpriteMaterial).opacity = 1;
    b.flash.scale.setScalar(2.5 * scale);
    b.flash.visible = true;
  }

  private writeLines(b: Burst): void {
    const arr = (b.lines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const stretch = 0.035;
    for (let i = 0; i < SPARKS; i++) {
      const p = i * 3, o = i * 6;
      arr[o] = b.pos[p]; arr[o + 1] = b.pos[p + 1]; arr[o + 2] = b.pos[p + 2];
      arr[o + 3] = b.pos[p] - b.vel[p] * stretch;
      arr[o + 4] = b.pos[p + 1] - b.vel[p + 1] * stretch;
      arr[o + 5] = b.pos[p + 2] - b.vel[p + 2] * stretch;
    }
    (b.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  update(dt: number): void {
    const drag = Math.exp(-6 * dt);
    for (const b of this.bursts) {
      if (!b.active) continue;
      b.timer += dt;
      const t = b.timer / LIFE;
      if (t >= 1) {
        b.active = false;
        b.lines.visible = false;
        b.flash.visible = false;
        continue;
      }
      for (let i = 0; i < SPARKS * 3; i++) {
        b.vel[i] *= drag;
        b.pos[i] += b.vel[i] * dt;
      }
      this.writeLines(b);
      (b.lines.material as THREE.LineBasicMaterial).opacity = 1 - t * t;
      const ft = Math.min(1, b.timer / 0.12);
      (b.flash.material as THREE.SpriteMaterial).opacity = 1 - ft;
      b.flash.scale.setScalar((2.5 + ft * 3) * b.scale);
      if (ft >= 1) b.flash.visible = false;
    }
  }

  reset(): void {
    for (const b of this.bursts) {
      b.active = false;
      b.lines.visible = false;
      b.flash.visible = false;
    }
  }

  dispose(): void {
    for (const b of this.bursts) {
      this.scene.remove(b.lines, b.flash);
      b.lines.geometry.dispose();
      (b.lines.material as THREE.Material).dispose();
      (b.flash.material as THREE.Material).dispose();
    }
    this.bursts = [];
  }
}
