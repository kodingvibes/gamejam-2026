// ─── Explosion System ────────────────────────────────────────────────────────
// Particle-based explosions. Epic = more particles, bigger spread, brighter.
// Each explosion also gets a soft bokeh sprite (camera-lens blur) at its core.

import * as THREE from 'three';
import { ObjectPool } from '../utils/ObjectPool';
import { CameraRig } from '../camera/CameraRig';

const PARTICLE_COUNT = 80;
const COLOR_MID = new THREE.Color(0xffcc44);
const COLOR_TIP = new THREE.Color(0x330011);
const _scratchBase = new THREE.Color();
const _scratchC = new THREE.Color();

// Shared soft bokeh texture (6-blade aperture diaphragm) — generated once.
let _bokehTexture: THREE.Texture | null = null;
function getBokehTexture(): THREE.Texture {
  if (_bokehTexture) return _bokehTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46; // hexagon circumradius

  // 6-blade aperture: a hexagon with slightly concave edges (blade overlap).
  const hex = new Path2D();
  const blades = 6;
  for (let i = 0; i < blades; i++) {
    const a0 = (i / blades) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / blades) * Math.PI * 2 - Math.PI / 2;
    const aMid = (a0 + a1) / 2;
    // Pull the midpoint inward to simulate blade curvature.
    const rMid = R * 0.82;
    const x0 = cx + Math.cos(a0) * R;
    const y0 = cy + Math.sin(a0) * R;
    const xm = cx + Math.cos(aMid) * rMid;
    const ym = cy + Math.sin(aMid) * rMid;
    const x1 = cx + Math.cos(a1) * R;
    const y1 = cy + Math.sin(a1) * R;
    if (i === 0) hex.moveTo(x0, y0);
    hex.quadraticCurveTo(xm, ym, x1, y1);
  }
  hex.closePath();

  // Soft radial falloff inside the hexagon.
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.85, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fill(hex);

  _bokehTexture = new THREE.CanvasTexture(canvas);
  return _bokehTexture;
}

interface Explosion {
  points: THREE.Points;
  velocities: Float32Array;
  timer: number;
  duration: number;
  active: boolean;
  color: THREE.Color;
  size: number;
  bokehs: THREE.Sprite[];
}

interface Shockwave {
  flash: THREE.Sprite;
  ring: THREE.Mesh;
  glow: THREE.Sprite; // bokeh-textured glow that follows the expanding ring
  timer: number;
  duration: number;
  active: boolean;
}

