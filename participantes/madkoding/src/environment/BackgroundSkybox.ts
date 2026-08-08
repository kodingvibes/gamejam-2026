// ─── Background Skybox: hyperrealistic photo backdrop per terrain ───────────
// A large inverted sphere (like the procedural skybox) textured with a real
// photograph matching the terrain's context. It surrounds the camera so the
// photo reads as the distant sky/horizon in every direction. Each terrain
// type loads its own image and the sphere is re-textured on terrain change.

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

export class BackgroundSkybox {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private camera: THREE.PerspectiveCamera;
  private textures: Partial<Record<TerrainType, THREE.Texture>> = {};
  private current: TerrainType = 'space';
  private loaded: Record<TerrainType, boolean> = {
    space: false, atmosphere: false, cave: false, nebula: false, storm: false,
    ice: false, lava: false, city: false, void: false, aurora: false,
  };

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.camera = camera;
    // Start with a neutral dark material until the first image loads.
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false, // the skybox is the backdrop; don't fog the photo itself
    });
    const geo = new THREE.SphereGeometry(500, 32, 16);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000; // behind everything, like the procedural sky
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
      () => { /* keep the previous texture on failure */ },
    );
  }

  private show(terrain: TerrainType): void {
    const tex = this.textures[terrain];
    if (!tex) return;
    this.material.map = tex;
    this.material.color.setHex(0xffffff);
    this.material.needsUpdate = true;
  }

  /** Switch the skybox to a terrain's image. */
  apply(terrain: TerrainType): void {
    if (terrain === this.current) return;
    this.current = terrain;
    if (this.loaded[terrain]) this.show(terrain);
  }

  /** Keep the skybox centered on the camera so it always surrounds the view. */
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
