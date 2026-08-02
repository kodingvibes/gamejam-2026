// ─── Fox Tail: fire trail that looks like a fox's bushy tail ────────────────
// Particle stream from the ship's rear that widens and curves, fading from
// white-hot core → yellow → orange → red → transparent, with a subtle sway
// that mimics a fox tail waving behind the ship.

import * as THREE from 'three';

const TAIL_PARTICLES = 80;
const TAIL_LENGTH = 4.5;     // how far back the tail extends
const TAIL_WIDTH_START = 0.15;
const TAIL_WIDTH_END = 1.2;  // bushy wide tip like a fox tail
const SWAY_FREQ = 4;
const SWAY_AMP = 0.35;

// Color gradient: hot core → orange → red tip (same rgb as the former
// THREE.Color(0xffffee / 0xff9933 / 0xff3311) constants, stored as Float32Array)
const LUT_HOT = new Float32Array([1, 1, 0.9333333333333333]); // white-hot
const LUT_MID = new Float32Array([1, 0.6, 0.2]);              // orange
const LUT_TIP = new Float32Array([1, 0.2, 0.06666666666666667]); // red

export class FoxTail {
  private points: THREE.Points;
  private positions: Float32Array;
  private colors: Float32Array;
  private ages: Float32Array;
  private phase = 0;
  private static readonly _c = new THREE.Color();

  constructor(parent: THREE.Group) {
    this.positions = new Float32Array(TAIL_PARTICLES * 3);
    this.colors = new Float32Array(TAIL_PARTICLES * 3);
    this.ages = new Float32Array(TAIL_PARTICLES);

    for (let i = 0; i < TAIL_PARTICLES; i++) {
      this.ages[i] = Math.random(); // stagger initial ages
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    // Ship's nose is at +Z, rear is at -Z. Tail extends backward (-Z).
    this.points.position.set(0, 0, -1.5);
    parent.add(this.points);
  }

  update(dt: number): void {
    this.phase += dt * SWAY_FREQ;

    for (let i = 0; i < TAIL_PARTICLES; i++) {
      // Each particle represents a segment along the tail (0 = base, 1 = tip)
      this.ages[i] += dt * 0.3;
      const t = (this.ages[i] % 1); // 0→1 cyclic position along tail

      // Width grows from narrow base to bushy tip (fox tail shape)
      const width = TAIL_WIDTH_START + (TAIL_WIDTH_END - TAIL_WIDTH_START) * t * t;

      // Z position: extends backward (negative Z in local space = behind ship)
      const z = -t * TAIL_LENGTH;

      // Sway: sinusoidal curve that increases toward the tip
      const sway = Math.sin(this.phase + t * 3) * SWAY_AMP * t;
      const bob = Math.cos(this.phase * 0.7 + t * 2) * SWAY_AMP * 0.5 * t;

      // Random scatter within the bushy radius
      const angle = (i / TAIL_PARTICLES) * Math.PI * 2 + this.phase * 0.5;
      const scatter = (1 - t) * 0.1 + t * 0.3;
      const ox = Math.cos(angle) * width * scatter;
      const oy = Math.sin(angle) * width * scatter;

      this.positions[i * 3]     = ox + sway;
      this.positions[i * 3 + 1] = oy + bob;
      this.positions[i * 3 + 2] = z;

      // Color: interpolate hot → mid → tip (continuous, no quantization LUT)
      const _c = FoxTail._c;
      if (t < 0.4) {
        const k = t / 0.4;
        _c.r = LUT_HOT[0] + (LUT_MID[0] - LUT_HOT[0]) * k;
        _c.g = LUT_HOT[1] + (LUT_MID[1] - LUT_HOT[1]) * k;
        _c.b = LUT_HOT[2] + (LUT_MID[2] - LUT_HOT[2]) * k;
      } else {
        const k = (t - 0.4) / 0.6;
        _c.r = LUT_MID[0] + (LUT_TIP[0] - LUT_MID[0]) * k;
        _c.g = LUT_MID[1] + (LUT_TIP[1] - LUT_MID[1]) * k;
        _c.b = LUT_MID[2] + (LUT_TIP[2] - LUT_MID[2]) * k;
      }
      // Fade alpha via color brightness at the very tip
      const fade = 1 - t * 0.7;
      this.colors[i * 3]     = _c.r * fade;
      this.colors[i * 3 + 1] = _c.g * fade;
      this.colors[i * 3 + 2] = _c.b * fade;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  setVisible(v: boolean): void {
    this.points.visible = v;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}