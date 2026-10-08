// ─── Space Scenery: a planet on the horizon + an asteroid belt in depth ─────
//
// Space biomes used to be a flat starfield with nothing to judge distance or
// speed by. Now:
//   • a huge procedural planet sits near the horizon (follows the camera like
//     the skybox, so it reads as infinitely far), lit by the scene's sun, with
//     a Fresnel atmosphere and, for some biomes, rings;
//   • hundreds of tumbling asteroids (one InstancedMesh) fill a wide band
//     around the route at every depth, recycled as the ship advances, so
//     parallax sells the speed.

import * as THREE from 'three';
import type { TerrainType } from '../levels/LevelData';
import { asteroidGeometry } from './RockGeometry';

interface PlanetLook {
  a: number; b: number; c: number;    // surface palette
  atmo: number;                       // atmosphere rim colour
  bands: number;                      // 0 = continents, >0 = gas-giant bands
  ring: boolean;
  cracks: boolean;                    // glowing fractures (dead world)
  dir: [number, number, number];      // where it sits in the sky
  size: number;
}

const LOOKS: Partial<Record<TerrainType, PlanetLook>> = {
  space:  { a: 0x1b4f8a, b: 0x3f7f3a, c: 0xd8c9a0, atmo: 0x6ab8ff, bands: 0, ring: false, cracks: false, dir: [-0.55, -0.12, -1], size: 520 },
  nebula: { a: 0x7a3a9a, b: 0xd890c8, c: 0x3a1a5a, atmo: 0xff88ee, bands: 9, ring: true, cracks: false, dir: [0.6, 0.05, -1], size: 620 },
  void:   { a: 0x1a0a0a, b: 0x2a1410, c: 0x0a0505, atmo: 0xff3322, bands: 0, ring: false, cracks: true, dir: [-0.4, 0.1, -1], size: 460 },
  aurora: { a: 0xcfe8f5, b: 0x8fb8d0, c: 0xf5fbff, atmo: 0x66ffbb, bands: 3, ring: true, cracks: false, dir: [0.5, -0.05, -1], size: 560 },
};

