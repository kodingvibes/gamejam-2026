// ─── Terrain Manager: chunked landscape out to the horizon ──────────────────
//
// The world is tiled into fixed 200×200 chunks around the camera (±1000 wide,
// 2200 deep). Each chunk is built ONCE from TerrainField (heights, analytic
// normals and biome colours) and only rebuilt when it changes level of
// detail — the old terrain re-ran fBm on every vertex every frame.
//
//   • Near chunks: 48×48 cells (~4 u); far chunks: 14×14 (~14 u).
//   • Each chunk carries a skirt that hangs below its border, hiding LOD cracks.
//   • Normals come from finite differences of the height function itself, so
//     chunk borders shade seamlessly.
//   • Distance fog fades the far ridges into the skybox's own horizon colour.
//
// Liquids (water/lava) and the cave half-tube are managed here as well.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { getBiomeTexture } from './BiomeTextures';
import {
  colorAt, getBiomeProfile, hasGround, heightAt, setTerrainBiome,
} from './TerrainField';
import { getRailShape } from './RailShape';
import { LiquidSurfaces } from './LiquidSurfaces';
import { buildChunkProps, disposeChunkProps, tickProps } from './TerrainProps';
import { CityTraffic } from './CityStreets';
import { liquidAt } from './TerrainField';

const PROP_RANGE = 1150;       // chunks closer than this get trees/rocks/buildings

// Shore shader (injected into the terrain material): animated foam bands and
// wet sand along water, a glowing molten rim along lava.
const SHORE_VERT_HEAD = 'attribute float aShore;\nvarying float vShore;\nvarying vec3 vShoreW;\n';
const SHORE_FRAG_HEAD = `uniform float uShoreTime;
uniform float uLiquid;
varying float vShore;
varying vec3 vShoreW;
float shoreHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float shoreNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(shoreHash(i), shoreHash(i + vec2(1, 0)), u.x), mix(shoreHash(i + vec2(0, 1)), shoreHash(i + vec2(1, 1)), u.x), u.y);
}
`;

const CHUNK = 200;
const HI_SEGS = 48;
const LO_SEGS = 14;
const HI_RANGE = 520;          // chunk-centre distance for high detail
const X_CHUNKS = 5;            // ±5 chunks sideways (±1000 u)
const Z_AHEAD = 11;            // chunks ahead of the camera
const Z_BEHIND = 1;
const SKIRT = 40;
const AO_RADIUS = 26;          // world units scanned for baked occlusion
const AO_DIRS = new Float32Array([1, 0, 0.707, 0.707, 0, 1, -0.707, 0.707, -1, 0, -0.707, -0.707, 0, -1, 0.707, -0.707]);
const BUILD_BUDGET_MS = 3;     // per-frame time budget for chunk rebuilds
const FIRST_FILL_MS = 140;     // level load: build the near field at once

export const FOG_NEAR = 260;
export const FOG_FAR = 2050;

interface Chunk {
  mesh: THREE.Mesh;
  props: THREE.Group | null;
  ix: number;
  iz: number;
  lod: number;   // 0 = none built
}

// Also exported for older callers (obstacles/decorations import it).
export function terrainHeightAt(_terrain: TerrainType, x: number, z: number): number {
  return heightAt(x, z);
}

