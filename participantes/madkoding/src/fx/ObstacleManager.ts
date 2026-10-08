// ─── Obstacle Manager: world-anchored hazards on the flight path ────────────
//
// Obstacles are placed ON the rail ahead of the ship (rail-relative), sit
// still in the world and genuinely cross the flight lane:
//   • terrain biomes: rock spires rising from the ground, arches to thread,
//     destructible crystal clusters, cave stalactites, city pylons
//   • space biomes: tumbling, drifting asteroids (small ones can be shot)
// Collision uses capsules (segment + radius) against both the ship and laser
// segments, so tall spires block along their whole height — the old columns
// were spheres buried below the ship's altitude and could never be hit.

import * as THREE from 'three';
import { PLAYER } from '../types/config';
import type { TerrainType } from '../levels/LevelData';
import { heightAt, liquidAt } from '../environment/TerrainField';
import { asteroidGeometry, crystalGeometry, spireGeometry } from '../environment/RockGeometry';
import { getSoftParticleTexture } from './softTexture';

export interface RailFrameLike {
  position: THREE.Vector3;
  forward: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
}

interface Capsule { a: THREE.Vector3; b: THREE.Vector3; r: number }

export interface Obstacle {
  group: THREE.Group;
  kind: 'asteroid' | 'spire' | 'arch' | 'crystal' | 'stalactite' | 'pylon';
  active: boolean;
  destructible: boolean;
  caps: Capsule[];
  center: THREE.Vector3;
  color: number;
  size: number;
  spin: THREE.Vector3;
  drift: THREE.Vector3;
  /** Back-compat for code that reads `.position` / `.radius`. */
  position: THREE.Vector3;
  radius: number;
}

type Palette = { rock: number; rockEmissive: number; crystal: number };

const PALETTES: Record<TerrainType, Palette> = {
  space:      { rock: 0x8a8070, rockEmissive: 0x000000, crystal: 0x66ccff },
  atmosphere: { rock: 0x7d7062, rockEmissive: 0x000000, crystal: 0x66ffcc },
  cave:       { rock: 0x7a6650, rockEmissive: 0x000000, crystal: 0xffaa44 },
  nebula:     { rock: 0x7a6a8a, rockEmissive: 0x110022, crystal: 0xcc66ff },
  storm:      { rock: 0x55575c, rockEmissive: 0x000000, crystal: 0x88aaff },
  ice:        { rock: 0x6f8fb0, rockEmissive: 0x000000, crystal: 0x88eeff },
  lava:       { rock: 0x3a2a24, rockEmissive: 0x551100, crystal: 0xff6622 },
  city:       { rock: 0x5a6478, rockEmissive: 0x000000, crystal: 0x44ccff },
  void:       { rock: 0x5a5458, rockEmissive: 0x000000, crystal: 0xff4466 },
  aurora:     { rock: 0x8aa0a8, rockEmissive: 0x002218, crystal: 0x66ffaa },
};

const SPACE_LIKE: TerrainType[] = ['space', 'nebula', 'void', 'aurora'];

// Shared simple geometries (never allocate per spawn).
const MAST_GEO = new THREE.CylinderGeometry(0.9, 1.6, 1, 8);
const RING_GEO = new THREE.TorusGeometry(1.4, 0.15, 6, 16);
const BOX_GEO = new THREE.BoxGeometry(1, 1, 1);

// Segment–segment closest distance² (Ericson, Real-Time Collision Detection).
const _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _r = new THREE.Vector3();
const _c1 = new THREE.Vector3(), _c2 = new THREE.Vector3();
function segSegDist2(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3): number {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r);
  let s = 0, t = 0;
  if (a <= 1e-8 && e <= 1e-8) return _r.lengthSq();
  if (a <= 1e-8) { t = THREE.MathUtils.clamp(f / e, 0, 1); }
  else {
    const c = _d1.dot(_r);
    if (e <= 1e-8) { s = THREE.MathUtils.clamp(-c / a, 0, 1); }
    else {
      const b = _d1.dot(_d2), den = a * e - b * b;
      s = den !== 0 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1); }
      else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1); }
    }
  }
  _c1.copy(p1).addScaledVector(_d1, s);
  _c2.copy(p2).addScaledVector(_d2, t);
  return _c1.distanceToSquared(_c2);
}