const PLANET_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vLocal;
  varying vec3 vView;
  void main() {
    vLocal = normalize(position);
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vView = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const PLANET_FRAG = /* glsl */ `
  uniform vec3 uA, uB, uC, uAtmo, uSun;
  uniform float uBands, uCracks, uTime;
  varying vec3 vN;
  varying vec3 vLocal;
  varying vec3 vView;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(17.1, 113.7, 271.3))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float n000 = hash(i), n100 = hash(i + vec3(1,0,0)), n010 = hash(i + vec3(0,1,0)), n110 = hash(i + vec3(1,1,0));
    float n001 = hash(i + vec3(0,0,1)), n101 = hash(i + vec3(1,0,1)), n011 = hash(i + vec3(0,1,1)), n111 = hash(i + vec3(1,1,1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += noise(p) * a; p *= 2.07; a *= 0.5; } return s; }
  void main() {
    vec3 p = vLocal;
    vec3 col;
    if (uBands > 0.0) {
      float turb = fbm(p * 3.0 + vec3(uTime * 0.01, 0.0, 0.0));
      float band = sin(p.y * uBands * 3.14159 + turb * 4.0) * 0.5 + 0.5;
      col = mix(uA, uB, band);
      col = mix(col, uC, smoothstep(0.6, 0.9, turb));
    } else {
      float h = fbm(p * 2.2);
      col = h < 0.5 ? uA * (0.7 + h * 0.6) : mix(uB, uC, smoothstep(0.62, 0.8, h));
      float clouds = smoothstep(0.55, 0.75, fbm(p * 4.0 + vec3(uTime * 0.004)));
      col = mix(col, vec3(1.0), clouds * 0.7 * (1.0 - uCracks));
    }
    float light = max(dot(vN, uSun), 0.0);
    vec3 lit = col * (0.06 + light * 1.15);
    if (uCracks > 0.5) {
      float c = 1.0 - smoothstep(0.0, 0.035, abs(fbm(p * 5.0) - 0.5));
      lit += uAtmo * c * 1.6;
    }
    float rim = pow(1.0 - max(dot(vN, vView), 0.0), 3.0);
    lit += uAtmo * rim * (0.35 + light * 1.2);
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const BELT = 180;
const BELT_DEPTH = 1700;

interface Rock { pos: THREE.Vector3; rot: THREE.Euler; spin: THREE.Vector3; scale: number; variant: number }

export class SpaceScenery {
  private group = new THREE.Group();
  get object(): THREE.Object3D { return this.group; }
  private planet: THREE.Mesh;
  private planetMat: THREE.ShaderMaterial;
  private ring: THREE.Mesh;
  private belts: THREE.InstancedMesh[] = [];
  private rocks: Rock[] = [];
  private enabled = false;
  private time = 0;
  private offset = new THREE.Vector3();
  private _m = new THREE.Matrix4();
  private _q = new THREE.Quaternion();
  private _s = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {
    this.planetMat = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: {
        uA: { value: new THREE.Color() }, uB: { value: new THREE.Color() }, uC: { value: new THREE.Color() },
        uAtmo: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0.4, 0.5, 0.6).normalize() },
        uBands: { value: 0 }, uCracks: { value: 0 }, uTime: { value: 0 },
      },
    });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), this.planetMat);
    this.planet.renderOrder = -900;

    const ringGeo = new THREE.RingGeometry(1.35, 2.3, 128, 1);
    this.ring = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(0xffffff) } },
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying vec2 vP;
        void main(){ float r = length(vP);
          float bands = 0.55 + 0.45 * sin(r * 60.0) * sin(r * 23.0 + 1.3);
          float edge = smoothstep(1.35, 1.45, r) * (1.0 - smoothstep(2.15, 2.3, r));
          gl_FragColor = vec4(uColor * bands, edge * bands * 0.7); }`,
    }));
    this.ring.rotation.x = -Math.PI / 2 + 0.35;
    this.planet.add(this.ring);
    this.group.add(this.planet);

    // Asteroid belt: 3 instanced variants.
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0x5e5650, roughness: 0.95, flatShading: true });
    for (let v = 0; v < 3; v++) {
      const im = new THREE.InstancedMesh(asteroidGeometry(v + 10), mat, Math.ceil(BELT / 3));
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      this.belts.push(im);
      this.group.add(im);
    }
    for (let i = 0; i < BELT; i++) {
      this.rocks.push({ pos: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), scale: 1, variant: i % 3 });
    }
    this.group.visible = false;
    scene.add(this.group);
  }

  apply(terrain: TerrainType, camPos: THREE.Vector3): void {
    const look = LOOKS[terrain];
    this.enabled = !!look;
    this.group.visible = this.enabled;
    if (!look) return;
    const u = this.planetMat.uniforms;
    u.uA.value.setHex(look.a); u.uB.value.setHex(look.b); u.uC.value.setHex(look.c);
    u.uAtmo.value.setHex(look.atmo);
    u.uBands.value = look.bands;
    u.uCracks.value = look.cracks ? 1 : 0;
    this.offset.set(...look.dir).normalize().multiplyScalar(2300);
    this.planet.scale.setScalar(look.size);
    this.ring.visible = look.ring;
    (this.ring.material as THREE.ShaderMaterial).uniforms.uColor.value.setHex(look.atmo).lerp(new THREE.Color(0xffffff), 0.5);
    for (const r of this.rocks) this.placeRock(r, camPos, Math.random() * BELT_DEPTH);
  }

  // Wide band around the route, never inside the central flight corridor.
  private placeRock(r: Rock, cam: THREE.Vector3, ahead: number): void {
    const side = Math.random() < 0.5 ? -1 : 1;
    const lateral = side * THREE.MathUtils.randFloat(75, 600);
    r.pos.set(cam.x + lateral, cam.y + THREE.MathUtils.randFloat(-220, 200), cam.z - ahead);
    r.scale = Math.pow(Math.random(), 2.2) * 26 + 2;
    r.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    r.spin.set((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4);
  }

  update(dt: number): void {
    if (!this.enabled) return;
    this.time += dt;
    this.planetMat.uniforms.uTime.value = this.time;
    const cam = this.camera.position;
    this.planet.position.copy(cam).add(this.offset);
    this.planet.rotation.y += dt * 0.004;

    const counts = [0, 0, 0];
    for (const r of this.rocks) {
      r.rot.x += r.spin.x * dt;
      r.rot.y += r.spin.y * dt;
      r.rot.z += r.spin.z * dt;
      if (r.pos.z > cam.z + 60) this.placeRock(r, cam, BELT_DEPTH * THREE.MathUtils.randFloat(0.85, 1));
      this._q.setFromEuler(r.rot);
      this._s.setScalar(r.scale);
      this._m.compose(r.pos, this._q, this._s);
      const im = this.belts[r.variant];
      im.setMatrixAt(counts[r.variant]++, this._m);
    }
    this.belts.forEach((im, i) => { im.count = counts[i]; im.instanceMatrix.needsUpdate = true; });
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.planet.geometry.dispose();
    this.planetMat.dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
    for (const b of this.belts) b.dispose();
  }
}
