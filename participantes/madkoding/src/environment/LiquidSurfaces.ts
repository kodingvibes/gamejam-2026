// ─── Liquid Surfaces: reflective water and molten lava ──────────────────────
//
// One large plane that follows the camera. Its vertex shader lifts every
// vertex to the liquid level of the rail at that world Z (the valley floor
// rises and falls with the path), so lakes and lava seas sit correctly in the
// winding canyon. Shading is done in world space, so the plane can slide with
// the camera without the pattern swimming.
//
//   Water: multi-wave normals, Fresnel, reflection of the skybox photo
//          (equirect lookup), sun glint, depth tint, sparkle, distance fog.
//   Lava:  domain-warped flowing magma under a cracked basalt crust, pulsing
//          hot spots and HDR emission so the bloom pass makes it glow.

import * as THREE from 'three';
import type { LevelRailConfig } from '../levels/LevelData';

const SIZE = 5200;

const COMMON_VERT = /* glsl */ `
  uniform float uTime;
  uniform vec4 uRail;      // ampY, freqY*PI, length, levelOffset
  uniform float uHeave;
  varying vec3 vWorld;
  float railY(float z) {
    float t = -z / uRail.z;
    float f = uRail.y;
    return uRail.x * 1.7 * (sin(f * t) + 0.5 * sin(f * 1.9 * t + 0.7));
  }
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    w.y = railY(w.z) + uRail.w;
    w.y += (sin(w.x * 0.05 + uTime * 0.9) + sin(w.z * 0.043 - uTime * 0.7)) * uHeave;
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FOG = /* glsl */ `
  uniform vec3 uFogColor;
  uniform vec2 uFog;  // near, far
  vec3 applyFog(vec3 col, float dist) {
    float f = smoothstep(uFog.x, uFog.y, dist);
    return mix(col, uFogColor, f);
  }
