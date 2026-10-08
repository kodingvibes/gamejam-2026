// ─── Water Wake: spray + ripple rings when skimming a liquid ────────────────
// The lower the ship flies over water, the more it kicks up: a curtain of
// spray behind it and expanding ripple rings on the surface. Over lava the
// same system throws embers and molten rings instead.

import * as THREE from 'three';
import { getSoftParticleTexture } from '../fx/softTexture';

const SPRAY = 500;
const RINGS = 28;
const RANGE = 11;   // altitude above the surface where the wake starts

export class WaterWake {
  private points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private cursor = 0;
  private rings: { mesh: THREE.Mesh; t: number; alive: boolean }[] = [];
  private ringCursor = 0;
  private ringTimer = 0;
  private emitAcc = 0;
  private sprayMat: THREE.PointsMaterial;
  private ringMat: THREE.MeshBasicMaterial;

  constructor(private scene: THREE.Scene) {
    this.pos = new Float32Array(SPRAY * 3).fill(-9999);
    this.vel = new Float32Array(SPRAY * 3);
    this.life = new Float32Array(SPRAY);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.sprayMat = new THREE.PointsMaterial({
      map: getSoftParticleTexture(), color: 0xe8f6ff, size: 0.9, transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.sprayMat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    const ringGeo = new THREE.RingGeometry(0.85, 1, 40);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0xdff4ff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < RINGS; i++) {
      const mesh = new THREE.Mesh(ringGeo, this.ringMat.clone());
      mesh.visible = false;
      scene.add(mesh);
      this.rings.push({ mesh, t: 0, alive: false });
    }
  }

  /**
   * @param level liquid surface height under the ship (null = no liquid)
   * @param lava  true for embers instead of spray
   */
  update(dt: number, ship: THREE.Vector3, level: number | null, lava: boolean, speedK = 1): void {
    const color = lava ? 0xff7a2a : 0xe8f6ff;
    this.sprayMat.color.setHex(color);
    const alt = level === null ? Infinity : ship.y - level;
    const k = alt < RANGE ? 1 - Math.max(0, alt) / RANGE : 0;

    if (k > 0 && level !== null) {
      // Spray: denser and taller the closer to the surface.
      this.emitAcc += dt * (40 + 260 * k * k) * speedK;
      while (this.emitAcc >= 1) {
        this.emitAcc -= 1;
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % SPRAY;
        const o = i * 3;
        const side = Math.random() < 0.5 ? -1 : 1;
        this.pos[o] = ship.x + side * Math.random() * 2.5;
        this.pos[o + 1] = level + 0.2;
        this.pos[o + 2] = ship.z + 1.5 + Math.random() * 2;
        this.vel[o] = side * (3 + Math.random() * 6) * k;
        this.vel[o + 1] = (5 + Math.random() * 9) * k * (lava ? 0.7 : 1);
        this.vel[o + 2] = 4 + Math.random() * 6;
        this.life[i] = 0.6 + Math.random() * 0.6;
      }
      // Ripples trail behind the ship.
      this.ringTimer -= dt;
      if (this.ringTimer <= 0) {
        this.ringTimer = 0.09 + (1 - k) * 0.12;
        const r = this.rings[this.ringCursor];
        this.ringCursor = (this.ringCursor + 1) % RINGS;
        r.alive = true;
        r.t = 0;
        r.mesh.position.set(ship.x, level + 0.15, ship.z + 1);
        (r.mesh.material as THREE.MeshBasicMaterial).color.setHex(lava ? 0xff6a1a : 0xdff4ff);
        r.mesh.userData.k = k;
        r.mesh.visible = true;
      }
    }

    for (let i = 0; i < SPRAY; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      this.vel[o + 1] -= 22 * dt;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      if (this.life[i] <= 0 || (level !== null && this.pos[o + 1] < level - 0.5)) {
        this.life[i] = 0;
        this.pos[o + 1] = -9999;
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    for (const r of this.rings) {
      if (!r.alive) continue;
      r.t += dt;
      const t = r.t / 1.3;
      if (t >= 1) { r.alive = false; r.mesh.visible = false; continue; }
      r.mesh.scale.setScalar(1.5 + t * 9 * (0.6 + (r.mesh.userData.k ?? 1) * 0.6));
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.45 * (r.mesh.userData.k ?? 1);
    }
  }

  reset(): void {
    this.life.fill(0);
    for (let i = 0; i < SPRAY; i++) this.pos[i * 3 + 1] = -9999;
    for (const r of this.rings) { r.alive = false; r.mesh.visible = false; }
  }

  dispose(): void {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.sprayMat.dispose();
    for (const r of this.rings) {
      this.scene.remove(r.mesh);
      (r.mesh.material as THREE.Material).dispose();
    }
    this.rings[0]?.mesh.geometry.dispose();
    this.ringMat.dispose();
  }
}
