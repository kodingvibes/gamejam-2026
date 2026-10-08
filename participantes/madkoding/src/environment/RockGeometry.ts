// ─── Rock Geometry: cached procedural rocks, spires and crystals ────────────
// Built once per variant and shared by obstacles and scenery (the old
// obstacle code generated — and leaked — a new geometry on every spawn).

import * as THREE from 'three';
import { fbm } from '../utils/noise';

const cache = new Map<string, THREE.BufferGeometry>();

function seeded(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/**
 * Asteroid: subdivided icosahedron, lumpy fBm displacement, a few impact
 * craters and vertex colours (darker crater floors, lighter rims).
 */
export function asteroidGeometry(variant: number): THREE.BufferGeometry {
  const key = `ast${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rnd = seeded(variant + 1);
  const geo = new THREE.IcosahedronGeometry(1, 3);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const craters: { dir: THREE.Vector3; r: number }[] = [];
  for (let i = 0; i < 5; i++) {
    craters.push({
      dir: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(),
      r: 0.25 + rnd() * 0.35,
    });
  }
  const stretch = new THREE.Vector3(0.8 + rnd() * 0.5, 0.7 + rnd() * 0.4, 0.8 + rnd() * 0.6);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    let d = 1 + (fbm(v.x * 1.8 + variant * 3, v.y * 1.8 + v.z * 1.3, 4) - 0.5) * 0.55;
    let shade = 0.85 + fbm(v.x * 6, v.z * 6 + v.y * 4, 2) * 0.3;
    for (const c of craters) {
      const ang = v.angleTo(c.dir);
      if (ang < c.r) {
        const k = ang / c.r;
        d -= (1 - k * k) * 0.16;          // bowl
        shade *= 0.75 + k * 0.25;
      } else if (ang < c.r * 1.35) {
        d += 0.04;                         // raised rim
        shade *= 1.12;
      }
    }
    v.multiplyScalar(d).multiply(stretch);
    pos.setXYZ(i, v.x, v.y, v.z);
    colors[i * 3] = shade * 0.62;
    colors[i * 3 + 1] = shade * 0.56;
    colors[i * 3 + 2] = shade * 0.5;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  cache.set(key, geo);
  return geo;
}

// Per-variant bend (local X offset at the top, unit height). Curved spires
// read as eroded rock instead of telephone poles.
const SPIRE_BEND = [0, 0.35, -0.5, 0.7, -0.25, 0.55, -0.8, 0.15];
export const SPIRE_VARIANTS = SPIRE_BEND.length;

/** Local-space centre of a spire's (bent) axis at height t ∈ [0,1]. */
export function spireAxis(variant: number, t: number, out: THREE.Vector3): THREE.Vector3 {
  const b = SPIRE_BEND[variant % SPIRE_BEND.length];
  return out.set(b * t * t, t, 0);
}

/**
 * Rock spire: a tapered, twisted, gently bent column with noisy strata. Unit
 * height (base at y=0, top at y=1), radius ≈ 1 at the base; scale to fit.
 */
export function spireGeometry(variant: number): THREE.BufferGeometry {
  const key = `spire${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const geo = new THREE.CylinderGeometry(0.45, 1, 1, 12, 18, false);
  geo.translate(0, 0.5, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ang = Math.atan2(v.z, v.x);
    const n = fbm(Math.cos(ang) * 1.5 + variant * 7, v.y * 4 + Math.sin(ang) * 1.5, 4);
    const strata = Math.sin(v.y * 38 + n * 6) * 0.04;
    const r = Math.hypot(v.x, v.z);
    const twist = v.y * 0.6 + variant;
    const k = (0.75 + n * 0.55 + strata) * (1 - v.y * 0.15);
    const nx = (v.x * Math.cos(twist) - v.z * Math.sin(twist)) * k;
    const nz = (v.x * Math.sin(twist) + v.z * Math.cos(twist)) * k;
    const bend = SPIRE_BEND[variant % SPIRE_BEND.length] * v.y * v.y;
    pos.setXYZ(i, (r > 0.001 ? nx : 0) + bend, v.y, r > 0.001 ? nz : 0);
    const shade = 0.75 + n * 0.45 + strata * 3;
    colors[i * 3] = shade; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  cache.set(key, geo);
  return geo;
}

/** Crystal cluster: a big shard ringed by smaller shards. Unit height. */
export function crystalGeometry(variant: number): THREE.BufferGeometry {
  const key = `crystal${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rnd = seeded(variant + 11);
  const parts: THREE.BufferGeometry[] = [];
  const shard = (h: number, r: number, tilt: number, ang: number, off: number) => {
    const g = new THREE.CylinderGeometry(0, r, h, 6, 1);
    const cap = new THREE.CylinderGeometry(r, r * 0.8, h * 0.08, 6, 1);
    cap.translate(0, -h / 2 - h * 0.04, 0);
    const merged = mergeSimple([g, cap]);
    merged.translate(0, h / 2, 0);
    merged.rotateZ(tilt);
    merged.rotateY(ang);
    merged.translate(Math.cos(ang) * off, 0, Math.sin(ang) * off);
    parts.push(merged);
  };
  shard(1, 0.32, 0, 0, 0);
  for (let i = 0; i < 6; i++) {
    shard(0.35 + rnd() * 0.4, 0.12 + rnd() * 0.1, 0.35 + rnd() * 0.4, (i / 6) * Math.PI * 2 + rnd(), 0.25 + rnd() * 0.15);
  }
  const geo = mergeSimple(parts);
  geo.computeVertexNormals();
  cache.set(key, geo);
  return geo;
}

/** Minimal merge for non-indexed / indexed position-only geometries. */
function mergeSimple(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    const p = g.attributes.position.array as ArrayLike<number>;
    for (let i = 0; i < p.length; i++) positions.push(p[i]);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return out;
}
