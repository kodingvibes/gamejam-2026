// ─── Biome Textures: procedural tiling surface textures per terrain ──────────
// Generates a subtle, tileable CanvasTexture for each terrain type so the
// ground reads as real material (rock, ice, lava, grass, sand, crystal…)
// instead of a flat vertex-color gradient. The texture is multiplied with the
// per-vertex biome colors, so it adds surface detail without overriding the
// biome's overall tint.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { fbm } from '../utils/noise';

interface TextureSpec {
  base: [number, number, number];     // base color (rgb 0..255)
  tint: [number, number, number];     // highlight color for high-frequency detail
  freq: number;                       // noise frequency (per pixel)
  octaves: number;
  contrast: number;                   // how strong the detail is (0..1)
}

const SPECS: Record<TerrainType, TextureSpec> = {
  space:      { base: [80, 80, 110], tint: [150, 150, 195], freq: 0.06, octaves: 4, contrast: 0.7 },
  atmosphere: { base: [90, 130, 70], tint: [170, 210, 125], freq: 0.05, octaves: 5, contrast: 0.75 },
  cave:       { base: [90, 75, 60],  tint: [160, 140, 115], freq: 0.07, octaves: 5, contrast: 0.8 },
  nebula:     { base: [110, 70, 150],tint: [200, 140, 240], freq: 0.05, octaves: 4, contrast: 0.7 },
  storm:      { base: [90, 90, 95],  tint: [170, 170, 185], freq: 0.08, octaves: 6, contrast: 0.85 },
  ice:        { base: [150, 200, 240],tint: [245, 252, 255],freq: 0.06, octaves: 4, contrast: 0.6 },
  lava:       { base: [120, 50, 20], tint: [255, 175, 85], freq: 0.06, octaves: 5, contrast: 0.9 },
  city:       { base: [70, 80, 100], tint: [160, 180, 210],freq: 0.07, octaves: 4, contrast: 0.7 },
  void:       { base: [45, 45, 50],  tint: [95, 95, 105], freq: 0.06, octaves: 4, contrast: 0.7 },
  aurora:     { base: [80, 130, 120],tint: [190, 245, 225],freq: 0.05, octaves: 4, contrast: 0.65 },
};

const SIZE = 256;

function makeTexture(spec: TextureSpec): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Sample fbm in a wrap-friendly way: use periodic coordinates so the
      // texture tiles seamlessly.
      const n = fbm(x * spec.freq, y * spec.freq, spec.octaves);
      // Add a second higher-frequency layer for fine grain.
      const grain = fbm(x * spec.freq * 4 + 100, y * spec.freq * 4 + 100, 3);
      const v = n * (1 - spec.contrast) + grain * spec.contrast;

      const r = spec.base[0] + (spec.tint[0] - spec.base[0]) * v;
      const g = spec.base[1] + (spec.tint[1] - spec.base[1]) * v;
      const b = spec.base[2] + (spec.tint[2] - spec.base[2]) * v;

      const i = (y * SIZE + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Cache of generated textures per terrain type.
const cache: Partial<Record<TerrainType, THREE.CanvasTexture>> = {};

export function getBiomeTexture(terrain: TerrainType): THREE.CanvasTexture {
  let tex = cache[terrain];
  if (!tex) {
    tex = makeTexture(SPECS[terrain]);
    cache[terrain] = tex;
  }
  return tex;
}
