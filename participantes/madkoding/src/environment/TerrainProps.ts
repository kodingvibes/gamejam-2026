// ─── Terrain Props: instanced trees, rocks, buildings and crystals ──────────
//
// Scattered per terrain chunk (deterministic per chunk so a rebuilt chunk
// gets the same forest) and rendered as one InstancedMesh per kind per chunk.
//   atmosphere / storm → conifers + boulders
//   ice                → snow-laden conifers + ice boulders
//   lava               → charred dead trees + basalt boulders
//   city               → skyscrapers with lit windows (skyline to the horizon)
//   cave               → glowing crystal clusters on the cave floor
// Trees sway in the wind (vertex shader), nothing casts shadows (cheap).

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { asteroidGeometry, crystalGeometry } from './RockGeometry';
import { getBiomeProfile, heightAt, liquidAt, floorAt } from './TerrainField';
import { railAtZ } from './RailShape';

type Kind = 'tree' | 'rock' | 'dead' | 'building' | 'crystal';

const windTime = { value: 0 };

function seeded(a: number, b: number): () => number {
  let s = (Math.abs(a * 73856093 ^ b * 19349663) % 2147483647) || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// ── Shared geometries ───────────────────────────────────────────────────────
function mergeColored(parts: { geo: THREE.BufferGeometry; color: THREE.Color }[]): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  for (const { geo, color } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]);
      nor.push(n[i], n[i + 1], n[i + 2]);
      col.push(color.r, color.g, color.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

function treeGeo(snow: boolean): THREE.BufferGeometry {
  const key = snow ? 'tree-snow' : 'tree';
  const hit = geoCache.get(key);
  if (hit) return hit;
  const trunk = new THREE.CylinderGeometry(0.06, 0.1, 0.35, 5);
  trunk.translate(0, 0.17, 0);
  const parts = [{ geo: trunk, color: new THREE.Color(0x4a3222) }];
  const tiers = [[0.42, 0.45, 0.3], [0.34, 0.4, 0.52], [0.24, 0.34, 0.72], [0.13, 0.26, 0.9]];
  tiers.forEach(([r, h, y], i) => {
    const c = new THREE.ConeGeometry(r, h, 7);
    c.translate(0, y as number, 0);
    const green = new THREE.Color(0x1f4a24).lerp(new THREE.Color(0x2f6a30), i / 3);
    parts.push({ geo: c, color: snow ? green.lerp(new THREE.Color(0xeef4fa), 0.35 + i * 0.15) : green });
  });
  const g = mergeColored(parts);
  geoCache.set(key, g);
  return g;
}

function deadTreeGeo(): THREE.BufferGeometry {
  const hit = geoCache.get('dead');
  if (hit) return hit;
  const parts: { geo: THREE.BufferGeometry; color: THREE.Color }[] = [];
  const char = new THREE.Color(0x1a1210);
  const trunk = new THREE.CylinderGeometry(0.03, 0.09, 1, 5);
  trunk.translate(0, 0.5, 0);
  parts.push({ geo: trunk, color: char });
  for (let i = 0; i < 3; i++) {
    const b = new THREE.CylinderGeometry(0.01, 0.035, 0.4, 4);
    b.translate(0, 0.2, 0);
    b.rotateZ((i % 2 ? 1 : -1) * 0.8);
    b.rotateY(i * 2.1);
    b.translate(0, 0.45 + i * 0.15, 0);
    parts.push({ geo: b, color: char });
  }
  const g = mergeColored(parts);
  geoCache.set('dead', g);
  return g;
}

function buildingGeo(): THREE.BufferGeometry {
  const hit = geoCache.get('building');
  if (hit) return hit;
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, 0.5, 0);
  geoCache.set('building', g);
  return g;
}

// Window texture: grid of randomly lit windows (emissive map).
let windowTex: THREE.Texture | null = null;
function getWindowTexture(): THREE.Texture {
  if (windowTex) return windowTex;
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 6) {
    for (let x = 4; x < 60; x += 6) {
      const r = Math.random();
      if (r < 0.45) continue;
      ctx.fillStyle = r < 0.85 ? '#ffd28a' : r < 0.95 ? '#9fd8ff' : '#ff8a6a';
      ctx.globalAlpha = 0.5 + Math.random() * 0.5;
      ctx.fillRect(x, y, 3, 3);
    }
  }
  windowTex = new THREE.CanvasTexture(c);
  windowTex.wrapS = windowTex.wrapT = THREE.RepeatWrapping;
  windowTex.colorSpace = THREE.SRGBColorSpace;
  return windowTex;
}

