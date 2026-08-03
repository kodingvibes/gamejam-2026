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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { FoxTail } from './FoxTail';

export class PlayerShipMeshFactory {
  /**
   * Load the external GLB player ship model (public/models/player-ship.glb).
   *
   * The GLB was exported from Blender (glTF is Y-up). In the game convention
   * +Z = forward (nose), so we rotate +90° around X to map the model's +Y
   * (nose) onto +Z. We also recenter it and scale it to match the size of the
   * procedural ship it replaces.
   *
   * Returns null if the model fails to load (caller keeps the procedural ship).
   */
  static async loadGLB(): Promise<THREE.Group | null> {
    try {
      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('./draco/');
      loader.setDRACOLoader(draco);
      const gltf = await loader.loadAsync('./models/player-ship.glb');
      const model = gltf.scene;

// Roll the model 180° about the X (nose) axis so the roof points +Y,
      // while the nose stays pointing toward -Z.
      model.rotation.set(Math.PI, 0, 0);

      // Scale to match the procedural ship's visual size.
      const scale = 4.5;
      model.scale.setScalar(scale);

      // Recenter so the ship pivot sits at the origin.
      model.position.set(0, 0, 0);

      return model;
    } catch (err) {
      console.warn('[PlayerShip] Failed to load GLB model, keeping procedural ship:', err);
      return null;
    }
  }

  static create(): { group: THREE.Group; fuselage: THREE.Mesh; cockpit: THREE.Mesh; engineGlow: THREE.Mesh; foxTail: FoxTail } {
    const group = new THREE.Group();

    const hullMat = new THREE.MeshStandardMaterial({ color: 0xd8dde8, roughness: 0.35, metalness: 0.7, emissive: 0x111827, emissiveIntensity: 0.15 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.45, metalness: 0.6, emissive: 0x0a1018, emissiveIntensity: 0.1 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x3377dd, roughness: 0.3, metalness: 0.75, emissive: 0x112244, emissiveIntensity: 0.25 });

    // ── Fuselage: single box body ──
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 2.0), hullMat);
    body.position.set(0, 0, 0.1);
    group.add(body);

    // ── Nose: single cone ──
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.4, 6), hullMat);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0, 1.5);
    group.add(nose);

    // ── Wings: two boxes (no ExtrudeGeometry) ──
    const leftWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.2), accentMat);
    leftWing.position.set(-1.1, -0.08, -0.1);
    group.add(leftWing);
    const rightWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 1.2), accentMat);
    rightWing.position.set(1.1, -0.08, -0.1);
    group.add(rightWing);

    // ── Cockpit: half-sphere ──
    const cockpitMat = new THREE.MeshPhongMaterial({
      color: 0x77eeff, emissive: 0x2299dd, emissiveIntensity: 0.45,
      transparent: true, opacity: 0.75, shininess: 150,
    });
    const cockpit = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2.2),
      cockpitMat,
    );
    cockpit.position.set(0, 0.28, 0.5);
    group.add(cockpit);

    // ── Engine housing + glow ──
    const engineHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.6, 6), darkMat);
    engineHousing.rotation.x = Math.PI / 2;
    engineHousing.position.set(0, 0, -1.15);
    group.add(engineHousing);

    const engineGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x55eeff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    engineGlow.position.set(0, 0, -1.4);
    group.add(engineGlow);

    // ── 2 wingtip nav lights ──
    for (const [x, color] of [[-2, 0xff2222], [2, 0x22ff22]] as const) {
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), new THREE.MeshBasicMaterial({ color }));
      light.position.set(x, -0.08, -0.1);
      group.add(light);
    }

    // Engine SpotLight: cyan thruster glow at the rear, casting backward.
    const engineLight = new THREE.SpotLight(0x55eeff, 7000.0);
    engineLight.position.set(0, 0, -2.1);
    engineLight.target.position.set(0, 0, -8);
    engineLight.angle = Math.PI / 2.2;
    engineLight.penumbra = 0.7;
    engineLight.distance = 28;
    engineLight.decay = 1.5;
    group.add(engineLight);
    group.add(engineLight.target);

    // ── Fox tail: fire trail out the rear (-Z) ──
    const foxTail = new FoxTail(group);

    return { group, fuselage: body, cockpit, engineGlow, foxTail };
  }
}