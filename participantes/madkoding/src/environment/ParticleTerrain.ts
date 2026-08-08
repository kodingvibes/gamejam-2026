// ─── Particle Terrain: point-cloud terrain that fades with distance ─────────
// Instead of solid mesh segments with fog, the terrain is rendered as a dense
// particle cloud. Each particle's opacity fades based on its distance from the
// camera, so distant terrain naturally disappears into the skybox without needing
// scene-wide fog. This reads as a volumetric, ethereal landscape.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { terrainElevation } from './TerrainManager';
import { fbm } from '../utils/noise';

interface TerrainStyle {
  baseColor: number;
  heightColor: number;
  amplitude: number;
  frequency: number;
  octaves: number;
  groundY: number;
  particleSize: number;
  particleDensity: number; // particles per 100x100 unit area
  fadeStart: number;       // distance where fade begins
  fadeEnd: number;         // distance where fully transparent
}

const STYLES: Record<TerrainType, TerrainStyle> = {
  space:      { baseColor: 0x4a4a6a, heightColor: 0x8a8aaa, amplitude: 10,  frequency: 0.06, octaves: 5, groundY: -35, particleSize: 2.5, particleDensity: 18, fadeStart: 80,  fadeEnd: 280 },
  atmosphere: { baseColor: 0x6a9a5a, heightColor: 0xaadd8a, amplitude: 30,  frequency: 0.05,  octaves: 6, groundY: -35, particleSize: 3.0, particleDensity: 22, fadeStart: 60,  fadeEnd: 240 },
  cave:       { baseColor: 0x8a7a6a, heightColor: 0xcabaaa, amplitude: 34,  frequency: 0.06,  octaves: 6, groundY: -35, particleSize: 2.8, particleDensity: 26, fadeStart: 40,  fadeEnd: 180 },
  nebula:     { baseColor: 0xaa66cc, heightColor: 0xdd99ff, amplitude: 26,  frequency: 0.05,  octaves: 6, groundY: -35, particleSize: 3.2, particleDensity: 20, fadeStart: 70,  fadeEnd: 260 },
  storm:      { baseColor: 0x777777, heightColor: 0xaaaaaa, amplitude: 34,  frequency: 0.08,  octaves: 7, groundY: -35, particleSize: 2.6, particleDensity: 24, fadeStart: 50,  fadeEnd: 200 },
  ice:        { baseColor: 0xaaddff, heightColor: 0xffffff, amplitude: 30,  frequency: 0.07,  octaves: 6, groundY: -35, particleSize: 2.4, particleDensity: 20, fadeStart: 90,  fadeEnd: 300 },
  lava:       { baseColor: 0xff8844, heightColor: 0xffdd88, amplitude: 30,  frequency: 0.06,  octaves: 6, groundY: -35, particleSize: 3.5, particleDensity: 28, fadeStart: 60,  fadeEnd: 220 },
  city:       { baseColor: 0x66ccff, heightColor: 0xaaffff, amplitude: 34,  frequency: 0.05,  octaves: 6, groundY: -35, particleSize: 2.2, particleDensity: 30, fadeStart: 70,  fadeEnd: 250 },
  void:       { baseColor: 0x333333, heightColor: 0x666666, amplitude: 8,   frequency: 0.06,  octaves: 5, groundY: -35, particleSize: 2.0, particleDensity: 12, fadeStart: 100, fadeEnd: 320 },
  aurora:     { baseColor: 0x66ffcc, heightColor: 0x99ffff, amplitude: 30,  frequency: 0.05,  octaves: 6, groundY: -35, particleSize: 2.8, particleDensity: 22, fadeStart: 80,  fadeEnd: 280 },
};

const SEGMENT_WIDTH = 400;
const SEGMENT_DEPTH = 60;
const SEGMENT_COUNT = 16;
const WIDTH_SEGS = 50;
const DEPTH_SEGS = 10;

