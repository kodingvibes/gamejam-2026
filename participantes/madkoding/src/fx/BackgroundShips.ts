// ─── Background Corvettes (decorative large ships, off to the sides) ────────
// Corvettes stay FAR off the play field (|x| > 40) so they never block the
// ship's path. Some enemy formations spawn from behind a corvette.

import * as THREE from 'three';

interface Corvette {
  group: THREE.Group;
  speed: number;
  side: number; // -1 = left, +1 = right
}

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
  }

  get positions(): THREE.Vector3[] { return this._positions; }

  private createCorvette(index: number): Corvette {
    const group = new THREE.Group();
    const side = index % 2 === 0 ? -1 : 1;

    // Materials — lighter grey with strong emissive so they're visible at distance
    const hullMat = new THREE.MeshPhongMaterial({
      color: 0x8a9bb0, emissive: 0x445566, emissiveIntensity: 0.5, shininess: 50,
    });
    const darkMat = new THREE.MeshPhongMaterial({
      color: 0x6a7a8a, emissive: 0x334455, emissiveIntensity: 0.4, shininess: 40,
    });
    const accentMat = new THREE.MeshPhongMaterial({
      color: 0x4466aa, emissive: 0x224488, emissiveIntensity: 0.5, shininess: 50,
    });

    // ── Angular wedge hull (octahedron stretched) ──
    const hullGeo = new THREE.ConeGeometry(3, 16, 4); // 4-sided = angular diamond
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = Math.PI / 2;
    hull.rotation.z = Math.PI / 4;
    hull.scale.set(1.2, 1, 1);
    group.add(hull);

    // ── Angular bow (pyramid front) ──
    const bowGeo = new THREE.ConeGeometry(3, 6, 4);
    const bow = new THREE.Mesh(bowGeo, hullMat);
    bow.rotation.x = Math.PI / 2;
    bow.rotation.z = Math.PI / 4;
    bow.position.z = -10;
    bow.scale.set(1.2, 1, 1);
    group.add(bow);

    // ── Flat stern panel ──
    const sternGeo = new THREE.BoxGeometry(4, 1, 3);
    const stern = new THREE.Mesh(sternGeo, darkMat);
    stern.position.z = 9.5;
    group.add(stern);

    // ── Bridge tower (angular box) ──
    const towerGeo = new THREE.BoxGeometry(2.5, 3, 3.5);
    const tower = new THREE.Mesh(towerGeo, darkMat);
    tower.position.set(0, 2, -1);
    group.add(tower);

    // Tower top antenna
    const antGeo = new THREE.BoxGeometry(0.1, 2, 0.1);
    const ant = new THREE.Mesh(antGeo, darkMat);
    ant.position.set(0, 4.5, -1);
    group.add(ant);

    // ── Angular side fins (delta shapes) ──
    for (const x of [-1, 1]) {
      const finShape = new THREE.Shape();
      finShape.moveTo(0, 0);
      finShape.lineTo(x * 5, 1);
      finShape.lineTo(x * 5, -2);
      finShape.lineTo(0, -3);
      finShape.lineTo(0, 0);
      const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.3, bevelEnabled: false });
      finGeo.rotateX(-Math.PI / 2);
      const fin = new THREE.Mesh(finGeo, darkMat);
      fin.position.set(x * 2.5, -0.5, 3);
      group.add(fin);
    }

    // ── Running lights (row of small glowing dots along the hull) ──
    const lightGeo = new THREE.SphereGeometry(0.15, 6, 6);
    const lightColors = [0x00ffff, 0xff4400, 0x00ff00, 0xffaa00];
    for (let i = 0; i < 8; i++) {
      const t = i / 7;
      const z = -6 + t * 12;
      const x = 2.5 * Math.cos(t * Math.PI) * (1 - Math.abs(t - 0.5) * 0.3);
      for (const dir of [-1, 1]) {
        const c = lightColors[i % lightColors.length];
        const light = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({
          color: c, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        light.position.set(dir * x, 0.3, z);
        group.add(light);
      }
    }

    // ── Engine glows (bright blue, rear) ──
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x44aaff, transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    for (const x of [-1.2, 0, 1.2]) {
      const g = new THREE.Mesh(new THREE.CircleGeometry(0.6, 8), glowMat.clone());
      g.position.set(x, 0, 11);
      g.rotation.y = Math.PI;
      group.add(g);
    }

    // ── Blinking red beacon on top ──
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beacon.position.set(0, 5, -1);
    beacon.name = 'beacon';
    group.add(beacon);

    // ── Position: far off to the side, never in the play field ──
    const xOff = side * THREE.MathUtils.randFloat(50, 90);
    const yOff = THREE.MathUtils.randFloat(-20, 30);
    const zOff = -THREE.MathUtils.randFloat(80, 250) - index * 40;
    group.scale.setScalar(3);
    group.position.set(xOff, yOff, zOff);

    return { group, speed: THREE.MathUtils.randFloat(3, 7), side };
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    for (let i = 0; i < this.corvettes.length; i++) {
      const c = this.corvettes[i];
      // Drift slowly toward +Z (toward and past the player)
      c.group.position.z += c.speed * dt;

      // Beacon blink
      const beacon = c.group.getObjectByName('beacon');
      if (beacon) {
        (beacon as THREE.Mesh).visible = Math.floor(performance.now() * 0.003) % 2 === 0;
      }

      // Record position for WaveManager to spawn enemies behind
      this._positions[i].copy(c.group.position);

      // Recycle when it passes the player — keep it off to the sides
      if (c.group.position.z > playerPos.z + 50) {
        c.group.position.set(
          c.side * THREE.MathUtils.randFloat(50, 90),
          THREE.MathUtils.randFloat(-20, 30),
          playerPos.z - THREE.MathUtils.randFloat(180, 300)
        );
      }
    }
  }

  reset(): void {
    for (let i = 0; i < this.corvettes.length; i++) {
      const c = this.corvettes[i];
      c.group.position.set(
        c.side * THREE.MathUtils.randFloat(50, 90),
        THREE.MathUtils.randFloat(-20, 30),
        -THREE.MathUtils.randFloat(80, 250) - i * 40
      );
    }
  }

  dispose(): void {
    for (const c of this.corvettes) {
      this.scene.remove(c.group);
      c.group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
    this.corvettes = [];
  }
}