// ── Materials (shared) ──────────────────────────────────────────────────────
let mats: Record<Kind, THREE.Material> | null = null;
function getMats(): Record<Kind, THREE.Material> {
  if (mats) return mats;
  const tree = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, envMapIntensity: 0.3 });
  // Wind sway: tips move more than the base; phase from instance position.
  tree.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windTime;
    sh.vertexShader = 'uniform float uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 0.07 + instanceMatrix[3].z * 0.05;
      #else
        float ph = 0.0;
      #endif
      float sway = sin(uWind * 1.6 + ph) * 0.05 + sin(uWind * 3.7 + ph * 2.0) * 0.015;
      transformed.x += sway * transformed.y * transformed.y;
      transformed.z += sway * 0.6 * transformed.y * transformed.y;`);
  };
  const dead = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0x220600, emissiveIntensity: 0.6 });
  dead.onBeforeCompile = tree.onBeforeCompile;
  mats = {
    tree,
    dead,
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x8a8278, roughness: 0.95, flatShading: true, envMapIntensity: 0.3 }),
    building: new THREE.MeshStandardMaterial({
      color: 0x3a4250, roughness: 0.4, metalness: 0.55, envMapIntensity: 1,
      emissive: 0xffffff, emissiveMap: getWindowTexture(), emissiveIntensity: 1.3,
    }),
    crystal: new THREE.MeshStandardMaterial({
      color: 0x88ffee, emissive: 0x33ffcc, emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.2, flatShading: true,
    }),
  };
  return mats;
}

interface Spec { kind: Kind; geo: THREE.BufferGeometry; count: number; scale: [number, number]; tint?: number }

function specsFor(terrain: TerrainType, hi: boolean): Spec[] {
  switch (terrain) {
    case 'atmosphere': return hi ? [
      { kind: 'tree', geo: treeGeo(false), count: 170, scale: [7, 15] },
      { kind: 'rock', geo: asteroidGeometry(21), count: 26, scale: [1.5, 5] },
    ] : [{ kind: 'tree', geo: treeGeo(false), count: 45, scale: [10, 18] }];
    case 'storm': return hi ? [
      { kind: 'tree', geo: treeGeo(false), count: 90, scale: [6, 13], tint: 0x6a7a6a },
      { kind: 'rock', geo: asteroidGeometry(22), count: 40, scale: [2, 6] },
    ] : [];
    case 'ice': return hi ? [
      { kind: 'tree', geo: treeGeo(true), count: 110, scale: [6, 13] },
      { kind: 'rock', geo: asteroidGeometry(23), count: 24, scale: [1.5, 5], tint: 0xbad4ec },
    ] : [{ kind: 'tree', geo: treeGeo(true), count: 30, scale: [9, 16] }];
    case 'lava': return hi ? [
      { kind: 'dead', geo: deadTreeGeo(), count: 70, scale: [5, 11] },
      { kind: 'rock', geo: asteroidGeometry(24), count: 40, scale: [2, 7], tint: 0x3a2c26 },
    ] : [];
    case 'city': return [{ kind: 'building', geo: buildingGeo(), count: hi ? 70 : 40, scale: [10, 18] }];
    case 'cave': return hi ? [{ kind: 'crystal', geo: crystalGeometry(1), count: 45, scale: [1.5, 4.5] }] : [];
    default: return [];
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Build the prop instances for one chunk (null when the biome has none). */
export function buildChunkProps(terrain: TerrainType, x0: number, z0: number, size: number, hi: boolean): THREE.Group | null {
  const specs = specsFor(terrain, hi);
  const prof = getBiomeProfile();
  if (!specs.length || !prof) return null;
  const group = new THREE.Group();
  const rnd = seeded(Math.round(x0), Math.round(z0) + (hi ? 7 : 3));
  const M = getMats();

  for (const spec of specs) {
    const im = new THREE.InstancedMesh(spec.geo, M[spec.kind], spec.count);
    im.userData.noCast = true;
    im.receiveShadow = spec.kind !== 'crystal';
    let n = 0;
    for (let tries = 0; tries < spec.count * 3 && n < spec.count; tries++) {
      const x = x0 + rnd() * size, z = z0 + rnd() * size;
      const rail = railAtZ(z);
      const d = Math.abs(x - rail.x);
      const h = heightAt(x, z);
      const liquid = liquidAt(z);
      if (liquid !== null && h < liquid + 1.2) continue;
      // Slope test from the height field (trees and buildings want flat ground).
      const slope = Math.abs(heightAt(x + 3, z) - h) + Math.abs(heightAt(x, z + 3) - h);
      const rel = (h - floorAt(z)) / prof.mountAmp;
      if (spec.kind === 'tree') {
        if (slope > 4.5 || rel > prof.snowLine + 0.05 || d < 16) continue;
      } else if (spec.kind === 'dead' || spec.kind === 'rock') {
        if (d < 15) continue;
      } else if (spec.kind === 'building') {
        if (d < 26 || slope > 6) continue;
      } else if (spec.kind === 'crystal') {
        if (d < 7 || d > 15) continue;
      }
      const sc = spec.scale[0] + rnd() * (spec.scale[1] - spec.scale[0]);
      if (spec.kind === 'building') {
        // Taller towers toward the canyon edge: a skyline you fly between.
        const tall = 25 + rnd() * 70 * (1 - Math.min(1, (d - 26) / 400)) + rnd() * 20;
        _s.set(sc, tall, sc * (0.7 + rnd() * 0.6));
        _e.set(0, Math.round(rnd() * 4) * Math.PI / 2 + (rnd() - 0.5) * 0.1, 0);
        _p.set(x, h - 2, z);
      } else if (spec.kind === 'rock') {
        _s.set(sc * (0.8 + rnd() * 0.6), sc * (0.45 + rnd() * 0.4), sc * (0.8 + rnd() * 0.6));
        _e.set(rnd() * 6, rnd() * 6, rnd() * 6);
        _p.set(x, h - sc * 0.15, z);
      } else {
        _s.setScalar(sc);
        _e.set((rnd() - 0.5) * 0.12, rnd() * 6.28, (rnd() - 0.5) * 0.12);
        _p.set(x, h - 0.3, z);
      }
      _q.setFromEuler(_e);
      _m.compose(_p, _q, _s);
      im.setMatrixAt(n, _m);
      if (spec.tint !== undefined || spec.kind === 'tree') {
        _c.setHex(spec.tint ?? 0xffffff).multiplyScalar(0.85 + rnd() * 0.3);
        im.setColorAt(n, _c);
      }
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    if (n > 0) group.add(im); else im.dispose();
  }
  return group.children.length ? group : null;
}

export function disposeChunkProps(group: THREE.Group): void {
  for (const c of group.children) (c as THREE.InstancedMesh).dispose();
  group.clear();
}

export function tickProps(dt: number): void {
  windTime.value += dt;
}
