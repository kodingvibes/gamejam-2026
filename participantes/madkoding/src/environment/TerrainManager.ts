// ─── Terrain Manager: procedurally-generated 3D terrain with real volume ────
// The ground is built from scrolling segments whose vertices are displaced by
// a heightmap (fBm value noise) sampled at WORLD coordinates. As the ship
// flies toward -Z, segments that fall behind the camera are recycled to the
// front, so the terrain appears to scroll toward +Z (toward the camera) with
// genuine hills, canyons, ridges, etc. Each terrain type reads visually
// distinct (amplitude, frequency, colors, emissive glow, tunnel walls).

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { fbm } from '../utils/noise';
import { getBiomeTexture } from './BiomeTextures';

interface TerrainStyle {
  baseColor: number;          // color at low elevation
  heightColor: number;        // color at high elevation (vertex blend)
  amplitude: number;          // max height displacement (world units)
  frequency: number;          // noise frequency (per world unit)
  octaves: number;            // fBm octaves
  groundY: number;            // base y of the terrain surface
  walls: boolean;             // tunnel walls (cave / ice)
  wallColor: number;
  wallDistance: number;       // half-width of the tunnel
  wallHeight: number;         // wall plane height
  wallTop: number;            // ceiling height (y of the top)
  emissive: number;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
}

const STYLES: Record<TerrainType, TerrainStyle> = {
  space:      { baseColor: 0x2a2a44, heightColor: 0x4a4a6a, amplitude: 10,  frequency: 0.06, octaves: 5, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0x111122, emissiveIntensity: 0.4,  roughness: 0.8, metalness: 0.1 },
  atmosphere: { baseColor: 0x3a6a3a, heightColor: 0x6a9a5a, amplitude: 30,  frequency: 0.05,  octaves: 6, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0x224422, emissiveIntensity: 0.6,  roughness: 0.8, metalness: 0.1 },
  cave:       { baseColor: 0x4a3a2a, heightColor: 0x8a7a6a, amplitude: 34,  frequency: 0.06,  octaves: 6, groundY: -35, walls: true,  wallColor: 0x5a4a3a, wallDistance: 16, wallHeight: 26, wallTop: 12, emissive: 0x2a1a0e, emissiveIntensity: 0.5,  roughness: 0.8, metalness: 0.1 },
  nebula:     { baseColor: 0x4a2a6a, heightColor: 0xaa66cc, amplitude: 26,  frequency: 0.05,  octaves: 6, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0x331155, emissiveIntensity: 0.7,  roughness: 0.7, metalness: 0.15 },
  storm:      { baseColor: 0x3a3a3a, heightColor: 0x777777, amplitude: 34,  frequency: 0.08,  octaves: 7, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0x222222, emissiveIntensity: 0.3,  roughness: 0.9, metalness: 0.05 },
  ice:        { baseColor: 0x3a6a9a, heightColor: 0xaaddff, amplitude: 30,  frequency: 0.07,  octaves: 6, groundY: -35, walls: true,  wallColor: 0x4a6a8a, wallDistance: 18, wallHeight: 28, wallTop: 14, emissive: 0x336688, emissiveIntensity: 0.7,  roughness: 0.5, metalness: 0.2 },
  lava:       { baseColor: 0x5a1a00, heightColor: 0xff8844, amplitude: 30,  frequency: 0.06,  octaves: 6, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0xff5500, emissiveIntensity: 1.2,  roughness: 0.7, metalness: 0.1 },
  city:       { baseColor: 0x1a1a3a, heightColor: 0x66ccff, amplitude: 34,  frequency: 0.05,  octaves: 6, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0x113366, emissiveIntensity: 0.8,  roughness: 0.7, metalness: 0.15 },
  void:       { baseColor: 0x1a1a1a, heightColor: 0x333333, amplitude: 8,   frequency: 0.06,  octaves: 5, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0x0a0a0a, emissiveIntensity: 0.2,  roughness: 0.8, metalness: 0.1 },
  aurora:     { baseColor: 0x1a3a4a, heightColor: 0x66ffcc, amplitude: 30,  frequency: 0.05,  octaves: 6, groundY: -35, walls: false, wallColor: 0x000000, wallDistance: 0, wallHeight: 0, wallTop: 0, emissive: 0x226655, emissiveIntensity: 0.8,  roughness: 0.7, metalness: 0.15 },
};

