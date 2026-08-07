// ─── Background Corvettes (decorative large ships, off to the sides) ────────
// Corvettes stay FAR off the play field (|x| > 40) so they never block the
// ship's path. Some enemy formations spawn from behind a corvette.

import * as THREE from 'three';

interface Corvette {
  group: THREE.Group;
  speed: number;
  side: number; // -1 = left, +1 = right
  // Warp-in state
  warpIn: boolean;
  warpTimer: number;
  warpDuration: number;
  warpStartZ: number;
  warpEndZ: number;
  portal: THREE.Group;
  portalPulse: number;
  // Portal fadeout/zoomout after the corvette stops
  portalFading: boolean;
  portalFade: number; // 0..1, 1 = fully faded
  // Hold in place after warp-in before recycling
  holdTimer: number;
  holdDuration: number;
}

// A single ember orbiting the portal rim.
interface FireParticle {
  angle: number;
  radius: number;
  speed: number;   // angular speed (rad/s), sign = direction
  size: number;    // base size
  phase: number;   // random phase for flicker
  yOff: number;    // vertical wobble offset
}

let _modelTemplate: THREE.Group | null = null;
let _modelLoadPromise: Promise<THREE.Group | null> | null = null;

export class BackgroundShips {
  private scene: THREE.Scene;
  private corvettes: Corvette[] = [];
  // Expose positions so WaveManager can spawn enemies behind corvettes
  private _positions: THREE.Vector3[];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Pre-allocate a position buffer matching the corvette count (4)
    this._positions = [
      new THREE.Vector3(), new THREE.Vector3(),
      new THREE.Vector3(), new THREE.Vector3(),
    ];
    for (let i = 0; i < 4; i++) {
      const c = this.createCorvette(i);
      this.corvettes.push(c);
      this.scene.add(c.group);
    }
    // Kick off async model load. When ready, replace each corvette's body
    // (procedural mesh) with a clone of the GLB template.
    this.loadMothershipModel().then((tpl) => {
      if (!tpl) return;
      for (const c of this.corvettes) this.swapToModel(c, tpl);
    });
  }

  get positions(): THREE.Vector3[] { return this._positions; }

  private async loadMothershipModel(): Promise<THREE.Group | null> {
    if (_modelTemplate) return _modelTemplate;
    if (_modelLoadPromise) return _modelLoadPromise;
    _modelLoadPromise = (async () => {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');
        const loader = new GLTFLoader();
        const draco = new DRACOLoader();
        draco.setDecoderPath('./draco/');
        loader.setDRACOLoader(draco);
        const gltf = await loader.loadAsync('./models/mothership.glb');
        const model = gltf.scene;
        // The GLB ships a 90°-X node rotation that already orients the model
        // into the game's +Z-forward / +Y-up convention. We keep that baked
        // rotation (it maps the model's nose to +Z and the roof to +Y) and
        // only recenter + scale.
        // Recenter
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        // Size the GLB so its longest axis is ~16 units (matches procedural
        // hull length). The outer group is then scaled by 3 on warp-in/out.
        const size = box.getSize(new THREE.Vector3());
        const longest = Math.max(size.x, size.y, size.z) || 1;
        const s = 16 / longest;
        model.scale.setScalar(s);
        _modelTemplate = model;
        return model;
      } catch (err) {
        console.warn('[BackgroundShips] Failed to load mothership GLB, using procedural corvettes:', err);
        return null;
      }
    })();
    return _modelLoadPromise;
  }

  // Replace the procedural body inside c.group with a clone of the GLB model.
  // Keeps the warp-portal + blinking beacon (still children of c.group).
  private swapToModel(c: Corvette, tpl: THREE.Group): void {
    const clone = tpl.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        // Three's Object3D.clone() shares material/geometry refs with the
        // source. Mark them so dispose() doesn't double-free (4 corvettes +
        // template would all reference the same GPU resources).
        if (m.geometry) m.geometry.userData.fromGLB = true;
        const mat = m.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach(x => { x.userData.fromGLB = true; });
        else if (mat) mat.userData.fromGLB = true;
      }
    });
    c.group.add(clone);
    // The procedural body has no marker we can use to find it; the easiest
    // swap is to leave the procedural meshes in place until dispose is called.
    // They're small (cone + boxes) and invisible once the model is added at
    // a similar scale, but a clean replacement is better: drop everything
    // except the beacon + portal children.
    const keep = new Set<THREE.Object3D>();
    for (const child of c.group.children) {
      if (child.name === 'beacon' || child === clone) keep.add(child);
    }
    const removed: THREE.Object3D[] = [];
    for (const child of [...c.group.children]) {
      if (!keep.has(child)) { removed.push(child); c.group.remove(child); }
    }
    for (const r of removed) {
      r.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const m = child as THREE.Mesh;
          m.geometry?.dispose();
          const mat = m.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach(x => x.dispose()); else mat?.dispose();
        }
      });
    }
  }

  private createCorvette(index: number): Corvette {
    const group = new THREE.Group();
    const side = index % 2 === 0 ? -1 : 1;

    const hullMat = new THREE.MeshPhongMaterial({
      color: 0x8a9bb0, emissive: 0x445566, emissiveIntensity: 0.5, shininess: 50,
    });
    const darkMat = new THREE.MeshPhongMaterial({
      color: 0x6a7a8a, emissive: 0x334455, emissiveIntensity: 0.4, shininess: 40,
    });

    // ── Single hull: one stretched box (low-poly wedge) ──
    const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 16), hullMat);
    group.add(hull);

    // ── Bridge tower ──
    const tower = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 3), darkMat);
    tower.position.set(0, 1.5, -1);
    group.add(tower);

    // ── 4 running lights only (was 16) ──
    const lightGeo = new THREE.SphereGeometry(0.2, 5, 4);
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const z = -6 + t * 12;
      for (const dir of [-1, 1]) {
        const light = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({
          color: 0x00ffff, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        light.position.set(dir * 2, 0.5, z);
        group.add(light);
      }
    }

    // ── Single engine glow ──
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 6),
      new THREE.MeshBasicMaterial({
        color: 0x44aaff, transparent: true, opacity: 0.8,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    glow.position.set(0, 0, 8.5);
    glow.rotation.y = Math.PI;
    group.add(glow);

    // ── Blinking red beacon on top ──
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 6, 4),
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beacon.position.set(0, 3, -1);
    beacon.name = 'beacon';
    group.add(beacon);

    // ── Position: far off to the side, AHEAD of the player (z negative)
    // so enemies spawn in front and fly toward the player. Corvettes appear
    // far in the distance (more -Z) and warp in toward the camera.
    const xOff = side * THREE.MathUtils.randFloat(50, 90);
    const yOff = THREE.MathUtils.randFloat(-20, 30);
    const zOff = -THREE.MathUtils.randFloat(180, 320) - index * 50;
    group.scale.setScalar(3);
    group.position.set(xOff, yOff, zOff);

    // ── Warp portal: a glowing ring + swirling disc the corvette emerges from ──
    const portal = this.createPortal();
    portal.position.copy(group.position);
    this.scene.add(portal);

    return {
      group,
      speed: THREE.MathUtils.randFloat(3, 7),
      side,
      warpIn: true,
      warpTimer: 0,
      warpDuration: 2.2,
      warpStartZ: zOff,
      // Stop just in front of the portal (toward the camera) so the corvette's
      // tail stays near the portal it emerged from. Ship is ~48 units long
      // (scaled 3x), so center stops ~25 units ahead of the portal.
      warpEndZ: zOff + 25,
      portal,
      portalPulse: 0,
      portalFading: false,
      portalFade: 0,
      holdTimer: 0,
      holdDuration: THREE.MathUtils.randFloat(6, 10),
    };
  }

  // Build a dramatic warp portal: a ring of FIRE PARTICLES orbiting the rim.
  // The fire is a Points system (not literal cone rings) so it reads as a
  // swirling cloud of embers. Each particle uses a soft radial-glow sprite so
  // it reads as a glowing ember, not a hard dot.
  private createPortal(): THREE.Group {
    const portal = new THREE.Group();
    const R = 22;
    const COUNT = 160;

    // Soft radial glow sprite (white core → transparent edge) used as the
    // particle texture so each ember has a glow halo.
    const glowTex = this.createGlowTexture();

    // ── Fire particle cloud ──
    const positions = new Float32Array(COUNT * 3);
    const particles: FireParticle[] = [];
    for (let i = 0; i < COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const radius = R + (Math.random() - 0.5) * 7;
      particles.push({
        angle: a,
        radius,
        speed: (0.4 + Math.random() * 0.9) * (Math.random() < 0.5 ? -1 : 1),
        size: 0.7 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        yOff: (Math.random() - 0.5) * 2.5,
      });
      positions[i * 3] = Math.cos(a) * radius;
      positions[i * 3 + 1] = Math.sin(a) * radius;
      positions[i * 3 + 2] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 2.4,
      map: glowTex,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geo, mat);
    portal.add(points);
    portal.userData.particles = particles;
    portal.userData.points = points;
    portal.userData.pointGeo = geo;
    portal.userData.glowTex = glowTex;

    // ── Central fire glow: a soft additive sprite at the portal core so the
    // whole opening reads as a burning maw, not just a ring of dots. ──
    const core = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff6622,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    core.scale.setScalar(R * 1.6);
    portal.add(core);
    portal.userData.core = core;

    portal.visible = false;
    return portal;
  }

  // Build a small radial-gradient texture (white center → transparent edge)
  // used as the glow sprite for the fire particles and the portal core.
  private createGlowTexture(): THREE.Texture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,220,160,0.8)');
    g.addColorStop(0.7, 'rgba(255,140,60,0.35)');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    for (let i = 0; i < this.corvettes.length; i++) {
      const c = this.corvettes[i];

      // ── Warp-in sequence: emerge dramatically from a portal at warp speed ──
      if (c.warpIn) {
        c.warpTimer += dt;
        const p = Math.min(1, c.warpTimer / c.warpDuration);

        // Portal visible and pulsing while the corvette emerges. It expands
        // dramatically from a small point to full size (dramatic arrival).
        c.portal.visible = true;
        c.portalPulse += dt * 6;
        const pulse = 1 + Math.sin(c.portalPulse) * 0.12;
        const expand = THREE.MathUtils.lerp(0.2, 1, Math.min(1, p * 2.2));
        c.portal.scale.setScalar(expand * pulse);
        // Animate the fire particles orbiting the rim.
        this.animatePortalFlames(c.portal, dt, 1 - p * 0.5);

        // Corvette flies from the far background toward the camera (Z grows
        // from very negative to less negative). It scales up uniformly as it
        // approaches — no Z-stretch (that looked like gum).
        const warpZ = THREE.MathUtils.lerp(c.warpStartZ, c.warpEndZ, p);
        c.group.position.z = warpZ;
        const grow = THREE.MathUtils.lerp(0.4, 3, p);
        c.group.scale.setScalar(grow);

        if (p >= 1) {
          c.warpIn = false;
          c.group.scale.setScalar(3);
          c.holdTimer = 0;
          // Start the portal fadeout now that the corvette has stopped.
          c.portalFading = true;
          c.portalFade = 0;
        }
        // Record position for WaveManager to spawn enemies behind
        this._positions[i].copy(c.group.position);
        continue;
      }

      // Portal fadeout after the corvette stops. The fire particles collapse
      // INWARD (shrink toward the center) as they fade — the reverse of the
      // dramatic expansion on arrival.
      if (c.portalFading) {
        c.portalFade += dt / 0.8; // fade over 0.8s
        const f = Math.min(1, c.portalFade);
        // Shrink inward + fade out simultaneously.
        c.portal.scale.setScalar(1 - f * 0.8);
        this.animatePortalFlames(c.portal, dt, Math.max(0, 1 - f));
        if (f >= 1) c.portal.visible = false;
      }

      // Hold in place for a while after warp-in before drifting forward.
      if (c.holdTimer < c.holdDuration) {
        c.holdTimer += dt;
        this._positions[i].copy(c.group.position);
        continue;
      }

      // Drift slowly toward +Z (toward and past the player)
      c.group.position.z += c.speed * dt;

      // Beacon blink
      const beacon = c.group.getObjectByName('beacon');
      if (beacon) {
        (beacon as THREE.Mesh).visible = Math.floor(performance.now() * 0.003) % 2 === 0;
      }

      // Record position for WaveManager to spawn enemies behind
      this._positions[i].copy(c.group.position);

      // Recycle when it passes the player — reposition far ahead (more -Z).
      if (c.group.position.z > playerPos.z + 50) {
        const newZ = playerPos.z - THREE.MathUtils.randFloat(180, 320);
        c.group.position.set(
          c.side * THREE.MathUtils.randFloat(50, 90),
          THREE.MathUtils.randFloat(-20, 30),
          newZ
        );
        c.portal.position.copy(c.group.position);
        c.warpIn = true;
        c.warpTimer = 0;
        c.warpStartZ = newZ;
        c.warpEndZ = newZ + 25;
        c.holdTimer = 0;
      }
    }
  }

  // Flicker the portal's flame cones: per-frame scale + opacity jitter so the
  // ring of fire looks alive. `intensity` scales the whole effect (used to
  // fade out on exit).
  // Animate the portal's fire particle cloud: embers orbit the rim, flicker
  // in size/opacity, and the whole cloud fades with `intensity` (1 = full,
  // 0 = gone). The particles are a single THREE.Points system stored in
  // portal.userData.
  private animatePortalFlames(portal: THREE.Group, dt: number, intensity: number): void {
    const particles = portal.userData.particles as FireParticle[] | undefined;
    const points = portal.userData.points as THREE.Points | undefined;
    if (!particles || !points) return;

    const pos = points.geometry.attributes.position as THREE.BufferAttribute;
    const t = performance.now() * 0.001;
    const mat = points.material as THREE.PointsMaterial;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      // Orbit the rim.
      p.angle += p.speed * dt;
      // Vertical wobble so the cloud feels alive, not a flat ring.
      const wobble = Math.sin(t * 2 + p.phase) * p.yOff;
      pos.setXYZ(
        i,
        Math.cos(p.angle) * p.radius,
        Math.sin(p.angle) * p.radius + wobble,
        0,
      );
    }
    pos.needsUpdate = true;

    // Flicker the whole cloud: size + opacity scale with intensity.
    const flicker = 0.85 + Math.sin(t * 5) * 0.15;
    mat.size = 2.4 * flicker;
    mat.opacity = 0.95 * intensity;

    // Fade the central fire glow with intensity.
    const core = portal.userData.core as THREE.Sprite | undefined;
    if (core) {
      (core.material as THREE.SpriteMaterial).opacity = 0.55 * intensity;
      // Pulse the core so the burning maw breathes.
      const corePulse = 1 + Math.sin(t * 3) * 0.08;
      core.scale.setScalar(22 * 1.6 * corePulse);
    }
  }

  reset(): void {
    for (let i = 0; i < this.corvettes.length; i++) {
      const c = this.corvettes[i];
      const zOff = -THREE.MathUtils.randFloat(180, 320) - i * 50;
      c.group.position.set(
        c.side * THREE.MathUtils.randFloat(50, 90),
        THREE.MathUtils.randFloat(-20, 30),
        zOff
      );
      c.group.scale.setScalar(3);
      c.portal.position.copy(c.group.position);
      c.portal.visible = false;
      c.warpIn = true;
      c.warpTimer = 0;
      c.warpStartZ = zOff;
      c.warpEndZ = zOff + 25;
      c.holdTimer = 0;
    }
  }

  dispose(): void {
    const sharedGeoms = new Set<THREE.BufferGeometry>();
    const sharedMats = new Set<THREE.Material>();
    for (const c of this.corvettes) {
      this.scene.remove(c.group);
      c.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) sharedGeoms.add(child.geometry);
          const mat = child.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach(m => sharedMats.add(m));
          else if (mat) sharedMats.add(mat);
        }
      });
      this.scene.remove(c.portal);
      c.portal.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) sharedGeoms.add(child.geometry);
          const mat = child.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach(m => sharedMats.add(m));
          else if (mat) sharedMats.add(mat);
        } else if (child instanceof THREE.Points) {
          if (child.geometry) sharedGeoms.add(child.geometry);
          const mat = child.material as THREE.Material;
          if (mat) sharedMats.add(mat);
        }
      });
    }
    // Skip GLB-shared resources; only dispose procedurally-created ones.
    for (const g of sharedGeoms) {
      if (!g.userData.fromGLB) g.dispose();
    }
    for (const m of sharedMats) {
      if (!m.userData.fromGLB) m.dispose();
    }
    this.corvettes = [];
  }

  setVisible(visible: boolean): void {
    for (const c of this.corvettes) {
      c.group.visible = visible;
    }
  }
}

