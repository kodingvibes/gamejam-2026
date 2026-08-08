// ─── Background Image: hyperrealistic photo backdrop per terrain ────────────
// A large textured plane sits far ahead of the player (at the fog far plane)
// and shows a real photograph matching the terrain's context. It follows the
// player's Z so it always reads as the distant horizon, and it fades into the
// scene's linear fog so the photo blends seamlessly with the 3D world instead
// of looking pasted on. Each terrain type loads its own image.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';

// Distance ahead of the player where the backdrop sits (matches fog far).
const BACKDROP_Z = -300;
const BACKDROP_WIDTH = 900;
const BACKDROP_HEIGHT = 400;

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

export class BackgroundImage {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private textures: Partial<Record<TerrainType, THREE.Texture>> = {};
  private current: TerrainType = 'space';
  private loaded: Record<TerrainType, boolean> = {
    space: false, atmosphere: false, cave: false, nebula: false, storm: false,
    ice: false, lava: false, city: false, void: false, aurora: false,
  };

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Start with a neutral dark material until the first image loads.
    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false, // the backdrop is the fog target; don't fog the photo itself
    });
    const geo = new THREE.PlaneGeometry(BACKDROP_WIDTH, BACKDROP_HEIGHT);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(0, 0, BACKDROP_Z);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -500; // behind terrain, in front of skybox
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
    this.material.opacity = 1;
    this.material.needsUpdate = true;
  }

  /** Switch the backdrop to a terrain's image. */
  apply(terrain: TerrainType): void {
    if (terrain === this.current) return;
    this.current = terrain;
    if (this.loaded[terrain]) this.show(terrain);
  }

  /** Keep the backdrop centered on the player's X/Z so it always fills the view. */
  update(playerPos: THREE.Vector3): void {
    this.mesh.position.x = playerPos.x;
    this.mesh.position.z = playerPos.z + BACKDROP_Z;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    for (const t of Object.values(this.textures)) t?.dispose();
  }
}
