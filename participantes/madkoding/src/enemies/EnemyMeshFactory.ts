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

  private static hullMat(_color: number): THREE.MeshPhongMaterial {
    // All enemy hulls are grey with red accent lines.
    return new THREE.MeshPhongMaterial({ color: 0x8a8f98, emissive: 0x33363c, emissiveIntensity: 0.3, shininess: 60, transparent: true });
  }

  private static darkMat(): THREE.MeshPhongMaterial {
    return new THREE.MeshPhongMaterial({ color: 0x5a5f66, emissive: 0x22252a, emissiveIntensity: 0.25, shininess: 40, transparent: true });
  }

  private static accentMat(color: number): THREE.MeshPhongMaterial {
    // Distinct accent line color per enemy type.
    return new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.9, shininess: 80, transparent: true });
  }

  private static glow(color: number, opacity = 0.8): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  private static addEngineGlow(g: THREE.Group, x: number, y: number, z: number, _color: number, r: number): void {
    // Fire-colored engine glow with a soft light crown (corona).
    const glow = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), this.glow(0xff6622));
    glow.position.set(x, y, z);
    g.add(glow);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2, 8, 8), this.glow(0xff6622, 0.3));
    halo.position.set(x, y, z);
    g.add(halo);
    // Wide, faint corona around the thruster.
    const corona = new THREE.Mesh(new THREE.SphereGeometry(r * 3.2, 10, 10), this.glow(0xff8844, 0.12));
    corona.position.set(x, y, z);
    g.add(corona);
  }

  // Helper: create detailed wing with ribbing
  private static createDetailedWing(shape: THREE.Shape, depth: number, mat: THREE.Material): THREE.Mesh {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    const mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }

  // ── DRONE: octahedron core with rotating ring + 3 prongs ──
  // IMPROVED: Added sensor dish, more angular prongs, layered rings
  private static drone(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(color);

    // Core body (octahedron with detail)
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(size * 0.8, 0), m);
    g.add(core);
    
    // Sensor dish on front
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.2, size * 0.4, size * 0.15, 8), dark);
    dish.rotation.x = Math.PI / 2;
    dish.position.z = size * 0.5;
    g.add(dish);

    // 3 angular prongs with tapered ends
    for (let idx = 0; idx < 3; idx++) {
      const angle = (idx / 3) * Math.PI * 2;
      const prongShape = new THREE.Shape();
      prongShape.moveTo(0, 0);
      prongShape.lineTo(size * 0.7, -size * 0.1);
      prongShape.lineTo(size * 0.9, 0);
      prongShape.lineTo(size * 0.7, size * 0.1);
      prongShape.lineTo(0, 0);
      const prongGeo = new THREE.ExtrudeGeometry(prongShape, { depth: size * 0.08, bevelEnabled: false });
      const prong = new THREE.Mesh(prongGeo, dark);
      prong.position.set(Math.cos(angle) * size * 0.6, Math.sin(angle) * size * 0.6, 0);
      prong.rotation.z = angle + Math.PI / 2;
      g.add(prong);
      
      // Prong tip glow
      const tip = new THREE.Mesh(new THREE.SphereGeometry(size * 0.08, 6, 6), this.glow(color, 0.6));
      tip.position.set(Math.cos(angle) * size * 1.3, Math.sin(angle) * size * 1.3, 0);
      g.add(tip);
    }

    // Inner ring (accent color)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.9, size * 0.06, 8, 24), accent);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    
    // Outer segmented ring
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(size * 0.15, size * 0.05, size * 0.08), dark);
      const segAngle = (i / 8) * Math.PI * 2;
      seg.position.set(Math.cos(segAngle) * size * 1.15, Math.sin(segAngle) * size * 1.15, 0);
      seg.rotation.z = segAngle + Math.PI / 2;
      g.add(seg);
    }

    // Bright center glow (fire) with pulsing core
    const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(size * 0.35, 12, 12), this.glow(0xff6622));
    g.add(coreGlow);
    
    return g;
  }

  // ── SCOUT: sleek arrow with twin prongs and bright green engines ──
  // IMPROVED: More aerodynamic shape, detailed cockpit, winglets
  private static scout(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(color);

    // Main fuselage: elongated teardrop shape
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(0, 0);
    bodyShape.bezierCurveTo(size * 0.5, -size * 0.3, size * 0.5, size * 0.3, 0, size * 0.6);
    bodyShape.bezierCurveTo(-size * 0.3, size * 0.4, -size * 0.3, -size * 0.2, 0, 0);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: size * 1.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    const body = new THREE.Mesh(bodyGeo, m);
    body.rotation.x = Math.PI / 2;
    body.position.z = -size * 0.3;
    g.add(body);

    // Pointed nose cone
    const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.25, size * 0.9, 8), dark);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -size * 1.0;
    g.add(nose);

    // Twin prongs (fork-like front) with glowing tips
    for (const x of [-1, 1]) {
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.06, size * 0.12, size * 0.8, 6), dark);
      prong.rotation.x = Math.PI / 2;
      prong.position.set(x * size * 0.45, 0, -size * 0.6);
      g.add(prong);
      
      // Glowing tip
      const tip = new THREE.Mesh(new THREE.SphereGeometry(size * 0.08, 6, 6), this.glow(color, 0.7));
      tip.position.set(x * size * 0.45, 0, -size * 1.05);
      g.add(tip);
    }

    // Swept-back delta wings with detail lines
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(size * 1.4, -size * 0.3);
    wingShape.lineTo(size * 1.2, -size * 0.6);
    wingShape.lineTo(0, -size * 0.4);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: size * 0.05, bevelEnabled: false });
    wingGeo.rotateX(-Math.PI / 2);
    
    for (const x of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, m);
      w.scale.x = x;
      w.position.set(x * size * 0.3, -size * 0.08, size * 0.1);
      g.add(w);
      
      // Winglet at tip
      const winglet = new THREE.Mesh(new THREE.BoxGeometry(size * 0.04, size * 0.2, size * 0.15), accent);
      winglet.position.set(x * size * 1.1, size * 0.05, size * 0.05);
      g.add(winglet);
    }

    // Cockpit canopy (elongated)
    const cockpit = new THREE.Mesh(
      new THREE.CapsuleGeometry(size * 0.15, size * 0.4, 4, 8),
      new THREE.MeshPhongMaterial({ color: 0x44aaff, emissive: 0x2266cc, emissiveIntensity: 0.3, transparent: true, opacity: 0.6, shininess: 120 })
    );
    cockpit.rotation.x = Math.PI / 2;
    cockpit.position.set(0, size * 0.15, -size * 0.4);
    g.add(cockpit);

    // Engine intakes on sides
    for (const x of [-1, 1]) {
      const intake = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.1, size * 0.15, size * 0.2, 8), dark);
      intake.rotation.z = Math.PI / 2;
      intake.position.set(x * size * 0.25, -size * 0.1, size * 0.3);
      g.add(intake);
    }

    // Bright engine glows (fire) with exhaust nozzles
    for (const x of [-1, 1]) {
      // Nozzle
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.12, size * 0.18, size * 0.25, 8), dark);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x * size * 0.25, 0, size * 0.7);
      g.add(nozzle);
      
      // Glow
      this.addEngineGlow(g, x * size * 0.25, 0, size * 0.95, 0xff6622, size * 0.12);
    }
    
    return g;
  }

  // ── FIGHTER: classic X-wing style with 4 wings and cockpit ──
  // IMPROVED: More detailed fuselage, wing-mounted weapons, engine nacelles
  private static fighter(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(color);

    // Main fuselage: tapered cylinder with ridge details
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(0, 0);
    bodyShape.lineTo(size * 0.35, -size * 0.2);
    bodyShape.lineTo(size * 0.35, size * 1.3);
    bodyShape.lineTo(0, size * 1.5);
    bodyShape.lineTo(-size * 0.35, size * 1.3);
    bodyShape.lineTo(-size * 0.35, -size * 0.2);
    bodyShape.lineTo(0, 0);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: size * 0.6, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    const body = new THREE.Mesh(bodyGeo, m);
    body.rotation.x = Math.PI / 2;
    body.position.z = -size * 0.2;
    g.add(body);

    // Nose cone (pointed)
    const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.28, size * 0.9, 8), dark);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -size * 1.2;
    g.add(nose);

    // Ridge spine on top
    const spine = new THREE.Mesh(new THREE.BoxGeometry(size * 0.12, size * 0.1, size * 1.0), accent);
    spine.position.set(0, size * 0.25, size * 0.1);
    g.add(spine);

    // 4 wings in X pattern with air intakes
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(size * 1.0, -size * 0.2);
    wingShape.lineTo(size * 0.9, -size * 0.5);
    wingShape.lineTo(0, -size * 0.3);
    wingShape.lineTo(0, 0);
    
    for (let idx = 0; idx < 4; idx++) {
      const angle = (idx / 4) * Math.PI * 2 + Math.PI / 4;
      const wGeo = new THREE.ExtrudeGeometry(wingShape, { depth: size * 0.06, bevelEnabled: false });
      const w = new THREE.Mesh(wGeo, dark);
      w.position.set(Math.cos(angle) * size * 0.5, Math.sin(angle) * size * 0.5, size * 0.15);
      w.rotation.z = angle + Math.PI / 2;
      g.add(w);
      
      // Wing root fairing
      const fairing = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.1, size * 0.15, size * 0.2, 6), m);
      fairing.rotation.x = Math.PI / 2;
      fairing.position.set(Math.cos(angle) * size * 0.4, Math.sin(angle) * size * 0.4, size * 0.15);
      g.add(fairing);
      
      // Wing tip cannon with glowing barrel
      const cannonBarrel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.05, size * 0.07, size * 0.4, 8), dark);
      cannonBarrel.rotation.x = Math.PI / 2;
      cannonBarrel.position.set(Math.cos(angle) * size * 1.25, Math.sin(angle) * size * 1.25, size * 0.15);
      g.add(cannonBarrel);
      
      // Glowing tip
      const cannonTip = new THREE.Mesh(new THREE.SphereGeometry(size * 0.06, 6, 6), this.glow(0xff4400, 0.7));
      cannonTip.position.set(Math.cos(angle) * size * 1.45, Math.sin(angle) * size * 1.45, size * 0.15);
      g.add(cannonTip);
    }

    // Cockpit canopy (bubble-style)
    const cockpitMat = new THREE.MeshPhongMaterial({ 
      color: 0x66ccff, emissive: 0x2288cc, emissiveIntensity: 0.35, 
      transparent: true, opacity: 0.65, shininess: 140 
    });
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(size * 0.22, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2.5),
      cockpitMat
    );
    cockpit.position.set(0, size * 0.28, -size * 0.25);
    g.add(cockpit);
    
    // Cockpit frame ring
    const frame = new THREE.Mesh(new THREE.TorusGeometry(size * 0.22, size * 0.025, 6, 16), dark);
    frame.position.set(0, size * 0.28, -size * 0.25);
    frame.rotation.x = Math.PI / 2;
    g.add(frame);

    // Twin engine nacelles at rear
    for (const x of [-0.35, 0.35]) {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.18, size * 0.25, size * 0.5, 8), dark);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(x * size * 0.4, 0, size * 0.7);
      g.add(nacelle);
      
      // Engine glow
      this.addEngineGlow(g, x * size * 0.4, 0, size * 1.0, 0xff6622, size * 0.16);
    }
    
    return g;
  }

  // ── INTERCEPTOR: aggressive twin-hull design with blue engines ──
  // IMPROVED: More aggressive angular design, connecting struts, enhanced engine array
  private static interceptor(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(color);

    // Central bridging wing (swept back)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(size * 1.2, -size * 0.3);
    wingShape.lineTo(size * 1.0, -size * 0.5);
    wingShape.lineTo(0, -size * 0.3);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: size * 0.08, bevelEnabled: false });
    wingGeo.rotateX(-Math.PI / 2);
    const wing = new THREE.Mesh(wingGeo, m);
    g.add(wing);

    // Twin hulls (side booms) with tapered ends
    for (const x of [-1, 1]) {
      // Main boom (elongated capsule-like shape)
      const boomShape = new THREE.Shape();
      boomShape.moveTo(0, 0);
      boomShape.lineTo(size * 0.2, -size * 0.15);
      boomShape.lineTo(size * 0.2, size * 1.2);
      boomShape.lineTo(0, size * 1.4);
      boomShape.lineTo(-size * 0.2, size * 1.2);
      boomShape.lineTo(-size * 0.2, -size * 0.15);
      boomShape.lineTo(0, 0);
      const boomGeo = new THREE.ExtrudeGeometry(boomShape, { depth: size * 0.45, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
      const boom = new THREE.Mesh(boomGeo, m);
      boom.rotation.x = Math.PI / 2;
      boom.position.set(x * size * 0.55, 0, size * 0.1);
      g.add(boom);

      // Angular nose cone on each boom
      const nose = new THREE.Mesh(new THREE.ConeGeometry(size * 0.18, size * 0.7, 6), dark);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(x * size * 0.55, 0, -size * 1.0);
      g.add(nose);
      
      // Nose tip glow
      const noseTip = new THREE.Mesh(new THREE.SphereGeometry(size * 0.06, 6, 6), this.glow(color, 0.5));
      noseTip.position.set(x * size * 0.55, 0, -size * 1.35);
      g.add(noseTip);

      // Vertical stabilizer (winglet) on each boom
      const stab = new THREE.Mesh(new THREE.BoxGeometry(size * 0.05, size * 0.45, size * 0.25), accent);
      stab.position.set(x * size * 0.55, size * 0.25, size * 0.3);
      stab.rotation.z = x * 0.2;
      g.add(stab);
      
      // Horizontal canard near nose
      const canard = new THREE.Mesh(new THREE.BoxGeometry(size * 0.25, 0.04, size * 0.15), dark);
      canard.position.set(x * size * 0.55, -size * 0.08, -size * 0.5);
      g.add(canard);

      // Engine nozzle at rear
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.12, size * 0.2, size * 0.35, 8), dark);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x * size * 0.55, 0, size * 1.1);
      g.add(nozzle);
      
      // Engine glow (fire)
      this.addEngineGlow(g, x * size * 0.55, 0, size * 1.35, 0xff6622, size * 0.14);
    }

    // Central sensor pod (teardrop shape)
    const podShape = new THREE.Shape();
    podShape.moveTo(0, 0);
    podShape.bezierCurveTo(size * 0.15, -size * 0.1, size * 0.15, size * 0.25, 0, size * 0.35);
    podShape.bezierCurveTo(-size * 0.15, size * 0.25, -size * 0.15, -size * 0.1, 0, 0);
    const podGeo = new THREE.ExtrudeGeometry(podShape, { depth: size * 0.3, bevelEnabled: false });
    const pod = new THREE.Mesh(podGeo, accent);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(0, size * 0.18, -size * 0.3);
    g.add(pod);
    
    // Sensor dish on pod front
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.1, size * 0.15, size * 0.1, 8), dark);
    dish.rotation.x = Math.PI / 2;
    dish.position.set(0, size * 0.18, -size * 0.6);
    g.add(dish);
    
    return g;
  }

  // ── BOMBER: large heavy ship with wide wings and dual engines ──
  // IMPROVED: More imposing silhouette, bomb bay details, reinforced armor plating
  private static bomber(size: number, color: number): THREE.Group {
    const g = new THREE.Group();
    const m = this.hullMat(color);
    const dark = this.darkMat();
    const accent = this.accentMat(color);

    // Main fuselage: bulky armored body with panel lines
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 0);
    hullShape.lineTo(size * 0.55, -size * 0.2);
    hullShape.lineTo(size * 0.55, size * 1.4);
    hullShape.lineTo(0, size * 1.6);
    hullShape.lineTo(-size * 0.55, size * 1.4);
    hullShape.lineTo(-size * 0.55, -size * 0.2);
    hullShape.lineTo(0, 0);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: size * 0.9, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2 });
    const hull = new THREE.Mesh(hullGeo, m);
    hull.rotation.x = Math.PI / 2;
    hull.position.z = -size * 0.2;
    g.add(hull);

    // Angular nose (wedge-shaped bombardier section)
    const noseShape = new THREE.Shape();
    noseShape.moveTo(0, 0);
    noseShape.lineTo(size * 0.5, -size * 0.3);
    noseShape.lineTo(size * 0.35, size * 0.5);
    noseShape.lineTo(-size * 0.35, size * 0.5);
    noseShape.lineTo(-size * 0.5, -size * 0.3);
    noseShape.lineTo(0, 0);
    const noseGeo = new THREE.ExtrudeGeometry(noseShape, { depth: size * 0.7, bevelEnabled: false });
    const nose = new THREE.Mesh(noseGeo, dark);
    nose.rotation.x = Math.PI / 2;
    nose.position.z = -size * 1.3;
    g.add(nose);
    
    // Nose glazing (transparent cockpit area)
    const glazingMat = new THREE.MeshPhongMaterial({ 
      color: 0x446688, emissive: 0x224466, emissiveIntensity: 0.2,
      transparent: true, opacity: 0.5, shininess: 100
    });
    const glazing = new THREE.Mesh(new THREE.SphereGeometry(size * 0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), glazingMat);
    glazing.position.set(0, size * 0.15, -size * 1.1);
    g.add(glazing);

    // Large swept wings with structural supports
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(size * 2.2, size * 0.2);
    wingShape.lineTo(size * 2.0, -size * 0.6);
    wingShape.lineTo(0, -size * 0.4);
    wingShape.lineTo(0, 0);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: size * 0.12, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
    wingGeo.rotateX(-Math.PI / 2);
    for (const x of [-1, 1]) {
      const w = new THREE.Mesh(wingGeo, dark);
      w.scale.x = x;
      w.position.set(x * size * 0.5, -size * 0.15, size * 0.2);
      g.add(w);
      
      // Wing support strut
      const strut = new THREE.Mesh(new THREE.BoxGeometry(size * 0.08, size * 0.08, size * 0.5), m);
      strut.position.set(x * size * 0.8, -size * 0.25, size * 0.3);
      strut.rotation.z = x * 0.15;
      g.add(strut);
      
      // Engine nacelle mounted under wing
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.22, size * 0.28, size * 0.8, 10), dark);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(x * size * 1.4, -size * 0.35, size * 0.4);
      g.add(nacelle);
      
      // Wingtip navigation light
      const navLight = new THREE.Mesh(new THREE.SphereGeometry(size * 0.08, 6, 6), 
        new THREE.MeshBasicMaterial({ color: x < 0 ? 0xff0000 : 0x00ff00 }));
      navLight.position.set(x * size * 2.1, -size * 0.1, size * 0.15);
      g.add(navLight);
    }

    // Top turret (rotating gun platform)
    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.3, size * 0.4, size * 0.25, 10), dark);
    turretBase.position.set(0, size * 0.45, -size * 0.1);
    g.add(turretBase);
    
    const turretDome = new THREE.Mesh(new THREE.SphereGeometry(size * 0.28, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2), 
      new THREE.MeshPhongMaterial({ color: 0x6688aa, transparent: true, opacity: 0.4 }));
    turretDome.position.set(0, size * 0.58, -size * 0.1);
    g.add(turretDome);
    
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.07, size * 0.09, size * 0.5, 8), accent);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, size * 0.55, -size * 0.5);
    g.add(barrel);

    // Ventral (bottom) gun position
    const ventralTurret = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.15, size * 0.2, size * 0.2, 8), dark);
    ventralTurret.position.set(0, -size * 0.35, size * 0.3);
    g.add(ventralTurret);
    
    const ventralBarrel = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.05, size * 0.06, size * 0.35, 6), accent);
    ventralBarrel.rotation.x = Math.PI / 2;
    ventralBarrel.position.set(0, -size * 0.45, size * 0.5);
    g.add(ventralBarrel);

    // Bomb bay doors (visible panels on underside)
    const bombBay = new THREE.Mesh(new THREE.BoxGeometry(size * 0.4, 0.05, size * 0.8), dark);
    bombBay.position.set(0, -size * 0.4, size * 0.4);
    g.add(bombBay);

    // Twin engines with detailed nozzles
    for (const x of [-0.45, 0.45]) {
      // Engine housing
      const engHousing = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.25, size * 0.32, size * 0.7, 10), m);
      engHousing.rotation.x = Math.PI / 2;
      engHousing.position.set(x * size, -size * 0.15, size * 1.1);
      g.add(engHousing);
      
      // Exhaust nozzle
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.2, size * 0.28, size * 0.4, 10), dark);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(x * size, -size * 0.15, size * 1.55);
      g.add(nozzle);
      
      // Engine glow (fire) with inner cone
      this.addEngineGlow(g, x * size, -size * 0.15, size * 1.85, 0xff6622, size * 0.18);
      
      // Inner flame cone
      const flameCone = new THREE.Mesh(new THREE.ConeGeometry(size * 0.12, size * 0.4, 8), 
        new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.6 }));
      flameCone.rotation.x = -Math.PI / 2;
      flameCone.position.set(x * size, -size * 0.15, size * 1.75);
      g.add(flameCone);
    }
    
    // Armor plate details on hull sides
    for (const x of [-1, 1]) {
      for (let z = 0; z < 3; z++) {
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.03, size * 0.3, size * 0.4), accent);
        plate.position.set(x * size * 0.58, 0, -size * 0.5 + z * size * 0.5);
        g.add(plate);
      }
    }
    
    return g;
  }
}
