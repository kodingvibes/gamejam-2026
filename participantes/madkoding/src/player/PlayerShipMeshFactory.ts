// ─── Player Ship Mesh Factory ───────────────────────────────────────────────
//
// Local coordinate convention (matches Three.js lookAt behavior):
//   +Z = forward (nose direction) — lookAt orients +Z toward the target
//   -Z = rear (where engines + fox tail are)
//   +Y = up
//   ±X = left/right wings
//
// IMPROVED: More detailed Arwing-style design with better proportions,
// enhanced cockpit, engine details, and visual flair

import * as THREE from 'three';
import { FoxTail } from './FoxTail';

export class PlayerShipMeshFactory {
  static create(): { group: THREE.Group; fuselage: THREE.Mesh; cockpit: THREE.Mesh; engineGlow: THREE.Mesh; foxTail: FoxTail } {
    const group = new THREE.Group();

    // ── Materials ──
    const hullMat = new THREE.MeshPhongMaterial({ color: 0xd8dde8, emissive: 0x445566, emissiveIntensity: 0.25, shininess: 100 });
    const accentMat = new THREE.MeshPhongMaterial({ color: 0x3377dd, emissive: 0x2255bb, emissiveIntensity: 0.4, shininess: 90 });
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x556677, emissive: 0x333344, emissiveIntensity: 0.2, shininess: 70 });
    const redMat = new THREE.MeshPhongMaterial({ color: 0xdd3333, emissive: 0x992222, emissiveIntensity: 0.5, shininess: 60 });
    const detailMat = new THREE.MeshPhongMaterial({ color: 0x8899aa, emissive: 0x445566, emissiveIntensity: 0.15, shininess: 80 });

    // ── Fuselage: sleek dart body pointing forward (+Z) ──
    // Main body with more organic shape
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(0, 0);
    bodyShape.lineTo(0.38, -0.25);
    bodyShape.lineTo(0.38, 1.4);
    bodyShape.lineTo(0, 1.65);
    bodyShape.lineTo(-0.38, 1.4);
    bodyShape.lineTo(-0.38, -0.25);
    bodyShape.lineTo(0, 0);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: 0.55, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 });
    const body = new THREE.Mesh(bodyGeo, hullMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0, 0.1);
    group.add(body);

    // Nose cone (sharp tip at +Z)
    const noseGeo = new THREE.ConeGeometry(0.32, 1.4, 8);
    const nose = new THREE.Mesh(noseGeo, hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 1.35);
    group.add(nose);

    // Nose tip sensor
    const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), 
      new THREE.MeshPhongMaterial({ color: 0x44aaff, emissive: 0x2288cc, emissiveIntensity: 0.4 }));
    noseTip.position.set(0, 0, 2.05);
    group.add(noseTip);

    // Rear cap (dome at the back, -Z)
    const rearGeo = new THREE.ConeGeometry(0.48, 0.5, 8);
    const rear = new THREE.Mesh(rearGeo, darkMat);
    rear.rotation.x = -Math.PI / 2;
    rear.position.set(0, 0, -1.15);
    group.add(rear);

    // ── Spine ridge (top detail with segmented plates) ──
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.25), accentMat);
      plate.position.set(0, 0.32, 0.2 - i * 0.35);
      group.add(plate);
    }

    // Side panel details
    for (const x of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.35), detailMat);
        panel.position.set(x * 0.36, 0.05, 0.3 - i * 0.4);
        group.add(panel);
      }
    }

    // ── Wings: symmetric swept-back delta wings with more detail ──
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.25);
    wingShape.lineTo(1.9, 0.15);
    wingShape.lineTo(1.7, -0.75);
    wingShape.lineTo(0, -0.95);
    wingShape.lineTo(0, -0.25);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
    wingGeo.translate(0, 0, -0.035);
    wingGeo.rotateX(-Math.PI / 2);

    // Left wing
    const leftWing = new THREE.Mesh(wingGeo, hullMat);
    leftWing.position.set(-0.35, -0.08, -0.15);
    group.add(leftWing);

    // Right wing (mirror)
    const rightWing = new THREE.Mesh(wingGeo, hullMat);
    rightWing.scale.x = -1;
    rightWing.position.set(0.35, -0.08, -0.15);
    group.add(rightWing);

    // Wing surface details (panel lines)
    for (const x of [-1, 1]) {
      const lineGeo = new THREE.BoxGeometry(0.02, 0.02, 1.2);
      for (let i = 0; i < 2; i++) {
        const line = new THREE.Mesh(lineGeo, darkMat);
        line.position.set(x * (0.6 + i * 0.4), -0.05, 0.2 - i * 0.3);
        line.rotation.z = x * 0.15;
        group.add(line);
      }
    }

    // ── Wingtip pods (red accents + nav lights) ──
    const podGeo = new THREE.CapsuleGeometry(0.12, 0.5, 4, 8);
    for (const [x, color] of [[-1.95, 0xff2222], [1.95, 0x22ff22]] as const) {
      const pod = new THREE.Mesh(podGeo, redMat);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(x, -0.08, -0.35);
      group.add(pod);
      
      // Nav light with glow
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color })
      );
      light.position.set(x * 1.05, -0.08, -0.35);
      group.add(light);
      
      // Small antenna on top
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.25, 6), detailMat);
      antenna.position.set(x, 0.12, -0.35);
      group.add(antenna);
    }

    // Wing-mounted laser cannons
    for (const x of [-1, 1]) {
      const cannonBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8), darkMat);
      cannonBarrel.rotation.x = Math.PI / 2;
      cannonBarrel.position.set(x * 0.9, -0.12, 0.8);
      group.add(cannonBarrel);
      
      // Cannon tip glow
      const cannonTip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x44ffff, transparent: true, opacity: 0.6 }));
      cannonTip.position.set(x * 0.9, -0.12, 1.18);
      group.add(cannonTip);
    }

    // ── Cockpit canopy (on top, toward the front) ──
    const cockpitMat = new THREE.MeshPhongMaterial({
      color: 0x77eeff, emissive: 0x2299dd, emissiveIntensity: 0.45,
      transparent: true, opacity: 0.75, shininess: 150,
    });
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 14, 12, 0, Math.PI * 2, 0, Math.PI / 2.2),
      cockpitMat
    );
    cockpit.position.set(0, 0.28, 0.55);
    cockpit.rotation.x = 0.15;
    group.add(cockpit);

    // Cockpit frame ring (detailed)
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.035, 8, 20), darkMat);
    frame.position.set(0, 0.28, 0.55);
    frame.rotation.x = Math.PI / 2;
    group.add(frame);
    
    // Additional frame detail
    const frameFront = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 16), accentMat);
    frameFront.position.set(0, 0.3, 0.75);
    frameFront.rotation.x = Math.PI / 2;
    group.add(frameFront);

    // ── Engine: single rear thruster at center back (-Z) ──
    // Engine housing
    const engineHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 10), darkMat);
    engineHousing.rotation.x = Math.PI / 2;
    engineHousing.position.set(0, 0, -1.45);
    group.add(engineHousing);
    
    // Engine nozzle
    const nozzleGeo = new THREE.CylinderGeometry(0.28, 0.38, 0.5, 10);
    const nozzle = new THREE.Mesh(nozzleGeo, detailMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0, -1.85);
    group.add(nozzle);

    // Engine glow (bright core at the nozzle exit)
    const glowGeo = new THREE.SphereGeometry(0.26, 12, 12);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x55eeff, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const engineGlow = new THREE.Mesh(glowGeo, glowMat);
    engineGlow.position.set(0, 0, -2.1);
    group.add(engineGlow);
    
    // Inner flame cone
    const flameCone = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.7 }));
    flameCone.rotation.x = Math.PI / 2;
    flameCone.position.set(0, 0, -2.35);
    group.add(flameCone);

    // Small side thrusters (maneuvering jets)
    for (const x of [-0.4, 0.4]) {
      const sn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.14, 0.3, 8), darkMat
      );
      sn.rotation.x = Math.PI / 2;
      sn.position.set(x, -0.08, -1.65);
      group.add(sn);
      
      const sg = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8), glowMat.clone()
      );
      sg.position.set(x, -0.08, -1.85);
      group.add(sg);
    }

    // Dorsal fin / stabilizer
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(0.35, -0.15);
    finShape.lineTo(0.35, 0.5);
    finShape.lineTo(0, 0.6);
    finShape.lineTo(0, 0);
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: false });
    const fin = new THREE.Mesh(finGeo, accentMat);
    fin.position.set(0, 0.35, -0.8);
    group.add(fin);

    // ── Point light to illuminate the ship ──
    const light = new THREE.PointLight(0x77bbff, 1.0, 18);
    light.position.set(0, 0.6, 0);
    group.add(light);

    // ── Fox tail: fire trail out the rear (-Z) ──
    const foxTail = new FoxTail(group);

    return { group, fuselage: body, cockpit, engineGlow, foxTail };
  }
}