// ── Biome-specific height shaping ────────────────────────────────────────────
// Each terrain type gets its own profile so the ground reads as a real place:
//   - atmosphere → rolling green hills (gentle, centered)
//   - ice        → smooth, mostly-flat ice sheets with soft ridges
//   - lava       → volcanic: sharp peaks + flat lava valleys (ridged)
//   - storm      → rugged rocky highlands (sharp, high frequency)
//   - city       → flat urban ground (subtle variation)
//   - cave       → gentle cave-floor undulation
//   - space-like → untouched (ground is hidden anyway)
function shapeTerrain(terrain: TerrainType, h: number): number {
  switch (terrain) {
    case 'atmosphere': return 0.5 + (h - 0.5) * 0.7;
    case 'ice':        return 0.5 + (h - 0.5) * 0.35;
    case 'lava':       return 0.5 + Math.sign(h - 0.5) * Math.pow(Math.abs(h - 0.5) * 2, 1.4) * 0.4;
    case 'storm':      return 0.5 + (h - 0.5) * 1.1;
    case 'city':       return 0.5 + (h - 0.5) * 0.15;
    case 'cave':       return 0.5 + (h - 0.5) * 0.5;
    default:           return h;
  }
}

/** Normalized elevation factor [0,1] used for both height and vertex color. */
export function terrainElevation(terrain: TerrainType, x: number, z: number): number {
  const s = STYLES[terrain];
  return shapeTerrain(terrain, fbm(x * s.frequency, z * s.frequency, s.octaves));
}

/** World-space height of the terrain surface at (x, z) for a given type. */
export function terrainHeightAt(terrain: TerrainType, x: number, z: number): number {
  const s = STYLES[terrain];
  return terrainElevation(terrain, x, z) * s.amplitude + s.groundY;
}

// Segment geometry (world units).
const SEGMENT_WIDTH = 400;
const SEGMENT_DEPTH = 60;
const SEGMENT_COUNT = 14;          // covers +60 (behind camera) to -780 (ahead)
const WIDTH_SEGS = 40;
const DEPTH_SEGS = 8;

