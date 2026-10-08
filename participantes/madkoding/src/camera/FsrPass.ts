// ─── FSR 1.0 upscaler pass (EASU + RCAS) ────────────────────────────────────
// GLSL port of AMD FidelityFX Super Resolution 1.0 (MIT):
//   EASU — Edge-Adaptive Spatial Upsampling: a 12-tap, edge-oriented
//          Lanczos-2 kernel that reconstructs the full-resolution frame from
//          the low-resolution render without the blur of bilinear.
//   RCAS — Robust Contrast-Adaptive Sharpening at output resolution, limited
//          per pixel so it never rings or over-sharpens flat areas.
// The scene and every effect run at `renderScale` × the screen; only these
// two cheap passes run at full resolution. Must be the composer's LAST pass.

import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const EASU_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uInputSize;    // low-res render, px
  uniform vec2 uOutputSize;   // screen, px
  varying vec2 vUv;

  vec3 fetch(vec2 p) {        // p = input pixel coords (integer = texel corner)
    return clamp(texture2D(tDiffuse, (p + 0.5) / uInputSize).rgb, 0.0, 1.0);
  }
  float luma(vec3 c) { return c.b * 0.5 + (c.r * 0.5 + c.g); }

  // Accumulate direction and edge length from one 2x2 quad (FsrEasuSetF).
  void easuSet(inout vec2 dir, inout float len, float w,
               float lA, float lB, float lC, float lD, float lE) {
    float dc = lD - lC, cb = lC - lB;
    float lenX = max(abs(dc), abs(cb));
    lenX = 1.0 / max(lenX, 1.0 / 32768.0);
    float dirX = lD - lB;
    dir.x += dirX * w;
    lenX = clamp(abs(dirX) * lenX, 0.0, 1.0);
    len += lenX * lenX * w;
    float ec = lE - lC, ca = lC - lA;
    float lenY = max(abs(ec), abs(ca));
    lenY = 1.0 / max(lenY, 1.0 / 32768.0);
    float dirY = lE - lA;
    dir.y += dirY * w;
    lenY = clamp(abs(dirY) * lenY, 0.0, 1.0);
    len += lenY * lenY * w;
  }

  // One filter tap (FsrEasuTapF): rotated/stretched approximate Lanczos-2.
  void easuTap(inout vec3 aC, inout float aW, vec2 off, vec2 dir, vec2 len2,
               float lob, float clp, vec3 c) {
    vec2 v = vec2(dot(off, dir), dot(off, vec2(-dir.y, dir.x))) * len2;
    float d2 = min(dot(v, v), clp);
    float wB = 2.0 / 5.0 * d2 - 1.0;
    float wA = lob * d2 - 1.0;
    wB *= wB; wA *= wA;
    wB = 25.0 / 16.0 * wB - (25.0 / 16.0 - 1.0);
    float w = wB * wA;
    aC += c * w; aW += w;
  }

  void main() {
    // Output pixel centre -> input pixel space.
    vec2 pp = vUv * uInputSize - 0.5;
    vec2 fp = floor(pp);
    pp -= fp;
    //    b c
    //  e f g h
    //  i j k l
    //    n o
    vec3 bC = fetch(fp + vec2( 0.0, -1.0)), cC = fetch(fp + vec2( 1.0, -1.0));
    vec3 eC = fetch(fp + vec2(-1.0,  0.0)), fC = fetch(fp + vec2( 0.0,  0.0));
    vec3 gC = fetch(fp + vec2( 1.0,  0.0)), hC = fetch(fp + vec2( 2.0,  0.0));
    vec3 iC = fetch(fp + vec2(-1.0,  1.0)), jC = fetch(fp + vec2( 0.0,  1.0));
    vec3 kC = fetch(fp + vec2( 1.0,  1.0)), lC = fetch(fp + vec2( 2.0,  1.0));
    vec3 nC = fetch(fp + vec2( 0.0,  2.0)), oC = fetch(fp + vec2( 1.0,  2.0));
    float bL = luma(bC), cL = luma(cC), eL = luma(eC), fL = luma(fC), gL = luma(gC), hL = luma(hC);
    float iL = luma(iC), jL = luma(jC), kL = luma(kC), lL = luma(lC), nL = luma(nC), oL = luma(oC);

    vec2 dir = vec2(0.0);
    float len = 0.0;
    easuSet(dir, len, (1.0 - pp.x) * (1.0 - pp.y), bL, eL, fL, gL, jL);
    easuSet(dir, len, pp.x * (1.0 - pp.y),         cL, fL, gL, hL, kL);
    easuSet(dir, len, (1.0 - pp.x) * pp.y,         fL, iL, jL, kL, nL);
    easuSet(dir, len, pp.x * pp.y,                 gL, jL, kL, lL, oL);

    float dirR = dot(dir, dir);
    bool zro = dirR < 1.0 / 32768.0;
    dirR = zro ? 1.0 : inversesqrt(dirR);
    dir.x = zro ? 1.0 : dir.x;
    dir *= dirR;
    len = len * 0.5;
    len *= len;
    float stretch = dot(dir, dir) / max(abs(dir.x), abs(dir.y));
    vec2 len2 = vec2(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
    float lob = 0.5 + ((1.0 / 4.0 - 0.04) - 0.5) * len;
    float clp = 1.0 / lob;

    vec3 aC = vec3(0.0);
    float aW = 0.0;
    easuTap(aC, aW, vec2( 0.0, -1.0) - pp, dir, len2, lob, clp, bC);
    easuTap(aC, aW, vec2( 1.0, -1.0) - pp, dir, len2, lob, clp, cC);
    easuTap(aC, aW, vec2(-1.0,  1.0) - pp, dir, len2, lob, clp, iC);
    easuTap(aC, aW, vec2( 0.0,  1.0) - pp, dir, len2, lob, clp, jC);
    easuTap(aC, aW, vec2( 0.0,  0.0) - pp, dir, len2, lob, clp, fC);
    easuTap(aC, aW, vec2(-1.0,  0.0) - pp, dir, len2, lob, clp, eC);
    easuTap(aC, aW, vec2( 1.0,  1.0) - pp, dir, len2, lob, clp, kC);
    easuTap(aC, aW, vec2( 2.0,  1.0) - pp, dir, len2, lob, clp, lC);
    easuTap(aC, aW, vec2( 2.0,  0.0) - pp, dir, len2, lob, clp, hC);
    easuTap(aC, aW, vec2( 1.0,  0.0) - pp, dir, len2, lob, clp, gC);
    easuTap(aC, aW, vec2( 1.0,  2.0) - pp, dir, len2, lob, clp, oC);
    easuTap(aC, aW, vec2( 0.0,  2.0) - pp, dir, len2, lob, clp, nC);

    // De-ring: clamp to the 2x2 neighbourhood.
    vec3 mn = min(min(fC, gC), min(jC, kC));
    vec3 mx = max(max(fC, gC), max(jC, kC));
    gl_FragColor = vec4(clamp(aC / aW, mn, mx), 1.0);
  }
`;

const RCAS_FRAG = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uSize;
  uniform float uSharpness;   // exp2(-stops): 1 = max, 0.5 = one stop softer
  varying vec2 vUv;
  #define RCAS_LIMIT (0.25 - (1.0 / 16.0))

  void main() {
    vec2 t = 1.0 / uSize;
    //    b
    //  d e f
    //    h
    vec3 b = texture2D(tDiffuse, vUv + vec2(0.0, -t.y)).rgb;
    vec3 d = texture2D(tDiffuse, vUv + vec2(-t.x, 0.0)).rgb;
    vec3 e = texture2D(tDiffuse, vUv).rgb;
    vec3 f = texture2D(tDiffuse, vUv + vec2(t.x, 0.0)).rgb;
    vec3 h = texture2D(tDiffuse, vUv + vec2(0.0, t.y)).rgb;
    vec3 mn4 = min(min(b, d), min(f, h));
    vec3 mx4 = max(max(b, d), max(f, h));
    // Largest negative lobe that keeps the result inside [0, 1].
    vec3 hitMin = mn4 / (4.0 * mx4 + 1e-5);
    vec3 hitMax = (1.0 - mx4) / (4.0 * mn4 - 4.0 - 1e-5);
    vec3 lobeRGB = max(-hitMin, hitMax);
    float lobe = max(-RCAS_LIMIT, min(max(lobeRGB.r, max(lobeRGB.g, lobeRGB.b)), 0.0)) * uSharpness;
    // Noise suppression: back off on isolated high-contrast pixels.
    float bL = b.b * 0.5 + (b.r * 0.5 + b.g), dL = d.b * 0.5 + (d.r * 0.5 + d.g);
    float eL = e.b * 0.5 + (e.r * 0.5 + e.g), fL = f.b * 0.5 + (f.r * 0.5 + f.g);
    float hL = h.b * 0.5 + (h.r * 0.5 + h.g);
    float nz = 0.25 * (bL + dL + fL + hL) - eL;
    float range = max(max(max(bL, dL), max(eL, fL)), hL) - min(min(min(bL, dL), min(eL, fL)), hL);
    nz = clamp(abs(nz) / max(range, 1e-5), 0.0, 1.0);
    lobe *= -0.5 * nz + 1.0;
    vec3 c = (lobe * (b + d + h + f) + e) / (4.0 * lobe + 1.0);
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

export class FsrPass extends Pass {
  private easu: THREE.ShaderMaterial;
  private rcas: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  private full: THREE.WebGLRenderTarget;
  private _size = new THREE.Vector2();

  /** @param sharpness RCAS strength in stops (0 = sharpest, 2 = soft). */
  constructor(sharpness = 0.25) {
    super();
    this.easu = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uInputSize: { value: new THREE.Vector2(1, 1) }, uOutputSize: { value: new THREE.Vector2(1, 1) } },
      vertexShader: VERT, fragmentShader: EASU_FRAG, depthTest: false, depthWrite: false,
    });
    this.rcas = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uSharpness: { value: Math.pow(2, -sharpness) } },
      vertexShader: VERT, fragmentShader: RCAS_FRAG, depthTest: false, depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.easu);
    this.full = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    // Output is always the full drawing buffer, whatever the composer size.
    renderer.getDrawingBufferSize(this._size);
    const w = this._size.x, h = this._size.y;
    if (this.full.width !== w || this.full.height !== h) this.full.setSize(w, h);

    // EASU: low-res -> full-res.
    this.easu.uniforms.tDiffuse.value = readBuffer.texture;
    this.easu.uniforms.uInputSize.value.set(readBuffer.width, readBuffer.height);
    this.easu.uniforms.uOutputSize.value.set(w, h);
    this.quad.material = this.easu;
    renderer.setRenderTarget(this.full);
    this.quad.render(renderer);

    // RCAS: sharpen at full res, straight to the screen.
    this.rcas.uniforms.tDiffuse.value = this.full.texture;
    this.rcas.uniforms.uSize.value.set(w, h);
    this.quad.material = this.rcas;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose(): void {
    this.easu.dispose();
    this.rcas.dispose();
    this.full.dispose();
    this.quad.dispose();
  }
}
