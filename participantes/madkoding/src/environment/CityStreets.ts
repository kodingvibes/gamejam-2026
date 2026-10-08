// ─── City: interior-mapped facades, the avenue and its street lights ────────
//
// Facades use three-fenestra's interior-mapping core (`glslCore`): every
// window on every tower is a parallax room from the starter atlas, lit or
// dark per window from a hash — all inside ONE instanced box material, no
// per-window geometry. The avenue under the rail is a streamed strip (asphalt,
// lane paint, raised sidewalks) with warm pools of light baked into its shader
// under each street lamp; lamps are instanced poles + bloom heads + soft light
// cones. Everything is built per terrain chunk, like the other props.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { glslCore } from 'three-fenestra';
import roomsUrl from 'three-fenestra/starter/rooms.webp?url';
import curtainsUrl from 'three-fenestra/starter/overlay.webp?url';
import { heightAt } from './TerrainField';
import { railAtZ } from './RailShape';

const railX = (z: number): number => railAtZ(z).x;

const ROAD_HALF = 10;      // asphalt half-width
const WALK_HALF = 21;      // sidewalk / plaza outer edge (towers start here)
const CURB = 0.4;          // sidewalk height
const LAMP_GAP = 30;       // lamps every 30 u, alternating sides
const LAMP_OFF = 12.8;     // pole offset from the rail
const ARM = 2.6;           // arm reach toward the road
const LAMP_H = 8.4;        // head height above the sidewalk
const SEG = 5;             // road strip resolution along z

// ── Shared clocks ───────────────────────────────────────────────────────────

const cityTime = { value: 0 };
const litRatio = { value: 0.4 };

/** Advance neon flicker / beacon blink. */
export function tickCity(dt: number): void { cityTime.value += dt; }

/**
 * Night falls over the stage: windows switch on one by one as `k` (stage
 * progress 0..1) grows — the per-window hash threshold makes it gradual.
 */
export function setCityNight(k: number): void {
  litRatio.value = 0.32 + 0.5 * THREE.MathUtils.clamp(k, 0, 1);
}

// ── Facade material (three-fenestra interior mapping) ──────────────────────

let facade: THREE.MeshStandardMaterial | null = null;