export class ParticleTerrain {
  private scene: THREE.Scene;
  private segments: THREE.Points[] = [];
  private current: TerrainType = 'space';
  private style: TerrainStyle = STYLES.space;
  private material: THREE.PointsMaterial;
  private camera: THREE.PerspectiveCamera;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    this.material = new THREE.PointsMaterial({
      size: STYLES.space.particleSize,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const geo = new THREE.BufferGeometry();
      const positions: number[] = [];
      const colors: number[] = [];
      const count = WIDTH_SEGS * DEPTH_SEGS;

      for (let y = 0; y < DEPTH_SEGS; y++) {
        for (let x = 0; x < WIDTH_SEGS; x++) {
          const lx = ((x / (WIDTH_SEGS - 1)) - 0.5) * SEGMENT_WIDTH;
          const ly = ((y / (DEPTH_SEGS - 1)) - 0.5) * SEGMENT_DEPTH;
          positions.push(lx, ly, 0);
          colors.push(1, 1, 1);
        }
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const mesh = new THREE.Points(geo, this.material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, STYLES.space.groundY, SEGMENT_DEPTH - i * SEGMENT_DEPTH);
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.segments.push(mesh);
    }

    this.apply('space');
  }

  apply(terrain: TerrainType): void {
    if (terrain === this.current) return;
    this.current = terrain;
    this.style = STYLES[terrain];

    this.material.size = this.style.particleSize;
    this.material.needsUpdate = true;

    for (const seg of this.segments) {
      seg.position.y = this.style.groundY;
    }
  }

  private updateSegment(mesh: THREE.Points, style: TerrainStyle, camPos: THREE.Vector3): void {
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
    const col = mesh.geometry.attributes.color as THREE.BufferAttribute;
    const count = pos.count;
    const px = mesh.position.x;
    const pz = mesh.position.z;
    const base = new THREE.Color(style.baseColor);
    const high = new THREE.Color(style.heightColor);
    const amp = style.amplitude;

    // Pre-calculate segment world center for distance-based fade
    const segWorldZ = pz;

    for (let i = 0; i < count; i++) {
      const lx = pos.getX(i);
      const ly = pos.getY(i);
      const worldX = px + lx;
      const worldZ = pz - ly;
      const elev = terrainElevation(this.current, worldX, worldZ);
      pos.setZ(i, elev * amp);

      // Vertex color: blend base → height color by elevation, plus patchiness
      // so the particle cloud reads as textured ground, not a flat sheet.
      const patch = fbm(worldX * style.frequency * 3, worldZ * style.frequency * 3, 3);
      const t = Math.min(1, elev * 0.7 + patch * 0.3);
      const c = base.clone().lerp(high, t);
      col.setXYZ(i, c.r, c.g, c.b);
    }

    pos.needsUpdate = true;
    col.needsUpdate = true;
    mesh.geometry.computeVertexNormals();

    // Distance-based opacity fade for all particles in this segment
    const dist = Math.sqrt(
      Math.pow(camPos.x - px, 2) +
      Math.pow(camPos.z - segWorldZ, 2)
    );
    const alpha = dist < style.fadeStart ? 1.0 :
                  dist > style.fadeEnd ? 0.0 :
                  1.0 - (dist - style.fadeStart) / (style.fadeEnd - style.fadeStart);
    (mesh.material as THREE.PointsMaterial).opacity = alpha * 0.85;
  }

  update(_dt: number, playerPos: THREE.Vector3): void {
    for (const seg of this.segments) {
      if (seg.position.z > playerPos.z + SEGMENT_DEPTH) {
        seg.position.z = playerPos.z - (SEGMENT_COUNT - 1) * SEGMENT_DEPTH;
      }
      this.updateSegment(seg, this.style, playerPos);
    }
  }

  reset(): void {
    this.apply('space');
  }

  /** Show/hide the particle terrain (used to hide ground on space-like biomes). */
  setVisible(visible: boolean): void {
    for (const seg of this.segments) seg.visible = visible;
  }

  dispose(): void {
    for (const seg of this.segments) {
      this.scene.remove(seg);
      seg.geometry.dispose();
    }
    this.segments = [];
    this.material.dispose();
  }
}
