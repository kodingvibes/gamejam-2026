// ─── Post-Processing Pipeline ────────────────────────────────────────────────
//
// Render → GTAO (half-res) → Bloom (half-res, high threshold) → Cinematic pass → screen.
//
// The cinematic pass is driven every frame by FxDirector uniforms:
//   - radial chromatic aberration (pulses on hits / explosions)
//   - radial zoom blur (boost, warp jumps)
//   - flash (white or tinted), damage tint, low-health heartbeat vignette
//   - film grain + subtle scanlines for a CRT-cockpit feel

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';

// Ground-truth AO that only sees solid geometry: glows, sprites, particles,
// lasers and the sky sphere are hidden from its normal/depth pre-pass so they
// never cast dark halos. Runs its buffers at half resolution.
class SolidGTAOPass extends GTAOPass {
  overrideVisibility(): void {
    const cache = (this as unknown as { _visibilityCache: Map<THREE.Object3D, boolean> })._visibilityCache;
    this.scene.traverse((o) => {
      cache.set(o, o.visible);
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      const skip = (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite ||
        (m && (m.transparent || m.blending === THREE.AdditiveBlending || m.side === THREE.BackSide)) ||
        (o as THREE.InstancedMesh).isInstancedMesh && !(m as THREE.MeshStandardMaterial)?.isMeshStandardMaterial;
      if (skip) o.visible = false;
    });
  }

  setSize(width: number, height: number): void {
    super.setSize(Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
  }
}

export interface CinematicParams {
  aberration: number;   // 0..1+  radial RGB split strength
  zoomBlur: number;     // 0..1   radial blur strength
  flash: number;        // 0..1   additive flash amount
  flashColor: THREE.Color;
  damage: number;       // 0..1   red edge tint
  danger: number;       // 0..1   low-health heartbeat vignette
  vignette: number;     // base vignette darkness
  saturation: number;   // 1 = neutral
  bloom: number;        // bloom strength multiplier
}

const CinematicShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAberration: { value: 0 },
    uZoomBlur: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 1, 1) },
    uDamage: { value: 0 },
    uDanger: { value: 0 },
    uVignette: { value: 0.35 },
    uSaturation: { value: 1 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uZoomBlur;
    uniform float uFlash;
    uniform vec3 uFlashColor;
    uniform float uDamage;
    uniform float uDanger;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uAspect;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 sampleRGB(vec2 uv, vec2 dir, float amount) {
      vec2 off = dir * amount;
      return vec3(
        texture2D(tDiffuse, uv + off).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - off).b
      );
    }

    void main() {
      vec2 center = vUv - 0.5;
      float dist = length(center * vec2(uAspect, 1.0));
      vec2 dir = normalize(center + 1e-5);

      // Radial chromatic aberration: stronger toward the edges.
      float ca = (0.0012 + uAberration * 0.012) * smoothstep(0.0, 0.9, dist);
      vec3 col = sampleRGB(vUv, dir, ca);

      // Radial zoom blur (boost / warp). 8 taps toward the center.
      if (uZoomBlur > 0.001) {
        vec3 acc = col;
        float total = 1.0;
        float strength = uZoomBlur * 0.09 * smoothstep(0.05, 0.7, dist);
        for (int i = 1; i <= 8; i++) {
          float t = float(i) / 8.0;
          vec2 uv = vUv - center * strength * t;
          float w = 1.0 - t * 0.6;
          acc += sampleRGB(uv, dir, ca) * w;
          total += w;
        }
        col = acc / total;
      }

      // Saturation grading.
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, uSaturation);

      // Vignette (+ heartbeat pulse when health is critical).
      float beat = pow(abs(sin(uTime * 3.2)), 6.0) * uDanger;
      float vig = smoothstep(0.35, 1.05, dist);
      col *= 1.0 - vig * (uVignette + beat * 0.35);

      // Damage / danger tint on the edges.
      float edge = smoothstep(0.25, 0.95, dist);
      col = mix(col, col * vec3(1.4, 0.25, 0.3) + vec3(0.25, 0.0, 0.02), edge * clamp(uDamage + beat * 0.6, 0.0, 1.0));

      // Scanlines + grain.
      float scan = sin(vUv.y * 900.0) * 0.015;
      float grain = (hash(vUv * 1000.0 + fract(uTime * 7.0)) - 0.5) * 0.045;
      col += scan + grain;

      // Flash.
      col = mix(col, uFlashColor * 1.6, clamp(uFlash, 0.0, 1.0));

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class PostProcessingPipeline {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private aoPass: SolidGTAOPass;
  // Adaptive quality: AO switches off if the frame time stays high.
  private _frameAvg = 1 / 60;
  private _slowTime = 0;
  private cinematicPass: ShaderPass;
  private _time = 0;
  private baseBloom = 0.55;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.setPixelRatio(renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.composer.addPass(new RenderPass(scene, camera));

    this.aoPass = new SolidGTAOPass(scene, camera, width, height);
    this.aoPass.updateGtaoMaterial({ radius: 3.2, distanceExponent: 1.4, thickness: 3, scale: 1.25, samples: 12 });
    this.aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    this.aoPass.blendIntensity = 0.95;
    this.composer.addPass(this.aoPass);

    // Half-resolution bloom keeps the cost low while making every laser,
    // engine and explosion glow.
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, width / 2), Math.max(1, height / 2)),
      this.baseBloom, 0.4, 0.9,
    );
    this.composer.addPass(this.bloomPass);

    this.cinematicPass = new ShaderPass(CinematicShader);
    // No OutputPass on purpose: the scene's lighting was authored against the
    // composer's raw linear output (tone mapping never ran under the old
    // pipeline either), and ACES + sRGB here blows every biome out to white.
    this.composer.addPass(this.cinematicPass);
    this.setSize(width, height);
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(Math.max(1, width / 2), Math.max(1, height / 2));
    this.cinematicPass.uniforms.uAspect.value = width / Math.max(1, height);
  }

  apply(p: CinematicParams): void {
    const u = this.cinematicPass.uniforms;
    u.uAberration.value = p.aberration;
    u.uZoomBlur.value = p.zoomBlur;
    u.uFlash.value = p.flash;
    u.uFlashColor.value.copy(p.flashColor);
    u.uDamage.value = p.damage;
    u.uDanger.value = p.danger;
    u.uVignette.value = p.vignette;
    u.uSaturation.value = p.saturation;
    this.bloomPass.strength = this.baseBloom * p.bloom;
  }

  /** Enable/disable ambient occlusion (also used by the adaptive fallback). */
  get aoEnabled(): boolean { return this.aoPass.enabled; }

  setAO(on: boolean): void {
    this.aoPass.enabled = on;
  }

  render(delta: number): void {
    this._time += delta;
    // Adaptive quality: ~5 s under 38 fps turns AO off for the session.
    this._frameAvg = this._frameAvg * 0.95 + delta * 0.05;
    if (this.aoPass.enabled && this._time > 4) {
      this._slowTime = this._frameAvg > 1 / 38 ? this._slowTime + delta : 0;
      if (this._slowTime > 5) this.aoPass.enabled = false;
    }
    this.cinematicPass.uniforms.uTime.value = this._time;
    this.composer.render(delta);
  }

  dispose(): void {
    this.aoPass.dispose();
    this.bloomPass.dispose();
    this.composer.dispose();
  }
}
