// ─── Lava Eruptions: geysers of molten rock bursting from the lava sea ──────
//
// Each eruption telegraphs first (a swelling, glowing dome on the surface),
// then bursts: a fountain of glowing blobs flies up in ballistic arcs, leaves
// ember trails and splashes back into the lava. Eruptions near the flight
// lane are real hazards — blobs that touch the ship deal damage.
// Blobs are one InstancedMesh (single draw call) + one Points cloud of embers.

import * as THREE from 'three';
import { PLAYER } from '../types/config';
import { liquidAt } from './TerrainField';
import { getSoftParticleTexture } from '../fx/softTexture';
import type { RailFrameLike } from '../fx/ObstacleManager';

const MAX_BLOBS = 260;
const MAX_EMBERS = 900;
const MAX_DOMES = 8;
const GRAVITY = 26;

interface Blob { p: THREE.Vector3; v: THREE.Vector3; r: number; life: number; alive: boolean; hazard: boolean }
interface Dome { mesh: THREE.Mesh; glow: THREE.Sprite; t: number; dur: number; pos: THREE.Vector3; power: number; hazard: boolean; alive: boolean }

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _axis = new THREE.Vector3(1, 0, 0);

export class LavaEruptions {
  private blobs: Blob[] = [];
  private blobMesh: THREE.InstancedMesh;
  private embers: THREE.Points;
  private emberPos: Float32Array;
  private emberVel: Float32Array;
  private emberLife: Float32Array;
  private emberCursor = 0;
  private domes: Dome[] = [];
  private timer = 1.5;
  private enabled = false;

