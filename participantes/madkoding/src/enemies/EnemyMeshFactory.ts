// ─── Enemy Mesh Factory: distinct, readable starfighter silhouettes ─────────
//
// Convention: +Z = nose (flight direction), +Y = up, ±X = wings.
// Every ship returns a Group whose userData carries the animated parts:
//   flames  — engine exhaust cones (flicker / throttle scale)
//   spin    — parts that rotate continuously ({ obj, axis, speed })
//   blink   — navigation lights that strobe
//   muzzles — local points where shots leave the ship
//   wings   — X-wing style panels that unfold on spawn ({ obj, open })
//
// Hulls are dark gunmetal with the type colour as emissive trim, so each class
// reads instantly against bright skyboxes and dark space alike.

import * as THREE from 'three';
import { getSoftParticleTexture } from '../fx/softTexture';

export interface EnemyRig {
  flames: THREE.Object3D[];
  spin: { obj: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }[];
  blink: THREE.Mesh[];
  muzzles: THREE.Vector3[];
  wings: { obj: THREE.Object3D; open: number; closed: number }[];
}

type Mats = {
  hull: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
};

export class EnemyMeshFactory {
  static create(type: string, size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const rig: EnemyRig = { flames: [], spin: [], blink: [], muzzles: [], wings: [] };
    g.userData.rig = rig;
    const m = this.mats(color);
    switch (type) {
      case 'SCOUT':       this.scout(g, rig, m, size, color); break;
      case 'FIGHTER':     this.fighter(g, rig, m, size, color); break;
      case 'INTERCEPTOR': this.interceptor(g, rig, m, size, color); break;
      case 'BOMBER':      this.bomber(g, rig, m, size, color); break;
      default:            this.drone(g, rig, m, size, color); break;
    }
    return g;
  }