export class ExplosionSystem {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private cameraRig: CameraRig | null = null;
  private explosions: Explosion[] = [];
  private shockwaves: Shockwave[] = [];
  private pool: ObjectPool<THREE.Points>;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, cameraRig?: CameraRig, poolSize = 30) {
    this.scene = scene;
    this.camera = camera;
    this.cameraRig = cameraRig ?? null;
    this.pool = new ObjectPool<THREE.Points>(
      () => {
        const count = 80;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
        const mat = new THREE.PointsMaterial({
          size: 0.6, vertexColors: true, transparent: true, opacity: 1,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const points = new THREE.Points(geo, mat);
        points.visible = false; points.frustumCulled = false;
        return points;
      },
      (points) => { points.visible = false; },
      poolSize
    );
  }

  spawn(position: THREE.Vector3, size: number = 3, color: number = 0xff8844): void {
    this.spawnParticles(position, size, color, 1.0);
  }

  // Epic explosion: same 80 particles but bigger spread + brighter
  spawnEpic(position: THREE.Vector3, color: number = 0xff6600): void {
    this.spawnParticles(position, 8, color, 1.5);
  }

  // Nuclear explosion: a massive expanding shockwave ring + blinding flash +
  // huge particle burst that wipes out everything around it.
  spawnNuclear(position: THREE.Vector3, color: number = 0xffaa33): void {
    this.spawnParticles(position, 14, color, 2.2);
    this.spawnShockwave(position, color);
    this.shakeFromSize(14);
  }

  // Scale shake to explosion size. Small (size=3) → 0.15 / 0.15s, the biggest
  // hits (size=14) cap at 0.55 / 0.5s. CameraRig decays the intensity.
  private shakeFromSize(size: number): void {
    if (!this.cameraRig) return;
    const k = Math.min(1, size / 14);
    this.cameraRig.shake(0.12 + k * 0.4, 0.12 + k * 0.35);
  }

  // Expanding shockwave ring + flash for the nuclear blast.
  private spawnShockwave(pos: THREE.Vector3, color: number): void {
    // Blinding flash sprite.
    const flashMat = new THREE.SpriteMaterial({
      map: getBokehTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flash = new THREE.Sprite(flashMat);
    flash.position.copy(pos);
    flash.scale.set(22, 22, 1);
    this.scene.add(flash);

    // Expanding shockwave ring (torus).
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.8, 12, 48),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    ring.position.copy(pos);
    this.scene.add(ring);

    // Bokeh-textured glow that follows the expanding ring — a bright, soft
    // hexagonal flare so the shockwave reads as a blinding wall of light.
    const glowMat = new THREE.SpriteMaterial({
      map: getBokehTexture(),
      color,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(pos);
    glow.scale.set(5, 5, 1);
    this.scene.add(glow);

    this.shockwaves.push({ flash, ring, glow, timer: 0, duration: 1.2, active: true });
  }

  private spawnParticles(pos: THREE.Vector3, size: number, color: number, duration: number): void {
    const points = this.pool.acquire();
    const geo = points.geometry;

    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const colorAttr = geo.attributes.color as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;
    const colors = colorAttr.array as Float32Array;
    const baseColor = _scratchBase.setHex(color);
    const velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;

      const t = Math.random();
      const c = _scratchC;
      if (t < 0.3) {
        c.setRGB(1, 1, 0.8);
      } else if (t < 0.7) {
        c.lerpColors(COLOR_MID, baseColor, (t - 0.3) / 0.4);
      } else {
        c.lerpColors(baseColor, COLOR_TIP, (t - 0.7) / 0.3);
      }
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;

      const pSpeed = THREE.MathUtils.randFloat(10, size * 8);
      velocities[i * 3]     = Math.sin(phi) * Math.cos(theta) * pSpeed;
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * pSpeed;
      velocities[i * 3 + 2] = Math.cos(phi) * pSpeed;
    }

    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    points.position.set(0, 0, 0);
    points.visible = true;
    this.scene.add(points);

    this.explosions.push({ points, velocities, timer: 0, duration, active: true, color: baseColor, size, bokehs: this.createBokehs(pos, size, baseColor) });
  }

  // Multiple out-of-focus hexagonal bokeh points aligned linearly along the
  // angle between the light source and the center of the window (camera lens).
  // Bokeh closer to the window edge is larger; bokeh near the light point is
  // smaller — like a real camera lens flare / shallow depth-of-field.
  private createBokehs(pos: THREE.Vector3, size: number, color: THREE.Color): THREE.Sprite[] {
    const sprites: THREE.Sprite[] = [];

    // Project the light source onto the screen (NDC: -1..1).
    const ndc = pos.clone().project(this.camera);
    const cx = ndc.x;
    const cy = ndc.y;

    // Direction from screen center to the light point.
    const dirX = cx;
    const dirY = cy;
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const ux = dirX / len;
    const uy = dirY / len;

    // Real bokeh flare: the FIRST hexagon is GIANT, positioned toward the angle
    // from the window center to the light origin (near the light-point edge).
    // Then the chain reduces toward the opposite direction — the next one is
    // half the size, then the rest decay logarithmically — until reaching the
    // opposite edge of the screen.
    const count = 6;
    for (let i = 0; i < count; i++) {
      // t=0 at the light point, t=1 at the opposite edge of the window.
      const t = (i + 1) / count;
      // Distance from center: starts at the light point (len), passes through
      // the center (0), and continues to the opposite edge (-1.4).
      const distFromCenter = len - t * (len + 1.4);
      const bx = ux * distFromCenter;
      const by = uy * distFromCenter;

      // Unproject back to 3D at the explosion's depth.
      const world = new THREE.Vector3(bx, by, ndc.z).unproject(this.camera);

      // Size: first is giant, second is half, then logarithmic decay.
      let s: number;
      if (i === 0) {
        s = size * 3.2;          // giant
      } else if (i === 1) {
        s = size * 1.6;          // half of the giant
      } else {
        // Logarithmic decay from the second bokeh onward.
        s = size * 1.6 * Math.pow(0.5, Math.log2(i)); // 1.6, 0.8, 0.4, 0.2...
      }

      // Opacity follows the same curve as size: the biggest (giant) is the most
      // opaque, and it fades toward the smallest (most transparent). Overall
      // reduced 50% so the bokeh stays subtle.
      const opacity = 0.45 * (s / (size * 3.2));

      const mat = new THREE.SpriteMaterial({
        map: getBokehTexture(),
        color,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.copy(world);
      sprite.scale.set(s, s, 1);
      sprite.userData.baseOpacity = opacity;
      this.scene.add(sprite);
      sprites.push(sprite);
    }
    return sprites;
  }

  update(dt: number): void {
    // Particles only (no shockwaves/flashes to avoid GC pressure)
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      if (!exp.active) continue;
      exp.timer += dt;
      const progress = exp.timer / exp.duration;

      if (progress >= 1) {
        exp.active = false; exp.points.visible = false;
        for (const b of exp.bokehs) {
          b.visible = false;
          (b.material as THREE.SpriteMaterial).dispose();
          this.scene.remove(b);
        }
        this.pool.release(exp.points);
        this.explosions.splice(i, 1);
        continue;
      }

      const posAttr = exp.points.geometry.attributes.position as THREE.BufferAttribute;
      const positions = posAttr.array as Float32Array;
      const count = posAttr.count;
      const velocities = exp.velocities;

      for (let j = 0; j < count; j++) {
        positions[j * 3]     += velocities[j * 3] * dt;
        positions[j * 3 + 1] += velocities[j * 3 + 1] * dt;
        positions[j * 3 + 2] += velocities[j * 3 + 2] * dt;
        velocities[j * 3] *= 0.96;
        velocities[j * 3 + 1] *= 0.96;
        velocities[j * 3 + 2] *= 0.96;
        velocities[j * 3] += (Math.random() - 0.5) * dt * 4;
        velocities[j * 3 + 1] += (Math.random() - 0.5) * dt * 4;
      }
      posAttr.needsUpdate = true;

      const mat = exp.points.material as THREE.PointsMaterial;
      mat.opacity = (1 - progress) * (1 - progress); // quadratic fade
      mat.size = 0.6 * (1 - progress * 0.3);

      // Bokeh points fade out faster than the particles, preserving their
      // relative opacity (biggest = most opaque, smallest = most transparent).
      for (const b of exp.bokehs) {
        const bMat = b.material as THREE.SpriteMaterial;
        const base = (b.userData.baseOpacity as number) ?? 0.7;
        bMat.opacity = base * (1 - progress) * (1 - progress);
        b.scale.multiplyScalar(1 - progress * 0.4);
      }
    }

    // Update nuclear shockwaves: expanding ring + fading flash + bokeh glow.
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.timer += dt;
      const p = sw.timer / sw.duration;
      if (p >= 1) {
        sw.active = false;
        this.scene.remove(sw.flash);
        this.scene.remove(sw.ring);
        this.scene.remove(sw.glow);
        (sw.flash.material as THREE.SpriteMaterial).dispose();
        (sw.ring.material as THREE.Material).dispose();
        (sw.glow.material as THREE.SpriteMaterial).dispose();
        sw.ring.geometry.dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }
      // Ring expands outward.
      const scale = 1 + p * 40;
      sw.ring.scale.setScalar(scale);
      (sw.ring.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p);
      // Bokeh glow follows the ring, expanding with it and fading.
      sw.glow.scale.setScalar(6 + p * 240);
      (sw.glow.material as THREE.SpriteMaterial).opacity = 0.85 * (1 - p) * (1 - p);
      // Flash fades quickly.
      (sw.flash.material as THREE.SpriteMaterial).opacity = (1 - p) * (1 - p);
    }

  }

  reset(): void {
    for (const exp of this.explosions) {
      exp.points.visible = false;
      for (const b of exp.bokehs) {
        b.visible = false;
        (b.material as THREE.SpriteMaterial).dispose();
        this.scene.remove(b);
      }
      this.pool.release(exp.points);
    }
    this.explosions = [];
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.flash);
      this.scene.remove(sw.ring);
      (sw.flash.material as THREE.SpriteMaterial).dispose();
      (sw.ring.material as THREE.Material).dispose();
      sw.ring.geometry.dispose();
    }
    this.shockwaves = [];
  }

  dispose(): void {
    this.reset();
    this.pool.dispose();
  }
}