export class TerrainManager {
  private scene: THREE.Scene;
  private chunks = new Map<string, Chunk>();
  private pool: THREE.Mesh[] = [];
  private material: THREE.MeshStandardMaterial;
  private walls: THREE.Mesh[] = [];
  private current: TerrainType = 'space';
  private curve: THREE.CatmullRomCurve3 | null = null;
  private visible = false;
  private fogColor = new THREE.Color(0x88aacc);
  private skyTexture: THREE.Texture | null = null;
  readonly liquids: LiquidSurfaces;
  private _col = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.0,
      map: getBiomeTexture('atmosphere'),
      envMapIntensity: 0.35,
    });
    this.liquids = new LiquidSurfaces(scene);
    this.material.onBeforeCompile = (sh) => {
      sh.uniforms.uShoreTime = this.shoreTime;
      sh.uniforms.uLiquid = this.liquidMode;
      sh.vertexShader = SHORE_VERT_HEAD + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vShore = aShore;
        vShoreW = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
      sh.fragmentShader = SHORE_FRAG_HEAD + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (uLiquid > 0.5 && uLiquid < 1.5 && vShore > 0.01) {
            float n = shoreNoise(vShoreW.xz * 0.4 + vec2(uShoreTime * 0.5, uShoreTime * 0.3));
            float wave = 0.5 + 0.5 * sin(vShore * 14.0 - uShoreTime * 2.4 + n * 4.0);
            float foam = smoothstep(0.6, 0.97, vShore) * smoothstep(0.45, 0.85, wave * 0.55 + n * 0.6);
            diffuseColor.rgb *= 1.0 - 0.35 * smoothstep(0.25, 0.75, vShore);
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), foam * 0.9);
          }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (uLiquid > 1.5 && vShore > 0.01) {
            float n = shoreNoise(vShoreW.xz * 0.25 + uShoreTime * 0.2);
            totalEmissiveRadiance += vec3(1.0, 0.33, 0.05) * pow(vShore, 2.2) * (1.3 + 0.9 * sin(uShoreTime * 2.2 + n * 7.0));
          }`);
    };
  }

  private shoreTime = { value: 0 };
  private liquidMode = { value: 0 };
  private traffic: CityTraffic | null = null;

  /** Switch biome. Rebuilds every chunk synchronously (hidden by the warp). */
  apply(terrain: TerrainType): void {
    this.current = terrain;
    if (terrain === 'city' && !this.traffic) this.traffic = new CityTraffic(this.scene);
    this.traffic?.setActive(terrain === 'city' && this.visible);
    setTerrainBiome(terrain);
    const p = getBiomeProfile();
    const tex = getBiomeTexture(terrain);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.material.map = tex;
    this.material.roughness = p?.roughness ?? 0.9;
    // The scene lights are tuned bright for the ships; tone the ground down
    // (snow most of all) so it keeps contrast and doesn't bloom.
    this.material.color.setScalar(terrain === 'ice' ? 0.62 : terrain === 'lava' ? 0.95 : terrain === 'storm' ? 1.25 : 0.9);
    this.material.needsUpdate = true;

    for (const c of this.chunks.values()) this.releaseChunk(c);
    this.chunks.clear();
    this.liquidMode.value = p?.liquid === 'water' ? 1 : p?.liquid === 'lava' ? 2 : 0;

    if (p?.liquid) {
      const level = -p.clearance + p.liquidOffset;
      const palette = terrain === 'ice'
        ? { deep: 0x0b2a44, shallow: 0x3a7a98, chop: 0.7, glint: 0.8 }
        : terrain === 'storm'
          ? { deep: 0x111d24, shallow: 0x34505a, chop: 1.6, glint: 0.0 }
          : { deep: 0x04283c, shallow: 0x135f6a, chop: 1.0, glint: 1.0 };
      this.liquids.configure(p.liquid, getRailShape(), level, { ...palette, sky: this.skyTexture });
    } else {
      this.liquids.configure(null, getRailShape(), 0);
    }

    if (terrain === 'cave') this.buildWalls();
    else this.clearWalls();
    this.updateFog();
  }

  /** Re-shape for a new level's rail (same biome may come with a new path). */
  setCurve(curve: THREE.CatmullRomCurve3 | null): void {
    this.curve = curve;
    // The valley follows the rail, so every chunk must be rebuilt.
    for (const c of this.chunks.values()) this.releaseChunk(c);
    this.chunks.clear();
    if (this.current === 'cave') this.buildWalls();
  }

  /** Horizon colour sampled from the skybox photo (keeps fog seamless). */
  setHorizon(color: THREE.Color | null, sky: THREE.Texture | null): void {
    const p = getBiomeProfile();
    this.fogColor.copy(color ?? new THREE.Color(p?.fog ?? 0x000000));
    this.skyTexture = sky;
    this.liquids.setSky(sky);
    this.updateFog();
  }

  private updateFog(): void {
    this.liquids.setFog(this.fogColor, FOG_NEAR, FOG_FAR);
  }

  get horizonColor(): THREE.Color { return this.fogColor; }

  // ── Chunk building ────────────────────────────────────────────────────────

  private acquireMesh(): THREE.Mesh {
    const m = this.pool.pop();
    if (m) return m;
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    mesh.matrixAutoUpdate = false;
    mesh.receiveShadow = true;
    mesh.userData.noCast = true;
    return mesh;
  }

  private releaseChunk(c: Chunk): void {
    if (c.props) { this.scene.remove(c.props); disposeChunkProps(c.props); c.props = null; }
    this.scene.remove(c.mesh);
    this.pool.push(c.mesh);
  }

  private buildGeometry(mesh: THREE.Mesh, ix: number, iz: number, segs: number): void {
    const n = segs + 3;                // grid + 1-vertex skirt ring
    const step = CHUNK / segs;
    const x0 = ix * CHUNK;
    const z0 = iz * CHUNK;
    const count = n * n;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    const shore = new Float32Array(count);

    // Height grid padded by `pad` cells on every side: the first ring gives
    // seamless normals, the wider apron feeds the baked ambient occlusion.
    const pad = Math.max(1, Math.round(AO_RADIUS / step));
    const W = segs + 1 + pad * 2;
    const H = new Float32Array(W * W);
    for (let j = 0; j < W; j++) {
      for (let i = 0; i < W; i++) {
        H[j * W + i] = heightAt(x0 + (i - pad) * step, z0 + (j - pad) * step);
      }
    }
    const hAt = (gi: number, gj: number) => H[(gj + pad) * W + (gi + pad)];

    for (let j = 0; j < n; j++) {
      const gj = THREE.MathUtils.clamp(j - 1, 0, segs);
      for (let i = 0; i < n; i++) {
        const gi = THREE.MathUtils.clamp(i - 1, 0, segs);
        const x = x0 + gi * step;
        const z = z0 + gj * step;
        const h = hAt(gi, gj);
        const hx = hAt(gi + 1, gj) - hAt(gi - 1, gj);
        const hz = hAt(gi, gj + 1) - hAt(gi, gj - 1);
        const nx = -hx, ny = 2 * step, nz = -hz;
        const inv = 1 / Math.hypot(nx, ny, nz);

        // Horizon-based AO: in 8 directions, the steepest rise within the
        // apron occludes the sky. Valleys, gullies and cliff feet darken.
        let occ = 0;
        for (let d = 0; d < 8; d++) {
          const dx = AO_DIRS[d * 2], dz = AO_DIRS[d * 2 + 1];
          let maxSlope = 0;
          for (let k = 1; k <= pad; k++) {
            const sx = Math.round(gi + dx * k), sz = Math.round(gj + dz * k);
            const slope = (hAt(sx, sz) - h) / (k * step);
            if (slope > maxSlope) maxSlope = slope;
          }
          occ += maxSlope / Math.sqrt(1 + maxSlope * maxSlope); // sin(horizon angle)
        }
        const ao = 1 - Math.min(0.75, (occ / 8) * 1.35);

        const skirt = i === 0 || j === 0 || i === n - 1 || j === n - 1;
        const k = j * n + i;
        pos[k * 3] = x;
        pos[k * 3 + 1] = skirt ? h - SKIRT : h;
        pos[k * 3 + 2] = z;
        nor[k * 3] = nx * inv;
        nor[k * 3 + 1] = ny * inv;
        nor[k * 3 + 2] = nz * inv;
        colorAt(x, z, h, ny * inv, this._col);
        col[k * 3] = this._col.r * ao;
        col[k * 3 + 1] = this._col.g * ao;
        col[k * 3 + 2] = this._col.b * ao;
        uv[k * 2] = x / 14;
        uv[k * 2 + 1] = z / 14;
        const lv = liquidAt(z);
        shore[k] = lv === null ? 0 : Math.max(0, 1 - Math.abs(h - lv) / 3.5);
      }
    }

    const idx = new Uint32Array((n - 1) * (n - 1) * 6);
    let o = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx[o++] = a; idx[o++] = c; idx[o++] = b;
        idx[o++] = b; idx[o++] = c; idx[o++] = d;
      }
    }

    const geo = mesh.geometry;
    geo.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    mesh.geometry = g;
    mesh.updateMatrix();
  }

  /** Stream chunks around the camera; rebuilds are budgeted per frame. */
  update(_dt: number, _playerPos: THREE.Vector3, camPos?: THREE.Vector3): void {
    const cam = camPos ?? _playerPos;
    this.liquids.update(_dt, cam);
    this.shoreTime.value += _dt;
    tickProps(_dt);
    this.traffic?.update(_dt, _playerPos.z);
    if (!this.visible || !hasGround()) return;

    const cix = Math.floor(cam.x / CHUNK);
    const ciz = Math.floor(cam.z / CHUNK);
    const wanted = new Set<string>();
    const first = this.chunks.size === 0;
    const deadline = performance.now() + (first ? FIRST_FILL_MS : BUILD_BUDGET_MS);

    // Nearest-first so the area around the ship is always ready.
    const order: [number, number, number][] = [];
    for (let dz = -Z_AHEAD; dz <= Z_BEHIND; dz++) {
      for (let dx = -X_CHUNKS; dx <= X_CHUNKS; dx++) {
        const ix = cix + dx, iz = ciz + dz;
        const cx = (ix + 0.5) * CHUNK - cam.x;
        const cz = (iz + 0.5) * CHUNK - cam.z;
        order.push([ix, iz, Math.hypot(cx, cz)]);
      }
    }
    order.sort((a, b) => a[2] - b[2]);

    for (const [ix, iz, dist] of order) {
      const key = `${ix},${iz}`;
      wanted.add(key);
      const lod = dist < HI_RANGE ? 2 : 1;
      let c = this.chunks.get(key);
      if (c && c.lod === lod) continue;
      if (performance.now() > deadline) continue;
      if (!c) {
        c = { mesh: this.acquireMesh(), ix, iz, lod: 0, props: null };
        this.chunks.set(key, c);
        this.scene.add(c.mesh);
      }
      this.buildGeometry(c.mesh, ix, iz, lod === 2 ? HI_SEGS : LO_SEGS);
      c.lod = lod;
      if (c.props) { this.scene.remove(c.props); disposeChunkProps(c.props); c.props = null; }
      if (dist < PROP_RANGE) {
        c.props = buildChunkProps(this.current, ix * CHUNK, iz * CHUNK, CHUNK, lod === 2);
        if (c.props) { c.props.visible = this.visible; this.scene.add(c.props); }
      }
    }

    for (const [key, c] of this.chunks) {
      if (!wanted.has(key)) {
        this.releaseChunk(c);
        this.chunks.delete(key);
      }
    }
  }

  // ── Cave tube ─────────────────────────────────────────────────────────────

  private buildWalls(): void {
    this.clearWalls();
    if (!this.curve) return;
    const tex = getBiomeTexture('cave').clone();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(60, 3);
    tex.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x6a5a48, map: tex, roughness: 0.95, metalness: 0.0, side: THREE.DoubleSide,
    });
    const tube = new THREE.Mesh(this.buildHalfTube(this.curve, 17), mat);
    tube.frustumCulled = false;
    tube.receiveShadow = true;
    tube.userData.noCast = true;
    tube.visible = this.visible;
    this.scene.add(tube);
    this.walls.push(tube);
  }

  private clearWalls(): void {
    for (const w of this.walls) {
      this.scene.remove(w);
      w.geometry.dispose();
      const m = w.material as THREE.MeshStandardMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.walls = [];
  }

  // Rocky half-tube (walls + ceiling) following the rail, with noisy radius so
  // it reads as carved rock rather than a pipe.
  private buildHalfTube(curve: THREE.CatmullRomCurve3, radius: number): THREE.BufferGeometry {
    const tubular = 480;
    const radial = 24;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const point = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();

    for (let i = 0; i <= tubular; i++) {
      const u = i / tubular;
      curve.getPointAt(u, point);
      curve.getTangentAt(u, tangent);
      right.crossVectors(tangent, worldUp).normalize();
      up.crossVectors(right, tangent).normalize();
      for (let j = 0; j <= radial; j++) {
        // Slightly past a semicircle so the walls meet the floor.
        const a = -0.25 + (j / radial) * (Math.PI + 0.5);
        const bump = 1 + Math.sin(i * 0.37 + j * 1.3) * 0.08 + Math.sin(i * 0.11 - j * 0.7) * 0.12;
        const r = radius * bump;
        positions.push(
          point.x + right.x * Math.cos(a) * r + up.x * Math.sin(a) * r,
          point.y + right.y * Math.cos(a) * r + up.y * Math.sin(a) * r,
          point.z + right.z * Math.cos(a) * r + up.z * Math.sin(a) * r,
        );
        uvs.push(u, j / radial);
      }
    }
    for (let i = 0; i < tubular; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /** Show/hide the entire terrain (space-like biomes have no ground). */
  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const c of this.chunks.values()) { c.mesh.visible = visible; if (c.props) c.props.visible = visible; }
    for (const w of this.walls) w.visible = visible;
    this.liquids.setVisible(visible);
    this.traffic?.setActive(visible && this.current === 'city');
  }

  reset(): void {
    // Keep the current biome; chunks stream back in on the next update.
  }

  dispose(): void {
    for (const c of this.chunks.values()) this.releaseChunk(c);
    this.chunks.clear();
    for (const m of this.pool) m.geometry.dispose();
    this.pool = [];
    this.material.dispose();
    this.clearWalls();
    this.liquids.dispose();
    this.traffic?.dispose();
  }
}
