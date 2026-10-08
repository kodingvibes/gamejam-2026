// ─── Terrain Field: the height + colour function of every ground biome ──────
//
// The ground is shaped AROUND the rail: a valley/canyon follows the path the
// ship flies (so the landscape winds and dips with it), and ridged mountain
// ranges rise on both sides all the way to the horizon. Liquids (water, lava)
// fill the low parts of the valley.
//
// Everything here is pure CPU math so the chunked terrain, obstacles and
// decorations all agree on where the ground is.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { fbm } from '../utils/noise';
import { railAtZ } from './RailShape';

export type Liquid = 'water' | 'lava' | null;

export interface BiomeProfile {
  clearance: number;   // valley floor depth below the rail
  valley: number;      // half-width of the valley around the rail
  hillAmp: number;     // rolling hills inside the valley
  hillFreq: number;
  mountAmp: number;    // ridged mountains outside the valley
  mountFreq: number;
  liquid: Liquid;
  liquidOffset: number; // liquid level above the valley floor
  // Palette: valley floor → slopes → high rock → peaks; steep faces use rock.
  low: number; mid: number; high: number; peak: number; rock: number;
  snowLine: number;    // fraction of mountAmp where peaks turn to `peak`
  fog: number;         // fallback horizon colour (skybox sample overrides)
  roughness: number;
  terraces?: boolean;  // stepped mesas (lava basalt)
  flat?: boolean;      // city: levelled ground
}

export const GROUND_BIOMES: TerrainType[] = ['atmosphere', 'cave', 'storm', 'ice', 'lava', 'city'];

const P: Partial<Record<TerrainType, BiomeProfile>> = {
  atmosphere: {
    clearance: 16, valley: 40, hillAmp: 7, hillFreq: 0.012, mountAmp: 150, mountFreq: 0.0045,
    liquid: 'water', liquidOffset: 4,
    low: 0xc9b98a, mid: 0x4f8a3c, high: 0x6d6a5c, peak: 0xf4f7fb, rock: 0x6b665c, snowLine: 0.62,
    fog: 0x9cc4e4, roughness: 0.92,
  },
  storm: {
    clearance: 15, valley: 34, hillAmp: 9, hillFreq: 0.016, mountAmp: 170, mountFreq: 0.005,
    liquid: 'water', liquidOffset: 5,
    low: 0x5c5f62, mid: 0x4d5550, high: 0x6a6d74, peak: 0xb4bac2, rock: 0x4a4b50, snowLine: 0.7,
    fog: 0x3a3f48, roughness: 0.95,
  },
  ice: {
    clearance: 14, valley: 42, hillAmp: 6, hillFreq: 0.012, mountAmp: 165, mountFreq: 0.0048,
    liquid: 'water', liquidOffset: 3.5,
    low: 0xdfeefa, mid: 0xbcd8ee, high: 0x8fb2cf, peak: 0xffffff, rock: 0x6f8aa3, snowLine: 0.25,
    fog: 0xbcd6ea, roughness: 0.55,
  },
  lava: {
    clearance: 14, valley: 46, hillAmp: 10, hillFreq: 0.018, mountAmp: 140, mountFreq: 0.0055,
    liquid: 'lava', liquidOffset: 6,
    low: 0x2a1610, mid: 0x3a2018, high: 0x24140f, peak: 0x5a2a18, rock: 0x1b0f0b, snowLine: 1.2,
    fog: 0x5a1a08, roughness: 0.85, terraces: true,
  },
  cave: {
    clearance: 11, valley: 13, hillAmp: 3, hillFreq: 0.03, mountAmp: 70, mountFreq: 0.01,
    liquid: null, liquidOffset: 0,
    low: 0x4a3b2c, mid: 0x5a4a3a, high: 0x3e3226, peak: 0x6a5a48, rock: 0x3a2e22, snowLine: 1.2,
    fog: 0x120d08, roughness: 0.95,
  },
  city: {
    clearance: 18, valley: 60, hillAmp: 1.5, hillFreq: 0.01, mountAmp: 60, mountFreq: 0.004,
    liquid: null, liquidOffset: 0,
    low: 0x1c2230, mid: 0x262e40, high: 0x30384c, peak: 0x3a4458, rock: 0x20242e, snowLine: 1.2,
    fog: 0x141a2c, roughness: 0.8, flat: true,
  },
};

