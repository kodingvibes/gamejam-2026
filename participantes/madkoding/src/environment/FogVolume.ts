// ─── Fog Volume: billboarded mist banks that read as volumetric fog ─────────
// Real volumetric fog (ray-marched volumes) is too expensive for a high-speed
// rail shooter. Instead we scatter large, soft radial-gradient sprites in a
// band around the player and recycle them as the ship flies toward -Z, exactly
// like the terrain segments. Flying through them reads as dense volumetric
// mist banks, and they layer on top of the scene's linear Fog for depth.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';

interface MistBank {
  sprite: THREE.Sprite;
  baseScale: number;
  driftSpeed: number;   // world units/s the bank drifts (parallax)
  phase: number;        // random phase for opacity flicker
}

// How many banks to keep alive and how far ahead they spawn.
const BANK_COUNT = 14;
const SPAWN_AHEAD_MIN = 80;
const SPAWN_AHEAD_MAX = 320;
const SPAWN_HALF_WIDTH = 110;
const SPAWN_HEIGHT_MIN = -20;
const SPAWN_HEIGHT_MAX = 24;

// Per-terrain tuning: how dense / how tinted the mist is.
const TERRAIN_MIST: Record<TerrainType, { density: number; tint: number; opacity: number }> = {
  space:      { density: 0.5,  tint: 0x8899cc, opacity: 0.07 },
  atmosphere: { density: 1.0,  tint: 0xffffff, opacity: 0.16 },
  cave:       { density: 0.8,  tint: 0x8a7a6a, opacity: 0.13 },
  nebula:     { density: 0.6,  tint: 0xaa66cc, opacity: 0.10 },
  storm:      { density: 1.2,  tint: 0x999999, opacity: 0.18 },
  ice:        { density: 0.9,  tint: 0xaaddff, opacity: 0.14 },
  lava:       { density: 0.7,  tint: 0xff8844, opacity: 0.11 },
  city:       { density: 0.5,  tint: 0x66ccff, opacity: 0.09 },
  void:       { density: 0.3,  tint: 0x333333, opacity: 0.06 },
  aurora:     { density: 0.6,  tint: 0x66ffcc, opacity: 0.10 },
};

// Shared soft radial-gradient texture (a soft round puff).
let _mistTexture: THREE.CanvasTexture | null = null;
function mistTexture(): THREE.CanvasTexture {
  if (_mistTexture) return _mistTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _mistTexture = new THREE.CanvasTexture(canvas);
  _mistTexture.needsUpdate = true;
  return _mistTexture;
}

export class FogVolume {
  private scene: THREE.Scene;
  private banks: MistBank[] = [];
  private current: TerrainType = 'space';
  private config = TERRAIN_MIST.space;
  private material: THREE.SpriteMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.SpriteMaterial({
      map: mistTexture(),
      color: new THREE.Color(this.config.tint),
      transparent: true,
      opacity: this.config.opacity,
      depthWrite: false,
      depthTest: true,
      blending: THREE.NormalBlending,
    });
    for (let i = 0; i < BANK_COUNT; i++) {
      const sprite = new THREE.Sprite(this.material);
      sprite.frustumCulled = false;
      this.scene.add(sprite);
      const bank: MistBank = {
        sprite,
        baseScale: THREE.MathUtils.randFloat(30, 80),
        driftSpeed: THREE.MathUtils.randFloat(2, 8),
        phase: Math.random() * Math.PI * 2,
      };
      this.banks.push(bank);
    }
    this.scatter(0, 0, 0);
  }

  /** Re-tint and re-tune the mist for a terrain type. */
  apply(terrain: TerrainType): void {
    if (terrain === this.current) return;
    this.current = terrain;
    this.config = TERRAIN_MIST[terrain];
    this.material.color.setHex(this.config.tint);
    this.material.opacity = this.config.opacity;
    this.material.needsUpdate = true;
  }

  /** Scatter all banks in a band around a world position. */
  private scatter(px: number, py: number, pz: number): void {
    for (const b of this.banks) {
      this.place(b, px, py, pz);
    }
  }

  private place(b: MistBank, px: number, py: number, pz: number): void {
    const z = pz - THREE.MathUtils.randFloat(SPAWN_AHEAD_MIN, SPAWN_AHEAD_MAX);
    const x = px + THREE.MathUtils.randFloat(-SPAWN_HALF_WIDTH, SPAWN_HALF_WIDTH);
    const y = py + THREE.MathUtils.randFloat(SPAWN_HEIGHT_MIN, SPAWN_HEIGHT_MAX);
    b.sprite.position.set(x, y, z);
    b.sprite.scale.setScalar(b.baseScale);
  }

  /** Follow the player: recycle banks that fall behind, drift for parallax. */
  update(dt: number, playerPos: THREE.Vector3): void {
    for (const b of this.banks) {
      // Parallax drift: banks slowly move toward the camera (opposite travel).
      b.sprite.position.z += b.driftSpeed * dt;
      // Gentle opacity flicker so the mist feels alive, not static.
      (b.sprite.material as THREE.SpriteMaterial).opacity =
        this.config.opacity * (0.75 + 0.25 * Math.sin(this.time + b.phase));
      // Recycle when the bank falls behind the camera.
      if (b.sprite.position.z > playerPos.z + 20) {
        this.place(b, playerPos.x, playerPos.y, playerPos.z);
      }
    }
  }

  private time = 0;

  dispose(): void {
    for (const b of this.banks) {
      this.scene.remove(b.sprite);
    }
    this.banks = [];
    this.material.dispose();
  }
}
