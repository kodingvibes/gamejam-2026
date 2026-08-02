// ─── Player Ship Mesh Factory ───────────────────────────────────────────────
//
// Local coordinate convention (matches Three.js lookAt behavior):
//   +Z = forward (nose direction) — lookAt orients +Z toward the target
//   -Z = rear (where engines + fox tail are)
//   +Y = up
//   ±X = left/right wings

import * as THREE from 'three';
import { FoxTail } from './FoxTail';

export class PlayerShipMeshFactory {
  static create(): { group: THREE.Group; fuselage: THREE.Mesh; cockpit: THREE.Mesh; engineGlow: THREE.Mesh; foxTail: FoxTail } {
    const group = new THREE.Group();

    // ── Materials ──
    const hullMat = new THREE.MeshPhongMaterial({ color: 0xc8ccd8, emissive: 0x334455, emissiveIntensity: 0.2, shininess: 100 });
    const accentMat = new THREE.MeshPhongMaterial({ color: 0x2266cc, emissive: 0x1133aa, emissiveIntensity: 0.3, shininess: 80 });
    const darkMat = new THREE.MeshPhongMaterial({ color: 0x445566, emissive: 0x222233, emissiveIntensity: 0.15, shininess: 60 });
    const redMat = new THREE.MeshPhongMaterial({ color: 0xcc2222, emissive: 0x881111, emissiveIntensity: 0.4, shininess: 50 });

    // ── Fuselage: sleek dart body pointing forward (+Z) ──
    // Nose cone (sharp tip at +Z)
    const noseGeo = new THREE.ConeGeometry(0.35, 1.6, 8);
    const nose = new THREE.Mesh(noseGeo, hullMat);
    nose.rotation.x = Math.PI / 2; // +PI/2 puts cone tip toward +Z
    nose.position.set(0, 0, 1.2);
    group.add(nose);

    // Main body (tapered cylinder, wider at rear)
    const bodyGeo = new THREE.CylinderGeometry(0.35, 0.5, 1.8, 8);
    const body = new THREE.Mesh(bodyGeo, hullMat);
    body.rotation.x = Math.PI / 2;
    body.position.set(0, 0, 0);
    group.add(body);

    // Rear cap (dome at the back, -Z)
    const rearGeo = new THREE.ConeGeometry(0.5, 0.4, 8);
    const rear = new THREE.Mesh(rearGeo, darkMat);
    rear.rotation.x = -Math.PI / 2; // points toward -Z (rear)
    rear.position.set(0, 0, -1.1);
    group.add(rear);

    // ── Spine ridge (top detail) ──
    const spineGeo = new THREE.BoxGeometry(0.1, 0.15, 1.4);
    const spine = new THREE.Mesh(spineGeo, accentMat);
    spine.position.set(0, 0.3, 0.2);
    group.add(spine);

    // ── Wings: symmetric swept-back delta wings ──
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, -0.3);         // root leading edge (toward +Z)
    wingShape.lineTo(1.8, 0.2);        // tip
    wingShape.lineTo(1.5, -0.7);       // tip trailing
    wingShape.lineTo(0, -0.9);         // root trailing
    wingShape.lineTo(0, -0.3);
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.06, bevelEnabled: false });
    wingGeo.translate(0, 0, -0.03);
    wingGeo.rotateX(-Math.PI / 2); // lay flat in XZ plane

    // Left wing
    const leftWing = new THREE.Mesh(wingGeo, hullMat);
    leftWing.position.set(-0.3, -0.05, -0.1);
    group.add(leftWing);

    // Right wing (mirror)
    const rightWing = new THREE.Mesh(wingGeo, hullMat);
    rightWing.scale.x = -1;
    rightWing.position.set(0.3, -0.05, -0.1);
    group.add(rightWing);

    // ── Wingtip pods (red accents + nav lights) ──
    const podGeo = new THREE.CapsuleGeometry(0.1, 0.4, 4, 8);
    for (const [x, color] of [[-1.8, 0xff2222], [1.8, 0x22ff22]] as const) {
      const pod = new THREE.Mesh(podGeo, redMat);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(x, -0.05, -0.3);
      group.add(pod);
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 6),
        new THREE.MeshBasicMaterial({ color })
      );
      light.position.set(x * 1.08, -0.05, -0.3);
      group.add(light);
    }

    // ── Cockpit canopy (on top, toward the front) ──
    const cockpitMat = new THREE.MeshPhongMaterial({
      color: 0x66ddff, emissive: 0x1188cc, emissiveIntensity: 0.4,
      transparent: true, opacity: 0.75, shininess: 140,
    });
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      cockpitMat
    );
    cockpit.position.set(0, 0.22, 0.5);
    cockpit.rotation.x = 0.1;
    group.add(cockpit);

    // Cockpit frame ring
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.02, 6, 16), darkMat);
    frame.position.set(0, 0.22, 0.5);
    frame.rotation.x = Math.PI / 2;
    group.add(frame);

    // ── Engine: single rear thruster at center back (-Z) ──
    const nozzleGeo = new THREE.CylinderGeometry(0.25, 0.32, 0.4, 8);
    const nozzle = new THREE.Mesh(nozzleGeo, darkMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0, -1.3);
    group.add(nozzle);

    // Engine glow (bright core at the nozzle exit)
    const glowGeo = new THREE.SphereGeometry(0.22, 10, 10);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x44ddff, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const engineGlow = new THREE.Mesh(glowGeo, glowMat);
    engineGlow.position.set(0, 0, -1.5);
    group.add(engineGlow);

    // Small side thrusters
    for (const x of [-0.35, 0.35]) {
      const sn = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.13, 0.25, 6), darkMat
      );
      sn.rotation.x = Math.PI / 2;
      sn.position.set(x, -0.05, -1.2);
      group.add(sn);
      const sg = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6), glowMat.clone()
      );
      sg.position.set(x, -0.05, -1.35);
      group.add(sg);
    }

    // ── Point light to illuminate the ship ──
    const light = new THREE.PointLight(0x66aaff, 0.8, 15);
    light.position.set(0, 0.5, 0);
    group.add(light);

    // ── Fox tail: fire trail out the rear (-Z) ──
    const foxTail = new FoxTail(group);

    return { group, fuselage: body, cockpit, engineGlow, foxTail };
  }
}