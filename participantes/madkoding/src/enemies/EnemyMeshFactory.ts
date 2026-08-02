// ─── Enemy Mesh Factory: builds distinct, detailed meshes per enemy type ────
// Each type has a unique silhouette with multiple parts, contrasting colors,
// and engine glows so they stand out against the starfield.

import * as THREE from 'three';

export class EnemyMeshFactory {
  static create(type: string, size: number, color: number): THREE.Group {
    switch (type) {
      case 'DRONE':       return this.drone(size, color);
      case 'SCOUT':       return this.scout(size, color);
      case 'FIGHTER':     return this.fighter(size, color);
      case 'INTERCEPTOR': return this.interceptor(size, color);
      case 'BOMBER':      return this.bomber(size, color);
      default:            return this.drone(size, color);
    }
  }

  private static hullMat(color: number): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.7, shininess: 60 });
  }

  private static darkMat(): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({ color: 0x223344, emissive: 0x112233, emissiveIntensity: 0.3, shininess: 40 });
  }

  private static accentMat(color: number): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.9, shininess: 80 });
  }

  private static glow(color: number, opacity = 0.8): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  private static addEngineGlow(g: THREE.Group, x: number, y: number, z: number, color: number, r: number): void {
    const glow = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), this.glow(color));
    glow.position.set(x, y, z);
    g.add(glow);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2, 8, 8), this.glow(color, 0.3));
    halo.position.set(x, y, z);
    g.add(halo);
  }

  // ── DRONE: octahedron core with rotating ring + 3 prongs ──
  private static drone(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();

    // Core body (octahedron)
    g.add(new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.8), m));

    // 3 prongs sticking out
    for (let idx = 0; idx < 3; idx++) {
      const angle = (idx / 3) * Math.PI * 2;
      const prong = new THREE.Mesh(new THREE.ConeGeometry(size * 0.15, size * 0.8, 4), dark);
      prong.position.set(Math.cos(angle) * size * 0.7, Math.sin(angle) * size * 0.7, 0);
      prong.rotation.z = angle - Math.PI / 2;
      g.add(prong);
    }

    // Ring around the core
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.9, size * 0.08, 6, 16), this.accentMat(color));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    // Bright center glow
    g.add(new THREE.Mesh(new THREE.SphereGeometry(size * 0.3, 10, 10), this.glow(color)));
    return g;
  }

  // ── SCOUT: sleek arrow with twin prongs and bright green engines ──
  private static scout(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();

    // Arrowhead body (4-sided cone = pyramid)
    const body = new THREE.Mesh(new THREE.ConeGeometry(size * 0.45, size * 1.8, 4), m);
    body.rotation.x = Math.PI / 2;
    body.rotation.z = Math.PI / 4;
    body.position.z = -size * 0.3;
    g.add(body);

    // Twin prongs (fork-like front)
    for (const x of [-1, 1]) {
      const prong = new THREE.Mesh(new THREE.ConeGeometry(size * 0.12, size * 0.9, 4), dark);
      prong.rotation.x = Math.PI / 2;
      prong.position.set(x * size * 0.5, 0, -size * 0.5);
      g.add(prong);
    }

    // Wings (delta shape, flat)
    const wingGeo = new THREE.BoxGeometry(size * 1.6, 0.06, size * 0.5);
    for (const x of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, m);
      w.position.set(x * size * 0.6, 0, size * 0.2);
      w.rotation.y = x * 0.4;
      g.add(w);
    }

    // Bright engine glows
    this.addEngineGlow(g, -size * 0.3, 0, size * 0.8, 0x00ffaa, size * 0.15);
    this.addEngineGlow(g, size * 0.3, 0, size * 0.8, 0x00ffaa, size * 0.15);
    return g;
  }

  // ── FIGHTER: classic X-wing style with 4 wings and cockpit ──
  private static fighter(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(0xffcc00);

    // Fuselage
    const body = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.3, size * 0.4, size * 1.5, 6), m);
    body.rotation.x = Math.PI / 2;
    g.add(body);

    // Nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.3, size * 0.8, 6), m);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -size * 1.1;
    g.add(nose);

    // 4 wings in X pattern
    const wingGeo = new THREE.BoxGeometry(size * 1.2, 0.06, size * 0.6);
    for (let idx = 0; idx < 4; idx++) {
      const angle = (idx / 4) * Math.PI * 2 + Math.PI / 4;
      const w = new THREE.Mesh(wingGeo, dark);
      w.position.set(Math.cos(angle) * size * 0.6, Math.sin(angle) * size * 0.6, size * 0.1);
      w.rotation.z = angle;
      g.add(w);
      // Wing tip cannon
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.04, size * 0.04, size * 0.3, 4), accent);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(Math.cos(angle) * size * 1.2, Math.sin(angle) * size * 1.2, size * 0.1);
      g.add(tip);
    }

    // Cockpit
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.accentMat(0x44ddff));
    cockpit.position.set(0, size * 0.2, -size * 0.3);
    g.add(cockpit);

    // Engine glow
    this.addEngineGlow(g, 0, 0, size * 0.9, 0xff8800, size * 0.18);
    return g;
  }

  // ── INTERCEPTOR: aggressive twin-hull design with blue engines ──
  private static interceptor(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(0x00ffff);

    // Central bridging wing
    const wing = new THREE.Mesh(new THREE.BoxGeometry(size * 1.4, 0.08, size * 0.6), m);
    g.add(wing);

    // Twin hulls (side booms)
    for (const x of [-1, 1]) {
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.2, size * 0.25, size * 1.4, 6), m);
      boom.rotation.x = Math.PI / 2;
      boom.position.set(x * size * 0.5, 0, 0);
      g.add(boom);

      // Nose on each boom
      const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.2, size * 0.5, 4), dark);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(x * size * 0.5, 0, -size * 0.9);
      g.add(nose);

      // Winglet on each boom
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(size * 0.6, size * 0.4, 0.06), dark);
      winglet.position.set(x * size * 0.5, size * 0.2, size * 0.1);
      winglet.rotation.z = x * 0.3;
      g.add(winglet);

      // Engine glow
      this.addEngineGlow(g, x * size * 0.5, 0, size * 0.8, 0x00ccff, size * 0.14);
    }

    // Central sensor pod
    const pod = new THREE.Mesh(new THREE.SphereGeometry(size * 0.18, 8, 8), accent);
    pod.position.set(0, size * 0.15, -size * 0.2);
    g.add(pod);
    return g;
  }

  // ── BOMBER: large heavy ship with wide wings and dual engines ──
  private static bomber(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(0xff00ff);

    // Wide rectangular hull
    const hull = new THREE.Mesh(new THREE.BoxGeometry(size * 1.0, size * 0.5, size * 1.6), m);
    g.add(hull);

    // Angular nose (wedge)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.5, size * 0.7, 4), m);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.z = Math.PI / 4;
    nose.position.z = -size * 1.1;
    g.add(nose);

    // Large swept wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(size * 2.0, size * 0.3);
    wingShape.lineTo(size * 1.8, -size * 0.5);
    wingShape.lineTo(0, -size * 0.3);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
    wingGeo.rotateX(-Math.PI / 2);
    for (const x of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, dark);
      w.scale.x = x;
      w.position.set(x * size * 0.4, -size * 0.1, 0);
      g.add(w);
    }

    // Top turret
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.25, size * 0.35, size * 0.3, 8), dark);
    turret.position.set(0, size * 0.35, 0);
    g.add(turret);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.06, size * 0.06, size * 0.4, 6), accent);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, size * 0.35, -size * 0.3);
    g.add(barrel);

    // Twin engines with glow
    for (const x of [-0.35, 0.35]) {
      const eng = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.18, size * 0.25, size * 0.6, 8), dark);
      eng.rotation.x = Math.PI / 2;
      eng.position.set(x * size, -size * 0.1, size * 1.0);
      g.add(eng);
      this.addEngineGlow(g, x * size, -size * 0.1, size * 1.4, 0xcc00ff, size * 0.16);
    }
    return g;
  }
}