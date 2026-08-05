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

  private static hullMat(_color: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color: 0x889999 });
  }

  private static darkMat(): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color: 0x556666 });
  }

  private static accentMat(color: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color });
  }

  private static glow(color: number, opacity = 0.8): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  private static addEngineGlow(g: THREE.Group, x: number, y: number, z: number, color: number, r: number): void {
    const light = new THREE.PointLight(color, 400.0);
    light.position.set(x, y, z);
    light.distance = r * 60;
    light.decay = 1.5;
    g.add(light);
  }

  // Helper: create detailed wing with ribbing
  private static createDetailedWing(shape: THREE.Shape, depth: number, mat: THREE.Material): THREE.Mesh {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  // ── DRONE: octahedron core + ring + light ──
  private static drone(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);

    const core = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.8, 0), m);
    g.add(core);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.9, size * 0.08, 6, 12), this.accentMat(color));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);

    const coreLight = new THREE.PointLight(color, 300.0);
    coreLight.position.set(0, 0, -size * 0.4);
    coreLight.distance = size * 60;
    coreLight.decay = 1.5;
    g.add(coreLight);

    return g;
  }

  // ── SCOUT: arrow body + 2 wings + engine light ──
  private static scout(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);

    const body = new THREE.Mesh(new THREE.ConeGeometry(size * 0.4, size * 1.8, 5), m);
    body.rotation.x = Math.PI / 2;
    g.add(body);

    for (const x of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(size * 1.2, size * 0.08, size * 0.6), m);
      wing.position.set(x * size * 0.7, 0, size * 0.1);
      g.add(wing);
    }

    this.addEngineGlow(g, 0, 0, size * 1.0, color, size * 0.15);

    return g;
  }

  // ── FIGHTER: body + 2 wings + cockpit + engine light ──
  private static fighter(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);

    const body = new THREE.Mesh(new THREE.ConeGeometry(size * 0.5, size * 2.0, 6), m);
    body.rotation.x = Math.PI / 2;
    g.add(body);

    for (const x of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(size * 1.5, size * 0.1, size * 0.8), m);
      wing.position.set(x * size * 0.8, 0, size * 0.1);
      g.add(wing);
    }

    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.25, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2.5),
      new THREE.MeshPhongMaterial({ color: 0x66ccff, emissive: 0x2288cc, emissiveIntensity: 0.35, transparent: true, opacity: 0.65, shininess: 140 }),
    );
    cockpit.position.set(0, size * 0.2, -size * 0.2);
    g.add(cockpit);

    this.addEngineGlow(g, 0, 0, size * 1.2, color, size * 0.18);

    return g;
  }

  // ── INTERCEPTOR: twin hulls + center wing + engine light ──
  private static interceptor(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);

    for (const x of [-1, 1]) {
      const hull = new THREE.Mesh(new THREE.ConeGeometry(size * 0.3, size * 2.0, 5), m);
      hull.rotation.x = Math.PI / 2;
      hull.position.set(x * size * 0.5, 0, 0);
      g.add(hull);
    }

    const wing = new THREE.Mesh(new THREE.BoxGeometry(size * 2.0, size * 0.1, size * 0.5), m);
    g.add(wing);

    this.addEngineGlow(g, 0, 0, size * 1.3, color, size * 0.15);

    return g;
  }

  // ── BOMBER: bulky body + 2 wide wings + engine light ──
  private static bomber(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);

    const body = new THREE.Mesh(new THREE.BoxGeometry(size * 1.2, size * 0.8, size * 2.5), m);
    g.add(body);

    for (const x of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(size * 2.5, size * 0.12, size * 1.0), m);
      wing.position.set(x * size * 1.4, -size * 0.2, size * 0.2);
      g.add(wing);
    }

    const turret = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.3, size * 0.35, size * 0.3, 6), m);
    turret.position.set(0, size * 0.45, 0);
    g.add(turret);

    this.addEngineGlow(g, 0, 0, size * 1.5, color, size * 0.2);

    return g;
  }
}