const _closest = new THREE.Vector3();
function closestOnSeg(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  _d1.subVectors(b, a);
  const len2 = _d1.lengthSq();
  const t = len2 > 1e-8 ? THREE.MathUtils.clamp(_r.subVectors(p, a).dot(_d1) / len2, 0, 1) : 0;
  return out.copy(a).addScaledVector(_d1, t);
}

export class ObstacleManager {
  private scene: THREE.Scene;
  obstacles: Obstacle[] = [];
  private spawnTimer = 0;
  private spawnInterval = 1.6;
  private _minRadius = 0.6;
  private _maxRadius = 1.4;
  private terrain: TerrainType = 'space';
  private mats: { rock: THREE.MeshStandardMaterial; asteroid: THREE.MeshStandardMaterial; crystal: THREE.MeshStandardMaterial; metal: THREE.MeshStandardMaterial };
  private glowTex = getSoftParticleTexture();
  private time = 0;

  /** Called when an obstacle is destroyed (explosion / score in Game). */
  onDestroyed: ((center: THREE.Vector3, color: number, size: number) => void) | null = null;

  constructor(scene: THREE.Scene, poolSize = 28) {
    this.scene = scene;
    this.mats = {
      rock: new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xa89a86, roughness: 0.92, metalness: 0.02, envMapIntensity: 0.3 }),
      asteroid: new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x9a8f80, roughness: 0.95, metalness: 0.05, flatShading: true, envMapIntensity: 0.3 }),
      crystal: new THREE.MeshStandardMaterial({
        color: 0x66ffcc, emissive: 0x66ffcc, emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.3,
        transparent: true, opacity: 0.88, flatShading: true, envMapIntensity: 0.6,
      }),
      metal: new THREE.MeshStandardMaterial({ color: 0x5a6478, roughness: 0.45, metalness: 0.6, envMapIntensity: 0.8 }),
    };
    for (let i = 0; i < poolSize; i++) {
      const group = new THREE.Group();
      group.visible = false;
      this.scene.add(group);
      this.obstacles.push({
        group, kind: 'asteroid', active: false, destructible: false, caps: [],
        center: new THREE.Vector3(), color: 0xffffff, size: 1,
        spin: new THREE.Vector3(), drift: new THREE.Vector3(),
        position: new THREE.Vector3(), radius: 1,
      });
    }
  }

  setConfig(config: { spawnInterval: number; minRadius: number; maxRadius: number }): void {
    // Level values were tuned for tiny pebbles; obstacles are now set pieces.
    this.spawnInterval = Math.max(1.1, config.spawnInterval * 1.4);
    this._minRadius = config.minRadius;
    this._maxRadius = config.maxRadius;
  }

  setTerrain(terrain: TerrainType): void {
    this.terrain = terrain;
    const p = PALETTES[terrain];
    this.mats.rock.color.setHex(p.rock);
    this.mats.rock.emissive.setHex(p.rockEmissive);
    this.mats.rock.emissiveIntensity = p.rockEmissive ? 0.8 : 0;
    this.mats.asteroid.color.setHex(p.rock).multiplyScalar(0.75);
    this.mats.crystal.color.setHex(p.crystal);
    this.mats.crystal.emissive.setHex(p.crystal);
  }

  /**
   * @param railAhead rail frame `dist` units ahead of the ship (spawning)
   * @param frame     current rail frame (recycling behind the camera)
   */
  update(
    dt: number,
    playerPos: THREE.Vector3,
    frame?: RailFrameLike,
    railAhead?: (dist: number) => RailFrameLike,
  ): { hit: boolean; push: THREE.Vector3 } {
    this.time += dt;
    this.spawnTimer += dt;
    if (railAhead && this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      this.spawnOne(railAhead(THREE.MathUtils.randFloat(190, 240)));
    }

    const push = new THREE.Vector3();
    let hit = false;
    for (const o of this.obstacles) {
      if (!o.active) continue;
      if (o.kind === 'asteroid') {
        o.group.rotation.x += o.spin.x * dt;
        o.group.rotation.y += o.spin.y * dt;
        o.group.rotation.z += o.spin.z * dt;
        o.center.addScaledVector(o.drift, dt);
        o.group.position.copy(o.center);
        o.caps[0].a.copy(o.center);
        o.caps[0].b.copy(o.center);
      } else if (o.kind === 'pylon') {
        const light = o.group.children[1] as THREE.Sprite | undefined;
        if (light) light.material.opacity = Math.sin(this.time * 6) > 0 ? 1 : 0.15;
      }

      if (!hit) {
        for (const c of o.caps) {
          closestOnSeg(playerPos, c.a, c.b, _closest);
          const d = _closest.distanceTo(playerPos);
          const min = c.r + PLAYER.HITBOX_RADIUS;
          if (d < min) {
            hit = true;
            if (d > 1e-3) push.copy(playerPos).sub(_closest).normalize().multiplyScalar(min - d + 2);
            else push.set(0, 3, 0);
            break;
          }
        }
      }

      // Recycle once well behind the camera.
      if (frame) {
        _r.subVectors(o.center, frame.position);
        if (_r.dot(frame.forward) < -30) this.deactivate(o);
      }
    }
    return { hit, push };
  }

  /** First obstacle a projectile segment passes through this frame. */
  projectileHit(prev: THREE.Vector3, cur: THREE.Vector3): Obstacle | null {
    for (const o of this.obstacles) {
      if (!o.active) continue;
      for (const c of o.caps) {
        const r = c.r + 0.3;
        if (segSegDist2(prev, cur, c.a, c.b) < r * r) return o;
      }
    }
    return null;
  }

  destroy(o: Obstacle): void {
    if (!o.active) return;
    this.onDestroyed?.(o.center.clone(), o.color, o.size);
    this.deactivate(o);
  }

  /** Back-compat alias. */
  destroyColumn(o: Obstacle): void { this.destroy(o); }

  private deactivate(o: Obstacle): void {
    o.active = false;
    o.group.visible = false;
  }

  // ── Spawning ──────────────────────────────────────────────────────────────

  private spawnOne(f: RailFrameLike): void {
    const slot = this.obstacles.find(o => !o.active);
    if (!slot) return;
    // Clear the previous meshes from the slot.
    for (const child of [...slot.group.children]) {
      slot.group.remove(child);
      if (child instanceof THREE.Sprite) child.material.dispose();
    }
    slot.group.position.set(0, 0, 0);
    slot.group.rotation.set(0, 0, 0);
    slot.group.scale.set(1, 1, 1);
    slot.caps = [];
    slot.drift.set(0, 0, 0);
    slot.spin.set(0, 0, 0);

    const r = Math.random();
    const t = this.terrain;
    if (SPACE_LIKE.includes(t)) this.makeAsteroid(slot, f);
    else if (t === 'cave') r < 0.45 ? this.makeStalactite(slot, f) : r < 0.85 ? this.makeSpire(slot, f) : this.makeCrystal(slot, f);
    else if (t === 'city') r < 0.7 ? this.makePylon(slot, f) : this.makeArch(slot, f, true);
    else if (t === 'lava') r < 0.7 ? this.makeSpire(slot, f) : this.makeCrystal(slot, f);
    else r < 0.55 ? this.makeSpire(slot, f) : r < 0.8 ? this.makeArch(slot, f, false) : this.makeCrystal(slot, f);

    slot.position.copy(slot.center);
    slot.radius = slot.caps.reduce((m, c) => Math.max(m, c.r), 0);
    slot.active = true;
    slot.group.visible = true;
  }

  private lanePoint(f: RailFrameLike, lateral: number, vertical = 0): THREE.Vector3 {
    return f.position.clone().addScaledVector(f.right, lateral).addScaledVector(f.up, vertical);
  }

  /** Ground (or liquid surface) under a world point. */
  private groundUnder(x: number, z: number): number {
    const g = heightAt(x, z);
    const l = liquidAt(z);
    return l !== null ? Math.max(g, l - 1.5) : g;
  }

  private addCap(o: Obstacle, a: THREE.Vector3, b: THREE.Vector3, r: number): void {
    o.caps.push({ a: a.clone(), b: b.clone(), r });
  }

  private makeSpire(o: Obstacle, f: RailFrameLike): void {
    const p = this.lanePoint(f, THREE.MathUtils.randFloat(-11, 11));
    const base = this.groundUnder(p.x, p.z) - 2;
    const top = f.position.y + THREE.MathUtils.randFloat(7, 16);
    const h = Math.max(6, top - base);
    const rad = THREE.MathUtils.randFloat(1.8, 3.0);
    const mesh = new THREE.Mesh(spireGeometry(Math.floor(Math.random() * 5)), this.mats.rock);
    mesh.scale.set(rad, h, rad);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    o.group.add(mesh);
    o.group.position.set(p.x, base, p.z);
    o.kind = 'spire';
    o.destructible = false;
    o.color = PALETTES[this.terrain].rock;
    o.size = rad * 2;
    o.center.set(p.x, base + h / 2, p.z);
    this.addCap(o, new THREE.Vector3(p.x, base, p.z), new THREE.Vector3(p.x, base + h * 0.92, p.z), rad * 0.72);
  }

  private makeStalactite(o: Obstacle, f: RailFrameLike): void {
    const p = this.lanePoint(f, THREE.MathUtils.randFloat(-9, 9));
    const ceil = f.position.y + 18;
    const tip = f.position.y + THREE.MathUtils.randFloat(-4, 3);
    const h = ceil - tip;
    const rad = THREE.MathUtils.randFloat(1.6, 2.6);
    const mesh = new THREE.Mesh(spireGeometry(Math.floor(Math.random() * 5)), this.mats.rock);
    mesh.scale.set(rad, h, rad);
    mesh.rotation.x = Math.PI;      // hang from the ceiling
    o.group.add(mesh);
    o.group.position.set(p.x, ceil, p.z);
    o.kind = 'stalactite';
    o.destructible = false;
    o.color = PALETTES[this.terrain].rock;
    o.size = rad * 2;
    o.center.set(p.x, ceil - h / 2, p.z);
    this.addCap(o, new THREE.Vector3(p.x, ceil, p.z), new THREE.Vector3(p.x, tip + 1, p.z), rad * 0.62);
  }

  private makeArch(o: Obstacle, f: RailFrameLike, metal: boolean): void {
    const c = this.lanePoint(f, THREE.MathUtils.randFloat(-5, 5));
    const gap = THREE.MathUtils.randFloat(7, 9.5);
    const lintelY = f.position.y + THREE.MathUtils.randFloat(5, 8.5);
    const legR = 2.1;
    const mat = metal ? this.mats.metal : this.mats.rock;
    const legs: THREE.Vector3[] = [];
    for (const side of [-1, 1]) {
      const lp = c.clone().addScaledVector(f.right, side * gap);
      const base = this.groundUnder(lp.x, lp.z) - 2;
      const h = lintelY + 2 - base;
      const leg = new THREE.Mesh(spireGeometry(side > 0 ? 1 : 3), mat);
      leg.scale.set(legR, h, legR);
      leg.position.set(lp.x - c.x, base - c.y, lp.z - c.z);
      o.group.add(leg);
      this.addCap(o, new THREE.Vector3(lp.x, base, lp.z), new THREE.Vector3(lp.x, lintelY, lp.z), legR * 0.75);
      legs.push(new THREE.Vector3(lp.x, lintelY, lp.z));
    }
    // Lintel: a rock beam lying across both legs (pivot at the left leg top).
    const span = legs[0].distanceTo(legs[1]);
    const pivot = new THREE.Group();
    const beam = new THREE.Mesh(metal ? BOX_GEO : spireGeometry(2), mat);
    if (metal) {
      beam.scale.set(span + 3, 1.6, 2.2);
      beam.position.x = span / 2;
    } else {
      beam.rotation.z = -Math.PI / 2;      // spire axis (+Y) → +X
      beam.scale.set(2.6, span + 3, 2.6);
      beam.position.x = -1.5;
    }
    pivot.add(beam);
    pivot.position.set(legs[0].x - c.x, lintelY + 0.8 - c.y, legs[0].z - c.z);
    pivot.rotation.y = -Math.atan2(legs[1].z - legs[0].z, legs[1].x - legs[0].x);
    o.group.add(pivot);
    const mid = legs[0].clone().add(legs[1]).multiplyScalar(0.5);
    o.group.position.copy(c);
    this.addCap(o, legs[0].clone().setY(lintelY + 0.8), legs[1].clone().setY(lintelY + 0.8), 1.9);
    o.kind = 'arch';
    o.destructible = false;
    o.color = PALETTES[this.terrain].rock;
    o.size = 4;
    o.center.copy(mid);
  }

  private makeCrystal(o: Obstacle, f: RailFrameLike): void {
    const p = this.lanePoint(f, THREE.MathUtils.randFloat(-9, 9));
    const base = this.groundUnder(p.x, p.z) - 1;
    const top = f.position.y + THREE.MathUtils.randFloat(1, 7);
    const h = Math.max(5, top - base);
    const mesh = new THREE.Mesh(crystalGeometry(Math.floor(Math.random() * 3)), this.mats.crystal);
    const w = THREE.MathUtils.randFloat(3.2, 4.2);
    mesh.scale.set(w, h, w);
    mesh.rotation.y = Math.random() * Math.PI;
    o.group.add(mesh);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: PALETTES[this.terrain].crystal, transparent: true, opacity: 0.28,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.position.y = h * 0.75;
    glow.scale.setScalar(9);
    o.group.add(glow);
    o.group.position.set(p.x, base, p.z);
    o.kind = 'crystal';
    o.destructible = true;
    o.color = PALETTES[this.terrain].crystal;
    o.size = 2.5;
    o.center.set(p.x, base + h * 0.6, p.z);
    this.addCap(o, new THREE.Vector3(p.x, base, p.z), new THREE.Vector3(p.x, base + h * 0.95, p.z), 1.6);
  }

  private makePylon(o: Obstacle, f: RailFrameLike): void {
    const p = this.lanePoint(f, THREE.MathUtils.randFloat(-10, 10));
    const base = this.groundUnder(p.x, p.z);
    const top = f.position.y + THREE.MathUtils.randFloat(8, 18);
    const h = top - base;
    const mast = new THREE.Mesh(MAST_GEO, this.mats.metal);
    mast.scale.y = h;
    mast.position.y = h / 2;
    o.group.add(mast);
    const light = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xff2222, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    light.position.y = h + 0.5;
    light.scale.setScalar(3);
    o.group.add(light);
    for (let k = 1; k <= 3; k++) {
      const ring = new THREE.Mesh(RING_GEO, this.mats.crystal);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = (h * k) / 4;
      o.group.add(ring);
    }
    o.group.position.set(p.x, base, p.z);
    o.kind = 'pylon';
    o.destructible = false;
    o.color = 0x88aacc;
    o.size = 2;
    o.center.set(p.x, base + h / 2, p.z);
    this.addCap(o, new THREE.Vector3(p.x, base, p.z), new THREE.Vector3(p.x, top, p.z), 1.4);
  }

  private makeAsteroid(o: Obstacle, f: RailFrameLike): void {
    const big = Math.random() < 0.3;
    const rad = big
      ? THREE.MathUtils.randFloat(2.6, 4.2)
      : THREE.MathUtils.randFloat(this._minRadius + 0.4, this._maxRadius + 0.8);
    const p = this.lanePoint(f, THREE.MathUtils.randFloat(-12, 12), THREE.MathUtils.randFloat(-6, 6));
    const mesh = new THREE.Mesh(asteroidGeometry(Math.floor(Math.random() * 6)), this.mats.asteroid);
    mesh.scale.setScalar(rad);
    o.group.add(mesh);
    o.group.position.copy(p);
    o.group.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    o.spin.set((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9);
    // Drift slowly across the lane (never at the old 12 u/s toward the ship).
    o.drift.copy(f.right).multiplyScalar((Math.random() - 0.5) * 4).addScaledVector(f.up, (Math.random() - 0.5) * 2);
    o.kind = 'asteroid';
    o.destructible = rad < 1.9;
    o.color = 0xffaa66;
    o.size = rad;
    o.center.copy(p);
    this.addCap(o, p, p, rad * 0.85);
  }

  reset(): void {
    for (const o of this.obstacles) this.deactivate(o);
    this.spawnTimer = 0;
  }

  dispose(): void {
    for (const o of this.obstacles) this.scene.remove(o.group);
    this.mats.rock.dispose();
    this.mats.asteroid.dispose();
    this.mats.crystal.dispose();
    this.mats.metal.dispose();
    this.obstacles = [];
  }
}
