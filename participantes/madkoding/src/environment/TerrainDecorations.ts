// ─── Terrain Decorations: coherent environmental props per terrain type ─────
// Adds elements that make each place read as a real location:
//   - lava      → glowing lava rivers + ember particles
//   - ice       → frozen water sheets + ice crystals
//   - cave      → stalactites hanging from the ceiling + stalagmites
//   - atmosphere→ drifting clouds
//   - storm     → dark storm clouds + lightning flashes
//   - city      → glowing skyscraper towers
//   - nebula    → floating crystal shards
//   - aurora    → floating ice crystals
//   - space/void→ sparse asteroids
// Props are spawned in a band around the player and recycled as the ship
// flies toward -Z, so the world always feels populated ahead.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { terrainHeightAt } from './TerrainManager';
import { fbm } from '../utils/noise';

interface Prop {
  mesh: THREE.Object3D;
  kind: string;
}

interface DecorConfig {
  enabled: boolean;
  density: number;        // props per 1000 world units of travel
  kinds: string[];
}

const CONFIGS: Record<TerrainType, DecorConfig> = {
  space:      { enabled: true,  density: 6,  kinds: ['asteroid'] },
  atmosphere: { enabled: true,  density: 10, kinds: ['cloud'] },
  cave:       { enabled: true,  density: 14, kinds: ['stalactite', 'stalagmite'] },
  nebula:     { enabled: true,  density: 8,  kinds: ['crystal'] },
  storm:      { enabled: true,  density: 12, kinds: ['stormcloud'] },
  ice:        { enabled: true,  density: 12, kinds: ['water', 'icecrystal'] },
  lava:       { enabled: true,  density: 12, kinds: ['lava', 'ember'] },
  city:       { enabled: true,  density: 8,  kinds: ['tower'] },
  void:       { enabled: true,  density: 4,  kinds: ['asteroid'] },
  aurora:     { enabled: true,  density: 10, kinds: ['icecrystal'] },
};

// Spawn band: props appear between these z offsets ahead of the player.
const SPAWN_AHEAD_MIN = 40;
const SPAWN_AHEAD_MAX = 500;
const SPAWN_HALF_WIDTH = 150;

export class TerrainDecorations {
  private scene: THREE.Scene;
  private props: Prop[] = [];
  private animatedProps: { obj: THREE.Object3D; mat: THREE.ShaderMaterial }[] = [];
  private current: TerrainType = 'space';
  private config: DecorConfig = CONFIGS.space;
  private spawnAccum = 0;
  private lastSpawnZ = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  apply(terrain: TerrainType): void {
    if (terrain === this.current) return;
    this.current = terrain;
    this.config = CONFIGS[terrain];
    this.clearProps();
    this.spawnAccum = 0;
    this.lastSpawnZ = 0;
  }

  private clearProps(): void {
    for (const p of this.props) {
      this.scene.remove(p.mesh);
      this.disposeObject(p.mesh);
    }
    this.props = [];
    this.animatedProps = [];
  }

  private disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    if (!this.config.enabled) return;

    // Animate flowing lava / water shaders.
    for (const a of this.animatedProps) {
      a.mat.uniforms.uTime.value += dt;
    }

    // Spawn new props as the player advances.
    this.spawnAccum += dt;
    const travel = dt * 12; // rail speed
    this.lastSpawnZ -= travel;
    const interval = 1000 / this.config.density;
    while (this.spawnAccum * 12 >= interval) {
      this.spawnAccum -= interval / 12;
      this.spawnProp(playerPos);
    }