/** Tower material: frames + glass with parallax rooms behind every pane. */
export function getFacadeMaterial(): THREE.MeshStandardMaterial {
  if (facade) return facade;
  const rooms = new THREE.TextureLoader().load(roomsUrl);
  rooms.colorSpace = THREE.SRGBColorSpace;
  rooms.wrapS = rooms.wrapT = THREE.ClampToEdgeWrapping;
  rooms.anisotropy = 4;
  // Front layer: the starter curtain / blind atlas (alpha = fabric).
  const curtains = new THREE.TextureLoader().load(curtainsUrl);
  curtains.colorSpace = THREE.SRGBColorSpace;
  curtains.wrapS = curtains.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.MeshStandardMaterial({ color: 0x4a505c, roughness: 0.55, metalness: 0.35, envMapIntensity: 0.9 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uRooms = { value: rooms };
    sh.uniforms.uCurtains = { value: curtains };
    sh.uniforms.uLit = litRatio;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBLocal; varying vec3 vBNormal; varying vec3 vBCam; varying vec3 vBSeed; varying vec3 vBSc;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 bSc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
          mat4 bM = modelMatrix * instanceMatrix;
          vBSeed = instanceMatrix[3].xyz;
        #else
          vec3 bSc = vec3(1.0);
          mat4 bM = modelMatrix;
          vBSeed = vec3(0.0);
        #endif
        // Work in the tower's own frame, scaled back to world units.
        vBSc = bSc;
        vBLocal = position * bSc;
        vBNormal = normal;
        vBCam = (inverse(bM) * vec4(cameraPosition, 1.0)).xyz * bSc;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBLocal; varying vec3 vBNormal; varying vec3 vBCam; varying vec3 vBSeed; varying vec3 vBSc;
        uniform sampler2D uRooms; uniform sampler2D uCurtains; uniform float uLit;
        ${glslCore}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 imInterior = vec3(0.0);
        float imPane = 0.0;
        vec3 bN = abs(vBNormal);
        if (bN.y < 0.5) {
          // Face frame: u = rightwards as seen from outside, v = up, o = out.
          bool onX = bN.x > bN.z;
          float s = onX ? sign(vBNormal.x) : sign(vBNormal.z);
          float halfOut = onX ? abs(vBLocal.x) : abs(vBLocal.z);
          float u  = onX ? -vBLocal.z * s : vBLocal.x * s;
          float cu = onX ? -vBCam.z * s : vBCam.x * s;
          float co = (onX ? vBCam.x : vBCam.z) * s - halfOut;
          // Snap the window grid to the face edges (whole columns only).
          float faceW = onX ? vBSc.z : vBSc.x;
          u += faceW * 0.5;
          cu += faceW * 0.5;
          float faceId = onX ? (s > 0.0 ? 1.0 : 2.0) : (s > 0.0 ? 3.0 : 4.0);
          float seed = dot(vBSeed.xz, vec2(0.131, 0.071));
          float y = vBLocal.y;
          if (y < 4.2) {
            // Ground floor: a continuous lit storefront band.
            float band = smoothstep(0.6, 0.9, y) * (1.0 - smoothstep(3.4, 3.7, y));
            imPane = band;
            imInterior = vec3(1.0, 0.78, 0.5) * band * (0.35 + 0.35 * imHash(vec3(floor(u / 6.0), faceId, seed), 1.7));
          } else {
            float cw = faceW / max(1.0, floor(faceW / 3.6)), ch = 3.4;
            float ci = floor(u / cw), ri = floor((y - 4.2) / ch);
            float fu = fract(u / cw), fv = fract((y - 4.2) / ch);
            float pw = cw * 0.84, ph = ch * 0.76;
            float inPane = step(0.08, fu) * step(fu, 0.92) * step(0.12, fv) * step(fv, 0.88);
            if (inPane > 0.5) {
              float pcu = (ci + 0.5) * cw, pcv = 4.2 + (ri + 0.5) * ch;
              vec2 xy = vec2((u - pcu) / pw, (y - pcv) / ph);
              vec3 camL = vec3((cu - pcu) / pw, (vBCam.y - pcv) / ph, co / max(pw, ph));
              vec3 id = vec3(ci + faceId * 61.0, ri, seed);
              vec2 roomUV = imRoomBoxUV(camL, xy, 1.0, 0.66);
              vec3 room = texture2D(uRooms, imAtlasUV(roomUV, id, 4.0, 4.0, 0.0)).rgb;
              vec3 lit = imWindowEmissive(id, uLit, vec3(1.0, 0.82, 0.6), vec3(0.65, 0.85, 1.0), 0.22,
                                          vec2(0.55, 0.6), vec3(0.05, 0.06, 0.08));
              // Far away the parallax only aliases: fade to the window's flat tone.
              float far = smoothstep(260.0, 700.0, length(vBCam - vBLocal));
              vec3 inside = room * lit * 2.6;
              // About half the windows have curtains/blinds: backlit fabric
              // (transmission) over the room, a faint sheen when dark.
              if (imHash(id, 2.31) < 0.5) {
                vec4 cur = texture2D(uCurtains, imAtlasUV(xy + 0.5, id, 4.0, 4.0, 7.13));
                inside = mix(inside, cur.rgb * (lit * 1.5 + 0.03), cur.a * 0.92);
              }
              imInterior = mix(inside, lit * 0.8, far);
              imPane = 1.0;
            }
          }
          // Floor slabs: a thin lighter line between storeys.
          float sf = fract((y - 4.2) / 3.4);
          float slab = 1.0 - smoothstep(0.0, 0.05, min(sf, 1.0 - sf));
          diffuseColor.rgb *= 1.0 + slab * 0.25 * step(4.2, y);
        } else {
          diffuseColor.rgb *= 0.55;   // roofs
        }
        diffuseColor.rgb *= mix(1.0, 0.06, imPane);   // dark glass, specular stays`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.06, imPane);`)
      .replace('#include <opaque_fragment>', `outgoingLight += imInterior;
        #include <opaque_fragment>`);
  };
  facade = mat;
  return mat;
}

// ── Avenue ─────────────────────────────────────────────────────────────────

let roadMat: THREE.MeshStandardMaterial | null = null;

function roadTexture(): THREE.Texture {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const ux = (x: number) => ((x + WALK_HALF) / (2 * WALK_HALF)) * W;
  // Asphalt with grain.
  g.fillStyle = '#1b1c20';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    const v = 18 + Math.random() * 26;
    g.fillStyle = `rgb(${v},${v},${v + 3})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
  // Sidewalks: concrete slabs.
  for (const [a, b] of [[-WALK_HALF, -ROAD_HALF - 0.5], [ROAD_HALF + 0.5, WALK_HALF]]) {
    g.fillStyle = '#5c5d62';
    g.fillRect(ux(a), 0, ux(b) - ux(a), H);
    g.strokeStyle = 'rgba(20,20,24,0.55)';
    g.lineWidth = 1.5;
    for (let y = 0; y < H; y += H / 10) { g.beginPath(); g.moveTo(ux(a), y); g.lineTo(ux(b), y); g.stroke(); }
  }
  // Curbs.
  g.fillStyle = '#8a8b90';
  g.fillRect(ux(-ROAD_HALF - 0.5), 0, ux(-ROAD_HALF) - ux(-ROAD_HALF - 0.5), H);
  g.fillRect(ux(ROAD_HALF), 0, ux(ROAD_HALF + 0.5) - ux(ROAD_HALF), H);
  // Paint: solid edge lines, double yellow centre, dashed lane dividers.
  const line = (x: number, w: number, col: string, dash = false) => {
    g.fillStyle = col;
    const px = ux(x) - (w / (2 * WALK_HALF)) * W / 2;
    const pw = (w / (2 * WALK_HALF)) * W;
    if (dash) g.fillRect(px, 0, pw, H * 0.4);
    else g.fillRect(px, 0, pw, H);
  };
  line(-ROAD_HALF + 0.7, 0.22, '#a9a9a2');
  line(ROAD_HALF - 0.7, 0.22, '#a9a9a2');
  line(-0.22, 0.16, '#b98a1c');
  line(0.22, 0.16, '#b98a1c');
  line(-ROAD_HALF / 2, 0.16, '#a4a49c', true);
  line(ROAD_HALF / 2, 0.16, '#a4a49c', true);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function getRoadMaterial(): THREE.MeshStandardMaterial {
  if (roadMat) return roadMat;
  const mat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.5, metalness: 0, envMapIntensity: 0.7 });
  // Pools of sodium light under every lamp (alternating sides), plus a
  // slightly wet sheen inside them.
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aAcross;\nvarying float vAcross;\nvarying float vAlong;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAcross = aAcross;\nvAlong = position.z;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vAcross; varying float vAlong;
        float lampPool(float side, float phase) {
          float dz = mod(vAlong + phase, ${LAMP_GAP.toFixed(1)}) - ${(LAMP_GAP / 2).toFixed(1)};
          float dx = vAcross - side * ${(LAMP_OFF - ARM).toFixed(2)};
          return exp(-(dx * dx * 0.045 + dz * dz * 0.03));
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float pool = lampPool(1.0, ${(LAMP_GAP / 2).toFixed(1)}) + lampPool(-1.0, 0.0);
        roughnessFactor = mix(roughnessFactor, 0.28, clamp(pool, 0.0, 1.0));`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.66, 0.34) * pool * (0.1 + diffuseColor.rgb * 1.6);`);
  };
  roadMat = mat;
  return mat;
}

const COLS: [number, number][] = [
  [-WALK_HALF, CURB], [-ROAD_HALF - 0.5, CURB], [-ROAD_HALF, 0], [ROAD_HALF, 0], [ROAD_HALF + 0.5, CURB], [WALK_HALF, CURB],
];

/** Road surface height (asphalt) at world z. */
export function rowBase(z: number): number {
  const rx = railX(z);
  let h = -Infinity;
  for (let x = -WALK_HALF; x <= WALK_HALF; x += 6) h = Math.max(h, heightAt(rx + x, z));
  return h + 0.15;
}

function buildRoad(x0: number, z0: number, size: number): THREE.Mesh | null {
  const pos: number[] = [], uv: number[] = [], across: number[] = [];
  for (let z = z0; z < z0 + size - 1e-6; z += SEG) {
    const za = z, zb = Math.min(z + SEG, z0 + size);
    const xm = railX((za + zb) / 2);
    if (xm < x0 || xm >= x0 + size) continue;       // the neighbour chunk owns it
    const ra = railX(za), rb = railX(zb), ha = rowBase(za), hb = rowBase(zb);
    for (let i = 0; i < COLS.length - 1; i++) {
      const [xa0, ya0] = COLS[i], [xa1, ya1] = COLS[i + 1];
      const quad = [
        // CCW seen from above (z grows toward the camera).
        [ra + xa0, ha + ya0, za, xa0], [rb + xa1, hb + ya1, zb, xa1], [ra + xa1, ha + ya1, za, xa1],
        [ra + xa0, ha + ya0, za, xa0], [rb + xa0, hb + ya0, zb, xa0], [rb + xa1, hb + ya1, zb, xa1],
      ];
      for (const [x, y, zz, off] of quad) {
        pos.push(x, y, zz);
        across.push(off);
        uv.push((off + WALK_HALF) / (2 * WALK_HALF), -zz / LAMP_GAP);
      }
    }
  }
  if (!pos.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, getRoadMaterial());
  mesh.receiveShadow = true;
  mesh.userData.noCast = true;
  return mesh;
}

// ── Street lights ──────────────────────────────────────────────────────────

type LampSlot = { x: number; y: number; z: number; side: number };
const lampSets = new Set<LampSlot[]>();

/** Forget a disposed chunk's lamps (collision registry). */
export function releaseStreetObject(o: THREE.Object3D): void {
  const slots = o.userData.lampSlots as LampSlot[] | undefined;
  if (slots) lampSets.delete(slots);
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _cl = new THREE.Vector3();
function closestOnSegment(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const ab = _cl.subVectors(b, a);
  const t = THREE.MathUtils.clamp(ab.dot(out.subVectors(p, a)) / Math.max(1e-6, ab.lengthSq()), 0, 1);
  return out.copy(a).addScaledVector(ab, t);
}

/**
 * Ship vs street lights (pole + arm capsules). Returns the push direction
 * away from the lamp on contact, null otherwise.
 */
export function streetLampHit(p: THREE.Vector3, radius = 1.3): THREE.Vector3 | null {
  const c = new THREE.Vector3();
  for (const set of lampSets) {
    for (const s of set) {
      if (Math.abs(s.z - p.z) > 6 || Math.abs(s.x - p.x) > 8) continue;
      _a.set(s.x, s.y, s.z); _b.set(s.x, s.y + LAMP_H, s.z);
      closestOnSegment(p, _a, _b, c);
      if (c.distanceTo(p) < radius + 0.25) return new THREE.Vector3().subVectors(p, c).setY(0).normalize();
      _a.copy(_b); _b.set(s.x - s.side * ARM, s.y + LAMP_H, s.z);
      closestOnSegment(p, _a, _b, c);
      if (c.distanceTo(p) < radius + 0.3) return new THREE.Vector3().subVectors(p, c).normalize();
    }
  }
  return null;
}

let lampParts: { pole: THREE.BufferGeometry; head: THREE.BufferGeometry; cone: THREE.BufferGeometry;
  poleMat: THREE.Material; headMat: THREE.Material; coneMat: THREE.Material } | null = null;

function getLampParts() {
  if (lampParts) return lampParts;
  // Local frame: pole at the origin, arm reaching toward -x (the road).
  const post = new THREE.CylinderGeometry(0.12, 0.2, LAMP_H, 8);
  post.translate(0, LAMP_H / 2, 0);
  const arm = new THREE.BoxGeometry(ARM + 0.2, 0.14, 0.14);
  arm.translate(-ARM / 2, LAMP_H - 0.1, 0);
  const base = new THREE.CylinderGeometry(0.32, 0.38, 0.6, 8);
  base.translate(0, 0.3, 0);
  const pole = mergeGeometries([post.toNonIndexed(), arm.toNonIndexed(), base.toNonIndexed()])!;
  const head = new THREE.BoxGeometry(0.95, 0.18, 0.5);
  head.translate(-ARM, LAMP_H - 0.24, 0);
  const cone = new THREE.ConeGeometry(2.8, LAMP_H - 0.3, 20, 1, true);
  cone.translate(-ARM, (LAMP_H - 0.3) / 2, 0);
  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(1.0, 0.7, 0.38) } },
    vertexShader: /* glsl */ `
      varying float vH; varying float vFar;
      void main() {
        vH = uv.y;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vFar = 1.0 - smoothstep(250.0, 800.0, distance(wp.xyz, cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; varying float vH; varying float vFar;
      void main() { gl_FragColor = vec4(uColor * pow(vH, 1.6) * 0.09 * vFar, 1.0); }`,
  });
  lampParts = {
    pole, head, cone,
    poleMat: new THREE.MeshStandardMaterial({ color: 0x2c2f35, roughness: 0.5, metalness: 0.7 }),
    headMat: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.25) }),
    coneMat,
  };
  return lampParts;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

function buildLamps(x0: number, z0: number, size: number): THREE.InstancedMesh[] {
  const slots: LampSlot[] = [];
  const half = LAMP_GAP / 2;
  for (let k = Math.ceil(z0 / half); k * half < z0 + size; k++) {
    const z = k * half;
    const side = k % 2 === 0 ? 1 : -1;   // matches the road shader's pool phases
    const rx = railX(z);
    if (rx < x0 || rx >= x0 + size) continue;
    slots.push({ x: rx + side * LAMP_OFF, y: rowBase(z) + CURB, z, side });
  }
  if (!slots.length) return [];
  lampSets.add(slots);
  const P = getLampParts();
  const out = [
    new THREE.InstancedMesh(P.pole, P.poleMat, slots.length),
    new THREE.InstancedMesh(P.head, P.headMat, slots.length),
    new THREE.InstancedMesh(P.cone, P.coneMat, slots.length),
  ];
  slots.forEach((s, i) => {
    _q.setFromAxisAngle(_up, s.side > 0 ? 0 : Math.PI);
    _m.compose(_p.set(s.x, s.y, s.z), _q, _one);
    for (const im of out) im.setMatrixAt(i, _m);
  });
  for (const im of out) {
    im.userData.noCast = true;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
  }
  out[0].castShadow = true;
  out[0].userData.noCast = false;
  out[0].userData.lampSlots = slots;
  return out;
}

/** Road + lamps for one city chunk (empty when the avenue misses it). */
export function buildChunkStreet(x0: number, z0: number, size: number): THREE.Object3D[] {
  const road = buildRoad(x0, z0, size);
  return [...(road ? [road] : []), ...buildLamps(x0, z0, size)];
}

// ── Neon signs + rooftop beacons ───────────────────────────────────────────

const NEON_WORDS = ['HOTEL', 'BAR', 'FOX', '24H', 'CLUB', 'CAFE', 'MOTEL', 'NOODLE'];
const NEON_COLORS = [0xff2a6d, 0x05d9e8, 0xff9f1c, 0xb967ff, 0x39ff14, 0xfffb96, 0xff4d00, 0x01cdfe];

let neonTex: THREE.Texture | null = null;
function getNeonAtlas(): THREE.Texture {
  if (neonTex) return neonTex;
  const CW = 128, CH = 512;
  const c = document.createElement('canvas');
  c.width = CW * NEON_WORDS.length; c.height = CH;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  NEON_WORDS.forEach((w, i) => {
    const cx = i * CW + CW / 2;
    const step = Math.min(84, (CH - 70) / w.length);
    g.font = `bold ${Math.round(step * 0.86)}px Arial, sans-serif`;
    // Tube look: soft glow halo, then a bright thin core.
    g.shadowColor = '#fff';
    for (const [lw, a, blur] of [[9, 0.35, 22], [4, 1, 8]] as const) {
      g.shadowBlur = blur;
      g.strokeStyle = `rgba(255,255,255,${a})`;
      g.lineWidth = lw;
      [...w].forEach((ch, j) => g.strokeText(ch, cx, 35 + step * (j + 0.5) + (CH - 70 - step * w.length) / 2));
      g.strokeRect(i * CW + 10, 12, CW - 20, CH - 24);
    }
  });
  neonTex = new THREE.CanvasTexture(c);
  neonTex.anisotropy = 4;
  return neonTex;
}

let neonMat: THREE.ShaderMaterial | null = null;
function getNeonMaterial(): THREE.ShaderMaterial {
  if (neonMat) return neonMat;
  neonMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uAtlas: { value: getNeonAtlas() }, uTime: cityTime, uCells: { value: NEON_WORDS.length } },
    vertexShader: /* glsl */ `
      attribute float aCell; attribute vec3 aColor; attribute float aPhase;
      varying vec2 vUv; varying vec3 vColor; varying float vPhase; varying float vFar;
      uniform float uCells;
      void main() {
        vUv = vec2((uv.x + aCell) / uCells, uv.y);
        vColor = aColor; vPhase = aPhase;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vFar = 1.0 - smoothstep(450.0, 1100.0, distance(wp.xyz, cameraPosition));
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform float uTime;
      varying vec2 vUv; varying vec3 vColor; varying float vPhase; varying float vFar;
      void main() {
        float tube = texture2D(uAtlas, vUv).r;
        // A few signs buzz on and off; the rest breathe gently.
        float buzz = vPhase > 0.8 ? step(0.18, fract(sin(floor(uTime * 11.0) + vPhase * 91.0) * 43758.5)) : 1.0;
        float breathe = 0.85 + 0.15 * sin(uTime * 2.3 + vPhase * 40.0);
        gl_FragColor = vec4(vColor * tube * 2.4 * buzz * breathe * vFar, 1.0);
      }`,
  });
  return neonMat;
}

let beaconMat: THREE.ShaderMaterial | null = null;
function getBeaconMaterial(): THREE.ShaderMaterial {
  if (beaconMat) return beaconMat;
  beaconMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: cityTime },
    vertexShader: /* glsl */ `
      attribute float aPhase; varying float vBlink; uniform float uTime;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float x = fract(uTime * 0.55 + aPhase);
        vBlink = smoothstep(0.0, 0.04, x) * (1.0 - smoothstep(0.1, 0.18, x));
        gl_PointSize = clamp(1400.0 / -mv.z, 3.0, 22.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vBlink;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(2.6, 0.15, 0.08) * a * a * (0.12 + vBlink), 1.0);
      }`,
  });
  return beaconMat;
}

export interface TowerSlot { x: number; y: number; z: number; w: number; h: number; d: number; rot: number }

const _n = new THREE.Vector3(), _t = new THREE.Vector3(), _o = new THREE.Vector3();
const _sq = new THREE.Quaternion(), _ss = new THREE.Vector3();
const FACES: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Neon signs on the facades facing the avenue + red beacons on tall roofs. */
export function buildCityAccents(towers: TowerSlot[], rnd: () => number): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const signs: { m: THREE.Matrix4; cell: number; color: THREE.Color; phase: number }[] = [];
  const beacons: number[] = [], phases: number[] = [];
  for (const t of towers) {
    const toRail = Math.sign(railX(t.z) - t.x) || 1;
    if (t.h > 22 && rnd() < 0.5) {
      // Face whose outward normal best faces the avenue (and the camera).
      let best = 0, bestDot = -Infinity;
      FACES.forEach(([fx, fz], i) => {
        _n.set(fx, 0, fz).applyAxisAngle(_up, t.rot);
        const dot = _n.x * toRail + _n.z * 0.45;
        if (dot > bestDot) { bestDot = dot; best = i; }
      });
      const [fx, fz] = FACES[best];
      const halfOut = fx !== 0 ? t.w / 2 : t.d / 2;
      const span = fx !== 0 ? t.d : t.w;
      const sh = 7 + rnd() * 6, sw = sh * 0.26;
      const y = 6 + sh / 2 + rnd() * Math.max(0, Math.min(t.h - sh - 10, 28));
      _o.set(fx * (halfOut + 0.35), y, fz * (halfOut + 0.35));
      _t.set(-fz, 0, fx).multiplyScalar((rnd() - 0.5) * (span - sw - 2));
      _o.add(_t).applyAxisAngle(_up, t.rot).add(_p.set(t.x, t.y, t.z));
      _n.set(fx, 0, fz).applyAxisAngle(_up, t.rot);
      _sq.setFromAxisAngle(_up, Math.atan2(_n.x, _n.z));
      signs.push({
        m: new THREE.Matrix4().compose(_o, _sq, _ss.set(sw, sh, 1)),
        cell: Math.floor(rnd() * NEON_WORDS.length),
        color: new THREE.Color(NEON_COLORS[Math.floor(rnd() * NEON_COLORS.length)]),
        phase: rnd(),
      });
    }
    if (t.h > 45) {
      beacons.push(t.x, t.y + t.h + 0.8, t.z);
      phases.push(rnd());
    }
  }
  if (signs.length) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const cell = new Float32Array(signs.length), col = new Float32Array(signs.length * 3), ph = new Float32Array(signs.length);
    const im = new THREE.InstancedMesh(geo, getNeonMaterial(), signs.length);
    signs.forEach((s, i) => {
      im.setMatrixAt(i, s.m);
      cell[i] = s.cell; ph[i] = s.phase;
      col[i * 3] = s.color.r; col[i * 3 + 1] = s.color.g; col[i * 3 + 2] = s.color.b;
    });
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 1));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.userData.noCast = true;
    im.userData.ownGeo = true;
    out.push(im);
  }
  if (beacons.length) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(beacons, 3));
    geo.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    const pts = new THREE.Points(geo, getBeaconMaterial());
    pts.userData.ownGeo = true;
    out.push(pts);
  }
  return out;
}

// ── Traffic ────────────────────────────────────────────────────────────────

const CARS = 72;
const LANES = [2.5, 7.5, -2.5, -7.5];   // x > 0 flows with the ship (−z)
const AHEAD = 720, BEHIND = 70;
const CAR_COLORS = [0x8a1c1c, 0x1c3a8a, 0xd8d8d8, 0x202224, 0x2d6a3a, 0xb8a040, 0x5a5f66, 0x6a2a7a];

interface Car { lane: number; z: number; speed: number; base: number; baseT: number }

/**
 * Cars on the avenue: instanced bodies, HDR head/tail lights (bloom) and a
 * soft headlight pool on the asphalt in front of each car.
 */
export class CityTraffic {
  private bodies: THREE.InstancedMesh;
  private heads: THREE.InstancedMesh;
  private tails: THREE.InstancedMesh;
  private beams: THREE.InstancedMesh;
  private cars: Car[] = [];
  private active = false;
  private seeded = false;

  constructor(private scene: THREE.Scene) {
    const chassis = new THREE.BoxGeometry(1.9, 0.62, 4.4).translate(0, 0.52, 0);
    const cabin = new THREE.BoxGeometry(1.6, 0.52, 2.2).translate(0, 1.08, 0.25);
    const body = mergeGeometries([chassis, cabin])!;
    const lamp = (z: number) => mergeGeometries([
      new THREE.BoxGeometry(0.42, 0.16, 0.06).translate(-0.62, 0.6, z),
      new THREE.BoxGeometry(0.42, 0.16, 0.06).translate(0.62, 0.6, z),
    ])!;
    const beam = new THREE.PlaneGeometry(3.4, 9).rotateX(-Math.PI / 2).translate(0, 0.06, -6.8);
    this.bodies = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.65, envMapIntensity: 1.1 }), CARS);
    this.heads = new THREE.InstancedMesh(lamp(-2.22), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.0, 2.6) }), CARS);
    this.tails = new THREE.InstancedMesh(lamp(2.22), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.12, 0.08) }), CARS);
    this.beams = new THREE.InstancedMesh(beam, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; void main() {
        float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
        float along = vUv.y;   // 1 at the car, 0 at the far end
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * 0.22 * across * across * along * along, 1.0); }`,
    }), CARS);
    for (const im of [this.bodies, this.heads, this.tails, this.beams]) {
      im.frustumCulled = false;
      im.visible = false;
      im.userData.noCast = true;
      scene.add(im);
    }
    for (let i = 0; i < CARS; i++) {
      this.cars.push({ lane: LANES[i % LANES.length], z: 0, speed: 0, base: 0, baseT: 0 });
      this.bodies.setColorAt(i, new THREE.Color(CAR_COLORS[i % CAR_COLORS.length]));
    }
  }

  setActive(on: boolean): void {
    this.active = on;
    this.seeded = false;
    for (const im of [this.bodies, this.heads, this.tails, this.beams]) im.visible = on;
  }

  private respawn(c: Car, shipZ: number, anywhere: boolean): void {
    c.z = anywhere ? shipZ + BEHIND - Math.random() * (AHEAD + BEHIND) : shipZ - AHEAD + Math.random() * 120;
    c.speed = (c.lane > 0 ? 26 : 22) + Math.random() * 18;
    c.baseT = 0;
  }

  update(dt: number, shipZ: number): void {
    if (!this.active) return;
    if (!this.seeded) { for (const c of this.cars) this.respawn(c, shipZ, true); this.seeded = true; }
    this.cars.forEach((c, i) => {
      const dir = c.lane > 0 ? -1 : 1;
      c.z += dir * c.speed * dt;
      if (c.z < shipZ - AHEAD - 40 || c.z > shipZ + BEHIND) this.respawn(c, shipZ, false);
      c.baseT -= dt;
      if (c.baseT <= 0) { c.base = rowBase(c.z); c.baseT = 0.25 + (i % 5) * 0.03; }
      const slope = (railX(c.z - 1) - railX(c.z + 1)) / 2;   // dx per unit of −z travel
      const yaw = dir < 0 ? Math.atan(-slope) : Math.atan2(slope, -1);
      _q.setFromAxisAngle(_up, yaw);
      _m.compose(_p.set(railX(c.z) + c.lane, c.base, c.z), _q, _one);
      this.bodies.setMatrixAt(i, _m);
      this.heads.setMatrixAt(i, _m);
      this.tails.setMatrixAt(i, _m);
      this.beams.setMatrixAt(i, _m);
    });
    for (const im of [this.bodies, this.heads, this.tails, this.beams]) im.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const im of [this.bodies, this.heads, this.tails, this.beams]) {
      this.scene.remove(im);
      im.geometry.dispose();
      (im.material as THREE.Material).dispose();
      im.dispose();
    }
  }
}