  // ── Materials (per instance: hit flashes tint them individually) ─────────
  private static mats(color: number): Mats {
    return {
      hull: new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.45, metalness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x3c424e, roughness: 0.6, metalness: 0.25 }),
      trim: new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3, emissive: color, emissiveIntensity: 0.9 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x1a3550, roughness: 0.1, metalness: 0.4, emissive: color, emissiveIntensity: 0.5 }),
    };
  }

  // ── Geometry helpers ─────────────────────────────────────────────────────

  /** Lathe a fuselage along +Z from [radius, z] profile points (tail → nose). */
  private static fuselage(profile: [number, number][], mat: THREE.Material, segments = 10): THREE.Mesh {
    const pts = profile.map(([r, z]) => new THREE.Vector2(Math.max(0.001, r), z));
    const geo = new THREE.LatheGeometry(pts, segments);
    geo.rotateX(Math.PI / 2); // lathe Y axis → Z axis (nose = +Z)
    return new THREE.Mesh(geo, mat);
  }

  /** Extruded flat panel from [x, z] outline points, centred on y=0. */
  private static panel(outline: [number, number][], thickness: number, mat: THREE.Material): THREE.Mesh {
    const shape = new THREE.Shape();
    outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thickness, bevelEnabled: true, bevelThickness: thickness * 0.3,
      bevelSize: thickness * 0.3, bevelSegments: 1,
    });
    geo.rotateX(-Math.PI / 2); // shape XY → XZ plane, extrusion → +Y
    geo.translate(0, -thickness / 2, 0);
    return new THREE.Mesh(geo, mat);
  }

  /** Mirror across X. three.js flips face winding for negative-determinant
   *  transforms automatically, so a negative scale is all it takes. */
  private static mirror(mesh: THREE.Mesh): THREE.Mesh {
    const m = mesh.clone();
    m.scale.x = -mesh.scale.x;
    return m;
  }

  /** Engine nozzle + flickering exhaust flame pointing −Z. */
  private static engine(g: THREE.Group, rig: EnemyRig, m: Mats, x: number, y: number, z: number, r: number, color: number): void {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, r * 1.6, 10, 1, true), m.dark);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(x, y, z);
    g.add(nozzle);

    const core = new THREE.Mesh(new THREE.CircleGeometry(r * 0.75, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    core.position.set(x, y, z - r * 0.5);
    core.rotation.y = Math.PI;
    g.add(core);

    const flameGeo = new THREE.ConeGeometry(r * 0.8, r * 5, 10, 1, true);
    flameGeo.translate(0, -r * 2.5, 0);
    flameGeo.rotateX(Math.PI / 2); // tip toward −Z
    const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    flame.position.set(x, y, z - r * 0.6);
    g.add(flame);
    rig.flames.push(flame);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSoftParticleTexture(), color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.position.set(x, y, z - r * 0.8);
    halo.scale.setScalar(r * 5);
    g.add(halo);
    rig.flames.push(halo);
  }

  private static navLight(g: THREE.Group, rig: EnemyRig, x: number, y: number, z: number, color: number, r: number): void {
    const l = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
    l.position.set(x, y, z);
    g.add(l);
    rig.blink.push(l);
  }

  // ── DRONE: sentinel orb with a spinning blade ring and a single red eye ───
  private static drone(g: THREE.Group, rig: EnemyRig, m: Mats, s: number, color: number): void {
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.7, 1), m.hull);
    body.scale.set(1, 0.8, 1.15);
    g.add(body);

    const band = new THREE.Mesh(new THREE.TorusGeometry(s * 0.72, s * 0.06, 6, 24), m.trim);
    g.add(band);

    const ring = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const blade = this.panel([[0, -0.15 * s], [1.4 * s, -0.45 * s], [1.5 * s, 0.05 * s], [0, 0.2 * s]], s * 0.06, m.dark);
      blade.rotation.z = (i / 3) * Math.PI * 2;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(s * 0.12, s * 0.12, s * 0.5), m.trim);
      tip.position.set(1.45 * s, 0, -0.2 * s);
      blade.add(tip);
      ring.add(blade);
    }
    ring.rotation.x = Math.PI / 2;
    const spinner = new THREE.Group();
    spinner.add(ring);
    g.add(spinner);
    rig.spin.push({ obj: spinner, axis: 'z', speed: 4.5 });

    const eye = new THREE.Mesh(new THREE.SphereGeometry(s * 0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
    eye.position.set(0, 0, s * 0.72);
    g.add(eye);
    const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: getSoftParticleTexture(), color: 0xff3333, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    eyeGlow.position.copy(eye.position);
    eyeGlow.scale.setScalar(s * 1.6);
    g.add(eyeGlow);
    rig.blink.push(eye);

    this.engine(g, rig, m, 0, 0, -s * 0.75, s * 0.2, color);
    rig.muzzles.push(new THREE.Vector3(0, 0, s * 0.95));
  }

  // ── SCOUT: needle dart, forward-swept canards, twin tail fins ─────────────
  private static scout(g: THREE.Group, rig: EnemyRig, m: Mats, s: number, color: number): void {
    const L = s * 2.2;
    g.add(this.fuselage([[0.0, -L * 0.5], [0.22 * s, -L * 0.45], [0.3 * s, -L * 0.1], [0.24 * s, L * 0.25], [0.0, L * 0.55]], m.hull));
    const canopy = this.fuselage([[0, -0.1 * s], [0.16 * s, 0.1 * s], [0.12 * s, 0.4 * s], [0, 0.55 * s]], m.glass, 8);
    canopy.position.set(0, 0.2 * s, 0.1 * s);
    canopy.scale.set(1, 0.7, 1);
    g.add(canopy);

    const wingR = this.panel([[0.2 * s, -0.6 * s], [1.3 * s, -0.25 * s], [1.35 * s, 0.05 * s], [0.25 * s, 0.1 * s]], s * 0.05, m.hull);
    const wingL = this.mirror(wingR);
    g.add(wingR, wingL);
    for (const w of [wingR, wingL]) w.rotation.z = (w === wingR ? -1 : 1) * 0.08;
    const stripeR = this.panel([[0.6 * s, -0.48 * s], [1.3 * s, -0.25 * s], [1.32 * s, -0.12 * s], [0.6 * s, -0.33 * s]], s * 0.07, m.trim);
    g.add(stripeR, this.mirror(stripeR));

    for (const x of [-1, 1]) {
      const fin = this.panel([[0, -0.9 * s], [0, -0.35 * s], [0.08 * s, -0.4 * s], [0.08 * s, -1.0 * s]], s * 0.04, m.dark);
      fin.rotation.z = x * 1.1;
      fin.position.set(x * 0.18 * s, 0.15 * s, 0);
      g.add(fin);
    }
    this.navLight(g, rig, 1.35 * s, 0, 0, 0x33ff66, s * 0.05);
    this.navLight(g, rig, -1.35 * s, 0, 0, 0xff3344, s * 0.05);
    this.engine(g, rig, m, 0, 0, -L * 0.5, s * 0.2, color);
    rig.muzzles.push(new THREE.Vector3(0, -0.05 * s, L * 0.55));
  }

  // ── FIGHTER: arrowhead delta with dihedral wings and twin engines ────────
  private static fighter(g: THREE.Group, rig: EnemyRig, m: Mats, s: number, color: number): void {
    const L = s * 2.1;
    g.add(this.fuselage([[0.05 * s, -L * 0.5], [0.34 * s, -L * 0.4], [0.38 * s, 0], [0.24 * s, L * 0.32], [0.0, L * 0.5]], m.hull, 8));
    const canopy = this.fuselage([[0, 0], [0.2 * s, 0.25 * s], [0.14 * s, 0.6 * s], [0, 0.75 * s]], m.glass, 8);
    canopy.position.set(0, 0.24 * s, 0);
    canopy.scale.set(1, 0.65, 1);
    g.add(canopy);

    const wingR = this.panel([[0.3 * s, -0.75 * s], [1.6 * s, -0.85 * s], [1.7 * s, -0.55 * s], [0.35 * s, 0.55 * s]], s * 0.07, m.hull);
    wingR.rotation.z = -0.14;
    const wingL = this.mirror(wingR);
    wingL.rotation.z = 0.14;
    g.add(wingR, wingL);
    const edgeR = this.panel([[0.36 * s, 0.5 * s], [1.6 * s, -0.6 * s], [1.66 * s, -0.5 * s], [0.4 * s, 0.6 * s]], s * 0.09, m.trim);
    edgeR.rotation.z = -0.14;
    const edgeL = this.mirror(edgeR);
    edgeL.rotation.z = 0.14;
    g.add(edgeR, edgeL);

    // Wingtip cannons
    for (const x of [-1, 1]) {
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.9 * s, 6), m.dark);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(x * 1.62 * s, -0.2 * s, -0.2 * s);
      g.add(gun);
      rig.muzzles.push(new THREE.Vector3(x * 1.62 * s, -0.2 * s, 0.3 * s));
      const fin = this.panel([[0, -0.85 * s], [0, -0.3 * s], [0.07 * s, -0.36 * s], [0.07 * s, -0.95 * s]], s * 0.04, m.dark);
      fin.rotation.z = x * 0.35;
      fin.position.set(x * 0.32 * s, 0.25 * s, 0);
      g.add(fin);
    }
    this.navLight(g, rig, 1.7 * s, -0.22 * s, -0.55 * s, 0x33ff66, s * 0.06);
    this.navLight(g, rig, -1.7 * s, -0.22 * s, -0.55 * s, 0xff3344, s * 0.06);
    this.engine(g, rig, m, 0.2 * s, 0, -L * 0.5, s * 0.17, color);
    this.engine(g, rig, m, -0.2 * s, 0, -L * 0.5, s * 0.17, color);
  }

  // ── INTERCEPTOR: X-foil striker; wings unfold into attack position ───────
  private static interceptor(g: THREE.Group, rig: EnemyRig, m: Mats, s: number, color: number): void {
    const L = s * 2.3;
    g.add(this.fuselage([[0.1 * s, -L * 0.5], [0.3 * s, -L * 0.42], [0.28 * s, L * 0.1], [0.16 * s, L * 0.38], [0.0, L * 0.5]], m.hull, 6));
    const canopy = this.fuselage([[0, 0], [0.15 * s, 0.2 * s], [0.1 * s, 0.5 * s], [0, 0.6 * s]], m.glass, 6);
    canopy.position.set(0, 0.18 * s, 0.2 * s);
    canopy.scale.set(1, 0.7, 1);
    g.add(canopy);

    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const pivot = new THREE.Group();
      const wing = this.panel([[0.15 * s, -0.7 * s], [1.5 * s, -0.55 * s], [1.5 * s, -0.25 * s], [0.15 * s, 0.25 * s]], s * 0.05, m.hull);
      const trim = this.panel([[1.1 * s, -0.6 * s], [1.5 * s, -0.55 * s], [1.5 * s, -0.25 * s], [1.1 * s, -0.2 * s]], s * 0.07, m.trim);
      const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 1.0 * s, 6), m.dark);
      gun.rotation.x = Math.PI / 2;
      gun.position.set(1.52 * s, 0, 0.1 * s);
      wing.add(trim, gun);
      if (sx < 0) wing.scale.x = -1;
      pivot.add(wing);
      pivot.userData.sy = sy;
      g.add(pivot);
      // Open = ±0.32 rad (X), closed = flat.
      rig.wings.push({ obj: pivot, open: sx * sy * -0.34, closed: 0 });
      rig.muzzles.push(new THREE.Vector3(sx * 1.52 * s, sy * 0.45 * s, 0.6 * s));
      this.engine(g, rig, m, sx * 0.22 * s, sy * 0.16 * s, -L * 0.5, s * 0.11, color);
    }
    this.navLight(g, rig, 0, 0.32 * s, -0.4 * s, 0xffffff, s * 0.05);
  }

  // ── BOMBER: heavy flying wing, belly turret, triple engines, side pods ───
  private static bomber(g: THREE.Group, rig: EnemyRig, m: Mats, s: number, color: number): void {
    const wing = this.panel([
      [0, 1.0 * s], [0.6 * s, 0.7 * s], [2.4 * s, -0.4 * s], [2.3 * s, -0.75 * s],
      [0.9 * s, -0.55 * s], [0.5 * s, -0.9 * s], [-0.5 * s, -0.9 * s], [-0.9 * s, -0.55 * s],
      [-2.3 * s, -0.75 * s], [-2.4 * s, -0.4 * s], [-0.6 * s, 0.7 * s],
    ], s * 0.22, m.hull);
    g.add(wing);
    const spine = this.fuselage([[0.2 * s, -0.9 * s], [0.5 * s, -0.6 * s], [0.5 * s, 0.4 * s], [0.25 * s, 0.9 * s], [0, 1.05 * s]], m.dark, 10);
    spine.scale.set(1.2, 0.6, 1);
    g.add(spine);
    const visor = this.panel([[-0.45 * s, 0.75 * s], [0.45 * s, 0.75 * s], [0.25 * s, 0.95 * s], [-0.25 * s, 0.95 * s]], s * 0.1, m.trim);
    visor.position.y = 0.16 * s;
    g.add(visor);
    for (const x of [-1, 1]) {
      const pod = this.fuselage([[0.05 * s, -0.7 * s], [0.25 * s, -0.5 * s], [0.25 * s, 0.4 * s], [0, 0.7 * s]], m.dark, 8);
      pod.position.set(x * 1.5 * s, -0.12 * s, -0.1 * s);
      g.add(pod);
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.26 * s, 0.04 * s, 6, 14), m.trim);
      stripe.position.set(x * 1.5 * s, -0.12 * s, 0.15 * s);
      g.add(stripe);
      this.navLight(g, rig, x * 2.38 * s, 0, -0.55 * s, x > 0 ? 0x33ff66 : 0xff3344, s * 0.07);
      rig.muzzles.push(new THREE.Vector3(x * 1.5 * s, -0.12 * s, 0.75 * s));
    }
    const turret = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.dark);
    dome.rotation.x = Math.PI;
    turret.add(dome);
    for (const x of [-1, 1]) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 0.7 * s, 6), m.trim);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(x * 0.1 * s, -0.18 * s, 0.35 * s);
      turret.add(barrel);
    }
    turret.position.set(0, -0.2 * s, 0.2 * s);
    g.add(turret);
    rig.spin.push({ obj: turret, axis: 'y', speed: 0.8 });
    rig.muzzles.push(new THREE.Vector3(0, -0.4 * s, 0.9 * s));
    for (const x of [-0.6, 0, 0.6]) this.engine(g, rig, m, x * s, 0, -0.95 * s, s * 0.17, color);
  }
}