    // Recycle props that fall behind the camera.
    for (let i = this.props.length - 1; i >= 0; i--) {
      const p = this.props[i];
      if (p.mesh.position.z > playerPos.z + 30) {
        this.scene.remove(p.mesh);
        this.disposeObject(p.mesh);
        this.props.splice(i, 1);
      }
    }
    // Drop animated entries whose mesh was recycled.
    this.animatedProps = this.animatedProps.filter((a) => a.obj.parent !== null);
  }

  private spawnProp(playerPos: THREE.Vector3): void {
    const kind = this.config.kinds[Math.floor(Math.random() * this.config.kinds.length)];
    const z = playerPos.z - THREE.MathUtils.randFloat(SPAWN_AHEAD_MIN, SPAWN_AHEAD_MAX);
    const x = THREE.MathUtils.randFloat(-SPAWN_HALF_WIDTH, SPAWN_HALF_WIDTH);
    const mesh = this.buildProp(kind, x, z);
    if (!mesh) return;
    this.scene.add(mesh);
    this.props.push({ mesh, kind });
  }

  private buildProp(kind: string, x: number, z: number): THREE.Object3D | null {
    const y = terrainHeightAt(this.current, x, z);
    switch (kind) {
      case 'lava': return this.buildLavaRiver(x, y, z);
      case 'ember': return this.buildEmber(x, y, z);
      case 'water': return this.buildWater(x, y, z);
      case 'icecrystal': return this.buildIceCrystal(x, y, z);
      case 'stalactite': return this.buildStalactite(x, z);
      case 'stalagmite': return this.buildStalagmite(x, y, z);
      case 'cloud': return this.buildCloud(x, y, z);
      case 'stormcloud': return this.buildStormCloud(x, y, z);
      case 'tower': return this.buildTower(x, y, z);
      case 'crystal': return this.buildCrystal(x, y, z);
      case 'asteroid': return this.buildAsteroid(x, y, z);
      default: return null;
    }
  }

  // ── Lava ──────────────────────────────────────────────────────────────────
  // Flowing lava river: an animated shader that scrolls a bright molten
  // pattern along the travel axis (Z) so the river visibly flows forward.
  private buildLavaRiver(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const len = THREE.MathUtils.randFloat(80, 140);
    const width = THREE.MathUtils.randFloat(4, 8);
    const geo = new THREE.PlaneGeometry(width, len, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0xff2200) },
        uColorB: { value: new THREE.Color(0xffaa44) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vUv;
        void main() {
          // Flow along the length (v = travel axis).
          float flow = fract(vUv.y * 3.0 - uTime * 0.6);
          float band = smoothstep(0.0, 0.4, flow) * smoothstep(1.0, 0.6, flow);
          // Molten streaks across the width.
          float streak = sin(vUv.x * 40.0 + uTime * 2.0) * 0.5 + 0.5;
          vec3 col = mix(uColorA, uColorB, band * 0.7 + streak * 0.3);
          // Brighten the leading edge of each flow band.
          col += uColorB * band * 0.6;
          gl_FragColor = vec4(col, 0.95);
        }
      `,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = THREE.MathUtils.randFloat(-0.15, 0.15);
    plane.position.set(0, 0.5, 0);
    group.add(plane);
    group.position.set(x, y, z);
    // Animate the flow in update().
    this.animatedProps.push({ obj: group, mat });
    return group;
  }

  private buildEmber(x: number, y: number, z: number): THREE.Object3D {
    const count = 12;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = THREE.MathUtils.randFloat(-2, 2);
      positions[i * 3 + 1] = THREE.MathUtils.randFloat(0, 6);
      positions[i * 3 + 2] = THREE.MathUtils.randFloat(-2, 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffaa44, size: 0.4, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    points.position.set(x, y, z);
    return points;
  }

  // ── Ice / water ───────────────────────────────────────────────────────────
  // Flowing water river: animated shader that scrolls a shimmering surface
  // along the travel axis so the water visibly flows forward.
  private buildWater(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const len = THREE.MathUtils.randFloat(80, 140);
    const width = THREE.MathUtils.randFloat(8, 16);
    const geo = new THREE.PlaneGeometry(width, len, 1, 1);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColorA: { value: new THREE.Color(0x1a4a7a) },
        uColorB: { value: new THREE.Color(0x66ccff) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec2 vUv;
        void main() {
          // Flow along the length (v = travel axis).
          float flow = fract(vUv.y * 2.0 - uTime * 0.4);
          float band = smoothstep(0.0, 0.5, flow) * smoothstep(1.0, 0.5, flow);
          // Ripples across the width.
          float ripple = sin(vUv.x * 30.0 + uTime * 1.5) * 0.5 + 0.5;
          vec3 col = mix(uColorA, uColorB, band * 0.6 + ripple * 0.4);
          // Specular glints.
          col += uColorB * ripple * 0.4;
          gl_FragColor = vec4(col, 0.8);
        }
      `,
    });
    const plane = new THREE.Mesh(geo, mat);
    plane.rotation.x = -Math.PI / 2;
    plane.rotation.z = THREE.MathUtils.randFloat(-0.15, 0.15);
    plane.position.set(0, 0.4, 0);
    group.add(plane);
    group.position.set(x, y, z);
    this.animatedProps.push({ obj: group, mat });
    return group;
  }

  private buildIceCrystal(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const h = THREE.MathUtils.randFloat(3, 8);
    const geo = new THREE.ConeGeometry(0.8, h, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x88ccff, transparent: true, opacity: 0.85,
      roughness: 0.1, metalness: 0.3, emissive: 0x2266aa, emissiveIntensity: 0.4,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.y = h / 2;
    cone.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
    group.add(cone);
    group.position.set(x, y, z);
    return group;
  }

  // ── Cave ──────────────────────────────────────────────────────────────────
  private buildStalactite(x: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const h = THREE.MathUtils.randFloat(4, 10);
    const geo = new THREE.ConeGeometry(0.9, h, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5a4a3a, roughness: 0.95, metalness: 0.05,
    });
    const cone = new THREE.Mesh(geo, mat);
    // Ceiling is at wallTop (12). Hang from it pointing down.
    cone.position.y = 12 - h / 2;
    cone.rotation.x = Math.PI; // point down
    cone.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
    group.add(cone);
    group.position.set(x, 0, z);
    return group;
  }

  private buildStalagmite(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const h = THREE.MathUtils.randFloat(2, 6);
    const geo = new THREE.ConeGeometry(0.8, h, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x5a4a3a, roughness: 0.95, metalness: 0.05,
    });
    const cone = new THREE.Mesh(geo, mat);
    cone.position.y = h / 2;
    cone.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
    group.add(cone);
    group.position.set(x, y, z);
    return group;
  }

  // ── Clouds ────────────────────────────────────────────────────────────────
  private buildCloud(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff, transparent: true, opacity: 0.85,
      roughness: 1.0, metalness: 0.0, emissive: 0x888888, emissiveIntensity: 0.1,
    });
    const puffs = THREE.MathUtils.randInt(3, 5);
    for (let i = 0; i < puffs; i++) {
      const r = THREE.MathUtils.randFloat(4, 8);
      const geo = new THREE.SphereGeometry(r, 8, 6);
      const puff = new THREE.Mesh(geo, mat);
      puff.position.set(
        THREE.MathUtils.randFloat(-8, 8),
        THREE.MathUtils.randFloat(-2, 2),
        THREE.MathUtils.randFloat(-4, 4),
      );
      group.add(puff);
    }
    // Clouds float above the terrain.
    group.position.set(x, y + THREE.MathUtils.randFloat(20, 40), z);
    return group;
  }

  private buildStormCloud(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a, transparent: true, opacity: 0.9,
      roughness: 1.0, metalness: 0.0,
    });
    const puffs = THREE.MathUtils.randInt(4, 6);
    for (let i = 0; i < puffs; i++) {
      const r = THREE.MathUtils.randFloat(6, 12);
      const geo = new THREE.SphereGeometry(r, 8, 6);
      const puff = new THREE.Mesh(geo, mat);
      puff.position.set(
        THREE.MathUtils.randFloat(-10, 10),
        THREE.MathUtils.randFloat(-3, 3),
        THREE.MathUtils.randFloat(-6, 6),
      );
      group.add(puff);
    }
    group.position.set(x, y + THREE.MathUtils.randFloat(25, 45), z);
    return group;
  }

  // ── City ──────────────────────────────────────────────────────────────────
  private buildTower(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const h = THREE.MathUtils.randFloat(20, 45);
    const w = THREE.MathUtils.randFloat(3, 6);
    const geo = new THREE.BoxGeometry(w, h, w);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a, roughness: 0.7, metalness: 0.4,
      emissive: 0x224466, emissiveIntensity: 0.4,
    });
    const box = new THREE.Mesh(geo, mat);
    box.position.y = h / 2;
    group.add(box);
    // Window lights.
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const winCount = THREE.MathUtils.randInt(4, 8);
    for (let i = 0; i < winCount; i++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), lightMat);
      const side = Math.floor(Math.random() * 4);
      const wy = THREE.MathUtils.randFloat(2, h - 2);
      const wx = THREE.MathUtils.randFloat(-w / 2 + 1, w / 2 - 1);
      win.position.y = wy;
      if (side === 0) { win.position.set(wx, wy, w / 2 + 0.05); }
      else if (side === 1) { win.position.set(wx, wy, -w / 2 - 0.05); win.rotation.y = Math.PI; }
      else if (side === 2) { win.position.set(w / 2 + 0.05, wy, wx); win.rotation.y = Math.PI / 2; }
      else { win.position.set(-w / 2 - 0.05, wy, wx); win.rotation.y = -Math.PI / 2; }
      group.add(win);
    }
    group.position.set(x, y, z);
    return group;
  }

  // ── Nebula / aurora crystals ──────────────────────────────────────────────
  private buildCrystal(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const h = THREE.MathUtils.randFloat(3, 8);
    const geo = new THREE.OctahedronGeometry(1.2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8844aa, transparent: true, opacity: 0.8,
      roughness: 0.2, metalness: 0.5, emissive: 0x4422aa, emissiveIntensity: 0.6,
    });
    const crystal = new THREE.Mesh(geo, mat);
    crystal.scale.set(1, h / 2, 1);
    crystal.position.y = h / 2;
    crystal.rotation.y = THREE.MathUtils.randFloat(0, Math.PI * 2);
    group.add(crystal);
    group.position.set(x, y, z);
    return group;
  }

  // ── Asteroids (space / void) ──────────────────────────────────────────────
  private buildAsteroid(x: number, y: number, z: number): THREE.Object3D {
    const group = new THREE.Group();
    const r = THREE.MathUtils.randFloat(2, 6);
    const geo = new THREE.DodecahedronGeometry(r, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x555555, roughness: 1.0, metalness: 0.0,
    });
    const rock = new THREE.Mesh(geo, mat);
    rock.rotation.set(
      THREE.MathUtils.randFloat(0, Math.PI),
      THREE.MathUtils.randFloat(0, Math.PI),
      THREE.MathUtils.randFloat(0, Math.PI),
    );
    group.add(rock);
    group.position.set(x, y, z);
    return group;
  }

  reset(): void {
    this.apply('space');
  }

  dispose(): void {
    this.clearProps();
  }
}