export class TerrainManager {
  private scene: THREE.Scene;
  private segments: THREE.Mesh[] = [];
  private walls: THREE.Mesh[] = [];
  private current: TerrainType = 'space';
  private style: TerrainStyle = STYLES.space;
  private material: THREE.MeshStandardMaterial;
  private curve: THREE.CatmullRomCurve3 | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: getBiomeTexture('space'),
      roughness: STYLES.space.roughness,
      metalness: STYLES.space.metalness,
      emissive: STYLES.space.emissive,
      emissiveIntensity: STYLES.space.emissiveIntensity,
    });

    // Build the scrolling segments.
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const geo = new THREE.PlaneGeometry(SEGMENT_WIDTH, SEGMENT_DEPTH, WIDTH_SEGS, DEPTH_SEGS);
      // Add a vertex color attribute (filled in updateColors).
      const count = geo.attributes.position.count;
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.rotation.x = -Math.PI / 2;
      // Offset from +SEGMENT_DEPTH (behind camera) to -(SEGMENT_COUNT-1)*SEGMENT_DEPTH (ahead).
      mesh.position.set(0, STYLES.space.groundY, SEGMENT_DEPTH - i * SEGMENT_DEPTH);
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.segments.push(mesh);
    }

    this.apply('space');
  }

  /** Apply a terrain type: recolor, retune height, and build/remove tunnel walls. */
  apply(terrain: TerrainType): void {
    if (terrain === this.current) return;
    this.current = terrain;
    this.style = STYLES[terrain];

    this.material.roughness = this.style.roughness;
    this.material.metalness = this.style.metalness;
    this.material.emissive.setHex(this.style.emissive);
    this.material.emissiveIntensity = this.style.emissiveIntensity;
    // Swap in the biome's procedural surface texture.
    const tex = getBiomeTexture(terrain);
    tex.repeat.set(SEGMENT_WIDTH / 8, SEGMENT_DEPTH / 8);
    this.material.map = tex;
    this.material.needsUpdate = true;

    for (const seg of this.segments) {
      seg.position.y = this.style.groundY;
    }

    if (this.style.walls) this.buildWalls(this.style);
    else this.clearWalls();
  }

  /** Give the tunnel walls the rail curve so they wind with the path. */
  setCurve(curve: THREE.CatmullRomCurve3 | null): void {
    this.curve = curve;
    if (this.style.walls) this.buildWalls(this.style);
  }

  private buildWalls(style: TerrainStyle): void {
    this.clearWalls();
    const d = style.wallDistance;
    const h = style.wallHeight;
    const top = style.wallTop;
    const mat = new THREE.MeshStandardMaterial({
      color: style.wallColor,
      map: getBiomeTexture(this.current),
      roughness: 0.95, metalness: 0.05,
    });
    mat.map!.repeat.set(4, 4);

    // If a rail curve is available, build a curved tunnel that follows the
    // winding path the ship flies. Otherwise fall back to straight planes.
    if (this.curve) {
      // Half-tube: walls + ceiling along the upper semicircle of the rail
      // curve, leaving the bottom open so the terrain floor shows through.
      // The tunnel genuinely curves with the path instead of flat planes.
      const tube = new THREE.Mesh(this.buildHalfTube(this.curve, d), mat);
      tube.frustumCulled = false;
      this.scene.add(tube);
      this.walls.push(tube);
      return;
    }

    const len = 900;

    const left = new THREE.Mesh(new THREE.PlaneGeometry(len, h), mat);
    left.rotation.y = Math.PI / 2;
    left.position.set(-d, top - h / 2, 0);
    left.frustumCulled = false;
    this.scene.add(left);
    this.walls.push(left);

    const right = new THREE.Mesh(new THREE.PlaneGeometry(len, h), mat);
    right.rotation.y = -Math.PI / 2;
    right.position.set(d, top - h / 2, 0);
    right.frustumCulled = false;
    this.scene.add(right);
    this.walls.push(right);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(len, d * 2), mat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, top, 0);
    ceil.frustumCulled = false;
    this.scene.add(ceil);
    this.walls.push(ceil);
  }

  private clearWalls(): void {
    for (const w of this.walls) {
      this.scene.remove(w);
      w.geometry.dispose();
      (w.material as THREE.Material).dispose();
    }
    this.walls = [];
  }

  // Build a half-tube (walls + ceiling) along a curve. The upper semicircle
  // of each cross-section is filled so the tunnel curves with the rail path
  // while the bottom stays open to reveal the terrain floor.
  private buildHalfTube(curve: THREE.CatmullRomCurve3, radius: number): THREE.BufferGeometry {
    const tubularSegments = 200;
    const radialSegments = 16; // only top half used → 16 segments ≈ 180°
    const positions: number[] = [];
    const indices: number[] = [];

    const frames = curve.computeFrenetFrames(tubularSegments, false);
    const tangent = new THREE.Vector3();
    const point = new THREE.Vector3();

    for (let i = 0; i <= tubularSegments; i++) {
      const u = i / tubularSegments;
      curve.getPointAt(u, point);
      tangent.copy(frames.tangents[i]);
      // Rebuild a local frame from tangent + world up (matches rail).
      const worldUp = new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
      const up = new THREE.Vector3().crossVectors(right, tangent).normalize();

      // Upper semicircle from angle 0 (right) to PI (left).
      for (let j = 0; j <= radialSegments; j++) {
        const a = (j / radialSegments) * Math.PI;
        const dx = Math.cos(a) * radius;
        const dy = Math.sin(a) * radius;
        const p = point.clone()
          .add(right.clone().multiplyScalar(dx))
          .add(up.clone().multiplyScalar(dy));
        positions.push(p.x, p.y, p.z);
      }
    }

    // Grid indices (two triangles per quad).
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const a = i * (radialSegments + 1) + j;
        const b = a + radialSegments + 1;
        indices.push(a, b, a + 1);
        indices.push(b, b + 1, a + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  /** Displace a segment's vertices from the heightmap sampled at world coords. */
  private updateSegment(mesh: THREE.Mesh, style: TerrainStyle): void {
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const col = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const count = pos.count;
    const px = mesh.position.x;
    const pz = mesh.position.z;
    const base = new THREE.Color(style.baseColor);
    const high = new THREE.Color(style.heightColor);
    const amp = style.amplitude;

    for (let i = 0; i < count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      // After rotation.x = -PI/2, local Y maps to world -Z.
      const worldX = px + lx;
      const worldZ = pz - ly;
      const elev = terrainElevation(this.current, worldX, worldZ);
      pos.setZ(i, elev * amp);
      // Vertex color: blend base → height color by elevation, plus a subtle
      // high-frequency patchiness so the surface reads as textured rock/soil
      // instead of a flat gradient.
      const patch = fbm(worldX * style.frequency * 3, worldZ * style.frequency * 3, 3);
      const t = Math.min(1, elev * 0.7 + patch * 0.3);
      const c = base.clone().lerp(high, t);
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  /** Follow the player: recycle segments behind the camera to the front. */
  update(_dt: number, playerPos: THREE.Vector3): void {
    for (const seg of this.segments) {
      // If the segment has fallen behind the camera, recycle it far ahead.
      if (seg.position.z > playerPos.z + SEGMENT_DEPTH) {
        seg.position.z = playerPos.z - (SEGMENT_COUNT - 1) * SEGMENT_DEPTH;
      }
      this.updateSegment(seg, this.style);
    }
    // Curved tunnel walls are fixed along the rail curve (they span the whole
    // path), so they don't need to follow the player. Only translate the
    // legacy straight-plane walls.
    if (!this.curve) {
      for (const w of this.walls) {
        w.position.z = playerPos.z;
      }
    }
  }

  /** Show/hide the entire terrain (used to hide ground on space-like biomes). */
  setVisible(visible: boolean): void {
    for (const seg of this.segments) seg.visible = visible;
    for (const w of this.walls) w.visible = visible;
  }

  reset(): void {
    this.apply('space');
  }

  dispose(): void {
    for (const seg of this.segments) {
      this.scene.remove(seg);
      seg.geometry.dispose();
    }
    this.segments = [];
    this.material.dispose();
    this.clearWalls();
  }
}
