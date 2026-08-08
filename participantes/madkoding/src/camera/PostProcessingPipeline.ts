// ─── Post-Processing Pipeline ────────────────────────────────────────────────

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { AfterimagePass } from 'three/examples/jsm/postprocessing/AfterimagePass.js';

// Vignette + Chromatic Aberration shader
const VignetteChromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: new THREE.Vector2(0.0015, 0.0008) },
    darkness: { value: 0.3 },
    radius: { value: 0.85 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 offset;
    uniform float darkness;
    uniform float radius;
    varying vec2 vUv;

    void main() {
      // Chromatic aberration
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec4 color = vec4(r, g, b, 1.0);

      // Vignette
      vec2 center = vUv - 0.5;
      float dist = length(center);
      float vignette = smoothstep(radius, radius * 0.3, dist);
      color.rgb *= mix(1.0 - darkness, 1.0, vignette);

      gl_FragColor = color;
    }
  `,
};

export class PostProcessingPipeline {
  private composer: EffectComposer;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number
  ) {
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    // Motion blur (afterimage / trails)
    const afterimagePass = new AfterimagePass(0.7);
    this.composer.addPass(afterimagePass);

    // Vignette + Chromatic Aberration
    this.composer.addPass(new ShaderPass(VignetteChromaticAberrationShader));
  }

  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(delta: number): void {
    this.composer.render(delta);
  }

  dispose(): void {
    this.composer.dispose();
  }
}