`;

const WATER_FRAG = /* glsl */ `
  uniform float uTime;
  uniform sampler2D uSky;
  uniform float uHasSky;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uChop;
  uniform float uGlint;
  varying vec3 vWorld;
  ${FOG}

  // Analytic normal from a sum of directional waves.
  vec3 waveNormal(vec2 p) {
    vec2 g = vec2(0.0);
    vec2 dirs[5];
    dirs[0] = normalize(vec2(1.0, 0.3));
    dirs[1] = normalize(vec2(-0.6, 1.0));
    dirs[2] = normalize(vec2(0.2, -1.0));
    dirs[3] = normalize(vec2(-1.0, -0.4));
    dirs[4] = normalize(vec2(0.7, 0.7));
    float freqs[5]; freqs[0] = 0.11; freqs[1] = 0.17; freqs[2] = 0.31; freqs[3] = 0.53; freqs[4] = 0.9;
    float amps[5];  amps[0] = 0.9;  amps[1] = 0.6;  amps[2] = 0.35; amps[3] = 0.2;  amps[4] = 0.1;
    for (int i = 0; i < 5; i++) {
      float ph = dot(dirs[i], p) * freqs[i] + uTime * (0.8 + float(i) * 0.45);
      g += dirs[i] * cos(ph) * freqs[i] * amps[i];
    }
    return normalize(vec3(-g.x * uChop, 1.0, -g.y * uChop));
  }

  vec2 equirect(vec3 d) {
    float u = atan(d.z, -d.x) / 6.2831853;
    if (u < 0.0) u += 1.0;
    float v = 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.14159265;
    return vec2(u, v);
  }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453); }

  void main() {
    vec3 V = normalize(cameraPosition - vWorld);
    float dist = length(cameraPosition - vWorld);
    vec3 N = waveNormal(vWorld.xz);
    // Calm the normals with distance (avoids shimmering aliasing far away).
    N = normalize(mix(N, vec3(0.0, 1.0, 0.0), smoothstep(150.0, 1400.0, dist)));

    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 sky = uHasSky > 0.5 ? texture2D(uSky, equirect(R)).rgb : uFogColor;

    vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 0.6, 1.0 - V.y));
    // Reflection tinted by the water itself; capped so the body colour shows.
    vec3 refl = sky * mix(vec3(1.0), uShallow * 3.0, 0.35);
    vec3 col = mix(body, refl * 0.9, min(fres, 0.72));

    // Tight sun glint (strength per biome: none under storm clouds).
    float spec = pow(max(dot(R, uSunDir), 0.0), 900.0);
    col += uSunColor * spec * uGlint;

    col = applyFog(col, dist);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const LAVA_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vWorld;
  ${FOG}

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += noise(p) * a; p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
    return s;
  }
  // Cellular distance for crust plates.
  vec2 cells(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(hash(i + g), hash(i + g + 7.7));
      o = 0.5 + 0.4 * sin(uTime * 0.25 + 6.2831 * o);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
    return vec2(d1, d2);
  }

  void main() {
    vec2 p = vWorld.xz * 0.07;
    // Slow flow toward the camera with domain warping (molten turbulence).
    vec2 flow = vec2(0.0, uTime * 0.12);
    vec2 warp = vec2(fbm(p * 0.7 + flow), fbm(p * 0.7 - flow + 3.1));
    float heat = fbm(p * 1.3 + warp * 1.8 + flow * 1.5);

    vec2 c = cells(p * 1.6 + warp * 0.6);
    float crack = 1.0 - smoothstep(0.015, 0.07, c.y - c.x);    // glowing seams
    float crust = smoothstep(0.2, 0.5, heat) * (1.0 - crack);    // cooled plates

    vec3 magma = mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.85, 0.35), smoothstep(0.4, 0.9, heat));
    float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + heat * 12.0);
    vec3 col = magma * (1.1 + crack * 1.6) * pulse;
    // Crust edges stay warm (cooling gradient), centres go dark basalt.
    vec3 rock = mix(vec3(0.35, 0.07, 0.01), vec3(0.05, 0.025, 0.02), smoothstep(0.05, 0.6, crust));
    col = mix(col, rock, smoothstep(0.0, 0.25, crust) * 0.96);

    float dist = length(cameraPosition - vWorld);
    // Lava glows through the haze more than dull ground does.
    vec3 fogged = applyFog(col, dist);
    col = mix(fogged, col * 0.6 + uFogColor * 0.4, smoothstep(uFog.x, uFog.y, dist) * crack * 0.5);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class LiquidSurfaces {
  private mesh: THREE.Mesh;
  private waterMat: THREE.ShaderMaterial;
  private lavaMat: THREE.ShaderMaterial;
  private kind: 'water' | 'lava' | null = null;

  constructor(private scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, 24, 160);
    geo.rotateX(-Math.PI / 2);
    const common = () => ({
      uTime: { value: 0 },
      uRail: { value: new THREE.Vector4(2, Math.PI * 2, 1200, -10) },
      uHeave: { value: 0.25 },
      uFogColor: { value: new THREE.Color(0x88aacc) },
      uFog: { value: new THREE.Vector2(250, 2000) },
    });
    this.waterMat = new THREE.ShaderMaterial({
      vertexShader: COMMON_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: {
        ...common(),
        uSky: { value: null },
        uHasSky: { value: 0 },
        uDeep: { value: new THREE.Color(0x06263a) },
        uShallow: { value: new THREE.Color(0x1f6b7d) },
        uSunDir: { value: new THREE.Vector3(0.35, 0.6, -0.7).normalize() },
        uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
        uChop: { value: 1.0 },
        uGlint: { value: 1.2 },
      },
    });
    this.lavaMat = new THREE.ShaderMaterial({
      vertexShader: COMMON_VERT,
      fragmentShader: LAVA_FRAG,
      uniforms: common(),
    });
    this.mesh = new THREE.Mesh(geo, this.waterMat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = -10;
    scene.add(this.mesh);
  }

  configure(
    kind: 'water' | 'lava' | null,
    rail: LevelRailConfig,
    levelOffset: number,
    opts: { deep?: number; shallow?: number; chop?: number; glint?: number; sky?: THREE.Texture | null } = {},
  ): void {
    this.kind = kind;
    this.mesh.visible = kind !== null;
    if (!kind) return;
    const mat = kind === 'water' ? this.waterMat : this.lavaMat;
    this.mesh.material = mat;
    mat.uniforms.uRail.value.set(rail.amplitudeY, Math.PI * rail.frequencyY, rail.length, levelOffset);
    mat.uniforms.uHeave.value = kind === 'lava' ? 0.6 : 0.3;
    if (kind === 'water') {
      if (opts.deep !== undefined) this.waterMat.uniforms.uDeep.value.setHex(opts.deep);
      if (opts.shallow !== undefined) this.waterMat.uniforms.uShallow.value.setHex(opts.shallow);
      this.waterMat.uniforms.uChop.value = opts.chop ?? 1;
      this.waterMat.uniforms.uGlint.value = opts.glint ?? 1.2;
      this.setSky(opts.sky ?? null);
    }
  }

  setSky(tex: THREE.Texture | null): void {
    this.waterMat.uniforms.uSky.value = tex;
    this.waterMat.uniforms.uHasSky.value = tex ? 1 : 0;
  }

  setFog(color: THREE.Color, near: number, far: number): void {
    for (const m of [this.waterMat, this.lavaMat]) {
      m.uniforms.uFogColor.value.copy(color);
      m.uniforms.uFog.value.set(near, far);
    }
  }

  update(dt: number, camPos: THREE.Vector3): void {
    if (!this.kind) return;
    const mat = this.mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uTime.value += dt;
    this.mesh.position.set(camPos.x, 0, camPos.z - SIZE * 0.35);
  }

  setVisible(v: boolean): void {
    this.mesh.visible = v && this.kind !== null;
  }

  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.waterMat.dispose();
    this.lavaMat.dispose();
  }
}