let current: TerrainType = 'space';
let profile: BiomeProfile | null = null;

export function setTerrainBiome(t: TerrainType): void {
  current = t;
  profile = P[t] ?? null;
}

export function getTerrainBiome(): TerrainType { return current; }
export function getBiomeProfile(): BiomeProfile | null { return profile; }
export function hasGround(): boolean { return profile !== null; }

function ridged(x: number, z: number, oct: number): number {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = fbm(x * freq + i * 17.3, z * freq - i * 9.1, 1);
    const r = 1 - Math.abs(n * 2 - 1);
    sum += r * r * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Valley floor height (no hills/mountains) at world z. */
export function floorAt(z: number): number {
  const p = profile;
  return railAtZ(z).y - (p ? p.clearance : 30);
}

/** Liquid surface height at world z (null if the biome has none). */
export function liquidAt(z: number): number | null {
  const p = profile;
  if (!p || !p.liquid) return null;
  return floorAt(z) + p.liquidOffset;
}

/** Ground height at world (x, z). */
export function heightAt(x: number, z: number): number {
  const p = profile;
  if (!p) return -60;
  const rail = railAtZ(z);
  const base = rail.y - p.clearance;
  const d = Math.abs(x - rail.x);

  let hills = (fbm(x * p.hillFreq, z * p.hillFreq, 4) - 0.5) * 2 * p.hillAmp;
  // Keep the strip right under the path a little lower so it never rises
  // into the flight lane.
  hills -= (1 - smoothstep(0, p.valley * 0.6, d)) * p.hillAmp * 0.5;
  if (p.flat) hills *= 0.3;

  const m = smoothstep(p.valley, p.valley + 160, d);
  let mountains = 0;
  if (m > 0) {
    const r = ridged(x * p.mountFreq, z * p.mountFreq, 5);
    mountains = (r * 0.85 + m * 0.35) * p.mountAmp * m;
    if (p.terraces) mountains = Math.floor(mountains / 9) * 9 + (mountains % 9) * 0.25;
    if (p.flat) mountains *= 0.35;
  }
  return base + hills + mountains;
}

const _c = new THREE.Color();
const _a = new THREE.Color();
const _b = new THREE.Color();

/**
 * Vertex colour for a ground point. `ny` is the surface normal's Y (1 = flat,
 * 0 = vertical cliff) so steep faces read as bare rock.
 */
export function colorAt(x: number, z: number, h: number, ny: number, out: THREE.Color): THREE.Color {
  const p = profile;
  if (!p) return out.setRGB(0.2, 0.2, 0.2);
  const rel = (h - floorAt(z)) / p.mountAmp;  // 0 at valley floor, ~1 at peaks
  const patch = fbm(x * 0.05, z * 0.05, 3);
  if (rel < 0.03) _c.setHex(p.low);
  else if (rel < 0.25) _c.setHex(p.low).lerp(_a.setHex(p.mid), smoothstep(0.03, 0.12, rel));
  else _c.setHex(p.mid).lerp(_a.setHex(p.high), smoothstep(0.25, 0.5, rel));
  if (rel > p.snowLine) _c.lerp(_b.setHex(p.peak), smoothstep(p.snowLine, p.snowLine + 0.12, rel + (patch - 0.5) * 0.1));
  // Cliffs: bare rock on steep faces.
  const steep = 1 - smoothstep(0.55, 0.85, ny);
  _c.lerp(_a.setHex(p.rock), steep * 0.85);
  // Organic patchiness.
  const v = 0.82 + patch * 0.36;
  return out.setRGB(_c.r * v, _c.g * v, _c.b * v);
}