  constructor(private scene: THREE.Scene) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.blobMesh = new THREE.InstancedMesh(geo, mat, MAX_BLOBS);
    this.blobMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.blobMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BLOBS * 3), 3);
    this.blobMesh.frustumCulled = false;
    this.blobMesh.count = 0;
    scene.add(this.blobMesh);
    for (let i = 0; i < MAX_BLOBS; i++) {
      this.blobs.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 1, life: 0, alive: false, hazard: false });
    }

    this.emberPos = new Float32Array(MAX_EMBERS * 3);
    this.emberVel = new Float32Array(MAX_EMBERS * 3);
    this.emberLife = new Float32Array(MAX_EMBERS);
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(this.emberPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.embers = new THREE.Points(eg, new THREE.PointsMaterial({
      map: getSoftParticleTexture(), color: 0xffaa44, size: 0.9, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.embers.frustumCulled = false;
    scene.add(this.embers);

    for (let i = 0; i < MAX_DOMES; i++) {
      // Swelling magma bubble: additive dome + wide heat glow on the surface.
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffbb55, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      dome.visible = false;
      scene.add(dome);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getSoftParticleTexture(), color: 0xff6a1a, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.visible = false;
      scene.add(glow);
      this.domes.push({ mesh: dome, glow, t: 0, dur: 1, pos: new THREE.Vector3(), power: 1, hazard: false, alive: false });
    }
    this.setEnabled(false);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.reset();
    this.blobMesh.visible = on;
    this.embers.visible = on;
  }

  /**
   * @returns hit=true when a hazard blob strikes the ship this frame.
   * `railAhead(d)` gives the rail frame d units ahead (for placing geysers).
   */
  update(dt: number, playerPos: THREE.Vector3, railAhead?: (d: number) => RailFrameLike, invulnerable = false): { hit: boolean } {
    if (!this.enabled) return { hit: false };
    let hit = false;

    // Schedule new eruptions: mostly scenery, sometimes right in the lane.
    this.timer -= dt;
    if (railAhead && this.timer <= 0) {
      this.timer = THREE.MathUtils.randFloat(0.3, 0.8);
      const inLane = Math.random() < 0.35;
      const f = railAhead(inLane ? THREE.MathUtils.randFloat(55, 85) : THREE.MathUtils.randFloat(60, 260));
      const lateral = inLane ? THREE.MathUtils.randFloat(-10, 10) : (Math.random() < 0.5 ? -1 : 1) * THREE.MathUtils.randFloat(18, 70);
      const p = f.position.clone().addScaledVector(f.right, lateral);
      const level = liquidAt(p.z);
      if (level !== null) {
        p.y = level;
        this.startDome(p, inLane ? 1.1 : THREE.MathUtils.randFloat(1.2, 2.6), inLane);
      }
    }

    // Domes swell, then burst.
    for (const d of this.domes) {
      if (!d.alive) continue;
      d.t += dt;
      const k = d.t / d.dur;
      const r = (1.2 + k * 3) * d.power;
      d.mesh.scale.set(r, r * (0.35 + k * 0.5), r);
      (d.mesh.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.45 + k * 0.4, 0.1 + k * 0.35);
      d.glow.scale.setScalar(r * 4.5);
      d.glow.material.opacity = 0.35 + k * 0.6 + Math.sin(d.t * 40) * 0.08;
      if (k >= 1) {
        d.alive = false;
        d.mesh.visible = false;
        d.glow.visible = false;
        this.burst(d.pos, d.power, d.hazard);
      }
    }

    // Blobs fly ballistic arcs and splash back.
    let n = 0;
    for (const b of this.blobs) {
      if (!b.alive) continue;
      b.v.y -= GRAVITY * dt;
      b.p.addScaledVector(b.v, dt);
      b.life += dt;
      const level = liquidAt(b.p.z) ?? -50;
      if (b.p.y < level && b.v.y < 0) {
        b.alive = false;
        this.emitEmbers(b.p, 6, 6);
        continue;
      }
      if (Math.random() < 0.6) this.emitEmbers(b.p, 1, 1.5);
      if (b.hazard && !invulnerable && !hit && b.p.distanceTo(playerPos) < b.r + PLAYER.HITBOX_RADIUS) {
        hit = true;
        b.alive = false;
        this.emitEmbers(b.p, 14, 10);
        continue;
      }
      const cool = Math.min(1, b.life / 2.5);
      _c.setRGB(1, 0.85 - cool * 0.55, 0.45 - cool * 0.4).multiplyScalar(2.2 - cool * 0.8);
      _s.setScalar(b.r * (1 - cool * 0.25));
      _q.setFromAxisAngle(_axis, b.life * 3);
      _m.compose(b.p, _q, _s);
      this.blobMesh.setMatrixAt(n, _m);
      this.blobMesh.setColorAt(n, _c);
      n++;
    }
    this.blobMesh.count = n;
    this.blobMesh.instanceMatrix.needsUpdate = true;
    if (this.blobMesh.instanceColor) this.blobMesh.instanceColor.needsUpdate = true;

    // Embers: rise slightly, drift, fade (by shrinking out of view).
    for (let i = 0; i < MAX_EMBERS; i++) {
      if (this.emberLife[i] <= 0) continue;
      this.emberLife[i] -= dt;
      const o = i * 3;
      this.emberVel[o + 1] -= GRAVITY * 0.25 * dt;
      this.emberPos[o] += this.emberVel[o] * dt;
      this.emberPos[o + 1] += this.emberVel[o + 1] * dt;
      this.emberPos[o + 2] += this.emberVel[o + 2] * dt;
      if (this.emberLife[i] <= 0) this.emberPos[o + 1] = -9999;
    }
    (this.embers.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    return { hit };
  }

  private startDome(pos: THREE.Vector3, power: number, hazard: boolean): void {
    const d = this.domes.find(x => !x.alive);
    if (!d) return;
    d.alive = true;
    d.t = 0;
    d.dur = hazard ? 0.9 : 0.6;
    d.power = power;
    d.hazard = hazard;
    d.pos.copy(pos);
    d.mesh.position.copy(pos);
    d.mesh.visible = true;
    d.glow.position.copy(pos);
    d.glow.visible = true;
  }

  private burst(pos: THREE.Vector3, power: number, hazard: boolean): void {
    const count = Math.round(16 + power * 14);
    for (let i = 0; i < count; i++) {
      const b = this.blobs.find(x => !x.alive);
      if (!b) break;
      const ang = Math.random() * Math.PI * 2;
      const spread = Math.random() * 7 * power;
      b.alive = true;
      b.life = 0;
      b.hazard = hazard;
      b.r = THREE.MathUtils.randFloat(0.5, 1.6) * (0.8 + power * 0.35);
      b.p.copy(pos);
      b.v.set(Math.cos(ang) * spread, THREE.MathUtils.randFloat(20, 36) * Math.sqrt(power), Math.sin(ang) * spread);
    }
    this.emitEmbers(pos, 40, 12);
  }

  private emitEmbers(pos: THREE.Vector3, count: number, speed: number): void {
    for (let k = 0; k < count; k++) {
      const i = this.emberCursor;
      this.emberCursor = (this.emberCursor + 1) % MAX_EMBERS;
      const o = i * 3;
      this.emberPos[o] = pos.x;
      this.emberPos[o + 1] = pos.y;
      this.emberPos[o + 2] = pos.z;
      this.emberVel[o] = (Math.random() - 0.5) * speed;
      this.emberVel[o + 1] = Math.random() * speed;
      this.emberVel[o + 2] = (Math.random() - 0.5) * speed;
      this.emberLife[i] = 0.5 + Math.random() * 0.9;
    }
  }

  reset(): void {
    for (const b of this.blobs) b.alive = false;
    for (const d of this.domes) { d.alive = false; d.mesh.visible = false; d.glow.visible = false; }
    this.emberLife.fill(0);
    for (let i = 0; i < MAX_EMBERS; i++) this.emberPos[i * 3 + 1] = -9999;
    this.blobMesh.count = 0;
    this.timer = 1.5;
  }

  dispose(): void {
    this.scene.remove(this.blobMesh, this.embers);
    this.blobMesh.geometry.dispose();
    (this.blobMesh.material as THREE.Material).dispose();
    this.embers.geometry.dispose();
    (this.embers.material as THREE.Material).dispose();
    for (const d of this.domes) {
      this.scene.remove(d.mesh, d.glow);
      d.glow.material.dispose();
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    }
  }
}
