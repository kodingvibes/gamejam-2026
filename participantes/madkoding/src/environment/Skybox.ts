// ─── Skybox: 360° photo backdrop per terrain ────────────────────────────────
// A giant sphere surrounding the camera with an equirectangular photo texture.
// Each terrain type has its own hyperrealistic image that reads as the actual
// sky/environment. The sphere follows the camera so it always surrounds the view.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';

// Image per terrain (served from /backgrounds/<terrain>.jpg).
const IMAGE_PATHS: Record<TerrainType, string> = {
  space:      'backgrounds/space.jpg',
  atmosphere: 'backgrounds/atmosphere.jpg',
  cave:       'backgrounds/cave.jpg',
  nebula:     'backgrounds/nebula.jpg',
  storm:      'backgrounds/storm.jpg',
  ice:        'backgrounds/ice.jpg',
  lava:       'backgrounds/lava.jpg',
  city:       'backgrounds/city.jpg',
  void:       'backgrounds/void.jpg',
  aurora:     'backgrounds/aurora.jpg',
};

// Sky (top) and ground (bottom) colors for hemisphere light tinting.
const PALETTE: Record<TerrainType, { sky: THREE.Color; ground: THREE.Color }> = {
  space:      { sky: new THREE.Color(0x1a1a3a), ground: new THREE.Color(0x3a3a6a) },
  atmosphere: { sky: new THREE.Color(0x2a6ab0), ground: new THREE.Color(0xc0e8ff) },
  cave:       { sky: new THREE.Color(0x1a140e), ground: new THREE.Color(0x4a3a2a) },
  nebula:     { sky: new THREE.Color(0x2a1440), ground: new THREE.Color(0x7a4ab0) },
  storm:      { sky: new THREE.Color(0x2a2a2a), ground: new THREE.Color(0x6a6a6a) },
  ice:        { sky: new THREE.Color(0x1a2a4a), ground: new THREE.Color(0xa0d8ff) },
  lava:       { sky: new THREE.Color(0x2a0a00), ground: new THREE.Color(0xe06020) },
  city:       { sky: new THREE.Color(0x14142a), ground: new THREE.Color(0x3a5a7a) },
  void:       { sky: new THREE.Color(0x0a0a0a), ground: new THREE.Color(0x1a1a1a) },
  aurora:     { sky: new THREE.Color(0x142a3e), ground: new THREE.Color(0x3a8a6a) },
};

export function getEnvironmentColors(terrain: TerrainType): { sky: THREE.Color; ground: THREE.Color } {
  return PALETTE[terrain];
}

export class Skybox {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private camera: THREE.PerspectiveCamera;
  private current: TerrainType = 'space';
  private textures: Partial<Record<TerrainType, THREE.Texture>> = {};
  private loaded: Record<TerrainType, boolean> = {
    space: false, atmosphere: false, cave: false, nebula: false, storm: false,
    ice: false, lava: false, city: false, void: false, aurora: false,
  };

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;

    // Giant sphere that reads as the infinite sky. Must stay well inside the
    // camera's far plane (1000) or it gets clipped — 800 keeps it behind
    // everything while remaining visible.
    const geo = new THREE.SphereGeometry(800, 64, 32);
    this.material = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      fog: false, // skybox is never fogged
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000; // render first, behind everything
    scene.add(this.mesh);

    // Kick off loading for every terrain image.
    for (const t of Object.keys(IMAGE_PATHS) as TerrainType[]) {
      this.load(t);
    }
  }

  private load(terrain: TerrainType): void {
    const loader = new THREE.TextureLoader();
    loader.load(
      IMAGE_PATHS[terrain],
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.textures[terrain] = tex;
        this.loaded[terrain] = true;
        // If this is the active terrain, show it immediately.
        if (terrain === this.current) this.show(terrain);
      },
      undefined,
      () => { /* keep previous on failure */ },
    );
  }

  private show(terrain: TerrainType): void {
    const tex = this.textures[terrain];
    if (!tex) return;
    this.material.map = tex;
    this.material.needsUpdate = true;
  }

  /** Switch the skybox to a terrain's photo. */
  apply(terrain: TerrainType): void {
    if (terrain === this.current) return;
    this.current = terrain;
    if (this.loaded[terrain]) this.show(terrain);
  }

  /** Keep the skybox centered on the camera. */
  update(): void {
    this.mesh.position.copy(this.camera.position);
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    for (const t of Object.values(this.textures)) t?.dispose();
  }
}
